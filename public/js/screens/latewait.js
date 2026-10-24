// A player who came into a game that was already going waits here until the next round (the round that is on has its players; a newcomer plays
// from the next one, with the points they chose to come in with). (A file of its own: pages are cached for ten minutes ...)

import { html } from '../vendor/htm-preact.js';
import { setStore } from '../store.js';
import { t } from '../i18n/lang.js';
import { Avatar, Button } from '../ui.js';

export function LateWait({ view }) {
  const me = view.players.find((p) => p.id === view.you.id);
  const host = view.players.find((p) => p.isHost);
  return html`<main class="screen">
    <div class="grow center stack stack--loose" style="justify-content:center;align-items:center">
      <${Avatar} id=${view.you.avatar} size="xl" alive />
      <div class="stack stack--tight">
        <h1 class="rise-in">${t('Du er med, {name}!', { name: view.you.name })}</h1>
        <p class="lead muted">${me && me.score > 0 ? t('Runde {round} pågår. Du spiller fra neste runde, og du starter med {score} poeng.', { round: view.round, score: me.score }) : t('Runde {round} pågår. Du spiller fra neste runde.', { round: view.round })}</p>
      </div>
      <${Button} variant="ghost" onClick=${() => setStore({ sheet: 'scores' })}>${t('Se poengtavla')}</${Button}>
    </div>
    <p class="foot center muted" role="status">${host ? t('Venter på at {name} går videre …', { name: host.name }) : t('Venter på neste runde …')}</p>
  </main>`;
}
