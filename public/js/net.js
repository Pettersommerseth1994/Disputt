// WebSocket client: auto-reconnect with backoff, session resume, heartbeat and server-clock sync.

import { saveSession, setStore, store, toast } from './store.js';

let ws = null;
let lastMessageAt = Date.now();
let retry = 0;
let retryTimer = null;
let pingTimer = null;
let stopped = false;
const outbox = [];

// serverNow() = Date.now() + clockOffset. Refined by ping round-trips (lowest RTT wins).
let clockOffset = 0;
let bestRtt = Infinity;
export const serverNow = () => Date.now() + clockOffset;

function wsUrl() {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

export function connect() {
  if (stopped) return;
  clearTimeout(retryTimer);
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  setStore({ conn: store.everOpened ? 'closed' : 'connecting' });
  try {
    ws = new WebSocket(wsUrl());
  } catch {
    return scheduleRetry();
  }
  const sock = ws;
  sock.onopen = () => {
    retry = 0;
    bestRtt = Infinity;
    setStore({ conn: 'open', everOpened: true });
    if (store.session) send({ t: 'resume', ...store.session });
    ping();
    clearInterval(pingTimer);
    pingTimer = setInterval(ping, 15000);
    while (outbox.length) sock.send(JSON.stringify(outbox.shift()));
  };
  sock.onmessage = (e) => {
    if (sock !== ws) return; // a socket we already gave up on
    lastMessageAt = Date.now();
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    onMessage(msg);
  };
  sock.onclose = () => {
    if (sock !== ws) return;
    clearInterval(pingTimer);
    if (!stopped) {
      setStore({ conn: 'closed' });
      scheduleRetry();
    }
  };
  sock.onerror = () => {};
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  const delay = Math.min(4000, 400 * 2 ** retry++);
  retryTimer = setTimeout(connect, delay);
}

/** Phones drop sockets when they sleep; reconnect the moment the page is visible / online again. */
export function reconnectNow() {
  if (stopped) return;
  if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
    retry = 0;
    connect();
  } else if (ws.readyState === WebSocket.OPEN) {
    // After a long sleep the socket can look open while being dead. Ask for a pong; if none arrives, start over.
    const asked = Date.now();
    ping();
    setTimeout(() => {
      if (stopped || lastMessageAt >= asked || ws?.readyState !== WebSocket.OPEN) return;
      const dead = ws;
      ws = null; // its handlers now ignore everything
      try {
        dead.close();
      } catch {
        /* already gone */
      }
      retry = 0;
      connect();
    }, 2500);
  }
}

export function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
    return true;
  }
  if (msg.t !== 'ping') outbox.push(msg);
  return false;
}

function ping() {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'ping', c: Date.now() }));
}

function onMessage(msg) {
  switch (msg.t) {
    case 'pong': {
      const rtt = Date.now() - msg.c;
      if (rtt <= bestRtt + 30) {
        bestRtt = Math.min(bestRtt, rtt);
        clockOffset = msg.s + rtt / 2 - Date.now();
      }
      break;
    }
    case 'welcome': {
      const session = { code: msg.code, playerId: msg.playerId, token: msg.token };
      saveSession(session);
      syncClock(msg.view.now);
      if (location.pathname !== '/') history.replaceState(null, '', '/');
      setStore({ session, view: msg.view, joining: null, seats: null, notice: null, route: { page: 'home' } });
      break;
    }
    case 'state':
      syncClock(msg.view.now);
      setStore({ view: msg.view, editing: msg.view.phase === 'lobby' ? store.editing : false });
      break;
    case 'removed': {
      saveSession(null);
      const why = msg.reason === 'kicked' ? 'Verten fjernet deg fra spillet.' : msg.reason === 'not_ready' ? 'Spillet startet før du var klar.' : 'Du er ikke lenger med i spillet.';
      setStore({ session: null, view: null, notice: why, route: { page: 'home' } });
      break;
    }
    case 'closed':
      if (msg.reason === 'replaced') {
        stopped = true;
        setStore({ replaced: true });
      } else {
        saveSession(null);
        setStore({ session: null, view: null, notice: 'Spillet er avsluttet.', route: { page: 'home' } });
      }
      break;
    case 'error':
      onError(msg);
      break;
    default:
  }
}

function syncClock(serverTime) {
  if (bestRtt === Infinity) clockOffset = serverTime - Date.now(); // good enough until the first ping answers
}

function onError(msg) {
  switch (msg.code) {
    case 'bad_token':
    case 'room_not_found':
      forget(store.session ? 'Fant ikke spillet ditt igjen. Start et nytt eller skann koden på nytt.' : msg.message);
      break;
    case 'full':
    case 'busy':
      forget(msg.message);
      break;
    case 'started':
      setStore({ joining: null, seats: { code: store.joining ?? store.route.code, seats: msg.seats ?? [] } });
      break;
    case 'no_session':
      break;
    default:
      toast(msg.message || 'Noe gikk galt.');
  }
}

// ------------------------------------------------------------------ actions used by the screens

export const actions = {
  create: () => send({ t: 'create' }),
  join: (code) => {
    setStore({ joining: code });
    send({ t: 'join', code });
  },
  claim: (code, playerId) => send({ t: 'claim', code, playerId }),
  profile: (name, avatar) => send({ t: 'profile', name, avatar }),
  target: (value) => send({ t: 'target', value }),
  start: () => send({ t: 'start' }),
  select: (index) => send({ t: 'select', index }),
  lock: (index) => send({ t: 'lock', index }),
  setTimer: (seconds) => send({ t: 'timer.set', seconds }),
  addTime: (seconds = 60) => send({ t: 'timer.add', seconds }),
  proceed: () => send({ t: 'continue' }),
  next: () => send({ t: 'next' }),
  skip: () => send({ t: 'skip' }),
  end: () => send({ t: 'end' }),
  again: () => send({ t: 'again' }),
  kick: (id) => send({ t: 'kick', id }),
  leave: () => {
    send({ t: 'leave' });
    forget();
  },
};

/** Forget the stored identity but stay on the current route (used when a QR link points at another room). */
export function dropSession() {
  saveSession(null);
  setStore({ session: null, view: null });
}

/** Drop the local identity and go back to the start screen. */
export function forget(notice = null) {
  saveSession(null);
  setStore({ session: null, view: null, joining: null, seats: null, notice, route: { page: 'home' }, sheet: null });
  if (location.pathname !== '/') history.replaceState(null, '', '/');
}
