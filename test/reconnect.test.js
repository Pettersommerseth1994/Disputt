// «Mistet forbindelsen» (screens/reconnect.js, screens/lostline.js): when the card comes up, and what the button does.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { OFFER_AFTER_MS, RELOAD_AFTER_MS, lostLine } from '../public/js/screens/lostline.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const game = { view: { phase: 'question' }, session: { code: 'ABCD' }, conn: 'closed', everOpened: true };

test('the card is for a phone in a game that has lost its line', () => {
  assert.equal(lostLine(game), true);
  assert.equal(lostLine({ ...game, view: null }), true, 'also while the game is being found again after a reload');
  assert.equal(lostLine({ ...game, conn: 'connecting' }), true);
  assert.equal(lostLine({ ...game, conn: 'open' }), false);
});

test('and for nothing else: no game, a game opened elsewhere, a host who was making a game, a host who is away to pay', () => {
  assert.equal(lostLine({ conn: 'closed', view: null, session: null }), false, 'the start screen');
  assert.equal(lostLine({ ...game, replaced: true }), false);
  assert.equal(lostLine({ ...game, creating: true }), false);
  assert.equal(lostLine({ ...game, hostAwayUntil: 1_000_000 + 60_000 }, 1_000_000), false, 'the host said it is paying and will be back');
  assert.equal(lostLine({ ...game, hostAwayUntil: 1_000_000 - 1 }, 1_000_000), true, 'but not for ever');
});

test('a blink that mends itself does not bring the card up, and the page is loaded again only after a try', () => {
  assert.ok(OFFER_AFTER_MS >= 2000 && OFFER_AFTER_MS <= 5000);
  assert.ok(RELOAD_AFTER_MS > 5000, 'the new line gets time to come up before the page is thrown away');
});

test('the button asks for a new line from nothing, and the page loads it again if there is still none', () => {
  const src = read('public/js/screens/reconnect.js');
  assert.match(src, /reconnectNow\(\{ force: true \}\)/);
  assert.match(src, /location\.reload\(\)\), RELOAD_AFTER_MS\)/);
  assert.match(read('public/js/app.js'), /<\$\{ReconnectModal\} \/>/, 'the app draws it');
  assert.match(read('public/js/net.js'), /export function reconnectNow\(\{ force = false \} = \{\}\)/);
});

test('the line that comes back by itself (online, a page that is shown again) is not forced', () => {
  const main = read('public/js/main.js');
  assert.match(main, /window\.addEventListener\('online', reconnectNow\)/);
  assert.doesNotMatch(main, /force: true/);
});

test('the host has the button on the reveal, and the others are told that the host presses it', () => {
  assert.match(read('public/js/app.js'), /view\.you\.isHost \? html`<\$\{RevealAsker\}/);
  const round = read('public/js/screens/round.js');
  assert.match(round, /Verten trykker videre når det er sagt\./);
  assert.doesNotMatch(round, /er borte, gå videre/);
});

test('the host gets the card too when its own phone has lost the line to the introduction service, though the game itself runs on', () => {
  const host = { ...game, conn: 'open', view: { phase: 'question', you: { isHost: true } } };
  assert.equal(lostLine(host), false, 'a line that is fine');
  assert.equal(lostLine({ ...host, hostOffline: true }), true);
  assert.equal(lostLine({ ...host, hostOffline: true, replaced: true }), false);
  const net = read('public/js/net.js');
  assert.match(net, /const hostSignal = \(up\) => setStore\(\{ hostOffline: !up \}\)/);
  assert.match(net, /startHost\(\{ onSignal: hostSignal \}\)/);
  assert.match(net, /startHost\(\{ restore: snapshot, onSignal: hostSignal \}\)/);
  assert.match(read('public/js/p2p/host.js'), /onSignal\?\.\(up\)/);
  assert.match(read('public/js/screens/reconnect.js'), /lineOnly \? setTrying\(false\) : location\.reload\(\)/, 'a host that only lost the introduction service does not load the page again');
});
