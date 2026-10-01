// Talking to whoever runs the game: auto-reconnect with backoff, session resume, heartbeat and clock sync.
//
// Underneath sits a "link": one live channel with { send(text), close(), isOpen() }. There are three kinds, and the
// rest of the app neither knows nor cares which one it has:
//   - server mode:      a WebSocket to the Node server                        (config.mode === 'server')
//   - p2p, as a guest:  a WebRTC data channel to the host's phone             (config.mode === 'p2p')
//   - p2p, as the host: an in-page loopback to the engine running in this page

import { goHome } from './paths.js';
import { loadHostSnapshot } from './p2p/snapshot.js';
import { openGuestLink, resetGuest } from './p2p/guest.js';
import { config, isP2P } from './settings.js';
import { saveSession, setStore, store, toast } from './store.js';

let link = null;
let linkState = 'idle'; // idle | connecting | open
let generation = 0; // bumped for every new link, so a link we gave up on can no longer change anything
let host = null; // p2p: the host controller, only while this page runs the game
let lastMessageAt = Date.now();
let retry = 0;
let unreachable = 0; // p2p: consecutive times the host's phone could not be found
let retryTimer = null;
let pingTimer = null;
let stopped = false;
const outbox = [];

const UNREACHABLE_LIMIT = 15; // ~1 minute of backoff: long enough for a host who is reloading, short enough to give up

// serverNow() = Date.now() + clockOffset. Refined by ping round-trips (lowest RTT wins).
let clockOffset = 0;
let bestRtt = Infinity;
export const serverNow = () => Date.now() + clockOffset;

// ------------------------------------------------------------------ links

function openSocketLink(handlers) {
  const url = config.serverUrl ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  const ws = new WebSocket(url);
  ws.onopen = () => handlers.onopen();
  ws.onmessage = (e) => handlers.onmessage(e.data);
  ws.onclose = () => handlers.onclose({});
  ws.onerror = () => {};
  return {
    isOpen: () => ws.readyState === WebSocket.OPEN,
    send: (text) => ws.send(text),
    close: () => {
      try {
        ws.close();
      } catch {
        /* already gone */
      }
    },
  };
}

const handlersFor = (gen) => ({
  onopen: () => gen === generation && handleOpen(),
  onmessage: (text) => {
    if (gen !== generation) return;
    lastMessageAt = Date.now();
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    onMessage(msg);
  },
  onclose: (info = {}) => gen === generation && handleClose(info),
});

function handleOpen() {
  linkState = 'open';
  retry = 0;
  unreachable = 0;
  bestRtt = Infinity;
  setStore({ conn: 'open', everOpened: true, stuck: 0 });
  if (store.session) rawSend({ t: 'resume', ...store.session });
  // A join sent on a link that died before the welcome arrived is sent again, exactly once.
  for (let i = outbox.length - 1; i >= 0; i--) if (outbox[i].t === 'join') outbox.splice(i, 1);
  if (store.joining && !store.session) outbox.unshift({ t: 'join', code: store.joining });
  ping();
  clearInterval(pingTimer);
  pingTimer = setInterval(ping, 15000);
  while (outbox.length) rawSend(outbox.shift());
}

function handleClose(info) {
  linkState = 'idle';
  link = null;
  clearInterval(pingTimer);
  if (stopped) return;
  if (info.unavailable) {
    // p2p: nobody is hosting that room right now
    unreachable++;
    if (!store.session) return forget('Fant ikke dette spillet. Sjekk koden, og at verten har siden åpen.');
    if (unreachable > UNREACHABLE_LIMIT) return forget('Verten er ikke å nå lenger, så spillet er trolig avsluttet.');
  }
  // p2p: the host was found but no line could be set up (timeout), or the introduction service did not answer (offline)
  setStore({ conn: 'closed', stuck: info.timeout || info.offline ? store.stuck + 1 : store.stuck });
  scheduleRetry();
}

function rawSend(msg) {
  try {
    link.send(JSON.stringify(msg));
    return true;
  } catch {
    return false;
  }
}

/** Throws away the current link and everything hanging off it (the p2p host's engine and peer connection). */
function teardown() {
  generation++; // whatever the old link still says is ignored from now on
  clearInterval(pingTimer);
  clearTimeout(retryTimer);
  linkState = 'idle';
  try {
    link?.close();
  } catch {
    /* already gone */
  }
  link = null;
  if (host) {
    host.stop();
    host = null;
  }
  resetGuest();
  outbox.length = 0;
}

// ------------------------------------------------------------------ connecting

export function connect() {
  if (stopped) return;
  clearTimeout(retryTimer);
  if (linkState !== 'idle') return;
  if (isP2P) return void connectP2P();
  setStore({ conn: store.everOpened ? 'closed' : 'connecting' });
  linkState = 'connecting';
  try {
    link = openSocketLink(handlersFor(++generation));
  } catch {
    linkState = 'idle';
    scheduleRetry();
  }
}

/** p2p mode connects per room: there is nothing to connect to until we have a room code. */
async function connectP2P() {
  const session = store.session;
  const code = session?.code ?? store.joining;
  if (!code) {
    setStore({ conn: 'open', everOpened: true }); // idle on the start screen
    return;
  }
  setStore({ conn: store.everOpened ? 'closed' : 'connecting' });
  linkState = 'connecting';
  const gen = ++generation;
  try {
    const snapshot = session ? loadHostSnapshot(session.code) : null;
    if (host?.code === code || snapshot) {
      // this page hosts the game (it was reloaded, or the browser threw the tab away): bring the room back
      if (!host) {
        const { startHost } = await import('./p2p/host.js');
        const started = await startHost({ restore: snapshot });
        if (gen !== generation) return started.stop();
        host = started;
      }
      link = host.openLink(handlersFor(gen));
    } else {
      link = openGuestLink(code, handlersFor(gen), config);
    }
  } catch (err) {
    if (gen !== generation) return;
    handleClose({ offline: true, error: err });
  }
}

async function createP2PRoom() {
  teardown();
  const gen = ++generation;
  linkState = 'connecting';
  setStore({ creating: true, conn: 'connecting' });
  try {
    const { startHost } = await import('./p2p/host.js');
    const started = await startHost();
    if (gen !== generation) return started.stop();
    host = started;
    link = host.openLink(handlersFor(gen), { create: true }); // creates the room and answers with `welcome`
  } catch (err) {
    if (gen !== generation) return;
    linkState = 'idle';
    setStore({ creating: false, conn: 'open' });
    toast(
      err?.kind === 'busy'
        ? 'Fant ingen ledig spillkode akkurat nå. Prøv igjen.'
        : 'Får ikke kontakt med tjenesten som kobler telefonene sammen. Sjekk nettet og prøv igjen.',
    );
  }
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  const delay = Math.min(4000, 400 * 2 ** retry++);
  retryTimer = setTimeout(connect, delay);
}

/** Phones drop connections when they sleep; reconnect the moment the page is visible / online again. */
export function reconnectNow() {
  if (stopped) return;
  host?.ensureOnline(); // p2p host: new and returning guests need the signalling server
  if (linkState === 'idle') {
    retry = 0;
    connect();
  } else if (linkState === 'open' && link?.isOpen()) {
    // After a long sleep a link can look open while being dead. Ask for a pong; if none arrives, start over.
    const asked = Date.now();
    ping();
    setTimeout(() => {
      if (stopped || lastMessageAt >= asked || linkState !== 'open' || !link?.isOpen()) return;
      const dead = link;
      generation++; // its callbacks now ignore everything
      link = null;
      linkState = 'idle';
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
  if (linkState === 'open' && link?.isOpen() && rawSend(msg)) return true;
  if (msg.t !== 'ping') outbox.push(msg);
  return false;
}

function ping() {
  if (linkState === 'open' && link?.isOpen()) rawSend({ t: 'ping', c: Date.now() });
}

// ------------------------------------------------------------------ messages from the game

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
      goHome();
      setStore({ session, view: msg.view, joining: null, seats: null, notice: null, creating: false, route: { page: 'home' } });
      break;
    }
    case 'state': {
      syncClock(msg.view.now);
      // A new round starts with the role reveal: nothing (rules, QR, scoreboard) may be open on top of it.
      const newRound = msg.view.phase === 'role' && store.view?.phase !== 'role';
      setStore({ view: msg.view, editing: msg.view.phase === 'lobby' ? store.editing : false, sheet: newRound ? null : store.sheet });
      break;
    }
    case 'removed': {
      saveSession(null);
      if (isP2P) teardown(); // the room is gone for us; the link to its host must not linger
      const why =
        msg.reason === 'left'
          ? null // you chose to leave: no explanation needed
          : msg.reason === 'kicked'
            ? 'Verten fjernet deg fra spillet.'
            : msg.reason === 'not_ready'
              ? 'Spillet startet før du var klar.'
              : 'Du er ikke lenger med i spillet.';
      setStore({ session: null, view: null, notice: why, route: { page: 'home' }, conn: isP2P ? 'open' : store.conn });
      break;
    }
    case 'closed':
      if (msg.reason === 'replaced') {
        stopped = true;
        setStore({ replaced: true });
      } else {
        saveSession(null);
        if (isP2P) teardown();
        setStore({ session: null, view: null, notice: 'Spillet er avsluttet.', route: { page: 'home' }, conn: isP2P ? 'open' : store.conn });
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
  create: () => {
    if (isP2P) return void createP2PRoom();
    return send({ t: 'create' });
  },
  join: (code) => {
    setStore({ joining: code, stuck: 0 });
    if (isP2P) {
      teardown();
      connect(); // p2p connects to this particular room
    } else {
      send({ t: 'join', code });
    }
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
  if (isP2P) teardown();
  setStore({ session: null, view: null });
}

/** Drop the local identity and go back to the start screen. */
export function forget(notice = null) {
  saveSession(null);
  if (isP2P) {
    // leaving a room means letting go of its link; a hosting page also ends the game for everybody
    teardown();
    setStore({ conn: 'open', everOpened: true });
  }
  setStore({ session: null, view: null, joining: null, seats: null, notice, route: { page: 'home' }, sheet: null, creating: false, stuck: 0 });
  goHome();
}
