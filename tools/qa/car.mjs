// UI end-to-end for bilturmodus: everybody plays on ONE phone, the host's, through the real interface.
//   node tools/qa/car.mjs [players=3] [target=2] [--p2p] [--subpath] [--pay] [--url=https://…] [--shots]
//   players 2 tries the rule for two (a round with no impostor); 6 or more has two impostors, who must be told about each other
//   --outcomes  with two players: keep playing (no target) until a round with the first as the impostor, one with the second and one with
//              nobody have all been seen, and then end the game from the host's menu
//   --p2p      test the peer-to-peer build (static site + local PeerJS signalling server) instead of the Node server; a game on one
//              phone must not touch the network at all there: no WebSocket, no WebRTC
//   --subpath  with --p2p: serve the site below /Disputt/ like GitHub Pages does
//   --pay      payments switched on (with --p2p; needs a target of 3 or more): after the second round the host has to pay, through
//              a pretend Stripe. The conditions are the normal ones: two rounds free, then the packages
//   --url      play against an already deployed peer-to-peer site (real timers)
// Needs Google Chrome (CHROME_PATH to override). Exits non-zero on the first thing that does not behave.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { QUESTIONS } from '../../shared/questions.js';
import { startPaymentsStack } from './payments-stack.mjs';
import { FAST, startNodeSite, startP2PSite } from './sites.mjs';
import { underTheFinger } from './underfinger.mjs';

const args = process.argv.slice(2);
const OUTCOMES_ARG = args.includes('--outcomes');
const flags = args.filter((a) => a.startsWith('--'));
const nums = args.filter((a) => !a.startsWith('--')).map(Number);
const PLAYERS = nums[0] ?? 3;
const TARGET = OUTCOMES_ARG ? 99 : (nums[1] ?? 2);
assert.ok(Number.isInteger(PLAYERS) && PLAYERS >= 2 && PLAYERS <= 10 && Number.isInteger(TARGET) && TARGET >= 1, 'usage: car.mjs [players 2-10] [target]');
const SHOTS = flags.includes('--shots');
const OUTCOMES = flags.includes('--outcomes');
if (OUTCOMES) assert.ok(PLAYERS === 2, '--outcomes is for two players');
const LIVE_URL = flags.find((f) => f.startsWith('--url='))?.slice('--url='.length);
const LIVE = Boolean(LIVE_URL);
const SUBPATH = flags.includes('--subpath');
const PAY = flags.includes('--pay');
const P2P = LIVE || SUBPATH || flags.includes('--p2p');
const FREE_ROUNDS = 2; // (the page's default)
if (PAY) assert.ok(!LIVE && P2P && TARGET >= 3, '--pay needs --p2p, a local site and a target of 3 or more, so that there is a third round to pay for');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const NAMES = ['Petter', 'Mari', 'Ola', 'Sofie', 'Jonas', 'Ida', 'Kari', 'Per', 'Nina', 'Lars'];
const names = NAMES.slice(0, PLAYERS);
const HOST = names[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);
let where = 'the start'; // (what the test was doing: said when something fails)

const stack = PAY ? await startPaymentsStack() : null;
const site = LIVE
  ? { base: LIVE_URL.replace(/\/+$/, ''), stop: async () => {} }
  : P2P
    ? await startP2PSite({ prefix: SUBPATH ? '/Disputt/' : '', payments: stack && { url: stack.apiUrl, key: stack.publicKey, methods: 'vipps,applepay' } })
    : await startNodeSite();
const base = site.base;
stack?.setSite(`${base}/`);
log(`${LIVE ? 'deployed peer-to-peer site' : P2P ? 'peer-to-peer build' : 'Node server'} at ${base}, ${PLAYERS} players in the car`);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
if (SHOTS) fs.mkdirSync('tmp/car', { recursive: true });

// ---------------------------------------------------------------- the one phone
const problems = [];
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
// What the page asks the network for: a game on one phone must not make a WebSocket or a WebRTC line in the peer-to-peer build.
await page.evaluateOnNewDocument(() => {
  // (kept in the tab's session storage: the page is reloaded now and then, and the log must be of the whole game)
  const note = (what, url) => {
    try {
      const log = JSON.parse(sessionStorage.getItem('__net') ?? '{"sockets":[],"peers":0}');
      if (what === 'ws') log.sockets.push(url);
      else log.peers++;
      sessionStorage.setItem('__net', JSON.stringify(log));
    } catch {
      /* no storage: nothing to note */
    }
  };
  const WS = window.WebSocket;
  window.WebSocket = function (...a) {
    note('ws', String(a[0]));
    return new WS(...a);
  };
  Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  window.WebSocket.prototype = WS.prototype;
  for (const k of ['RTCPeerConnection', 'webkitRTCPeerConnection']) {
    const P = window[k];
    if (!P) continue;
    window[k] = function (...a) {
      note('rtc');
      return new P(...a);
    };
    window[k].prototype = P.prototype;
  }
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => ({ release: async () => {}, addEventListener() {} }) } });
});
page.on('pageerror', (e) => {
  problems.push(`page error: ${e.message}`);
  console.error('PAGE ERROR:', e.message);
});
page.on('console', (m) => {
  if (m.type() !== 'error' || /404/.test(m.text())) return;
  if (/Content Security Policy|Refused to (load|connect|execute)/i.test(m.text())) problems.push(`blocked by the CSP: ${m.text()}`);
  console.error('console.error:', m.text());
});

const NAVIGATING = /detached Frame|Execution context was destroyed|Cannot find context/i;
async function steady(ask) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await ask();
    } catch (err) {
      if (attempt >= 5 || !NAVIGATING.test(String(err?.message))) throw err;
      await sleep(250);
    }
  }
}
for (const method of ['$eval', '$$eval', '$', '$$', 'waitForFunction', 'waitForSelector']) {
  const original = page[method].bind(page);
  page[method] = (...a) => steady(() => original(...a));
}
const bodyText = () => steady(() => page.evaluate(() => document.body.innerText));
const screenText = () => page.$eval('main', (el) => el.innerText.replace(/\s+/g, ' '));
const waitText = (re, timeout = 10000) =>
  page.waitForFunction((src, flags) => new RegExp(src, flags).test(document.body.innerText), { timeout }, re.source, re.flags).catch(async () => {
    throw new Error(`timed out waiting for ${re}. Screen says:\n${(await bodyText()).slice(0, 600)}`);
  });
const waitGone = (re, timeout = 10000) =>
  page.waitForFunction((src, flags) => !new RegExp(src, flags).test(document.body.innerText), { timeout }, re.source, re.flags).catch(async () => {
    throw new Error(`still there: ${re}. Screen says:\n${(await bodyText()).slice(0, 600)}`);
  });
const clickButton = async (label, timeout = 10000) => {
  await page
    .waitForFunction((l) => [...document.querySelectorAll('button')].some((b) => b.innerText.trim().includes(l) && !b.disabled), { timeout }, label)
    .catch(async () => {
      throw new Error(`no enabled button "${label}". Screen says:\n${(await bodyText()).slice(0, 600)}`);
    });
  await steady(() => page.evaluate((l) => [...document.querySelectorAll('button')].find((b) => b.innerText.trim().includes(l) && !b.disabled).click(), label));
};
const buttons = () => page.$$eval('button', (els) => els.map((b) => ({ text: b.innerText.trim(), disabled: b.disabled })));
const shot = async (label) => SHOTS && page.screenshot({ path: `tmp/car/${label}.png` });
const clickLabel = async (label) => {
  await page.waitForSelector(`button[aria-label="${label}"]`, { timeout: 5000 });
  await page.evaluate((l) => document.querySelector(`button[aria-label="${l}"]`).click(), label);
};
const toasts = () => page.$$eval('.toast', (els) => els.map((e) => e.innerText));

// The role is on the screen only while a finger holds a button. Presses the one that is on the screen (`within` narrows where), reads what
// the screen says while it is held, lets go, and checks that the role is hidden again.
const ROLE_WORD = /\b(Imposter|Lojal)\b/; // (as a word of its own: "Imposteren" or "lojale" inside a sentence is not the role)
async function hold(within = '', ms = 700) {
  where = `holding the button ${within || 'on the screen'}`;
  const button = await page.waitForSelector(`${within} .role-strip .secret`.trim(), { visible: true, timeout: 5000 });
  // (a sheet slides in, and a button that is measured on the way is not where it ends up: wait until it stands still)
  let box = await button.boundingBox();
  for (let i = 0; i < 25; i++) {
    await sleep(80);
    const again = await button.boundingBox();
    const still = Math.abs(again.x - box.x) < 0.5 && Math.abs(again.y - box.y) < 0.5;
    box = again;
    if (still && box.y < 844) break;
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { timeout: 3000 }, ROLE_WORD.source).catch(async (err) => {
    const at = await page.evaluate((x, y) => {
      const e = document.elementFromPoint(x, y);
      return `${e?.tagName}.${e?.className} "${(e?.innerText ?? '').slice(0, 30)}"`;
    }, box.x + box.width / 2, box.y + box.height / 2);
    throw new Error(`pressing the button at ${Math.round(box.x + box.width / 2)},${Math.round(box.y + box.height / 2)} showed no role (under the finger: ${at}): ${err.message.split('\n')[0]}`);
  });
  await sleep(150); // (let the strip settle: the sheets slide in, and the strip opens)
  const moved = await (await page.$(`${within} .role-strip .secret`.trim())).boundingBox();
  // (the pressed button sits 2 px lower and the open strip 2 px further in, as it does in the normal game: that is by design)
  assert.ok(Math.abs(moved.x - box.x) <= 3 && Math.abs(moved.y - box.y) <= 3, `the button stays where the finger is when the role opens (it was at ${Math.round(box.x)},${Math.round(box.y)}, it is at ${Math.round(moved.x)},${Math.round(moved.y)})`);
  const strip = await page.evaluate((w) => (document.querySelector(`${w} .role-strip`.trim())?.innerText ?? '').replace(/\s+/g, ' '), within);
  const buttonText = await page.evaluate((w) => (document.querySelector(`${w} .role-strip .secret`.trim())?.innerText ?? '').trim(), within);
  const covered = await page.evaluate(underTheFinger);
  assert.deepEqual(covered, [], 'nothing that the hold reveals sits on or under the button, where the finger covers it');
  await sleep(ms);
  await page.mouse.up();
  await page.waitForFunction((src) => !new RegExp(src).test(document.body.innerText), { timeout: 3000 }, ROLE_WORD.source).catch(async (err) => {
    const state = await page.evaluate((src) => {
      const m = document.body.innerText.match(new RegExp(`.{0,40}${src}.{0,40}`));
      return `${m ? JSON.stringify(m[0]) : 'no match'}; strips: ${[...document.querySelectorAll('.role-strip')].map((e) => e.className).join(' | ')}`;
    }, ROLE_WORD.source);
    throw new Error(`the role was still on the screen after the finger lifted: ${state}: ${err.message.split('\n')[0]}`);
  });
  const role = /\bImposter\b/.test(strip) ? 'impostor' : 'loyal';
  return { strip, buttonText, role };
}

// ---------------------------------------------------------------- the set-up
async function enterPlayer(name, button) {
  await page.waitForSelector('#player-name', { timeout: 5000 });
  await page.$eval('#player-name', (i) => (i.value = '')); // (the field may have a name in it already)
  await page.type('#player-name', name);
  // (the button of the form, by its whole text: "Legg til" is also in "+ Legg til spiller", behind the form)
  await page.waitForFunction((l) => [...document.querySelectorAll('.sheet button')].some((b) => b.innerText.trim() === l && !b.disabled), { timeout: 5000 }, button);
  await page.evaluate((l) => [...document.querySelectorAll('.sheet button')].find((b) => b.innerText.trim() === l && !b.disabled).click(), button);
}
const openPlayer = (name) => page.evaluate((n) => [...document.querySelectorAll('.roster__main')].find((b) => b.getAttribute('aria-label') === `Endre ${n}`).click(), name);
const rosterNames = () => page.$$eval('.roster__main .roster__name', (els) => els.map((el) => el.firstChild.textContent.trim()));

async function setUp() {
  await page.goto(`${base}/`);
  await waitText(/Diskuter,?\s+manipuler\s+og\s+vinn/);
  await clickButton('Opprett spill');
  // 1. how to play
  await waitText(/Steg 1 av 4/);
  assert.match(await bodyText(), /Hvordan vil dere spille\?/);
  assert.equal((await buttons()).find((b) => b.text === 'Neste').disabled, true, 'Neste waits for a way to play');
  await clickButton('Bilturmodus');
  await shot('01-mode');
  await clickButton('Neste');

  // 2. who plays: the host's own name first
  await waitText(/Steg 2 av 4/);
  assert.match(await bodyText(), /Hvem spiller\?/);
  await page.waitForSelector('#player-name', { timeout: 5000 });
  assert.match(await bodyText(), /Hvem er du\?/, 'the host is asked for their own name first');
  assert.equal((await buttons()).find((b) => b.text === 'Lagre').disabled, true, 'a name is needed');
  await page.type('#player-name', HOST);
  assert.equal((await buttons()).find((b) => b.text === 'Lagre').disabled, false, 'the next free avatar is already chosen: a name is all it takes');
  await clickButton('Lagre');
  await page.waitForFunction(() => !document.querySelector('.sheet'), { timeout: 5000 });
  assert.deepEqual(await rosterNames(), [HOST], 'the host is first in the list');
  assert.match(await screenText(), new RegExp(`${HOST}\\s*vert`), 'and is marked as the host');
  assert.equal((await buttons()).find((b) => b.text === 'Neste').disabled, true, 'Neste waits for a second player');
  assert.match(await bodyText(), /Legg inn 1 spiller til · minst 2/);
  // alone, "back" goes back to the way to play, and on again
  await clickButton('Tilbake');
  await waitText(/Hvordan vil dere spille\?/);
  await clickButton('Bilturmodus');
  await clickButton('Neste');
  await waitText(/Hvem er du\?/);
  await page.type('#player-name', HOST);
  await clickButton('Lagre');
  await page.waitForFunction(() => !document.querySelector('.sheet'), { timeout: 5000 });

  // the others: a name is enough; a name that is taken is told so, and the form stays
  for (const [i, name] of names.slice(1).entries()) {
    await clickButton('Legg til spiller');
    await waitText(/Ny spiller/);
    if (i === 0) {
      await enterPlayer(HOST.toLowerCase(), 'Legg til'); // the same name in other letters
      await waitText(/Det navnet er tatt/);
      assert.ok(await page.$('.sheet'), 'the form stays open when the name is taken');
    }
    await enterPlayer(name, 'Legg til');
    await page.waitForFunction(() => !document.querySelector('.sheet'), { timeout: 5000 });
    await waitText(new RegExp(`${i + 2} spillere er med`));
  }
  assert.deepEqual(await rosterNames(), names, 'everybody is in, in the order they were put in');
  await shot('02-players');
  assert.equal(await page.$('.steps__row .btn--text'), null, 'with other players in, there is no way back to the choice of how to play (their names would be lost)');
  if (PLAYERS === 2) {
    const text = await screenText();
    assert.match(text, /Dere er bare to/);
    assert.match(text, /På 1\/3 av spørsmålene er ingen impostere\. Dette er tilfeldig\./);
  } else assert.doesNotMatch(await screenText(), /Dere er bare to/, 'the note about two is only for two');

  // a change of name, and two taps to take somebody out
  await openPlayer(HOST);
  await waitText(/Endre spiller/);
  assert.equal(await page.$eval('#player-name', (i) => i.value), HOST, 'the form has the name that was there');
  await clickLabel('Lukk');
  await page.waitForFunction(() => !document.querySelector('.sheet'));
  await openPlayer(names[1]);
  await waitText(/Endre spiller/);
  await enterPlayer('Marit', 'Lagre');
  await page.waitForFunction(() => !document.querySelector('.sheet'), { timeout: 5000 });
  assert.equal((await rosterNames())[1], 'Marit', 'the new name is in the list');
  await openPlayer('Marit');
  await waitText(/Endre spiller/);
  await enterPlayer(names[1], 'Lagre');
  await page.waitForFunction(() => !document.querySelector('.sheet'), { timeout: 5000 });
  assert.deepEqual(await rosterNames(), names);
  // up to ten, and no more (and the extra ones go again, with two taps each)
  const extra = NAMES.slice(PLAYERS);
  for (const name of extra) {
    await clickButton('Legg til spiller');
    await enterPlayer(name, 'Legg til');
    await page.waitForFunction(() => !document.querySelector('.sheet'), { timeout: 5000 });
  }
  assert.equal((await rosterNames()).length, 10);
  assert.equal(await page.$('.roster__add'), null, 'no more than ten');
  if (extra.length) {
    await page.evaluate((n) => document.querySelector(`button[aria-label="Fjern ${n}"]`).click(), extra.at(-1));
    await waitText(/Fjern\?/);
    assert.ok((await rosterNames()).includes(extra.at(-1)), 'one tap does not take anybody out');
    await page.evaluate((n) => document.querySelector(`button[aria-label="Trykk igjen for å fjerne ${n}"]`).click(), extra.at(-1));
    await page.waitForFunction((n) => document.querySelectorAll('.roster__main').length === n, { timeout: 5000 }, 9);
    for (const name of extra.slice(0, -1).reverse()) {
      await page.evaluate((n) => document.querySelector(`button[aria-label="Fjern ${n}"]`).click(), name);
      await page.waitForSelector(`button[aria-label="Trykk igjen for å fjerne ${name}"]`, { timeout: 3000 });
      await page.evaluate((n) => document.querySelector(`button[aria-label="Trykk igjen for å fjerne ${n}"]`).click(), name);
      await page.waitForFunction((n) => !document.querySelector(`button[aria-label="Fjern ${n}"]`), { timeout: 3000 }, name);
    }
    await page.waitForFunction((n) => document.querySelectorAll('.roster__main').length === n, { timeout: 5000 }, PLAYERS);
    assert.deepEqual(await rosterNames(), names, 'the extra players are gone again');
  }
  log(`${PLAYERS} players put in on the host's phone`);

  // 3. how long: the normal step, and a point is six minutes
  await clickButton('Neste');
  await waitText(/Steg 3 av 4/);
  assert.match(await bodyText(), /Hvor lenge skal dere spille\?/);
  await page.focus('#target');
  await page.keyboard.type(String(TARGET));
  await sleep(500);
  const bodyNow = await bodyText();
  if (TARGET * 6 < 90) assert.match(bodyNow, new RegExp(`ca\\. ${TARGET * 6} min`), 'six minutes a point');
  assert.match(bodyNow, /Ett poeng tar ca\. 6 minutter/);
  // "back" and on again keep the players
  await clickButton('Tilbake');
  await waitText(/Steg 2 av 4/);
  assert.deepEqual(await rosterNames(), names, 'the players are still there after going back');
  await clickButton('Neste');
  await waitText(/Steg 3 av 4/);
  assert.equal(await page.$eval('#target', (i) => i.value), String(TARGET), 'and so are the points');
  await clickButton('Neste');

  // 4. how it works
  await waitText(/Steg 4 av 4/);
  const how = await bodyText();
  assert.match(how, /Klar\? Slik funker det/);
  assert.match(how, /Send telefonen rundt/);
  assert.match(how, new RegExp(`${HOST} leser spørsmålet`));
  assert.match(how, new RegExp(`Først til ${TARGET} poeng`));
  assert.match(how, new RegExp(`${PLAYERS} spillere`));
  if (PLAYERS >= 6) assert.match(how, /to imposterer/);
  assert.doesNotMatch(how, /Slik går det/);
  await shot('03-how');
  // the rules from the help button are the rules of the car
  await clickLabel('Slik spiller du');
  await waitText(/Send telefonen rundt[\s\S]*Verten stiller spørsmålet/);
  assert.match(await bodyText(), /Fra 2 til 10 spillere/);
  await clickLabel('Lukk');
  await page.waitForFunction(() => !document.querySelector('.sheet'));
  await clickButton('Start spillet');
}

// ---------------------------------------------------------------- a round
let outcomes = { none: 0, first: 0, second: 0 }; // (two players: who was the impostor, if anybody)
const seenRoles = new Map(); // name -> role, in the round that is on

/** The phone goes round: one name after the other, and the roles are what they should be. */
async function sendPhoneRound(round) {
  where = `round ${round}: the phone goes round`;
  await waitText(/Send telefonen rundt/);
  seenRoles.clear();
  assert.match(await bodyText(), new RegExp(`Runde ${round}`));
  const idle = await bodyText();
  assert.doesNotMatch(idle, ROLE_WORD, `round ${round}: nothing about any role is on the screen before a button is held`);
  assert.match(idle, new RegExp(`0 av ${PLAYERS} har sett rollen sin`));
  assert.equal((await buttons()).find((b) => b.text === 'Alle har sett rollen sin').disabled, true, 'nobody goes on before everybody has seen');
  for (const [i, name] of names.entries()) {
    // only the one whose turn it is has a button: the others wait
    const strips = await page.$$('.role-strip .secret');
    assert.equal(strips.length, 1, 'one button, for the one whose turn it is');
    const active = await page.$eval('.rolerow--strip .rolerow__name', (el) => el.firstChild.textContent.trim());
    assert.equal(active, name, `it is ${name}'s turn`);
    const waiting = await page.$$eval('.rolerow--wait .rolerow__name', (els) => els.map((el) => el.firstChild.textContent.trim()));
    assert.deepEqual(waiting, names.slice(i + 1), 'the rest wait, in order');
    if (round === 1 && i === 0) {
      // a touch that is too short to see anything does not use up the turn
      const b = await (await page.$('.role-strip .secret')).boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await sleep(80);
      await page.mouse.up();
      await sleep(400);
      assert.equal(await page.$$eval('.rolerow--done', (els) => els.length), 0, 'a short touch does not count as having seen the role');
      assert.match(await bodyText(), new RegExp(`0 av ${PLAYERS} har sett rollen sin`));
    }
    const peek = await hold('.rolerow--strip', 650);
    assert.equal(peek.buttonText, 'Hold for å se', "the button keeps its text (the answer is not in it, under the finger)");
    assert.match(peek.strip, /^Du er /, 'the strip says who you are');
    seenRoles.set(name, { role: peek.role, strip: peek.strip });
    await waitText(new RegExp(`${i + 1} av ${PLAYERS} har sett rollen sin`));
    const done = await page.$$eval('.rolerow--done .rolerow__name', (els) => els.map((el) => el.firstChild.textContent.trim()));
    assert.deepEqual(done, names.slice(0, i + 1), 'the ones who have seen are marked, in order');
    // and the phone goes to the next: the host gets it back at the end
    const next = names[(i + 1) % PLAYERS];
    assert.match(await screenText(), new RegExp(`Gi telefonen til ${next}`), `the phone goes to ${next}`);
    if (i === 0 && round === 1) await shot('04-roles-after-first');
  }
  await waitText(/Alle har sett rollen sin[\s\S]*Gi telefonen tilbake til verten/);
  assert.equal((await buttons()).find((b) => b.text === 'Vis spørsmålet').disabled, false);
  if (round === 1) await shot('05-roles-all-seen');

  // who is the impostor? a lone one (two from six players), and with two players a round may have none
  const roles = names.map((n) => seenRoles.get(n).role);
  const count = roles.filter((r) => r === 'impostor').length;
  if (PLAYERS === 2) {
    assert.ok(count <= 1, `round ${round}: with two players at most one impostor (${roles})`);
    if (count === 0) outcomes.none++;
    else if (roles[0] === 'impostor') outcomes.first++;
    else outcomes.second++;
  } else assert.equal(count, PLAYERS >= 6 ? 2 : 1, `round ${round}: ${PLAYERS >= 6 ? 2 : 1} impostor(s) among ${PLAYERS}, got ${roles}`);
  for (const [name, { role, strip }] of seenRoles) {
    if (role === 'impostor') assert.match(strip, /Riktig svar: [A-D]: /, `${name} (the impostor) sees the right answer, beside the button`);
    else assert.doesNotMatch(strip, /Riktig svar/, `${name} is loyal and has nothing to look up`);
    if (PLAYERS >= 6) {
      const mates = [...seenRoles].filter(([n, r]) => r.role === 'impostor' && n !== name).map(([n]) => n);
      if (role === 'impostor') assert.match(strip, new RegExp(`Sammen med ${mates[0]}\\b`), `${name} is told who the other impostor is`);
      else assert.match(strip, /To av dere er imposterer/);
    } else assert.doesNotMatch(strip, /Sammen med|er imposterer/);
  }
  return { count, roles };
}

const askerScreen = () => page.waitForSelector('.question__text', { timeout: 10000 });

async function playRound(round) {
  where = `round ${round}`;
  const { count } = await sendPhoneRound(round);
  if (round === 1) {
    // a reload in the middle of the phone going round is the same game, with the same roles (the game is the page, or the server)
    await page.reload();
    await waitText(/Alle har sett rollen sin[\s\S]*Gi telefonen tilbake til verten/, 30000);
    assert.match(await bodyText(), new RegExp(`${PLAYERS} av ${PLAYERS} har sett rollen sin`), 'after a reload everybody has still seen their role');
  }
  await clickButton('Vis spørsmålet');
  await askerScreen();

  // the host has the question, every round; the strip only asks, and "Se rolle" is how a forgotten role is found
  const questionText = await page.$eval('.question__text', (el) => el.textContent.trim());
  const q = QUESTIONS.find((x) => x.text === questionText);
  assert.ok(q, `known question: ${questionText}`);
  const strip = await page.$eval('.role-strip', (el) => el.innerText.replace(/\s+/g, ' '));
  assert.match(strip, /Glemt rollen din\?/);
  assert.doesNotMatch(await bodyText(), ROLE_WORD, 'the game screen says nothing about any role');
  assert.equal(await page.$('.role-strip--open'), null);
  if (round === 1) await shot('06-question');
  if (round <= 2) {
    await clickButton('Se rolle');
    await waitText(/Se rolle igjen/);
    assert.match(await bodyText(), /Hvem er du\?/);
    assert.doesNotMatch(await bodyText(), ROLE_WORD, 'the list of names says nothing about any role');
    const listed = await page.$$eval('.sheet .roster__main .roster__name', (els) => els.map((el) => el.textContent.trim()));
    assert.deepEqual(listed, names, 'the list has everybody, in order');
    // everybody can look their role up again, and it is the role they were shown when the phone went round
    for (const name of round === 1 ? names : [names[PLAYERS - 1]]) {
      await page.evaluate((n) => [...document.querySelectorAll('.sheet .roster__main')].find((b) => b.innerText.trim() === n).click(), name);
      await page.waitForSelector('.sheet .rolerow--strip .secret', { visible: true });
      assert.equal((await page.$$('.sheet .role-strip .secret')).length, 1, 'one button: the name that was chosen');
      const peek = await hold('.sheet', 450);
      assert.equal(peek.role, seenRoles.get(name).role, `${name}'s role is the same as when the phone went round`);
      assert.equal(peek.strip.replace(/\s+/g, ' '), seenRoles.get(name).strip, `${name}'s strip says the same`);
    }
    if (round === 1) await shot('07-roles-sheet');
    await clickLabel('Lukk');
    await page.waitForFunction(() => !document.querySelector('.sheet'));
  }

  // the clock and the answer: the group agrees, and the host locks it
  await clickButton('10');
  await sleep(300);
  assert.match(await page.$eval('.timer', (el) => el.textContent.replace(/\s/g, '')), /^(09:5\d|10:00)$/, 'the clock is set to ten minutes');
  const groupRight = round % 2 === 1;
  const choice = groupRight ? q.correct : (q.correct + 1) % 4;
  await page.evaluate((i) => document.querySelectorAll('.option')[i].click(), choice);
  await sleep(200);
  await clickButton('Lås svaret');

  // the countdown says what was locked and not whether it was right; then the reveal is spoken, the same whoever the impostors are
  await waitText(/Svaret er låst/i);
  const lockedAs = `${'ABCD'[choice]}: ${q.options[choice]}`;
  assert.ok((await screenText()).includes(`Dere låste ${lockedAs}`), `the countdown says what was locked: ${lockedAs}`);
  assert.doesNotMatch(await bodyText(), /Riktig!|Feil!|Riktig svar/, 'the countdown does not say whether it was right');
  await waitText(/avslører seg/i, 10000);
  const stage = await page.evaluate(() => ({ body: document.querySelector('.stage__body')?.innerText.replace(/\s+/g, ' ') ?? '', whole: document.body.innerText.replace(/\s+/g, ' ') }));
  assert.match(stage.body, PLAYERS >= 6 ? /Imposterne avslører seg/ : /Imposteren avslører seg/, 'the reveal says the same, also when nobody is the impostor');
  assert.doesNotMatch(stage.whole, /Ingen var imposter|ingen imposter|Gruppa hadde rett|lurte dere|Imposter(en|ne) var/, 'the reveal gives nothing away');
  if (q.options[q.correct].length >= 5) assert.ok(!stage.whole.includes(q.options[q.correct]), 'and does not say the right answer');
  if (round === 1) await shot('08-reveal');
  // a double tap on "Det er sagt": the second tap hits a screen that is already out of date, and must not show an error
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('Det er sagt'));
    b.click();
    b.click();
  });
  await waitText(/Poengene|vant!|Delt seier/i, 10000);
  await sleep(300);
  assert.deepEqual(await toasts(), [], 'no error toast after a double tap');

  // the points: to the loyal ones when the group was right, to the impostors when it was fooled, and to nobody when there is no impostor
  const finished = /vant!|Delt seier/i.test(await bodyText());
  if (round === 1) await shot('09-summary');
  if (!finished) {
    const text = await screenText();
    const impostorNames = names.filter((n) => seenRoles.get(n).role === 'impostor');
    if (count === 0) {
      assert.match(text, /Ingen var imposter denne runden\./);
      assert.match(text, groupRight ? /Dere svarte riktig sammen!/ : /Dere svarte feil\. Ingen fikk poeng\./);
    } else assert.match(text, groupRight ? /Gruppa hadde rett/ : PLAYERS >= 6 ? /Imposterne lurte dere/ : /Imposteren lurte dere/);
    assert.match(text, /Neste runde får dere nye roller: send telefonen rundt igjen\./);
    assert.doesNotMatch(text, /\(deg\)/, 'nobody is "(deg)": they are all at the table');
    const rows = await page.$$eval('.scoreboard .score', (els) => els.map((el) => ({ name: el.querySelector('.score__name').innerText.trim(), gain: Boolean(el.querySelector('.score__gain')) })));
    const gainers = rows.filter((r) => r.gain).map((r) => r.name).sort();
    const expected = names.filter((n) => (groupRight ? !impostorNames.includes(n) : impostorNames.includes(n))).sort();
    assert.deepEqual(gainers, expected, `round ${round}: the points went to ${expected.join(', ') || 'nobody'}`);
    // "Se fasit": the right answer, what was locked, and who the impostors were (or that there were none)
    await clickButton('Se fasit');
    await waitText(/Fasit/);
    const key = await page.$eval('.sheet', (el) => el.innerText.replace(/\s+/g, ' '));
    assert.ok(key.includes(q.options[q.correct]), 'the answer key shows the right answer');
    assert.ok(key.includes(lockedAs), 'and what was locked');
    if (count === 0) assert.match(key, /imposteren var\s+ingen i denne runden/i);
    else for (const n of impostorNames) assert.ok(key.includes(n), `and names ${n}`);
    await clickLabel('Lukk');
    await page.waitForFunction(() => !document.querySelector('.sheet'));
    if (round === 1) {
      const scores = await page.$$eval('.score__points', (els) => els.length);
      assert.equal(scores, PLAYERS);
      await clickButton('Poeng'); // the scoreboard from the header
      await waitText(/Poengtavle/);
      assert.doesNotMatch(await page.$eval('.sheet', (el) => el.innerText), /\(deg\)/);
      await clickLabel('Lukk');
      await page.waitForFunction(() => !document.querySelector('.sheet'));
    }
  }
  return { finished, groupRight };
}

// ---------------------------------------------------------------- the paid part
// After the free rounds the packages come, the same as in the normal game (screens/pay.js): Stripe's page, and back to the game.
async function payAfterFreeRounds() {
  const before = stack.fake.sessions.size;
  await clickButton('Neste runde');
  await waitText(/Fortsett kvelden/);
  const paywall = await bodyText();
  assert.match(paywall, /Dere har spilt to runder gratis/, 'two rounds are free, as in the normal game');
  for (const [name, price] of [['En kveld', 89], ['For ett år', 249], ['Livstid', 299]]) assert.match(paywall, new RegExp(`${name}[\\s\\S]*${price} kr`), `${name} is shown with its price`);
  assert.equal(stack.fake.sessions.size, before, 'nothing is started at Stripe until the host chooses');
  await shot('20-paywall');
  await page.evaluate(() => document.querySelector('input[name=plan][value=evening]').click());
  await clickButton('Betal med Vipps');
  await page.waitForFunction(() => location.pathname.startsWith('/pay/'), { timeout: 20000 });
  const session = [...stack.fake.sessions.values()].at(-1);
  assert.equal(session.metadata.plan, 'evening');
  assert.equal(session.amount_total, 8900);
  // (the page is gone from the game: it is on Stripe's. The game on this phone has to be there when the host comes back)
  await page.click('#pay');
  await waitText(/Velkommen!/, 30000);
  assert.match(await page.$eval('.sheet', (el) => el.innerText.replace(/\s+/g, ' ')), /En kveld/);
  assert.equal(new URL(page.url()).search, '', 'the address bar is clean after coming back');
  await clickButton(`Start runde ${FREE_ROUNDS + 1}`);
  await waitText(new RegExp(`Runde ${FREE_ROUNDS + 1}[\\s\\S]*Send telefonen rundt`), 20000);
  const rosterBack = await page.$$eval('.rolerow__name', (els) => els.map((el) => el.firstChild.textContent.trim()));
  assert.deepEqual(rosterBack, names, 'after Stripe the same game, with the same players, goes on');
  log('after two free rounds the host paid, came back from Stripe, and the third round started with the same players');
}

// ---------------------------------------------------------------- the game
try {
  await setUp();
  let round = 0;
  let finished = false;
  let paid = false;
  const seenAll = () => outcomes.none > 0 && outcomes.first > 0 && outcomes.second > 0;
  while (!finished && round < 40) {
    round++;
    ({ finished } = await playRound(round));
    if (finished) break;
    if (OUTCOMES && seenAll()) break;
    if (PAY && round === FREE_ROUNDS) {
      await payAfterFreeRounds(); // (the third round is on when it is done: the next turn of this loop plays it)
      paid = true;
    } else await clickButton('Neste runde');
  }
  if (OUTCOMES) {
    // two players, and no target: the rounds went on until each of the three ways a round can go had come up. The host ends the game.
    assert.ok(seenAll(), `in ${round} rounds all three ways to go came up (${JSON.stringify(outcomes)})`);
    await clickLabel('Vertsvalg');
    await waitText(/Avslutt spillet nå/);
    await clickButton('Avslutt spillet nå');
    await waitText(/Trykk igjen for å bekrefte/);
    await clickButton('Trykk igjen for å bekrefte');
    await waitText(/Sluttresultat/);
    finished = true;
  }
  assert.ok(finished, 'the game ended with a winner');
  if (PAY) assert.ok(paid, 'the host was asked to pay after the free rounds');
  const finalText = await bodyText();
  assert.match(finalText, /Sluttresultat/);
  assert.doesNotMatch(finalText, /\(deg\)/);
  await shot('10-finished');
  log(`game finished after ${round} rounds: ${finalText.match(/(\S+ vant!|Delt seier!)/)?.[1]}`);

  // play again: the same players, and the last step of the set-up (how it works), which goes back to the points and the players
  await clickButton('Spill igjen');
  await waitText(/Klar\? Slik funker det/);
  assert.match(await bodyText(), new RegExp(`${PLAYERS} spillere`));
  await clickButton('Tilbake');
  await waitText(/Steg 3 av 4/);
  await clickButton('Tilbake');
  await waitText(/Hvem spiller\?/);
  assert.deepEqual(await rosterNames(), names, 'the same players after "Spill igjen"');
  await clickButton('Neste');
  await clickButton('Neste');
  await waitText(/Steg 4 av 4/);
  log('play again: the same players, back through the steps and on');

  // a second game, to the start of a round: the roles are new, and then the logo asks before it ends the game
  await clickButton('Start spillet');
  await waitText(/Send telefonen rundt/);
  await clickLabel('Til hjemskjermen');
  await waitText(/Tilbake til hjemskjermen\?/);
  assert.match(await bodyText(), /Spillet avsluttes, og stillingen går tapt\./);
  assert.doesNotMatch(await bodyText(), /en annen spiller blir vert|alle som er med/, 'there is nobody else to hand the game to or to tell');
  await clickButton('Bli i spillet');
  await page.waitForFunction(() => !document.querySelector('.sheet'));
  await waitText(/Send telefonen rundt/);
  await clickLabel('Til hjemskjermen');
  await waitText(/Tilbake til hjemskjermen\?/);
  await clickButton('Avslutt spillet');
  await waitText(/Diskuter,?\s+manipuler\s+og\s+vinn/);
  log('the logo asks first, and the game is over when the host says so');

  if (PLAYERS === 2) log(`two players: the rounds so far had ${outcomes.none} without an impostor, ${outcomes.first} with the first and ${outcomes.second} with the second`);
  if (P2P) {
    const net = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__net') ?? '{"sockets":[],"peers":0}'));
    assert.deepEqual(net, { sockets: [], peers: 0 }, `a game on one phone does not touch the network: no WebSocket, no WebRTC (${JSON.stringify(net)})`);
    log('no WebSocket and no WebRTC line was made: the whole game ran on the phone');
  }
  assert.deepEqual(problems, [], 'no page errors and nothing blocked by the Content-Security-Policy');
  log('\nCAR END-TO-END: OK');
} catch (err) {
  console.error(`\nCAR END-TO-END FAILED (${where}):`, err.message);
  if (err.name !== 'AssertionError') console.error(String(err.stack).split('\n').slice(1, 7).join('\n'));
  if (SHOTS) await page.screenshot({ path: 'tmp/car/FAIL.png' }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
  await Promise.race([site.stop(), sleep(4000)]);
  await stack?.stop();
  process.exit(process.exitCode ?? 0);
}
