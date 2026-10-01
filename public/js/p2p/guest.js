// Peer-to-peer mode, guest side: a WebRTC data channel to the host's phone, shaped like every other "link" the app
// uses ({ send(text), close(), isOpen() }), so net.js does not care what is underneath.

import { PEER_PREFIX, hostPeerId, loadPeer, openPeer } from './peer.js';

let peer = null; // one signalling connection per page, reused when we reconnect to the host
let current = null; // the link being established (peer-level errors are reported against it)

const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');

async function guestPeer(config) {
  const Peer = await loadPeer();
  if (peer && !peer.destroyed) {
    if (!peer.disconnected) return peer;
    peer.reconnect();
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(Object.assign(new Error('Signalling server did not answer'), { kind: 'offline' })), 10000);
      peer.once?.('open', () => (clearTimeout(t), resolve()));
      if (!peer.disconnected) (clearTimeout(t), resolve());
    });
    return peer;
  }
  peer = await openPeer(Peer, `${PEER_PREFIX}g-${randomId()}`, config);
  peer.on('error', (err) => {
    if (err?.type === 'peer-unavailable') current?.fail({ unavailable: true });
  });
  peer.on('disconnected', () => {
    try {
      peer.reconnect();
    } catch {
      /* the next link attempt will deal with it */
    }
  });
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
  try {
    peer?.destroy();
  } catch {
    /* already destroyed */
  }
  peer = null;
}
