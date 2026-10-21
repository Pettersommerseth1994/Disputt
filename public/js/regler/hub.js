// The rules, animated first. Wherever the game explains itself (the sheet «Slik spiller dere», and the last step of the set-up of Bilturmodus)
// the story comes first, and the written rules are one tap away («Les reglene») and back again («Se animasjon»).

import { html, useState } from '../vendor/htm-preact.js';
import { Button } from '../ui.js';
import { slidesFor } from './content.js';
import { RulesStory } from './story-bord.js';
import { useReglerStyles } from './styles.js';

/** For the QA tools: ?steg=4 opens at the fourth step. */
const startAt = () => {
  try {
    return Math.max(0, Number(new URLSearchParams(location.search).get('steg')) - 1) || 0;
  } catch {
    return 0;
  }
};

/** `text` is the written rules (what the sheet had before), shown when the reader asks for it. `how` is the short version for the set-up. */
export function RulesHub({ car = false, how = false, text, onDone = null }) {
  const ready = useReglerStyles();
  const [written, setWritten] = useState(false);
  if (!ready) return null;
  return html`<div class="rg">
    ${written
      ? html`<div class="rg__text">${text}</div>`
      : html`<${RulesStory} key=${`${car}-${how}`} start=${startAt()} slides=${slidesFor({ car, how })} car=${car} how=${how} onDone=${onDone} />`}
    <div class="rg__switch">
      <${Button} variant="text" size="small" onClick=${() => setWritten(!written)}>${written ? 'Se animasjon' : 'Les reglene'}</${Button}>
    </div>
  </div>`;
}
