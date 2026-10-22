// Keeping the screen awake while a game is on. The host's phone IS the game server (p2p/host.js): when its screen locks, every guest loses the
// game. Two ways, tried in this order:
//  1. the Screen Wake Lock API (most phones);
//  2. a tiny silent video that plays in a loop, out of sight (a page that plays a video keeps the screen on, also where the first way is
//     missing or refused: for instance Chrome on an iPhone). The browser only lets a page start a video after a touch, so it is started by
//     the first touch after the game has begun.
// The host (and everybody else) can switch it off by hand («Hold skjermen våken» in the settings); that is remembered on the phone.
// (A file of its own: pages are cached for ten minutes, and a module that imports something an older cached copy of another module does not have would not load.)

import { useEffect, useState } from './vendor/htm-preact.js';
import { asset } from './paths.js';

const KEY = 'disputt:awake';
const GESTURES = ['pointerdown', 'touchend', 'click', 'keydown'];

/** What it is doing: 'api' (the wake lock), 'video' (the silent video), 'waiting' (the video waits for a touch), 'off' (switched off by hand), 'failed' (nothing worked), 'idle' (no game). */
let state = 'idle';
const listeners = new Set();
const setState = (next) => {
  if (next === state) return;
  state = next;
  listeners.forEach((f) => f(state));
};

/** Has the person switched it off? (The default is on.) */
export function awakeWanted(storage = typeof localStorage === 'undefined' ? null : localStorage) {
  try {
    return storage?.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function rememberAwakeWanted(wanted, storage = typeof localStorage === 'undefined' ? null : localStorage) {
  try {
    if (wanted) storage?.removeItem(KEY);
    else storage?.setItem(KEY, 'off');
  } catch {
    /* private mode: it is only a wish for this visit */
  }
}

/**
 * Starts keeping the screen awake. Returns { stop }. `env` is for the tests (a pretend navigator and document).
 * Nothing is kept when `wanted` is false: the state then says 'off'.
 */
export function startAwake({ wanted = awakeWanted(), env = {} } = {}) {
  const nav = env.navigator ?? (typeof navigator === 'undefined' ? {} : navigator);
  const doc = env.document ?? (typeof document === 'undefined' ? null : document);
  const src = env.src ?? asset('assets/awake/blank.mp4');
  if (!wanted || !doc) {
    setState(wanted ? 'failed' : 'off');
    return { stop() {} };
  }
  let stopped = false;
  let lock = null;
  let video = null;
  const armed = [];

  const disarm = () => {
    while (armed.length) doc.removeEventListener(...armed.pop());
  };
  const playVideo = async (afterTouch = false) => {
    if (stopped || !video) return;
    try {
      await video.play();
      if (!stopped) {
        disarm();
        setState('video');
      }
    } catch {
      if (stopped) return;
      // (refused even after a touch: this phone will not play it, and the person is told to set the screen lock by hand)
      setState(afterTouch ? 'failed' : 'waiting');
      if (armed.length === 0) {
        // (the first touch after this starts it: a browser lets a page play a video only after one)
        for (const type of GESTURES) {
          const onGesture = () => playVideo(true);
          doc.addEventListener(type, onGesture, { passive: true });
          armed.push([type, onGesture, { passive: true }]);
        }
      }
    }
  };
  const startVideo = () => {
    if (video || stopped) return;
    video = doc.createElement('video');
    video.setAttribute('aria-hidden', 'true');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.muted = true;
    video.loop = true;
    video.src = src;
    video.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;';
    doc.body.append(video);
    playVideo();
  };
  const acquire = async () => {
    if (stopped) return;
    if (!('wakeLock' in nav)) return startVideo();
    try {
      const l = await nav.wakeLock.request('screen');
      if (stopped) return void l.release?.();
      lock = l;
      setState('api');
    } catch {
      // refused (low-power mode, a home-screen app …): the video is the second way
      startVideo();
    }
  };
  const onVisible = () => {
    if (doc.visibilityState !== 'visible' || stopped) return;
    if (video && video.paused) playVideo(); // (a video that was paused while the page was hidden)
    else if (!video) acquire(); // (the wake lock is let go of when the page is hidden: take it again)
  };
  doc.addEventListener('visibilitychange', onVisible);
  acquire();

  return {
    stop() {
      stopped = true;
      doc.removeEventListener('visibilitychange', onVisible);
      disarm();
      try {
        lock?.release?.();
      } catch {
        /* already released */
      }
      lock = null;
      if (video) {
        try {
          video.pause();
        } catch {
          /* gone */
        }
        video.remove?.();
        video = null;
      }
      setState('idle');
    },
  };
}

/** Has the person switched it off by hand? Kept here, so that the toggle in the settings and the game see the same. */
let wantedNow = awakeWanted();
const wantedListeners = new Set();
export function setAwakeWanted(wanted) {
  wantedNow = wanted;
  rememberAwakeWanted(wanted);
  wantedListeners.forEach((f) => f(wanted));
}
export function useAwakeWanted() {
  const [wanted, set] = useState(wantedNow);
  useEffect(() => {
    wantedListeners.add(set);
    set(wantedNow);
    return () => wantedListeners.delete(set);
  }, []);
  return wanted;
}

/** What it is doing now: for the settings and the lobby tip. */
export function useAwakeState() {
  const [now, set] = useState(state);
  useEffect(() => {
    listeners.add(set);
    set(state);
    return () => listeners.delete(set);
  }, []);
  return now;
}

/** True when the screen is kept awake, or soon will be (the video waits for a touch). */
export const keepingAwake = (s) => s === 'api' || s === 'video' || s === 'waiting';

/** The state, for the tests and the QA tools. */
export const awakeState = () => state;
