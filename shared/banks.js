// The question banks, one for each language the game is played in. A room takes its bank from the language its host had chosen when
// the game was made (the Danish and the Swedish bank are not translations only: what is about Norway is exchanged for what is about Denmark or Sweden).
// (A file of its own: browsers may hold an older game.js in their cache for a few minutes after a deploy.)

import { QUESTIONS } from './questions.js';
import { QUESTIONS_DA } from './questions-da.js';
import { QUESTIONS_SV } from './questions-sv.js';

/** The languages of the game: Norwegian is the one a game has when nothing is said. */
export const LANGUAGES = ['no', 'da', 'sv'];
export const DEFAULT_LANGUAGE = 'no';

export const normalizeLanguage = (lang) => (LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE);

const BANKS = { no: QUESTIONS, da: QUESTIONS_DA, sv: QUESTIONS_SV };

/** The questions of a language (Norwegian for anything that is not one). */
export const bankFor = (lang) => BANKS[normalizeLanguage(lang)];
