// UI end-to-end for TWO players, a phone each (hytteturmodus): a round is then one of three, as likely as each other: the first is the
// impostor, the second is, or nobody is. Plays rounds through the real interface until all three have come up, and checks that
//   - a round with no impostor looks like any other on both phones until the points (the role strip says "Lojal", the reveal says "Imposteren
//     avslører seg!"), and says so at the points, with the points the rule gives: both get one for the right answer, nobody for a wrong one
//   - the host can start with only one friend in the lobby, and the lobby tells them about the rule
//     node tools/qa/two.mjs [--p2p] [--subpath]
// Needs Google Chrome (CHROME_PATH to override). Exits non-zero on the first thing that does not behave.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { QUESTIONS } from '../../shared/questions.js';
import { startNodeSite, startP2PSite } from './sites.mjs';

const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const SUBPATH = flags.includes('--subpath');
const P2P = SUBPATH || flags.includes('--p2p');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const site = P2P ? await startP2PSite({ prefix: SUBPATH ? '/Disputt/' : '' }) : await startNodeSite();
const base = site.base;
log(`${P2P ? 'peer-to-peer build' : 'Node server'} at ${base}, two phones`);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
const problems = [];

async function newPhone(name) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => ({ release: async () => {}, addEventListener() {} }) } });
  });
  page.on('pageerror', (e) => {
    problems.push(`[${name}] page error: ${e.message}`);
    console.error(`[${name}] PAGE ERROR:`, e.message);
  });
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy|Refused to (load|connect|execute)/i.test(m.text())) problems.push(`[${name}] blocked by the CSP: ${m.text()}`);
  });
  return { name, ctx, page };
}
const bodyText = (p) => p.page.evaluate(() => document.body.innerText);
const screenText = (p) => p.page.$eval('main', (el) => el.innerText.replace(/\s+/g, ' '));
const waitText = (p, re, timeout = 12000) =>
  p.page.waitForFunction((src, flags) => new RegExp(src, flags).test(document.body.innerText), { timeout }, re.source, re.flags).catch(async () => {
    throw new Error(`[${p.name}] timed out waiting for ${re}. Screen says:\n${(await bodyText(p)).slice(0, 500)}`);
  });
const clickButton = async (p, label, timeout = 10000) => {
  await p.page
    .waitForFunction((l) => [...document.querySelectorAll('button')].some((b) => b.innerText.trim().includes(l) && !b.disabled), { timeout }, label)
    .catch(async () => {
      throw new Error(`[${p.name}] no enabled button "${label}". Screen says:\n${(await bodyText(p)).slice(0, 500)}`);
    });
  await p.page.evaluate((l) => [...document.querySelectorAll('button')].find((b) => b.innerText.trim().includes(l) && !b.disabled).click(), label);
};
const clickLabel = async (p, label) => {
  await p.page.waitForSelector(`button[aria-label="${label}"]`, { timeout: 5000 });
  await p.page.evaluate((l) => document.querySelector(`button[aria-label="${l}"]`).click(), label);
};
async function register(p, name, button = 'Klar!') {
  await p.page.waitForSelector('#name', { timeout: 10000 });
  await p.page.type('#name', name);
  await p.page.evaluate(() => document.querySelector('.picker__item:not([disabled])').click());
  await clickButton(p, button);
}

const ROLE_WORD = /\b(Imposter|Lojal)\b/;
async function holdAndRead(p) {
  const button = await p.page.waitForSelector('.hold-btn, .role-strip .secret', { visible: true, timeout: 5000 });
  const box = await button.boundingBox();
  await p.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.page.mouse.down();
  await p.page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { timeout: 3000 }, ROLE_WORD.source);
  const card = await p.page.evaluate(() => (document.querySelector('.rolecard, .role-strip')?.innerText ?? '').replace(/\s+/g, ' '));
  await p.page.mouse.up();
  await p.page.waitForFunction((src) => !new RegExp(src).test(document.body.innerText), { timeout: 3000 }, ROLE_WORD.source);
  return { card, role: /\bImposter\b/.test(card) ? 'impostor' : 'loyal' };
}

try {
  const host = await newPhone('Petter');
  const guest = await newPhone('Mari');
  const all = [host, guest];

  // ---- the host sets up a game for two phones
  await host.page.goto(`${base}/`);
  await waitText(host, /Diskuter,?\s+manipuler\s+og\s+vinn/);
  await clickButton(host, 'Opprett spill');
  await clickButton(host, 'Hytteturmodus');
  await clickButton(host, 'Neste');
  await register(host, 'Petter', 'Neste');
  await waitText(host, /Steg 3 av 4/);
  await host.page.focus('#target');
  await host.page.keyboard.type('99'); // no end in sight: the rounds go on until all three kinds have come up
  await sleep(400);
  await clickButton(host, 'Neste');
  await waitText(host, /Steg 4 av 4/);
  const code = await host.page.$eval('.lobby__code', (el) => el.textContent.trim());
  assert.match(await bodyText(host), /Vent på 1 spiller til · minst 2/, 'one friend is enough');
  assert.equal((await host.page.$$eval('button', (els) => els.find((b) => b.innerText.includes('Start Disputt')).disabled)), true, 'not before the friend is there');
  await guest.page.goto(`${base}/?j=${code}`);
  await register(guest, 'Mari');
  await waitText(guest, /Du er med/);
  await waitText(host, /Spillere\s+2\/10/);
  await waitText(host, /2 spillere er med/);
  const lobby = await screenText(host);
  assert.match(lobby, /Dere er bare to/, 'the host is told about the rule while the game waits');
  assert.match(lobby, /På 1\/3 av spørsmålene er ingen impostere\. Dette er tilfeldig\./);
  await clickButton(host, 'Start Disputt');
  log(`game ${code}: two phones, the host started with one friend`);

  // ---- rounds, until each of the three has come up
  const seen = { none: 0, host: 0, guest: 0 };
  let round = 0;
  while (round < 30 && !(seen.none && seen.host && seen.guest)) {
    round++;
    await Promise.all(all.map((p) => waitText(p, /din rolle/i, 15000)));
    const peeks = await Promise.all(all.map((p) => holdAndRead(p)));
    const roles = peeks.map((x) => x.role);
    const impostors = roles.filter((r) => r === 'impostor').length;
    assert.ok(impostors <= 1, `round ${round}: at most one impostor among two (${roles})`);
    if (impostors === 0) seen.none++;
    else if (roles[0] === 'impostor') seen.host++;
    else seen.guest++;
    // the same on both phones whether or not there is an impostor: a lone "impostor" count, and no word about "ingen imposter"
    for (const p of all) assert.doesNotMatch(await bodyText(p), /ingen imposter/i, `round ${round}: nothing says that there is no impostor`);

    await Promise.all(all.map((p) => p.page.waitForFunction(() => document.querySelector('.question__text') || /har spørsmålet/i.test(document.body.innerText), { timeout: 15000 })));
    const askerIndex = (await Promise.all(all.map(async (p) => (await p.page.$('.question__text')) !== null))).indexOf(true);
    assert.ok(askerIndex >= 0, `round ${round}: somebody has the question`);
    const asker = all[askerIndex];
    const questionText = await asker.page.$eval('.question__text', (el) => el.textContent.trim());
    const q = QUESTIONS.find((x) => x.text === questionText);
    assert.ok(q, `known question: ${questionText}`);
    const groupRight = round % 2 === 1;
    const choice = groupRight ? q.correct : (q.correct + 1) % 4;
    await asker.page.evaluate((i) => document.querySelectorAll('.option')[i].click(), choice);
    await sleep(200);
    await clickButton(asker, 'Lås svaret');

    // the countdown and the reveal look the same on both phones, with or without an impostor
    await Promise.all(all.map((p) => waitText(p, /avslører seg/i, 12000)));
    const stage = await Promise.all(all.map((p) => p.page.evaluate(() => ({ body: document.querySelector('.stage__body')?.innerText.replace(/\s+/g, ' ') ?? '', strip: document.querySelector('.role-strip')?.innerText.replace(/\s+/g, ' ') ?? '' }))));
    assert.equal(new Set(stage.map((s) => s.body)).size, 1, `round ${round}: the reveal looks the same on both phones`);
    assert.match(stage[0].body, /Imposteren avslører seg/, 'and says so also when nobody is the impostor');
    assert.equal(new Set(stage.map((s) => s.strip)).size, 1, `round ${round}: and so does the role strip`);
    await clickButton(asker, 'Det er sagt');
    await Promise.all(all.map((p) => waitText(p, /Poengene/, 12000)));

    // the points
    const rows = await host.page.$$eval('.scoreboard .score', (els) => els.map((el) => ({ name: el.querySelector('.score__name').innerText.replace(/\s*\(deg\)\s*/, '').trim(), gain: Boolean(el.querySelector('.score__gain')) })));
    const gainers = rows.filter((r) => r.gain).map((r) => r.name).sort();
    const names = ['Petter', 'Mari'];
    const impostorNames = names.filter((_, i) => roles[i] === 'impostor');
    const expected = names.filter((n) => (groupRight ? !impostorNames.includes(n) : impostorNames.includes(n))).sort();
    assert.deepEqual(gainers, expected, `round ${round}: the points went to ${expected.join(', ') || 'nobody'} (${roles}, group ${groupRight ? 'right' : 'wrong'})`);
    for (const p of all) {
      const text = await screenText(p);
      if (impostors === 0) {
        assert.match(text, /Ingen var imposter denne runden\./, `${p.name} is told that nobody was the impostor`);
        assert.match(text, groupRight ? /Dere svarte riktig sammen!/ : /Dere svarte feil\. Ingen fikk poeng\./);
      } else assert.match(text, groupRight ? /Gruppa hadde rett/ : /Imposteren lurte dere/);
    }
    await clickButton(host, 'Se fasit');
    await waitText(host, /Fasit/);
    const key = await host.page.$eval('.sheet', (el) => el.innerText.replace(/\s+/g, ' '));
    if (impostors === 0) assert.match(key, /imposteren var\s+ingen i denne runden/i);
    else assert.ok(key.includes(impostorNames[0]), `the answer key names ${impostorNames[0]}`);
    await clickLabel(host, 'Lukk');
    await host.page.waitForFunction(() => !document.querySelector('.sheet'));
    if (!(seen.none && seen.host && seen.guest)) await clickButton(host, 'Neste runde');
  }
  assert.ok(seen.none && seen.host && seen.guest, `all three ways to go came up in ${round} rounds (${JSON.stringify(seen)})`);
  log(`two phones: ${round} rounds, ${seen.none} with no impostor, ${seen.host} with the host as the impostor, ${seen.guest} with the friend`);

  // ---- end it from the host's menu
  await clickLabel(host, 'Vertsvalg');
  await waitText(host, /Avslutt spillet nå/);
  await clickButton(host, 'Avslutt spillet nå');
  await clickButton(host, 'Trykk igjen for å bekrefte');
  await waitText(host, /Sluttresultat/);
  assert.deepEqual(problems, [], 'no page errors and nothing blocked by the Content-Security-Policy');
  log('\nTWO PLAYERS END-TO-END: OK');
} catch (err) {
  console.error('\nTWO PLAYERS END-TO-END FAILED:', err.message);
  if (err.name !== 'AssertionError') console.error(String(err.stack).split('\n').slice(1, 7).join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
  await Promise.race([site.stop(), sleep(4000)]);
  process.exit(process.exitCode ?? 0);
}
