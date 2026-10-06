// The payment server (payments/worker.js), against a pretend Stripe.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { verifyPass } from '../public/js/pay/pass.js';
import { ORIGIN, SITE, WORKER, mod, setup } from './helpers/worker.mjs';

let t;
beforeEach(async () => {
  t = await setup();
});
afterEach(() => t.restore());

const json = async (res) => ({ status: res.status, body: await res.json(), headers: res.headers });

/** The customer's whole trip: start a checkout, pay on Stripe's page, come back with the session id. */
async function buy(plan = 'year', method = 'applepay') {
  const started = await json(await t.call('/checkout', { method: 'POST', body: { plan, method } }));
  assert.equal(started.status, 200, JSON.stringify(started.body));
  const sessionId = started.body.url.split('/').pop();
  const paymentId = t.stripe.pay(sessionId);
  return { sessionId, paymentId, started };
}

describe('health', () => {
  it('says whether it is test or live, and which methods are on, and nothing secret', async () => {
    const r = await json(await t.call('/health'));
    assert.deepEqual(r.body, { ok: true, mode: 'test', methods: ['applepay'], site: SITE, terms: 'notice' });
    t.env.VIPPS_ENABLED = 'true';
    t.env.STRIPE_KEY = 'rk_live_x';
    const live = await json(await t.call('/'));
    assert.equal(live.body.mode, 'live');
    assert.deepEqual(live.body.methods, ['vipps', 'applepay']);
    assert.ok(!JSON.stringify(live.body).includes('rk_live_x'));
  });
});

describe('POST /checkout', () => {
  it('starts a Stripe Checkout for the chosen package, and nothing in it comes from the page except the package and the method', async () => {
    const { started } = await buy('year', 'applepay');
    assert.match(started.body.url, /^https:\/\/checkout\.stripe\.test\/c\/pay\/cs_test_/);
    assert.match(started.body.session, /^cs_test_[A-Za-z0-9]+$/, 'the page is told which session it was, to ask about it later');
    assert.ok(started.body.url.includes(started.body.session));
    const call = t.stripe.calls.find((c) => c.path === '/v1/checkout/sessions');
    const p = call.params;
    assert.equal(p.get('mode'), 'payment');
    assert.equal(p.get('line_items[0][price]'), 'price_year');
    assert.equal(p.get('line_items[0][quantity]'), '1');
    assert.equal(p.get('allowed_payment_method_types[0]'), 'card', 'Apple Pay is part of "card" on Stripe\'s page');
    assert.equal(p.get('payment_method_types[0]'), null, 'the older parameter is not used unless asked for');
    assert.equal(p.get('metadata[amount]'), '24900', 'what this payment is started with, so that a later change of price cannot lock out the buyer');
    assert.equal(p.get('payment_intent_data[metadata][amount]'), '24900');
    assert.match(p.get('custom_text[submit][message]'), new RegExp(`Koden din er \\*\\*${p.get('metadata[code]')}\\*\\*`), 'the code is on Stripe\'s page too');
    assert.equal(p.get('locale'), 'nb');
    assert.equal(p.get('customer_creation'), 'always');
    assert.equal(p.get('success_url'), `${SITE}?pay=success&session_id={CHECKOUT_SESSION_ID}`);
    assert.equal(p.get('cancel_url'), `${SITE}?pay=cancel`);
    assert.equal(p.get('metadata[app]'), 'disputt');
    assert.equal(p.get('metadata[plan]'), 'year');
    assert.match(p.get('metadata[code]'), /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    assert.equal(p.get('payment_intent_data[metadata][code]'), p.get('metadata[code]'), 'the payment carries the same code, so that it can be found again');
    assert.match(p.get('payment_intent_data[description]'), /^Disputt – For ett år \(kode [0-9A-Z-]{14}\)$/);
    assert.match(p.get('custom_text[submit][message]'), /angreretten/);
    assert.equal(p.get('consent_collection[terms_of_service]'), null);
    assert.equal(call.headers['stripe-version'], undefined, 'no preview header until Vipps is on');
    assert.equal(call.headers.authorization, `Bearer ${t.stripe.key}`);
  });

  it('asks for Vipps only for the Vipps button, with the preview header, and only when Vipps is on', async () => {
    const off = await json(await t.call('/checkout', { method: 'POST', body: { plan: 'evening', method: 'vipps' } }));
    assert.equal(off.status, 400);
    assert.equal(off.body.error, 'method_unavailable');
    t.env.VIPPS_ENABLED = 'true';
    const { started } = await buy('evening', 'vipps');
    assert.ok(started.body.url);
    const call = t.stripe.calls.findLast((c) => c.path === '/v1/checkout/sessions');
    assert.equal(call.params.get('allowed_payment_method_types[0]'), 'vipps');
    assert.equal(call.headers['stripe-version'], '2026-09-30.preview; vipps_preview=v1');
    t.env.STRIPE_VIPPS_VERSION = '2027-01-01.preview; vipps_preview=v2';
    await buy('evening', 'vipps');
    assert.equal(t.stripe.calls.findLast((c) => c.path === '/v1/checkout/sessions').headers['stripe-version'], '2027-01-01.preview; vipps_preview=v2');
  });

  it('can leave the choice of payment methods to the Stripe dashboard, and can ask for the terms', async () => {
    t.env.METHOD_MODE = 'dynamic';
    t.env.REQUIRE_TERMS = 'true';
    await buy('lifetime', 'applepay');
    const p = t.stripe.calls.find((c) => c.path === '/v1/checkout/sessions').params;
    assert.equal(p.get('payment_method_types[0]'), null);
    assert.equal(p.get('allowed_payment_method_types[0]'), null, 'the dashboard decides');
    assert.equal(p.get('line_items[0][price]'), 'price_lifetime');
    assert.equal(p.get('consent_collection[terms_of_service]'), 'required');
    assert.equal(p.get('custom_text[terms_of_service_acceptance][message]'), null, 'no terms link set: Stripe\'s own box text, and the notice by the button stays');
    assert.match(p.get('custom_text[submit][message]'), /angreretten/);
  });

  it('puts the terms and the end of the right of withdrawal in the box that has to be ticked, when it knows the terms', async () => {
    t.env.REQUIRE_TERMS = 'true';
    t.env.TERMS_URL = 'https://example.github.io/Disputt/vilkar.html';
    await buy('year', 'applepay');
    const p = t.stripe.calls.find((c) => c.path === '/v1/checkout/sessions').params;
    assert.equal(p.get('consent_collection[terms_of_service]'), 'required');
    const box = p.get('custom_text[terms_of_service_acceptance][message]');
    assert.match(box, /^Jeg godtar \[vilkårene\]\(https:\/\/example\.github\.io\/Disputt\/vilkar\.html\)/);
    assert.match(box, /leveres med en gang/);
    assert.match(box, /mister angreretten/);
    assert.doesNotMatch(p.get('custom_text[submit][message]'), /angreretten/, 'said once, where it is agreed to');
    assert.equal((await json(await t.call('/health', { origin: null }))).body.terms, 'box-with-link');
  });

  it('does not start a payment with a terms link that could break the box text', async () => {
    t.env.REQUIRE_TERMS = 'true';
    for (const bad of ['http://example.com/vilkar', 'https://example.com/a b', 'https://example.com/x)(y', 'https://example.com/"', 'javascript:alert(1)', 'https://example.com/[x]']) {
      t.env.TERMS_URL = bad;
      const r = await json(await t.call('/checkout', { method: 'POST', body: { plan: 'year', method: 'applepay' } }));
      assert.equal(r.status, 503, bad);
      assert.match(r.body.message, /TERMS_URL/);
    }
    assert.equal(t.stripe.calls.length, 0, 'Stripe was never asked');
    t.env.REQUIRE_TERMS = 'false';
    await buy('year', 'applepay'); // the link is only looked at when the box is asked for
  });

  it('finds a price in Stripe that is not the package\'s before anybody has paid, and shows no payment page', async () => {
    t.env.PRICE_YEAR = 'price_evening'; // the 89 kr price on the year
    const r = await json(await t.call('/checkout', { method: 'POST', body: { plan: 'year', method: 'applepay' } }));
    assert.equal(r.status, 503);
    assert.equal(r.body.error, 'misconfigured');
    assert.match(r.body.message, /PRICE_YEAR/);
    assert.equal(r.body.url, undefined);
    t.env.PRICE_YEAR = 'price_year';
    assert.equal((await json(await t.call('/checkout', { method: 'POST', body: { plan: 'year', method: 'applepay' } }))).status, 200);
  });

  it('can send the older payment_method_types instead, when asked to', async () => {
    t.env.METHOD_MODE = 'static';
    await buy('year', 'applepay');
    const p = t.stripe.calls.find((c) => c.path === '/v1/checkout/sessions').params;
    assert.equal(p.get('payment_method_types[0]'), 'card');
    assert.equal(p.get('allowed_payment_method_types[0]'), null);
  });

  it('only takes the package and the method as what they are: text', async () => {
    for (const body of [{ plan: ['year'], method: 'applepay' }, { plan: { toString: 1 }, method: 'applepay' }, { plan: 'year', method: ['applepay'] }, { plan: 1, method: 'applepay' }]) {
      const r = await json(await t.call('/checkout', { method: 'POST', body }));
      assert.equal(r.status, 400, JSON.stringify(body));
    }
    assert.equal(t.stripe.calls.length, 0, 'Stripe was never asked');
  });

  it('refuses what it does not know, and what is not set up', async () => {
    for (const body of [{ plan: 'gratis', method: 'vipps' }, { plan: 'year', method: 'bitcoin' }, { plan: '__proto__', method: 'vipps' }, {}]) {
      const r = await json(await t.call('/checkout', { method: 'POST', body }));
      assert.equal(r.status, 400, JSON.stringify(body));
    }
    const notJson = await t.call('/checkout', { method: 'POST' });
    assert.equal(notJson.status, 400);
    delete t.env.PRICE_YEAR;
    const r = await json(await t.call('/checkout', { method: 'POST', body: { plan: 'year', method: 'applepay' } }));
    assert.equal(r.status, 503);
    assert.match(r.body.message, /PRICE_YEAR/);
    assert.equal(t.stripe.calls.length, 0, 'Stripe was never asked');
  });
});

describe('CORS', () => {
  it('only lets the game\'s own site use it', async () => {
    const ok = await t.call('/checkout', { method: 'POST', body: { plan: 'year', method: 'applepay' } });
    assert.equal(ok.headers.get('Access-Control-Allow-Origin'), ORIGIN);
    assert.equal(ok.headers.get('Vary'), 'Origin');
    assert.equal(ok.headers.get('Cache-Control'), 'no-store');
    const other = await json(await t.call('/checkout', { method: 'POST', body: { plan: 'year', method: 'applepay' }, origin: 'https://evil.example' }));
    assert.equal(other.status, 403);
    assert.equal(other.headers.get('Access-Control-Allow-Origin'), null);
    const pre = await t.call('/checkout', { method: 'OPTIONS' });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS');
    assert.equal(pre.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
    const preOther = await t.call('/checkout', { method: 'OPTIONS', origin: 'https://evil.example' });
    assert.equal(preOther.status, 403);
  });

  it('is happy with a call that has no Origin (a person with curl), and reports a missing SITE_URL', async () => {
    const r = await json(await t.call('/health', { origin: null }));
    assert.equal(r.status, 200);
    delete t.env.SITE_URL;
    const bad = await json(await t.call('/health', { origin: null }));
    assert.equal(bad.status, 503);
  });
});

describe('GET /claim', () => {
  it('turns a paid session into a pass that the page can check', async () => {
    const { sessionId } = await buy('year');
    const r = await json(await t.call(`/claim?session_id=${sessionId}`));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.plan, 'year');
    assert.match(r.body.code, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    const paidAt = r.body.paidAt;
    const aYearOn = new Date(paidAt);
    aYearOn.setUTCFullYear(aYearOn.getUTCFullYear() + 1);
    assert.equal(r.body.expiresAt, aYearOn.getTime(), 'twelve months: the same day next year, however many days that is');
    const checked = await verifyPass(r.body.token, t.keys.publicKey);
    assert.equal(checked.ok, true, JSON.stringify(checked));
    assert.equal(checked.pass.plan, 'year');
    assert.equal(checked.pass.expiresAt, r.body.expiresAt);
  });

  it('counts "En kveld" as 12 hours from the payment, however many times it is claimed, and a lifetime pass never ends', async () => {
    const evening = await buy('evening');
    const a = await json(await t.call(`/claim?session_id=${evening.sessionId}`));
    const b = await json(await t.call(`/claim?session_id=${evening.sessionId}`));
    assert.equal(a.body.expiresAt, a.body.paidAt + 12 * 3600 * 1000);
    assert.equal(b.body.expiresAt, a.body.expiresAt, 'a second claim does not stretch it');
    assert.equal(b.body.code, a.body.code);
    const life = await buy('lifetime');
    const c = await json(await t.call(`/claim?session_id=${life.sessionId}`));
    assert.equal(c.body.expiresAt, null);
    assert.equal((await verifyPass(c.body.token, t.keys.publicKey)).pass.expiresAt, null);
  });

  it('says no to a session that is not paid, not ours, or not a session', async () => {
    const started = await json(await t.call('/checkout', { method: 'POST', body: { plan: 'year', method: 'applepay' } }));
    const id = started.body.url.split('/').pop();
    assert.equal((await json(await t.call(`/claim?session_id=${id}`))).status, 402);
    assert.equal((await json(await t.call('/claim?session_id=nope'))).status, 400);
    assert.equal((await json(await t.call('/claim'))).status, 400);
    assert.equal((await json(await t.call('/claim?session_id=cs_test_aaaaaaaaaaaaaaaaaaaa'))).status, 404, 'Stripe does not know it');
    t.stripe.sessions.get(id).metadata.app = 'other';
    t.stripe.pay(id);
    assert.equal((await json(await t.call(`/claim?session_id=${id}`))).status, 404);
  });

  it('refuses a payment whose amount is not the one it was started with, whatever else is true of it', async () => {
    const started = await json(await t.call('/checkout', { method: 'POST', body: { plan: 'year', method: 'applepay' } }));
    const id = started.body.url.split('/').pop();
    t.stripe.pay(id, { amount: 8900 }); // (something changed the amount on its way: it is not what the payment was started with)
    const r = await json(await t.call(`/claim?session_id=${id}`));
    assert.equal(r.status, 503);
    assert.equal(r.body.error, 'misconfigured');
    assert.equal(r.body.token, undefined);
  });

  it('does not lock out somebody who paid before the price changed', async () => {
    const life = await buy('lifetime');
    const evening = await buy('evening');
    const before = mod.PLANS.lifetime.amount;
    const eveningBefore = mod.PLANS.evening.amount;
    mod.PLANS.lifetime.amount = 59900; // the owner raises the price (and puts a new price in Stripe)
    mod.PLANS.evening.amount = 17900;
    try {
      const a = await json(await t.call(`/claim?session_id=${life.sessionId}`));
      assert.equal(a.status, 200, JSON.stringify(a.body));
      const code = t.stripe.sessions.get(evening.sessionId).metadata.code;
      const b = await json(await t.call('/restore', { method: 'POST', body: { code } }));
      assert.equal(b.status, 200, JSON.stringify(b.body));
    } finally {
      mod.PLANS.lifetime.amount = before;
      mod.PLANS.evening.amount = eveningBefore;
    }
  });

  it('hands out a pass for a payment that was partly refunded, and not for one that was disputed', async () => {
    const a = await buy('year');
    t.stripe.refund(a.paymentId, { partial: true }); // a goodwill refund: the customer keeps what they bought
    assert.equal((await json(await t.call(`/claim?session_id=${a.sessionId}`))).status, 200);
    const b = await buy('year');
    t.stripe.dispute(b.paymentId); // the customer's bank has taken the money back
    const r = await json(await t.call(`/claim?session_id=${b.sessionId}`));
    assert.equal(r.status, 410);
    assert.equal(r.body.error, 'disputed');
  });

  it('gives no pass for a payment it could not look at, instead of guessing that all is well', async () => {
    const { sessionId } = await buy('year');
    t.stripe.ignoreExpand = true;
    const r = await json(await t.call(`/claim?session_id=${sessionId}`));
    assert.equal(r.status, 502);
    assert.equal(r.body.error, 'stripe');
    assert.equal(r.body.token, undefined);
  });

  it('makes a pass for this Worker only: a pass from one payment server is no use to a page set up with another', async () => {
    const { sessionId } = await buy('year');
    const r = await json(await t.call(`/claim?session_id=${sessionId}`));
    assert.equal((await verifyPass(r.body.token, t.keys.publicKey, Date.now(), WORKER)).ok, true);
    const other = await verifyPass(r.body.token, t.keys.publicKey, Date.now(), 'https://pay-live.example.workers.dev');
    assert.equal(other.ok, false);
    assert.equal(other.reason, 'audience', 'the same key, another payment server');
  });

  it('refuses a refunded payment, and a package that has run out', async () => {
    const { sessionId, paymentId } = await buy('year');
    t.stripe.refund(paymentId);
    const refunded = await json(await t.call(`/claim?session_id=${sessionId}`));
    assert.equal(refunded.status, 410);
    assert.equal(refunded.body.error, 'refunded');

    const started = await json(await t.call('/checkout', { method: 'POST', body: { plan: 'evening', method: 'applepay' } }));
    const id = started.body.url.split('/').pop();
    t.stripe.pay(id, { createdAt: Math.floor(Date.now() / 1000) - 13 * 3600 });
    const old = await json(await t.call(`/claim?session_id=${id}`));
    assert.equal(old.status, 410);
    assert.equal(old.body.error, 'expired');
  });
});

describe('POST /restore', () => {
  it('gives the pass back to somebody who types the code from the receipt, however they type it', async () => {
    const { sessionId } = await buy('lifetime');
    const first = await json(await t.call(`/claim?session_id=${sessionId}`));
    const typed = first.body.code.toLowerCase().replace(/-/g, ' ');
    const r = await json(await t.call('/restore', { method: 'POST', body: { code: typed } }));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.plan, 'lifetime');
    assert.equal(r.body.code, first.body.code);
    assert.equal((await verifyPass(r.body.token, t.keys.publicKey)).ok, true);
    const search = t.stripe.calls.findLast((c) => c.path === '/v1/payment_intents/search');
    assert.equal(search.query.get('query'), `metadata['code']:'${first.body.code}' AND status:'succeeded'`);
  });

  it('says to wait a minute when the payment is so new that Stripe\'s search does not have it yet, and then finds it', async () => {
    t.stripe.searchLag = true; // (the real search can be up to a minute behind)
    const { sessionId } = await buy('year');
    const code = t.stripe.sessions.get(sessionId).metadata.code;
    const early = await json(await t.call('/restore', { method: 'POST', body: { code } }));
    assert.equal(early.status, 404);
    assert.match(early.body.message, /opptil et minutt/);
    t.stripe.flush();
    assert.equal((await json(await t.call('/restore', { method: 'POST', body: { code } }))).status, 200);
  });

  it('works without ever having claimed: the customer closed the tab after paying', async () => {
    const { started } = await buy('year');
    const code = [...t.stripe.sessions.values()].find((s) => started.body.url.endsWith(s.id)).metadata.code;
    const r = await json(await t.call('/restore', { method: 'POST', body: { code } }));
    assert.equal(r.status, 200);
    assert.equal(r.body.plan, 'year');
  });

  it('says no to codes that are wrong, unknown, refunded or from an unpaid session', async () => {
    assert.equal((await json(await t.call('/restore', { method: 'POST', body: { code: 'ABC' } }))).status, 400);
    assert.equal((await json(await t.call('/restore', { method: 'POST', body: { code: "K7M2-9QXD-4TRB" } }))).status, 404);
    assert.equal((await json(await t.call('/restore', { method: 'POST', body: {} }))).status, 400);
    const { sessionId, paymentId } = await buy('year');
    const code = t.stripe.sessions.get(sessionId).metadata.code;
    t.stripe.refund(paymentId);
    const r = await json(await t.call('/restore', { method: 'POST', body: { code } }));
    assert.equal(r.status, 410);
    const unpaid = await json(await t.call('/checkout', { method: 'POST', body: { plan: 'year', method: 'applepay' } }));
    const unpaidCode = [...t.stripe.sessions.values()].find((s) => unpaid.body.url.endsWith(s.id)).metadata.code;
    assert.equal((await json(await t.call('/restore', { method: 'POST', body: { code: unpaidCode } }))).status, 404);
  });
});

describe('when something is wrong', () => {
  it('tells a person it is Stripe, and shows Stripe\'s wording only while testing', async () => {
    t.env.PRICE_YEAR = 'price_that_does_not_exist';
    const test = await json(await t.call('/checkout', { method: 'POST', body: { plan: 'year', method: 'applepay' } }));
    assert.equal(test.status, 502);
    assert.match(test.body.detail, /No such price/);
    t.stripe.calls.length = 0;
    t.env.STRIPE_KEY = 'sk_live_whatever';
    const live = await json(await t.call('/checkout', { method: 'POST', body: { plan: 'year', method: 'applepay' } }));
    assert.equal(live.status, 502);
    assert.equal(live.body.detail, undefined, 'nothing of Stripe\'s is shown on a live site');
    assert.equal(live.body.error, 'stripe');
  });

  it('says it is Stripe, in plain words, when Stripe is busy or down, on every way in', async () => {
    for (const status of [429, 500, 503]) {
      t.stripe.failNext(status);
      const a = await json(await t.call('/checkout', { method: 'POST', body: { plan: 'year', method: 'applepay' } }));
      assert.equal(a.status, 502, String(status));
      assert.equal(a.body.error, 'stripe');
      assert.match(a.body.message, /Prøv igjen/);
    }
    const { sessionId } = await buy('year');
    t.stripe.failNext(500);
    const b = await json(await t.call(`/claim?session_id=${sessionId}`));
    assert.equal(b.status, 502);
    assert.equal(b.body.error, 'stripe');
    t.stripe.failNext(429);
    const code = t.stripe.sessions.get(sessionId).metadata.code;
    const c = await json(await t.call('/restore', { method: 'POST', body: { code } }));
    assert.equal(c.status, 502);
    assert.equal((await json(await t.call(`/claim?session_id=${sessionId}`))).status, 200, 'and it works again when Stripe does');
  });

  it('reports a missing or broken signing key instead of handing out something that will not check', async () => {
    const { sessionId } = await buy('year');
    t.env.JWT_PRIVATE_KEY = 'not a key';
    assert.equal((await json(await t.call(`/claim?session_id=${sessionId}`))).status, 503);
    delete t.env.JWT_PRIVATE_KEY;
    assert.equal((await json(await t.call(`/claim?session_id=${sessionId}`))).status, 503);
  });

  it('knows nothing else', async () => {
    assert.equal((await json(await t.call('/admin'))).status, 404);
    assert.equal((await json(await t.call('/claim', { method: 'POST', body: {} }))).status, 404);
  });

  it('accepts the signing key as a PEM too', async () => {
    const { sessionId } = await buy('year');
    const pem = `-----BEGIN PRIVATE KEY-----\n${t.keys.privateKey.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;
    t.env.JWT_PRIVATE_KEY = pem;
    const r = await json(await t.call(`/claim?session_id=${sessionId}`));
    assert.equal(r.status, 200);
    assert.equal((await verifyPass(r.body.token, t.keys.publicKey)).ok, true);
  });
});

describe('the pretend Stripe', () => {
  it('refuses metadata that is not flat, as the real one does, so that a mistake in the Worker cannot hide behind it', () => {
    const { handle, key } = t.stripe;
    const form = (extra) => new URLSearchParams({ mode: 'payment', 'line_items[0][price]': 'price_year', success_url: 'https://x.test/?s={CHECKOUT_SESSION_ID}', ...extra }).toString();
    const ok = handle('POST', '/v1/checkout/sessions', form({ 'metadata[plan]': 'year' }), { Authorization: `Bearer ${key}` });
    assert.equal(ok.status, 200);
    const nested = handle('POST', '/v1/checkout/sessions', form({ 'metadata[plan][0]': 'year' }), { Authorization: `Bearer ${key}` });
    assert.equal(nested.status, 400);
  });
});

describe('the form encoding Stripe wants', () => {
  it('writes nested fields and lists with brackets, and leaves out what is empty', () => {
    const form = mod.encodeForm({ a: 1, b: { c: 'x', d: [1, 2] }, e: [{ f: 'g' }], h: undefined, i: null });
    assert.equal(form.toString(), 'a=1&b%5Bc%5D=x&b%5Bd%5D%5B0%5D=1&b%5Bd%5D%5B1%5D=2&e%5B0%5D%5Bf%5D=g');
  });
});
