// What the game counts (POST /e) and the owner's numbers (GET /stats), at the payment server for Shopify (payments/worker-shopify.js).
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { ORIGIN, WORKER, mod, setupShopify } from './helpers/shopify.mjs';

const ADMIN = 'an-admin-token-of-some-length';
let t;
beforeEach(async () => {
  t = await setupShopify({ ADMIN_TOKEN: ADMIN });
});

const send = (body, options) => t.call('/e', { method: 'POST', body, ...options });
const rows = () => t.db.sqlite.prepare('SELECT * FROM stats ORDER BY name, lang, mode, plan, method').all();
const read = (days = '', token = ADMIN, origin = ORIGIN) =>
  mod.worker.fetch(
    new Request(`${WORKER}/stats${days ? `?days=${days}` : ''}`, { headers: { ...(origin ? { Origin: origin } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } }),
    t.env,
  );

describe('POST /e: the game says that something happened', () => {
  it('adds one to the count of the day, for that language, mode, package and way to pay', async () => {
    for (let i = 0; i < 3; i++) assert.equal((await send({ n: 'lobby', l: 'da', m: 'car' })).status, 200);
    await send({ n: 'lobby', l: 'sv', m: 'car' });
    await send({ n: 'checkout', l: 'no', p: 'weekend', x: 'vipps' });
    const r = rows();
    assert.deepEqual(r.map((x) => [x.name, x.lang, x.mode, x.plan, x.method, x.n]), [
      ['checkout', 'no', '', 'weekend', 'vipps', 1],
      ['lobby', 'da', 'car', '', '', 3],
      ['lobby', 'sv', 'car', '', '', 1],
    ]);
    assert.match(r[0].day, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('keeps nothing but those counts: the table has no room for anything that is one person', async () => {
    await send({ n: 'visit', l: 'no', name: 'Lone', code: 'ABCD', ua: 'x', ip: '1.2.3.4' });
    assert.deepEqual(Object.keys(rows()[0]).sort(), ['day', 'lang', 'method', 'mode', 'n', 'name', 'plan']);
    assert.ok(!JSON.stringify(rows()).match(/Lone|ABCD|1\.2\.3\.4/), 'extra things in the call are not kept');
  });

  it('turns an unknown event away, and makes an unknown value into «not given»', async () => {
    assert.equal((await send({ n: 'secret' })).status, 400);
    assert.equal((await send({})).status, 400);
    assert.equal((await t.call('/e', { method: 'POST', body: undefined })).status, 400);
    assert.equal((await send({ n: 'visit', l: 'xx', m: '<script>', p: 'lifetime', x: 'bitcoin' })).status, 200);
    assert.deepEqual(rows().map((x) => [x.lang, x.mode, x.plan, x.method]), [['', '', '', '']]);
  });

  it('only listens to the site itself', async () => {
    assert.equal((await send({ n: 'visit' })).status, 200);
    assert.equal((await send({ n: 'visit' }, { origin: 'https://evil.example' })).status, 403);
    assert.equal(rows()[0].n, 1, 'only the one from the site was counted');
  });

  it('stops counting for the day at the cap, so that nobody can fill the database the payments live in', async () => {
    t.env.STATS_DAILY_CAP = '5';
    for (let i = 0; i < 8; i++) assert.equal((await send({ n: 'visit', l: 'no' })).status, 200);
    assert.equal(rows()[0].n, 5);
    const again = await (await send({ n: 'visit', l: 'no' })).json();
    assert.deepEqual(again, { ok: true, counted: false });
  });

  it('is turned away politely when there is no database', async () => {
    const none = await setupShopify({ DB: undefined });
    const res = await none.call('/e', { method: 'POST', body: { n: 'visit' } });
    assert.equal(res.status, 503);
  });
});

describe('GET /stats: the owner looks', () => {
  it('needs the admin key', async () => {
    assert.equal((await read('', '')).status, 401);
    assert.equal((await read('', 'wrong-wrong-wrong-wrong')).status, 401);
    t.env.ADMIN_TOKEN = undefined;
    assert.equal((await read()).status, 503);
  });

  it('answers with the counts and the real orders of the period, and no test orders', async () => {
    await send({ n: 'paywall', l: 'no', m: 'cabin' });
    await send({ n: 'paywall', l: 'no', m: 'cabin' });
    await t.pay({ plan: 'year', code: 'AAAA-BBBB-CCCC', id: 11 });
    await t.pay({ plan: 'evening', code: 'DDDD-EEEE-FFFF', id: 12, test: true });
    t.env.ACCEPT_TEST_ORDERS = 'true'; // (the test order is written down now, but is still not a sale)
    await t.pay({ plan: 'evening', code: 'GGGG-HHHH-JJJJ', id: 13, test: true });
    const res = await read('7');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.days, 7);
    assert.match(body.today, /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(body.events.map((e) => [e.name, e.lang, e.mode, e.n]), [['paywall', 'no', 'cabin', 2]]);
    assert.equal(body.sales.length, 1);
    assert.deepEqual(Object.keys(body.sales[0]).sort(), ['amount', 'currency', 'day', 'plan', 'refunded', 'state']);
    assert.equal(body.sales[0].plan, 'year');
    const text = JSON.stringify(body);
    assert.ok(!text.includes('AAAA-BBBB'), 'no code of an order in the answer');
  });

  it('keeps the period to something sensible', async () => {
    assert.equal((await (await read('999')).json()).days, 120);
    assert.equal((await (await read('abc')).json()).days, 30);
  });

  it('lets the owner\'s page ask with the key (the preflight allows the header)', async () => {
    const pre = await t.call('/stats', { method: 'OPTIONS' });
    assert.equal(pre.status, 204);
    assert.match(pre.headers.get('Access-Control-Allow-Headers'), /Authorization/);
  });
});

describe('the lock against guessing the admin key', () => {
  const wrong = () => read('', 'wrong-wrong-wrong-wrong');
  const fails = () => t.db.sqlite.prepare('SELECT COUNT(*) AS n FROM admin_fails').get().n;

  it('lets ten wrong keys through as 401, and then shuts the admin doors, the right key too', async () => {
    for (let i = 0; i < 10; i++) assert.equal((await wrong()).status, 401, `wrong key ${i + 1}`);
    const locked = await read();
    assert.equal(locked.status, 429, 'the right key is turned away too');
    assert.equal((await locked.json()).error, 'locked');
    assert.equal((await wrong()).status, 429);
    assert.equal(fails(), 10, 'turned-away calls are not written down, so the database cannot be filled this way');
  });

  it('shuts every admin door, not only the numbers', async () => {
    for (let i = 0; i < 10; i++) await wrong();
        const viaVipps = await mod.worker.fetch(new Request(`${WORKER}/vipps/admin/check`, { headers: { Origin: ORIGIN, Authorization: `Bearer ${ADMIN}` } }), t.env);
    assert.equal(viaVipps.status, 429);
  });

  it('opens again an hour after the wrong keys', async () => {
    for (let i = 0; i < 10; i++) await wrong();
    assert.equal((await read()).status, 429);
    t.db.sqlite.prepare('UPDATE admin_fails SET at = at - 3601').run();
    assert.equal((await read()).status, 200);
    assert.equal(fails(), 0, 'and the old ones are gone');
  });

  it('does not count the right key, and leaves the game and the payments alone while it is shut', async () => {
    for (let i = 0; i < 25; i++) assert.equal((await read()).status, 200);
    assert.equal(fails(), 0);
    for (let i = 0; i < 10; i++) await wrong();
    assert.equal((await send({ n: 'visit', l: 'no' })).status, 200, 'the counting goes on');
    assert.equal((await t.call('/health')).status, 200);
    assert.equal((await t.call('/shop')).status, 200);
  });

  it('still says «not set up» (503) when there is no ADMIN_TOKEN, before it counts anything', async () => {
    t.env.ADMIN_TOKEN = undefined;
    for (let i = 0; i < 12; i++) assert.equal((await wrong()).status, 503);
    assert.equal(t.db.sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'admin_fails'").get(), undefined, 'not even the table is made');
  });
});
