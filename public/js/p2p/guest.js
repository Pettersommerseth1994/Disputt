// Peer-to-peer mode, guest side: a WebRTC data channel to the host's phone, shaped like every other "link" the app
// uses ({ send(text), close(), isOpen() }), so net.js does not care what is underneath.

import { PEER_PREFIX, hostPeerId, loadPeer, openPeer } from './peer.js';

let peer = null; // one signalling connection per page, reused when we reconnect to the host
let current = null; // the link being established (peer-level errors are reported against it)
let backoffMs = 0; // wait before the next signalling reconnect: none at first, then 1, 2, 4, 8 s while it keeps failing
let backoffTimer = null;
let listening = false;

const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');

/** Waits until the signalling connection is open. PeerJS silently drops an offer sent before that. */
function whenOpen(p, ms = 10_000) {
  return new Promise((resolve, reject) => {
    if (p.open) return resolve();
    const onOpen = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      p.off?.('open', onOpen);
      reject(Object.assign(new Error('Signalling server did not answer'), { kind: 'offline' }));
    }, ms);
    p.once('open', onOpen);
  });
}

/** Reconnects the signalling socket after it dropped. Patiently: offline, a tight loop hammers the broker and the battery. */
function scheduleReconnect() {
  clearTimeout(backoffTimer);
  const wait = backoffMs;
  backoffMs = Math.min(8000, backoffMs ? backoffMs * 2 : 1000);
  backoffTimer = setTimeout(() => {
    if (!peer || peer.destroyed || !peer.disconnected) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return scheduleReconnect(); // nothing to reach yet
    try {
      peer.reconnect();
    } catch {
      /* the next link attempt will deal with it */
    }
  }, wait);
}

const backOnline = () => {
  backoffMs = 0;
  if (peer?.disconnected) scheduleReconnect();
};

async function guestPeer(config) {
  const Peer = await loadPeer();
  if (peer && !peer.destroyed) {
    if (peer.disconnected) {
      backoffMs = 0;
      try {
        peer.reconnect();
      } catch {
        /* whenOpen below reports it if nothing comes of it */
      }
    }
    // Reconnecting takes a moment (and `disconnected` is already false by then): an offer sent now would be lost.
    await whenOpen(peer);
    return peer;
  }
  peer = await openPeer(Peer, `${PEER_PREFIX}g-${randomId()}`, config);
  peer.on('open', () => {
    backoffMs = 0;
  });
  peer.on('error', (err) => {
    if (err?.type === 'peer-unavailable') current?.fail({ unavailable: true });
  });
  peer.on('disconnected', scheduleReconnect);
  if (!listening && typeof addEventListener === 'function') {
    listening = true;
    addEventListener('online', backOnline);
  }
  return peer;
}

/** Connects to the host of room `code`. handlers: onopen(), onmessage(text), onclose({ unavailable?, offline? }). */
export function openGuestLink(code, handlers, config) {
  let dc = null;
  let finished = false;
  let opened = false;
  let timer = null;

  const fail = (info = {}) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (current === link) current = null;
    try {
      dc?.close();
    } catch {
      /* already closed */
    }
    handlers.onclose(info);
  };

  const link = {
    isOpen: () => Boolean(dc?.open) && !finished,
    send: (text) => dc.send(text),
    close: () => {
      finished = true;
      clearTimeout(timer);
      if (current === link) current = null;
      try {
        dc?.close();
      } catch {
        /* already closed */
      }
    },
    fail,
  };

  (async () => {
    try {
      const p = await guestPeer(config);
      if (finished) return;
      current = link;
      dc = p.connect(hostPeerId(code), { reliable: true, serialization: 'raw' });
      timer = setTimeout(() => !opened && fail({ timeout: true }), 15000);
      dc.on('open', () => {
        if (finished) return;
        opened = true;
        clearTimeout(timer);
        if (current === link) current = null;
        handlers.onopen();
      });
      dc.on('data', (data) => !finished && handlers.onmessage(typeof data === 'string' ? data : new TextDecoder().decode(data)));
      dc.on('close', () => fail({}));
      dc.on('error', () => {});
    } catch (err) {
      fail({ offline: true, error: err });
    }
  })();

  return link;
}

/** Drops the signalling connection (leaving a room for good). */
export function resetGuest() {
  current = null;
  clearTimeout(backoffTimer);
  backoffMs = 0;
  try {
    peer?.destroy();
  } catch {
    /* already destroyed */
  }
  peer = null;
}
