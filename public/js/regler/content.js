// What the animated rules say: the eight steps of a round, in short, with the people and the question the pictures use.
// The written rules (screens/sheets.js) have the same steps. `car` is Bilturmodus (one phone), where a few steps differ.
// «Hvordan» (`how`) is the short version for the last step of the set-up: three of the steps.

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
export const ASKER = 2;

/** The question every picture uses. B is right; the imposter bluffs for A. */
export const QUESTION = {
  text: 'Hva er hovedstaden i England?',
  options: ['Manchester', 'London', 'Liverpool', 'Birmingham'],
  right: 1,
};
export const RIGHT = 'ABCD'[QUESTION.right]; // the letter of the right answer
export const RIGHT_TEXT = `${RIGHT}: ${QUESTION.options[QUESTION.right]}`; // «B: London»
export const BLUFF = 'A'; // what the imposter says

const SLIDES = [
  {
    id: 'roles',
    title: 'Alle får en rolle',
    line: 'Alle får en hemmelig rolle. De fleste er lojale, men én er imposter.',
    carLine: 'Send telefonen rundt. Én og én ser rollen sin, og skjuler den igjen.',
  },
  {
    id: 'secret',
    title: 'Imposteren får vite riktig svar',
    line: `Bare imposteren får vite riktig svar: ${RIGHT_TEXT}. Er dere seks eller flere, er det to imposterer, og de vet hvem den andre er.`,
    carLine: `Bare imposteren får vite riktig svar: ${RIGHT_TEXT}. De andre får ikke vite det.`,
  },
  {
    id: 'ask',
    title: 'Én får spørsmålet',
    line: 'Én av dere får spørsmålet og leser det høyt for de andre.',
    carLine: 'Verten får telefonen og leser spørsmålet høyt.',
  },
  {
    id: 'talk',
    title: 'Diskuter!',
    line: 'Diskuter. Imposteren vet svaret og prøver å lure dere til å svare feil.',
  },
  {
    id: 'lock',
    title: 'Lås svaret',
    line: 'Bli enige og lås svaret. Dere må selv finne ut hvordan dere skal bli enige. Så telles det ned fra 5.',
    carLine: 'Verten krysser av når dere er enige. Dere må selv finne ut hvordan dere skal bli enige. Så telles det ned fra 5.',
  },
  {
    id: 'reveal',
    title: 'Imposteren avslører seg',
    line: 'Imposteren sier riktig svar høyt. Hadde dere rett?',
  },
  {
    id: 'points',
    title: 'Poengene deles ut',
    line: 'Rett svar: de lojale får 1 poeng. Feil svar: imposteren får 1 poeng.',
  },
  {
    id: 'again',
    title: 'Deretter ny runde',
    line: 'Nye roller, nytt spørsmål. Først til målet vinner!',
    carLine: 'Telefonen sendes rundt igjen. Først til målet vinner!',
  },
];

/** The steps of the short version: the roles, the talk, and the end of the round. */
const HOW = ['roles', 'talk', 'reveal'];

/** The slides for a mode: every one has `n` (its number in the list that is shown) and `line`, the one that is said in the mode that is played. */
export function slidesFor({ car = false, how = false } = {}) {
  return SLIDES.filter((s) => !how || HOW.includes(s.id)).map((s, i) => ({ ...s, n: i + 1, line: car && s.carLine ? s.carLine : s.line }));
}
