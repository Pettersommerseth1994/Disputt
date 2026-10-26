// «Er du klar?»: the second step of the host's set-up, between the way to play and the profile (nothing exists yet while it is on the screen:
// the game is made when the host goes on, net.js: actions.create(mode)). Sofie, the lady with the glasses, tells in speech bubbles the two things
// everybody must have understood before the first round: that there is ALWAYS one or more imposters among the players, and that the group must AGREE on the
// right answer. The host answers each with a tick («Jeg har skjønt …»), and «Neste» comes alive when both are ticked.
// (A file of its own, with a style sheet of its own that this file loads: pages are cached for ten minutes, and a script and an index.html that are not equally
// new, from the cache, must still work.)

import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { actions } from '../net.js';
import { rich } from '../i18n/rich.js';
import { t } from '../i18n/lang.js';
import { asset } from '../paths.js';
import { setStore, useStore } from '../store.js';
import { Avatar, Button } from '../ui.js';
import { SetupHeader, Steps } from './setup.js';
import { CAR_SEGMENTS } from './steps-count.js';

const HREF = asset('css/ready.css');
let loading = null;
function loadStyles() {
  loading ??= new Promise((resolve) => {
    let link = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => l.href === HREF);
    if (link?.sheet) return resolve(true);
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = HREF;
      document.head.append(link);
    }
    link.addEventListener('load', () => resolve(true), { once: true });
    link.addEventListener('error', () => resolve(false), { once: true });
  });
  return loading;
}
const stylesIn = () => [...document.styleSheets].some((sheet) => sheet.href === HREF);
function useReadyStyles() {
  const [ready, setReady] = useState(stylesIn);
  useEffect(() => {
    if (ready) return undefined;
    let alive = true;
    loadStyles().then((ok) => alive && setReady(ok));
    return () => {
      alive = false;
    };
  }, [ready]);
  return ready;
}

/** The two things Sofie says (their texts are below), each with the picture in its bubble. */
const TALK = [{ art: 'eye-impostor' }, { art: 'eye-right' }];

/** A hand-drawn tick: a marker line that draws itself when its box is checked. */
const Tick = () => html`<svg class="ready-tick" viewBox="0 0 32 28" aria-hidden="true"><path pathLength="1" d="M3.5 15.5 C7.5 18 9.5 21.5 12 26 C16 14 21.5 7 29.5 2" /></svg>`;

function Bubble({ children, art: pic }) {
  return html`<div class="ready-say">
    <${Avatar} id="briller" size="md" class="ready-say__who" />
    <div class="ready-say__bubble">
      <span class="ready-say__text">${children}</span>
      ${pic && html`<img class="ready-say__art" src=${asset(`assets/art/${pic}.svg`)} alt="" width="400" height="300" decoding="async" />`}
    </div>
  </div>`;
}

// (every text is written out here: the dictionaries are found by reading the code)
const talkLine = (i) =>
  i === 0
    ? rich(t('Blant dere gjemmer det seg {mark} en imposter. Kanskje to.'), { mark: html`<b>${t('alltid')}</b>` })
    : rich(t('Imposteren vil lure dere, så dere {mark} om riktig svar.'), { mark: html`<b>${t('må bli enige')}</b>` });
const replyLine = (i) => (i === 0 ? t('Jeg har skjønt at det alltid er en eller flere impostere blant oss.') : t('Jeg har skjønt at vi må bli enige om riktig svar.'));

function Chat({ answered, setAnswered }) {
  const [shown, setShown] = useState(0); // how many of Sofie's bubbles are out (the next one comes after a moment of «skriver …»)
  const [typing, setTyping] = useState(false);
  const end = useRef(null);
  const total = TALK.length;

  useEffect(() => {
    const want = answered + 2; // (the hello and the first rule at once; then one more for every tick, and the last one says «klare»)
    if (shown > want) {
      setShown(want);
      setTyping(false);
      return undefined;
    }
    if (shown === want) {
      setTyping(false);
      return undefined;
    }
    setTyping(true);
    const id = setTimeout(
      () => {
        setTyping(false);
        setShown(shown + 1);
      },
      shown === 0 ? 600 : 950,
    );
    return () => clearTimeout(id);
  }, [answered, shown]);

  // keep the last thing in view
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [shown, typing, answered]);

  const all = answered === total;
  const waiting = !all && shown >= answered + 2; // Sofie has said the next rule and waits for the tick
  return html`<div class="ready-chat" aria-live="polite">
    ${shown > 0 && html`<${Bubble}>${t('Hei, jeg er Sofie! To små ting før dere starter.')}</${Bubble}>`}
    ${TALK.map(
      (m, i) =>
        shown > i + 1 &&
        html`<div class="ready-chat__pair" key=${i}>
          <${Bubble} art=${m.art}>${talkLine(i)}</${Bubble}>
          ${answered > i &&
          html`<button type="button" role="checkbox" aria-checked="true" class="ready-sent" onClick=${() => setAnswered(i)} title=${t('Trykk for å ta det tilbake')}>
            <span class="ready-sent__box" aria-hidden="true"><${Tick} /></span>
            <span>${replyLine(i)}</span>
          </button>`}
        </div>`,
    )}
    ${typing && html`<div class="ready-say ready-say--typing" aria-label=${t('Sofie skriver')}><${Avatar} id="briller" size="md" class="ready-say__who" /><div class="ready-say__bubble ready-say__bubble--dots"><i></i><i></i><i></i></div></div>`}
    ${all && shown > total + 1 && html`<${Bubble}><b>${t('Da er dere klare!')}</b> ${t('Trykk Neste.')}</${Bubble}>`}
    <div class="ready-tray" ref=${end}>
      ${waiting &&
      html`<button type="button" role="checkbox" aria-checked="false" class="ready-reply" key=${answered} onClick=${() => setAnswered(answered + 1)}>
        <span class="ready-reply__box" aria-hidden="true"><${Tick} /></span>
        <span>${replyLine(answered)}</span>
      </button>`}
    </div>
  </div>`;
}

/** The screen. `mode` is the way to play that was chosen (it decides how many segments the bar has). */
export function Ready({ mode, onBack, onNext }) {
  const styled = useReadyStyles();
  const [answered, setAnswered] = useState(0);
  if (!styled) return null;
  const all = answered === TALK.length;
  return html`<main class="screen setup ready">
    <${SetupHeader} />
    <${Steps} current=${2} total=${mode === 'car' ? CAR_SEGMENTS : undefined} onBack=${onBack} />
    <h1 class="setup__title rise-in">${t('Er du klar?')}</h1>
    <${Chat} answered=${answered} setAnswered=${setAnswered} />
    <div class="dock">
      <${Button} block disabled=${!all} variant=${all ? 'lime' : undefined} onClick=${onNext}>${t('Neste')}</${Button}>
    </div>
  </main>`;
}

/** In the app: after the way to play was chosen (store.readyMode), before the game is made. */
export function ReadyStep() {
  const s = useStore();
  const mode = s.readyMode ?? 'cabin';
  return html`<${Ready} mode=${mode} onBack=${() => setStore({ readyStep: false, modeStep: true })} onNext=${() => actions.create(mode)} />`;
}
