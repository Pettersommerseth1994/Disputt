// The small parts of the animated rules: a clock that plays a scene in beats, a speech bubble, the picture of a player, and a picture
// from the art folder. (A folder of its own: pages are cached for ten minutes ...)

import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { asset } from '../paths.js';
import { Avatar } from '../ui.js';
import { CAST } from './content.js';

/** Does the person want less movement? Then every scene stands still on its last picture, and the steps are taken by hand. */
export const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** For the QA tools: `window.__regler = { beat: 2 }` freezes every scene at that beat. */
const frozen = () => (typeof window !== 'undefined' && Number.isInteger(window.__regler?.beat) ? window.__regler.beat : null);

/**
 * Plays a scene in beats: 0, 1, … count-1, `ms` apart, then waits `hold` on the last one and starts over (or calls `onEnd`, if there is one). Changing `key` starts over from 0.
 * With `paused` the beat stays where it is; with calm movement (or a frozen beat for the QA tools) there is nothing to play.
 */
export function useBeats(count, { ms = 900, hold = 2200, paused = false, key = '', onEnd = null } = {}) {
  const still = frozen();
  const [beat, setBeat] = useState(still ?? (calm() ? count - 1 : 0));
  const at = useRef(0);
  const ended = useRef(onEnd);
  ended.current = onEnd; // (the newest one, so that the timer need not be set again when it changes)
  useEffect(() => {
    at.current = 0;
    setBeat(still ?? (calm() ? count - 1 : 0));
  }, [key, count]);
  useEffect(() => {
    if (still !== null || calm() || paused) return undefined;
    let timer;
    const next = () => {
      const last = at.current >= count - 1;
      timer = setTimeout(() => {
        if (last && ended.current) return ended.current(); // (the one who plays it takes over: goes on to the next step)
        at.current = last ? 0 : at.current + 1;
        setBeat(at.current);
        next();
      }, last ? hold : ms);
    };
    next();
    return () => clearTimeout(timer);
  }, [count, ms, hold, paused, key]);
  return beat;
}

export const Pic = ({ name, class: cls = '', style }) => html`<img class=${`rg-pic ${cls}`} style=${style} src=${asset(`assets/art/${name}.svg`)} alt="" draggable="false" />`;

/** One of the five players. `size` is in rem. */
export const Person = ({ i, person = null, size = 3.4, class: cls = '', style = '', label = true }) => {
  const p = person ?? CAST[i];
  return html`<span class=${`rg-person ${cls}`} style=${`--sz:${size}rem;${style}`}>
    <${Avatar} id=${p.id} size="md" class="rg-person__face" style=${`--size:${size}rem`} />
    ${label && html`<span class="rg-person__name">${p.name}</span>`}
  </span>`;
};

/** A speech bubble. `tail` is where the tail is: down, left, right or up; `tone` is cream (said), red (the imposter's) or yellow. */
export const Bubble = ({ children, tail = 'down', tone = 'cream', class: cls = '', style = '' }) =>
  html`<div class=${`rg-bubble rg-bubble--${tone} rg-bubble--${tail} ${cls}`} style=${style}><span>${children}</span></div>`;
