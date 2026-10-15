// The button «Betal med Vipps»: the payment server (payments/worker-shopify.js) with a pretend Vipps and a pretend Shopify Admin API.
// What matters here is money and delivery: nothing is delivered before Vipps says the money was taken, nothing is taken that is not
// what we asked for, each step is done once however many times and from however many places it is asked for, and a payment that
// stops halfway is finished by the next call.
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { verifyPass } from '../public/js/pay/pass.js';
import { refund } from '../tools/qa/fakeshopify.mjs';
import { signWebhook } from '../tools/qa/fakevipps.mjs';
import { ADMIN_TOKEN, CODE, SITE, WORKER, mod, setupVipps } from './helpers/vipps.mjs';

const made = [];
/** A payment server with Vipps on; whatever it started is stopped after the test. */
const make = async (...args) => {
  const t = await setupVipps(...args);
  made.push(t);
  return t;
};
const realError = console.error;
afterEach(async () => {
  console.error = realError;
  while (made.length) await made.pop().stop();
});
const quiet = () => (console.error = () => {});
const json = async (res) => ({ status: res.status, body: await res.json() });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const PRICE = { evening: 89, year: 249, lifetime: 299 };
const secretOf = (t) => [...t.vipps.webhooks.values()][0].secret;

describe('GET /shop: when the page is to show the button', () => {
  it('says so when everything is set and switched on', async () => {
    const t = await make();
    assert.equal((await json(await t.call('/shop'))).body.vipps, true);
  });

  for (const name of ['VIPPS_ENABLED', 'VIPPS_MSN', 'VIPPS_CLIENT_ID', 'VIPPS_CLIENT_SECRET', 'VIPPS_SUBSCRIPTION_KEY', 'SHOPIFY_STORE', 'SHOPIFY_CLIENT_ID', 'SHOPIFY_CLIENT_SECRET']) {
    it(`says no without ${name}`, async () => {
      const t = await make({ [name]: undefined });
      const r = await json(await t.call('/shop'));
      assert.equal(r.status, 200, 'the rest of the shop is as before');
      assert.equal(r.body.vipps, false);
    });
  }

  it('wants the word "true", and in test mode ACCEPT_TEST_ORDERS too (a test payment gives no access without it)', async () => {
    assert.equal((await json(await (await make({ VIPPS_ENABLED: 'yes' })).call('/shop'))).body.vipps, false);
    assert.equal((await json(await (await make({ VIPPS_ENABLED: 'TRUE ' })).call('/shop'))).body.vipps, true, 'spaces and capitals round it are no harm');
    const test = await make({ VIPPS_ENV: 'test' });
    assert.equal((await json(await test.call('/shop'))).body.vipps, false);
    assert.equal((await test.start()).status, 503);
    test.env.ACCEPT_TEST_ORDERS = 'true';
    assert.equal((await json(await test.call('/shop'))).body.vipps, true);
  });
});

describe('POST /vipps/start', () => {
  it('makes a payment at Vipps for the price in the shop, and says where to send the host', async () => {
    const t = await make();
    const consent = new Date();
    const r = await t.start({ plan: 'evening', consent });
    assert.equal(r.status, 200);
    assert.match(r.body.reference, mod.REFERENCE);
    assert.equal(r.body.url, `${t.vipps.url}/landing/${r.body.reference}`);
    assert.deepEqual(Object.keys(r.body).sort(), ['reference', 'url']);
    const payment = t.vipps.payments.get(r.body.reference);
    assert.equal(payment.amount, 8900, 'the price of "En kveld" in øre, from the shop');
    assert.equal(payment.returnUrl, `${SITE}takk.html?ref=${r.body.reference}`, 'back to the thank-you page of the site, which only knows the reference');
    assert.equal(payment.scope, 'email', 'the host shares the e-mail address (for the receipt) and nothing else: no name, no number');
    assert.equal(payment.idempotencyKey, r.body.reference, 'a call that is made twice makes one payment');
    assert.equal(payment.description, 'Disputt: En kveld');
    assert.equal(payment.state, 'CREATED');
    const saved = t.row(r.body.reference);
    assert.deepEqual({ code: saved.code, plan: saved.plan, amount: saved.amount, state: saved.state, test: saved.test }, { code: CODE, plan: 'evening', amount: 8900, state: 'started', test: 0 });
    assert.equal(saved.consented_at, Math.floor(consent.getTime() / 1000));
  });

  it('takes the price of each package from the shop, so that it is changed in one place', async () => {
    const t = await make();
    for (const plan of Object.keys(PRICE)) {
      const r = await t.start({ plan });
      assert.equal(t.vipps.payments.get(r.body.reference).amount, PRICE[plan] * 100, plan);
    }
  });

  it('refuses what is not a package, a code or a consent, and writes nothing down', async () => {
    const t = await make();
    await t.call('/health'); // (the tables are made by the first call)
    const count = () => t.db.sqlite.prepare('SELECT COUNT(*) AS n FROM vipps').get().n;
    assert.equal((await t.start({ plan: 'gratis' })).status, 400);
    assert.equal((await t.start({ plan: null })).status, 400);
    assert.equal((await t.start({ code: 'nonsense' })).status, 400);
    assert.equal((await t.start({ code: null })).status, 400);
    assert.equal((await t.start({ consent: 'yesterday' })).status, 400, 'a consent that is not a time');
    assert.equal((await t.start({ consent: null })).status, 400, 'no consent: no payment (the right of withdrawal would not end with the delivery)');
    assert.equal((await t.start({ consent: new Date(Date.now() - 7 * 3600_000) })).status, 400, 'a consent from hours ago is not one for this purchase');
    assert.equal((await t.start({ consent: new Date(Date.now() + 3600_000) })).status, 400, 'nor one from the future');
    assert.equal(count(), 0);
    assert.equal(t.vipps.payments.size, 0);
  });

  it('turns the call away when Vipps is switched off, or something it needs is missing, and says what', async () => {
    const off = await make({ VIPPS_ENABLED: 'false' });
    assert.equal((await off.start()).status, 503);
    const missing = await make({ VIPPS_CLIENT_SECRET: undefined });
    const r = await missing.start();
    assert.equal(r.status, 503);
    assert.match(r.body.message, /VIPPS_CLIENT_SECRET/);
  });

  it('only answers the page of the game (the same rule as for every other call)', async () => {
    const t = await make();
    const res = await t.call('/vipps/start', { method: 'POST', body: { plan: 'year', code: CODE, samtykke: new Date().toISOString() }, origin: 'https://evil.example' });
    assert.equal(res.status, 403);
    assert.equal(t.vipps.payments.size, 0);
  });

  it('gives up cleanly when Vipps is down: the host is told, and the row is marked as not made', async () => {
    quiet();
    const t = await make();
    t.vipps.failNext('POST /epayment/v1/payments', 1);
    const r = await t.start();
    assert.equal(r.status, 502);
    assert.equal(t.db.sqlite.prepare("SELECT state FROM vipps").get().state, 'failed');
    assert.equal(t.vipps.payments.size, 0);
  });

  it('does not start a payment when the shop cannot say what it costs', async () => {
    quiet();
    const t = await make();
    t.admin.failNext('productVariant', 1);
    assert.equal((await t.start()).status, 502);
    assert.equal(t.db.sqlite.prepare('SELECT COUNT(*) AS n FROM vipps').get().n, 0, 'nothing is written down for a payment that was never made');
    const other = await make({ VARIANT_YEAR: '44999999999999' });
    const r = await other.start({ plan: 'year' });
    assert.equal(r.status, 503);
    assert.match(r.body.message, /Fant ikke/);
  });

  it('wants a shop that sells in kroner', async () => {
    const t = await make({}, { admin: { currency: 'EUR' } });
    const r = await t.start();
    assert.equal(r.status, 503);
    assert.match(r.body.message, /NOK/);
  });

  it('is limited, so that nobody can start thousands of payments at Vipps through it', async () => {
    const t = await make();
    await t.call('/health'); // (the tables are made by the first call)
    const insert = t.db.sqlite.prepare("INSERT INTO vipps (reference, code, plan, amount, consented_at, created_at, updated_at) VALUES (?, ?, 'year', 24900, 1, ?, ?)");
    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < 200; i++) insert.run(`disputt-${String(i).padStart(24, '0')}`, CODE, now, now);
    assert.equal((await t.start()).status, 429);
  });
});

describe('POST /vipps/admin/webhook: registering the webhook at Vipps', () => {
  it('needs the admin token', async () => {
    const t = await make();
    assert.equal((await t.adminCall('/vipps/admin/webhook', { method: 'POST', token: null })).status, 401);
    assert.equal((await t.adminCall('/vipps/admin/webhook', { method: 'POST', token: 'wrong' })).status, 401);
    assert.equal(t.vipps.webhooks.size, 0);
    const none = await make({ ADMIN_TOKEN: undefined });
    assert.equal((await none.adminCall('/vipps/admin/webhook', { method: 'POST', token: 'anything-at-all-123456' })).status, 503, 'with no token set, nobody gets in');
    const short = await make({ ADMIN_TOKEN: 'short' });
    assert.equal((await short.adminCall('/vipps/admin/webhook', { method: 'POST', token: 'short' })).status, 503, 'and a short one is a placeholder');
  });

  it('registers the address of the Worker and keeps the secret that Vipps gives, and never says it', async () => {
    const t = await make();
    const r = await t.register();
    assert.equal(r.status, 200);
    assert.equal(r.body.url, `${WORKER}/vipps/webhook`);
    assert.deepEqual(r.body.events, ['epayments.payment.authorized.v1', 'epayments.payment.aborted.v1', 'epayments.payment.expired.v1', 'epayments.payment.terminated.v1']);
    assert.equal(t.vipps.webhooks.size, 1);
    const secret = secretOf(t);
    assert.equal(t.db.sqlite.prepare("SELECT value FROM settings WHERE key = 'vipps_webhook_secret'").get().value, secret);
    assert.ok(!JSON.stringify(r.body).includes(secret), 'not in the answer');
  });

  it('replaces the webhook when it is done again: one at Vipps, and the new secret counts', async () => {
    const t = await make();
    await t.register();
    const first = secretOf(t);
    await t.register();
    assert.equal(t.vipps.webhooks.size, 1, 'the old one is deleted');
    assert.notEqual(secretOf(t), first);
    const body = { name: 'AUTHORIZED', reference: 'disputt-x' };
    assert.equal((await t.hook(body, { secret: first })).status, 401, 'a call signed with the old secret is not let in');
    assert.equal((await t.hook(body, { secret: secretOf(t) })).status, 200);
  });

  it('says what went wrong when Vipps does not let the Worker in', async () => {
    quiet();
    const t = await make({ VIPPS_CLIENT_SECRET: 'wrong-secret' });
    const r = await t.register();
    assert.equal(r.status, 502);
    assert.equal(r.body.error, 'vipps_auth');
  });
});

describe('POST /vipps/webhook: what Vipps says', () => {
  it('is turned away until the webhook has been registered (there is no secret to check against)', async () => {
    const t = await make();
    const res = await t.hook({ name: 'AUTHORIZED', reference: 'disputt-x' }, { secret: 'whatever-whatever-12345' });
    assert.equal(res.status, 503);
  });

  it('lets in only what is signed as Vipps signs: the body, the date and the address', async () => {
    quiet();
    const t = await make();
    await t.register();
    const secret = secretOf(t);
    const body = JSON.stringify({ name: 'AUTHORIZED', reference: 'disputt-not-ours' });
    const url = `${WORKER}/vipps/webhook`;
    const good = await signWebhook(url, body, secret);
    const call = (headers, text = body) => t.hook(text, { headers });
    assert.equal((await call(good)).status, 200);
    assert.equal((await call({ ...good, Authorization: 'HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=AAAA' })).status, 401, 'a wrong signature');
    const { Authorization, ...unsigned } = good;
    assert.equal((await call(unsigned)).status, 401, 'no signature');
    assert.equal((await call(good, body.replace('not-ours', 'not-yours'))).status, 401, 'a body that is not the one that was signed');
    assert.equal((await call({ ...good, 'x-ms-date': new Date(Date.now() - 3600_000).toUTCString() })).status, 401, 'a date that is not the one that was signed');
    assert.equal((await call(await signWebhook(url, body, 'another-secret-another-secret'))).status, 401, 'signed with another secret');
    assert.equal((await call(await signWebhook(`${WORKER}/other/path`, body, secret))).status, 401, 'signed for another address');
    assert.equal(t.db.sqlite.prepare("SELECT COUNT(*) AS n FROM hooks WHERE result = 'bad_signature'").get().n, 1, 'and the bad ones are written down, once a minute at most');
  });

  it('leaves what is not ours alone (a payment with another reference, or one that was never started here)', async () => {
    const t = await make();
    await t.register();
    const secret = secretOf(t);
    for (const reference of ['order-1234', 'disputt-0123456789abcdefghjkmnpq', undefined]) {
      const res = await t.hook({ name: 'AUTHORIZED', reference }, { secret });
      assert.equal(res.status, 200, String(reference));
      assert.equal((await res.json()).ignored !== undefined, true);
    }
    assert.equal(t.vipps.calls.filter((c) => c.path.startsWith('/epayment')).length, 0, 'Vipps is not even asked');
  });

  it('writes down what it did with each call, with no reference and no names', async () => {
    const t = await make();
    await t.register();
    await t.payVipps();
    const rows = t.db.sqlite.prepare("SELECT topic, result FROM hooks WHERE topic LIKE 'vipps:%'").all().map((h) => [h.topic, h.result]);
    assert.deepEqual(rows, [['vipps:AUTHORIZED', 'ok']]);
  });
});

describe('a payment from start to pass', () => {
  it('is taken, made into a paid order in Shopify, and gives the pass for the package', async () => {
    const t = await make();
    await t.register();
    const consent = new Date();
    const { body } = await t.start({ plan: 'year', consent });
    // the host has not approved yet: nothing is delivered, and nothing is taken
    assert.equal((await t.restore()).status, 404);
    assert.equal(t.vipps.payments.get(body.reference).captured, 0);
    await t.vipps.approve(body.reference);
    await t.settled();

    const payment = t.vipps.payments.get(body.reference);
    assert.equal(payment.captured, 24900, 'the whole amount is taken, once');
    assert.equal(payment.captures.size, 1);
    assert.equal(t.admin.orders.length, 1, 'one order in the shop');
    const { input, options } = t.admin.orders[0];
    assert.equal(input.financialStatus, 'PAID');
    assert.equal(input.currency, 'NOK');
    assert.equal(input.taxesIncluded, true);
    assert.equal(input.test, false);
    assert.equal(input.email, 'kari@example.com', 'the receipt goes to the address that the host shared in the Vipps app');
    assert.deepEqual(input.tags, ['vipps', body.reference], 'the reference is a tag: an order that was made and never written down is found again');
    assert.deepEqual(
      Object.fromEntries(input.customAttributes.map((a) => [a.key, a.value])),
      { kode: CODE, samtykke: new Date(Math.floor(consent.getTime() / 1000) * 1000).toISOString(), betaling: 'Vipps', vipps_referanse: body.reference },
      'the code and the consent, which the e-mail and the pass read, and how it was paid',
    );
    assert.equal(input.lineItems.length, 1);
    assert.equal(input.lineItems[0].variantId, 'gid://shopify/ProductVariant/44000000000002');
    assert.equal(input.lineItems[0].quantity, 1);
    assert.deepEqual(input.lineItems[0].priceSet, { shopMoney: { amount: '249.00', currencyCode: 'NOK' } });
    assert.equal(input.lineItems[0].requiresShipping, false);
    assert.deepEqual(input.lineItems[0].taxLines, [{ title: 'MVA', rate: 0.25, priceSet: { shopMoney: { amount: '49.80', currencyCode: 'NOK' } } }], '25 % VAT is in the price');
    assert.equal(input.transactions.length, 1);
    assert.deepEqual({ kind: input.transactions[0].kind, status: input.transactions[0].status, gateway: input.transactions[0].gateway, amount: input.transactions[0].amountSet.shopMoney.amount }, { kind: 'SALE', status: 'SUCCESS', gateway: 'Vipps', amount: '249.00' });
    assert.equal(options.sendReceipt, true);
    assert.equal(t.admin.receipts.length, 1);
    assert.equal(t.admin.receipts[0].to, 'kari@example.com');

    const saved = t.row(body.reference);
    assert.equal(saved.state, 'done');
    assert.equal(saved.order_id, String(t.admin.orders[0].id));
    const orders = t.ordersRows();
    assert.equal(orders.length, 1, 'and "orders/paid", which Shopify says for it, finds the order written down already');
    assert.deepEqual({ code: orders[0].code, plan: orders[0].plan, amount: orders[0].amount, currency: orders[0].currency, test: orders[0].test, state: orders[0].state }, { code: CODE, plan: 'year', amount: 24900, currency: 'NOK', test: 0, state: 'paid' });

    const pass = await t.restore();
    assert.equal(pass.status, 200);
    assert.equal(pass.body.plan, 'year');
    assert.equal(pass.body.code, CODE);
    assert.equal((await verifyPass(pass.body.token, t.keys.publicKey, Date.now(), WORKER)).ok, true);
    assert.equal((await t.status(body.reference)).body.state, 'done');
  });

  it('puts the right VAT on each package', async () => {
    const t = await make();
    await t.register();
    for (const [plan, tax] of Object.entries({ evening: '17.80', year: '49.80', lifetime: '59.80' })) {
      await t.payVipps({ plan, code: `K7M2-9QXD-4T${plan === 'evening' ? 'AA' : plan === 'year' ? 'BB' : 'CC'}`.replace(/A/g, '8') });
      const last = t.admin.orders.at(-1).input.lineItems[0];
      assert.equal(last.taxLines[0].priceSet.shopMoney.amount, tax, plan);
      assert.equal(last.priceSet.shopMoney.amount, `${PRICE[plan]}.00`, plan);
    }
  });

  it('gives the pass also when the webhook never comes: the page asking for the code finishes the payment', async () => {
    const t = await make();
    await t.register();
    t.vipps.hold(); // Vipps has the payment and tells nobody
    const { body } = await t.start();
    await t.vipps.approve(body.reference);
    assert.equal(t.admin.orders.length, 0);
    const r = await t.restore(); // the host's game asks every few seconds
    assert.equal(r.status, 200);
    assert.equal(t.vipps.payments.get(body.reference).captured, 24900);
    await t.vipps.release(); // and now the webhook comes, late
    await t.settled();
    assert.equal(t.admin.orders.length, 1, 'no second order');
    assert.equal(t.vipps.payments.get(body.reference).captures.size, 1, 'no second capture');
    assert.equal(t.ordersRows().length, 1);
  });

  it('is finished by the clock too, when the host has gone and nobody asks', async () => {
    const t = await make();
    await t.register();
    t.vipps.hold();
    const { body } = await t.start();
    await t.vipps.approve(body.reference);
    const waiting = [];
    await mod.worker.scheduled({}, t.env, { waitUntil: (p) => waiting.push(p) });
    await Promise.all(waiting);
    assert.equal(t.row(body.reference).state, 'done');
    assert.equal(t.admin.orders.length, 1);
    assert.equal((await t.restore()).status, 200, 'and the code from the receipt gives the pass');
  });

  it('looks at the payments where the money is taken first, and at a few at a time (a pile of payments that were never paid does not hold it up)', async () => {
    const t = await make();
    await t.register();
    for (let i = 0; i < 30; i++) assert.equal((await t.start()).status, 200); // (thirty hosts who started and never paid)
    t.vipps.hold();
    const { body } = await t.start();
    await t.vipps.approve(body.reference);
    t.admin.failNext('orderCreate', 1); // the money is taken, and the shop is not there for a moment
    quiet();
    await t.status(body.reference);
    assert.equal(t.row(body.reference).state, 'captured');
    const looks = () => t.vipps.calls.filter((c) => c.method === 'GET' && c.path.startsWith('/epayment/v1/payments/')).length;
    const before = looks();
    const waiting = [];
    await mod.worker.scheduled({}, t.env, { waitUntil: (p) => waiting.push(p) });
    await Promise.all(waiting);
    assert.equal(t.row(body.reference).state, 'done', 'the payment with the money in it was finished although thirty older ones wait');
    assert.ok(looks() - before <= 10, `at most ten payments are looked at in one go (${looks() - before})`);
  });

  it('does everything once when the webhook, the page and the clock all come at the same time', async () => {
    const t = await make();
    await t.register();
    t.vipps.hold();
    const { body } = await t.start();
    await t.vipps.approve(body.reference);
    const waiting = [];
    await Promise.all([t.restore(), t.restore(), t.status(body.reference), t.status(body.reference), t.vipps.release(), mod.worker.scheduled({}, t.env, { waitUntil: (p) => waiting.push(p) })]);
    await Promise.all(waiting);
    await t.settled();
    assert.equal(t.vipps.payments.get(body.reference).captures.size, 1, 'one capture');
    assert.equal(t.admin.orders.length, 1, 'one order');
    assert.equal(t.ordersRows().length, 1);
    assert.equal(t.row(body.reference).state, 'done');
  });

  it('does not touch a payment that is done, however often it is asked about', async () => {
    const t = await make();
    await t.register();
    const reference = await t.payVipps();
    const before = t.vipps.calls.length;
    for (let i = 0; i < 3; i++) await t.restore();
    await t.status(reference);
    assert.equal(t.vipps.calls.length, before, 'Vipps is not asked again');
    assert.equal(t.admin.orders.length, 1);
  });

  it('turns an e-mail address that is not one into an order without a receipt, and the pass is given all the same', async () => {
    const t = await make({}, { vipps: { user: { email: 'not an address', firstName: 'K', lastName: 'N', mobileNumber: '4711111111' } } });
    await t.register();
    await t.payVipps();
    assert.equal(t.admin.orders[0].input.email, undefined);
    assert.equal(t.admin.orders[0].options.sendReceipt, false);
    assert.equal((await t.restore()).status, 200);
  });
});

describe('a payment that does not go through', () => {
  it('is dropped when the host backs out, and nothing is taken', async () => {
    const t = await make();
    await t.register();
    const { body } = await t.start();
    await t.vipps.reject(body.reference);
    assert.equal(t.row(body.reference).state, 'failed');
    assert.equal(t.vipps.payments.get(body.reference).captured, 0);
    assert.equal(t.admin.orders.length, 0);
    assert.equal((await t.status(body.reference)).body.state, 'failed');
    assert.equal((await t.restore()).status, 404);
  });

  it('is dropped when it runs out, and one that is never finished is given up after a day', async () => {
    const t = await make();
    await t.register();
    const a = (await t.start()).body.reference;
    await t.vipps.expire(a);
    assert.equal(t.row(a).state, 'failed');
    const b = (await t.start({ code: 'K7M2-9QXD-4TRC' })).body.reference;
    assert.equal((await t.status(b)).body.state, 'started', 'the host may still be paying');
    t.db.sqlite.prepare('UPDATE vipps SET created_at = created_at - 90000 WHERE reference = ?').run(b);
    assert.equal((await t.status(b)).body.state, 'failed');
  });

  it('is not taken, and is let go, when Vipps says another amount than the one asked for', async () => {
    const t = await make();
    await t.register();
    t.vipps.hold();
    const { body } = await t.start();
    await t.vipps.approve(body.reference);
    t.vipps.payments.get(body.reference).amount = 100; // (something is wrong on the way)
    quiet();
    await t.restore();
    assert.equal(t.vipps.payments.get(body.reference).captured, 0);
    assert.equal(t.vipps.payments.get(body.reference).cancelled, 100, 'the reserved amount is let go');
    assert.equal(t.row(body.reference).state, 'failed');
    assert.equal(t.admin.orders.length, 0);
  });

  it('is tried again from where it stopped when Vipps cannot take the money the first time', async () => {
    quiet();
    const t = await make();
    await t.register();
    t.vipps.failNext('/capture', 1);
    const reference = await t.payVipps();
    assert.equal(t.vipps.sent[0].attempts >= 2, true, 'Vipps called the webhook again, as it does when it is not answered with a yes');
    assert.equal(t.row(reference).state, 'done');
    assert.equal(t.vipps.payments.get(reference).captures.size, 1);
    assert.equal(t.admin.orders.length, 1);
  });

  it('does not deliver on the word of the status code: money that Vipps says it took is money that shows in the amount', async () => {
    quiet();
    const t = await make();
    await t.register();
    t.vipps.captureNothing(1); // (Vipps answers "200" and the captured amount stays 0)
    const { body } = await t.start();
    t.vipps.hold();
    await t.vipps.approve(body.reference);
    assert.equal((await t.restore()).status, 404, 'no order and no pass');
    assert.equal(t.admin.orders.length, 0);
    assert.equal(t.row(body.reference).state, 'started', 'it is not "captured" until it is');
    assert.equal((await t.restore()).status, 200, 'the next try takes the money, and then the order is made');
    assert.equal(t.vipps.payments.get(body.reference).captured, 24900);
  });

  it('asks Vipps to call again while somebody else is working on the payment, or the order has to wait', async () => {
    quiet();
    const t = await make();
    await t.register();
    t.vipps.hold();
    const { body } = await t.start();
    await t.vipps.approve(body.reference);
    const secret = secretOf(t);
    const event = { name: 'AUTHORIZED', reference: body.reference };
    t.db.sqlite.prepare('UPDATE vipps SET locked_until = ? WHERE reference = ?').run(Math.floor(Date.now() / 1000) + 60, body.reference);
    assert.equal((await t.hook(event, { secret })).status, 503, 'not finished: a 5xx makes Vipps call again');
    assert.equal(t.vipps.payments.get(body.reference).captured, 0, 'and nothing was done meanwhile');
    t.db.sqlite.prepare('UPDATE vipps SET locked_until = 0 WHERE reference = ?').run(body.reference);
    assert.equal((await t.hook(event, { secret })).status, 200, 'when it is free, the call finishes it, and Vipps is told yes');
    assert.equal(t.row(body.reference).state, 'done');
  });

  it('keeps the money taken and makes the order later when the shop cannot take it at once', async () => {
    quiet();
    const t = await make();
    await t.register();
    t.admin.failNext('orderCreate', 1);
    const { body } = await t.start();
    t.vipps.hold();
    await t.vipps.approve(body.reference);
    assert.equal((await t.restore()).status, 404, 'no pass before there is an order');
    assert.equal(t.vipps.payments.get(body.reference).captured, 24900, 'the money is taken');
    assert.equal(t.row(body.reference).state, 'captured');
    assert.equal(t.row(body.reference).order_started_at, 0, 'and the next call may try the order again at once: the shop answered, with an error');
    assert.match(t.row(body.reference).note, /Butikken/);
    assert.equal((await t.restore()).status, 200, 'the next call goes on from there');
    assert.equal(t.vipps.payments.get(body.reference).captures.size, 1, 'the money is not taken again');
    assert.equal(t.admin.orders.length, 1);
  });

  it('gives the pass through Shopify\'s own call when the answer to the order was lost, and finishes later without a second order', async () => {
    quiet();
    const t = await make();
    await t.register();
    t.admin.loseNextAnswer(1);
    const reference = await t.payVipps(); // (the order is made, Shopify says "orders/paid", and the Worker never hears the answer to its own call)
    await t.settled();
    assert.equal(t.admin.orders.length, 1);
    assert.equal((await t.restore()).status, 200, 'the order is written down by Shopify\'s call, and gives the pass');
    assert.equal(t.row(reference).state, 'captured');
    t.db.sqlite.prepare('UPDATE vipps SET order_started_at = order_started_at - 200 WHERE reference = ?').run(reference);
    await t.restore();
    assert.equal(t.row(reference).state, 'done', 'and the payment is finished when the order is found by its tag');
    assert.equal(t.admin.orders.length, 1);
    assert.equal(t.ordersRows().length, 1, 'one row, whichever of the two wrote it down first');
  });

  it('does not make a second order when the answer to the first was lost (and Shopify has not called)', async () => {
    quiet();
    const t = await make({}, { noShopifyWebhook: true });
    await t.register();
    t.admin.loseNextAnswer(1);
    const reference = await t.payVipps(); // (the order is made; the Worker never hears)
    assert.equal(t.admin.orders.length, 1);
    assert.equal(t.row(reference).state, 'captured');
    assert.ok(t.row(reference).order_started_at > 0);
    assert.equal((await t.restore()).status, 404, 'it waits a while before it looks again');
    assert.equal(t.admin.orders.length, 1, 'and does not make another meanwhile');
    t.db.sqlite.prepare('UPDATE vipps SET order_started_at = order_started_at - 200 WHERE reference = ?').run(reference);
    assert.equal((await t.restore()).status, 200, 'then it finds the order by its tag, and writes it down');
    assert.equal(t.admin.orders.length, 1, 'still one');
    assert.equal(t.row(reference).state, 'done');
  });

  it('asks for a new token when Vipps or Shopify has withdrawn the one it had', async () => {
    const t = await make();
    await t.register();
    await t.start(); // (the Worker now holds a token from each)
    t.vipps.revokeTokens();
    t.admin.revokeTokens();
    const reference = await t.payVipps({ code: 'K7M2-9QXD-4TRD' });
    assert.equal(t.row(reference).state, 'done');
    assert.equal(t.admin.orders.length, 1);
  });
});

describe('the order that Shopify now has', () => {
  it('stops giving access when it is refunded in Shopify, like any other order', async () => {
    const t = await make();
    await t.register();
    const reference = await t.payVipps();
    assert.equal((await t.restore()).status, 200);
    const orderId = Number(t.row(reference).order_id);
    await t.deliver('refunds/create', refund(orderId, '249.00'));
    const r = await t.restore();
    assert.equal(r.status, 410);
    assert.equal(r.body.error, 'refunded');
  });

  it('stops when it is cancelled in Shopify', async () => {
    const t = await make();
    await t.register();
    const reference = await t.payVipps();
    await t.deliver('orders/cancelled', { id: Number(t.row(reference).order_id) });
    assert.equal((await t.restore()).status, 410);
  });

  it('is marked as a test order in Vipps\' test environment, and counts there only', async () => {
    const t = await make({ VIPPS_ENV: 'test', ACCEPT_TEST_ORDERS: 'true' });
    await t.register();
    const reference = await t.payVipps();
    const { input } = t.admin.orders[0];
    assert.equal(input.test, true);
    assert.equal(input.transactions[0].test, true);
    assert.equal(t.row(reference).test, 1);
    assert.equal((await t.restore()).status, 200, 'while testing, a test order gives access');
    assert.equal(t.ordersRows()[0].test, 1);
  });
});

describe('what the Worker keeps, and what it says', () => {
  it('keeps no name and no e-mail address, anywhere, and says no secret in /health', async () => {
    const t = await make();
    await t.register();
    await t.payVipps();
    const dump = JSON.stringify(
      t.db.sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .flatMap(({ name }) => t.db.sqlite.prepare(`SELECT * FROM ${name}`).all().filter(() => name !== 'settings')),
    );
    for (const personal of ['kari@example.com', 'Kari', 'Nordmann', '4712345678']) assert.ok(!dump.includes(personal), `${personal} is not in the database`);
    const health = JSON.stringify((await json(await t.call('/health'))).body);
    for (const secret of [t.env.VIPPS_CLIENT_SECRET, t.env.VIPPS_SUBSCRIPTION_KEY, t.env.SHOPIFY_CLIENT_SECRET, t.env.ADMIN_TOKEN, secretOf(t)]) assert.ok(!health.includes(secret), 'no secret in /health');
  });

  it('says in /health what is set up, how many payments wait, and how many have had their money taken without an order', async () => {
    quiet();
    const t = await make();
    let health = (await json(await t.call('/health'))).body.vipps;
    assert.deepEqual(health, { enabled: true, ready: true, env: 'live', set: { VIPPS_MSN: true, VIPPS_CLIENT_ID: true, VIPPS_CLIENT_SECRET: true, VIPPS_SUBSCRIPTION_KEY: true, SHOPIFY_STORE: true, SHOPIFY_CLIENT_ID: true, SHOPIFY_CLIENT_SECRET: true, ADMIN_TOKEN: true }, webhook: false, waiting: 0, stuck: 0 });
    await t.register();
    await t.start();
    health = (await json(await t.call('/health'))).body.vipps;
    assert.equal(health.webhook, true);
    assert.equal(health.waiting, 1);
    t.db.sqlite.prepare("INSERT INTO vipps (reference, code, plan, amount, consented_at, created_at, updated_at, state) VALUES ('disputt-stuck', ?, 'year', 24900, 1, 1, 1, 'captured')").run(CODE);
    assert.equal((await json(await t.call('/health'))).body.vipps.stuck, 1, 'taken, with no order for more than five minutes: somebody has to look');
  });

  it('checks every connection for the owner, and says which one does not work', async () => {
    quiet();
    const t = await make();
    const check = async () => (await json(await t.adminCall('/vipps/admin/check'))).body;
    assert.equal((await t.adminCall('/vipps/admin/check', { token: 'wrong' })).status, 401);
    let r = await check();
    assert.deepEqual({ ok: r.ok, vipps: r.vipps, webhook: r.webhook, shopify: r.shopify, prices: r.prices }, { ok: false, vipps: true, webhook: false, shopify: true, prices: PRICE }, 'Vipps and Shopify work, the webhook is not registered yet');
    await t.register();
    r = await check();
    assert.deepEqual({ ok: r.ok, webhook: r.webhook }, { ok: true, webhook: true });
    const wrongVipps = await make({ VIPPS_CLIENT_SECRET: 'wrong-secret' });
    r = (await json(await wrongVipps.adminCall('/vipps/admin/check'))).body;
    assert.deepEqual({ ok: r.ok, vipps: r.vipps, shopify: r.shopify }, { ok: false, vipps: false, shopify: true });
    assert.match(r.vippsError, /nøklene/);
    const wrongShop = await make({ SHOPIFY_CLIENT_SECRET: 'wrong-secret' });
    r = (await json(await wrongShop.adminCall('/vipps/admin/check'))).body;
    assert.deepEqual({ ok: r.ok, vipps: r.vipps, shopify: r.shopify, prices: r.prices }, { ok: false, vipps: true, shopify: false, prices: null });
    const unset = await make({ VIPPS_MSN: undefined });
    r = (await json(await unset.adminCall('/vipps/admin/check'))).body;
    assert.match(r.problem, /VIPPS_MSN/);
    assert.ok(!JSON.stringify(r).includes(t.env.VIPPS_CLIENT_SECRET));
  });
});

describe('a Worker without Vipps', () => {
  it('works as it did: no call goes to Vipps, and a code that was paid in Shopify is restored', async () => {
    const t = await make({ VIPPS_ENABLED: undefined, VIPPS_MSN: undefined, VIPPS_CLIENT_ID: undefined, VIPPS_CLIENT_SECRET: undefined, VIPPS_SUBSCRIPTION_KEY: undefined, SHOPIFY_STORE: undefined, SHOPIFY_CLIENT_ID: undefined, SHOPIFY_CLIENT_SECRET: undefined, ADMIN_TOKEN: undefined });
    const { res } = await t.pay();
    assert.equal(res.status, 200);
    assert.equal((await t.restore()).status, 200);
    assert.equal(t.vipps.calls.length, 0);
    assert.equal(t.admin.calls.length, 0);
    assert.equal((await t.adminCall('/vipps/admin/check')).status, 503);
    const scheduled = [];
    await mod.worker.scheduled({}, t.env, { waitUntil: (p) => scheduled.push(p) });
    await Promise.all(scheduled);
    assert.equal(t.vipps.calls.length, 0, 'the clock has nothing to do');
  });
});
