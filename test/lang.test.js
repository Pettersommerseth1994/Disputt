// The language of a game: the host's language when the game is made decides the question bank (shared/banks.js), and it is kept with the game.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Room } from '../shared/game.js';
import { LANGUAGES, bankFor, normalizeLanguage } from '../shared/banks.js';
import { Hub } from '../shared/hub.js';
import { QUESTIONS } from '../shared/questions.js';
import { QUESTIONS_DA } from '../shared/questions-da.js';
import { QUESTIONS_SV } from '../shared/questions-sv.js';

const fakeSocket = () => ({ readyState: 1, sent: [], send(m) { this.sent.push(JSON.parse(m)); }, close() {} });

describe('the language of a game', () => {
  it('is Norwegian when nothing is said, and when it is something we do not have', () => {
    assert.deepEqual(LANGUAGES, ['no', 'da', 'sv']);
    for (const odd of [undefined, null, '', 'en', 'nb', 'DA', 42, {}]) assert.equal(normalizeLanguage(odd), 'no');
    assert.equal(bankFor(undefined), QUESTIONS);
    assert.equal(bankFor('da'), QUESTIONS_DA);
    assert.equal(bankFor('sv'), QUESTIONS_SV);
  });

  it('gives a room the bank of its language, and keeps the language when the room is saved and opened again', () => {
    for (const [lang, bank] of [['no', QUESTIONS], ['da', QUESTIONS_DA], ['sv', QUESTIONS_SV]]) {
      const room = new Room({ code: 'ABCD', lang });
      assert.equal(room.lang, lang);
      assert.equal(room.questions, bank);
      const back = Room.fromJSON(JSON.parse(JSON.stringify(room)));
      assert.equal(back.lang, lang);
      assert.equal(back.questions, bank);
    }
    // a game saved before there were languages is a Norwegian one
    const old = JSON.parse(JSON.stringify(new Room({ code: 'ABCD' })));
    delete old.lang;
    assert.equal(Room.fromJSON(old).lang, 'no');
  });

  it('is asked for when the game is made (server and p2p host alike)', () => {
    const hub = new Hub();
    for (const [i, lang] of ['da', 'sv', undefined].entries()) {
      const conn = { ws: fakeSocket(), code: null, playerId: null };
      hub.handle(conn, { t: 'create', mode: i === 1 ? 'car' : 'cabin', lang });
      assert.equal(hub.rooms.get(conn.code).room.lang, lang ?? 'no');
    }
    const conn = { ws: fakeSocket(), code: null, playerId: null };
    hub.createWithCode(conn, 'ZZZZ', 'cabin', 'sv');
    assert.equal(hub.rooms.get('ZZZZ').room.lang, 'sv');
    assert.equal(hub.rooms.get('ZZZZ').room.questions, QUESTIONS_SV);
  });

  it('asks questions from its own bank, and the Danish and Swedish banks are not the Norwegian one with other words', () => {
    for (const [bank, name] of [[QUESTIONS_DA, 'Danish'], [QUESTIONS_SV, 'Swedish']]) {
      const ids = new Set(bank.map((q) => q.id));
      const norwegianOnly = QUESTIONS.filter((q) => !ids.has(q.id));
      assert.ok(norwegianOnly.length >= 25, `${name}: the questions about Norway are exchanged (${norwegianOnly.length})`);
      const text = bank.map((q) => q.text).join('\n');
      for (const word of ['Stortinget', 'Vinmonopolet', 'Vipps', 'Gardermoen', 'Ekofisk']) assert.ok(!text.includes(word), `${name} bank still asks about ${word}`);
    }
  });
});
