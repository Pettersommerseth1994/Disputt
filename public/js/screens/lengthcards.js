// How long to play, as two cards (the two lengths are in lengths.js). They are the step «Hvor lenge skal dere spille?» of the host's set-up and, smaller, the host's option
// for changing it during the game. A tap sends the target to the game. (A file of its own with a style sheet of its own, css/length-cards.css, that it loads itself: pages are cached for ten minutes.)

import { html } from '../vendor/htm-preact.js';
import { t } from '../i18n/lang.js';
import { useStylesheet } from '../css-loader.js';
import { actions } from '../net.js';
import { asset } from '../paths.js';
import { cx } from '../util.js';
import { LENGTHS, lengthOf } from './lengths.js';

/** `sheet`: the smaller cards of the host's options, without the line of advice. */
export function LengthCards({ view, sheet = false }) {
  const mc = useStylesheet(asset('css/mode-cards.css'));
  const gl = useStylesheet(asset('css/length-cards.css'));
  if (!mc || !gl) return null;
  return html`<div class=${cx('mc-stack', 'gl-stack', sheet && 'gl-stack--sheet')} role="radiogroup" aria-label=${t('Hvor lenge skal dere spille?')}>
    ${LENGTHS.map((l) => {
      const chosen = view.target === l.target;
      return html`<button type="button" role="radio" class=${cx('mc-card', `mc-card--${l.tone}`, chosen && 'is-chosen', lengthOf(view.target) && !chosen && 'is-other')} key=${l.id} aria-checked=${chosen} onClick=${() => actions.target(l.target)}>
        <span class="mc-pic" aria-hidden="true">
          <img class="mc-pic__blob" src=${asset(`assets/art/${l.blob}.svg`)} alt="" decoding="async" />
          <img class="gl-pic__art" src=${asset(`assets/art/krangel-${l.id}.webp`)} alt="" width="450" height="522" decoding="async" />
        </span>
        <span class="mc-body gl-body">
          <span class="mc-title gl-title display">${t(l.title)}</span>
          <span class="gl-rows">
            <span class="gl-row"><img class="gl-ico" src=${asset('assets/art/icon-star.webp')} alt="" width="96" height="96" decoding="async" /><span>${t('Første til {n} poeng', { n: l.target })}</span></span>
            <span class="gl-row"><img class="gl-ico" src=${asset('assets/art/icon-clock.webp')} alt="" width="96" height="96" decoding="async" /><span>${t(l.time)}</span></span>
          </span>
          <span class="gl-hint">${t(l.hint)}</span>
        </span>
        <span class="mc-check mc-corner" aria-hidden="true"></span>
      </button>`;
    })}
  </div>`;
}
