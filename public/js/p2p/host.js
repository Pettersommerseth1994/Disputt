// Peer-to-peer mode, host side. The host's phone *is* the game server: it runs the very same engine as the Node
// server (shared/hub.js) inside the page, and guests connect straight to it over WebRTC.
//
//  - A PeerJS peer named after the room code lets guests find the host (the public PeerJS cloud only introduces
//    phones to each other; game traffic goes directly between them and is encrypted by WebRTC).
//  - The room is saved to sessionStorage after every change, so a reload, or a browser that throws the tab away,
//    does not end the game: the room is restored and guests reconnect with their tokens.
//  - The host's own screen talks to the engine through an in-page "loopback" link.

import { Hub } from '../../shared/hub.js';
import { defaultRandom, makeRoomCode } from '../../shared/util.js';
import { config } from '../settings.js';
import { LIMITS, attachDataConnection } from './adapter.js';
import { hostPeerId, loadPeer, openPeer } from './peer.js';
import { POOL, connectionsToDrop, oldestUnidentified } from './pool.js';
import { clearHostSnapshot, saveHostSnapshot } from './snapshot.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Registers the host's peer id, retrying while an old registration of the same id (a reload) is still releasing. */
async function reservePeer(Peer, code, patientMs) {
  const deadline = Date.now() + patientMs;
  for (;;) {
    try {
      return await openPeer(Peer, hostPeerId(code), config);
    } catch (err) {
      if (Date.now() + 1500 > deadline) throw err;
      await wait(1500);
    }
  }
}

/**
 * Starts hosting. With `restore` (a saved room) the same room code comes back; otherwise a free code is reserved.
 * Rejects with err.kind 'offline' (cannot reach the signalling server) or 'busy' (no free room code found).
 */
export async function startHost({ restore = null } = {}) {
  const Peer = await loadPeer();
  const hub = new Hub({ timings: config.timings ?? undefined });
  let peer = null;
  let code = null;
  let stopped = false;

  if (restore) {
    code = restore.code;
    peer = await reservePeer(Peer, code, 45_000);
    hub.importRoom(restore.room);
  } else {
    for (let attempt = 0; attempt < 8 && !peer; attempt++) {
      const candidate = makeRoomCode(defaultRandom);
      try {
        peer = await openPeer(Peer, hostPeerId(candidate), config);
        code = candidate;
      } catch (err) {
        if (err.kind !== 'taken') throw err;
      }
    }
    if (!peer) throw Object.assign(new Error('No free room code'), { kind: 'busy' });
  }

  // ---- guests
  const connections = new Map(); // dc -> hub connection
  const closeQuietly = (dc) => {
    try {
      dc.close();
    } catch {
      /* already closed */
    }
  };
  const drop = (dc, conn) => {
    closeQuietly(dc);
    hub.close(conn);
    connections.delete(dc);
  };
  const accept = (dc) => {
    // Our pages always use the plain-text channel ('raw'). Anything else is not one of them, and PeerJS would decode
    // binary/JSON payloads (and reassemble chunks) before the adapter's size limit ever gets to look at them.
    if (stopped || dc.serialization !== 'raw') return closeQuietly(dc);
    if (connections.size >= LIMITS.maxConnections) {
      // Full: the oldest connection that never became a player makes room, so half-open connections cannot lock out
      // the phones of real players. If every place belongs to a player, the newcomer waits outside.
      const stale = oldestUnidentified(connections);
      if (!stale) return closeQuietly(dc);
      drop(...stale);
    }
    const conn = attachDataConnection(hub, dc);
    conn.createdAt = Date.now();
    connections.set(dc, conn);
    dc.on('close', () => connections.delete(dc));
  };
  // A phone that vanished (battery, tunnel, tab killed) never closes its channel properly: drop it after a while of
  // silence so it shows up as disconnected and its seat can be taken over. Connections that never say a word go too.
  const reaper = setInterval(() => {
    for (const [dc, conn] of connectionsToDrop(connections, Date.now(), { idleCloseMs: LIMITS.idleCloseMs, helloMs: POOL.helloMs })) drop(dc, conn);
  }, 5000);

  // ---- keeping the signalling connection alive (only new and reconnecting guests need it; open channels do not)
  let reconnectTimer = null;
  let recreating = false;
  const wirePeer = (p) => {
    p.on('connection', accept);
    p.on('disconnected', keepSignalling);
    p.on('close', () => !stopped && p === peer && keepSignalling());
    p.on('error', (err) => {
      if (['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(err?.type)) keepSignalling();
    });
  };
  async function recreate() {
    if (recreating || stopped) return;
    recreating = true;
    try {
      const fresh = await reservePeer(Peer, code, 120_000);
      if (stopped) return fresh.destroy();
      peer = fresh;
      wirePeer(peer);
    } catch {
      reconnectTimer = setTimeout(keepSignalling, 8000);
    } finally {
      recreating = false;
    }
  }
  function keepSignalling() {
    if (stopped) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (stopped) return;
      if (peer.destroyed) return recreate();
      if (peer.disconnected) {
        try {
          peer.reconnect();
        } catch {
          /* try again below */
        }
        reconnectTimer = setTimeout(keepSignalling, 5000);
      }
    }, 1500);
  }
  /**
   * After a long sleep, or a switch between Wi-Fi and mobile data, the signalling socket can look open to the browser
   * while the broker dropped our id long ago (nothing on a dead TCP connection says so). New and returning guests would
   * then get "game not found" while the host's own screen looks fine. So on waking up, drop the socket and open a fresh
   * one: the same token claims the same id again. Open data channels to guests are not touched.
   */
  function refreshSignalling() {
    if (stopped || recreating) return;
    if (!peer || peer.destroyed) return keepSignalling();
    try {
      peer.disconnect();
      peer.reconnect();
    } catch {
      /* the usual retry loop below picks it up */
    }
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(keepSignalling, 5000);
  }
  let hiddenAt = null;
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
    hiddenAt = null;
    if (away > 15_000) refreshSignalling(); // short blinks (a notification, the app switcher) leave the socket alone
  };
  document.addEventListener('visibilitychange', onVisibility);
  addEventListener('online', refreshSignalling);
  wirePeer(peer);

  // ---- engine clock and persistence
  const tickTimer = setInterval(() => hub.tick(), 100);
  const sweepTimer = setInterval(() => hub.sweep(), 60_000);
  let persistTimer = null;
  const persistNow = () => {
    clearTimeout(persistTimer);
    persistTimer = null;
    const room = hub.exportRoom(code);
    if (room) saveHostSnapshot(code, room);
  };
  hub.onChange = () => {
    persistTimer ??= setTimeout(persistNow, 300);
  };
  const onHide = () => document.visibilityState === 'hidden' && persistNow();
  document.addEventListener('visibilitychange', onHide);
  addEventListener('pagehide', persistNow);

  return {
    code,
    hub,

    /** A link for the host's own screen: messages go straight into the engine and back, no network involved. */
    openLink(handlers, { create = false } = {}) {
      let open = true;
      const conn = { ws: null, code: null, playerId: null };
      conn.ws = {
        readyState: 1,
        send: (text) => queueMicrotask(() => open && handlers.onmessage(text)),
        close: () => {
          open = false;
        },
      };
      queueMicrotask(() => {
        if (!open) return;
        handlers.onopen();
        if (create) hub.createWithCode(conn, code);
      });
      return {
        isOpen: () => open,
        send: (text) =>
          queueMicrotask(() => {
            if (!open) return;
            try {
              hub.handle(conn, JSON.parse(text));
            } catch {
              /* malformed: ignore */
            }
          }),
        close: () => {
          if (!open) return;
          open = false;
          hub.close(conn);
        },
      };
    },

    /** Called when the phone wakes up: make sure new guests can still find us. */
    ensureOnline: keepSignalling,

    /** Ends the game for everybody and forgets the saved room. */
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(tickTimer);
      clearInterval(sweepTimer);
      clearInterval(reaper);
      clearTimeout(persistTimer);
      clearTimeout(reconnectTimer);
      document.removeEventListener('visibilitychange', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
      removeEventListener('online', refreshSignalling);
      removeEventListener('pagehide', persistNow);
      hub.closeAll('expired'); // tells the guests the game is over
      for (const dc of connections.keys()) {
        try {
          dc.close();
        } catch {
          /* already closed */
        }
      }
      try {
        peer.destroy();
      } catch {
        /* already destroyed */
      }
      clearHostSnapshot();
    },
  };
}
