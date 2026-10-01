// The peer-to-peer host feeds WebRTC data channels into the game hub. These tests use a fake channel to check the
// guards that keep one misbehaving phone from hurting the game: only small JSON strings get through, floods are cut off.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIMITS, attachDataConnection } from '../public/js/p2p/adapter.js';

class FakeChannel {
  constructor() {
    this.open = true;
    this.sent = [];
    this.handlers = {};
  }
  on(event, fn) {
    (this.handlers[event] ??= []).push(fn);
  }
  emit(event, ...args) {
    for (const fn of this.handlers[event] ?? []) fn(...args);
  }
  send(text) {
    if (!this.open) throw new Error('channel closed');
    this.sent.push(text);
  }
  close() {
    this.open = false;
    this.emit('close');
  }
}

const fakeHub = () => ({ handled: [], closed: [], handle(conn, msg) { this.handled.push(msg); }, close(conn) { this.closed.push(conn); } });

describe('data channel adapter', () => {
  it('passes valid JSON messages to the hub, tagged with the same connection', () => {
    const hub = fakeHub();
    const dc = new FakeChannel();
    const conn = attachDataConnection(hub, dc);
    dc.emit('data', JSON.stringify({ t: 'ping', c: 1 }));
    dc.emit('data', JSON.stringify({ t: 'join', code: 'ABCD' }));
    assert.deepEqual(hub.handled, [{ t: 'ping', c: 1 }, { t: 'join', code: 'ABCD' }]);
    assert.equal(conn.code, null);
  });

  it('ignores anything that is not a small JSON string', () => {
    const hub = fakeHub();
    const dc = new FakeChannel();
    attachDataConnection(hub, dc);
    dc.emit('data', 'not json');
    dc.emit('data', new Uint8Array([1, 2, 3]));
    dc.emit('data', { t: 'join' }); // objects are not allowed on the wire, only text
    dc.emit('data', JSON.stringify({ t: 'x', pad: 'a'.repeat(LIMITS.maxMessageChars) }));
    dc.emit('data', 42);
    assert.deepEqual(hub.handled, []);
  });

  it('cuts off floods but recovers once the burst has drained', () => {
    const hub = fakeHub();
    const dc = new FakeChannel();
    let t = 1_000_000;
    attachDataConnection(hub, dc, { now: () => t });
    for (let i = 0; i < 100; i++) dc.emit('data', JSON.stringify({ t: 'ping', c: i }));
    assert.equal(hub.handled.length, LIMITS.burst, 'only the burst allowance gets through at once');
    t += 2000; // two seconds later: perSecond * 2 more tokens
    for (let i = 0; i < 100; i++) dc.emit('data', JSON.stringify({ t: 'ping', c: i }));
    assert.equal(hub.handled.length, LIMITS.burst + Math.floor(LIMITS.perSecond * 2));
  });

  it('tells the hub when the channel closes, and mirrors its state as a WebSocket would', () => {
    const hub = fakeHub();
    const dc = new FakeChannel();
    const conn = attachDataConnection(hub, dc);
    assert.equal(conn.ws.readyState, 1);
    conn.ws.send('hei');
    assert.deepEqual(dc.sent, ['hei']);
    dc.close();
    assert.equal(conn.ws.readyState, 3);
    assert.equal(hub.closed.length, 1);
    assert.equal(hub.closed[0], conn);
    assert.doesNotThrow(() => conn.ws.send('too late'), 'sending on a closed channel is swallowed, not thrown');
    assert.doesNotThrow(() => conn.ws.close());
  });

  it('remembers when it last heard from the phone (for the idle reaper)', () => {
    const hub = fakeHub();
    const dc = new FakeChannel();
    let t = 5000;
    const conn = attachDataConnection(hub, dc, { now: () => t });
    assert.equal(conn.lastSeen, 5000);
    t = 9000;
    dc.emit('data', JSON.stringify({ t: 'ping', c: 1 }));
    assert.equal(conn.lastSeen, 9000);
  });
});
