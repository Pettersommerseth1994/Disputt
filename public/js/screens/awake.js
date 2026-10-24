// The screen that stays awake while a game is on (wake.js): a switch in the settings and the host's options, and the tip in the lobby when
// nothing could keep it awake. (A file of its own: pages are cached for ten minutes ...)

import { html } from '../vendor/htm-preact.js';
import { t, tx } from '../i18n/lang.js';
import { Button } from '../ui.js';
import { keepingAwake, setAwakeWanted, useAwakeState, useAwakeWanted } from '../wake.js';

const SAYS = {
  api: tx('På. Skjermen låser seg ikke\nmens spillet er i gang.'),
  video: tx('På. Skjermen låser seg ikke\nmens spillet er i gang.'),
  waiting: tx('På. Det starter ved\nførste trykk på skjermen.'),
  off: tx('Av. Låser skjermen seg, mister\nvennene dine forbindelsen.'),
  failed: tx('Virker ikke på denne telefonen.\nSett skjermlåsen til «Aldri» i\ninnstillingene til telefonen.'),
  idle: tx('På så snart spillet\ner i gang.'),
};

/** «Hold skjermen våken» with what it is doing now, and a button to switch it off or on. */
export function AwakeToggle() {
  const wanted = useAwakeWanted();
  const state = useAwakeState();
  const shown = wanted ? (state === 'off' ? 'idle' : state) : 'off';
  return html`<div class="card card--deep awake" role="group" aria-label=${t('Hold skjermen våken')}>
    <div class="awake__text">
      <strong>${t('Hold skjermen våken')}</strong>
      <span class="small muted" role="status">${t(SAYS[shown])}</span>
    </div>
    <${Button} size="small" variant=${wanted ? 'ghost' : 'cream'} onClick=${() => setAwakeWanted(!wanted)} aria-pressed=${wanted}>${wanted ? t('Slå av') : t('Slå på')}</${Button}>
  </div>`;
}

/** The tip in the lobby, only when the screen is not kept awake (it was switched off, or the phone would not). */
export function AwakeTip() {
  const state = useAwakeState();
  if (keepingAwake(state) || state === 'idle') return null;
  return html`<p class="small muted center" style="max-width:22rem;margin-inline:auto">${t('Tips: sett skjermlåsen på telefonen til «Aldri» mens dere spiller, så mister du ikke forbindelsen.')}</p>`;
}
