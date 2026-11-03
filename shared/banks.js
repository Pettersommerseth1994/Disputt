// The question banks, one for each language the game is played in. A room takes its bank from the language its host had chosen when
// the game was made (the Danish and the Swedish bank are not translations only: what is about Norway is exchanged for what is about Denmark or Sweden).
// (A file of its own: browsers may hold an older game.js in their cache for a few minutes after a deploy.)

import { QUESTIONS } from './questions.js';
import { QUESTIONS_DA } from './questions-da.js';
import { QUESTIONS_SV } from './questions-sv.js';
import { WHY_NO } from './why-no.js';
import { WHY_DA } from './why-da.js';
import { WHY_SV } from './why-sv.js';

/** The languages of the game: Norwegian is the one a game has when nothing is said. */
export const LANGUAGES = ['no', 'da', 'sv'];
export const DEFAULT_LANGUAGE = 'no';

export const normalizeLanguage = (lang) => (LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE);

// The box that backs the right answer up ("Visste du det?"): one or two sentences and the source, kept in files of their own
// (why-no.js, why-da.js, why-sv.js, keyed by question id) so the question files stay easy to read. A question without one gets no box.
const withWhy = (bank, why) => bank.map((q) => (why[q.id] ? { ...q, why: why[q.id].why, source: why[q.id].source } : q));

const BANKS = { no: withWhy(QUESTIONS, WHY_NO), da: withWhy(QUESTIONS_DA, WHY_DA), sv: withWhy(QUESTIONS_SV, WHY_SV) };

/** The questions of a language (Norwegian for anything that is not one). */
export const bankFor = (lang) => BANKS[normalizeLanguage(lang)];
