// The guest's signalling connection (public/js/p2p/guest.js), driven with a stand-in for PeerJS that behaves the way the
// real one does where it matters: after reconnect() the `disconnected` flag is false at once, but `open` only turns true
// when the broker answers, and an offer sent in between is silently lost.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { openGuestLink, resetGuest } from '../public/js/p2p/guest.js';

class FakePeer extends EventEmitter {
  static made = [];
  static reopenMs = 30; // how long the broker takes to answer after reconnect(); Infinity = it never does
  constructor(id) {
    super();
    this.id = id;
    this.open = false;
    this.disconnected = false;
    this.destroyed = false;
    this.reconnects = [];
    this.offers = []; // each connect(): was the signalling connection open at that moment?
    FakePeer.made.push(this);
    queueMicrotask(() => {
      this.open = true;
      this.emit('open', id);
    });
  }
  off(event, fn) {
    return this.removeListener(event, fn);
  }
  connect(target) {
    const dc = new EventEmitter();
    dc.open = false;
    dc.close = () => {};
    dc.send = () => {};
    this.offers.push({ target, wasOpen: this.open });
    return dc;
  }
  disconnect() {
    if (this.disconnected) return;
    this.disconnected = true;
    this.open = false;
    this.emit('disconnected', this.id);
  }
  reconnect() {
    assert.ok(this.disconnected && !this.destroyed, 'only a disconnected peer can reconnect');
    this.disconnected = false; // like PeerJS: the flag clears at once …
    this.reconnects.push(Date.now());
    if (Number.isFinite(FakePeer.reopenMs)) {
      setTimeout(() => {
        this.open = true; // … `open` only when the broker answers
        this.emit('open', this.id);
      }, FakePeer.reopenMs);
    } else {
      setTimeout(() => this.disconnect(), 10); // the attempt fails
    }
  }
  destroy() {
    this.destroyed = true;
    this.open = false;
  }
}

const handlers = () => ({ onopen() {}, onmessage() {}, onclose() {} });
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  globalThis.Peer = FakePeer;
  FakePeer.made = [];
  FakePeer.reopenMs = 30;
});
afterEach(() => {
  resetGuest();
  delete globalThis.Peer;
  mock.timers.reset();
});

describe('guest signalling', () => {
  it('waits for the signalling connection to be open again before it asks for the host', async () => {
    openGuestLink('ABCD', handlers(), {});
    await tick(5);
    const peer = FakePeer.made[0];
    assert.deepEqual(peer.offers, [{ target: 'disputt1-ABCD', wasOpen: true }]);

    peer.disconnect(); // the phone woke up, the old socket is dead; the first reconnect is already on its way …
    await tick(5);
    assert.equal(peer.disconnected, false);
    assert.equal(peer.open, false, 'reconnecting: not open yet');
    openGuestLink('ABCD', handlers(), {}); // … when the page asks for the host again
    await tick(120);
    assert.equal(peer.offers.length, 2, 'the offer went out');
    assert.equal(peer.offers[1].wasOpen, true, 'only once the broker had answered (an offer sent earlier is dropped)');
  });

  it('gives up with "offline" if the broker never answers, instead of hanging', async () => {
    FakePeer.reopenMs = Infinity;
    openGuestLink('ABCD', handlers(), {});
    await tick(5);
    FakePeer.made[0].disconnect();
    let closed = null;
    mock.timers.enable({ apis: ['setTimeout'] });
    openGuestLink('ABCD', { ...handlers(), onclose: (info) => (closed = info) }, {});
    await Promise.resolve();
    mock.timers.tick(10_500);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(closed?.offline, true);
  });

  it('backs off while the broker cannot be reached: at once, then 1, 2, 4, 8, 8 seconds', async () => {
    openGuestLink('ABCD', handlers(), {});
    await tick(5);
    const peer = FakePeer.made[0];
    FakePeer.reopenMs = Infinity; // every attempt fails
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    peer.disconnect();
    for (let i = 0; i < 40_000; i += 50) mock.timers.tick(50);
    const at = peer.reconnects;
    const gaps = at.slice(1).map((t, i) => t - at[i]);
    assert.ok(at.length >= 6, `kept trying (${at.length} attempts in 40 s)`);
    assert.ok(at.length <= 8, `but not in a tight loop (${at.length} attempts in 40 s)`);
    for (const [i, want] of [1000, 2000, 4000, 8000, 8000].entries()) {
      assert.ok(Math.abs(gaps[i] - want) <= 150, `attempt ${i + 2} came ${gaps[i]} ms after the previous one, wanted about ${want}`);
    }
  });

  it('does not try at all while the browser says it is offline, and carries on when it is back', async () => {
    openGuestLink('ABCD', handlers(), {});
    await tick(5);
    const peer = FakePeer.made[0];
    const online = { onLine: false };
    Object.defineProperty(globalThis, 'navigator', { value: online, configurable: true });
    try {
      mock.timers.enable({ apis: ['setTimeout', 'Date'] });
      peer.disconnect();
      for (let i = 0; i < 30_000; i += 50) mock.timers.tick(50);
      assert.equal(peer.reconnects.length, 0, 'no attempts while offline');
      online.onLine = true;
      for (let i = 0; i < 10_000; i += 50) mock.timers.tick(50);
      assert.ok(peer.reconnects.length >= 1, 'and it reconnects once the network is back');
    } finally {
      delete globalThis.navigator; // back to Node's own
    }
  });
});
