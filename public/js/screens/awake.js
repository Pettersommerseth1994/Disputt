// The screen that stays awake while a game is on (wake.js): a switch in the settings and the host's options, and the tip in the lobby when
// nothing could keep it awake. (A file of its own: pages are cached for ten minutes ...)

import { html } from '../vendor/htm-preact.js';
import { Button } from '../ui.js';
import { keepingAwake, setAwakeWanted, useAwakeState, useAwakeWanted } from '../wake.js';

const SAYS = {
  api: 'På. Skjermen låser seg ikke mens spillet er i gang.',
  video: 'På. Skjermen låser seg ikke mens spillet er i gang.',
  waiting: 'På. Det starter ved første trykk på skjermen.',
  off: 'Av. Låser skjermen seg, mister vennene dine forbindelsen til spillet.',
  failed: 'Virker ikke på denne telefonen. Sett skjermlåsen til «Aldri» i innstillingene til telefonen i stedet.',
  idle: 'På så snart spillet er i gang.',
};

/** «Hold skjermen våken» with what it is doing now, and a button to switch it off or on. */
export function AwakeToggle() {
  const wanted = useAwakeWanted();
  const state = useAwakeState();
  const shown = wanted ? (state === 'off' ? 'idle' : state) : 'off';
  return html`<div class="card card--deep awake" role="group" aria-label="Hold skjermen våken">
    <div class="awake__text">
      <strong>Hold skjermen våken</strong>
      <span class="small muted" role="status">${SAYS[shown]}</span>
    </div>
    <${Button} size="small" variant=${wanted ? 'ghost' : 'cream'} onClick=${() => setAwakeWanted(!wanted)} aria-pressed=${wanted}>${wanted ? 'Slå av' : 'Slå på'}</${Button}>
  </div>`;
}

/** The tip in the lobby, only when the screen is not kept awake (it was switched off, or the phone would not). */
export function AwakeTip() {
  const state = useAwakeState();
  if (keepingAwake(state) || state === 'idle') return null;
  return html`<p class="small muted center" style="max-width:22rem;margin-inline:auto">Tips: sett skjermlåsen på telefonen til «Aldri» mens dere spiller, så mister du ikke forbindelsen.</p>`;
}
