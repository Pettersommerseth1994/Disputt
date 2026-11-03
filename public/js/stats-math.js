// The sums behind the owner's page of numbers (public/stats/, built in tools/stats-ui): from the rows that the payment server gives (GET /stats) to the figures the page
// shows. No page in here, so the tests can run it. docs/STATS.md says what each step means.

export const GAME_STEPS = [
  ['visit', 'Åpnet siden'],
  ['start', 'Trykket «Opprett spill»'],
  ['mode', 'Valgte måten å spille på'],
  ['lobby', 'Spillet ble laget'],
  ['game_start', 'Første runde startet'],
  ['finished', 'Spillet ble spilt ferdig'],
];
export const MODE_NAMES = { cabin: 'Hytteturmodus (hver sin telefon)', car: 'Bilturmodus (én telefon)', '': 'Ikke oppgitt' };
export const LANG_NAMES = { no: 'Norsk', da: 'Dansk', sv: 'Svensk', '': 'Ikke oppgitt' };
export const PLAN_NAMES = { evening: 'En kveld', weekend: 'En helg', year: 'For ett år', '': 'Ikke oppgitt' };
export const METHOD_NAMES = { card: 'Kort (nettbutikken)', vipps: 'Vipps-knappen', '': 'Ikke oppgitt' };

/** Adds up the `n` of the rows that match every key in `where` (a missing key matches anything). */
export function count(events, name, where = {}) {
  let total = 0;
  for (const e of events) if (e.name === name && Object.entries(where).every(([key, value]) => e[key] === value)) total += e.n;
  return total;
}

/** The days from `from` to `to`, as 2026-11-01, oldest first. */
export function daysBetween(from, to) {
  const out = [];
  for (let t = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`); t <= end && out.length < 400; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** A share as text («42 %»), or a dash when there is nothing to divide by. */
export const percent = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)} %` : '–');

/** The paid orders that count (a cancelled or disputed order does not), and what they brought in per currency, in whole units, after refunds. */
export function salesSummary(sales) {
  const kept = sales.filter((s) => s.state === 'paid' || s.state === 'refunded');
  const paid = kept.filter((s) => s.state === 'paid');
  const revenue = {};
  for (const s of paid) revenue[s.currency] = (revenue[s.currency] ?? 0) + Math.max(0, s.amount - s.refunded) / 100;
  const perPlan = {};
  for (const s of paid) perPlan[s.plan] = (perPlan[s.plan] ?? 0) + 1;
  return { orders: paid.length, refunded: kept.length - paid.length, revenue, perPlan };
}

/** Everything the page shows. `data` is what GET /stats answers: { today, from, days, events, sales }. */
export function summarize(data) {
  const { events, sales } = data;
  const sum = salesSummary(sales);
  const total = (name, where) => count(events, name, where);
  const game = GAME_STEPS.map(([name, label]) => ({ name, label, n: total(name) }));
  const pay = [
    { name: 'paywall', label: 'Så pakkene (betalingsvinduet)', n: total('paywall') },
    { name: 'checkout', label: 'Trykket for å betale', n: total('checkout') },
    { name: 'paid', label: 'Betalte', n: sum.orders },
  ];
  const byLang = ['no', 'da', 'sv', ''].filter((lang) => events.some((e) => e.lang === lang)).map((lang) => ({ lang, visit: total('visit', { lang }), lobby: total('lobby', { lang }), game_start: total('game_start', { lang }), paywall: total('paywall', { lang }), checkout: total('checkout', { lang }) }));
  const byMode = ['cabin', 'car'].map((mode) => ({ mode, chosen: total('mode', { mode }), lobby: total('lobby', { mode }), game_start: total('game_start', { mode }), round: total('round', { mode }), finished: total('finished', { mode }), paywall: total('paywall', { mode }) }));
  const checkouts = [];
  for (const e of events) {
    if (e.name !== 'checkout') continue;
    const row = checkouts.find((c) => c.plan === e.plan && c.method === e.method);
    if (row) row.n += e.n;
    else checkouts.push({ plan: e.plan, method: e.method, n: e.n });
  }
  checkouts.sort((a, b) => b.n - a.n);
  const days = daysBetween(data.from, data.today).map((day) => {
    const of = (name) => events.reduce((n, e) => n + (e.day === day && e.name === name ? e.n : 0), 0);
    return { day, visit: of('visit'), lobby: of('lobby'), game_start: of('game_start'), joined: of('joined'), paywall: of('paywall'), checkout: of('checkout'), sold: sales.filter((s) => s.day === day && s.state === 'paid').length };
  });
  return { game, pay, byLang, byMode, checkouts, days, sales: sum, rounds: total('round'), joined: total('joined'), visits: total('visit') };
}
