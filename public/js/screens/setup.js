// The host's set-up, one step at a time: 1 how to play (a phone each, or everybody on one: screens/mode.js, before any game exists),
// 2 who you are (in the car: who is playing), 3 how long to play, 4 the invitation (the lobby, where the game then waits for its
// players; in the car: how it works). Guests only ever see "who you are".
// (A file of its own: pages are cached for ten minutes, and a module that imports something an older cached copy of another
// module does not have would not load.)

import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { actions } from '../net.js';
import { setStore } from '../store.js';
import { Button, HelpIcon, Logo } from '../ui.js';
import { cx } from '../util.js';

export const MINUTES_PER_POINT = 6;
const SEGMENTS = 4; // the bar at the top of every step
const LAST = 3; // what `store.step` counts, after the way to play has been chosen: 1 who you are, 2 how long, 3 the invitation

export function duration(minutes) {
  if (minutes < 90) return `ca. ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `ca. ${h} t${m ? ` ${m} min` : ''}`;
}

/** Which step the host is on. Somebody who has not picked a profile is on the first; after a reload the game waits at the last. */
export const hostStep = (view, step) => (!view.you.ready ? 1 : (step ?? LAST));

/** The logo (back to the start screen) and the rules, on top of every step. */
export function SetupHeader() {
  return html`<header class="row row--between">
    <${Logo} small onClick=${() => setStore({ sheet: 'home' })} />
    <${Button} variant="ghost" size="small icon" onClick=${() => setStore({ sheet: 'rules' })} aria-label="Slik spiller du"><${HelpIcon} /></${Button}>
  </header>`;
}

/** Four segments, then a way back on the left and "Steg 2 av 4" on the right. */
export function Steps({ current, onBack }) {
  return html`<div class="steps">
    <ol class="steps__bar" aria-hidden="true">
      ${Array.from({ length: SEGMENTS }, (_, i) => html`<li key=${i} class=${cx('steps__seg', i + 1 <= current && 'steps__seg--done')}></li>`)}
    </ol>
    <div class="steps__row">
      ${onBack && html`<${Button} variant="text" onClick=${onBack}>‹ Tilbake</${Button}>`}
      <p class="eyebrow">Steg ${current} av ${SEGMENTS}</p>
    </div>
  </div>`;
}

/** The points target as the host edits it: a number they can type or step, sent on to the game a moment after they stop. */
function useTarget(view) {
  const [text, setText] = useState(String(view.target));
  const timer = useRef(null); // a number waiting to be sent (debounced) ...
  const pending = useRef(0); // ... and which one
  const n = Number(text);
  const valid = /^\d{1,2}$/.test(text) && n >= 1 && n <= 99;
  const emptied = text === ''; // the field is cleared while the host types a new number: "unchanged" until they do

  // Follow the game (e.g. after "play again"), but never overwrite what the host is typing right now.
  useEffect(() => {
    if (document.activeElement?.id !== 'target') setText(String(view.target));
  }, [view.target]);

  const onInput = (e) => {
    const v = e.currentTarget.value.replace(/\D/g, '').slice(0, 2);
    e.currentTarget.value = v; // keep the DOM in step with the cleaned value (a re-render alone would not undo a rejected character)
    setText(v);
    clearTimeout(timer.current);
    timer.current = null;
    if (/^\d{1,2}$/.test(v) && Number(v) >= 1) {
      pending.current = Number(v);
      timer.current = setTimeout(() => {
        timer.current = null;
        actions.target(pending.current);
      }, 250);
    }
  };
  // a number that is still waiting is sent before the host leaves the step, or lets go of the field
  const flush = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    actions.target(pending.current);
  };
  useEffect(() => flush, []);
  const onBlur = () => {
    flush();
    setText(String(valid ? n : view.target));
  };
  const bump = (d) => {
    const next = Math.min(99, Math.max(1, (valid ? n : view.target) + d));
    setText(String(next));
    actions.target(next);
  };
  return { text, n, valid, emptied, onInput, onFocus: () => setText(''), onBlur, bump, flush };
}

/** Step 3: how many points the game is played to. */
export function PointsStep({ view }) {
  const t = useTarget(view);
  const goTo = (step) => () => {
    t.flush();
    setStore({ step });
  };
  return html`<main class="screen setup">
    <${SetupHeader} />
    <${Steps} current=${3} onBack=${goTo(1)} />
    <h1 class="setup__title rise-in">Hvor lenge skal dere spille?</h1>
    <section class="card card--paper card--tilt-r setup__points center stack">
      <label class="sr-only" for="target">Antall poeng å spille til</label>
      <div class="stepper">
        <${Button} size="icon" onClick=${() => t.bump(-1)} aria-label="Ett poeng mindre" disabled=${t.valid && t.n <= 1}>−</${Button}>
        <input id="target" class="input" value=${t.text} placeholder=${String(view.target)} onInput=${t.onInput} onFocus=${t.onFocus} onBlur=${t.onBlur} inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-describedby="target-hint" />
        <${Button} size="icon" onClick=${() => t.bump(1)} aria-label="Ett poeng mer" disabled=${t.valid && t.n >= 99}>+</${Button}>
      </div>
      <p class="setup__unit">poeng</p>
      ${t.valid ? html`<p class="setup__time">Det blir ${duration(t.n * MINUTES_PER_POINT)}</p>` : !t.emptied && html`<p class="field__error">Skriv et tall mellom 1 og 99.</p>`}
    </section>
    <p class="small muted center" id="target-hint">Ett poeng tar ca. ${MINUTES_PER_POINT} minutter. Vi anbefaler minst 5 poeng for å krone en vinner.</p>
    <div class="dock">
      <${Button} block onClick=${goTo(3)} disabled=${!(t.valid || t.emptied)}>Neste</${Button}>
    </div>
  </main>`;
}
