// What the page does around a payment with «Betal med Vipps» (public/js/pay/vipps.js): the tab that is opened inside the tap, the call to the
// payment server, the way to Vipps, the waiting, and what happens when something goes wrong. The browser is stood in for here; the payment
// server is the real one (payments/worker-shopify.js) with a pretend Vipps and a pretend Shopify. tools/qa/vippsflow.mjs plays it in a real browser.
import assert from 'node:assert/strict';
import { after, before, beforeEach, afterEach, describe, it } from 'node:test';
import { mod, setupVipps } from './helpers/vipps.mjs';

// ---- a pretend browser (the page modules read these when they are loaded, so this comes first)
// (the timers are the real ones, which the pretend Vipps and Node's own fetch need; only what the page repeats every second is held back, so that
// a test can say when a second has gone by)
const realSetInterval = globalThis.setInterval;
const realClearInterval = globalThis.clearInterval;
const realFetch = globalThis.fetch;
const intervals = new Map(); // what the page has asked to be called again and again
let lastTimer = 0;
globalThis.setInterval = (fn, ms) => {
  intervals.set(++lastTimer, { fn, ms });
  return { id: lastTimer, unref() {}, ref() {}, [Symbol.toPrimitive]: () => lastTimer };
};
globalThis.clearInterval = (handle) => void intervals.delete(typeof handle === 'object' ? handle?.id : handle);
/** A second goes by: the page's repeated jobs run once. */
const tick = async () => {
  for (const { fn } of [...intervals.values()]) await fn();
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
const PAY_SERVER = 'https://pay.test';
const events = []; // what happened, in order
const listeners = [];
let tabs = true; // does the browser open a new tab? (false: it refuses, like a pop-up blocker)
let theTab = null;
globalThis.sessionStorage = memory();
globalThis.localStorage = memory();
globalThis.location = { hostname: 'site.test', search: '', pathname: '/Disputt/', hash: '', assign: (url) => events.push(['assign', url]) };
globalThis.window = {
  location: globalThis.location,
  scrollTo() {},
  open: (url, target) => {
    events.push(['open', url, target]);
    if (!tabs) return null;
    theTab = {
      closed: false,
      document: { write: (html) => events.push(['write', html.includes('Åpner Vipps')]) },
      location: {
        set href(url2) {
          events.push(['navigate', url2]);
        },
      },
      close() {
        this.closed = true;
        events.push(['close']);
      },
    };
    return theTab;
  },
};
globalThis.history = { replaceState() {} };
globalThis.document = { visibilityState: 'visible', addEventListener: (type, fn) => listeners.push([type, fn]) };
globalThis.addEventListener = (type, fn) => listeners.push([type, fn]);

/** The payment server, as the page reaches it: the real Worker, asked from the game's own site. Everything else (Vipps, Shopify) is reached for real. */
let t;
const asked = [];
let offline = 0;
let gate = null; // a promise that the next call to the payment server waits for (to look at the page while the call is on its way)
globalThis.fetch = async (url, init = {}) => {
  if (!String(url).startsWith(PAY_SERVER)) return realFetch(url, init);
  asked.push({ url: String(url), method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined });
  if (offline > 0) {
    offline--;
    throw new TypeError('Failed to fetch');
  }
  if (gate) await gate;
  return mod.worker.fetch(new Request(String(url), { ...init, headers: { ...(init.headers ?? {}), Origin: 'https://site.test' } }), t.env);
};

let pay;
let away;
let store;
let shop;
let vippsPage;
const PASS_KEY = `disputt:pass:${PAY_SERVER}`;

before(async () => {
  pay = await import('../public/js/pay/payments.js');
  away = await import('../public/js/pay/away.js');
  store = (await import('../public/js/store.js')).store;
  shop = await import('../public/js/pay/shop.js');
  vippsPage = await import('../public/js/pay/vipps.js');
});
after(() => {
  Object.assign(globalThis, { setInterval: realSetInterval, clearInterval: realClearInterval, fetch: realFetch });
});

const settings = () => ({ provider: 'shopify', apiUrl: `${PAY_SERVER}/`, publicKey: t.keys.publicKey, freeRounds: 2, termsUrl: 'https://site.test/vilkar', privacyUrl: 'https://site.test/personvern' });
const opened = () => events.filter((e) => e[0] === 'open');
const flush = () => new Promise((resolve) => setImmediate(resolve));
/** The first question that the page asks by itself, right after the host has been sent to Vipps, gets its answer (one question at a time is asked). */
const firstQuestion = () => new Promise((resolve) => setTimeout(resolve, 80));
const quiet = () => (console.error = () => {});
const realError = console.error;
const VIPPS_REFERENCE = /^disputt-[0-9a-hjkmnp-tv-z]{24}$/;

beforeEach(async () => {
  t = await setupVipps({ SITE_URL: SITE });
  await t.register();
  sessionStorage.clear();
  localStorage.clear();
  listeners.length = 0;
  intervals.clear();
  events.length = 0;
  asked.length = 0;
  offline = 0;
  gate = null;
  tabs = true;
  theTab = null;
  document.visibilityState = 'visible';
  away.setAwayAnnouncer(null);
  Object.assign(store, { payments: null, pass: null, passCode: null, paywall: true, payBusy: false, payWaiting: null, sheet: null, toast: null, view: null });
  await pay.initPayments(settings());
  shop.setKnownShop({ shop: 'https://shop.example.test', variants: { evening: '44000000000001', year: '44000000000002', lifetime: '44000000000003' }, vipps: true });
});
afterEach(async () => {
  console.error = realError;
  shop.cancelShopPayment();
  await t.stop();
});

describe('the tap on «Betal med Vipps»', () => {
  it('opens the tab at once, inside the tap, and says «Venter på betalingen» before the server has answered', async () => {
    let release;
    gate = new Promise((resolve) => (release = resolve)); // the payment server is slow
    const started = vippsPage.startVippsCheckout('year');
    assert.equal(opened().length, 1, 'the tab is open before anything has been waited for (otherwise it is taken for a pop-up)');
    assert.deepEqual(opened()[0].slice(1), ['about:blank', '_blank']);
    assert.ok(store.payWaiting, 'the bar already says that the host is paying');
    assert.equal(store.payWaiting.plan, 'year');
    assert.equal(store.payWaiting.url, '', 'with no address yet');
    release();
    await started;
  });

  it('asks the server for a payment with the code, the package and the time of the consent, and sends the tab to Vipps', async () => {
    const before = Date.now();
    await vippsPage.startVippsCheckout('evening');
    const call = asked.find((a) => a.url.endsWith('/vipps/start'));
    assert.equal(call.method, 'POST');
    assert.deepEqual(Object.keys(call.body).sort(), ['code', 'plan', 'samtykke']);
    assert.equal(call.body.plan, 'evening');
    assert.match(call.body.code, /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    const consent = Date.parse(call.body.samtykke);
    assert.ok(consent >= before - 1000 && consent <= Date.now() + 1000, 'the time of the tap');
    const reference = [...t.vipps.payments.keys()][0];
    assert.match(reference, VIPPS_REFERENCE);
    assert.deepEqual(events.filter((e) => e[0] === 'navigate'), [['navigate', `${t.vipps.url}/landing/${reference}`]], 'the tab goes to Vipps');
    assert.equal(store.payWaiting.url, `${t.vipps.url}/landing/${reference}`);
    assert.equal(store.payWaiting.code, call.body.code, 'the code that is waited for is the one the payment was made with');
    const kept = JSON.parse(sessionStorage.getItem('disputt:shop'));
    assert.deepEqual({ code: kept.code, plan: kept.plan, url: kept.url }, { code: call.body.code, plan: 'evening', url: store.payWaiting.url }, 'and a page that is opened again finds the payment');
  });

  it('tells the guests that the host is away, before anything else', async () => {
    const told = [];
    away.setAwayAnnouncer((message) => (told.push(message), 2));
    const started = vippsPage.startVippsCheckout('year');
    assert.equal(told.length, 1);
    assert.equal(told[0].t, 'away');
    await started;
  });

  it('does nothing for a double tap: one payment, one tab', async () => {
    const first = vippsPage.startVippsCheckout('year');
    await vippsPage.startVippsCheckout('year'); // (the second tap, before the first has finished)
    await first;
    assert.equal(opened().length, 1);
    assert.equal(asked.filter((a) => a.url.endsWith('/vipps/start')).length, 1);
    assert.equal(t.vipps.payments.size, 1);
    await vippsPage.startVippsCheckout('year'); // (and a tap while the host is paying)
    assert.equal(asked.filter((a) => a.url.endsWith('/vipps/start')).length, 1);
  });

  it('does not open anything when the payment server does not offer Vipps', async () => {
    shop.setKnownShop({ shop: 'https://shop.example.test', variants: { evening: '44000000000001', year: '44000000000002', lifetime: '44000000000003' }, vipps: false });
    assert.throws(() => vippsPage.startVippsCheckout('year'), (err) => err.code === 'unavailable');
    assert.equal(opened().length, 0);
    assert.equal(store.payWaiting, null);
  });
});

describe('when it does not work', () => {
  it('closes the tab and takes the waiting away when the payment server says no, and a new try is possible', async () => {
    quiet();
    t.vipps.failNext('POST /epayment/v1/payments', 1);
    await assert.rejects(vippsPage.startVippsCheckout('year'), (err) => /Vipps/.test(err.message));
    assert.equal(theTab.closed, true);
    assert.equal(store.payWaiting, null);
    assert.equal(sessionStorage.has('disputt:shop'), false, 'nothing is kept for a payment that was never made');
    await vippsPage.startVippsCheckout('year');
    assert.ok(store.payWaiting.url);
  });

  it('says that there is no line when there is none, and closes the tab', async () => {
    offline = 1;
    await assert.rejects(vippsPage.startVippsCheckout('year'), (err) => err.code === 'network' && /Sjekk nettet/.test(err.message));
    assert.equal(theTab.closed, true);
    assert.equal(store.payWaiting, null);
  });

  it('sends the page itself to Vipps when the browser will not open a tab, after the guests have been told', async () => {
    tabs = false;
    store.view = null;
    away.setAwayAnnouncer(() => 1);
    await vippsPage.startVippsCheckout('year');
    const reference = [...t.vipps.payments.keys()][0];
    assert.deepEqual(events.filter((e) => e[0] === 'assign'), [['assign', `${t.vipps.url}/landing/${reference}`]]);
  });

  it('only goes to an address that is https (or a pretend one on this machine)', async () => {
    // a payment server that answers with an address that is not Vipps': the page does not follow it
    const pageFetch = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
      if (String(url).endsWith('/vipps/start')) return new Response(JSON.stringify({ url: 'javascript:alert(1)', reference: 'disputt-x' }), { status: 200 });
      return pageFetch(url, init);
    };
    try {
      await assert.rejects(vippsPage.startVippsCheckout('year'));
    } finally {
      globalThis.fetch = pageFetch;
    }
    assert.equal(theTab.closed, true);
    assert.equal(events.some((e) => e[0] === 'navigate'), false);
    assert.equal(store.payWaiting, null);
  });
});

describe('after Vipps', () => {
  it('finds the pass when the host has approved, shows «Velkommen!» and closes the Vipps tab', async () => {
    await vippsPage.startVippsCheckout('year');
    const reference = [...t.vipps.payments.keys()][0];
    await firstQuestion();
    await shop.check();
    assert.ok(store.payWaiting, 'not paid yet: still waiting');
    await tick();
    assert.equal(theTab.closed, false, 'and the tab is left alone');
    await t.vipps.approve(reference); // the host approves in the Vipps app; Vipps calls the webhook
    await t.settled();
    await shop.check(); // the page asks again, as it does every few seconds
    assert.equal(store.payWaiting, null);
    assert.equal(store.sheet, 'thanks');
    assert.equal(store.pass.plan, 'year');
    assert.ok(localStorage.has(PASS_KEY), 'the pass is kept on this phone');
    assert.equal(sessionStorage.has('disputt:shop'), false);
    await tick();
    assert.equal(theTab.closed, true, 'the tab for Vipps is closed when the game has the access');
  });

  it('finds the pass without the webhook too, because the page asks and the server looks at Vipps', async () => {
    t.vipps.hold();
    await vippsPage.startVippsCheckout('lifetime');
    await firstQuestion();
    await t.vipps.approve([...t.vipps.payments.keys()][0]);
    await shop.check();
    assert.equal(store.payWaiting, null);
    assert.equal(store.pass.plan, 'lifetime');
    assert.equal(store.pass.expiresAt, null);
  });

  it('is picked up again by a page that is opened while the host is paying (the phone put it to sleep, or it was reloaded)', async () => {
    await vippsPage.startVippsCheckout('year');
    const reference = [...t.vipps.payments.keys()][0];
    await firstQuestion();
    Object.assign(store, { payWaiting: null }); // (the page starts again: only sessionStorage is left)
    shop.initShop();
    assert.ok(store.payWaiting, 'it knows that a payment was waited for');
    await firstQuestion();
    await t.vipps.approve(reference);
    await t.settled();
    await shop.check();
    assert.equal(store.payWaiting, null);
    assert.equal(store.pass.plan, 'year');
  });

  it('gives up waiting when the host presses «Avbryt», and closes the tab for Vipps', async () => {
    await vippsPage.startVippsCheckout('year');
    shop.cancelShopPayment();
    assert.equal(store.payWaiting, null);
    await tick();
    assert.equal(theTab.closed, true);
    assert.equal(sessionStorage.has('disputt:shop'), false);
  });

  it('says nothing about a payment that was turned down in Vipps, and the host can try again', async () => {
    await vippsPage.startVippsCheckout('year');
    const reference = [...t.vipps.payments.keys()][0];
    await t.vipps.reject(reference);
    await shop.check();
    assert.ok(store.payWaiting, 'still waiting: a turned down payment gives nothing, and the host decides when to stop');
    assert.equal(store.pass, null);
    shop.cancelShopPayment();
    await vippsPage.startVippsCheckout('year');
    assert.equal(t.vipps.payments.size, 2, 'a new payment, with a new reference');
    await flush();
  });
});
