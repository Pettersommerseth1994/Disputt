// The host's connection to the introduction service (PeerJS broker) drops, as it does on a network blip or when a phone
// switches between Wi-Fi and mobile data: games in progress must carry on, and new or returning guests must still get in
// once the host is back on the service.
//   node tools/qa/signalling.mjs
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { startP2PSite } from './sites.mjs';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const site = await startP2PSite();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
const base = site.base;

async function newPhone(name) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  // remember every WebSocket, so a test can cut the one that goes to the introduction service
  await page.evaluateOnNewDocument(() => {
    window.__sockets = [];
    const Native = window.WebSocket;
    window.WebSocket = class extends Native {
      constructor(...args) {
        super(...args);
        window.__sockets.push(this);
      }
    };
  });
  page.on('pageerror', (e) => console.error(`[${name}] PAGE ERROR:`, e.message));
  return { name, ctx, page };
}
const bodyText = (p) => p.page.evaluate(() => document.body.innerText);
const waitText = (p, re, timeout = 15000) =>
  p.page
    .waitForFunction((src, flags) => new RegExp(src, flags).test(document.body.innerText), { timeout }, re.source, re.flags)
    .catch(async () => {
      throw new Error(`[${p.name}] timed out waiting for ${re}. Screen says:\n${(await bodyText(p)).slice(0, 400)}`);
    });
const clickButton = async (p, label) => {
  await p.page.waitForFunction((l) => [...document.querySelectorAll('button')].some((b) => b.innerText.includes(l) && !b.disabled), { timeout: 10000 }, label);
  await p.page.evaluate((l) => [...document.querySelectorAll('button')].find((b) => b.innerText.includes(l) && !b.disabled).click(), label);
};
async function register(p, avatarIndex) {
  await p.page.waitForSelector('#name', { timeout: 30000 });
  await p.page.type('#name', p.name);
  await p.page.evaluate((i) => document.querySelectorAll('.picker__item:not([disabled])')[i].click(), avatarIndex);
  await clickButton(p, 'Klar!');
}
/** Closes the phone's open connection(s) to the introduction service; returns how many it closed. */
const cutSignalling = (p) =>
  p.page.evaluate(() => {
    const open = window.__sockets.filter((s) => s.url.includes('/peerjs') && s.readyState === WebSocket.OPEN);
    open.forEach((s) => s.close());
    return open.length;
  });

try {
  const host = await newPhone('Petter');
  await host.page.goto(`${base}/`);
  await clickButton(host, 'Start et spill');
  await host.page.waitForSelector('.lobby__code', { timeout: 20000 });
  const code = await host.page.$eval('.lobby__code', (el) => el.textContent.trim());
  await host.page.evaluate(() => document.querySelector('.profile-prompt').click());
  await register(host, 0);
  await waitText(host, /Spillere\s+1\/10/);

  const a = await newPhone('Mari');
  await a.page.goto(`${base}/?j=${code}`);
  await register(a, 0);
  await waitText(a, /Du er med/);
  log(`game ${code}: host and Mari in the lobby`);

  // 1. the host loses the introduction service in the lobby; a new guest must still get in
  assert.ok((await cutSignalling(host)) >= 1, 'the host had a connection to the introduction service');
  await sleep(1500);
  const b = await newPhone('Ola');
  await b.page.goto(`${base}/?j=${code}`);
  await register(b, 0);
  await waitText(b, /Du er med/, 30000);
  await waitText(host, /Spillere\s+3\/10/);
  log('host dropped the introduction service in the lobby -> Ola still joined');

  // 2. a guest losing it changes nothing (the line to the host does not depend on it)
  assert.ok((await cutSignalling(a)) >= 1);
  await sleep(2500);
  assert.equal(await a.page.$('.banner'), null, 'no "connection lost" banner for a guest whose introduction connection dropped');
  await waitText(host, /Spillere\s+3\/10/);

  // 3. the game starts, the host drops the service again mid-game: play goes on, a newcomer finds the game
  await host.page.focus('#target');
  await host.page.keyboard.type('1');
  await sleep(400);
  await clickButton(host, 'Start Disputt');
  const all = [host, a, b];
  await Promise.all(all.map((p) => waitText(p, /IMPOSTER|LOJAL/i)));
  assert.ok((await cutSignalling(host)) >= 1, 'the host re-registered with the introduction service after the first drop');
  await sleep(2500);
  const c = await newPhone('Kari');
  await c.page.goto(`${base}/?j=${code}`);
  await waitText(c, /Spillet har startet/i, 30000);
  log('host dropped the introduction service mid-game -> a newcomer still finds the game');
  await Promise.all(all.map((p) => p.page.waitForFunction(() => document.querySelector('.question__text') || /har spørsmålet/i.test(document.body.innerText), { timeout: 15000 })));
  log('and the round carried on');

  log('\nSIGNALLING DROPS: OK');
} catch (err) {
  console.error('\nSIGNALLING DROPS FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
  await Promise.race([site.stop(), sleep(4000)]);
  process.exit(process.exitCode ?? 0);
}
