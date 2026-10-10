// Hosting a game that is played on ONE phone (bilturmodus): the engine runs in this page, and that is all there is. Nobody joins
// from another phone, so there is no peer-to-peer connection to make, no room code to reserve with a service, and no network to
// depend on: it can be played on a car trip with no coverage.
//
// It keeps the two things that p2p/host.js does for the same reasons: the room is saved after every change (a reload, or a
// browser that throws the tab away, then continues the game), and the host's own screen talks to the engine through an in-page
// "loopback" link. It has none of the network parts, and offers the same few functions to net.js, so net.js treats it as a host.
// (A file of its own: pages are cached for ten minutes, and p2p/host.js has guests on it.)

import { Hub } from '../../shared/hub.js';
import { defaultRandom, makeRoomCode } from '../../shared/util.js';
import { config } from '../settings.js';
import { clearHostSnapshot, saveHostSnapshot } from './snapshot.js';

/** Starts hosting. With `restore` (a saved room) the same game comes back; otherwise a room code is made up (nobody needs to type it). */
export function startLocalHost({ restore = null } = {}) {
  const hub = new Hub({ timings: config.timings ?? undefined });
  let stopped = false;
  let code;
  if (restore) {
    code = restore.code;
    hub.importRoom(restore.room);
  } else {
    code = makeRoomCode(defaultRandom);
  }

  // ---- engine clock and persistence
  const tickTimer = setInterval(() => hub.tick(), 100);
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
    local: true,

    /** A link for the host's own screen: messages go straight into the engine and back, no network involved. */
    openLink(handlers, { create = false, mode = 'car' } = {}) {
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
        if (create) hub.createWithCode(conn, code, mode);
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

    /** (There is no signalling connection to look after.) */
    ensureOnline() {},

    /** (There are no guests to tell that the host is away for a moment.) */
    announce() {
      return 0;
    },

    /** Ends the game and forgets the saved room. */
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(tickTimer);
      clearTimeout(persistTimer);
      document.removeEventListener('visibilitychange', onHide);
      removeEventListener('pagehide', persistNow);
      hub.closeAll('expired');
      clearHostSnapshot();
    },
  };
}
