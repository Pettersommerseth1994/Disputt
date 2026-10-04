// Disputt payments: the small server between the game and Stripe. One file, no dependencies, made for a Cloudflare Worker
// (paste it into the dashboard's editor; docs/BETALING.md has every step). The game itself stays on GitHub Pages, which can
// only serve files, so something has to hold the Stripe key, start a payment and say "yes, this one was paid".
//
//   POST /checkout   { plan, method }   starts a Stripe Checkout and returns { url, session } (the page to send the host to, and its id)
//   GET  /claim      ?session_id=cs_…   the host is back from Stripe: checks with Stripe that it was paid, returns the pass
//   POST /restore    { code }           a customer on a new phone types the code from their receipt: returns the pass again
//   GET  /health                        { ok, mode: "test" | "live", methods }   (to check that the set-up is right; no secrets)
//
// A pass is a JWT signed with ES256; the page checks it with the matching public key (public/js/pay/pass.js). Nothing is stored
// here: everything is looked up in Stripe, where every payment carries the plan and a restore code in its metadata.
//
// Settings (Worker > Settings > Variables and secrets):
//   STRIPE_KEY         secret   a Stripe *restricted* key (see docs/BETALING.md for the permissions)
//   JWT_PRIVATE_KEY    secret   the private signing key, base64 of the PKCS#8 DER (docs/BETALING.md shows how to make it)
//   SITE_URL           text     where the game lives, e.g. https://pettersommerseth1994.github.io/Disputt/
//   PRICE_EVENING, PRICE_YEAR, PRICE_LIFETIME   text   the Stripe price ids (price_…) of the three packages
//   VIPPS_ENABLED      text     "true" once Stripe has given you access to Vipps (private preview)
//   STRIPE_VIPPS_VERSION  text  optional: the Stripe-Version header for the Vipps preview, as shown in Stripe's Vipps docs
//   METHOD_MODE        text     optional: how the two buttons choose the payment method on Stripe's page. Default: the button asks for
//                               just its own (allowed_payment_method_types). "static" sends the older payment_method_types instead, and
//                               "dynamic" lets the Stripe dashboard decide which methods are shown
//   REQUIRE_TERMS      text     optional: "true" to make the customer tick a box before paying (needs the terms link in the Stripe dashboard)
//   TERMS_URL          text     optional, with REQUIRE_TERMS: the terms (https://…), so that the box can say what is agreed to, including that
//                               the right of withdrawal ends when the access is delivered
//   STRIPE_API_BASE    text     optional: for tests only (a fake Stripe)

/** One calendar year after `seconds` (the same day and time, UTC; a year bought on 29 February ends on 1 March). */
function plusOneYear(seconds) {
  const d = new Date(seconds * 1000);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return Math.floor(d.getTime() / 1000);
}

/**
 * The packages. `amount` is in øre and must be what the Stripe price says (checked when the payment is started, so that a price that
 * points at the wrong package is found before anybody pays). `ends(paidAt)` is when the access ends, in seconds, for a payment made at
 * `paidAt` (seconds); null means never.
 */
const PLANS = {
  evening: { name: 'En kveld', amount: 14900, ends: (paidAt) => paidAt + 12 * 3600 },
  year: { name: 'For ett år', amount: 39900, ends: plusOneYear },
  lifetime: { name: 'Livstid', amount: 49900, ends: () => null },
};

const PRICE_VARS = { evening: 'PRICE_EVENING', year: 'PRICE_YEAR', lifetime: 'PRICE_LIFETIME' };
const VIPPS_VERSION = '2026-09-30.preview; vipps_preview=v1';
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const te = new TextEncoder();

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

/** A new restore code: 12 characters, 60 bits, written XXXX-XXXX-XXXX. */
function newCode() {
  const raw = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => CODE_ALPHABET[b & 31]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

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

/** Stripe wants form fields with brackets: { a: { b: [1, 2] } } becomes a[b][0]=1&a[b][1]=2. */
function encodeForm(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      v.forEach((item, i) => (typeof item === 'object' ? encodeForm(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    } else if (typeof v === 'object') encodeForm(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

const siteUrl = (env) => {
  let u;
  try {
    u = new URL(env.SITE_URL);
  } catch {
    throw new HttpError(503, 'unavailable', 'Betalingen er ikke satt opp riktig (SITE_URL mangler).');
  }
  if (!u.pathname.endsWith('/')) u.pathname += '/';
  u.search = '';
  u.hash = '';
  return u;
};

const testMode = (env) => String(env.STRIPE_KEY ?? '').includes('_test_');
const vippsOn = (env) => String(env.VIPPS_ENABLED).toLowerCase() === 'true';
const termsOn = (env) => String(env.REQUIRE_TERMS).toLowerCase() === 'true';

/** The terms link for the tick box. It goes into a Markdown link, so nothing that would end the link or the text early is allowed. */
function termsLink(env) {
  if (!termsOn(env) || !env.TERMS_URL) return null;
  if (!/^https:\/\/[^\s()<>"'\\\[\]]+$/.test(env.TERMS_URL)) {
    throw new HttpError(503, 'unavailable', 'Betalingen er ikke satt opp riktig (TERMS_URL må være en https-adresse uten mellomrom, parenteser eller anførselstegn).');
  }
  return env.TERMS_URL;
}

// ------------------------------------------------------------------------------------------------ Stripe

/** One call to the Stripe API. Throws an HttpError with Norwegian text when Stripe says no. */
async function stripe(env, method, path, form) {
  if (!env.STRIPE_KEY) throw new HttpError(503, 'unavailable', 'Betalingen er ikke satt opp ennå (STRIPE_KEY mangler).');
  const headers = { Authorization: `Bearer ${env.STRIPE_KEY}` };
  // while Vipps is in private preview every request has to say so (it names the API version and the preview)
  if (vippsOn(env)) headers['Stripe-Version'] = env.STRIPE_VIPPS_VERSION || VIPPS_VERSION;
  const init = { method, headers };
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Idempotency-Key'] = crypto.randomUUID();
    init.body = form.toString();
  }
  let res;
  try {
    res = await fetch(`${env.STRIPE_API_BASE || 'https://api.stripe.com'}${path}`, init);
  } catch (err) {
    throw new HttpError(502, 'stripe', 'Fikk ikke kontakt med betalingstjenesten. Prøv igjen om litt.', String(err));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.error?.message ?? `HTTP ${res.status}`;
    console.error('Stripe said no:', res.status, detail);
    if (res.status === 404) throw new HttpError(404, 'not_found', 'Fant ingen betaling med den koden.', detail);
    throw new HttpError(502, 'stripe', 'Betalingstjenesten sa nei. Prøv igjen, eller ta kontakt hvis det fortsetter.', detail);
  }
  return data;
}

// ------------------------------------------------------------------------------------------------ passes

/**
 * Signs a pass for a payment. `paidAt` is in seconds. `aud` is this payment server's own address: a pass is only good for the page that
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

/**
 * From a paid payment (a Stripe PaymentIntent with its latest charge) to the pass. Refuses what is not ours, not paid, not the
 * right amount, refunded, or too old.
 */
async function passForPayment(env, pi, aud, now = Date.now()) {
  const plan = pi?.metadata?.plan;
  if (pi?.metadata?.app !== 'disputt' || !PLANS[plan]) throw new HttpError(404, 'not_found', 'Fant ingen betaling med den koden.');
  if (pi.status !== 'succeeded') throw new HttpError(402, 'unpaid', 'Betalingen er ikke gjennomført ennå.');
  // The amount that was paid has to be the one the payment was started with (/checkout wrote it in the metadata, after checking it against
  // the package). Not today's price: a price that has changed since must not lock out earlier buyers.
  const started = Number(pi.metadata.amount);
  if (pi.currency !== 'nok' || !Number.isInteger(started) || pi.amount !== started) {
    console.error('Wrong amount for', plan, pi.amount, pi.currency, 'started as', pi.metadata.amount);
    throw new HttpError(503, 'misconfigured', 'Beløpet stemmer ikke med pakken. Ta kontakt, så ordner vi det.');
  }
  // (the charge is asked for along with the payment; without it nobody can say whether the money is still there)
  const charge = pi.latest_charge;
  if (!charge || typeof charge !== 'object') throw new HttpError(502, 'stripe', 'Fikk ikke sjekket betalingen hos Stripe. Prøv igjen om litt.');
  if (charge.refunded) throw new HttpError(410, 'refunded', 'Denne betalingen er refundert, så koden gjelder ikke lenger.');
  if (charge.disputed) throw new HttpError(410, 'disputed', 'Denne betalingen er bestridt hos kortutstederen, så koden gjelder ikke lenger.');
  const paidAt = pi.created;
  const end = PLANS[plan].ends(paidAt);
  if (end !== null && end * 1000 <= now) throw new HttpError(410, 'expired', `Tilgangen «${PLANS[plan].name}» har gått ut.`);
  const { token, expiresAt } = await signPass(env, { plan, paidAt, issuedAt: Math.floor(now / 1000), aud });
  return { token, code: pi.metadata.code ?? null, plan, paidAt: paidAt * 1000, expiresAt };
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

async function checkout(request, env) {
  const body = await readJson(request);
  const plan = typeof body.plan === 'string' && Object.hasOwn(PLANS, body.plan) ? body.plan : null;
  if (!plan) throw bad('Ukjent pakke.');
  if (!['vipps', 'applepay'].includes(body.method)) throw bad('Ukjent betalingsmåte.');
  if (body.method === 'vipps' && !vippsOn(env)) throw new HttpError(400, 'method_unavailable', 'Vipps er ikke slått på ennå.');
  const price = env[PRICE_VARS[plan]];
  if (!price) throw new HttpError(503, 'unavailable', `Betalingen er ikke satt opp ennå (${PRICE_VARS[plan]} mangler).`);

  const site = siteUrl(env).href;
  const terms = termsLink(env); // (checked before anything is started at Stripe)
  const code = newCode();
  const meta = { app: 'disputt', plan, code, amount: String(PLANS[plan].amount) }; // (the amount this payment is started with: see passForPayment)
  const type = body.method === 'vipps' ? 'vipps' : 'card'; // (Apple Pay is part of "card" on Stripe's page)
  const mode = String(env.METHOD_MODE ?? '').toLowerCase();
  // The code is shown on Stripe's page too, so that a customer who pays always has it, whatever happens on the way back to the game.
  const codeLine = `Koden din er **${code}**. Ta vare på den: med den får du tilgangen tilbake på en annen telefon.`;
  const form = encodeForm({
    mode: 'payment',
    line_items: [{ price, quantity: 1 }],
    success_url: `${site}?pay=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}?pay=cancel`,
    locale: 'nb',
    customer_creation: 'always',
    metadata: meta,
    payment_intent_data: { description: `Disputt – ${PLANS[plan].name} (kode ${code})`, metadata: meta },
    // The right of withdrawal ends for digital content that is delivered at once, but only with the buyer's own, express consent:
    // a box that has to be ticked says it best. Without the box (no terms link set) the notice by the button has to do.
    custom_text: {
      submit: {
        message: `${
          terms
            ? 'Du får tilgangen med en gang etter betalingen. Engangsbetaling, og ingenting fornyes av seg selv.'
            : 'Du får tilgangen med en gang. Ved å betale ber du om at leveringen starter nå, og du samtykker i at angreretten da bortfaller.'
        }\n\n${codeLine}`,
      },
      ...(terms ? { terms_of_service_acceptance: { message: `Jeg godtar [vilkårene](${terms}), ber om at tilgangen leveres med en gang, og forstår at jeg da mister angreretten.` } } : {}),
    },
    // The Vipps button asks for Vipps only, the Apple Pay button for card (Apple Pay is part of it). "dynamic": the dashboard decides.
    ...(mode === 'dynamic' ? {} : mode === 'static' ? { payment_method_types: [type] } : { allowed_payment_method_types: [type] }),
    ...(termsOn(env) ? { consent_collection: { terms_of_service: 'required' } } : {}),
  });
  const session = await stripe(env, 'POST', '/v1/checkout/sessions', form);
  if (!session.url) throw new HttpError(502, 'stripe', 'Betalingstjenesten ga ikke en betalingsside. Prøv igjen.');
  // A price in Stripe that is not the package's (the wrong price id, or another currency) is found here, before anybody pays.
  if (session.amount_total !== PLANS[plan].amount || session.currency !== 'nok') {
    console.error('The Stripe price does not match the package', plan, session.amount_total, session.currency);
    throw new HttpError(503, 'misconfigured', `Prisen i Stripe stemmer ikke med pakken (${PRICE_VARS[plan]}). Ta kontakt, så ordner vi det.`);
  }
  return { url: session.url, session: session.id };
}

async function claim(url, env) {
  const id = url.searchParams.get('session_id') ?? '';
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,}$/.test(id)) throw bad('Ugyldig betalings-ID.');
  const session = await stripe(env, 'GET', `/v1/checkout/sessions/${id}?expand[]=payment_intent.latest_charge`);
  if (session.metadata?.app !== 'disputt') throw new HttpError(404, 'not_found', 'Fant ingen betaling med den koden.');
  if (session.payment_status !== 'paid' || typeof session.payment_intent !== 'object' || !session.payment_intent) {
    throw new HttpError(402, 'unpaid', 'Betalingen er ikke gjennomført ennå.');
  }
  return passForPayment(env, session.payment_intent, url.origin);
}

async function restore(request, env) {
  const body = await readJson(request);
  const code = normalizeCode(body.code);
  if (!code) throw bad('Koden ser ikke riktig ut. Den har tolv tegn, som K7M2-9QXD-4TRB.');
  const query = `metadata['code']:'${code}' AND status:'succeeded'`;
  const found = await stripe(env, 'GET', `/v1/payment_intents/search?query=${encodeURIComponent(query)}&limit=1&expand[]=data.latest_charge`);
  const pi = found.data?.[0];
  // (Stripe's search lags behind by up to a minute, so a customer who pays and logs in at once on another phone can be told no)
  if (!pi) throw new HttpError(404, 'not_found', 'Fant ingen betaling med den koden. Har du nettopp betalt, kan det gå opptil et minutt før koden virker.');
  return passForPayment(env, pi, new URL(request.url).origin);
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

  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    return json(200, { ok: true, mode: testMode(env) ? 'test' : 'live', methods: vippsOn(env) ? ['vipps', 'applepay'] : ['applepay'], site: siteUrl(env).href, terms: termsOn(env) ? (termsLink(env) ? 'box-with-link' : 'box') : 'notice' }, request, env);
  }
  if (request.method === 'POST' && url.pathname === '/checkout') return json(200, await checkout(request, env), request, env);
  if (request.method === 'GET' && url.pathname === '/claim') return json(200, await claim(url, env), request, env);
  if (request.method === 'POST' && url.pathname === '/restore') return json(200, await restore(request, env), request, env);
  throw new HttpError(404, 'not_found', 'Fant ikke siden.');
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (err) {
      if (err instanceof HttpError) {
        const body = { error: err.code, message: err.message };
        if (err.detail && testMode(env)) body.detail = err.detail; // (only while testing: it is Stripe's own wording)
        return json(err.status, body, request, env);
      }
      console.error('Unexpected error:', err);
      return json(500, { error: 'server', message: 'Noe gikk galt hos oss. Prøv igjen om litt.' }, request, env);
    }
  },
};
