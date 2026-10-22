// The game a guest was in, remembered on the phone (localStorage), so that closing the page, or the phone throwing it away, is not the end of
// the seat: the start screen offers «Hopp inn igjen», and the same player, with the same points, is back. The identity of a player in a room
// lives in sessionStorage (store.js), which is gone with the tab; this is the copy that stays, for a few hours.
// Only guests (a host's game is the host's page itself), and only in a game of several phones. It is let go of when the player leaves, is
// removed or the game is over: whenever the page itself forgets the identity.
// (A file of its own: pages are cached for ten minutes ...)

import { useEffect, useRef } from './vendor/htm-preact.js';

const KEY = 'disputt:last';
export const LAST_MAX_AGE_MS = 3 * 3600_000;

const defaultStorage = () => (typeof localStorage === 'undefined' ? null : localStorage);

export function rememberGame(session, name = '', now = Date.now(), storage = defaultStorage()) {
  try {
    storage?.setItem(KEY, JSON.stringify({ code: session.code, playerId: session.playerId, token: session.token, name, at: now }));
  } catch {
    /* private mode: no way back after the page is closed, as before */
  }
}

/** The remembered game, or null (nothing, too old, or damaged). */
export function lastGame(now = Date.now(), storage = defaultStorage()) {
  try {
    const g = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (!g || !/^[A-Z]{4}$/.test(g.code ?? '') || !g.playerId || !g.token || !(now - g.at < LAST_MAX_AGE_MS)) return null;
    return g;
  } catch {
    return null;
  }
}

export function forgetLastGame(storage = defaultStorage()) {
  try {
    storage?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Whether this view is one to remember: a guest in a game of several phones. */
export const worthRemembering = (view) => Boolean(view?.you && !view.you.isHost && view.mode !== 'car');

/**
 * Called by the app on every render with the identity and the view of this page: writes the memory while the guest is in a game, and wipes it
 * when the identity goes away in this very page (left, removed, the game ended). A page that starts without an identity leaves it alone: that is
 * what it is for.
 */
export function useRememberGame(session, view) {
  const had = useRef(false);
  const name = view?.players?.find((p) => p.id === view.you?.id)?.name ?? '';
  useEffect(() => {
    if (session && worthRemembering(view)) {
      rememberGame(session, name);
      had.current = true;
    } else if (!session && had.current) {
      forgetLastGame();
      had.current = false;
    }
  }, [session?.code, session?.playerId, session?.token, view?.you?.isHost, view?.mode, name]);
}
