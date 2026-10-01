// Makes a WebRTC data channel look like the WebSocket the game hub talks to, with the same abuse guards the Node
// server applies: small messages only, and a flood limit per connection. Pure logic, so it is testable in Node.

export const LIMITS = Object.freeze({
  maxMessageChars: 4096, // same as the WebSocket server's maxPayload
  burst: 30, // a human never sends this many messages at once…
  perSecond: 15, // …or this many per second, on average
  maxConnections: 24, // a room holds at most 10 players; a few spare for reconnecting phones
  // WebRTC notices a vanished phone slowly (no TCP close). Phones ping every 15 s, so silence this long means it is gone.
  idleCloseMs: 35_000,
});

/**
 * Wires `dc` (a PeerJS DataConnection, or anything with on/send/close/open) to `hub`.
 * Returns the hub connection object ({ ws, code, playerId }).
 */
export function attachDataConnection(hub, dc, { limits = LIMITS, now = Date.now } = {}) {
  const conn = {
    ws: {
      get readyState() {
        return dc.open ? 1 : 3; // WebSocket.OPEN / CLOSED
      },
      send(text) {
        try {
          dc.send(text);
        } catch {
          /* the channel closed under us; its close handler cleans up */
        }
      },
      close() {
        try {
          dc.close();
        } catch {
          /* already closed */
        }
      },
    },
    code: null,
    playerId: null,
    lastSeen: now(),
  };

  let tokens = limits.burst;
  let last = now();
  dc.on('data', (data) => {
    const t = now();
    conn.lastSeen = t;
    tokens = Math.min(limits.burst, tokens + ((t - last) / 1000) * limits.perSecond);
    last = t;
    if (tokens < 1) return;
    tokens -= 1;
    if (typeof data !== 'string' || data.length > limits.maxMessageChars) return;
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    hub.handle(conn, msg);
  });
  dc.on('close', () => hub.close(conn));
  dc.on('error', () => {});
  return conn;
}
