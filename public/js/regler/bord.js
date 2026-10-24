// The table seen from above, the players around it, and what happens at it in each step (drawn from the beat `b`, see kit.js).
// The roles are on the cards the whole time: they are shown from the moment they are dealt. The players talk in their own bubbles.

import { html } from '../vendor/htm-preact.js';
import { t } from '../i18n/lang.js';
import { ASKER, BLUFF, CAST, IMPOSTOR, NEW_IMPOSTOR, QUESTION, RIGHT, RIGHT_TEXT, SIXTH } from './content.js';
import { Bubble, Person, Pic } from './kit.js';

const BEATS = { roles: 3, secret: 5, ask: 3, talk: 5, lock: 7, reveal: 4, points: 5, again: 4 };
/** How many beats a step has: the phone goes round the table in Bilturmodus (and a car holds five at most: no two imposters). */
export const beats = (id, car) => (car && id === 'roles' ? 6 : car && id === 'secret' ? 3 : BEATS[id]);

/** Where the five sit around the table, in percent of the table's box (an ellipse), and where six sit. */
const SEAT = [
  [25, 20],
  [75, 20],
  [90, 74],
  [50, 90],
  [10, 74],
];
const SEAT6 = [
  [30, 17],
  [70, 17],
  [90, 50],
  [70, 83],
  [30, 83],
  [10, 50],
];
const SIX_AT = [0, 1, 2, 3, 5, 4]; // the seat of each of the six at the table of six: Lise (the sixth) sits next to Jonas
/** Which side of the player the card with the role is on: towards the table at the edges, away from the neighbour above and below. */
const side = (x) => (x <= 15 ? 'is-r' : x >= 85 ? 'is-l' : x < 50 ? 'is-l' : 'is-r');
/** What the players say in the step «Diskuter» (who, and the text: made when it is drawn, so that it is in the language of the phone). */
const says = () => [
  [0, `${BLUFF}?`],
  [1, t('Nei, {svar}!', { svar: RIGHT })],
  [3, t('{svar}! Helt sikkert!', { svar: BLUFF })],
  [4, t('Jeg tror {svar}.', { svar: RIGHT })],
];

export function Table({ id, b, car }) {
  const six = id === 'secret' && !car && b >= 3;
  const players = six ? [...CAST, SIXTH] : CAST;
  const seat = (i) => (six ? SEAT6[SIX_AT[i]] : SEAT[(i + (id === 'again' && b >= 1 ? 1 : 0)) % 5]);
  const [sayWho, sayText] = says()[Math.min(Math.max(b - 1, 0), 3)];
  const talking = id === 'talk' && b >= 1 ? sayWho : -1;
  const right = id === 'points' && b >= 1 && b <= 2;
  const wrong = id === 'points' && b >= 3;
  const cards = id === 'secret' || id === 'again' || (id === 'roles' && b >= 1); // the roles are shown from the moment they are dealt
  const imp = (i) => i === (id === 'again' ? NEW_IMPOSTOR : IMPOSTOR) || (id !== 'again' && i === 5); // (a new round has a new imposter)
  return html`<div class=${`rgE__table rgE--${id}`}>
    <div class="rgE__top" aria-hidden="true"></div>
    ${six && b >= 4 && html`<div class="rgE__linkline" aria-hidden="true"></div>`}
    ${players.map((p, i) => {
      const [x, y] = seat(i);
      const chip = (right && !imp(i)) || (wrong && i === IMPOSTOR);
      const spot = (id === 'ask' && i === ASKER) || (id === 'reveal' && i === IMPOSTOR && b >= 1) || (id === 'secret' && imp(i) && b >= 1);
      return html`<div key=${i} class=${`rgE__seat ${i === talking ? 'is-talking' : ''} ${spot ? 'is-spot' : ''} ${i === 5 ? 'is-new' : ''}`} style=${`--x:${x}%;--y:${y}%`}>
        <${Person} i=${i} size=${3.72} person=${p} />
        ${cards && html`<span class=${`rgE__card ${imp(i) ? 'is-red' : ''} ${side(x)}`} style=${`--i:${i}`}><${Pic} name=${imp(i) ? 'eye-impostor' : 'eye-loyal'} /><em>${imp(i) ? t('Imposter') : t('Lojal')}</em></span>`}
        ${chip && html`<span class="rgE__chip">+1</span>`}
      </div>`;
    })}
    ${id === 'roles' && car && html`<span class="rgE__phone" style=${`--x:${seat(Math.min(b, 4))[0]}%;--y:${seat(Math.min(b, 4))[1]}%`} aria-hidden="true"><i></i></span>`}
    ${id === 'secret' && b >= 1 && html`<div class="rgE__note"><${Pic} name="eye-impostor" /><b>${t('Bare imposteren ser')}</b><span>${t('Riktig svar')}</span><i class="rgE__noteans"><u>${RIGHT}</u>${QUESTION.options[QUESTION.right]}</i></div>`}
    ${six && b >= 4 && html`<span class="rgE__link">${t('De vet om hverandre')}</span>`}
    ${id === 'ask' && html`<div class=${`rgE__q ${b >= 0 ? 'is-in' : ''}`}><b>${t(QUESTION.text)}</b><span class=${`rgE__opts ${b >= 1 ? 'is-in' : ''}`}>${[0, 2].map((r) => html`<span key=${r}>${QUESTION.options.slice(r, r + 2).map((o, k) => html`<i key=${k}><u>${'ABCD'[r + k]}</u>${o}</i>`)}</span>`)}</span></div>`}
    ${id === 'talk' && b >= 1 && html`<${Bubble} key=${b} tail="down" tone=${sayWho === IMPOSTOR ? 'red' : 'cream'} class="rgE__say" style=${`--bx:${seat(sayWho)[0]}%;--by:${seat(sayWho)[1]}%`}>${sayText}</${Bubble}>`}
    ${id === 'lock' && html`<div class="rgE__mid"><span class=${`rgE__tick ${b >= 1 ? 'is-in' : ''}`}>${RIGHT_TEXT}</span>${b >= 2 && html`<b class="rgE__five" key=${b}>${7 - b}</b>`}</div>`}
    ${id === 'reveal' && html`<div class="rgE__mid"><${Pic} name="lips" class=${b >= 1 ? 'is-in' : ''} />${b >= 2 && html`<${Bubble} tail="up" tone="red" class="rgE__ans">${RIGHT_TEXT}!</${Bubble}>`}${b >= 3 && html`<span class="rg-stamp">${t('Dere hadde rett!')}</span>`}</div>`}
    ${id === 'points' && html`<div class="rgE__mid"><em>${wrong ? t('Feil svar') : t('Rett svar')}</em></div>`}
    ${id === 'again' && b >= 2 && html`<div class="rgE__mid"><${Pic} name="crown" /><span>${t('Først til 5 poeng')}</span></div>`}
  </div>`;
}
