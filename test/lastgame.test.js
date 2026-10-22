// The game a guest was in, remembered on the phone (public/js/lastgame.js), and the places that show how to get back into a game.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { LAST_MAX_AGE_MS, forgetLastGame, lastGame, rememberGame, worthRemembering } from '../public/js/lastgame.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
};
const SESSION = { code: 'KFTR', playerId: 'p1', token: 'tok' };

describe('the remembered game', () => {
  it('comes back with the code, the seat and the name', () => {
    const storage = memory();
    rememberGame(SESSION, 'Lone', 1000, storage);
    assert.deepEqual(lastGame(2000, storage), { ...SESSION, name: 'Lone', at: 1000 });
  });

  it('is gone after a few hours, when it is forgotten, or when it is damaged', () => {
    const storage = memory();
    rememberGame(SESSION, 'Lone', 1000, storage);
    assert.equal(lastGame(1000 + LAST_MAX_AGE_MS + 1, storage), null);
    forgetLastGame(storage);
    assert.equal(lastGame(2000, storage), null);
    storage.setItem('disputt:last', '{"code": "kftr"}');
    assert.equal(lastGame(2000, storage), null, 'a code that is not four capital letters');
    storage.setItem('disputt:last', 'not json');
    assert.equal(lastGame(2000, storage), null);
  });

  it('is only for a guest in a game of several phones', () => {
    assert.equal(worthRemembering({ you: { isHost: false }, mode: 'cabin' }), true);
    assert.equal(worthRemembering({ you: { isHost: true }, mode: 'cabin' }), false, 'the host\'s game is the host\'s own page');
    assert.equal(worthRemembering({ you: { isHost: false }, mode: 'car' }), false);
    assert.equal(worthRemembering(null), false);
  });
});

describe('the way back into a game', () => {
  it('is offered on the start screen, only with the peer-to-peer game, and it asks for the seat with the token', () => {
    const card = read('public/js/screens/rejoin.js');
    assert.match(card, /!isP2P/);
    assert.match(card, /saveSession\(session\)/);
    assert.match(card, /actions\.join\(last\.code\)/);
    assert.match(card, /Hopp inn igjen/);
    assert.match(read('public/js/screens/home.js'), /<\$\{RejoinCard\} \/>/);
  });

  it('is remembered by the app, which wipes it only when the identity goes away in the page itself', () => {
    assert.match(read('public/js/app.js'), /useRememberGame\(s\.session, view\)/);
    assert.match(read('public/js/lastgame.js'), /else if \(!session && had\.current\)/);
  });

  it('has the code of the game on the score sheet and in the host\'s options, so that nobody has to remember it', () => {
    const sheets = read('public/js/screens/sheets.js');
    assert.match(sheets, /function GameCode/);
    assert.equal((sheets.match(/<\$\{GameCode\} view=\$\{view\} \/>/g) ?? []).length, 2, 'in both sheets');
    assert.match(sheets, /Mister poengene\. Sikker\?/, 'and removing a player in the middle of a game says that the points go with them');
  });

  it('is not on the screen when a game is over: no rules link there', () => {
    assert.doesNotMatch(read('public/js/screens/finale.js'), /Slik spiller dere/);
  });

  it('keeps browsers from translating the page (a translated page doubles the names and the points)', () => {
    const page = read('public/index.html');
    assert.match(page, /<html lang="nb" translate="no">/);
    assert.match(page, /<meta name="google" content="notranslate">/);
  });
});
