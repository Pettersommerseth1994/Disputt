import { html } from '../vendor/htm-preact.js';
import { joinNames } from '../impostors.js';
import { t } from '../i18n/lang.js';
import { actions } from '../net.js';
import { Avatar, Button, Confetti, Scoreboard } from '../ui.js';
import { playerById } from '../util.js';

export function Finished({ view }) {
  const winners = (view.winners ?? []).map((id) => playerById(view, id)).filter(Boolean);
  const single = winners.length === 1;
  const title = single ? t('{name} vant!', { name: winners[0].name }) : winners.length > 1 ? t('Delt seier!') : t('Ingen vinner denne gangen');
  const sub = single
    ? t('Kronet som Disputt-mester.')
    : winners.length > 1
      ? t('{names} deler førsteplassen.', { names: joinNames(winners.map((w) => w.name)) })
      : t('Ingen rakk å score. Spill en gang til?');

  return html`<main class="screen finale">
    ${winners.length > 0 && html`<${Confetti} />`}
    <div class="finale__hero grow center stack stack--loose">
      <p class="eyebrow">${t('Spillet er over')}</p>
      <div class="row row--center row--wrap" style="gap:var(--s-5)">
        ${winners.length > 0
          ? winners.map((w) => html`<${Avatar} key=${w.id} id=${w.avatar} size=${single ? 'xl' : 'lg'} crown alive />`)
          : html`<${Avatar} id="sky" size="xl" alive />`}
      </div>
      <div class="stack stack--tight">
        <h1 class="pop-in">${title}</h1>
        <p class="lead muted">${sub}</p>
      </div>
    </div>

    <section class="card stack" style="margin-top:var(--s-5)">
      <h3>${t('Sluttresultat')}</h3>
      <${Scoreboard} view=${view} />
    </section>

    ${view.you.isHost
      ? html`<div class="dock">
          <${Button} block variant="lime" onClick=${() => actions.again()}>${t('Spill igjen')}</${Button}>
        </div>`
      : html`<div class="foot">
          <p class="center muted" role="status">${t('Venter på at verten starter et nytt spill …')}</p>
        </div>`}
  </main>`;
}
