// The host's set-up, one step at a time: 1 how to play (a phone each, or everybody on one: screens/mode.js, before any game exists),
// 2 who you are (in the car: who is playing), 3 how long to play, 4 the invitation (the lobby, where the game then waits for its
// players). In the car there are three steps: the last one, how long to play, starts the game. Guests only ever see "who you are".
// (A file of its own: pages are cached for ten minutes, and a module that imports something an older cached copy of another
// module does not have would not load.)

import { html } from '../vendor/htm-preact.js';
import { actions } from '../net.js';
import { t } from '../i18n/lang.js';
import { setStore, useStore } from '../store.js';
import { Button, HelpIcon, Logo } from '../ui.js';
import { cx } from '../util.js';
import { LengthCards } from './lengthcards.js';
import { CAR_SEGMENTS } from './steps-count.js';

const SEGMENTS = 5; // the bar at the top of every step (four in the car: steps-count.js)
const LAST = 3; // what `store.step` counts, after the way to play has been chosen: 1 who you are, 2 how long, 3 the invitation

// Not used any more (how long to play is two cards now: screens/lengthcards.js). Kept for a few days so that a lobby.js from a cached page, which imports them, still loads.
export const MINUTES_PER_POINT = 6;
export function duration(minutes) {
  if (minutes < 90) return t('ca. {n} min', { n: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? t('ca. {h} t {m} min', { h, m }) : t('ca. {h} t', { h });
}

/** Which step the host is on. Somebody who has not picked a profile is on the first; after a reload the game waits at the last. */
export const hostStep = (view, step) => (!view.you.ready ? 1 : (step ?? LAST));

/** The logo (back to the start screen) and the rules, on top of every step. */
export function SetupHeader() {
  return html`<header class="row row--between">
    <${Logo} small onClick=${() => setStore({ sheet: 'home' })} />
    <${Button} variant="ghost" size="small icon" onClick=${() => setStore({ sheet: 'rules' })} aria-label=${t('Slik spiller dere')}><${HelpIcon} /></${Button}>
  </header>`;
}

/** Four segments (three in the car), then a way back on the left and "Steg 2 av 4" on the right. */
export function Steps({ current, onBack, total = SEGMENTS }) {
  return html`<div class="steps">
    <ol class="steps__bar" aria-hidden="true">
      ${Array.from({ length: total }, (_, i) => html`<li key=${i} class=${cx('steps__seg', i + 1 <= current && 'steps__seg--done')}></li>`)}
    </ol>
    <div class="steps__row">
      ${onBack && html`<${Button} variant="text" onClick=${onBack}>${t('‹ Tilbake')}</${Button}>`}
      <p class="eyebrow">${t('Steg {current} av {total}', { current, total })}</p>
    </div>
  </div>`;
}

/** Step 3: how long to play, as two cards (screens/lengthcards.js). In the car it is the last step, and the game starts from here. */
export function PointsStep({ view }) {
  const s = useStore();
  const car = view.mode === 'car';
  const canStart = view.players.length >= view.limits.min && view.you.ready && s.conn === 'open';
  return html`<main class="screen setup mc-root">
    <${SetupHeader} />
    <${Steps} current=${4} total=${car ? CAR_SEGMENTS : SEGMENTS} onBack=${() => setStore({ step: 1 })} />
    <h1 class="setup__title rise-in">${t('Hvor lenge skal dere spille?')}</h1>
    <${LengthCards} view=${view} />
    <p class="small muted center">${t('Verten kan bytte underveis, hvis det blir for kort eller for langt.')}</p>
    <div class="dock">
      ${car
        ? html`<${Button} block variant="lime" onClick=${() => actions.start()} disabled=${!canStart}>${t('Start spillet')}</${Button}>`
        : html`<${Button} block onClick=${() => setStore({ step: 3 })}>${t('Neste')}</${Button}>`}
    </div>
  </main>`;
}
