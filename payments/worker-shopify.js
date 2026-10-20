// Disputt payments, the Shopify edition: the small server between the game and a Shopify shop. One file, no dependencies, made for
// a Cloudflare Worker (paste it into the dashboard's editor; docs/SHOPIFY.md has every step). payments/worker.js is the Stripe
// edition; the game talks to either the same way, and only one of the two is set up.
//
// Shopify's own checkout takes the payment (Vipps, Apple Pay, cards). The game sends the host there in a new tab with a cart link
// that carries a code the page has made up (a cart attribute called "kode"). When the order is paid, Shopify calls this Worker (a
// webhook), which writes down "this code was paid, for this package, at this time". The game then asks for the pass with the code.
//
// The button «Betal med Vipps» in the game is the other way in (docs/VIPPS.md): the payment goes straight to Vipps (the ePayment API),
// and when Vipps has the money, this Worker makes a paid order in Shopify (with the code and the consent on it), so that the receipt, the
// VAT and the list of orders are in the shop as before. From there on it is an order like any other.
//
//   GET  /shop            { shop, variants, vipps }  where the game sends the host: the shop's address and the packages' variant ids;
//                                                 `vipps` says whether the button «Betal med Vipps» is to be shown
//   POST /restore         { code }                has this code been paid? returns the pass. The page asks while the host pays in the
//                                                 other tab, and a customer on a new phone asks with the code from the e-mail
//   POST /shopify/webhook                         Shopify says that an order was paid, cancelled or refunded (signed: nobody else gets in)
//   POST /vipps/start     { plan, code, samtykke, rabatt? }  makes a payment at Vipps: { url, reference }, where to send the host (`rabatt`: a discount code)
//   POST /vipps/status    { reference }           { state: "started" | "done" | "failed" }: what the page the host comes back to shows
//   POST /discount        { code }                is this a discount code of the shop's, and what do the packages cost with it? (the same codes as
//                                                 in Shopify's checkout, which the owner makes in Shopify; needs the access read_discounts)
//   POST /vipps/webhook                           Vipps says that a payment was authorized, aborted or has expired (signed)
//   POST /vipps/admin/webhook   (Bearer ADMIN_TOKEN)  registers that webhook at Vipps (once, and again if it is ever lost)
//   GET  /vipps/admin/check     (Bearer ADMIN_TOKEN)  tries every connection (Vipps, Shopify, the prices) and says what works
//   GET  /health                                  { ok, provider, mode: "test" | "live", site, shop, set, vipps, hooks }   (to check the set-up and to see
//                                                 what became of the last calls from Shopify and Vipps; no secrets, no names, no order numbers)
//
// A pass is a JWT signed with ES256; the page checks it with the matching public key (public/js/pay/pass.js). What the end of
// the access is (12 hours, a year, never) is decided here and signed into the pass; Shopify only says what was paid, and when.
// Only the order id, the code, the package, the times (of the payment and of the consent) and the amount are kept: no names, no e-mail
// addresses. An order counts only if it carries the consent to getting the access at once (the cart attribute "samtykke"): without it
// the right of withdrawal would not end with the delivery, so nothing is delivered until a person has looked at the order.
//
// Settings (Worker > Settings > Variables and secrets, and Bindings):
//   DB                      binding  a D1 database (empty: the Worker makes its own tables)
//   SHOPIFY_WEBHOOK_SECRET  secret   the signing secret shown on Shopify's Settings > Notifications > Webhooks
//   JWT_PRIVATE_KEY         secret   the private signing key, base64 of the PKCS#8 DER (docs/BETALING.md shows how to make it)
//   SITE_URL                text     where the game lives, e.g. https://disputt.site/
//   SHOP_URL                text     the shop, e.g. https://shop.disputt.site
//   VARIANT_EVENING, VARIANT_YEAR   text   the variant ids of the two products that are always for sale (numbers)
//   VARIANT_WEEKEND         text     the variant id of the weekend product (72 hours); until it is set, the weekend is not offered
//   VARIANT_LIFETIME        text     no longer for sale; may stay set so that orders of it that are paid later still count, or be left out
//   ACCEPT_TEST_ORDERS      text     optional: "true" while testing with Shopify's test mode, so that test orders count. Never in live use.
// ... and for the button «Betal med Vipps» (all of them, or the button stays hidden; docs/VIPPS.md):
//   VIPPS_ENABLED           text     "true" shows the button. Everything below must be set too.
//   VIPPS_ENV               text     "test" (Vipps' test environment, and the orders in Shopify are test orders) or "live" (the default)
//   VIPPS_MSN, VIPPS_CLIENT_ID                       text     from Vipps' business portal, For developers
//   VIPPS_CLIENT_SECRET, VIPPS_SUBSCRIPTION_KEY      secret   the same place
//   SHOPIFY_STORE           text     the shop's own name at Shopify: the «xxx» of xxx.myshopify.com
//   SHOPIFY_CLIENT_ID       text     the app in Shopify's Dev Dashboard that is allowed to read the prices and make orders
//   SHOPIFY_CLIENT_SECRET   secret   the same
//   ADMIN_TOKEN             secret   a long made-up text: whoever has it can register the Vipps webhook and run the check (16 characters at least)
//   SHOPIFY_API_VERSION     text     optional: the version of Shopify's Admin API (a default is built in)
//   VIPPS_API_URL, SHOPIFY_ADMIN_URL   text   only for the tests: a pretend Vipps and a pretend Shopify on this machine
// And, for the payments that are not finished when the host leaves: Triggers > Cron Triggers > every five minutes (the Worker has a
// scheduled() for it, which finishes what Vipps has authorized but the page has not heard of).

/** One calendar year after `seconds` (the same day and time, UTC; a year bought on 29 February ends on 1 March). */
function plusOneYear(seconds) {
  const d = new Date(seconds * 1000);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return Math.floor(d.getTime() / 1000);
}

/**
 * The packages. `ends(paidAt)` is when the access ends, in seconds, for an order paid at `paidAt` (seconds); null means never.
 * `rank` says which one wins when an order holds more than one (the cart link can be edited by whoever holds it).
 */
const PLANS = {
  evening: { name: 'En kveld', rank: 1, ends: (paidAt) => paidAt + 12 * 3600 },
  weekend: { name: 'En helg', rank: 2, ends: (paidAt) => paidAt + 72 * 3600 },
  year: { name: 'For ett år', rank: 3, ends: plusOneYear },
  // not for sale any more (the price model of 2026-10-20), but passes and orders of it keep working, so it stays here
  lifetime: { name: 'Livstid', rank: 4, ends: () => null, retired: true },
};

const VARIANT_VARS = { evening: 'VARIANT_EVENING', weekend: 'VARIANT_WEEKEND', year: 'VARIANT_YEAR', lifetime: 'VARIANT_LIFETIME' };
/** The ones that must be set for the shop to work at all: the weekend is added when its product exists. */
const REQUIRED_VARIANTS = ['evening', 'year'];
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const te = new TextEncoder();
const MAX_WEBHOOK_BYTES = 1_000_000;
const MIN_SECRET = 16; // (Shopify's signing secrets are much longer: a short one is somebody's placeholder, and anybody could sign with it)

class HttpError extends Error {
  constructor(status, code, message, detail) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}
const bad = (message) => new HttpError(400, 'bad_request', message);

// ------------------------------------------------------------------------------------------------ small helpers

function bytesToB64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const b64ToBytes = (text) => Uint8Array.from(atob(String(text).replace(/\s+/g, '')), (c) => c.charCodeAt(0));

/** A key that was pasted as PEM ("-----BEGIN PRIVATE KEY-----") is fine too. */
const keyBytes = (text) => b64ToBytes(String(text).replace(/-----[A-Z ]+-----/g, ''));

/** What a person typed, as the canonical code, or null (forgives case, spaces, dashes and O/I/L typed for 0/1/1). */
function normalizeCode(input) {
  const raw = String(input ?? '')
    .toUpperCase()
    .replace(/[\s\-–—_.]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (raw.length !== 12 || [...raw].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

/** What was typed as the address of the game: spaces round it and a missing "https://" are forgiven (disputt.site/ is https://disputt.site/). */
const asUrl = (text) => {
  const raw = String(text ?? '').trim();
  return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
};

const siteUrl = (env) => {
  let u;
  try {
    u = asUrl(env.SITE_URL);
  } catch {
    throw new HttpError(503, 'unavailable', 'Betalingen er ikke satt opp riktig (SITE_URL mangler).');
  }
  if (!u.pathname.endsWith('/')) u.pathname += '/';
  u.search = '';
  u.hash = '';
  return u;
};

/** The shop's own address (no path): where the host is sent to pay. (Plain http is only for a pretend shop on this machine, in the tests.) */
function shopOrigin(env) {
  let u = null;
  try {
    u = new URL(String(env.SHOP_URL ?? '').trim());
  } catch {
    /* reported below */
  }
  const local = u?.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u?.protocol !== 'https:' && !local) throw new HttpError(503, 'unavailable', 'Betalingen er ikke satt opp riktig (SHOP_URL må være butikkens adresse, https://…).');
  return u.origin;
}

const testOrders = (env) => String(env.ACCEPT_TEST_ORDERS).toLowerCase() === 'true';

/** The variant id of each package, as text; the ones that are not set (or not numbers) are left out. */
function variantIds(env) {
  const ids = {};
  for (const [plan, name] of Object.entries(VARIANT_VARS)) {
    const id = String(env[name] ?? '').trim();
    if (/^\d{5,20}$/.test(id)) ids[plan] = id;
  }
  return ids;
}

/** The packages that are for sale: not the retired ones, and only those that have a variant. */
const forSale = (env) => Object.keys(PLANS).filter((plan) => !PLANS[plan].retired && variantIds(env)[plan]);

// ------------------------------------------------------------------------------------------------ passes

/**
 * Signs a pass for an order. `paidAt` is in seconds. `aud` is this payment server's own address: a pass is only good for the page that
 * is set up with this server, so a pass from a test server is no use on the live page even if the two were given the same key.
 */
async function signPass(env, { plan, paidAt, issuedAt, aud }) {
  if (!env.JWT_PRIVATE_KEY) throw new HttpError(503, 'unavailable', 'Betalingen er ikke satt opp ennå (JWT_PRIVATE_KEY mangler).');
  const end = PLANS[plan].ends(paidAt);
  const payload = { iss: 'disputt', ...(aud ? { aud } : {}), plan, pa: paidAt, iat: issuedAt, ...(end === null ? {} : { exp: end }) };
  let key;
  try {
    key = await crypto.subtle.importKey('pkcs8', keyBytes(env.JWT_PRIVATE_KEY), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  } catch {
    throw new HttpError(503, 'unavailable', 'Betalingen er ikke satt opp riktig (JWT_PRIVATE_KEY kan ikke leses).');
  }
  const head = bytesToB64url(te.encode(JSON.stringify({ alg: 'ES256', typ: 'JWT' })));
  const body = bytesToB64url(te.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(`${head}.${body}`)));
  return { token: `${head}.${body}.${bytesToB64url(sig)}`, expiresAt: payload.exp === undefined ? null : payload.exp * 1000 };
}

// ------------------------------------------------------------------------------------------------ the database

const SCHEMA = [
  // one row per paid order. `code` is what the buyer carried in the cart; the same code can in theory sit on more than one order
  // (a cart link that is paid twice), so it is not unique. `state`: paid | refunded | cancelled | disputed. Amounts are in øre (of
  // `currency`), the times in seconds: `consented_at` is when the host agreed to getting the access at once.
  `CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY, code TEXT NOT NULL, plan TEXT NOT NULL, paid_at INTEGER NOT NULL, consented_at INTEGER NOT NULL, amount INTEGER NOT NULL,
    currency TEXT NOT NULL, name TEXT NOT NULL, test INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'paid', refunded INTEGER NOT NULL DEFAULT 0
  )`,
  'CREATE INDEX IF NOT EXISTS orders_code ON orders (code)',
  // what has been refunded, and what has been stopped (cancelled, disputed): Shopify does not promise to say things in the order they
  // happened, so a refund or a cancel can come before the order is written down. These are looked at when the order comes.
  'CREATE TABLE IF NOT EXISTS refunds (refund_id TEXT PRIMARY KEY, order_id TEXT NOT NULL, amount INTEGER NOT NULL, currency TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS stops (order_id TEXT PRIMARY KEY, state TEXT NOT NULL)',
  // what became of the last calls from Shopify (the topic, and "ok", "ignored: why", "error: why" or "bad_signature"), so that a person who
  // wonders why a paid order never gave access can look at /health. Nothing about the order itself, and only the last HOOKS_KEPT.
  'CREATE TABLE IF NOT EXISTS hooks (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, topic TEXT NOT NULL, result TEXT NOT NULL)',
  // one row per payment started with Vipps (the button «Betal med Vipps»). `state`: started (made at Vipps, the host is paying) | captured
  // (Vipps has the money, the order in Shopify is not made yet) | done (the order is made and written down in `orders`) | failed (the host
  // backed out, or the time ran out: no money was taken). Amounts are in øre, the times in seconds. `locked_until` keeps two calls (the
  // webhook, the page asking, the clock) from finishing the same payment at once. `order_id` is the order in Shopify. No names, no e-mail.
  `CREATE TABLE IF NOT EXISTS vipps (
    reference TEXT PRIMARY KEY, code TEXT NOT NULL, plan TEXT NOT NULL, amount INTEGER NOT NULL, consented_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'started', order_id TEXT, test INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER NOT NULL DEFAULT 0, order_started_at INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT ''
  )`,
  'CREATE INDEX IF NOT EXISTS vipps_code ON vipps (code)',
  'CREATE INDEX IF NOT EXISTS vipps_open ON vipps (state, created_at)',
  // small things the Worker keeps for itself: the signing secret of the webhook that was registered at Vipps
  'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  // one row for every time somebody asks whether a discount code is good (to keep the number of questions to Shopify in check)
  'CREATE TABLE IF NOT EXISTS discount_checks (at INTEGER NOT NULL)',
];
const HOOKS_KEPT = 100;
const prepared = new WeakSet(); // (the databases whose tables are known to be there)

/** The database, with the tables made. A binding that is missing says so in words. */
// Columns that came later (a table that was made before them gets them here; one that has them already says so, which is no harm)
const ADDED_COLUMNS = ["ALTER TABLE vipps ADD COLUMN discount_code TEXT NOT NULL DEFAULT ''", 'ALTER TABLE vipps ADD COLUMN list_amount INTEGER NOT NULL DEFAULT 0'];

async function database(env) {
  if (typeof env.DB?.prepare !== 'function') throw new HttpError(503, 'unavailable', 'Betalingen er ikke satt opp ennå (databasen DB mangler).');
  if (!prepared.has(env.DB)) {
    await env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql)));
    for (const sql of ADDED_COLUMNS) {
      await env.DB.prepare(sql)
        .run()
        .catch((err) => {
          if (!/duplicate column/i.test(String(err?.message ?? err))) throw err;
        });
    }
    prepared.add(env.DB);
  }
  return env.DB;
}

/** Adds up what has been refunded on an order (in its own currency; a refund that does not say which counts), and marks the order refunded once all of it is. */
const applyRefunds = (db, orderId) =>
  db
    .prepare(
      `UPDATE orders SET
         refunded = (SELECT COALESCE(SUM(amount), 0) FROM refunds WHERE refunds.order_id = orders.order_id AND (refunds.currency = orders.currency OR refunds.currency = '')),
         state = CASE WHEN state = 'paid' AND amount > 0 AND (SELECT COALESCE(SUM(amount), 0) FROM refunds WHERE refunds.order_id = orders.order_id AND (refunds.currency = orders.currency OR refunds.currency = '')) >= amount
                      THEN 'refunded' ELSE state END
       WHERE order_id = ?`,
    )
    .bind(orderId);

/** An order that has been cancelled or disputed stays stopped, also when the call about the paid order only comes after that. */
const applyStops = (db, orderId) =>
  db
    .prepare(
      `UPDATE orders SET state = (SELECT state FROM stops WHERE stops.order_id = orders.order_id)
       WHERE order_id = ? AND state = 'paid' AND EXISTS (SELECT 1 FROM stops WHERE stops.order_id = orders.order_id)`,
    )
    .bind(orderId);

// ------------------------------------------------------------------------------------------------ Shopify's webhooks

const toOre = (text) => {
  const n = Math.round(Number(text) * 100);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const toSeconds = (text) => {
  const t = Date.parse(text);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
};
// (`hint` goes into the note that /health shows and no further: names and numbers that say what was missing, never what the buyer typed)
const ignored = (why, hint) => ({ ok: true, ignored: why, ...(hint ? { hint } : {}) });

/** Spaces and line breaks round a secret that was pasted into the dashboard are no part of it. */
const webhookSecret = (env) => String(env.SHOPIFY_WEBHOOK_SECRET ?? '').trim();

/** Checks Shopify's signature: HMAC-SHA256 of the body with the signing secret, in base64, in the X-Shopify-Hmac-Sha256 header. */
async function checkSignature(env, bytes, header) {
  if (webhookSecret(env).length < MIN_SECRET) throw new HttpError(503, 'unavailable', 'Betalingen er ikke satt opp ennå (SHOPIFY_WEBHOOK_SECRET mangler, eller er for kort).');
  let sig = null;
  try {
    sig = b64ToBytes(header ?? '');
  } catch {
    /* not base64: no signature */
  }
  const key = await crypto.subtle.importKey('raw', te.encode(webhookSecret(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  if (!sig || sig.length !== 32 || !(await crypto.subtle.verify('HMAC', key, sig, bytes))) throw new HttpError(401, 'bad_signature', 'Ugyldig signatur.');
}

/** An order was paid: writes down the code, the package and the time (once: Shopify calls again if it does not hear back). */
async function orderPaid(env, order) {
  if (order.test === true && !testOrders(env)) return ignored('test_order');
  if (order.cancelled_at) return ignored('cancelled');
  if (order.financial_status !== 'paid') return ignored('not_paid', `financial_status ${String(order.financial_status).slice(0, 30)}`);
  const ids = variantIds(env);
  const plansByVariant = new Map(Object.entries(ids).map(([plan, id]) => [id, plan]));
  if (plansByVariant.size === 0) throw new HttpError(503, 'unavailable', 'Betalingen er ikke satt opp ennå (VARIANT_EVENING og VARIANT_YEAR mangler).');
  const lines = Array.isArray(order.line_items) ? order.line_items : [];
  const plan = lines
    .map((line) => plansByVariant.get(String(line?.variant_id)))
    .filter(Boolean)
    .sort((a, b) => PLANS[b].rank - PLANS[a].rank)[0];
  if (!plan) return ignored('no_package', `variants ${lines.map((line) => String(line?.variant_id)).join(', ').slice(0, 80) || 'none'}`); // (an order for something else in the same shop)
  const attributes = Array.isArray(order.note_attributes) ? order.note_attributes : [];
  const code = normalizeCode(attributes.find((a) => String(a?.name).toLowerCase() === 'kode')?.value);
  if (!code) {
    console.error('Order', order.name, 'was paid for a package but has no code, so nobody can claim it');
    return ignored('no_code', `attributes: ${attributes.map((a) => String(a?.name)).join(', ').slice(0, 80) || 'none'}`);
  }
  // The host agreed to getting the access at once (and so to the right of withdrawal ending) in the game, before the shop. Without
  // that, the order is not delivered: a person has to look at it.
  const consentedAt = toSeconds(attributes.find((a) => String(a?.name).toLowerCase() === 'samtykke')?.value);
  if (consentedAt === null) {
    console.error('Order', order.name, 'was paid for a package but without the consent to getting the access at once, so no access is given');
    return ignored('no_consent', `attributes: ${attributes.map((a) => String(a?.name)).join(', ').slice(0, 80) || 'none'}`);
  }
  const orderId = String(order.id);
  const paidAt = toSeconds(order.processed_at) ?? toSeconds(order.created_at) ?? Math.floor(Date.now() / 1000); // (Shopify's time, not the time the call arrives)
  const db = await database(env);
  await db.batch([
    db
      .prepare('INSERT INTO orders (order_id, code, plan, paid_at, consented_at, amount, currency, name, test) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (order_id) DO NOTHING')
      .bind(orderId, code, plan, paidAt, consentedAt, toOre(order.current_total_price ?? order.total_price), String(order.currency ?? ''), String(order.name ?? ''), order.test === true ? 1 : 0),
    applyRefunds(db, orderId), // (a refund or a cancel that came before the order, if Shopify's calls arrived in the wrong order)
    applyStops(db, orderId),
  ]);
  return { ok: true };
}

/** Writes down that an order is stopped, and stops it if it is there. */
async function stop(env, orderId, state) {
  const db = await database(env);
  await db.batch([db.prepare('INSERT INTO stops (order_id, state) VALUES (?, ?) ON CONFLICT (order_id) DO NOTHING').bind(orderId, state), applyStops(db, orderId)]);
  return { ok: true };
}

const orderCancelled = (env, order) => stop(env, String(order.id), 'cancelled');

/** A refund: all of it, and the order stops giving out passes. A part of it (a goodwill refund) does not take the access away. */
async function refundCreated(env, refund) {
  // (a refund through a payment app is "pending" until it clears: the customer is being paid back, so the code stops at once)
  const paid = (Array.isArray(refund.transactions) ? refund.transactions : []).filter((t) => t?.kind === 'refund' && ['success', 'pending'].includes(t?.status));
  const amount = paid.reduce((sum, t) => sum + toOre(t.amount), 0);
  if (!refund.id || !refund.order_id || amount <= 0) return ignored('nothing_refunded');
  const db = await database(env);
  const orderId = String(refund.order_id);
  await db.batch([
    db.prepare('INSERT INTO refunds (refund_id, order_id, amount, currency) VALUES (?, ?, ?, ?) ON CONFLICT (refund_id) DO NOTHING').bind(String(refund.id), orderId, amount, String(paid[0].currency ?? '')),
    applyRefunds(db, orderId),
  ]);
  return { ok: true };
}

async function disputeCreated(env, dispute) {
  if (!dispute.order_id) return ignored('no_order');
  return stop(env, String(dispute.order_id), 'disputed');
}

const TOPICS = { 'orders/paid': orderPaid, 'orders/cancelled': orderCancelled, 'refunds/create': refundCreated, 'disputes/create': disputeCreated };

/**
 * Writes down what became of a call from Shopify (see the table `hooks`). Never changes the answer: if the database cannot take it,
 * the call is answered as it would have been. `result` goes into /health, so it must say nothing about the order or the buyer.
 */
async function record(env, topic, result) {
  try {
    const db = await database(env);
    await db.batch([
      db.prepare('INSERT INTO hooks (at, topic, result) VALUES (?, ?, ?)').bind(Math.floor(Date.now() / 1000), String(topic).slice(0, 40), String(result).slice(0, 160)),
      db.prepare('DELETE FROM hooks WHERE id <= (SELECT MAX(id) FROM hooks) - ?').bind(HOOKS_KEPT),
    ]);
  } catch (err) {
    console.error('Could not write down the call from Shopify:', err);
  }
}

/** A call with a wrong signature can come from anybody, so it is written down at most once a minute (it must not cost a write each). */
async function recordBadSignature(env, topic) {
  try {
    const db = await database(env);
    const now = Math.floor(Date.now() / 1000);
    await db.batch([
      db.prepare("INSERT INTO hooks (at, topic, result) SELECT ?, ?, 'bad_signature' WHERE NOT EXISTS (SELECT 1 FROM hooks WHERE result = 'bad_signature' AND at > ?)").bind(now, String(topic).slice(0, 40), now - 60),
      db.prepare('DELETE FROM hooks WHERE id <= (SELECT MAX(id) FROM hooks) - ?').bind(HOOKS_KEPT),
    ]);
  } catch (err) {
    console.error('Could not write down the call with the wrong signature:', err);
  }
}

async function webhook(request, env) {
  if (Number(request.headers.get('Content-Length')) > MAX_WEBHOOK_BYTES) throw new HttpError(413, 'too_large', 'For stor forespørsel.');
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_WEBHOOK_BYTES) throw new HttpError(413, 'too_large', 'For stor forespørsel.');
  const topic = request.headers.get('X-Shopify-Topic') ?? '';
  try {
    await checkSignature(env, bytes, request.headers.get('X-Shopify-Hmac-Sha256'));
  } catch (err) {
    if (err instanceof HttpError && err.code === 'bad_signature') await recordBadSignature(env, topic);
    throw err;
  }
  const handler = Object.hasOwn(TOPICS, topic) ? TOPICS[topic] : null;
  if (!handler) {
    await record(env, topic, 'ignored: topic');
    return ignored('topic');
  }
  try {
    let data = null;
    try {
      data = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      /* reported below */
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw bad('Ugyldig innhold.');
    const { hint, ...answer } = await handler(env, data);
    await record(env, topic, answer.ignored ? `ignored: ${answer.ignored}${hint ? ` (${hint})` : ''}` : 'ok');
    return answer;
  } catch (err) {
    await record(env, topic, `error: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

// ------------------------------------------------------------------------------------------------ Vipps: the button «Betal med Vipps»

// How a payment goes (docs/VIPPS.md has the same in pictures):
//   1. the game calls /vipps/start: a row is written down (state "started"), a payment is made at Vipps, and the host is sent there
//   2. the host approves in the Vipps app. Vipps calls /vipps/webhook (and the game asks /restore, and the clock calls scheduled()):
//      all three do the same, settle(): ask Vipps what became of the payment, take the money (capture), make a paid order in Shopify
//      (the receipt goes to the e-mail address the host shared in the Vipps app), and write down the order in `orders`
//   3. from then on the order is like one Shopify made itself: the pass comes from it, and a refund or a cancel in Shopify stops it
// Nothing is delivered before Vipps has confirmed that the money was captured, and nothing is captured that is not the amount we asked for.

const VIPPS_NAMES = ['VIPPS_MSN', 'VIPPS_CLIENT_ID', 'VIPPS_CLIENT_SECRET', 'VIPPS_SUBSCRIPTION_KEY'];
const SHOPIFY_NAMES = ['SHOPIFY_STORE', 'SHOPIFY_CLIENT_ID', 'SHOPIFY_CLIENT_SECRET'];
const REFERENCE = /^disputt-[0-9a-hjkmnp-tv-z]{24}$/; // what a payment is called at Vipps: letters, digits and hyphens, and ours alone on the sales unit
const WEBHOOK_EVENTS = ['epayments.payment.authorized.v1', 'epayments.payment.aborted.v1', 'epayments.payment.expired.v1', 'epayments.payment.terminated.v1'];
const FAILED_STATES = ['ABORTED', 'EXPIRED', 'TERMINATED']; // (Vipps' own words for a payment that was not made)
const VAT_RATE = 0.25;
const CALL_MS = 8000; // (Vipps calls the webhook again if it takes more than ten seconds)
const MAX_STARTS_PER_HOUR = 200;
const OPEN_DAYS = 7; // the clock looks after payments that are not finished for this long
const GIVE_UP_SECONDS = 24 * 3600; // a payment the host never finished
const LOCK_SECONDS = 90;
const ORDER_WAIT_SECONDS = 120; // after a call to make an order that got no answer: wait before trying again (Shopify may have made it)
const PRICE_KEPT_MS = 10 * 60_000;

const clean = (value) => String(value ?? '').trim();
const isSet = (env, name) => clean(env[name]) !== '';
const APP_SCHEMES = /^(vipps|vippsmt|vippsmobilepay|mobilepay|mobilepaymt):$/; // (what Vipps gives to open its app: vipps:// for the app, vippsMT:// for the test app)
const vippsTest = (env) => clean(env.VIPPS_ENV).toLowerCase() === 'test';

/** Why the button cannot be used, in words, or null when it can. (`enabled: false`: for the calls that finish payments already started.) */
function vippsProblem(env, { enabled = true } = {}) {
  if (enabled && clean(env.VIPPS_ENABLED).toLowerCase() !== 'true') return 'Vipps er ikke slått på (VIPPS_ENABLED).';
  const missing = [...VIPPS_NAMES, ...SHOPIFY_NAMES].filter((name) => !isSet(env, name));
  if (missing.length > 0) return `Vipps er ikke satt opp ennå (${missing.join(', ')} mangler).`;
  if (vippsTest(env) && !testOrders(env)) return 'Vipps står i testmodus, så ACCEPT_TEST_ORDERS må være true (en testbetaling gir ellers ingen tilgang).';
  return null;
}
const needVipps = (env, options) => {
  const problem = vippsProblem(env, options);
  if (problem) throw new HttpError(503, 'unavailable', problem);
};

const isLocalUrl = (u) => u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
/** An address that was typed into a setting: https (plain http only for a pretend server on this machine, in the tests), no slash at the end. */
function baseUrl(text, fallback, name) {
  const raw = clean(text);
  if (!raw) return fallback;
  let u = null;
  try {
    u = new URL(raw);
  } catch {
    /* reported below */
  }
  if (!u || (u.protocol !== 'https:' && !isLocalUrl(u))) throw new HttpError(503, 'unavailable', `${name} er ikke en https-adresse.`);
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}
const vippsBase = (env) => baseUrl(env.VIPPS_API_URL, vippsTest(env) ? 'https://apitest.vipps.no' : 'https://api.vipps.no', 'VIPPS_API_URL');
function shopifyBase(env) {
  if (clean(env.SHOPIFY_ADMIN_URL)) return baseUrl(env.SHOPIFY_ADMIN_URL, '', 'SHOPIFY_ADMIN_URL');
  const store = clean(env.SHOPIFY_STORE).toLowerCase().replace(/\.myshopify\.com$/, '');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(store)) throw new HttpError(503, 'unavailable', 'SHOPIFY_STORE er ikke riktig (bare navnet foran .myshopify.com).');
  return `https://${store}.myshopify.com`;
}
const apiVersion = (env) => (/^\d{4}-\d{2}$/.test(clean(env.SHOPIFY_API_VERSION)) ? clean(env.SHOPIFY_API_VERSION) : '2026-07');

/** A call to Vipps or Shopify that gives up after a few seconds. */
async function call(url, init) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(CALL_MS) });
  } catch (err) {
    throw new HttpError(502, 'upstream', 'Fikk ikke kontakt med Vipps eller butikken. Prøv igjen om litt.', String(err?.message ?? err));
  }
}
const answerOf = (res) => res.json().catch(() => ({}));
const short = (value) => String(typeof value === 'string' ? value : JSON.stringify(value)).slice(0, 300);

const kroner = (ore) => (ore / 100).toFixed(2);
const newReference = () => `disputt-${[...crypto.getRandomValues(new Uint8Array(24))].map((b) => '0123456789abcdefghjkmnpqrstvwxyz'[b & 31]).join('')}`;

/** Two texts compared without telling, by how long it takes, how much of the start they share. */
async function sameText(a, b) {
  const [x, y] = await Promise.all([a, b].map(async (text) => new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(String(text))))));
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// ---- Vipps' API

const vippsTokens = new Map(); // (kept while this copy of the Worker lives; a token lasts an hour)
const SYSTEM_HEADERS = { 'Vipps-System-Name': 'disputt', 'Vipps-System-Version': '1', 'Vipps-System-Plugin-Name': 'disputt-pay', 'Vipps-System-Plugin-Version': '1' };

async function vippsToken(env, fresh = false) {
  const base = vippsBase(env);
  const key = `${base}|${clean(env.VIPPS_MSN)}|${clean(env.VIPPS_CLIENT_ID)}`;
  const kept = vippsTokens.get(key);
  if (!fresh && kept && kept.expires > Date.now() + 60_000) return kept.token;
  const res = await call(`${base}/accesstoken/get`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      client_id: clean(env.VIPPS_CLIENT_ID),
      client_secret: clean(env.VIPPS_CLIENT_SECRET),
      'Ocp-Apim-Subscription-Key': clean(env.VIPPS_SUBSCRIPTION_KEY),
      'Merchant-Serial-Number': clean(env.VIPPS_MSN),
      ...SYSTEM_HEADERS,
    },
    body: '',
  });
  const data = await answerOf(res);
  if (!res.ok || !data.access_token) throw new HttpError(502, 'vipps_auth', 'Vipps ville ikke slippe oss inn. Sjekk nøklene.', `${res.status} ${short(data)}`);
  vippsTokens.set(key, { token: data.access_token, expires: Date.now() + (Number(data.expires_in) || 3000) * 1000 });
  return data.access_token;
}

/** One call to Vipps. `idempotency` makes a call that is made twice count once. */
async function vipps(env, method, path, { body, idempotency } = {}) {
  const run = async (fresh) =>
    call(`${vippsBase(env)}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await vippsToken(env, fresh)}`,
        'Ocp-Apim-Subscription-Key': clean(env.VIPPS_SUBSCRIPTION_KEY),
        'Merchant-Serial-Number': clean(env.VIPPS_MSN),
        ...(idempotency ? { 'Idempotency-Key': idempotency } : {}),
        ...SYSTEM_HEADERS,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  let res = await run(false);
  if (res.status === 401) res = await run(true); // (the token was withdrawn: one new one, once)
  const data = await answerOf(res);
  if (!res.ok) throw new HttpError(502, 'vipps', 'Vipps svarte ikke som det skulle.', `${method} ${path.split('?')[0]} ${res.status} ${short(data)}`);
  return data;
}
const vippsPayment = (reference) => `/epayment/v1/payments/${encodeURIComponent(reference)}`;
const capturedOf = (payment) => Number(payment?.aggregate?.capturedAmount?.value ?? 0);

// ---- Shopify's Admin API (an app in the Dev Dashboard, with the client credentials grant: a token that lasts 24 hours)

const shopifyTokens = new Map();

async function shopifyToken(env, fresh = false) {
  const base = shopifyBase(env);
  const key = `${base}|${clean(env.SHOPIFY_CLIENT_ID)}`;
  const kept = shopifyTokens.get(key);
  if (!fresh && kept && kept.expires > Date.now() + 120_000) return kept.token;
  const res = await call(`${base}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clean(env.SHOPIFY_CLIENT_ID), client_secret: clean(env.SHOPIFY_CLIENT_SECRET) }),
  });
  const data = await answerOf(res);
  if (!res.ok || !data.access_token) throw new HttpError(502, 'shopify_auth', 'Butikken ville ikke slippe oss inn. Sjekk appen i Shopify.', `${res.status} ${short(data)}`);
  shopifyTokens.set(key, { token: data.access_token, expires: Date.now() + (Number(data.expires_in) || 3600) * 1000 });
  return data.access_token;
}

async function shopifyGraphql(env, query, variables) {
  const run = async (fresh) =>
    call(`${shopifyBase(env)}/admin/api/${apiVersion(env)}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await shopifyToken(env, fresh) },
      body: JSON.stringify({ query, variables }),
    });
  let res = await run(false);
  if (res.status === 401) res = await run(true);
  const data = await answerOf(res);
  if (!res.ok || data.errors) throw new HttpError(502, 'shopify', 'Butikken svarte ikke som den skulle.', `${res.status} ${short(data.errors ?? data)}`);
  return data.data;
}

const priceKept = new Map();
/** What a package costs in the shop, and what it is called there: the price is Shopify's, so it is changed in one place only. */
async function variantInfo(env, plan) {
  const id = variantIds(env)[plan];
  if (!id) throw new HttpError(503, 'unavailable', `Betalingen er ikke satt opp ennå (${VARIANT_VARS[plan]} mangler).`);
  const key = `${shopifyBase(env)}|${id}`;
  const kept = priceKept.get(key);
  if (kept && kept.expires > Date.now()) return kept.info;
  const data = await shopifyGraphql(env, 'query($id: ID!) { shop { currencyCode } productVariant(id: $id) { title price product { id title } } }', { id: `gid://shopify/ProductVariant/${id}` });
  const variant = data?.productVariant;
  if (!variant) throw new HttpError(503, 'unavailable', `Fant ikke «${PLANS[plan].name}» i butikken (sjekk ${VARIANT_VARS[plan]}).`);
  if (data.shop?.currencyCode !== 'NOK') throw new HttpError(503, 'unavailable', 'Butikken må selge i norske kroner (NOK) for å ta imot Vipps.');
  const amount = toOre(variant.price);
  if (amount <= 0) throw new HttpError(503, 'unavailable', `«${PLANS[plan].name}» har ingen pris i butikken.`);
  const info = { amount, title: clean(variant.product?.title) || PLANS[plan].name, variantTitle: clean(variant.title), variantId: `gid://shopify/ProductVariant/${id}`, productId: clean(variant.product?.id) };
  priceKept.set(key, { info, expires: Date.now() + PRICE_KEPT_MS });
  return info;
}

const ORDER_FIND = 'query($q: String!) { orders(first: 1, query: $q) { nodes { id name processedAt } } }';
const ORDER_CREATE = `mutation($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
  orderCreate(order: $order, options: $options) { userErrors { field message } order { id name processedAt } }
}`;

/**
 * The paid order in Shopify for a payment that Vipps has taken: the package, the price with the VAT in it (25 %), the code and the consent
 * as attributes (the e-mail and the pass read them), and "Vipps" as the way it was paid. Shopify sends the receipt to the e-mail address
 * the host shared in the Vipps app. The reference is a tag on the order, so that an order that was made but never written down is found
 * again instead of made twice.
 */
async function shopifyOrderFor(env, row, payer, info) {
  const found = (await shopifyGraphql(env, ORDER_FIND, { q: `tag:${row.reference}` }))?.orders?.nodes?.[0];
  if (found) return found;
  const money = { shopMoney: { amount: kroner(row.amount), currencyCode: 'NOK' } };
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(payer.email)) ? clean(payer.email) : null;
  const test = row.test === 1;
  const data = await shopifyGraphql(env, ORDER_CREATE, {
    order: {
      currency: 'NOK',
      ...(email ? { email } : {}),
      financialStatus: 'PAID',
      taxesIncluded: true,
      test,
      tags: ['vipps', row.reference, ...(row.discount_code ? ['rabatt'] : [])],
      sourceName: 'Vipps',
      note: `Betalt med Vipps. Referanse hos Vipps: ${row.reference}${row.discount_code ? `. Rabattkode: ${row.discount_code} (ordinær pris ${kroner(row.list_amount)} kr)` : ''}`,
      customAttributes: [
        { key: 'kode', value: row.code },
        { key: 'samtykke', value: new Date(row.consented_at * 1000).toISOString() },
        { key: 'betaling', value: 'Vipps' },
        { key: 'vipps_referanse', value: row.reference },
        ...(row.discount_code ? [{ key: 'rabattkode', value: row.discount_code }, { key: 'ordinaer_pris', value: kroner(row.list_amount) }] : []),
      ],
      lineItems: [
        {
          variantId: `gid://shopify/ProductVariant/${variantIds(env)[row.plan]}`,
          quantity: 1,
          title: info.title,
          ...(info.variantTitle && info.variantTitle !== 'Default Title' ? { variantTitle: info.variantTitle } : {}),
          priceSet: money,
          taxable: true,
          requiresShipping: false,
          taxLines: [{ title: 'MVA', rate: VAT_RATE, priceSet: { shopMoney: { amount: kroner(Math.round((row.amount * VAT_RATE) / (1 + VAT_RATE))), currencyCode: 'NOK' } } }],
        },
      ],
      transactions: [{ kind: 'SALE', status: 'SUCCESS', gateway: 'Vipps', amountSet: money, processedAt: new Date().toISOString(), test }],
    },
    options: { sendReceipt: email !== null, inventoryBehaviour: 'BYPASS' },
  });
  const made = data?.orderCreate;
  if (made?.userErrors?.length > 0 || !made?.order?.id) throw new HttpError(502, 'shopify', 'Butikken tok ikke imot ordren.', short(made?.userErrors ?? data));
  return made.order;
}

// ---- finishing a payment

/**
 * Looks after one payment as far as it can go, and is safe to call as often as anybody likes (the webhook, the page asking and the clock all
 * do, at the same time and again and again): what Vipps says is what is done, each step is done once, and one call at a time works on a payment.
 * Returns the row as it is afterwards. A call that fails halfway leaves the row where it got to, and the next call goes on from there.
 */
async function settle(env, reference) {
  needVipps(env, { enabled: false });
  const db = await database(env);
  const row = await db.prepare('SELECT * FROM vipps WHERE reference = ?').bind(reference).first();
  if (!row || row.state === 'done' || row.state === 'failed') return row;
  const now = Math.floor(Date.now() / 1000);
  const claimed = await db.prepare('UPDATE vipps SET locked_until = ? WHERE reference = ? AND locked_until < ?').bind(now + LOCK_SECONDS, reference, now).run();
  if (claimed.meta?.changes !== 1) return row; // somebody else is finishing it just now
  try {
    return await finish(env, db, row, now);
  } catch (err) {
    await db
      .prepare('UPDATE vipps SET note = ?, updated_at = ? WHERE reference = ?')
      .bind(String(err instanceof Error ? err.message : err).slice(0, 160), now, reference)
      .run()
      .catch(() => {});
    throw err;
  } finally {
    await db.prepare('UPDATE vipps SET locked_until = 0 WHERE reference = ?').bind(reference).run().catch(() => {});
  }
}

async function finish(env, db, row, now) {
  const reference = row.reference;
  const payment = await vipps(env, 'GET', vippsPayment(reference));
  let captured = capturedOf(payment);
  if (captured === 0 && FAILED_STATES.includes(payment.state)) {
    await db.prepare("UPDATE vipps SET state = 'failed', note = ?, updated_at = ? WHERE reference = ?").bind(`Vipps: ${payment.state}`, now, reference).run();
    return { ...row, state: 'failed' };
  }
  if (captured === 0 && payment.state !== 'AUTHORIZED') {
    // still waiting for the host (the payment is "CREATED"); one that was never finished is given up after a day
    if (now - row.created_at > GIVE_UP_SECONDS) {
      await db.prepare("UPDATE vipps SET state = 'failed', note = 'ikke fullført', updated_at = ? WHERE reference = ?").bind(now, reference).run();
      return { ...row, state: 'failed' };
    }
    return row;
  }
  // The amount must be what we asked for. If it is not, nothing is taken, and the reserved amount is let go.
  if (Number(payment.amount?.value) !== row.amount || payment.amount?.currency !== 'NOK') {
    if (captured === 0) await vipps(env, 'POST', `${vippsPayment(reference)}/cancel`, { idempotency: `${reference}-cancel` }).catch(() => {});
    await db.prepare("UPDATE vipps SET state = 'failed', note = 'beløpet stemte ikke', updated_at = ? WHERE reference = ?").bind(now, reference).run();
    console.error('Vipps payment', reference, 'was for another amount than asked for:', short(payment.amount));
    return { ...row, state: 'failed' };
  }
  // the money: taken once (Vipps keeps the idempotency key), and checked in what Vipps answers, not in the status code
  if (captured < row.amount) {
    const taken = await vipps(env, 'POST', `${vippsPayment(reference)}/capture`, {
      body: { modificationAmount: { currency: 'NOK', value: row.amount } },
      idempotency: `${reference}-capture`,
    });
    captured = capturedOf(taken);
    if (captured < row.amount) throw new HttpError(502, 'vipps', 'Vipps trakk ikke pengene.', short(taken));
  }
  await db.prepare("UPDATE vipps SET state = 'captured', updated_at = ? WHERE reference = ? AND state = 'started'").bind(now, reference).run();
  // the order: not made again within a couple of minutes after a call that got no answer (it may have been made all the same)
  if (row.order_started_at > 0 && now - row.order_started_at < ORDER_WAIT_SECONDS) return { ...row, state: 'captured' };
  await db.prepare('UPDATE vipps SET order_started_at = ? WHERE reference = ?').bind(now, reference).run();
  let order;
  try {
    order = await shopifyOrderFor(env, row, payment.userDetails ?? {}, await variantInfo(env, row.plan));
  } catch (err) {
    if (!(err instanceof HttpError && err.code === 'upstream')) await db.prepare('UPDATE vipps SET order_started_at = 0 WHERE reference = ?').bind(reference).run().catch(() => {});
    throw err;
  }
  const orderId = String(order.id).match(/(\d+)$/)?.[1];
  if (!orderId) throw new HttpError(502, 'shopify', 'Butikken svarte uten et ordrenummer.', short(order));
  const paidAt = toSeconds(order.processedAt) ?? now;
  await db.batch([
    db
      .prepare('INSERT INTO orders (order_id, code, plan, paid_at, consented_at, amount, currency, name, test) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (order_id) DO NOTHING')
      .bind(orderId, row.code, row.plan, paidAt, row.consented_at, row.amount, 'NOK', String(order.name ?? ''), row.test),
    db.prepare("UPDATE vipps SET state = 'done', order_id = ?, note = '', updated_at = ? WHERE reference = ?").bind(orderId, now, reference),
    applyRefunds(db, orderId), // (a refund or a cancel that came before, if Shopify's calls arrived in the wrong order: the same care as in orderPaid)
    applyStops(db, orderId),
  ]);
  return { ...row, state: 'done', order_id: orderId };
}

/** The payments of a code that are not finished: the page asks about the code while the host pays, and that is a good time to look. */
async function settleCode(env, code) {
  if (vippsProblem(env, { enabled: false })) return;
  try {
    const db = await database(env);
    const { results } = await db.prepare("SELECT reference FROM vipps WHERE code = ? AND state NOT IN ('done', 'failed') ORDER BY created_at DESC LIMIT 3").bind(code).all();
    for (const { reference } of results ?? []) await settle(env, reference);
  } catch (err) {
    console.error('Vipps: could not look at the payment for a code:', err instanceof Error ? err.message : err); // (a code paid in Shopify is restored all the same)
  }
}

/**
 * The clock (a Cron Trigger, every five minutes): finishes what Vipps has authorized but nobody has heard of, for example a host who left.
 * A few at a time (a Worker may only make so many calls in one go), and those where the money is already taken come first.
 */
async function reconcile(env) {
  if (vippsProblem(env, { enabled: false })) return 0;
  const db = await database(env);
  const now = Math.floor(Date.now() / 1000);
  const { results } = await db
    .prepare("SELECT reference FROM vipps WHERE state NOT IN ('done', 'failed') AND created_at > ? ORDER BY CASE state WHEN 'captured' THEN 0 ELSE 1 END, created_at LIMIT 10")
    .bind(now - OPEN_DAYS * 86400)
    .all();
  let looked = 0;
  for (const { reference } of results ?? []) {
    try {
      await settle(env, reference);
      looked++;
    } catch (err) {
      console.error('Vipps: could not finish', reference, err instanceof Error ? err.message : err);
    }
  }
  return looked;
}

// ---- discount codes: the codes the owner makes in Shopify (for the checkout), which the packages' prices and the button «Betal med Vipps» understand too

// What Shopify says about a code. Only the plain kinds are understood here (an amount or a percentage off, for everybody, on everything or on
// some products): anything else is turned away, because the price must not be a guess. (The checkout in the shop knows all kinds, and is where
// those go.) The parts of Shopify's schema that are used: DiscountCodeBasic, DiscountCustomerGets, DiscountPercentage, DiscountAmount, AllDiscountItems, DiscountProducts.
const DISCOUNT_QUERY = `query($code: String!) {
  codeDiscountNodeByCode(code: $code) {
    codeDiscount {
      __typename
      ... on DiscountCodeBasic {
        title status startsAt endsAt usageLimit asyncUsageCount appliesOncePerCustomer
        context { __typename }
        minimumRequirement {
          __typename
          ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount } }
          ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
        }
        customerGets {
          value {
            __typename
            ... on DiscountPercentage { percentage }
            ... on DiscountAmount { amount { amount } appliesOnEachItem }
          }
          items {
            __typename
            ... on DiscountProducts { products(first: 50) { nodes { id } } productVariants(first: 50) { nodes { id } } }
          }
        }
      }
    }
  }
}`;
const MAX_DISCOUNT_CHECKS_PER_HOUR = 600;
const shopifySet = (env) => SHOPIFY_NAMES.every((name) => isSet(env, name));

/** What a package costs with the discount, in øre, and whether the button «Betal med Vipps» can take that price. */
function priceWith(discount, info) {
  const price = info.amount;
  const gets = discount.customerGets ?? {};
  const kind = gets.items?.__typename;
  let applies = false;
  if (kind === 'AllDiscountItems') applies = true;
  else if (kind === 'DiscountProducts') applies = (gets.items.productVariants?.nodes ?? []).some((n) => n.id === info.variantId) || (gets.items.products?.nodes ?? []).some((n) => n.id === info.productId);
  else throw new HttpError(400, 'discount_unsupported', 'Den typen rabattkode kan ikke brukes her. Skriv den inn i butikkens kasse (Gå til betaling).');
  const min = discount.minimumRequirement;
  if (min?.__typename === 'DiscountMinimumSubtotal' && toOre(min.greaterThanOrEqualToSubtotal?.amount) > price) applies = false;
  if (min?.__typename === 'DiscountMinimumQuantity' && Number(min.greaterThanOrEqualToQuantity) > 1) applies = false;
  let off = 0;
  if (applies) {
    const value = gets.value ?? {};
    if (value.__typename === 'DiscountPercentage') off = Math.round(price * Number(value.percentage));
    else if (value.__typename === 'DiscountAmount') off = Math.min(price, toOre(value.amount?.amount));
    else throw new HttpError(400, 'discount_unsupported', 'Den typen rabattkode kan ikke brukes her. Skriv den inn i butikkens kasse (Gå til betaling).');
  }
  const now = Math.max(0, price - Math.max(0, off));
  // Vipps cannot take a price of nothing or under a krone, and a code that is meant for each customer once or for chosen customers cannot be kept to here
  const vipps = now >= 100 && !discount.appliesOncePerCustomer && discount.context?.__typename === 'DiscountBuyerSelectionAll';
  return { price, now, vipps };
}

/** Is it a good code, and what do the three packages cost with it? Throws (400, with words for the host) when it is not. */
async function checkDiscount(env, rawCode) {
  const text = clean(rawCode);
  if (text === '' || text.length > 64 || /[\u0000-\u001f]/.test(text)) throw bad('Skriv inn en rabattkode.');
  if (!shopifySet(env)) throw new HttpError(503, 'unavailable', 'Rabattkoder er ikke satt opp ennå.');
  const db = await database(env);
  const now = Math.floor(Date.now() / 1000);
  await db.prepare('DELETE FROM discount_checks WHERE at < ?').bind(now - 3600).run();
  const { n } = (await db.prepare('SELECT COUNT(*) AS n FROM discount_checks').first()) ?? { n: 0 };
  if (n >= MAX_DISCOUNT_CHECKS_PER_HOUR) throw new HttpError(429, 'busy', 'Mange sjekker rabattkoder akkurat nå. Prøv igjen om litt.');
  await db.prepare('INSERT INTO discount_checks (at) VALUES (?)').bind(now).run();
  const data = await shopifyGraphql(env, DISCOUNT_QUERY, { code: text });
  const discount = data?.codeDiscountNodeByCode?.codeDiscount;
  if (!discount) throw new HttpError(400, 'discount_unknown', 'Fant ikke den rabattkoden.');
  if (discount.__typename !== 'DiscountCodeBasic') throw new HttpError(400, 'discount_unsupported', 'Den typen rabattkode kan ikke brukes her. Skriv den inn i butikkens kasse (Gå til betaling).');
  if (discount.status !== 'ACTIVE') throw new HttpError(400, 'discount_inactive', 'Rabattkoden er ikke gyldig akkurat nå.');
  const code = text.toUpperCase();
  const plans = {};
  for (const plan of forSale(env)) plans[plan] = priceWith(discount, await variantInfo(env, plan));
  if (Object.values(plans).every((p) => p.now === p.price)) throw new HttpError(400, 'discount_none', 'Rabattkoden gjelder ikke disse pakkene.');
  if (discount.usageLimit !== null && discount.usageLimit !== undefined) {
    // (what the shop has counted, and what has been paid with Vipps with it: those are not counted in the shop)
    const { used } = (await db.prepare("SELECT COUNT(*) AS used FROM vipps WHERE discount_code = ? AND (state IN ('captured', 'done') OR (state = 'started' AND created_at > ?))").bind(code, now - 2 * 3600).first()) ?? { used: 0 };
    if (Number(discount.asyncUsageCount ?? 0) + used >= discount.usageLimit) throw new HttpError(400, 'discount_used', 'Rabattkoden er brukt opp.');
  }
  const value = discount.customerGets?.value ?? {};
  const summary = value.__typename === 'DiscountPercentage' ? `${Math.round(Number(value.percentage) * 1000) / 10} % rabatt` : `${Math.round(toOre(value.amount?.amount) / 100)} kr rabatt`;
  return { ok: true, code, summary: summary.replace('.', ','), plans };
}

async function discountEndpoint(request, env) {
  const body = await readJson(request);
  return checkDiscount(env, body.code);
}

// ---- the calls from the game and from Vipps

async function vippsStart(request, env) {
  const body = await readJson(request);
  const plan = typeof body.plan === 'string' && forSale(env).includes(body.plan) ? body.plan : null;
  if (!plan) throw bad('Ukjent pakke.');
  const code = normalizeCode(body.code);
  if (!code) throw bad('Koden ser ikke riktig ut.');
  const now = Math.floor(Date.now() / 1000);
  const consentedAt = toSeconds(body.samtykke);
  if (consentedAt === null || consentedAt > now + 300 || consentedAt < now - 6 * 3600) throw bad('Samtykket mangler eller er for gammelt. Kryss av på nytt og prøv igjen.');
  needVipps(env);
  const db = await database(env);
  const { n } = (await db.prepare('SELECT COUNT(*) AS n FROM vipps WHERE created_at > ?').bind(now - 3600).first()) ?? { n: 0 };
  if (n >= MAX_STARTS_PER_HOUR) throw new HttpError(429, 'busy', 'Mange betaler akkurat nå. Prøv igjen om litt.');
  const info = await variantInfo(env, plan);
  // a discount code: checked again here (the price is the shop's, not what the page says), and the price at Vipps is the price with it
  let amount = info.amount;
  let discountCode = '';
  if (clean(body.rabatt) !== '') {
    const found = await checkDiscount(env, body.rabatt);
    if (!found.plans[plan].vipps) throw new HttpError(400, 'discount_vipps', 'Den rabattkoden kan bare brukes i butikkens kasse (Gå til betaling).');
    amount = found.plans[plan].now;
    discountCode = found.code;
  }
  const reference = newReference();
  const app = clean(body.flow) === 'app'; // (a phone that opens the Vipps app straight from the game tab, so that the only new tab is the one Vipps opens when it sends the host back)
  // written down BEFORE the payment is made: a payment that Vipps knows and we do not could be paid with nobody to deliver it to
  await db
    .prepare('INSERT INTO vipps (reference, code, plan, amount, consented_at, created_at, updated_at, test, discount_code, list_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(reference, code, plan, amount, consentedAt, now, now, vippsTest(env) ? 1 : 0, discountCode, info.amount)
    .run();
  let made;
  try {
    made = await vipps(env, 'POST', '/epayment/v1/payments', {
      idempotency: reference,
      body: {
        amount: { currency: 'NOK', value: amount },
        paymentMethod: { type: 'WALLET' },
        reference,
        returnUrl: new URL(`takk.html?ref=${reference}`, siteUrl(env)).href,
        userFlow: app ? 'NATIVE_REDIRECT' : 'WEB_REDIRECT',
        paymentDescription: `Disputt: ${PLANS[plan].name}`,
        profile: { scope: 'email' }, // (the receipt goes to this address, and nothing else is asked for: the host agrees to sharing it in the Vipps app, on a screen with one line)
      },
    });
    const to = new URL(String(made.redirectUrl ?? ''));
    if (to.protocol !== 'https:' && !isLocalUrl(to) && !(app && APP_SCHEMES.test(to.protocol))) throw new Error('redirectUrl');
  } catch (err) {
    await db.prepare("UPDATE vipps SET state = 'failed', note = ?, updated_at = ? WHERE reference = ?").bind(String(err instanceof Error ? err.message : err).slice(0, 160), now, reference).run().catch(() => {});
    throw err instanceof HttpError ? err : new HttpError(502, 'vipps', 'Vipps ga ikke en adresse å betale på.');
  }
  return { url: made.redirectUrl, reference, flow: app ? 'app' : 'web' };
}

/** What the page the host comes back to from Vipps (takk.html) asks: is it done? Looks at the payment on the way. */
async function vippsStatus(request, env) {
  const body = await readJson(request);
  const reference = clean(body.reference);
  if (!REFERENCE.test(reference)) throw bad('Ugyldig referanse.');
  const db = await database(env);
  let row = await db.prepare('SELECT state FROM vipps WHERE reference = ?').bind(reference).first();
  if (!row) throw new HttpError(404, 'not_found', 'Fant ingen betaling med den referansen.');
  if (row.state !== 'done' && row.state !== 'failed') {
    try {
      row = (await settle(env, reference)) ?? row;
    } catch (err) {
      console.error('Vipps: could not look at the payment:', err instanceof Error ? err.message : err);
    }
  }
  return { state: row.state === 'done' ? 'done' : row.state === 'failed' ? 'failed' : 'started' };
}

/** The signing secret of the webhook that was registered at Vipps: kept in the database when it is registered (or set by hand). */
async function vippsWebhookSecret(env) {
  if (clean(env.VIPPS_WEBHOOK_SECRET)) return clean(env.VIPPS_WEBHOOK_SECRET);
  try {
    const db = await database(env);
    return clean((await db.prepare("SELECT value FROM settings WHERE key = 'vipps_webhook_secret'").first())?.value);
  } catch {
    return '';
  }
}

/** Vipps signs each call: the date, the hash of the body and the address go into a text that is signed with the secret (as the docs have it). */
async function checkVippsSignature(env, request, bytes) {
  const secret = await vippsWebhookSecret(env);
  if (secret.length < MIN_SECRET) throw new HttpError(503, 'unavailable', 'Vipps-webhooken er ikke registrert ennå (se docs/VIPPS.md).');
  const hash = request.headers.get('x-ms-content-sha256') ?? '';
  const date = request.headers.get('x-ms-date') ?? '';
  const host = request.headers.get('host') ?? new URL(request.url).host;
  const url = new URL(request.url);
  const expectedHash = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))));
  const key = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, te.encode(`POST\n${url.pathname}${url.search}\n${date};${host};${hash}`)))));
  const expected = `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`;
  const sameHash = await sameText(hash, expectedHash);
  const sameSignature = await sameText(request.headers.get('authorization') ?? '', expected);
  if (!sameHash || !sameSignature) throw new HttpError(401, 'bad_signature', 'Ugyldig signatur.');
}

async function vippsWebhook(request, env) {
  if (Number(request.headers.get('Content-Length')) > MAX_WEBHOOK_BYTES) throw new HttpError(413, 'too_large', 'For stor forespørsel.');
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_WEBHOOK_BYTES) throw new HttpError(413, 'too_large', 'For stor forespørsel.');
  try {
    await checkVippsSignature(env, request, bytes);
  } catch (err) {
    if (err instanceof HttpError && err.code === 'bad_signature') await recordBadSignature(env, 'vipps');
    throw err;
  }
  let data = null;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    /* reported below */
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw bad('Ugyldig innhold.');
  const topic = `vipps:${clean(data.name).slice(0, 20)}`;
  const reference = clean(data.reference);
  // (the sales unit may be used by something else too, for instance Vipps' own plugin in Shopify: what is not ours is none of our business)
  if (!REFERENCE.test(reference)) {
    await record(env, topic, 'ignored: reference');
    return ignored('reference');
  }
  const db = await database(env);
  if (!(await db.prepare('SELECT 1 AS ok FROM vipps WHERE reference = ?').bind(reference).first())) {
    await record(env, topic, 'ignored: unknown');
    return ignored('unknown');
  }
  let after;
  try {
    after = await settle(env, reference);
  } catch (err) {
    await record(env, topic, `error: ${err instanceof Error ? err.message : String(err)}`);
    throw err; // (a 5xx makes Vipps call again: after two seconds, then a minute, then hourly)
  }
  // not finished (somebody else is working on it, or the order has to wait): Vipps is asked to call again, which is what a 5xx does
  if (after && after.state !== 'done' && after.state !== 'failed') {
    await record(env, topic, `waiting: ${after.state}`);
    throw new HttpError(503, 'pending', 'Ikke ferdig ennå.');
  }
  await record(env, topic, 'ok');
  return { ok: true };
}

async function checkAdmin(request, env) {
  const want = clean(env.ADMIN_TOKEN);
  if (want.length < MIN_SECRET) throw new HttpError(503, 'unavailable', 'ADMIN_TOKEN mangler, eller er for kort (16 tegn minst).');
  const got = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!(await sameText(got, want))) throw new HttpError(401, 'unauthorized', 'Feil ADMIN_TOKEN.');
}

/** Registers this Worker's address at Vipps as the place to say what became of the payments, and keeps the secret that comes with it. */
async function vippsAdminWebhook(request, env) {
  await checkAdmin(request, env);
  needVipps(env, { enabled: false });
  const url = `${new URL(request.url).origin}/vipps/webhook`;
  const listed = await vipps(env, 'GET', '/webhooks/v1/webhooks');
  for (const hook of listed.webhooks ?? []) if (hook.url === url) await vipps(env, 'DELETE', `/webhooks/v1/webhooks/${encodeURIComponent(hook.id)}`); // (an old one for this address: its secret is lost)
  const made = await vipps(env, 'POST', '/webhooks/v1/webhooks', { body: { url, events: WEBHOOK_EVENTS } });
  if (!made.id || !made.secret) throw new HttpError(502, 'vipps', 'Vipps ga ikke en nøkkel for webhooken.', short(made));
  const db = await database(env);
  await db.prepare("INSERT INTO settings (key, value) VALUES ('vipps_webhook_secret', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").bind(made.secret).run();
  return { ok: true, url, events: WEBHOOK_EVENTS, id: made.id };
}

/** Tries each connection in turn and says which work: Vipps, the webhook, Shopify, and the prices of the three packages (never the keys). */
async function vippsAdminCheck(request, env) {
  await checkAdmin(request, env);
  const out = { ok: false, env: vippsTest(env) ? 'test' : 'live', enabled: clean(env.VIPPS_ENABLED).toLowerCase() === 'true', problem: vippsProblem(env, { enabled: false }), vipps: false, webhook: false, shopify: false, prices: null };
  if (out.problem) return out;
  const trouble = (err) => (err instanceof HttpError ? `${err.message} ${err.detail ?? ''}`.trim() : String(err));
  try {
    await vippsToken(env, true);
    out.vipps = true;
  } catch (err) {
    out.vippsError = trouble(err);
  }
  if (out.vipps) {
    try {
      const url = `${new URL(request.url).origin}/vipps/webhook`;
      const listed = await vipps(env, 'GET', '/webhooks/v1/webhooks');
      out.webhook = (listed.webhooks ?? []).some((hook) => hook.url === url) && (await vippsWebhookSecret(env)).length >= MIN_SECRET;
    } catch (err) {
      out.webhookError = trouble(err);
    }
  }
  try {
    await shopifyToken(env, true);
    out.shopify = true;
    out.prices = {};
    for (const plan of forSale(env)) out.prices[plan] = (await variantInfo(env, plan)).amount / 100;
  } catch (err) {
    out.shopifyError = trouble(err);
    out.prices = null;
  }
  // (rabattkoder are not needed for the rest to work: the access read_discounts is only for the discount field in the game)
  out.discounts = false;
  if (out.shopify) {
    try {
      await shopifyGraphql(env, DISCOUNT_QUERY, { code: 'DISPUTT-SJEKK-FINNES-IKKE' });
      out.discounts = true;
    } catch (err) {
      out.discountsError = trouble(err);
    }
  }
  out.ok = out.vipps && out.webhook && out.shopify && out.prices !== null;
  return out;
}

// ------------------------------------------------------------------------------------------------ the endpoints

async function readJson(request) {
  try {
    const data = await request.json();
    if (data && typeof data === 'object') return data;
  } catch {
    /* fall through */
  }
  throw bad('Ugyldig forespørsel.');
}

/**
 * Where to send the host, and which variant is which package. The page builds the cart link from this, in the tap that opens the tab.
 * `vipps` says whether the page is to show the button «Betal med Vipps» (only when everything it needs is set, and it has been switched on).
 */
function shop(env) {
  const ids = variantIds(env);
  for (const plan of REQUIRED_VARIANTS) if (!ids[plan]) throw new HttpError(503, 'unavailable', `Betalingen er ikke satt opp ennå (${VARIANT_VARS[plan]} mangler).`);
  // (the page offers the packages that have a variant here, the retired one excepted; the Livstid variant is still handed out so that a page
  // that was cached before the change, and wants all three, keeps working)
  return { shop: shopOrigin(env), variants: ids, vipps: vippsProblem(env) === null, vippsApp: vippsProblem(env) === null, discounts: shopifySet(env) };
}

/** When the access of an order ends, in milliseconds since 1970 (Infinity for a lifetime package). */
const endsAt = (order) => {
  const end = PLANS[order.plan].ends(order.paid_at);
  return end === null ? Infinity : end * 1000;
};
const longestFirst = (a, b) => (endsAt(a) < endsAt(b) ? 1 : endsAt(a) > endsAt(b) ? -1 : 0);
const SAYS = {
  refunded: 'Denne betalingen er refundert, så koden gjelder ikke lenger.',
  disputed: 'Denne betalingen er bestridt hos kortutstederen, så koden gjelder ikke lenger.',
  cancelled: 'Denne bestillingen er kansellert, så koden gjelder ikke lenger.',
};

/**
 * From the orders that carry a code to the pass: the one that lasts longest of those that still count. A refunded, cancelled or
 * disputed order, or a package that has run out, gives nothing (and says why, if there is nothing else).
 */
async function passForOrders(env, orders, aud, now = Date.now()) {
  const alive = orders.filter((o) => o.state === 'paid' && endsAt(o) > now).sort(longestFirst);
  if (alive.length === 0) {
    const latest = [...orders].sort((a, b) => b.paid_at - a.paid_at)[0];
    if (latest.state !== 'paid') throw new HttpError(410, latest.state, SAYS[latest.state] ?? 'Denne koden gjelder ikke lenger.');
    throw new HttpError(410, 'expired', `Tilgangen «${PLANS[latest.plan].name}» har gått ut.`);
  }
  const order = alive[0];
  const { token, expiresAt } = await signPass(env, { plan: order.plan, paidAt: order.paid_at, issuedAt: Math.floor(now / 1000), aud });
  return { token, code: order.code, plan: order.plan, paidAt: order.paid_at * 1000, expiresAt };
}

async function ordersFor(env, code) {
  const db = await database(env);
  return (await db.prepare('SELECT * FROM orders WHERE code = ?').bind(code).all()).results ?? [];
}

async function restore(request, env) {
  const body = await readJson(request);
  const code = normalizeCode(body.code);
  if (!code) throw bad('Koden ser ikke riktig ut. Den har tolv tegn, som K7M2-9QXD-4TRB.');
  await settleCode(env, code); // (a payment with Vipps that the host is making just now is finished here, if Vipps has it)
  const orders = await ordersFor(env, code);
  // (Shopify can need a moment to say that the order is paid: the page asks again until it does)
  if (orders.length === 0) throw new HttpError(404, 'not_found', 'Fant ingen betaling med den koden. Har du nettopp betalt, kan det gå et øyeblikk før koden virker.');
  return passForOrders(env, orders, new URL(request.url).origin);
}

/** What is set and what is not, so that a person setting this up can see it (true or false, never the values). */
async function health(env) {
  const set = { database: false, webhookSecret: webhookSecret(env).length >= MIN_SECRET, signingKey: false, shop: false, ...Object.fromEntries(Object.keys(VARIANT_VARS).filter((p) => !PLANS[p].retired).map((p) => [p, Boolean(variantIds(env)[p])])) };
  try {
    await (await database(env)).prepare('SELECT 1 AS ok').first();
    set.database = true;
  } catch {
    /* stays false */
  }
  try {
    await signPass(env, { plan: 'lifetime', paidAt: 0, issuedAt: 0 });
    set.signingKey = true;
  } catch {
    /* stays false */
  }
  let shopUrl = null;
  try {
    shopUrl = shopOrigin(env);
    set.shop = true;
  } catch {
    /* stays false */
  }
  // the last calls from Shopify and what was done with them (the newest first): "ok", "ignored: no_code", "error: …", "bad_signature"
  let hooks = [];
  if (set.database) {
    try {
      const { results } = await (await database(env)).prepare('SELECT at, topic, result FROM hooks ORDER BY id DESC LIMIT 6').all();
      hooks = (results ?? []).map((h) => ({ at: new Date(h.at * 1000).toISOString(), topic: h.topic, result: h.result }));
    } catch {
      /* none to show */
    }
  }
  // Vipps: what is set (true or false), and how many payments are being paid just now, and how many have had their money taken without
  // an order being made for five minutes (those need a look: docs/VIPPS.md, Drift)
  const vipps = {
    enabled: clean(env.VIPPS_ENABLED).toLowerCase() === 'true',
    ready: vippsProblem(env) === null,
    env: vippsTest(env) ? 'test' : 'live',
    set: { ...Object.fromEntries([...VIPPS_NAMES, ...SHOPIFY_NAMES].map((name) => [name, isSet(env, name)])), ADMIN_TOKEN: clean(env.ADMIN_TOKEN).length >= MIN_SECRET },
    webhook: false,
    waiting: 0,
    stuck: 0,
  };
  if (set.database) {
    try {
      const db = await database(env);
      const now = Math.floor(Date.now() / 1000);
      vipps.webhook = (await vippsWebhookSecret(env)).length >= MIN_SECRET;
      vipps.waiting = (await db.prepare("SELECT COUNT(*) AS n FROM vipps WHERE state = 'started' AND created_at > ?").bind(now - 2 * 3600).first())?.n ?? 0;
      vipps.stuck = (await db.prepare("SELECT COUNT(*) AS n FROM vipps WHERE state = 'captured' AND updated_at < ?").bind(now - 300).first())?.n ?? 0;
    } catch {
      /* none to show */
    }
  }
  return { ok: true, provider: 'shopify', mode: testOrders(env) ? 'test' : 'live', site: siteUrl(env).href, shop: shopUrl, set, vipps, hooks };
}

// ------------------------------------------------------------------------------------------------ routing and CORS

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = siteUrl(env).origin;
  const headers = { Vary: 'Origin', 'Cache-Control': 'no-store' };
  if (origin && origin === allowed) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

function json(status, data, request, env) {
  let cors = { Vary: 'Origin', 'Cache-Control': 'no-store' };
  try {
    cors = corsHeaders(request, env);
  } catch {
    /* a missing SITE_URL is reported by the endpoint itself */
  }
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors } });
}

async function route(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin && origin !== siteUrl(env).origin) throw new HttpError(403, 'forbidden_origin', 'Denne siden har ikke lov til å bruke betalingen.');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });

  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) return json(200, await health(env), request, env);
  if (request.method === 'GET' && url.pathname === '/shop') return json(200, shop(env), request, env);
  if (request.method === 'POST' && url.pathname === '/restore') return json(200, await restore(request, env), request, env);
  if (request.method === 'POST' && url.pathname === '/shopify/webhook') return json(200, await webhook(request, env), request, env);
  if (request.method === 'POST' && url.pathname === '/discount') return json(200, await discountEndpoint(request, env), request, env);
  if (request.method === 'POST' && url.pathname === '/vipps/start') return json(200, await vippsStart(request, env), request, env);
  if (request.method === 'POST' && url.pathname === '/vipps/status') return json(200, await vippsStatus(request, env), request, env);
  if (request.method === 'POST' && url.pathname === '/vipps/webhook') return json(200, await vippsWebhook(request, env), request, env);
  if (request.method === 'POST' && url.pathname === '/vipps/admin/webhook') return json(200, await vippsAdminWebhook(request, env), request, env);
  if (request.method === 'GET' && url.pathname === '/vipps/admin/check') return json(200, await vippsAdminCheck(request, env), request, env);
  throw new HttpError(404, 'not_found', 'Fant ikke siden.');
}

export default {
  /** The clock: a Cron Trigger (docs/VIPPS.md) finishes the Vipps payments that nobody has heard of. */
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(reconcile(env).catch((err) => console.error('Vipps: the clock failed:', err instanceof Error ? err.message : err)));
  },
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (err) {
      if (err instanceof HttpError) {
        const body = { error: err.code, message: err.message };
        if (err.detail && testOrders(env)) body.detail = err.detail; // (only while testing)
        return json(err.status, body, request, env);
      }
      console.error('Unexpected error:', err);
      return json(500, { error: 'server', message: 'Noe gikk galt hos oss. Prøv igjen om litt.' }, request, env);
    }
  },
};
