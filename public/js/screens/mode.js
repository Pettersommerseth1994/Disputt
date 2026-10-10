// The first step of the host's set-up: how to play. The same game two ways: everybody on ONE phone, the host's (bilturmodus, "perfect for
// the car trip"), or a phone each (hytteturmodus). Nothing exists yet while this is on the screen: the game is made when the host goes
// on (net.js: actions.create(mode)), and "back" is simply the start screen.
// (A file of its own: pages are cached for ten minutes, and a module that imports something an older cached copy of another
// module does not have would not load.)

import { html, useState } from '../vendor/htm-preact.js';
import { actions } from '../net.js';
import { asset } from '../paths.js';
import { setStore } from '../store.js';
import { Button, Logo } from '../ui.js';
import { cx } from '../util.js';
import { Steps } from './setup.js';

export const MODES = [
  { id: 'car', title: 'Bilturmodus', text: 'Alle spiller på 1 telefon, som sendes rundt.', art: 'bil', players: '2-10 deltakere' },
  { id: 'cabin', title: 'Hytteturmodus', text: 'Alle spiller på sin egen telefon.', art: 'hytte', players: '2-10 deltakere' },
];

export function ModeStep() {
  const [mode, setMode] = useState(null);
  const back = () => setStore({ modeStep: false });
  return html`<main class="screen setup">
    <header class="row row--between">
      <${Logo} small onClick=${back} />
    </header>
    <${Steps} current=${1} onBack=${back} />
    <h1 class="setup__title rise-in">Hvordan vil dere spille?</h1>
    <div class="modes" role="radiogroup" aria-label="Spillmodus">
      ${MODES.map(
        (m) => html`<button type="button" role="radio" class=${cx('mode', mode === m.id && 'mode--chosen')} key=${m.id} aria-checked=${mode === m.id} onClick=${() => setMode(m.id)}>
          <span class="mode__chip">${m.players}</span>
          <span class="mode__title display">${m.title}</span>
          <span class="mode__text">${m.text}</span>
          <span class=${`mode__art mode__art--${m.art}`} aria-hidden="true"><img src=${asset(`assets/art/${m.art}.svg`)} alt="" width="400" height="300" decoding="async" /></span>
          <span class="mode__check" aria-hidden="true"></span>
        </button>`,
      )}
    </div>
    <section class="pillars-note" aria-label="Likt i begge">
      <p><b></b>Det er alltid en eller flere impostere.</p>
      <p><b></b>Dere må bli enige om riktig svar.</p>
    </section>
    <div class="dock">
      <${Button} block disabled=${!mode} onClick=${() => actions.create(mode)}>Neste</${Button}>
    </div>
  </main>`;
}
