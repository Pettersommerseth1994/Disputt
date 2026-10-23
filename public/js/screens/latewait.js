// A player who came into a game that was already going waits here until the next round (the round that is on has its players; a newcomer plays
// from the next one, with the points they chose to come in with). (A file of its own: pages are cached for ten minutes ...)

import { html } from '../vendor/htm-preact.js';
import { setStore } from '../store.js';
import { Avatar, Button } from '../ui.js';

export function LateWait({ view }) {
  const me = view.players.find((p) => p.id === view.you.id);
  const host = view.players.find((p) => p.isHost);
  return html`<main class="screen">
    <div class="grow center stack stack--loose" style="justify-content:center;align-items:center">
      <${Avatar} id=${view.you.avatar} size="xl" alive />
      <div class="stack stack--tight">
        <h1 class="rise-in">Du er med, ${view.you.name}!</h1>
        <p class="lead muted">Runde ${view.round} pågår. Du spiller fra neste runde${me && me.score > 0 ? `, og du starter med ${me.score} poeng` : ''}.</p>
      </div>
      <${Button} variant="ghost" onClick=${() => setStore({ sheet: 'scores' })}>Se poengtavla</${Button}>
    </div>
    <p class="foot center muted" role="status">${host ? `Venter på at ${host.name} går videre …` : 'Venter på neste runde …'}</p>
  </main>`;
}
