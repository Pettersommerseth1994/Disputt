// What the page counts and the owner's sums: public/js/stats.js, stats-watch.js, stats-math.js, and the places that must carry them.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { beforeEach, describe, it } from 'node:test';
import { change, daysBetween, percent, ratio, salesSummary, splitPeriods, summarize } from '../public/js/stats-math.js';

// (a pretend browser: the page modules read these when they are loaded, so this comes first)
const memory = () => {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => void data.set(k, String(v)), removeItem: (k) => void data.delete(k) };
};
globalThis.sessionStorage = memory();
globalThis.localStorage = memory();
globalThis.location = { hostname: 'disputt.site', search: '', pathname: '/', hash: '' };
globalThis.window = { location: globalThis.location, scrollTo() {} };
globalThis.document = { visibilityState: 'visible', addEventListener() {} };
const { optedOut, statsBody } = await import('../public/js/stats.js');
const { observe, resetWatch } = await import('../public/js/stats-watch.js');

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('who is not counted', () => {
  it('nobody who says «do not track», and no development machine', () => {
    assert.equal(optedOut({ doNotTrack: '1' }, { hostname: 'disputt.site' }), true);
    assert.equal(optedOut({ globalPrivacyControl: true }, { hostname: 'disputt.site' }), true);
    for (const hostname of ['localhost', '127.0.0.1', '[::1]', 'game.localhost', 'x.test']) assert.equal(optedOut({}, { hostname }), true, hostname);
    assert.equal(optedOut({ doNotTrack: '0' }, { hostname: 'disputt.site' }), false);
    assert.equal(optedOut({}, { hostname: 'disputt.site' }), false);
  });

  it('sends the event, the language and three small labels, and nothing else', () => {
    assert.deepEqual(JSON.parse(statsBody('checkout', { p: 'year', x: 'vipps' }, 'da')), { n: 'checkout', l: 'da', m: '', p: 'year', x: 'vipps' });
    assert.deepEqual(Object.keys(JSON.parse(statsBody('visit', {}, 'no'))), ['n', 'l', 'm', 'p', 'x']);
  });
});

describe('the steps that are counted', () => {
  let sent;
  const send = (name, extra = {}) => sent.push([name, extra.m ?? '']);
  const host = (phase, extra = {}) => ({ code: 'KFTR', mode: 'car', phase, round: 0, you: { isHost: true }, ...extra });
  beforeEach(() => {
    resetWatch();
    sent = [];
  });

  it('counts a new visitor once, and not a guest from the QR code or a player coming back', () => {
    observe({ route: { page: 'home' }, session: null }, send);
    observe({ route: { page: 'home' }, session: null }, send);
    assert.deepEqual(sent, [['visit', '']]);
    resetWatch();
    sent = [];
    observe({ route: { page: 'join' }, session: null }, send);
    resetWatch();
    observe({ route: { page: 'home' }, session: { code: 'KFTR' } }, send);
    assert.deepEqual(sent, []);
  });

  it('follows the host from «Opprett spill» to the end of the game, each step once', () => {
    const home = { route: { page: 'home' }, session: { code: 'x' } }; // (no «visit» in this walk)
    observe({ ...home, modeStep: true }, send);
    observe({ ...home, modeStep: true }, send);
    observe({ ...home, readyStep: true, readyMode: 'cabin' }, send);
    observe({ ...home, view: host('lobby', { mode: 'cabin' }) }, send);
    observe({ ...home, view: host('lobby', { mode: 'cabin' }) }, send);
    const four = { players: [{}, {}, {}, {}], target: 12 }; // (four players, «Storkrangel»)
    observe({ ...home, view: host('role', { mode: 'cabin', round: 1, ...four }) }, send);
    observe({ ...home, view: host('question', { mode: 'cabin', round: 1, ...four }) }, send);
    observe({ ...home, view: host('role', { mode: 'cabin', round: 2 }) }, send);
    observe({ ...home, view: host('finished', { mode: 'cabin', round: 2 }) }, send);
    observe({ ...home, view: host('finished', { mode: 'cabin', round: 2 }) }, send);
    assert.deepEqual(sent, [['start', ''], ['mode', 'cabin'], ['lobby', 'cabin'], ['game_start', 'cabin'], ['players_4', 'cabin'], ['length_12', 'cabin'], ['round', 'cabin'], ['round', 'cabin'], ['finished', 'cabin']]);
  });

  it('counts the number of players and the length once, when the first round begins, and puts an unusual length or a crowd that does not fit under «other»', () => {
    const home = { route: { page: 'home' }, session: { code: 'x' } };
    observe({ ...home, view: host('role', { round: 1, players: [{}, {}, {}], target: 8 }) }, send);
    observe({ ...home, view: host('role', { round: 2, players: [{}, {}, {}, {}], target: 12 }) }, send);
    assert.deepEqual(sent.filter(([n]) => /^(players|length)_/.test(n)), [['players_3', 'car'], ['length_8', 'car']], 'later rounds and later joiners are not counted again');
    resetWatch();
    sent = [];
    observe({ ...home, view: host('role', { code: 'ZZZZ', round: 1, players: [{}], target: 5 }) }, send);
    assert.deepEqual(sent.filter(([n]) => /^(players|length)_/.test(n)), [['length_other', 'car']], 'one player is no game to count, and a target of 5 is not one of the two cards');
  });

  it('counts a guest only as joined, and the game\'s own steps only on the host\'s phone', () => {
    const guest = { route: { page: 'home' }, session: { code: 'x' }, view: host('role', { round: 1, you: { isHost: false } }) };
    observe(guest, send);
    observe({ ...guest, view: host('finished', { round: 3, you: { isHost: false } }) }, send);
    assert.deepEqual(sent, [['joined', 'car']]);
  });

  it('counts the packages when they come on screen, not while they stay', () => {
    const base = { route: { page: 'home' }, session: { code: 'x' }, payments: { enabled: true } };
    observe({ ...base, paywall: true, view: host('summary', { mode: 'car', round: 1 }) }, send);
    observe({ ...base, paywall: true, view: host('summary', { mode: 'car', round: 1 }) }, send);
    observe({ ...base, paywall: false }, send);
    observe({ ...base, paywall: true }, send);
    assert.deepEqual(sent.filter(([n]) => n === 'paywall'), [['paywall', 'car'], ['paywall', '']]);
    sent = [];
    resetWatch();
    observe({ route: { page: 'home' }, session: { code: 'x' }, paywall: true, payments: { enabled: false } }, send);
    assert.deepEqual(sent.filter(([n]) => n === 'paywall'), [], 'no packages, nothing to count');
  });
});

describe('the owner\'s sums', () => {
  const events = [
    { day: '2026-11-01', name: 'visit', lang: 'no', mode: '', plan: '', method: '', n: 10 },
    { day: '2026-11-02', name: 'visit', lang: 'da', mode: '', plan: '', method: '', n: 4 },
    { day: '2026-11-02', name: 'lobby', lang: 'da', mode: 'car', plan: '', method: '', n: 2 },
    { day: '2026-11-02', name: 'paywall', lang: 'da', mode: 'car', plan: '', method: '', n: 2 },
    { day: '2026-11-02', name: 'checkout', lang: 'da', mode: '', plan: 'year', method: 'vipps', n: 1 },
  ];
  const sales = [
    { day: '2026-11-02', plan: 'year', amount: 29900, currency: 'NOK', state: 'paid', refunded: 0 },
    { day: '2026-11-02', plan: 'evening', amount: 14900, currency: 'NOK', state: 'refunded', refunded: 14900 },
    { day: '2026-11-02', plan: 'evening', amount: 14900, currency: 'NOK', state: 'cancelled', refunded: 0 },
    { day: '2026-11-02', plan: 'weekend', amount: 19900, currency: 'NOK', state: 'paid', refunded: 5000 },
  ];

  it('adds up the days, the languages, the modes and the sales', () => {
    const s = summarize({ today: '2026-11-03', from: '2026-11-01', days: 3, events, sales });
    assert.equal(s.visits, 14);
    assert.deepEqual(s.days.map((d) => [d.day, d.visit, d.lobby, d.sold]), [['2026-11-01', 10, 0, 0], ['2026-11-02', 4, 2, 2], ['2026-11-03', 0, 0, 0]]);
    assert.deepEqual(s.byLang.map((l) => [l.lang, l.visit, l.lobby]), [['no', 10, 0], ['da', 4, 2]]);
    assert.equal(s.byMode.find((m) => m.mode === 'car').lobby, 2);
    assert.deepEqual(s.checkouts, [{ plan: 'year', method: 'vipps', n: 1 }]);
    assert.equal(s.pay[2].n, 2, 'two paid orders (a refunded and a cancelled one do not count)');
  });

  it('counts only paid orders, and takes refunds off what came in', () => {
    const s = salesSummary(sales);
    assert.equal(s.orders, 2);
    assert.equal(s.refunded, 1);
    assert.deepEqual(s.revenue, { NOK: 299 + 149 });
    assert.deepEqual(s.perPlan, { year: 1, weekend: 1 });
  });

  it('gives days in order, and a dash when there is nothing to divide by', () => {
    assert.deepEqual(daysBetween('2026-02-27', '2026-03-02'), ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    assert.equal(percent(1, 4), '25 %');
    assert.equal(percent(1, 0), '–');
  });
});

describe('more from the same numbers', () => {
  const row = (day, name, n, extra = {}) => ({ day, name, lang: 'no', mode: '', plan: '', method: '', n, ...extra });
  // counted since the 1st: 14 days (the 1st to the 14th), so that 7 days and the 7 before them are both whole
  const events = [row('2026-11-01', 'visit', 10), row('2026-11-05', 'visit', 10), row('2026-11-09', 'visit', 30), row('2026-11-12', 'visit', 30), row('2026-11-12', 'lobby', 8, { mode: 'car' }), row('2026-11-12', 'joined', 20), row('2026-11-12', 'game_start', 4), row('2026-11-12', 'round', 14), row('2026-11-13', 'finished', 2)];
  const sales = [
    { day: '2026-11-12', plan: 'year', amount: 29900, currency: 'NOK', state: 'paid', refunded: 0 },
    { day: '2026-11-13', plan: 'evening', amount: 14900, currency: 'NOK', state: 'paid', refunded: 0 },
  ];
  const data = { today: '2026-11-14', from: '2026-11-01', days: 14, events, sales };

  it('splits the days in the last period and the one before, and says how much things changed', () => {
    const { current, previous } = splitPeriods(data, 7);
    assert.equal(current.from, '2026-11-08');
    assert.equal(current.days, 7);
    assert.equal(summarize(current).visits, 60);
    assert.equal(summarize(previous).visits, 20);
    assert.equal(previous.today, '2026-11-07');
    assert.equal(change(60, 20), 200);
    assert.equal(change(5, 0), null, 'nothing to compare with');
  });

  it('does not compare with a period that was only half counted', () => {
    const late = { ...data, events: events.filter((e) => e.day >= '2026-11-05') };
    assert.equal(splitPeriods(late, 7).previous, null);
    assert.equal(splitPeriods({ ...data, from: '2026-11-08', days: 7, events: events.filter((e) => e.day >= '2026-11-08') }, 7).previous, null, 'asked for 7 days, so nothing before');
  });

  it('adds up how many played and which length they chose', () => {
    const more = [...events, row('2026-11-12', 'players_4', 6, { mode: 'cabin' }), row('2026-11-12', 'players_4', 2, { mode: 'car' }), row('2026-11-12', 'players_6', 2, { mode: 'cabin' }), row('2026-11-13', 'length_8', 7), row('2026-11-13', 'length_12', 3)];
    const s = summarize({ ...data, events: more });
    assert.deepEqual(s.players.find((x) => x.size === 4), { size: 4, cabin: 6, car: 2, other: 0, total: 8 });
    assert.equal(s.players.length, 9);
    assert.equal(s.countedGames, 10);
    assert.equal(s.kpi.playersPerGame, 4.4, '(8 x 4 + 2 x 6) / 10');
    assert.deepEqual(s.lengths.map((l) => [l.id, l.n]), [['lite', 7], ['stor', 3], ['other', 0]]);
    assert.equal(summarize(data).kpi.playersPerGame, null, 'nothing counted yet');
  });

  it('works out per game and per order, and by the day of the week', () => {
    const s = summarize(data);
    assert.deepEqual(s.kpi, { guestsPerGame: 2.5, roundsPerGame: 3.5, finishRate: '50 %', averageOrder: 224, playersPerGame: null });
    assert.equal(ratio(1, 0), null);
    assert.deepEqual(s.sales.perPlanIncome, { year: 299, evening: 149 });
    assert.equal(s.days.find((d) => d.day === '2026-11-12').income, 299);
    assert.equal(s.weekdays.length, 7);
    assert.equal(s.weekdays[0].name, 'Mandag');
    assert.equal(s.weekdays[3].visit, 40, 'the 5th and the 12th of November 2026 are Thursdays (10 + 30)');
    assert.equal(s.weekdays.reduce((n, d) => n + d.visit, 0), 80, 'every day of the week adds up to the whole');
    assert.equal(s.first, '2026-11-01');
  });
});

describe('where the counting is hooked in', () => {
  it('is called from App, and when a payment is started (by card and with Vipps)', () => {
    assert.match(read('public/js/app.js'), /observe\(s\)/);
    assert.match(read('public/js/pay/shop.js'), /track\('checkout', \{ p: plan, x: 'card' \}\)/);
    assert.match(read('public/js/pay/vipps.js'), /track\('checkout', \{ p: plan, x: 'vipps' \}\)/);
  });

  it('has a page for the owner (built with shadcn/ui into public/stats/) that search engines are told to leave alone, and the files it names are there', () => {
    const page = read('public/stats/index.html');
    assert.match(page, /name="robots" content="noindex, nofollow"/);
    const files = [...page.matchAll(/(?:src|href)="\.\/(assets\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(files.some((f) => f.endsWith('.js')) && files.some((f) => f.endsWith('.css')), 'a script and a style sheet');
    for (const file of files) assert.ok(fs.existsSync(new URL(`../public/stats/${file}`, import.meta.url)), file);
    assert.ok(!fs.existsSync(new URL('../public/stats.html', import.meta.url)), 'the old plain page is gone');
  });

  it('is told in the privacy statement, in all three languages', () => {
    const page = read('public/personvern.html');
    for (const word of ['<strong>Statistikk.</strong>', '<strong>Statistik.</strong>']) assert.ok(page.includes(word), word);
    assert.equal((page.match(/<strong>Statistik\.<\/strong>/g) ?? []).length, 2, 'Danish and Swedish');
    assert.match(page, /Do Not Track/);
  });
});
