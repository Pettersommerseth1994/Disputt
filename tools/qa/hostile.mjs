// What somebody who only knows the room code can (not) do to a peer-to-peer host: connect with the wrong kind of
// channel, connect and say nothing, or fill every place with such connections. Real players must still get in, and the
// leftovers must be cleaned away.
//   node tools/qa/hostile.mjs        (about 45 s: a connection that says nothing is closed after 15-20 s)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { startP2PSite } from './sites.mjs';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const site = await startP2PSite();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
const base = site.base;

const bodyText = (page) => page.evaluate(() => document.body.innerText);
const waitText = (page, re, timeout = 15000) =>
  page.waitForFunction((src, flags) => new RegExp(src, flags).test(document.body.innerText), { timeout }, re.source, re.flags).catch(async () => {
    throw new Error(`timed out waiting for ${re}. Screen says:\n${(await bodyText(page)).slice(0, 400)}`);
  });
const clickButton = async (page, label) => {
  await page.waitForFunction((l) => [...document.querySelectorAll('button')].some((b) => b.innerText.includes(l) && !b.disabled), { timeout: 10000 }, label);
  await page.evaluate((l) => [...document.querySelectorAll('button')].find((b) => b.innerText.includes(l) && !b.disabled).click(), label);
};
async function newPage(ctxOptions = {}) {
  const ctx = await browser.createBrowserContext(ctxOptions);
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
  return page;
}

try {
  // ---- the host
  const host = await newPage();
  await host.goto(`${base}/`);
  await clickButton(host, 'Opprett spill');
  await host.waitForSelector('#name', { timeout: 20000 }); // the first of the host's three steps
  await host.type('#name', 'Petter');
  await host.evaluate(() => document.querySelectorAll('.picker__item:not([disabled])')[0].click());
  await clickButton(host, 'Neste');
  await waitText(host, /Steg 2 av 3/);
  await clickButton(host, 'Neste');
  await host.waitForSelector('.lobby__code', { timeout: 20000 });
  const code = await host.$eval('.lobby__code', (el) => el.textContent.trim());
  await waitText(host, /Spillere\s+1\/10/);
  log(`game ${code} is open`);

  // ---- the attacker: a bare page with PeerJS and the room code, nothing else. (A text file from the same site: no CSP,
  //      and a secure context, which a blank page is not; Chrome keeps those away from loopback addresses.)
  const attacker = await newPage();
  await attacker.goto(`${base}/robots.txt`);
  await attacker.addScriptTag({ content: fs.readFileSync('public/js/vendor/peerjs.min.js', 'utf8') });
  await attacker.evaluate(
    (port) =>
      new Promise((resolve, reject) => {
        window.__dcs = [];
        // (an id of our own: a blank page may not fetch one from the broker over plain http, it is not a secure context)
        window.__peer = new window.Peer(`attacker-${Math.random().toString(16).slice(2, 10)}`, { host: '127.0.0.1', port, path: '/peerjs', secure: false, config: { iceServers: [] } });
        window.__peer.on('open', resolve);
        window.__peer.on('error', reject);
      }),
    site.peerPort,
  );
  const target = `disputt1-${code}`;
  const connect = (serialization) =>
    attacker.evaluate(
      (target, serialization) => {
        const dc = window.__peer.connect(target, { serialization, reliable: true });
        const rec = { serialization, startedAt: Date.now(), opened: null, closed: null };
        dc.on('open', () => (rec.opened = Date.now() - rec.startedAt));
        dc.on('close', () => (rec.closed = Date.now() - rec.startedAt));
        dc.on('error', () => {});
        window.__dcs.push(rec);
        return window.__dcs.length - 1;
      },
      target,
      serialization,
    );
  const state = (i) => attacker.evaluate((i) => window.__dcs[i], i);

  // 1. a channel that is not "raw": PeerJS would decode binary/JSON before our size limits see it, so the host turns it
  //    away before the channel even opens. (The positive control is step 2: "raw" channels do open.)
  const binary = await connect('binary');
  await sleep(6000);
  assert.equal((await state(binary)).opened, null, 'a "binary" channel never gets through to the host');
  log('a binary-serialised connection never got through');

  // 2. fill every place with connections that never say a word: one more than the host allows
  const silent = [];
  for (let i = 0; i < 26; i++) silent.push(await connect('raw'));
  await sleep(4000);
  const openedSoFar = (await Promise.all(silent.map(state))).filter((s) => s.opened !== null).length;
  assert.ok(openedSoFar >= 10, `the flood really connected (${openedSoFar} channels open)`);
  log(`${openedSoFar} silent connections hold places on the host`);

  // 3. a real player still gets in (the oldest silent connection gives way), straight away
  const guest = await newPage();
  await guest.goto(`${base}/?j=${code}`);
  await guest.waitForSelector('#name', { timeout: 30000 });
  await guest.type('#name', 'Mari');
  await guest.evaluate(() => document.querySelectorAll('.picker__item:not([disabled])')[0].click());
  await clickButton(guest, 'Klar!');
  await waitText(guest, /Du er med/, 30000);
  await waitText(host, /Spillere\s+2\/10/);
  log('a real player joined while the host was full of silent connections');

  // 4. the silent ones are cleaned away on their own: no ghosts, no places held for ever
  const deadline = Date.now() + 30_000;
  let remaining = silent.length;
  while (Date.now() < deadline) {
    // (a channel that never opened has nothing to close: the host turned it away unopened)
    remaining = (await Promise.all(silent.map(state))).filter((s) => s.opened !== null && s.closed === null).length;
    if (remaining === 0) break;
    await sleep(1000);
  }
  assert.equal(remaining, 0, 'every silent connection that got through was closed by the host within about 20 s');
  const alive = await guest.evaluate(() => document.body.innerText);
  assert.doesNotMatch(alive, /Mistet forbindelsen/, 'the real player was not disturbed by any of it');
  assert.match(await bodyText(host), /Spillere\s+2\/10/, 'the lobby still has exactly the two real players');
  log('every silent connection was closed within 20 s, the real players never noticed');

  log('\nHOSTILE CONNECTIONS: OK');
} catch (err) {
  console.error('\nHOSTILE CONNECTIONS FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
  await Promise.race([site.stop(), sleep(4000)]);
  process.exit(process.exitCode ?? 0);
}
