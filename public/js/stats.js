// Counting what happens in the game, without counting anybody: «a game was made, in Danish, in the car». The page tells the payment
// server (POST /e, payments/worker-shopify.js), which adds one to that day's count. No cookies, no id, no names, no game codes:
// nothing that tells one phone from another (docs/STATS.md). Nothing is sent when the browser says «do not track», on a local
// machine, or while payments are off (there is no server to tell then).
// (A file of its own: pages are cached for ten minutes ...)

import { getLang } from './i18n/lang.js';
import { whenReady } from './pay/payments.js';
import { store } from './store.js';

const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|.*\.localhost|.*\.test)$/i;

/** Is the visitor not to be counted? (Do Not Track and Global Privacy Control are honoured, and so is a development machine.) */
export function optedOut(nav = globalThis.navigator, loc = globalThis.location) {
  if (nav?.doNotTrack === '1' || nav?.globalPrivacyControl === true) return true;
  return LOCAL.test(loc?.hostname ?? '');
}

/** What is sent: the event, the language, and (when they matter for it) the way to play, the package and the way to pay. */
export const statsBody = (name, { m = '', p = '', x = '' } = {}, lang = getLang()) => JSON.stringify({ n: name, l: lang, m, p, x });

/** Tells the payment server that `name` happened. Never throws and never waits for an answer: counting must not get in the way of the game. */
export function track(name, extra = {}) {
  try {
    if (optedOut()) return;
    whenReady()
      .then(() => {
        const api = store.payments?.apiUrl;
        if (!api) return;
        // (text/plain: a "simple" request, so the browser does not ask first; keepalive: it goes out even when the page is closing)
        return fetch(`${api}/e`, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: statsBody(name, extra), keepalive: true, credentials: 'omit' });
      })
      .catch(() => {});
  } catch {
    /* counting is never worth a broken game */
  }
}
