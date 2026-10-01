// Tiny global store: one mutable state object, components subscribe through `useStore()`.

import { useEffect, useState } from './vendor/htm-preact.js';

const SESSION_KEY = 'disputt:session';

/** The player's identity in a room lives in sessionStorage: per tab, survives reloads and phone sleep. */
export function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const s = raw && JSON.parse(raw);
    return s && s.code && s.playerId && s.token ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode etc. – the game still works, it just can't resume after a reload */
  }
}

export function parseRoute(loc = window.location) {
  const m = loc.pathname.match(/^\/j\/([A-Za-z]{4})\/?$/);
  return m ? { page: 'join', code: m[1].toUpperCase() } : { page: 'home' };
}

export const store = {
  conn: 'connecting', // connecting | open | closed
  everOpened: false,
  view: null, // latest per-player view from the server
  session: loadSession(),
  route: parseRoute(),
  joining: null, // room code we are trying to join
  seats: null, // { code, seats } when the game has already started and a seat can be claimed
  notice: null, // message shown on the home screen (e.g. "game is gone")
  toast: null, // transient error/info
  sheet: null, // 'scores' | 'rules' | 'host' | null
  editing: false, // lobby: changing name/avatar
  replaced: false, // the same player opened the game in another tab
  info: null, // /api/info (LAN urls etc.)
};

const listeners = new Set();

export function setStore(patch) {
  Object.assign(store, patch);
  for (const l of listeners) l();
}

export function useStore() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  return store;
}

let toastTimer;
export function toast(message, ms = 3500) {
  clearTimeout(toastTimer);
  setStore({ toast: message });
  toastTimer = setTimeout(() => setStore({ toast: null }), ms);
}
