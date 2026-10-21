// The animated rules: «Rundt bordet». Every card is a step: the number and name on top, the line under it (both fade in at once, to the left),
// and under that the table seen from above, with the players around it and what happens at it in this step.

import { html } from '../vendor/htm-preact.js';
import { Table, beats } from './bord.js';
import { useBeats } from './kit.js';
import { Story } from './story.js';

function Card({ s, held, car }) {
  const b = useBeats(beats(s.id, car), { ms: s.id === 'lock' ? 750 : 1000, hold: 600000, paused: held, key: s.id });
  return html`<header class="rgS__top">
      <h3 class="rgS__head">${s.n}. ${s.title}</h3>
      <p class="rgS__intro">${s.line}</p>
    </header>
    <div class="rgS__table"><${Table} id=${s.id} b=${b} car=${car} /></div>`;
}

/** The seconds of a card: the ones with most going on stay longest. */
const seconds = (car) => (s) => (s.id === 'lock' || s.id === 'talk' || s.id === 'secret' || (car && s.id === 'roles') ? 8 : 6.5);

export const RulesStory = ({ start, slides, car, how, onDone }) => html`<${Story}
  start=${start}
  slides=${slides}
  onDone=${onDone}
  seconds=${seconds(car)}
  Card=${Card}
  cardProps=${{ car }}
  class=${`rgS--bord ${how ? 'rgS--how' : ''}`}
/>`;
