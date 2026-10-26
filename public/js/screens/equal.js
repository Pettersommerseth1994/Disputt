// «Lik tid på skjermen»: everybody who looks at a role holds the button for the SAME time, 4 seconds. An imposter has to read the right answer, so an
// imposter's finger used to stay on the phone a little longer than a loyal player's, and the others, who see who holds the phone and for how long, could guess.
// Now the role is on the screen only while the finger holds, a finger that lifts before the time is up hides the role again, the bar starts over and it
// does not count (the phone going round in Bilturmodus does not move on), and a loyal player and an imposter both hold the same time.
//  - the time is shown in a field ABOVE the card (the bar and the seconds that are left), never on the button: the finger is on the button
//  - the bar is a CSS animation, so it runs smoothly; only the seconds and «long enough» come from the clock
//  - a loyal player's text waits a little and then rolls in from the left (it nudges the loyal ones to look a little longer); the imposter's is there at once
// Used by the role screen of a phone each (round.js, RoleReveal) and by the phone going round (carturn.js).
// (A file of its own with a style sheet of its own, css/equal.css, that the screens load with useEqualStyles(): pages are cached for ten minutes.)

import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { useStylesheet } from '../css-loader.js';
import { useHold } from '../hold.js';
import { t } from '../i18n/lang.js';
import { asset } from '../paths.js';
import { cx } from '../util.js';

export const EQUAL_MS = 4000;
/** How long everybody holds. (QA only: a test sets window.__DISPUTT_HOLD_MS before the page loads, so that a whole game does not take minutes.) */
export const equalMs = () => Number(globalThis.__DISPUTT_HOLD_MS) || EQUAL_MS;

export const useEqualStyles = () => useStylesheet(asset('css/equal.css'));

/** The style that makes a loyal player's text wait and roll in: a third of the time before it starts, half of the time to roll in (1.2 s and 2 s of 4). */
export const rollStyle = () => `--eq-d:${Math.round(equalMs() * 0.3)}ms;--eq-r:${Math.round(equalMs() * 0.5)}ms`;

/** True when `ms` has passed since the component was made: a button that has just been handed over is armed. */
export function useArmed(ms) {
  const [armed, setArmed] = useState(ms <= 0);
  useEffect(() => {
    if (ms <= 0) return undefined;
    const timer = setTimeout(() => setArmed(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return armed;
}

/**
 * The hold: how long the finger has been down, and what happens when it lifts. `onSeen(ms)` when it was long enough, `onEarly(ms)` when not.
 * `locked`: the button has just been handed over; it does not react (the finger that let go of the last one may still be there).
 */
export function useEqualHold({ locked = false, onSeen, onEarly } = {}) {
  const { held: down, bind } = useHold();
  const held = down && !locked;
  const total = equalMs();
  const cb = useRef({});
  cb.current = { onSeen, onEarly };
  const [ms, setMs] = useState(0);
  const started = useRef(0);
  useEffect(() => {
    if (!held) return undefined;
    started.current = Date.now();
    setMs(0);
    const timer = setInterval(() => setMs(Date.now() - started.current), 50);
    return () => clearInterval(timer);
  }, [held]);
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !held) {
      const took = Date.now() - started.current;
      (took >= total ? cb.current.onSeen : cb.current.onEarly)?.(took);
      setMs(0);
    }
    was.current = held;
  }, [held]);
  return { held, locked, bind: locked ? {} : bind, ms, done: held && ms >= total, left: Math.max(0, Math.ceil((total - ms) / 1000)) };
}

/** The field above the card: what to do, the bar that fills, and the seconds that are left. `early`: the last finger lifted too soon. */
export function TimeField({ hold, early = false }) {
  const { held, done, left } = hold;
  const seconds = Math.max(1, Math.round(equalMs() / 1000));
  const text = done ? t('Nå kan du slippe') : held ? t('Hold … litt til') : early ? t('For tidlig! Hold hele tiden') : t('Alle holder {n} sekunder', { n: seconds });
  return html`<div class=${cx('eq-field', held && 'is-held', done && 'is-done', early && !held && 'is-early')} role="status" style=${`--eq-t:${equalMs()}ms;--eq-n:${seconds}`}>
    <div class="eq-field__top">
      <span class="eq-field__text">${text}</span>
      <span class="eq-field__secs" aria-hidden="true">${done ? '✓' : held ? left : seconds}<small>s</small></span>
    </div>
    <div class="eq-field__bar" aria-hidden="true"><i></i></div>
  </div>`;
}

/** A loyal player's text: there in its place all the time (invisible, so nothing moves), and rolls in from the left a little after the finger lands. */
export const Roll = ({ children, block = false }) => html`<span class=${cx('eq-clip', block && 'eq-clip--block')}><span class=${cx('eq-roll', block && 'eq-roll--block')} style=${rollStyle()}>${children}</span></span>`;
