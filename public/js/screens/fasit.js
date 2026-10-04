// "Se fasit": the answer key of the round that has just been played, for when the group is not sure what was said out loud.
// (A file of its own: pages are cached for ten minutes, and a module that imports something an older cached copy of another
// module does not have would not load.)

import { html } from '../vendor/htm-preact.js';
import { joinNames, summaryImpostors } from '../impostors.js';
import { setStore } from '../store.js';
import { Avatar, Sheet } from '../ui.js';

const close = () => setStore({ sheet: null });

export function FasitSheet({ view }) {
  const s = view.summary;
  const impostors = summaryImpostors(view); // (somebody who has left the game since is still named)
  const many = impostors.length > 1;
  const a = s.answer; // (a host that has not been updated does not send it)
  return html`<${Sheet} title="Fasit" onClose=${close}>
    <div class="card card--paper stack fasit">
      ${a &&
      html`<div class="fasit__row">
          <p class="eyebrow">Riktig svar</p>
          <p class="role__answer"><span>${a.correctLetter}</span>${a.correctText}</p>
        </div>
        <div class="fasit__row">
          <p class="eyebrow">Dere låste</p>
          <p class="fasit__locked">${a.chosenLetter}: ${a.chosenText}</p>
        </div>`}
      <div class="fasit__row fasit__row--who">
        <span class="impostor-card__faces">${impostors.map((i) => html`<${Avatar} id=${i.avatar} size="md" key=${i.id} />`)}</span>
        <div>
          <p class="eyebrow">${many ? 'Imposterne var' : 'Imposteren var'}</p>
          <p class=${many ? 'display impostor-card__name impostor-card__name--duo' : 'display impostor-card__name'}>${joinNames(impostors.map((i) => i.name))}</p>
        </div>
      </div>
    </div>
    <p class="small muted center" style="margin-top:var(--s-4)">Imposteren skal si det høyt først. Fasiten er bare her hvis dere blir uenige.</p>
  </${Sheet}>`;
}
