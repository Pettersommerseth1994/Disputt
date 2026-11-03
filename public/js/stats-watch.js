// Watches the game's state and counts the steps that matter: the page opened, the host started, chose the way to play, a game was made,
// somebody joined, the first round began (with how many play and how long the game is), every round, the end, the packages shown. Called from App on every drawing (it only reacts to
// a change). Only the host's phone counts the game's own steps (the guests' phones see the same game), and every game counts each step once.
// What the numbers say and what is kept: docs/STATS.md. (A file of its own: pages are cached for ten minutes ...)

import { track } from './stats.js';

let seenPage = false;
let was = { modeStep: false, readyStep: false, paywall: false };
const done = new Set(); // 'step:code' (or 'step:code:round'): what has been counted for this game already

/** Counts `step` once for `key`. */
function once(key, name, extra, send) {
  if (done.has(key)) return;
  done.add(key);
  send(name, extra);
}

/** `s` is the store. `send` is for the tests. */
export function observe(s, send = track) {
  if (!seenPage) {
    seenPage = true;
    // a new visitor: not somebody who has come in by the QR code (that is `joined`) and not somebody on the way back into a game
    if (s.route?.page === 'home' && !s.session) send('visit');
  }
  const view = s.view;
  const mode = view?.mode ?? '';
  if (s.modeStep && !was.modeStep) send('start');
  if (s.readyStep && !was.readyStep && s.readyMode) send('mode', { m: s.readyMode });
  if (s.paywall && s.payments?.enabled && !was.paywall) send('paywall', { m: mode });
  was = { modeStep: Boolean(s.modeStep), readyStep: Boolean(s.readyStep), paywall: Boolean(s.paywall) };
  if (!view?.code) return;
  if (!view.you?.isHost) {
    once(`joined:${view.code}`, 'joined', { m: mode }, send);
    return;
  }
  if (view.phase === 'lobby') once(`lobby:${view.code}`, 'lobby', { m: mode }, send);
  if (view.phase === 'role') {
    if (view.round === 1 && !done.has(`game_start:${view.code}`)) {
      once(`game_start:${view.code}`, 'game_start', { m: mode }, send);
      // how many play, and how long the game is to be (Småkrangel is first to 8, Storkrangel first to 12): counted when the first round begins
      const players = view.players?.length;
      if (Number.isInteger(players) && players >= 2 && players <= 10) send(`players_${players}`, { m: mode });
      send(`length_${view.target === 8 || view.target === 12 ? view.target : 'other'}`, { m: mode });
    }
    once(`round:${view.code}:${view.round}`, 'round', { m: mode }, send);
  }
  if (view.phase === 'finished') once(`finished:${view.code}`, 'finished', { m: mode }, send);
}

/** For the tests: forget everything. */
export function resetWatch() {
  seenPage = false;
  was = { modeStep: false, readyStep: false, paywall: false };
  done.clear();
}
