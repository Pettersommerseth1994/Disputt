// The rules, animated. Wherever the game explains itself (the sheet «Slik spiller dere») there is the story and nothing else: no written
// version beside it, and nothing to scroll.

import { html } from '../vendor/htm-preact.js';
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

export function RulesHub({ car = false, onDone = null }) {
  const ready = useReglerStyles();
  if (!ready) return null;
  return html`<${RulesStory} key=${car} start=${startAt()} slides=${slidesFor({ car })} car=${car} onDone=${onDone} />`;
}
