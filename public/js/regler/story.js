// The shell of the story: a bar at the top that fills up (one segment per card), the card that is on, and two big places to tap: on the right
// goes on, on the left goes back. The next card comes by itself when the bar is full. As in Instagram, a finger held anywhere on the story stops
// the clock (the card, which is told `held`, stops its own movement too) and lets go of it again when the finger lifts: a hold is not a tap, so
// the card does not change when the finger is lifted after one. The last card just stays.
// What is on the card is `Card`, a component that is drawn for one slide.

import { html, useRef, useState } from '../vendor/htm-preact.js';

/** How long a card stays, in seconds, when nothing else is said. */
export const SECONDS = 6;
/** A finger that stays down longer than this (in milliseconds) is holding, not tapping. */
const HOLD_MS = 280;

export function Story({ slides, start = 0, seconds = () => SECONDS, Card, cardProps = {}, class: cls = '' }) {
  const [at, setAt] = useState(Math.min(start, slides.length - 1));
  const [held, setHeld] = useState(false);
  const downAt = useRef(0); // when the finger came down (0: no finger has been down since the last tap was handled)
  const last = at === slides.length - 1;
  const s = slides[at];
  const go = (i) => {
    setAt(Math.max(0, Math.min(slides.length - 1, i)));
    setHeld(false);
  };
  // the tap on a side: not when the finger was held (that was a pause, not a tap)
  const tap = (to) => () => {
    const hold = downAt.current && Date.now() - downAt.current > HOLD_MS;
    downAt.current = 0;
    if (!hold) go(to);
  };
  const press = () => {
    downAt.current = Date.now();
    setHeld(true);
  };
  const release = () => setHeld(false);
  return html`<section
    class=${`rgS ${held ? 'is-held' : ''} ${cls}`}
    aria-label="Slik spiller dere"
    onPointerDown=${press}
    onPointerUp=${release}
    onPointerLeave=${release}
    onPointerCancel=${release}
    onContextMenu=${(e) => e.preventDefault()}
  >
    <div class="rgS__bars" aria-hidden="true">
      ${slides.map(
        (x, i) => html`<span key=${x.id} class=${i < at ? 'is-done' : i === at ? 'is-on' : ''}><i
          style=${`--sec:${seconds(x)}s`}
          onAnimationEnd=${() => i === at && !last && go(at + 1)}
        ></i></span>`,
      )}
    </div>
    <div class=${`rgS__card ${held ? 'is-held' : ''}`} key=${s.id}>
      <${Card} s=${s} held=${held} last=${last} ...${cardProps} />
    </div>
    <button type="button" class="rgS__zone rgS__zone--back" aria-label="Forrige" onClick=${tap(at - 1)}></button>
    <button type="button" class="rgS__zone rgS__zone--next" aria-label=${last ? 'Fra begynnelsen' : 'Neste'} onClick=${tap(last ? 0 : at + 1)}></button>
  </section>`;
}
