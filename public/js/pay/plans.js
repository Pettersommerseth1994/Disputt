// The packages a host can buy, and what is said about them. The prices here are what the page shows; what Stripe charges is
// decided by the prices set up in the Stripe dashboard, and the payment server refuses a purchase whose amount is not the one
// below (payments/worker.js has the same amounts, and test/pay.test.js checks that the two files agree).
// (A file of its own: pages are cached for ten minutes ...)

export const PLANS = [
  {
    id: 'evening',
    name: 'En kveld',
    price: 89,
    length: '12 timer',
    detail: 'Til én spillekveld. Gjelder i 12 timer fra du betaler, og fornyes ikke av seg selv.',
  },
  {
    id: 'year',
    name: 'For ett år',
    price: 249,
    length: '12 måneder',
    detail: 'For faste spillekvelder. Gjelder i 12 måneder fra du betaler, og fornyes ikke av seg selv.',
    badge: 'Mest populær',
  },
  {
    id: 'lifetime',
    name: 'Livstid',
    price: 299,
    length: 'Én betaling',
    detail: 'Betal én gang, spill for alltid. Gjelder så lenge Disputt finnes.',
    badge: 'Best verdi',
  },
];

/** The package that is chosen when the page opens. */
export const DEFAULT_PLAN = 'year';

export const planById = (id) => PLANS.find((p) => p.id === id) ?? null;

/** What every package gives. Only the host pays: the others play for free, whatever the host has bought. */
export const PERKS = [
  ['Så mange runder dere vil', 'Ingen grense på antall runder eller spørsmål.'],
  ['Bare verten betaler', 'De andre spiller gratis, på sine egne telefoner.'],
  ['Ingen konto', 'Ingen passord å huske: du får en kode som gir deg tilgangen tilbake på en annen telefon.'],
  ['Én betaling', 'Ikke et abonnement, og ingenting fornyes av seg selv.'],
];

export const formatPrice = (kroner) => `${kroner} kr`;

const DATE = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
const CLOCK = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit' });

/** "Gjelder til kl. 22:14", "Gjelder til i morgen kl. 02:14", "Gjelder til 4. oktober 2027" or "Gjelder for alltid". */
export function describeValidity(pass, now = Date.now()) {
  if (!pass) return '';
  if (pass.expiresAt === null) return 'Gjelder for alltid';
  const end = new Date(pass.expiresAt);
  const day = (d) => new Date(d).setHours(0, 0, 0, 0);
  const days = Math.round((day(end) - day(now)) / 86_400_000);
  if (days === 0) return `Gjelder til kl. ${CLOCK.format(end)}`;
  if (days === 1) return `Gjelder til i morgen kl. ${CLOCK.format(end)}`;
  return `Gjelder til ${DATE.format(end)}`;
}
