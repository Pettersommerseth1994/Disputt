import { App } from './app.js';
import { actions, connect, dropSession, reconnectNow } from './net.js';
import { html, render } from './vendor/htm-preact.js';
import { setStore, store } from './store.js';

// QR-code link (/j/ABCD): join that room, unless this tab already belongs to it (then we simply resume).
if (store.route.page === 'join') {
  if (store.session && store.session.code !== store.route.code) dropSession();
  if (!store.session) actions.join(store.route.code);
}

const debug = new URLSearchParams(location.search).get('debug'); // QA only: ?debug (hook) or ?debug=offline (no socket)
if (debug !== 'offline') connect();

// Phones sleep and drop sockets: come back to life as soon as the page is visible or online again.
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reconnectNow());
window.addEventListener('online', reconnectNow);
window.addEventListener('pageshow', (e) => e.persisted && reconnectNow());

fetch('/api/info')
  .then((r) => r.json())
  .then((info) => setStore({ info }))
  .catch(() => {});

// Dev/QA hook: lets screenshots and tests inject a view without a game.
if (debug !== null) window.__disputt = { store, setStore };

const root = document.getElementById('app');
root.replaceChildren(); // drop the boot splash; Preact would otherwise leave it in place below the app
render(html`<${App} />`, root);
