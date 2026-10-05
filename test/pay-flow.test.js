// What the page does around a payment (public/js/pay/payments.js): leaving for Stripe, coming back, and the cases where the host
// comes back some other way. The browser, Stripe's page and the payment server are stood in for here; tools/qa/play.mjs --pay
// plays the same thing in a real browser against the real payment server.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { makeKeys, mod } from './helpers/worker.mjs';

// ---- a pretend browser (the page modules read these when they are loaded, so this comes first)
const realSetTimeout = globalThis.setTimeout;
const waits = []; // how long the page asked to wait, each time
globalThis.setTimeout = (fn, ms, ...rest) => {
  waits.push(ms);
  const timer = realSetTimeout(fn, ms, ...rest);
  timer?.unref?.(); // a toast's timer must not keep the test process waiting
  return timer;
};
const memory = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    has: (k) => data.has(k),
  };
};
const SITE = 'https://site.test/Disputt/';
const events = []; // what happened, in order
const listeners = [];
globalThis.sessionStorage = memory();
globalThis.localStorage = memory();
globalThis.location = {
  hostname: 'site.test',
  assign: (url) => events.push(['assign', url]),
  set href(value) {
    const url = new URL(value, SITE);
    this.search = url.search;
    this.pathname = url.pathname;
    this.hash = url.hash;
    this._href = url.href;
  },
  get href() {
    return this._href;
  },
};
globalThis.location.href = SITE;
globalThis.window = { location: globalThis.location, scrollTo() {} };
globalThis.history = { replaceState: (_s, _t, url) => (globalThis.location.href = url) };
globalThis.document = { visibilityState: 'visible', addEventListener: (type, fn) => listeners.push([type, fn]) };
globalThis.addEventListener = (type, fn) => listeners.push([type, fn]);
const fire = (type, event = {}) => Promise.all(listeners.filter(([t]) => t === type).map(([, fn]) => fn(event)));

/** Stands in for the payment server: answers in turn with what the test lined up, and remembers what it was asked. */
const asked = [];
let script = [];
globalThis.fetch = async (url, init = {}) => {
  asked.push({ url: String(url), method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined });
  const next = script.shift();
  if (!next) throw new Error(`nothing lined up for ${url}`);
  if (next === 'offline') throw new TypeError('Failed to fetch');
  return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: { 'Content-Type': 'application/json' } });
};
const reply = (status, body) => ({ status, body });
const unpaid = () => reply(402, { error: 'unpaid', message: 'Betalingen er ikke gjennomført ennå.' });

let keys;
let pay;
let away;
let store;
const SESSION = 'cs_test_a1B2c3D4e5F6g7H8';
const CODE = 'K7M2-9QXD-4TRB';
const AUD = 'https://pay.test'; // the payment server the page is set up with: the passes are made for it
const PASS_KEY = `disputt:pass:${AUD}`; // (and kept under its name, so that two sites on one origin do not mix them up)

/** A pass as the payment server hands it out. */
async function passFor(plan = 'lifetime', paidAt = Math.floor(Date.now() / 1000), code = CODE) {
  const { token } = await mod.signPass({ JWT_PRIVATE_KEY: keys.privateKey }, { plan, paidAt, issuedAt: paidAt, aud: AUD });
  return reply(200, { token, code, plan });
}

before(async () => {
  keys = await makeKeys();
  pay = await import('../public/js/pay/payments.js');
  away = await import('../public/js/pay/away.js');
  store = (await import('../public/js/store.js')).store;
});
after(() => {
  globalThis.setTimeout = realSetTimeout;
});

const SETTINGS = () => ({ apiUrl: 'https://pay.test/', publicKey: keys.publicKey, methods: ['vipps', 'applepay'], freeRounds: 2, termsUrl: 'https://site.test/vilkar', privacyUrl: 'https://site.test/personvern' });
async function start(cfg = SETTINGS()) {
  await pay.initPayments(cfg);
}
const setSearch = (search) => (globalThis.location.href = `${SITE}${search}`);
const claims = () => asked.filter((a) => a.url.includes('/claim?'));

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  listeners.length = 0;
  events.length = 0;
  asked.length = 0;
  waits.length = 0;
  script = [];
  setSearch('');
  away.setAwayAnnouncer(null);
  Object.assign(store, { payments: null, pass: null, passCode: null, paywall: true, payBusy: false, sheet: null, toast: null });
});

describe('the settings', () => {
  it('are off without a payment server and a key, and on with both', () => {
    assert.equal(pay.paymentSettings(null, {}).enabled, false);
    assert.equal(pay.paymentSettings({ apiUrl: 'https://pay.test' }, {}).enabled, false, 'no key');
    assert.equal(pay.paymentSettings({ publicKey: 'x' }, {}).enabled, false, 'no server');
    assert.equal(pay.paymentSettings(SETTINGS(), null).enabled, false, 'a page without WebCrypto (not https) cannot check a pass');
    const on = pay.paymentSettings(SETTINGS(), {});
    assert.equal(on.enabled, true);
    assert.equal(on.apiUrl, 'https://pay.test', 'no slash at the end');
    assert.deepEqual(on.methods, ['vipps', 'applepay']);
    assert.equal(on.freeRounds, 2);
    assert.equal(on.termsUrl, 'https://site.test/vilkar', 'the links to the terms and to the privacy policy reach the page');
    assert.equal(on.privacyUrl, 'https://site.test/personvern');
  });

  it('fall back to Apple Pay and two free rounds, and ignore methods that do not exist', () => {
    const s = pay.paymentSettings({ apiUrl: 'https://pay.test', publicKey: 'k', methods: ['bitcoin'], freeRounds: -1 }, {});
    assert.deepEqual(s.methods, ['applepay']);
    assert.equal(s.freeRounds, 2);
    assert.equal(pay.paymentSettings({ apiUrl: 'https://pay.test', publicKey: 'k', freeRounds: 0 }, {}).freeRounds, 2, 'the first round is always free, so "none" is not a setting');
    assert.equal(pay.paymentSettings({ apiUrl: 'https://pay.test', publicKey: 'k', freeRounds: 1 }, {}).freeRounds, 1);
    assert.deepEqual(pay.paymentSettings({ apiUrl: 'https://pay.test', publicKey: 'k', methods: ['vipps', 'vipps', 'applepay'] }, {}).methods, ['vipps', 'applepay'], 'a method named twice is one button');
    const bare = pay.paymentSettings({ apiUrl: 'https://pay.test', publicKey: 'k' }, {});
    assert.equal(bare.termsUrl, 'vilkar.html', 'unless the build says otherwise, the terms and the privacy statement are the pages of the app');
    assert.equal(bare.privacyUrl, 'personvern.html');
  });
});

describe('leaving for Stripe', () => {
  it('starts the checkout, remembers it, tells the guests, and only then leaves', async () => {
    await start();
    away.setAwayAnnouncer((msg) => {
      events.push(['away', msg]);
      return 3; // three guests were told
    });
    script = [reply(200, { url: 'https://checkout.stripe.test/c/pay/cs_test_x', session: SESSION })];
    await pay.startCheckout('lifetime', 'vipps');
    assert.deepEqual(asked[0], { url: 'https://pay.test/checkout', method: 'POST', body: { plan: 'lifetime', method: 'vipps' } });
    assert.deepEqual(
      events.map((e) => e[0]),
      ['away', 'assign'],
      'the guests are told before the page goes',
    );
    assert.deepEqual(events[0][1], { t: 'away', why: 'pay', ms: 600000 });
    assert.ok(waits.includes(250), 'a moment is given for the message to get out before the page leaves');
    assert.equal(events[1][1], 'https://checkout.stripe.test/c/pay/cs_test_x');
    assert.equal(JSON.parse(sessionStorage.getItem('disputt:paying')).id, SESSION, 'the session is remembered in this tab');
  });

  it('leaves without waiting when there is nobody to tell', async () => {
    await start();
    script = [reply(200, { url: 'https://checkout.stripe.test/c/pay/cs_test_x', session: SESSION })];
    await pay.startCheckout('year', 'applepay');
    assert.ok(!waits.includes(250), 'no pause when no guest was reached');
    assert.equal(events.at(-1)[0], 'assign');
  });

  it('does not let a failing announcement stop the payment', async () => {
    await start();
    away.setAwayAnnouncer(() => {
      throw new Error('channel closed');
    });
    script = [reply(200, { url: 'https://checkout.stripe.test/c/pay/cs_test_x', session: SESSION })];
    await pay.startCheckout('year', 'applepay');
    assert.equal(events.at(-1)[0], 'assign');
  });

  it('does not leave when the browser cannot keep the room: the guests would wait for a game that cannot come back', async () => {
    await start();
    away.setAwayAnnouncer((msg) => events.push(['away', msg]));
    store.view = { phase: 'summary', round: 2 }; // a game is on in this tab
    const real = sessionStorage.setItem;
    sessionStorage.setItem = () => {
      throw new Error('blocked');
    };
    try {
      await assert.rejects(() => pay.startCheckout('year', 'applepay'), (e) => e.code === 'storage' && /Nettleseren din lar ikke siden huske spillet/.test(e.message));
    } finally {
      sessionStorage.setItem = real;
      store.view = null;
    }
    assert.deepEqual(events, [], 'nobody was told, and nobody left');
    assert.equal(asked.length, 0, 'and nothing was started at Stripe');
  });

  it('refuses a payment page that is not https (other than on this machine), and leaves nothing behind', async () => {
    await start();
    away.setAwayAnnouncer((msg) => events.push(['away', msg]));
    for (const url of ['http://pay.example.com/x', 'javascript:alert(1)', 'ftp://x.test/', 'not a url']) {
      script = [reply(200, { url, session: SESSION })];
      await assert.rejects(() => pay.startCheckout('year', 'applepay'));
    }
    assert.deepEqual(events, [], 'neither a message to the guests nor a redirect');
    assert.equal(sessionStorage.has('disputt:paying'), false);
    script = [reply(200, { url: 'http://127.0.0.1:8787/pay/cs_test_x', session: SESSION })];
    await pay.startCheckout('year', 'applepay');
    assert.equal(events.at(-1)[0], 'assign', 'a payment page on this machine is fine (the local tests)');
  });

  it('explains a payment server that cannot be reached, and one that says no', async () => {
    await start();
    script = ['offline'];
    await assert.rejects(() => pay.startCheckout('year', 'applepay'), (e) => e.code === 'network' && /kontakt/.test(e.message));
    script = [reply(400, { error: 'method_unavailable', message: 'Vipps er ikke slått på ennå.' })];
    await assert.rejects(() => pay.startCheckout('year', 'vipps'), (e) => e.code === 'method_unavailable' && e.message === 'Vipps er ikke slått på ennå.');
    assert.deepEqual(events, []);
  });
});

describe('back from Stripe', () => {
  it('keeps the pass, shows "Takk!", and cleans the address bar', async () => {
    await start();
    sessionStorage.setItem('disputt:paying', JSON.stringify({ id: SESSION, plan: 'lifetime', at: Date.now() }));
    setSearch(`?pay=success&session_id=${SESSION}`);
    script = [await passFor('lifetime')];
    await pay.handlePaymentReturn({ retryMs: 0 });
    assert.equal(asked[0].url, `https://pay.test/claim?session_id=${SESSION}`);
    assert.equal(store.pass.plan, 'lifetime');
    assert.equal(store.passCode, CODE);
    assert.equal(store.sheet, 'thanks');
    assert.equal(store.paywall, false);
    assert.equal(store.payBusy, false);
    assert.equal(location.search, '', 'a reload must not claim the same payment again');
    assert.equal(sessionStorage.has('disputt:paying'), false);
    const kept = JSON.parse(localStorage.getItem(PASS_KEY));
    assert.equal(kept.code, CODE);
    assert.equal(kept.token.split('.').length, 3);
  });

  it('asks again while Stripe has not said yes, and gets the pass in the end', async () => {
    await start();
    setSearch(`?pay=success&session_id=${SESSION}`);
    script = [unpaid(), unpaid(), await passFor('year')];
    await pay.handlePaymentReturn({ retryMs: 0 });
    assert.equal(claims().length, 3);
    assert.equal(store.pass.plan, 'year');
    assert.equal(store.sheet, 'thanks');
  });

  it('gives up after a while, says so, and keeps the payment to look at again later', async () => {
    await start();
    sessionStorage.setItem('disputt:paying', JSON.stringify({ id: SESSION, plan: 'year', at: Date.now() }));
    setSearch(`?pay=success&session_id=${SESSION}`);
    script = Array.from({ length: 12 }, unpaid);
    await pay.handlePaymentReturn({ retryMs: 0 });
    assert.equal(claims().length, 12);
    assert.equal(store.pass, null);
    assert.match(store.toast, /ikke fått bekreftet betalingen/);
    assert.equal(store.payBusy, false);
    assert.equal(sessionStorage.has('disputt:paying'), true, 'still remembered: it may turn up');
  });

  it('says what is wrong when the pass will not come, and does not ask again, or send a customer to "Logg inn" with a code that cannot fix it', async () => {
    await start();
    sessionStorage.setItem('disputt:paying', JSON.stringify({ id: SESSION, plan: 'year', at: Date.now() }));
    setSearch(`?pay=success&session_id=${SESSION}`);
    script = [reply(410, { error: 'refunded', message: 'Denne betalingen er refundert, så koden gjelder ikke lenger.' })];
    await pay.handlePaymentReturn({ retryMs: 0 });
    assert.equal(claims().length, 1, 'no point in asking again');
    assert.match(store.toast, /refundert/);
    assert.doesNotMatch(store.toast, /Logg inn/);
    assert.equal(store.pass, null);
    assert.equal(sessionStorage.has('disputt:paying'), false, 'it will never become a pass');
    setSearch(`?pay=success&session_id=${SESSION}`);
    script = [reply(404, { error: 'not_found', message: 'Fant ingen betaling med den koden.' })];
    await pay.handlePaymentReturn({ retryMs: 0 });
    assert.match(store.toast, /Har du betalt, står kontaktinformasjonen i kvitteringen fra Stripe/);
  });

  it('tries again when Stripe or the payment server stumbles, and the host still gets the pass', async () => {
    await start();
    setSearch(`?pay=success&session_id=${SESSION}`);
    script = [reply(502, { error: 'stripe', message: 'Betalingstjenesten sa nei.' }), 'offline', reply(503, { error: 'unavailable', message: 'Betalingen er ikke satt opp ennå.' }), reply(500, { error: 'server', message: 'Noe gikk galt hos oss.' }), await passFor('year')];
    await pay.handlePaymentReturn({ retryMs: 0 });
    assert.equal(claims().length, 5);
    assert.equal(store.pass.plan, 'year');
    assert.equal(store.sheet, 'thanks');
  });

  it('keeps a marker in a tab that came back from Stripe (a new tab has none), so that a failed attempt is tried again later', async () => {
    await start();
    setSearch(`?pay=success&session_id=${SESSION}`); // (this tab never left: it was opened by Vipps)
    assert.equal(sessionStorage.has('disputt:paying'), false);
    script = Array.from({ length: 12 }, () => reply(502, { error: 'stripe', message: 'Betalingstjenesten sa nei.' }));
    await pay.handlePaymentReturn({ retryMs: 0 });
    assert.equal(store.pass, null);
    assert.match(store.toast, /Betalingen er gjort, men vi fikk ikke hentet tilgangen/);
    assert.match(store.toast, /Logg inn/, 'here the code does help: the payment is made');
    assert.equal(JSON.parse(sessionStorage.getItem('disputt:paying')).id, SESSION);
    script = [await passFor('year')];
    await fire('visibilitychange'); // the host looks at the tab again
    assert.equal(store.pass.plan, 'year');
    assert.equal(sessionStorage.has('disputt:paying'), false);
  });

  it('refuses a pass that was not signed by the payment server\'s key', async () => {
    await start();
    setSearch(`?pay=success&session_id=${SESSION}`);
    const other = await makeKeys();
    const { token } = await mod.signPass({ JWT_PRIVATE_KEY: other.privateKey }, { plan: 'lifetime', paidAt: Math.floor(Date.now() / 1000), issuedAt: Math.floor(Date.now() / 1000), aud: AUD });
    script = [reply(200, { token, code: CODE, plan: 'lifetime' })];
    await pay.handlePaymentReturn({ retryMs: 0 });
    assert.equal(store.pass, null);
    assert.equal(localStorage.has(PASS_KEY), false);
    assert.match(store.toast, /kunne ikke kontrolleres/);
  });

  it('says that the payment was cancelled, and forgets it', async () => {
    await start();
    sessionStorage.setItem('disputt:paying', JSON.stringify({ id: SESSION, plan: 'year', at: Date.now() }));
    setSearch('?pay=cancel');
    await pay.handlePaymentReturn();
    assert.equal(asked.length, 0, 'nothing to ask');
    assert.match(store.toast, /Betalingen ble avbrutt\. Du er ikke belastet/);
    assert.equal(sessionStorage.has('disputt:paying'), false);
    assert.equal(location.search, '');
  });

  it('only cleans the address when payments are off, and never asks anybody anything', async () => {
    await start(null);
    assert.equal(store.payments.enabled, false);
    sessionStorage.setItem('disputt:paying', JSON.stringify({ id: SESSION, plan: 'year', at: Date.now() }));
    setSearch(`?pay=success&session_id=${SESSION}`);
    await pay.handlePaymentReturn({ retryMs: 0 });
    assert.equal(asked.length, 0);
    assert.equal(location.search, '');
    assert.equal(store.pass, null);
  });
});

describe('back some other way', () => {
  const leave = (at = Date.now()) => sessionStorage.setItem('disputt:paying', JSON.stringify({ id: SESSION, plan: 'evening', at }));

  it('finds a payment that went through while the host was away, when the tab is visible again', async () => {
    await start();
    leave();
    script = [unpaid()];
    await fire('visibilitychange');
    assert.equal(store.pass, null, 'not paid yet: nothing happens, and nothing is said');
    assert.equal(store.toast, null);
    assert.equal(sessionStorage.has('disputt:paying'), true);
    script = [await passFor('evening')];
    await fire('visibilitychange');
    assert.equal(store.pass.plan, 'evening');
    assert.equal(store.sheet, 'thanks');
    assert.equal(sessionStorage.has('disputt:paying'), false);
  });

  it('does the same when the page comes back from the back/forward cache, but not for an ordinary page show', async () => {
    await start();
    leave();
    script = [await passFor('evening')];
    await fire('pageshow', { persisted: false });
    assert.equal(asked.length, 0);
    await fire('pageshow', { persisted: true });
    assert.equal(store.pass.plan, 'evening');
  });

  it('looks when the page opens without ?pay=… too (the back button, a reload)', async () => {
    await start();
    leave();
    script = [await passFor('evening')];
    await pay.handlePaymentReturn();
    assert.equal(store.pass.plan, 'evening');
    assert.equal(store.sheet, 'thanks');
  });

  it('does nothing while the tab is hidden, and when nothing was started from this tab', async () => {
    await start();
    script = [];
    await fire('visibilitychange');
    await pay.checkPaying();
    assert.equal(asked.length, 0, 'no marker, no question');
    leave();
    globalThis.document.visibilityState = 'hidden';
    await fire('visibilitychange');
    globalThis.document.visibilityState = 'visible';
    assert.equal(asked.length, 0);
  });

  it('keeps the payment through a stumble at Stripe or the payment server, and drops one that will never become a pass', async () => {
    await start();
    leave();
    for (const answer of [reply(502, { error: 'stripe', message: 'x' }), reply(503, { error: 'unavailable', message: 'x' }), reply(500, { error: 'server', message: 'x' }), 'offline']) {
      script = [answer];
      await pay.checkPaying();
      assert.equal(sessionStorage.has('disputt:paying'), true, JSON.stringify(answer));
    }
    assert.equal(store.pass, null);
    script = [reply(410, { error: 'refunded', message: 'x' })];
    await pay.checkPaying();
    assert.equal(sessionStorage.has('disputt:paying'), false);
  });

  it('forgets a payment that is old, and one the payment server has never heard of', async () => {
    await start();
    leave(Date.now() - 3 * 60 * 60_000);
    await pay.checkPaying();
    assert.equal(asked.length, 0, 'a payment from three hours ago is not asked about');
    leave();
    script = [reply(404, { error: 'not_found', message: 'Fant ingen betaling med den koden.' })];
    await pay.checkPaying();
    assert.equal(sessionStorage.has('disputt:paying'), false);
    assert.equal(store.toast, null, 'and it is not worth a message');
  });

  it('keeps the payment when the network is down or the server stumbles, to try again', async () => {
    await start();
    leave();
    script = ['offline'];
    await pay.checkPaying();
    assert.equal(sessionStorage.has('disputt:paying'), true);
    script = [reply(500, { error: 'server', message: 'Noe gikk galt hos oss. Prøv igjen om litt.' })];
    await pay.checkPaying();
    assert.equal(sessionStorage.has('disputt:paying'), true);
    assert.equal(store.pass, null);
  });

  it('forgets the payment this tab waited for when the pass comes another way (a code typed in), so no late "Takk!" turns up', async () => {
    await start();
    leave();
    script = [await passFor('lifetime')];
    await pay.restoreWithCode(CODE);
    assert.equal(sessionStorage.has('disputt:paying'), false);
    script = [];
    await fire('visibilitychange');
    assert.equal(asked.length, 1, 'nobody asks about the old payment afterwards');
    assert.equal(store.sheet, null);
  });

  it('asks about one payment at a time', async () => {
    await start();
    leave();
    script = [await passFor('evening')];
    await Promise.all([pay.checkPaying(), pay.checkPaying(), fire('visibilitychange')]);
    assert.equal(claims().length, 1);
  });
});

describe('the pass on this phone', () => {
  it('is picked up when the page opens', async () => {
    const { body } = await passFor('year');
    localStorage.setItem(PASS_KEY, JSON.stringify({ token: body.token, code: CODE }));
    await start();
    assert.equal(store.pass.plan, 'year');
    assert.equal(store.passCode, CODE);
  });

  it('is thrown away when it has run out or has been tampered with, and kept when it only cannot be read right now', async () => {
    const old = await passFor('evening', Math.floor(Date.now() / 1000) - 13 * 3600);
    localStorage.setItem(PASS_KEY, JSON.stringify({ token: old.body.token, code: CODE }));
    await start();
    assert.equal(store.pass, null);
    assert.equal(localStorage.has(PASS_KEY), false, 'an expired pass is removed');

    const fresh = await passFor('lifetime');
    const [h, , s] = fresh.body.token.split('.');
    const forged = `${h}.${Buffer.from(JSON.stringify({ iss: 'disputt', plan: 'lifetime', pa: 1, iat: 1 })).toString('base64url')}.${s}`;
    localStorage.setItem(PASS_KEY, JSON.stringify({ token: forged, code: null }));
    await start();
    assert.equal(store.pass, null);
    assert.equal(localStorage.has(PASS_KEY), false, 'a forged pass is removed');

    localStorage.setItem(PASS_KEY, JSON.stringify({ token: fresh.body.token, code: CODE }));
    await start({ ...SETTINGS(), publicKey: 'not a key' }); // a build with a broken key: the pass is kept, not thrown away
    assert.equal(store.pass, null);
    assert.equal(localStorage.has(PASS_KEY), true);
  });

  it('belongs to the payment server it came from: a test copy on the same origin has its own, and is left alone', async () => {
    const mine = await passFor('year');
    localStorage.setItem(PASS_KEY, JSON.stringify({ token: mine.body.token, code: CODE }));
    const theirs = 'disputt:pass:https://pay-live.test';
    localStorage.setItem(theirs, JSON.stringify({ token: 'not.a.pass', code: null }));
    await start();
    assert.equal(store.pass.plan, 'year');
    assert.equal(localStorage.has(theirs), true, 'the other site\'s pass is not looked at, let alone thrown away');
  });

  it('is only good for the payment server the page is set up with, even when the key is the same', async () => {
    const paidAt = Math.floor(Date.now() / 1000);
    const foreign = await mod.signPass({ JWT_PRIVATE_KEY: keys.privateKey }, { plan: 'lifetime', paidAt, issuedAt: paidAt, aud: 'https://pay-test.example' });
    const bare = await mod.signPass({ JWT_PRIVATE_KEY: keys.privateKey }, { plan: 'lifetime', paidAt, issuedAt: paidAt });
    await start();
    for (const { token } of [foreign, bare]) {
      script = [reply(200, { token, code: CODE, plan: 'lifetime' })];
      await assert.rejects(() => pay.restoreWithCode(CODE), (e) => e.code === 'bad_pass');
      assert.equal(store.pass, null);
    }
    localStorage.setItem(PASS_KEY, JSON.stringify({ token: foreign.token, code: CODE }));
    await start();
    assert.equal(store.pass, null, 'not used when it is found on the phone either');
  });

  it('keeps the better pass: an older code typed in, or a cheaper package bought, changes nothing', async () => {
    const life = await passFor('lifetime');
    localStorage.setItem(PASS_KEY, JSON.stringify({ token: life.body.token, code: CODE }));
    await start();
    script = [await passFor('evening', undefined, 'AAAA-AAAA-AAAA')];
    const back = await pay.restoreWithCode('AAAA-AAAA-AAAA');
    assert.equal(back.plan, 'lifetime', 'what comes back is the pass that stays');
    assert.equal(store.pass.plan, 'lifetime');
    assert.equal(store.passCode, CODE);
    assert.equal(JSON.parse(localStorage.getItem(PASS_KEY)).code, CODE);
    // a link such as ?pay=success&session_id=<somebody else's evening> does not downgrade a phone either
    setSearch('?pay=success&session_id=cs_test_Zz9Yy8Xx7Ww6');
    script = [await passFor('evening', undefined, 'BBBB-BBBB-BBBB')];
    await pay.handlePaymentReturn({ retryMs: 0 });
    assert.equal(store.pass.plan, 'lifetime');
    // the other way round, a pass that gives more replaces one that gives less
    pay.forgetPass();
    script = [await passFor('evening')];
    await pay.restoreWithCode(CODE);
    assert.equal(store.pass.plan, 'evening');
    script = [await passFor('year')];
    await pay.restoreWithCode(CODE);
    assert.equal(store.pass.plan, 'year', 'a year outlasts an evening');
    script = [await passFor('lifetime')];
    await pay.restoreWithCode(CODE);
    assert.equal(store.pass.plan, 'lifetime');
  });

  it('is taken off the phone on request, and the code with it', async () => {
    const { body } = await passFor('year');
    localStorage.setItem(PASS_KEY, JSON.stringify({ token: body.token, code: CODE }));
    await start();
    pay.forgetPass();
    assert.equal(store.pass, null);
    assert.equal(store.passCode, null);
    assert.equal(localStorage.has(PASS_KEY), false);
  });

  it('comes back with the code from the receipt, typed any which way', async () => {
    await start();
    script = [await passFor('lifetime')];
    const pass = await pay.restoreWithCode('k7m2 9qxd 4trb');
    assert.equal(pass.plan, 'lifetime');
    assert.deepEqual(asked[0], { url: 'https://pay.test/restore', method: 'POST', body: { code: CODE } });
    assert.equal(store.passCode, CODE);
    script = [];
    await assert.rejects(() => pay.restoreWithCode('hei'), (e) => e.code === 'bad_request');
    assert.equal(asked.length, 1, 'a code that cannot be right is not sent anywhere');
    script = [reply(404, { error: 'not_found', message: 'Fant ingen betaling med den koden.' })];
    await assert.rejects(() => pay.restoreWithCode(CODE), (e) => e.code === 'not_found' && /Fant ingen betaling/.test(e.message));
  });
});
