// Housekeeping for the host's data channels: which ones to close, and which one makes room for a newcomer.
// Pure functions (no PeerJS, no timers) so Node can test them. A connection here is what adapter.js hands back:
// { lastSeen, playerId, … } plus `createdAt`, which host.js stamps when the channel is accepted.
// (A new file rather than new exports in adapter.js: browsers may hold older copies of the other modules in their
// cache for a few minutes after a deploy, and a module that imports something the cached copy lacks does not load.)

export const POOL = Object.freeze({
  // A phone that has not sent one single message this long after connecting is not one of our players: a half-open
  // connection (or somebody who only knows the room code) must not hold a place for long.
  helloMs: 15_000,
});

/** [dc, conn] pairs to close now: silent for too long (a vanished phone), or never said a word since connecting. */
export function connectionsToDrop(connections, now, { idleCloseMs, helloMs = POOL.helloMs }) {
  const out = [];
  for (const [dc, conn] of connections) {
    const neverSpoke = conn.lastSeen <= conn.createdAt; // every message moves lastSeen on
    if (now - conn.lastSeen > idleCloseMs || (neverSpoke && now - conn.createdAt > helloMs)) out.push([dc, conn]);
  }
  return out;
}

/** When the pool is full: the oldest connection that has not become a player, or null if every place is a player's. */
export function oldestUnidentified(connections) {
  let pick = null;
  for (const [dc, conn] of connections) {
    if (conn.playerId) continue;
    if (!pick || conn.createdAt < pick[1].createdAt) pick = [dc, conn];
  }
  return pick;
}
