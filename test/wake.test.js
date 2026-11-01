// Keeping the screen awake (public/js/wake.js): the wake lock where there is one, otherwise a silent video that waits for the first touch.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { beforeEach, describe, it } from 'node:test';
import { awakeState, awakeWanted, rememberAwakeWanted, startAwake } from '../public/js/wake.js';

/** A pretend page: a body to put the video in, events, and a video that only plays after a touch (like a phone's browser). */
function pretendPage({ lock = 'granted', touched = false, apple = false } = {}) {
  const listeners = new Map();
  const doc = {
    visibilityState: 'visible',
    body: { children: [], append(el) { this.children.push(el); el.parent = this; } },
    createElement: () => {
      const el = {
        attrs: {}, style: {}, paused: true, muted: false, loop: false, src: '',
        setAttribute(k, v) { this.attrs[k] = v; },
        async play() { if (!doc.touched) throw new DOMException('Not allowed', 'NotAllowedError'); this.paused = false; },
        pause() { this.paused = true; },
        remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); },
      };
      return el;
    },
    addEventListener: (type, fn) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
    removeEventListener: (type, fn) => listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn)),
    touched,
    touch() { doc.touched = true; for (const fn of listeners.get('pointerdown') ?? []) fn(); },
    count: (type) => (listeners.get(type) ?? []).length,
    fire(type) { for (const fn of listeners.get(type) ?? []) fn(); },
  };
  const released = [];
  const granted = []; // the locks that were handed out, so that a test can make the phone let go of one
  const mouth = (l) => (type, fn) => type === 'release' && (l.onrelease = fn);
  const navigator = {
    ...(apple ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1' } : {}),
    ...(lock === 'missing' ? {} : { wakeLock: { request: async () => { if (lock === 'denied') throw new DOMException('Denied', 'NotAllowedError'); const l = { release: async () => released.push(1) }; l.addEventListener = mouth(l); granted.push(l); return l; } } }),
  };
  return { env: { document: doc, navigator, src: '/assets/awake/blank.mp4' }, doc, released, granted };
}
const tick = () => new Promise((r) => setTimeout(r, 5));

describe('the wake lock', () => {
  it('is used when the browser has it, and let go of when the game is over', async () => {
    const page = pretendPage();
    const awake = startAwake({ wanted: true, env: page.env });
    await tick();
    assert.equal(awakeState(), 'api');
    assert.equal(page.doc.body.children.length, 0, 'and no video is needed');
    awake.stop();
    assert.deepEqual(page.released, [1]);
    assert.equal(awakeState(), 'idle');
  });
});

describe('an iPhone (Chrome there is Safari underneath)', () => {
  it('gets the wake lock AND the video, because a lock that is granted there may keep nothing awake', async () => {
    const page = pretendPage({ apple: true, touched: true });
    const awake = startAwake({ wanted: true, env: page.env });
    await tick();
    assert.equal(page.doc.body.children.length, 1, 'a video is put in the page although the lock was granted');
    assert.equal(page.doc.body.children[0].paused, false);
    assert.equal(awakeState(), 'api');
    awake.stop();
    assert.equal(page.doc.body.children.length, 0);
  });

  it('is still told it is on while the video waits for the first touch', async () => {
    const page = pretendPage({ apple: true });
    const awake = startAwake({ wanted: true, env: page.env });
    await tick();
    assert.equal(awakeState(), 'api');
    assert.equal(page.doc.count('pointerdown'), 1, 'and the first touch starts the video');
    page.doc.touch();
    await tick();
    assert.equal(page.doc.body.children[0].paused, false);
    awake.stop();
  });

  it('is only a lock on a phone that is not an iPhone', async () => {
    const page = pretendPage();
    const awake = startAwake({ wanted: true, env: page.env });
    await tick();
    assert.equal(page.doc.body.children.length, 0);
    awake.stop();
  });
});

describe('a lock that the phone lets go of', () => {
  it('is taken again while the page is in front, and by the video while that is all there is', async () => {
    const page = pretendPage();
    const awake = startAwake({ wanted: true, env: page.env });
    await tick();
    assert.equal(page.granted.length, 1);
    page.granted[0].onrelease();
    await tick();
    assert.equal(page.granted.length, 2, 'a new one is asked for');
    assert.equal(awakeState(), 'api');
    awake.stop();
  });

  it('is not asked for again while the page is out of sight, but is when it is back', async () => {
    const page = pretendPage();
    const awake = startAwake({ wanted: true, env: page.env });
    await tick();
    page.doc.visibilityState = 'hidden';
    page.granted[0].onrelease();
    await tick();
    assert.equal(page.granted.length, 1);
    page.doc.visibilityState = 'visible';
    page.doc.fire('visibilitychange');
    await tick();
    assert.equal(page.granted.length, 2);
    awake.stop();
  });
});

describe('the silent video', () => {
  it('takes over when the browser has no wake lock, waits for the first touch, and then plays', async () => {
    const page = pretendPage({ lock: 'missing' });
    const awake = startAwake({ wanted: true, env: page.env });
    await tick();
    const [video] = page.doc.body.children;
    assert.ok(video, 'a video is put in the page');
    assert.equal(video.muted && video.loop, true, 'silent, and in a loop');
    assert.equal(video.attrs.playsinline, '', 'and plays in the page, not full screen');
    assert.equal(video.src, '/assets/awake/blank.mp4');
    assert.equal(awakeState(), 'waiting', 'the browser will not start it before a touch');
    page.doc.touch();
    await tick();
    assert.equal(awakeState(), 'video');
    assert.equal(video.paused, false);
    assert.equal(page.doc.count('pointerdown'), 0, 'and nothing waits for a touch any more');
    awake.stop();
    assert.equal(page.doc.body.children.length, 0, 'the video is gone when the game is');
  });

  it('gives up, and says so, when the phone refuses to play it even after a touch', async () => {
    const page = pretendPage({ lock: 'missing' });
    const awake = startAwake({ wanted: true, env: page.env });
    await tick();
    assert.equal(awakeState(), 'waiting');
    page.doc.createElement = ((make) => () => Object.assign(make(), { play: async () => { throw new DOMException('Not allowed', 'NotAllowedError'); } }))(page.doc.createElement);
    awake.stop();
    const again = startAwake({ wanted: true, env: page.env });
    await tick();
    page.doc.touch();
    await tick();
    assert.equal(awakeState(), 'failed', 'the tip about the screen lock is shown');
    again.stop();
  });

  it('takes over when the wake lock is refused (low-power mode, a home-screen app)', async () => {
    const page = pretendPage({ lock: 'denied', touched: true });
    const awake = startAwake({ wanted: true, env: page.env });
    await tick();
    assert.equal(page.doc.body.children.length, 1);
    assert.equal(awakeState(), 'video');
    awake.stop();
  });

  it('is started again when the page comes back to the front and the video was paused', async () => {
    const page = pretendPage({ lock: 'missing', touched: true });
    const awake = startAwake({ wanted: true, env: page.env });
    await tick();
    const [video] = page.doc.body.children;
    video.pause(); // (the browser paused it while the page was out of sight)
    page.doc.fire('visibilitychange');
    await tick();
    assert.equal(video.paused, false);
    awake.stop();
    assert.equal(page.doc.count('visibilitychange'), 0, 'nothing is left listening when the game is over');
  });
});

describe('when it is switched off by hand', () => {
  it('keeps nothing awake, and says so', () => {
    const page = pretendPage();
    const awake = startAwake({ wanted: false, env: page.env });
    assert.equal(awakeState(), 'off');
    assert.equal(page.doc.body.children.length, 0);
    awake.stop();
  });

  it('is remembered on the phone, and the default is on', () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
    assert.equal(awakeWanted(storage), true);
    rememberAwakeWanted(false, storage);
    assert.equal(awakeWanted(storage), false);
    rememberAwakeWanted(true, storage);
    assert.equal(awakeWanted(storage), true);
  });
});

describe('the video file', () => {
  it('is a real, small mp4 that the site serves from its own address (a data address would need a looser content policy)', () => {
    const file = fs.readFileSync(new URL('../public/assets/awake/blank.mp4', import.meta.url));
    assert.equal(file.subarray(4, 8).toString(), 'ftyp');
    assert.ok(file.length < 4000, `${file.length} bytes`);
    assert.match(fs.readFileSync(new URL('../public/js/wake.js', import.meta.url), 'utf8'), /asset\('assets\/awake\/blank\.mp4'\)/);
  });
});
