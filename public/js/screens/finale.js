import { html } from '../vendor/htm-preact.js';
import { actions } from '../net.js';
import { setStore } from '../store.js';
import { Avatar, Button, Confetti, Scoreboard } from '../ui.js';
import { playerById } from '../util.js';

export function Finished({ view }) {
  const winners = (view.winners ?? []).map((id) => playerById(view, id)).filter(Boolean);
  const single = winners.length === 1;
  const title = single ? `${winners[0].name} vant!` : winners.length > 1 ? 'Delt seier!' : 'Ingen vinner denne gangen';
  const sub = single
    ? 'Kronet som Disputt-mester.'
    : winners.length > 1
      ? `${winners.map((w) => w.name).join(' og ')} deler førsteplassen.`
      : 'Ingen rakk å score. Spill en gang til?';

  return html`<main class="screen finale">
    ${winners.length > 0 && html`<${Confetti} />`}
    <div class="finale__hero grow center stack stack--loose">
      <p class="eyebrow">Spillet er over</p>
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
      <h3>Sluttresultat</h3>
      <${Scoreboard} view=${view} />
    </section>

    ${view.you.isHost
      ? html`<div class="dock">
          <${Button} block variant="lime" onClick=${() => actions.again()}>Spill igjen</${Button}>
          <div class="row row--center">
            <${Button} variant="text" onClick=${() => setStore({ sheet: 'rules' })}>Slik spiller du</${Button}>
          </div>
        </div>`
      : html`<div class="foot">
          <p class="center muted" role="status">Venter på at verten starter et nytt spill …</p>
          <div class="row row--center">
            <${Button} variant="text" onClick=${() => setStore({ sheet: 'rules' })}>Slik spiller du</${Button}>
          </div>
        </div>`}
  </main>`;
}
