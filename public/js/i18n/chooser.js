// «Velg språk · Vælg sprog · Välj språk»: a card that comes up three seconds after the page was opened for the first time, like a cookie banner,
// and asks for Norwegian (the standard), Danish or Swedish. The choice is kept on the phone (lang.js). A little flag on the start screen and a row
// in the settings open the card again (`langOpen` in the store). Closing the card without choosing means Norwegian.

import { setStore, useStore } from '../store.js';
import { Avatar } from '../ui.js';
import { html, useEffect, useRef } from '../vendor/htm-preact.js';
import { Flag } from './flags.js';
import { LANGUAGES, LANGUAGE_CODES, chosenLang, getLang, setLang } from './lang.js';
import { useLangStyles } from './styles.js';

const WAIT_MS = 3000;

/** The card itself. It speaks all three languages at once (nobody has chosen yet), so its words are not translated. */
export function LangChooser() {
  const s = useStore();
  const styled = useLangStyles();
  const card = useRef(null);
  const first = !chosenLang(); // (nobody has chosen: Norwegian is only the standard)

  useEffect(() => {
    if (chosenLang()) return undefined;
    const timer = setTimeout(() => !chosenLang() && setStore({ langOpen: true }), WAIT_MS); // first the screen, then the question
    return () => clearTimeout(timer);
  }, []);

  const open = Boolean(s.langOpen) && styled;
  useEffect(() => {
    if (!open) return undefined;
    card.current?.querySelector('button')?.focus({ preventScroll: true });
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  const choose = (code) => {
    setLang(code);
    setStore({ langOpen: false });
  };
  function close() {
    if (!chosenLang()) setLang('no'); // closed without choosing: Norwegian, and the card does not come back
    setStore({ langOpen: false });
  }
  const now = getLang();
  return html`<div class="lang-back" onClick=${(e) => e.target === e.currentTarget && close()}>
    <div class="lang-card" role="dialog" aria-modal="true" aria-label="Velg språk · Vælg sprog · Välj språk" ref=${card}>
      <${Avatar} id="mandarin" size="md" alive class="lang-card__peek" style="--tilt:12deg" />
      <h2>Velg språk</h2>
      <p class="lang-card__sub">Vælg sprog · Välj språk</p>
      <div class="lang-card__row">
        ${LANGUAGE_CODES.map(
          (code, i) => html`<button type="button" key=${code} lang=${LANGUAGES[code].html} class=${`lang-pick ${code === now ? 'is-now' : ''}`} style=${`--tilt:${[-4, 2, -2][i]}deg`} onClick=${() => choose(code)} aria-current=${!first && code === now ? 'true' : undefined}>
            <${Flag} code=${code} round /><span>${LANGUAGES[code].name}</span>${first && code === 'no' && html`<em>Standard</em>`}
          </button>`,
        )}
      </div>
    </div>
  </div>`;
}

/** The little flag that opens the card again (on the start screen). */
export function LangChip() {
  const styled = useLangStyles();
  const code = getLang();
  if (!styled || !chosenLang()) return null; // (before the first choice the card itself is what asks)
  return html`<button type="button" class="lang-chip" onClick=${() => setStore({ langOpen: true })} aria-label="Velg språk · Vælg sprog · Välj språk">
    <${Flag} code=${code} />${LANGUAGES[code].html === 'nb' ? 'NO' : code.toUpperCase()}
  </button>`;
}
