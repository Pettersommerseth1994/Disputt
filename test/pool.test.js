// Which of the host's data channels get closed, and which one makes room when the host is full (public/js/p2p/pool.js).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIMITS } from '../public/js/p2p/adapter.js';
import { POOL, connectionsToDrop, oldestUnidentified } from '../public/js/p2p/pool.js';

const conn = (over) => ({ createdAt: 0, lastSeen: 0, playerId: null, ...over });
const pool = (...entries) => new Map(entries.map((c, i) => [`dc${i}`, c]));
const names = (pairs) => pairs.map(([dc]) => dc);
const limits = { idleCloseMs: LIMITS.idleCloseMs, helloMs: POOL.helloMs };

describe('connectionsToDrop', () => {
  it('closes a phone that has been silent for longer than its pings allow', () => {
    const now = 100_000;
    const c = pool(
      conn({ createdAt: 10_000, lastSeen: now - LIMITS.idleCloseMs - 1, playerId: 'a' }), // gone
      conn({ createdAt: 10_000, lastSeen: now - 15_000, playerId: 'b' }), // one missed ping: still fine
    );
    assert.deepEqual(names(connectionsToDrop(c, now, limits)), ['dc0']);
  });

  it('closes a connection that never sent a single message, after the hello window', () => {
    const now = 100_000;
    const c = pool(
      conn({ createdAt: now - POOL.helloMs - 1, lastSeen: now - POOL.helloMs - 1 }), // half-open, or somebody who only knows the code
      conn({ createdAt: now - 5_000, lastSeen: now - 5_000 }), // just connected: give it time to say hello
      conn({ createdAt: now - 20_000, lastSeen: now - 2_000 }), // has spoken
    );
    assert.deepEqual(names(connectionsToDrop(c, now, limits)), ['dc0']);
  });

  it('leaves everything alone when all is well', () => {
    const now = 100_000;
    assert.deepEqual(connectionsToDrop(pool(conn({ createdAt: 1, lastSeen: now - 1000, playerId: 'a' })), now, limits), []);
  });
});

describe('oldestUnidentified', () => {
  it('picks the oldest connection that is not a player yet, never a player', () => {
    const c = pool(conn({ createdAt: 1, playerId: 'host' }), conn({ createdAt: 50 }), conn({ createdAt: 20 }), conn({ createdAt: 5, playerId: 'p2' }));
    assert.equal(oldestUnidentified(c)[0], 'dc2');
  });

  it('returns null when every place belongs to a player: nobody gets crowded out', () => {
    const c = pool(conn({ playerId: 'a' }), conn({ playerId: 'b' }));
    assert.equal(oldestUnidentified(c), null);
    assert.equal(oldestUnidentified(new Map()), null);
  });
});
