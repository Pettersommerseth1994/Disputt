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
export const percent = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}\u00a0%` : '–'); // (a non-breaking space before %, the Norwegian way)

const DAY_SHORT = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const DAY_LONG = new Intl.DateTimeFormat('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
/** A day as the Norwegians write it: «3. nov.», or «tir. 3. nov.» with the weekday. `day` is 2026-11-03. */
export const formatDay = (day, withWeekday = false) => (withWeekday ? DAY_LONG : DAY_SHORT).format(new Date(`${day}T12:00:00Z`));

/** The paid orders that count (a cancelled or disputed order does not), and what they brought in per currency, in whole units, after refunds. */
export function salesSummary(sales) {
  const kept = sales.filter((s) => s.state === 'paid' || s.state === 'refunded');
  const paid = kept.filter((s) => s.state === 'paid');
  const revenue = {};
  for (const s of paid) revenue[s.currency] = (revenue[s.currency] ?? 0) + Math.max(0, s.amount - s.refunded) / 100;
  const perPlan = {};
  const perPlanIncome = {}; // (in whole units of the order's own currency, after refunds)
  for (const s of paid) {
    perPlan[s.plan] = (perPlan[s.plan] ?? 0) + 1;
    perPlanIncome[s.plan] = (perPlanIncome[s.plan] ?? 0) + Math.max(0, s.amount - s.refunded) / 100;
  }
  return { orders: paid.length, refunded: kept.length - paid.length, revenue, perPlan, perPlanIncome };
}

/** The change from `before` to `now` in whole percent, or null when there is nothing to compare with. */
export const change = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

/** `part` per `whole` with one decimal (3,2), or null when there is no whole. */
export const ratio = (part, whole) => (whole > 0 ? Math.round((part / whole) * 10) / 10 : null);

const dayBefore = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/**
 * `data` holds up to twice `days` days (the page asks for that, so that there is something to compare with): this splits it into the last `days`
 * days and the same number of days before them. `previous` is null unless the counting had started before the first of those days
 * (a comparison with a period that was only half counted would say that things have grown when they have not).
 */
export function splitPeriods(data, days) {
  const all = daysBetween(data.from, data.today);
  const cut = all.length > days ? all[all.length - days] : data.from;
  const current = { ...data, from: cut, days: Math.min(days, all.length), events: data.events.filter((e) => e.day >= cut), sales: data.sales.filter((o) => o.day >= cut) };
  const first = data.events.reduce((min, e) => (min === '' || e.day < min ? e.day : min), '');
  if (all.length <= days || !first || first > data.from) return { current, previous: null };
  const events = data.events.filter((e) => e.day < cut);
  const sales = data.sales.filter((o) => o.day < cut);
  return { current, previous: { ...data, today: dayBefore(cut), days: all.length - days, events, sales } };
}

export const WEEKDAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];

/** Everything the page shows. `data` is what GET /stats answers: { today, from, days, events, sales }. */
export function summarize(data) {
  const { events, sales } = data;
  const sum = salesSummary(sales);
  const total = (name, where) => count(events, name, where);
  const game = GAME_STEPS.map(([name, label]) => ({ name, label, n: total(name) }));
  // The game was counted from `first` on, the orders go back further: the funnel only takes the orders from the day the counting started,
  // or "paid" would be set against "saw the packages" from a shorter period (and could come out above 100 %).
  const first = events.reduce((min, e) => (min === '' || e.day < min ? e.day : min), '');
  const paidSinceCounting = first ? salesSummary(sales.filter((o) => o.day >= first)).orders : 0;
  const pay = [
    { name: 'paywall', label: 'Så pakkene (betalingsvinduet)', n: total('paywall') },
    { name: 'checkout', label: 'Trykket for å betale', n: total('checkout') },
    { name: 'paid', label: 'Betalte', n: paidSinceCounting },
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
    const paidThatDay = sales.filter((o) => o.day === day && o.state === 'paid');
    return {
      day,
      visit: of('visit'),
      lobby: of('lobby'),
      game_start: of('game_start'),
      joined: of('joined'),
      round: of('round'),
      paywall: of('paywall'),
      checkout: of('checkout'),
      sold: paidThatDay.length,
      income: paidThatDay.reduce((n, o) => n + Math.max(0, o.amount - o.refunded) / 100, 0),
    };
  });
  // by the day of the week (Monday first): where the weekend shows
  const weekdays = WEEKDAYS.map((name, i) => {
    const mine = days.filter((d) => (new Date(`${d.day}T12:00:00Z`).getUTCDay() + 6) % 7 === i);
    const add = (key) => mine.reduce((n, d) => n + d[key], 0);
    return { name, visit: add('visit'), lobby: add('lobby'), round: add('round'), sold: add('sold') };
  });
  // how many played when the first round began (only games counted since this was added), and which length they chose
  const players = Array.from({ length: 9 }, (_, i) => {
    const size = i + 2;
    const cabin = total(`players_${size}`, { mode: 'cabin' });
    const car = total(`players_${size}`, { mode: 'car' });
    return { size, cabin, car, other: total(`players_${size}`) - cabin - car, total: total(`players_${size}`) };
  });
  const countedGames = players.reduce((n, p) => n + p.total, 0);
  const lengths = [
    { id: 'lite', label: 'Småkrangel', hint: 'første til 8 poeng, ca. 1 time', n: total('length_8') },
    { id: 'stor', label: 'Storkrangel', hint: 'første til 12 poeng, ca. 2 timer', n: total('length_12') },
    { id: 'other', label: 'Annen lengde', hint: 'et annet poengmål enn de to kortene', n: total('length_other') },
  ];
  // the round that the host had got to when the packages came on screen (paywall_round_1 ... 10, and 11 or more)
  const paywallRounds = [
    ...Array.from({ length: 10 }, (_, i) => ({ round: i + 1, label: `Runde ${i + 1}`, n: total(`paywall_round_${i + 1}`) })),
    { round: 11, label: 'Runde 11 eller senere', n: total('paywall_round_more') },
  ].filter((r) => r.n > 0);
  const lobbies = total('lobby');
  const firstRounds = total('game_start');
  const kpi = {
    guestsPerGame: ratio(total('joined'), lobbies), // guests who came in with the QR code, per game that was made
    roundsPerGame: ratio(total('round'), firstRounds),
    finishRate: percent(total('finished'), firstRounds),
    averageOrder: sum.orders ? Math.round((sum.revenue.NOK ?? 0) / sum.orders) : null, // (kroner)
  };
  kpi.playersPerGame = countedGames ? Math.round((players.reduce((n, p) => n + p.size * p.total, 0) / countedGames) * 10) / 10 : null;
  return { game, pay, byLang, byMode, checkouts, days, weekdays, kpi, players, lengths, countedGames, paywallRounds, sales: sum, rounds: total('round'), joined: total('joined'), visits: total('visit'), games: lobbies, firstRounds, first, paidBeforeCounting: sum.orders - paidSinceCounting };
}
