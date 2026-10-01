// Connections come and go on real phones. This plays through what that does to a peer-to-peer game:
//  - the host's connection to the introduction service (PeerJS broker) drops, in the lobby and mid-game: games in
//    progress carry on, new guests still get in once the host is back on the service
//  - the host wakes up (the browser says "online", or the page has been hidden for a while): it opens a fresh
//    connection to the broker by itself, because the old one may be silently dead
//  - a guest on the "game has started, pick your seat" screen loses its line to the host: it reconnects by itself
//    and the seat can still be taken
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
  // remember every WebSocket and every WebRTC connection, so a test can cut them like a network would
  await page.evaluateOnNewDocument(() => {
    window.__sockets = [];
    window.__pcs = [];
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(...args) {
        super(...args);
        window.__sockets.push(this);
      }
    };
    const NativePC = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends NativePC {
      constructor(...args) {
        super(...args);
        window.__pcs.push(this);
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
/** How many connections to the introduction service this page has made so far, and how many are open now. */
const signallingSockets = (p) =>
  p.page.evaluate(() => {
    const all = window.__sockets.filter((s) => s.url.includes('/peerjs'));
    return { made: all.length, open: all.filter((s) => s.readyState === WebSocket.OPEN).length };
  });
/** Ends the phone's WebRTC lines (to the host) the way a lost network would: the other end notices at once. */
const cutLines = (p) => p.page.evaluate(() => window.__pcs.forEach((pc) => pc.close()));

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

  // 3. the host's phone wakes up: the browser reports "online" and the old socket may be dead without anybody knowing.
  //    The host must not wait for PeerJS to notice: it opens a fresh connection to the broker by itself.
  let before = await signallingSockets(host);
  assert.equal(before.open, 1, 'the host has one open connection to the introduction service');
  await host.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await sleep(2000);
  let after = await signallingSockets(host);
  assert.ok(after.made > before.made, `"online" made the host open a new connection to the broker (${before.made} -> ${after.made})`);
  assert.equal(after.open, 1, 'and still exactly one is open');
  const d = await newPhone('Per');
  await d.page.goto(`${base}/?j=${code}`);
  await register(d, 0);
  await waitText(d, /Du er med/, 30000);
  await waitText(host, /Spillere\s+4\/10/);
  log('host woke up ("online") -> opened a fresh broker connection, and Per could join');

  //    ... and after the page has been hidden for a while (a locked screen), coming back does the same
  before = await signallingSockets(host);
  await host.page.evaluate(() => {
    const real = Date.now.bind(Date);
    window.__skew = 0;
    Date.now = () => real() + window.__skew;
    let state = 'hidden';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
    window.__skew = 16_000; // the screen stayed locked for 16 s (the guests' pings are 15 s apart, the reaper allows 35)
    state = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(2000);
  after = await signallingSockets(host);
  assert.ok(after.made > before.made, `waking from a long hidden spell made the host open a new connection (${before.made} -> ${after.made})`);
  assert.equal(after.open, 1);
  await host.page.evaluate(() => (window.__skew = 0));
  log('host came back from a long hidden spell -> opened a fresh broker connection');

  // 4. the game starts; the host drops the service again mid-game: play goes on
  await host.page.focus('#target');
  await host.page.keyboard.type('1');
  await sleep(400);
  await clickButton(host, 'Start Disputt');
  const playing = [host, a, b, d];
  await Promise.all(playing.map((p) => waitText(p, /IMPOSTER|LOJAL/i)));
  assert.ok((await cutSignalling(host)) >= 1, 'the host re-registered with the introduction service after the earlier drops');
  await sleep(2500);

  // 5. Ola's phone is gone for good (the line ends cleanly, the page is closed): his seat can be taken over
  await cutLines(b);
  await b.page.goto('about:blank');
  await Promise.all([host, a, d].map((p) => p.page.waitForFunction(() => document.querySelector('.question__text') || /har spørsmålet/i.test(document.body.innerText), { timeout: 15000 })));
  log('the round carried on without Ola');

  // 6. Kari opens the link, finds the game under way and the seat picker with Ola's seat on it. Her line to the host
  //    then drops (a locked screen, a network switch). The picker must reconnect by itself, or tapping the seat
  //    would do nothing at all.
  const c = await newPhone('Kari');
  await c.page.goto(`${base}/?j=${code}`);
  await waitText(c, /Spillet har startet/i, 30000);
  const seatShown = () => c.page.evaluate(() => [...document.querySelectorAll('.player')].some((el) => el.innerText.includes('Ola')));
  for (let tries = 0; !(await seatShown()); tries++) {
    assert.ok(tries < 15, 'Ola\'s seat became available');
    await sleep(2000); // the host needs a moment to see that Ola's line is gone
    if (await seatShown()) break;
    await clickButton(c, 'Sjekk på nytt');
    await waitText(c, /Spillet har startet/i);
  }
  log('a newcomer found the game and the seat picker');
  await cutLines(c);
  await sleep(300);
  await c.page.evaluate(() => [...document.querySelectorAll('.player')].find((el) => el.innerText.includes('Ola')).click());
  await waitText(c, /Du er\s+(IMPOSTER|LOJAL)/i, 30000);
  log('the line to the host dropped on the seat picker -> it reconnected, and the tap took the seat');

  log('\nSIGNALLING DROPS: OK');
} catch (err) {
  console.error('\nSIGNALLING DROPS FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
  await Promise.race([site.stop(), sleep(4000)]);
  process.exit(process.exitCode ?? 0);
}
