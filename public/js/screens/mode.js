// The first step of the host's set-up: how to play. The same game two ways, both for two to ten players: on ONE phone, the host's, that is sent round the
// table (bilturmodus inside: `car`), or a phone each (hytteturmodus inside: `cabin`). Nothing exists yet while this is on the screen: the game is made
// when the host goes on (net.js: actions.create(mode)), and "back" is simply the start screen.
// Two wide cards, one above the other: a huge phone with a «1» that swings between two avatars, or four phones that each have an avatar and light up in turn.
// (A file of its own with a style sheet of its own, css/mode-cards.css, that it loads itself: pages are cached for ten minutes.)

import { html, useState } from '../vendor/htm-preact.js';
import { t, tx } from '../i18n/lang.js';
import { useStylesheet } from '../css-loader.js';
import { asset } from '../paths.js';
import { setStore, store } from '../store.js';
import { Avatar, Button, Logo } from '../ui.js';
import { cx } from '../util.js';
import { Steps } from './setup.js';
import { CAR_SEGMENTS } from './steps-count.js';

export const MODES = [
  { id: 'car', title: tx('På én telefon'), text: tx('Én telefon som sendes rundt mellom dere.'), hint: tx('Passer best for bilturen'), art: 'bil', blob: 'blob-6' },
  { id: 'cabin', title: tx('På hver sin telefon'), text: tx('Alle spiller på sin egen telefon.'), hint: tx('Passer best for hytteturen'), art: 'hytte', blob: 'blob-4' },
];

const FACES = ['lime', 'mandarin', 'blabaer', 'leppa', 'sol', 'drue', 'sky', 'kirsebaer'];
const ONE_FACES = ['mandarin', 'blabaer'];
const EACH_FACES = ['lime', 'leppa', 'sol', 'drue'];

const Phone = ({ cls, children }) => html`<span class=${cx('mc-phone', cls)} aria-hidden="true">${children}</span>`;

/** One big phone with a «1» that swings between two avatars (the one it comes to jumps), or four phones that each have an avatar and light up in turn. */
function One() {
  return html`<span class="mc-one" aria-hidden="true">
    <span class="mc-one__av mc-one__av--l"><${Avatar} id=${ONE_FACES[0]} style="--size:var(--avs)" /></span>
    <span class="mc-one__av mc-one__av--r"><${Avatar} id=${ONE_FACES[1]} style="--size:var(--avs)" /></span>
    <span class="mc-one__sway"><${Phone} cls="mc-phone--lit"><span class="mc-digit display">1</span></${Phone}></span>
  </span>`;
}
function Many() {
  return html`<span class="mc-many" aria-hidden="true">
    ${EACH_FACES.map((a, i) => html`<span class="mc-many__cell" key=${a} style=${`--i:${i}`}><${Phone}><${Avatar} id=${a} style="--size:calc(var(--pw) * 0.62)" /></${Phone}></span>`)}
  </span>`;
}

export function ModeStep() {
  const ready = useStylesheet(asset('css/mode-cards.css'));
  const [mode, setMode] = useState(store.modeChoice);
  if (!ready) return null;
  const back = () => setStore({ modeStep: false });
  return html`<main class="screen setup mc-root">
    <header class="row row--between">
      <${Logo} small onClick=${back} />
    </header>
    <${Steps} current=${1} total=${mode === 'car' ? CAR_SEGMENTS : undefined} onBack=${back} />
    <h1 class="setup__title rise-in">${t('Hvordan vil dere spille?')}</h1>
    <div class="mc-stack" role="radiogroup" aria-label=${t('Spillmodus')}>
      ${MODES.map(
        (m) => html`<button type="button" role="radio" class=${cx('mc-card', `mc-card--${m.id === 'car' ? 'one' : 'each'}`, mode === m.id && 'is-chosen', mode && mode !== m.id && 'is-other')} key=${m.id} aria-checked=${mode === m.id} onClick=${() => setMode(m.id)}>
          <span class=${cx('mc-pic', `mc-pic--${m.id === 'car' ? 'one' : 'each'}`)} aria-hidden="true">
            <img class="mc-pic__blob" src=${asset(`assets/art/${m.blob}.svg`)} alt="" decoding="async" />
            ${m.id === 'car' ? html`<${One} />` : html`<${Many} />`}
          </span>
          <span class="mc-body">
            <span class="mc-title display">${t(m.title)}</span>
            <span class="mc-text">${t(m.text)}</span>
            <span class="mc-hint"><img class="mc-artdot" src=${asset(`assets/art/${m.art}.svg`)} alt="" width="400" height="300" decoding="async" /><span>${t(m.hint)}</span></span>
          </span>
          <span class="mc-check mc-corner" aria-hidden="true"></span>
        </button>`,
      )}
    </div>
    <div class="mc-crowd">
      <span class="mc-crowd__faces" aria-hidden="true">${FACES.map((f) => html`<${Avatar} key=${f} id=${f} size="xs" />`)}</span>
      <span class="mc-chip">${t('2-10 deltakere')}</span>
    </div>
    <div class="dock">
      <${Button} block disabled=${!mode} onClick=${() => setStore({ modeStep: false, readyStep: true, readyMode: mode, modeChoice: mode })}>${t('Neste')}</${Button}>
    </div>
  </main>`;
}
