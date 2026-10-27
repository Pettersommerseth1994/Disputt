// What the animated rules say: the eight steps of a round, in short, with the people and the question the pictures use.
// The written rules (screens/sheets.js) have the same steps. `car` is Bilturmodus (one phone), where a few steps differ.

import { tx } from '../i18n/lang.js';
// (The texts here are marked with tx(): they are translated with t() where they are shown, see story-bord.js and bord.js.)

/** The little cast that plays the game in every picture: five players, one of them (Jonas) is the imposter, Sofie has the question. */
export const CAST = [
  { id: 'lime', name: 'Mari' },
  { id: 'blabaer', name: 'Ola' },
  { id: 'briller', name: 'Sofie' },
  { id: 'mandarin', name: 'Jonas' },
  { id: 'kirsebaer', name: 'Kari' },
];
/** The sixth player, who only comes to the table in the step about two imposters (six or more play: two are imposters). */
export const SIXTH = { id: 'sky', name: 'Lise' };
export const IMPOSTOR = 3;
/** In the next round the imposter is picked at random again: not the same player (so nobody thinks Jonas is always the imposter). */
export const NEW_IMPOSTOR = 1;
export const ASKER = 2;

/** The question every picture uses. B is right; the imposter bluffs for A. */
export const QUESTION = {
  text: tx('Hva er hovedstaden i England?'),
  options: ['Manchester', 'London', 'Liverpool', 'Birmingham'],
  right: 1,
};
export const RIGHT = 'ABCD'[QUESTION.right]; // the letter of the right answer
export const RIGHT_TEXT = `${RIGHT}: ${QUESTION.options[QUESTION.right]}`; // «B: London»
export const BLUFF = 'A'; // what the imposter says

const SLIDES = [
  {
    id: 'roles',
    title: tx('Alle får en rolle'),
    line: tx('Alle får en hemmelig rolle. De fleste er lojale, men én er imposter.'),
    carLine: tx('Send telefonen rundt. Én og én ser rollen sin, og skjuler den igjen.'),
  },
  {
    id: 'secret',
    title: tx('Imposteren får vite riktig svar'),
    // (the answer itself is on the note on the table: the line only says who gets to know it)
    line: tx('Bare imposteren får vite riktig svar. Er dere seks eller flere, er det to impostere, og de vet hvem den andre er.'),
    carLine: tx('Bare imposteren får vite riktig svar. De andre får ikke vite det.'),
  },
  {
    id: 'ask',
    title: tx('Én får spørsmålet'),
    line: tx('Én av dere får spørsmålet og leser det høyt for de andre.'),
    carLine: tx('Verten får telefonen og leser spørsmålet høyt.'),
  },
  {
    id: 'talk',
    title: tx('Diskuter!'),
    line: tx('Diskuter. Imposteren vet svaret og prøver å lure dere til å svare feil.'),
  },
  {
    id: 'lock',
    title: tx('Lås svaret'),
    line: tx('Bli enige og lås svaret. Dere må selv finne ut hvordan dere skal bli enige. Så telles det ned fra 5.'),
    carLine: tx('Verten krysser av når dere er enige. Dere må selv finne ut hvordan dere skal bli enige. Så telles det ned fra 5.'),
  },
  {
    id: 'reveal',
    title: tx('Imposteren avslører seg'),
    line: tx('Imposteren sier riktig svar høyt. Hadde dere rett?'),
  },
  {
    id: 'points',
    title: tx('Poengene deles ut'),
    line: tx('Rett svar: de lojale får 1 poeng.\nFeil svar: imposteren får 1 poeng.'), // (always on two lines)
  },
  {
    id: 'again',
    title: tx('Deretter ny runde'),
    line: tx('Nye roller, nytt spørsmål. Ny imposter velges tilfeldig. Først til målet vinner!'),
    carLine: tx('Telefonen sendes rundt igjen. Ny imposter velges tilfeldig. Først til målet vinner!'),
  },
];

/** The slides for a mode: every one has `n` (its number) and `line`, the one that is said in the mode that is played. */
export function slidesFor({ car = false } = {}) {
  return SLIDES.map((s, i) => ({ ...s, n: i + 1, line: car && s.carLine ? s.carLine : s.line }));
}
