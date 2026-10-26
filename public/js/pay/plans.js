// The packages a host can buy, and what is said about them. The prices here are what the page shows; what Stripe charges is
// decided by the prices set up in the Stripe dashboard, and the payment server refuses a purchase whose amount is not the one
// below (payments/worker.js has the same amounts, and test/pay.test.js checks that the two files agree).
// (A file of its own: pages are cached for ten minutes ...)
//
// The texts here are Norwegian and are marked with tx(): the screens translate them with t() where they are shown (t(plan.name), t(plan.length) ...).

import { localeOf, t, tx } from '../i18n/lang.js';
import { withCurrency } from './currency.js';

export const PLANS = [
  {
    id: 'evening',
    name: tx('En kveld'),
    price: 149,
    length: tx('12 timer'),
    badge: tx('Mest populær'),
  },
  {
    id: 'weekend',
    name: tx('En helg'),
    price: 199,
    length: tx('72 timer'),
  },
  {
    id: 'year',
    name: tx('For ett år'),
    price: 299,
    length: tx('12 måneder'),
  },
];

/** Not for sale since 2026-10-20, but what a host who bought it earlier has on their phone is still told by name. */
const RETIRED_PLANS = [
  {
    id: 'lifetime',
    name: tx('Livstid'),
    price: 299,
    length: tx('Én betaling'),
    detail: tx('Betal én gang, spill for alltid. Gjelder så lenge Disputt finnes.'),
  },
];

/** The package that is chosen when the page opens. */
export const DEFAULT_PLAN = 'evening';

export const planById = (id) => PLANS.find((p) => p.id === id) ?? RETIRED_PLANS.find((p) => p.id === id) ?? null;

/** «149 kr» (Norwegian) or «149 NOK» (Danish, Swedish): pay/currency.js decides. */
export const formatPrice = (kroner) => withCurrency(kroner);

// (the formatters follow the language of the phone, so they are made when they are needed, not when the file loads)
const formatters = new Map();
const formatter = (kind, options) => {
  const key = `${localeOf()}:${kind}`;
  if (!formatters.has(key)) formatters.set(key, new Intl.DateTimeFormat(localeOf(), options));
  return formatters.get(key);
};
const DATE = { format: (d) => formatter('date', { day: 'numeric', month: 'long', year: 'numeric' }).format(d) };
const CLOCK = { format: (d) => formatter('clock', { hour: '2-digit', minute: '2-digit' }).format(d) };

/** "Gjelder til kl. 22:14", "Gjelder til i morgen kl. 02:14", "Gjelder til 4. oktober 2027" or "Gjelder for alltid". */
export function describeValidity(pass, now = Date.now()) {
  if (!pass) return '';
  if (pass.expiresAt === null) return t('Gjelder for alltid');
  const end = new Date(pass.expiresAt);
  const day = (d) => new Date(d).setHours(0, 0, 0, 0);
  const days = Math.round((day(end) - day(now)) / 86_400_000);
  if (days === 0) return t('Gjelder til kl. {time}', { time: CLOCK.format(end) });
  if (days === 1) return t('Gjelder til i morgen kl. {time}', { time: CLOCK.format(end) });
  return t('Gjelder til {date}', { date: DATE.format(end) });
}
