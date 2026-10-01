// UI end-to-end: several "phones" (isolated browser contexts) play a whole game through the real interface.
//   node tools/qa/play.mjs [players=4] [target=2] [--shots]
// Needs Google Chrome (CHROME_PATH to override). Exits non-zero on the first thing that does not behave.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { createApp } from '../../server/index.js';
import { QUESTIONS } from '../../server/questions.js';

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const nums = args.filter((a) => !a.startsWith('--')).join(' ').split(/\s+/).filter(Boolean).map(Number);
const PLAYERS = nums[0] ?? 4;
const TARGET = nums[1] ?? 2;
assert.ok(Number.isInteger(PLAYERS) && PLAYERS >= 3 && PLAYERS <= 10 && Number.isInteger(TARGET) && TARGET >= 1, 'usage: play.mjs [players 3-10] [target]');
const SHOTS = flags.includes('--shots');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const NAMES = ['Petter', 'Mari', 'Ola', 'Sofie', 'Jonas', 'Ida', 'Kari', 'Per', 'Nina', 'Lars'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const app = createApp({ port: 0, host: '127.0.0.1', silent: true, tickMs: 50, hubOptions: { timings: { roleMs: 1600, countdownMs: 1600 } } });
const port = await app.listen();
const base = `http://127.0.0.1:${port}`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
if (SHOTS) fs.mkdirSync('tmp/play', { recursive: true });

// ---------------------------------------------------------------- helpers
const phones = [];
async function newPhone(name) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => console.error(`[${name}] PAGE ERROR:`, e.message));
  page.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && console.error(`[${name}] console.error:`, m.text()));
  const phone = { name, ctx, page };
  phones.push(phone);
  return phone;
}
const bodyText = (p) => p.page.evaluate(() => document.body.innerText);
const waitText = (p, re, timeout = 10000) =>
  p.page
    .waitForFunction((src, flags) => new RegExp(src, flags).test(document.body.innerText), { timeout }, re.source, re.flags)
    .catch(async () => {
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
const shot = async (p, label) => SHOTS && p.page.screenshot({ path: `tmp/play/${label}.png` });

async function register(p, name, avatarIndex) {
  await p.page.waitForSelector('#name', { timeout: 10000 });
  await p.page.type('#name', name);
  await p.page.evaluate((i) => document.querySelectorAll('.picker__item:not([disabled])')[i].click(), avatarIndex);
  await shot(p, `profile-${name}`);
  await clickButton(p, 'Klar!');
}

try {
  // ------------------------------------------------------------ lobby
  const host = await newPhone(NAMES[0]);
  await host.page.goto(base);
  await waitText(host, /Lur dem/);
  await shot(host, '01-home');
  await clickButton(host, 'Start et spill');
  // the host sees the QR code straight away and picks their own profile from the lobby
  await waitText(host, /Skann for å bli med/i);
  await shot(host, '01b-lobby-host-first-view');
  assert.match(await bodyText(host), /Velg navn og avatar først/);
  assert.equal(await host.page.$eval('.dock .btn', (b) => b.disabled), true, 'cannot start before choosing a profile');
  await host.page.evaluate(() => document.querySelector('.profile-prompt').click());
  await register(host, NAMES[0], 0);
  await waitText(host, /Spillere\s+1\/10/);
  const code = await host.page.$eval('.lobby__code', (el) => el.textContent.trim());
  assert.match(code, /^[A-Z]{4}$/, 'host sees a four-letter code');
  const qrOk = await host.page.$eval('.qr svg', (svg) => svg.querySelectorAll('path').length > 0);
  assert.ok(qrOk, 'QR code is rendered');
  log(`host created game ${code}`);

  const others = [];
  for (let i = 1; i < PLAYERS; i++) {
    const p = await newPhone(NAMES[i]);
    await p.page.goto(`${base}/j/${code.toLowerCase()}`); // like scanning the QR code
    await register(p, NAMES[i], 0); // taken avatars are disabled, so the first enabled one is always free
    await waitText(p, /Du er med/);
    others.push(p);
  }
  await waitText(host, new RegExp(`Spillere\\s+${PLAYERS}/10`));
  for (const p of others) await waitText(p, new RegExp(`Spillere\\s+${PLAYERS}`));
  await shot(host, '02-lobby-host');
  await shot(others[0], '03-lobby-guest');
  const all = [host, ...others];
  log(`${PLAYERS} players in the lobby`);

  // host sets the target via the free-text field and starts
  await host.page.focus('#target'); // focusing selects the old value, so typing replaces it
  await host.page.keyboard.type(String(TARGET));
  await sleep(500);
  await waitText(host, new RegExp(`Spiller til ${TARGET} poeng`));
  await clickButton(host, 'Start Disputt');

  // ------------------------------------------------------------ rounds
  let round = 0;
  let finished = false;
  while (!finished && round < 30) {
    round++;
    // role reveal: exactly one impostor; only the impostor sees the answer
    await Promise.all(all.map((p) => waitText(p, /IMPOSTER|LOJAL/i)));
    const roles = await Promise.all(all.map(async (p) => ((await p.page.$('.role__secret')) ? 'impostor' : 'loyal')));
    assert.equal(roles.filter((r) => r === 'impostor').length, 1, `round ${round}: exactly one impostor, got ${roles}`);
    const impostor = all[roles.indexOf('impostor')];
    const impostorText = await bodyText(impostor);
    assert.match(impostorText, /IMPOSTER/i);
    assert.match(impostorText, /\b[A-D]\s*\n?\s*[A-Za-zÆØÅæøå ]+/, 'impostor sees letter + answer');
    for (const p of all.filter((x) => x !== impostor)) assert.match(await bodyText(p), /LOJAL/i);
    if (round === 1) {
      await shot(impostor, '04-role-impostor');
      await shot(all.find((p) => p !== impostor), '05-role-loyal');
    }

    // discussion: one asker holds the question, the others only see who
    await Promise.all(
      all.map((p) =>
        p.page.waitForFunction(() => document.querySelector('.question__text') || /har spørsmålet/i.test(document.body.innerText), { timeout: 12000 }),
      ),
    );
    const askerIndex = (await Promise.all(all.map(async (p) => (await p.page.$('.question__text')) !== null))).indexOf(true);
    assert.ok(askerIndex >= 0, `round ${round}: someone has the question`);
    const asker = all[askerIndex];
    const questionText = await asker.page.$eval('.question__text', (el) => el.textContent.trim());
    const q = QUESTIONS.find((x) => x.text === questionText);
    assert.ok(q, `known question: ${questionText}`);
    for (const p of all.filter((x) => x !== asker)) {
      assert.equal(await p.page.$('.question__text'), null, 'others never see the question');
      assert.ok(!(await bodyText(p)).includes(q.text));
      await waitText(p, /har spørsmålet/);
    }
    if (round === 1) {
      await shot(asker, '06-question-asker');
      await shot(all.find((p) => p !== asker), '07-discussion');
    }

    // asker: adjust the clock, then reload the page to prove the session survives, then answer
    await clickButton(asker, '10');
    await sleep(300);
    const clockText = await asker.page.$eval('.timer', (el) => el.textContent.replace(/\s/g, ''));
    assert.match(clockText, /^(09:5\d|10:00)$/, `clock reset to ten minutes (${clockText})`);
    if (round === 1) {
      const bystander = all.find((p) => p !== asker && p !== host) ?? host;
      await bystander.page.reload();
      await waitText(bystander, /har spørsmålet/);
      const again = await bodyText(bystander);
      assert.match(again, bystander === impostor ? /IMPOSTER/i : /LOJAL/i, 'role restored after reload');
      log('reload restored the session');
    }
    const groupRight = round % 2 === 1;
    const choice = groupRight ? q.correct : (q.correct + 1) % 4;
    await asker.page.evaluate((i) => document.querySelectorAll('.option')[i].click(), choice);
    await sleep(200);
    await clickButton(asker, 'Lås svaret');

    // countdown, then the verdict on the asker's phone only
    await Promise.all(all.map((p) => waitText(p, /låst|låste/i)));
    await waitText(asker, groupRight ? /Riktig!/i : /Feil!/i, 8000);
    for (const p of all.filter((x) => x !== asker)) {
      const t = await bodyText(p);
      assert.ok(!/Riktig!|Feil!/i.test(t), 'others do not see the verdict');
      assert.match(t, /Se på/);
    }
    assert.match(await bodyText(asker), new RegExp(q.options[q.correct]));
    if (round === 1) await shot(asker, '08-reveal');
    await clickButton(asker, 'Gå videre');

    // summary (or the winner)
    await Promise.all(all.map((p) => waitText(p, /Imposteren var|vant!|Delt seier/i, 8000)));
    const hostText = await bodyText(host);
    finished = /vant!|Delt seier/i.test(hostText);
    if (round === 1) await shot(host, '09-summary');
    if (!finished) {
      assert.match(hostText, /Gruppa hadde rett|Imposteren lurte dere/);
      assert.match(await bodyText(others[0]), /Venter på at verten starter neste runde/);
      await clickButton(host, 'Neste runde');
    }
  }

  assert.ok(finished, 'the game ended with a winner');
  await shot(host, '10-finished-host');
  await shot(others[0], '11-finished-guest');
  const finalText = await bodyText(host);
  assert.match(finalText, /Sluttresultat/);
  log(`game finished after ${round} rounds: ${finalText.match(/(\S+ vant!|Delt seier!)/)?.[1]}`);

  // play again returns everyone to the lobby with scores reset
  await clickButton(host, 'Spill igjen');
  await Promise.all(all.map((p) => waitText(p, /Spillere/)));
  log('play again -> lobby ok');
  log('\nUI END-TO-END: OK');
} catch (err) {
  console.error('\nUI END-TO-END FAILED:', err.message);
  if (SHOTS) for (const p of phones) await p.page.screenshot({ path: `tmp/play/FAIL-${p.name}.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  await app.close();
}
