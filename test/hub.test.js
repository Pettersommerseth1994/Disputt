// Hub-level behaviour that needs no real sockets: cleanup of old/abandoned rooms and the capacity guard.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Hub } from '../server/hub.js';

const fakeSocket = () => ({ readyState: 1, sent: [], closed: null, send(m) { this.sent.push(JSON.parse(m)); }, close(code, reason) { this.closed = { code, reason }; } });

function setup() {
  let t = 1_000_000;
  const hub = new Hub({ now: () => t });
  const advance = (ms) => (t += ms);
  const join = (conn, msg) => hub.handle(conn, msg);
  return { hub, advance, join };
}

describe('hub cleanup', () => {
  it('drops rooms after six hours and tells the players', () => {
    const { hub, advance, join } = setup();
    const ws = fakeSocket();
    const conn = { ws, code: null, playerId: null };
    join(conn, { t: 'create' });
    assert.equal(hub.rooms.size, 1);
    advance(5 * 60 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.size, 1, 'still alive after five hours');
    advance(61 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.size, 0);
    assert.deepEqual(ws.sent.at(-1), { t: 'closed', reason: 'expired' });
    assert.equal(ws.closed.reason, 'expired');
  });

  it('drops abandoned rooms (nobody connected) after thirty minutes', () => {
    const { hub, advance, join } = setup();
    const ws = fakeSocket();
    const conn = { ws, code: null, playerId: null };
    join(conn, { t: 'create' });
    hub.close(conn); // the host's phone disconnects
    advance(29 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.size, 1);
    advance(2 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.size, 0);
  });

  it('keeps a room alive while somebody is connected', () => {
    const { hub, advance, join } = setup();
    const conn = { ws: fakeSocket(), code: null, playerId: null };
    join(conn, { t: 'create' });
    advance(3 * 60 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.size, 1);
  });

  it('refuses new rooms when the server is full', () => {
    const { hub, join } = setup();
    for (let i = 0; i < 500; i++) join({ ws: fakeSocket(), code: null, playerId: null }, { t: 'create' });
    const ws = fakeSocket();
    join({ ws, code: null, playerId: null }, { t: 'create' });
    assert.equal(ws.sent.at(-1).code, 'busy');
    assert.equal(hub.rooms.size, 500);
  });

  it('ignores malformed messages without crashing', () => {
    const { hub, join } = setup();
    const ws = fakeSocket();
    const conn = { ws, code: null, playerId: null };
    for (const bad of [null, undefined, 42, 'x', [], {}, { t: 7 }, { t: '__proto__' }, { t: 'join' }, { t: 'join', code: { toString: 1 } }, { t: 'resume', code: 'ABCD' }]) {
      assert.doesNotThrow(() => join(conn, bad));
    }
    join(conn, { t: 'create' });
    for (const bad of [{ t: 'profile', name: { a: 1 }, avatar: 5 }, { t: 'target', value: {} }, { t: 'select', index: 'x' }, { t: 'lock', index: NaN }, { t: 'kick' }, { t: 'timer.set', seconds: 'a' }]) {
      assert.doesNotThrow(() => join(conn, bad));
    }
    assert.equal(hub.rooms.size, 1);
  });
});
