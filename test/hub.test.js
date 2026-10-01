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

  it('drops a lobby that nobody is in after five minutes', () => {
    const { hub, advance, join } = setup();
    const conn = { ws: fakeSocket(), code: null, playerId: null };
    join(conn, { t: 'create' });
    hub.close(conn); // the host's phone disconnects before anyone joined
    advance(4 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.size, 1);
    advance(2 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.size, 0);
  });

  it('keeps a started game for thirty minutes after everybody disconnected (phones come back)', () => {
    const { hub, advance, join } = setup();
    const conns = [0, 1, 2].map(() => ({ ws: fakeSocket(), code: null, playerId: null }));
    join(conns[0], { t: 'create' });
    const code = conns[0].code;
    join(conns[0], { t: 'profile', name: 'A', avatar: 'lime' });
    for (const [i, c] of conns.slice(1).entries()) {
      join(c, { t: 'join', code });
      join(c, { t: 'profile', name: `B${i}`, avatar: ['mandarin', 'blabaer'][i] });
    }
    join(conns[0], { t: 'start' });
    assert.equal(hub.rooms.get(code).room.phase, 'role');
    for (const c of conns) hub.close(c);
    advance(29 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.size, 1);
    advance(2 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.size, 0);
  });

  it('answers a stale tap with a fresh state instead of an error toast', () => {
    const { hub, join } = setup();
    const conns = [0, 1, 2].map(() => ({ ws: fakeSocket(), code: null, playerId: null }));
    join(conns[0], { t: 'create' });
    const code = conns[0].code;
    join(conns[0], { t: 'profile', name: 'A', avatar: 'lime' });
    for (const [i, c] of conns.slice(1).entries()) {
      join(c, { t: 'join', code });
      join(c, { t: 'profile', name: `B${i}`, avatar: ['mandarin', 'blabaer'][i] });
    }
    join(conns[0], { t: 'start' });
    const before = conns[0].ws.sent.length;
    join(conns[0], { t: 'start' }); // double tap: the game is already running
    const after = conns[0].ws.sent.slice(before);
    assert.equal(after.some((m) => m.t === 'error'), false, 'no error toast');
    assert.equal(after.at(-1).t, 'state');
    assert.equal(after.at(-1).view.phase, 'role');
  });

  it('limits how many rooms one connection can open, and frees an empty lobby it leaves behind', () => {
    const { hub, join } = setup();
    const ws = fakeSocket();
    const conn = { ws, code: null, playerId: null };
    for (let i = 0; i < 3; i++) join(conn, { t: 'create' });
    assert.equal(hub.rooms.size, 1, 'each abandoned empty lobby is dropped right away');
    join(conn, { t: 'create' });
    assert.equal(ws.sent.at(-1).code, 'busy');
    assert.equal(hub.rooms.size, 1);
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
