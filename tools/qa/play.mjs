// UI end-to-end: several "phones" (isolated browser contexts) play a whole game through the real interface.
//   node tools/qa/play.mjs [players=4] [target=2] [--p2p] [--url=https://…] [--shots]
//   --p2p   test the peer-to-peer build (static site + local PeerJS signalling server) instead of the Node server
//   --url   play against an already deployed peer-to-peer site (real PeerJS cloud, real 5 s timers), e.g. the GitHub Pages address
// Needs Google Chrome (CHROME_PATH to override). Exits non-zero on the first thing that does not behave.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import jsQR from 'jsqr';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { QUESTIONS } from '../../shared/questions.js';
import { startNodeSite, startP2PSite } from './sites.mjs';

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const nums = args.filter((a) => !a.startsWith('--')).join(' ').split(/\s+/).filter(Boolean).map(Number);
const PLAYERS = nums[0] ?? 4;
const TARGET = nums[1] ?? 2;
assert.ok(Number.isInteger(PLAYERS) && PLAYERS >= 3 && PLAYERS <= 10 && Number.isInteger(TARGET) && TARGET >= 1, 'usage: play.mjs [players 3-10] [target]');
const SHOTS = flags.includes('--shots');
const LIVE_URL = flags.find((f) => f.startsWith('--url='))?.slice('--url='.length);
const LIVE = Boolean(LIVE_URL);
const P2P = LIVE || flags.includes('--p2p');
const SLOW = LIVE ? 2 : 1; // the deployed site runs on the real timers and a real network
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const NAMES = ['Petter', 'Mari', 'Ola', 'Sofie', 'Jonas', 'Ida', 'Kari', 'Per', 'Nina', 'Lars'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const site = LIVE ? { base: LIVE_URL.replace(/\/+$/, ''), stop: async () => {} } : P2P ? await startP2PSite() : await startNodeSite();
const base = site.base;
log(`${LIVE ? 'deployed peer-to-peer site' : P2P ? 'peer-to-peer build' : 'Node server'} at ${base}`);
// (loopback WebRTC between two pages of the same browser needs real host candidates, not mDNS names)
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
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
  await host.page.goto(`${base}/`);
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
  // the QR code really contains a join link for this room
  const svg = await host.page.$eval('.qr svg', (el) => el.outerHTML);
  const { data, info } = await sharp(Buffer.from(svg), { density: 300 }).resize(500, 500).flatten({ background: '#fff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const qrLink = jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data;
  assert.ok(qrLink, 'the QR code can be read');
  assert.equal(new URL(qrLink).searchParams.get('j'), code, `the QR link carries the room code (${qrLink})`);
  if (P2P) assert.equal(qrLink, `${base}/?j=${code}`, 'p2p: the QR link is the page address itself');
  log(`host created game ${code}`);

  // "Del lenke": through the phone's share sheet where there is one, otherwise the link is copied
  await host.page.evaluate(() => {
    window.__shared = null;
    window.__copied = null;
    Object.defineProperty(navigator, 'share', { value: async (data) => void (window.__shared = data), configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => void (window.__copied = t) }, configurable: true });
  });
  await clickButton(host, 'Del lenke');
  const shared = await host.page.evaluate(() => window.__shared);
  assert.equal(shared?.url, qrLink, 'the share sheet gets the same link as the QR code');
  assert.ok(shared?.text?.includes(code), 'the shared text carries the room code');
  await host.page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  await clickButton(host, 'Del lenke');
  await waitText(host, /Lenken er kopiert/);
  assert.equal(await host.page.evaluate(() => window.__copied), qrLink, 'without a share sheet the link is copied');

  const others = [];
  for (let i = 1; i < PLAYERS; i++) {
    const p = await newPhone(NAMES[i]);
    await p.page.goto(`${base}/?j=${code.toLowerCase()}`); // like scanning the QR code
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

  // removing a friend takes two taps: the first only arms the button
  await host.page.evaluate(() => document.querySelector('.player__kick').click());
  await waitText(host, /Fjern\?/);
  assert.match(await bodyText(host), new RegExp(NAMES[PLAYERS - 1]), 'one tap does not remove anyone');

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
    await Promise.all(all.map((p) => waitText(p, /IMPOSTER|LOJAL/i, 10000 * SLOW)));
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
        p.page.waitForFunction(() => document.querySelector('.question__text') || /har spørsmålet/i.test(document.body.innerText), { timeout: 12000 * SLOW }),
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
      if (P2P) {
        // the game lives in the host's page: reloading it must not end the game, and guests must find their way back
        await host.page.reload();
        await host.page.waitForFunction(() => document.querySelector('.question__text') || /har spørsmålet/i.test(document.body.innerText), { timeout: 30000 });
        for (const p of others) {
          // back in the round: no "connection lost" banner, and the screen is the asker's or the discussion screen again
          await p.page.waitForFunction(() => !document.querySelector('.banner') && (document.querySelector('.question__text') || /har spørsmålet/i.test(document.body.innerText)), { timeout: 40000 });
        }
        assert.match(await bodyText(host), host === impostor ? /IMPOSTER/i : /LOJAL/i, 'host role restored after reload');
        log('the host reloaded and everybody is back in the same round');
      }
    }
    const groupRight = round % 2 === 1;
    const choice = groupRight ? q.correct : (q.correct + 1) % 4;
    await asker.page.evaluate((i) => document.querySelectorAll('.option')[i].click(), choice);
    await sleep(200);
    await clickButton(asker, 'Lås svaret');

    // countdown, then the verdict on the asker's phone only
    await Promise.all(all.map((p) => waitText(p, /låst|låste/i)));
    await waitText(asker, groupRight ? /Riktig!/i : /Feil!/i, 8000 * SLOW);
    for (const p of all.filter((x) => x !== asker)) {
      const t = await bodyText(p);
      assert.ok(!/Riktig!|Feil!/i.test(t), 'others do not see the verdict');
      assert.match(t, /Se på/);
    }
    assert.match(await bodyText(asker), new RegExp(q.options[q.correct]));
    if (round === 1) await shot(asker, '08-reveal');
    // a double tap on "Gå videre": the second tap hits a screen that is already out of date, and must not show an error
    await asker.page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('Gå videre'));
      b.click();
      b.click();
    });
    await waitText(asker, /Imposteren var|vant!|Delt seier/i, 8000 * SLOW);
    await sleep(300);
    assert.equal(await asker.page.$('.toast'), null, 'no error toast after a double tap');

    // summary (or the winner)
    await Promise.all(all.map((p) => waitText(p, /Imposteren var|vant!|Delt seier/i, 8000 * SLOW)));
    const hostText = await bodyText(host);
    finished = /vant!|Delt seier/i.test(hostText);
    if (round === 1) await shot(host, '09-summary');
    if (!finished) {
      assert.match(hostText, /Gruppa hadde rett|Imposteren lurte dere/);
      assert.match(await bodyText(others[0]), /Venter på at verten starter neste runde/);

      // a phone loses its browser data mid-game: the player re-enters through the QR link and takes their old seat
      if (round === 1 && others.length >= 3) {
        const lost = others[others.length - 1];
        await lost.ctx.close();
        const fresh = await newPhone(lost.name);
        await fresh.page.goto(`${base}/?j=${code}`);
        await waitText(fresh, /Spillet har startet/i);
        await shot(fresh, '12-seat-picker');
        const seatShown = (n) => fresh.page.evaluate((n) => [...document.querySelectorAll('.player')].some((el) => el.innerText.includes(n)), n);
        // over WebRTC the host needs a little while to notice that a phone has vanished; "Sjekk på nytt" asks again
        for (let tries = 0; !(await seatShown(lost.name)); tries++) {
          assert.ok(tries < (P2P ? 14 : 4), `the seat of ${lost.name} became available`);
          await sleep(P2P ? 5000 : 400);
          if (await seatShown(lost.name)) break;
          await clickButton(fresh, 'Sjekk på nytt');
          await waitText(fresh, /Spillet har startet/i);
        }
        await fresh.page.evaluate((n) => [...document.querySelectorAll('.player')].find((el) => el.innerText.includes(n)).click(), lost.name);
        await waitText(fresh, /Venter på at verten starter neste runde/);
        all[all.indexOf(lost)] = fresh;
        others[others.indexOf(lost)] = fresh;
        log('a fresh phone took over the lost seat');
      }
      // a guest has the scoreboard open when the host starts the next round: the role reveal must not be hidden behind it
      const guest = others[0];
      await guest.page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Poeng')).click());
      await guest.page.waitForSelector('.sheet-backdrop');
      await clickButton(host, 'Neste runde');
      await waitText(guest, /IMPOSTER|LOJAL/i);
      assert.equal(await guest.page.$('.sheet-backdrop'), null, 'sheets close when a new round starts');
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
  await browser.close().catch(() => {});
  await Promise.race([site.stop(), sleep(4000)]);
  process.exit(process.exitCode ?? 0); // the local PeerJS server may keep sockets open; do not hang on them
}
