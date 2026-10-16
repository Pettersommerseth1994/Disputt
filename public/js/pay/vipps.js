// Paying with Vipps, seen from the page: the host ticks the box and taps «Betal med Vipps». The payment server makes a payment at Vipps
// (payments/worker-shopify.js, POST /vipps/start) and the host is sent there in a NEW tab, like the shop: this page stays open behind it,
// says «Venter på betalingen …», and asks the payment server now and then whether the code it made up has been paid (shop.js: check). When
// Vipps has the money, the server makes the order in Shopify, and the next question gets the pass: «Velkommen!» shows and the Vipps tab is closed.
// The tab is opened inside the tap, empty, and sent to Vipps when the address has come: a tab that is opened after the call to the server
// is taken for a pop-up and stopped.
// (A file of its own: pages are cached for ten minutes, and a module that imports something an older cached copy of another module does not
// have would not load. Everything here is made of what shop.js already had, and of the browser.)

import { setStore, store } from '../store.js';
import { announceAway } from './away.js';
import { PayError } from './payments.js';
import { check, knownShop, newPayCode } from './shop.js';

const WAITING_KEY = 'disputt:shop'; // the same as shop.js: a page that is opened again finds the payment, whichever way it was started
const WAITING_MAX_MS = 2 * 60 * 60_000;
const isLocal = (h) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]';

/** Can this tab keep something for a while? (The room of a host who is sent away to pay is kept there.) */
function tabCanRemember() {
  try {
    sessionStorage.setItem('disputt:probe', '1');
    const ok = sessionStorage.getItem('disputt:probe') === '1';
    sessionStorage.removeItem('disputt:probe');
    return ok;
  } catch {
    return false;
  }
}

/** Only Vipps' own https address, or a pretend one on this machine (the tests), is somewhere to send the host. */
function vippsAddress(text) {
  try {
    const u = new URL(String(text));
    if (u.protocol === 'https:' || (u.protocol === 'http:' && isLocal(u.hostname))) return u.href;
  } catch {
    /* refused below */
  }
  return null;
}

/**
 * What the new tab shows until Vipps is ready: the game's own look (the logo, its style sheets, by their full addresses: a blank tab has no
 * base address of its own), not a bare page. Only what the tab has to say: the game stands in the tab behind.
 */
export function openingPage() {
  let base = '';
  try {
    base = new URL(document.baseURI || location.href).href;
  } catch {
    /* the plain addresses are used */
  }
  const at = (path) => {
    try {
      return new URL(path, base).href;
    } catch {
      return path;
    }
  };
  const sheets = ['tokens', 'base', 'components', 'screens'].map((name) => `<link rel="stylesheet" href="${at(`css/${name}.css`)}">`).join('');
  return `<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Åpner Vipps</title><meta name="theme-color" content="#6a1428"><meta name="color-scheme" content="dark">${sheets}<body><main class="screen screen--padded takk"><div class="grow center stack stack--loose" style="align-items:center;justify-content:center"><span class="logo-sticker"><img src="${at('assets/logo/disputt-logo.svg')}" alt="Disputt" width="300" height="130"></span><h1>Åpner Vipps …</h1><p class="lead muted">Et øyeblikk. Vipps åpner seg her, og spillet venter i fanen bak.</p></div></main>`;
}

function remember(waiting) {
  try {
    sessionStorage.setItem(WAITING_KEY, JSON.stringify(waiting));
  } catch {
    /* a browser that keeps nothing: the page asks while it is open, and the code is in the e-mail */
  }
}

/** The tab that was opened for Vipps is no use once the payment has been found or given up: it is closed by whoever is still looking. */
function closeWhenDone(tab) {
  if (!tab) return;
  const until = Date.now() + WAITING_MAX_MS;
  const timer = setInterval(() => {
    if (tab.closed || Date.now() > until) return clearInterval(timer);
    if (!store.payWaiting) {
      clearInterval(timer);
      try {
        tab.close();
      } catch {
        /* already gone */
      }
    }
    return undefined;
  }, 1000);
}

let starting = false;

/**
 * The host tapped «Betal med Vipps» for `plan`. Resolves when the host has been sent to Vipps (or to the page that explains why not: it
 * rejects with a PayError whose message is for the host). Must be called inside the tap, as the first thing that happens there.
 */
export function startVippsCheckout(plan, discount = '') {
  if (starting || store.payWaiting) return Promise.resolve(); // (a double tap)
  const info = knownShop();
  const apiUrl = store.payments?.apiUrl;
  if (!info?.vipps || !apiUrl) throw new PayError('unavailable', 'Vipps er ikke klart ennå. Prøv igjen om et øyeblikk.');
  const waiting = { code: newPayCode(), plan, at: Date.now(), url: '' };
  const consent = new Date(waiting.at).toISOString(); // the time of the tap: the host has just ticked the box
  starting = true;
  const told = announceAway('pay'); // (the guests are told before anything else: this tab may sleep once Vipps is on top of it)
  const tab = window.open('about:blank', '_blank');
  // A browser that does not open a new tab sends this one to Vipps, as for the shop: the room is kept in the tab, and the page finds the
  // payment when the host comes back. A browser that keeps nothing would lose the room.
  if (!tab && store.view && !tabCanRemember()) {
    starting = false;
    throw new PayError('storage', 'Nettleseren din åpner ikke en ny fane og lar ikke siden huske spillet mens du betaler (står «Blokker alle informasjonskapsler» på?). Slå det av eller bruk en annen nettleser, ellers mister dere spillet.');
  }
  try {
    tab?.document.write(openingPage());
  } catch {
    /* a tab that cannot be written to is sent on all the same */
  }
  setStore({ payWaiting: waiting }); // «Venter på betalingen …» at once: the call to the server takes a moment

  const fail = (err) => {
    try {
      tab?.close();
    } catch {
      /* already gone */
    }
    setStore({ payWaiting: null });
    throw err;
  };
  return fetch(`${apiUrl}/vipps/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify({ plan, code: waiting.code, samtykke: consent, ...(discount ? { rabatt: discount } : {}) }),
  })
    .catch(() => fail(new PayError('network', 'Fikk ikke kontakt med betalingen. Sjekk nettet og prøv igjen.')))
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      const to = res.ok ? vippsAddress(data.url) : null;
      if (!to) return fail(new PayError(data.error ?? 'server', data.message ?? 'Noe gikk galt hos Vipps. Prøv igjen om litt.'));
      waiting.url = to;
      remember(waiting);
      setStore({ payWaiting: { ...waiting } });
      if (tab && !tab.closed) {
        tab.location.href = to;
        closeWhenDone(tab);
      } else {
        await told; // (not before the guests have been told: the page is gone as soon as it is sent)
        location.assign(to);
      }
      check(); // (the first question; the next ones follow by themselves)
      return undefined;
    })
    .finally(() => {
      starting = false;
    });
}
