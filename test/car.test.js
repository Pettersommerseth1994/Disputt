// The two ways to play the same game: a phone each (the cabin, "hytteturmodus") or ONE phone for everybody (the car, "bilturmodus"),
// and the rule for two players. The engine's own rules (shared/game.js), then the same through the hub's messages, which is what the
// host's page sends.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AVATAR_IDS } from '../shared/avatars.mjs';
import { DEFAULT_TIMINGS, GameError, LIMITS, MODE, PHASE, Room } from '../shared/game.js';
import { Hub } from '../shared/hub.js';
import { LETTERS, QUESTIONS } from '../shared/questions.js';

// ------------------------------------------------------------------ helpers

const seeded = (seed = 1) => {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (n) => Math.floor(next() * n) };
};
/** Randomness that answers with what it is told first (a queue), and then with zeros. */
const scripted = (...queue) => ({ int: (n) => (queue.length ? queue.shift() % n : 0) });

const fakeClock = (start = 1_000_000) => {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
};

/** A room of n players. In the car the host's phone is connected and the others are put in by the host; in the cabin each has a phone. */
function table(n, { mode = MODE.CAR, rand = seeded(1), ...opts } = {}) {
  const clock = fakeClock();
  const room = new Room({ code: 'TEST', now: clock.now, rand, mode, ...opts });
  const host = room.addPlayer({ asHost: true });
  room.setProfile(host.id, { name: 'Vert', avatar: AVATAR_IDS[0] });
  room.connect(host.id);
  const players = [host];
  for (let i = 1; i < n; i++) {
    if (mode === MODE.CAR) players.push(room.addLocalPlayer(host.id, { name: `Spiller${i}`, avatar: AVATAR_IDS[i] }));
    else {
      const p = room.addPlayer();
      room.setProfile(p.id, { name: `Spiller${i}`, avatar: AVATAR_IDS[i] });
      room.connect(p.id);
      players.push(p);
    }
  }
  return { room, clock, players, host };
}
const car = (n, opts) => table(n, { ...opts, mode: MODE.CAR });
const cabin = (n, opts) => table(n, { ...opts, mode: MODE.CABIN });

const throwsCode = (fn, code) => assert.throws(fn, (e) => e instanceof GameError && e.code === code, `expected GameError ${code}`);
const byId = (room, id) => room.players.get(id);
const score = (ctx, i) => ctx.room.players.get(ctx.players[i].id).score;

/** The car: everybody sees their role, one after the other, and the host asks the question. */
function toQuestion(ctx) {
  ctx.room.start(ctx.host.id);
  for (const p of ctx.players) ctx.room.roleSeen(ctx.host.id, p.id);
  ctx.room.startQuestion(ctx.host.id);
  return ctx.room.current;
}
/** The host locks an answer, the countdown runs out, and the host moves on to the points. */
function lockAndShow(ctx, index) {
  ctx.room.lock(ctx.host.id, index);
  ctx.clock.advance(DEFAULT_TIMINGS.countdownMs + 1);
  ctx.room.tick(ctx.clock.now());
  ctx.room.continueRound(ctx.host.id);
}
const right = (ctx) => ctx.room.current.question.correct;
const wrong = (ctx) => (right(ctx) + 1) % 4;

// ------------------------------------------------------------------ two players

describe('a round with two players', () => {
  it('may have no impostor, so that the loyal one cannot always know who the other is: one of three, as likely as each other', () => {
    for (const [pick, expected] of [[0, []], [1, [0]], [2, [1]]]) {
      const ctx = cabin(2, { rand: scripted(pick, 0) }); // (the outcome, then who asks)
      ctx.room.start(ctx.host.id);
      assert.deepEqual(ctx.room.current.impostorIds, expected.map((i) => ctx.players[i].id), `outcome ${pick}`);
    }
  });

  it('really is one of three over many rounds', () => {
    const ctx = cabin(2, { rand: seeded(7) });
    ctx.room.start(ctx.host.id);
    const seen = { none: 0, first: 0, second: 0 };
    for (let i = 0; i < 900; i++) {
      const ids = ctx.room.current.impostorIds;
      if (ids.length === 0) seen.none++;
      else if (ids[0] === ctx.players[0].id) seen.first++;
      else seen.second++;
      ctx.room.skipRound(ctx.host.id);
      ctx.room.nextRound(ctx.host.id);
    }
    for (const [kind, n] of Object.entries(seen)) assert.ok(n > 240 && n < 360, `${kind}: ${n} of 900`);
  });

  it('is told to both of them as one impostor, so that the phones do not give away that there is none', () => {
    const ctx = cabin(2, { rand: scripted(0, 0) }); // nobody is the impostor
    ctx.room.start(ctx.host.id);
    assert.equal(ctx.room.current.impostorIds.length, 0);
    for (const p of ctx.players) {
      const view = ctx.room.viewFor(p.id);
      assert.equal(view.turn.impostors, 1);
      assert.equal(view.you.role, 'loyal');
      assert.ok(!('secret' in view.you));
    }
  });

  it('gives both a point for the right answer when nobody was the impostor, and nobody a point for a wrong one', () => {
    const right2 = cabin(2, { rand: scripted(0, 0) });
    right2.room.start(right2.host.id);
    right2.clock.advance(DEFAULT_TIMINGS.roleMs);
    right2.room.tick(right2.clock.now());
    right2.room.lock(right2.host.id, right2.room.current.question.correct);
    right2.clock.advance(DEFAULT_TIMINGS.countdownMs + 1);
    right2.room.tick(right2.clock.now());
    right2.room.continueRound(right2.host.id);
    assert.deepEqual([score(right2, 0), score(right2, 1)], [1, 1]);
    const summary = right2.room.viewFor(right2.host.id).summary;
    assert.equal(summary.noImpostor, true);
    assert.deepEqual(summary.impostorIds, []);
    assert.equal(summary.impostor, null);

    const wrong2 = cabin(2, { rand: scripted(0, 0) });
    wrong2.room.start(wrong2.host.id);
    wrong2.clock.advance(DEFAULT_TIMINGS.roleMs);
    wrong2.room.tick(wrong2.clock.now());
    wrong2.room.lock(wrong2.host.id, (wrong2.room.current.question.correct + 1) % 4);
    wrong2.clock.advance(DEFAULT_TIMINGS.countdownMs + 1);
    wrong2.room.tick(wrong2.clock.now());
    wrong2.room.continueRound(wrong2.host.id);
    assert.deepEqual([score(wrong2, 0), score(wrong2, 1)], [0, 0]);
  });

  it('scores as always when one of the two is the impostor', () => {
    const ctx = cabin(2, { rand: scripted(2, 0) }); // the second is the impostor, and the host asks
    ctx.room.start(ctx.host.id);
    ctx.clock.advance(DEFAULT_TIMINGS.roleMs);
    ctx.room.tick(ctx.clock.now());
    ctx.room.lock(ctx.host.id, (ctx.room.current.question.correct + 1) % 4); // fooled
    ctx.clock.advance(DEFAULT_TIMINGS.countdownMs + 1);
    ctx.room.tick(ctx.clock.now());
    ctx.room.continueRound(ctx.host.id);
    assert.deepEqual([score(ctx, 0), score(ctx, 1)], [0, 1]);
    assert.equal(ctx.room.viewFor(ctx.host.id).summary.noImpostor, false);
  });

  it('is only for two: three players always have an impostor, and the randomness is used as it always was', () => {
    const ctx = cabin(3, { rand: scripted(1, 2) }); // impostor #1, asker #2
    ctx.room.start(ctx.host.id);
    assert.deepEqual(ctx.room.current.impostorIds, [ctx.players[1].id]);
    assert.equal(ctx.room.current.askerId, ctx.players[2].id);
    for (let seed = 1; seed < 40; seed++) {
      const c = cabin(3 + (seed % 8), { rand: seeded(seed) });
      c.room.start(c.host.id);
      assert.ok(c.room.current.impostorIds.length >= 1);
    }
  });

  it('can be played by two: the least a game needs is two players, in both ways', () => {
    assert.equal(LIMITS.minPlayers, 2);
    const one = cabin(1);
    throwsCode(() => one.room.start(one.host.id), 'need_players');
    const oneCar = car(1);
    throwsCode(() => oneCar.room.start(oneCar.host.id), 'need_players');
    assert.equal(cabin(2).room.viewFor('x').limits.min, 2);
  });
});

// ------------------------------------------------------------------ the car: one phone

describe('the car: a room', () => {
  it('is the cabin unless it is asked to be the car, and a game saved before there were two ways is the cabin', () => {
    assert.equal(new Room({ code: 'A' }).mode, MODE.CABIN);
    assert.equal(new Room({ code: 'A', mode: 'noe annet' }).mode, MODE.CABIN);
    assert.equal(new Room({ code: 'A', mode: MODE.CAR }).mode, MODE.CAR);
    const saved = cabin(3).room.toJSON();
    delete saved.mode;
    assert.equal(Room.fromJSON(saved).mode, MODE.CABIN);
  });

  it('cannot be joined from another phone: it is played on one', () => {
    const { room } = car(2);
    throwsCode(() => room.addPlayer(), 'single_phone');
  });

  it('puts the players in on the host\'s phone, up to ten, and they are always there', () => {
    const ctx = car(10);
    assert.equal(ctx.room.players.size, 10);
    for (const p of ctx.players.slice(1)) assert.deepEqual([p.local, p.connected], [true, true]);
    const view = ctx.room.viewFor(ctx.host.id);
    assert.equal(view.mode, 'car');
    assert.equal(view.players.length, 10);
    assert.ok(view.players.every((p) => p.connected), 'nobody shows as disconnected');
    // ('too_many', not 'full': to a page, 'full' means that a room has no seat for another phone, and it leaves the game)
    throwsCode(() => ctx.room.addLocalPlayer(ctx.host.id, { name: 'Ellevte', avatar: AVATAR_IDS[0] }), 'too_many');
    assert.equal(ctx.room.players.size, 10, 'and nobody was put in');
  });

  it('needs a name and an avatar that are not taken, and a refused player leaves nothing behind', () => {
    const ctx = car(2);
    throwsCode(() => ctx.room.addLocalPlayer(ctx.host.id, { name: 'vert', avatar: AVATAR_IDS[3] }), 'name_taken');
    throwsCode(() => ctx.room.addLocalPlayer(ctx.host.id, { name: 'Ny', avatar: AVATAR_IDS[0] }), 'avatar_taken');
    throwsCode(() => ctx.room.addLocalPlayer(ctx.host.id, { name: '   ', avatar: AVATAR_IDS[3] }), 'bad_name');
    throwsCode(() => ctx.room.addLocalPlayer(ctx.host.id, { name: 'Ny', avatar: 'finnes-ikke' }), 'bad_avatar');
    assert.equal(ctx.room.players.size, 2);
  });

  it('can only be put in by the host, in the lobby, and in the car', () => {
    const ctx = car(2);
    throwsCode(() => ctx.room.addLocalPlayer(ctx.players[1].id, { name: 'Ny', avatar: AVATAR_IDS[3] }), 'not_host');
    ctx.room.start(ctx.host.id);
    throwsCode(() => ctx.room.addLocalPlayer(ctx.host.id, { name: 'Ny', avatar: AVATAR_IDS[3] }), 'bad_phase');
    const other = cabin(2);
    throwsCode(() => other.room.addLocalPlayer(other.host.id, { name: 'Ny', avatar: AVATAR_IDS[3] }), 'bad_mode');
  });

  it('can be changed and removed by the host in the lobby, and not mid-game', () => {
    const ctx = car(4);
    const [, a, b] = ctx.players;
    ctx.room.setProfile(ctx.host.id, { name: 'Kari', avatar: AVATAR_IDS[6] }, a.id);
    assert.equal(ctx.room.players.get(a.id).name, 'Kari');
    throwsCode(() => ctx.room.setProfile(a.id, { name: 'Lur', avatar: AVATAR_IDS[7] }, b.id), 'not_host');
    ctx.room.kick(ctx.host.id, b.id);
    assert.equal(ctx.room.players.has(b.id), false);
    // a player who is gone is told so with 'bad_value', never with the 'bad_token' that makes a page leave the game
    throwsCode(() => ctx.room.setProfile(ctx.host.id, { name: 'Sen', avatar: AVATAR_IDS[8] }, b.id), 'bad_value');
    throwsCode(() => ctx.room.setProfile(ctx.host.id, { name: 'Sen', avatar: AVATAR_IDS[8] }, 'ukjent'), 'bad_value');
    ctx.room.start(ctx.host.id);
    throwsCode(() => ctx.room.kick(ctx.host.id, a.id), 'bad_phase');
    assert.equal(ctx.room.players.has(a.id), true, 'and nobody was removed');
  });

  it('stays the host\'s for as long as it takes: nobody else has a phone to take over with', () => {
    const ctx = car(3);
    ctx.room.start(ctx.host.id);
    ctx.room.disconnect(ctx.host.id); // the phone locks
    assert.equal(ctx.room.empty, true, 'the room counts only phones');
    ctx.clock.advance(DEFAULT_TIMINGS.hostGraceMs * 4);
    ctx.room.tick(ctx.clock.now());
    assert.equal(ctx.room.hostId, ctx.host.id);
    assert.ok(ctx.room.viewFor(ctx.host.id).players.every((p) => p.connected));
    ctx.room.connect(ctx.host.id);
    assert.equal(ctx.room.empty, false);
  });
});

describe('the car: a round', () => {
  it('starts with the phone going round: no timer, every role on the host\'s phone, and nobody has seen theirs', () => {
    const ctx = car(3, { rand: scripted(1, 5) });
    ctx.room.start(ctx.host.id);
    assert.equal(ctx.room.phase, PHASE.ROLE);
    assert.equal(ctx.room.current.roleEndsAt, null);
    ctx.clock.advance(60 * 60_000);
    assert.equal(ctx.room.tick(ctx.clock.now()), false, 'time does not move it on');
    assert.equal(ctx.room.phase, PHASE.ROLE);
    const view = ctx.room.viewFor(ctx.host.id);
    assert.ok(!('roleEndsAt' in view));
    assert.deepEqual(view.seen, []);
    assert.deepEqual(view.table.map((r) => r.id), ctx.players.map((p) => p.id), 'in the order they were put in, the host first');
    assert.deepEqual(view.table.map((r) => r.role), ['loyal', 'impostor', 'loyal']);
    const impostor = view.table.find((r) => r.role === 'impostor');
    assert.deepEqual(impostor.secret, { index: ctx.room.current.question.correct, letter: LETTERS[ctx.room.current.question.correct], text: ctx.room.current.question.options[ctx.room.current.question.correct] });
    assert.ok(view.table.filter((r) => r.role === 'loyal').every((r) => !('secret' in r)));
  });

  it('has the host as the one who asks, every round', () => {
    for (let seed = 1; seed < 12; seed++) {
      const ctx = car(2 + (seed % 5), { rand: seeded(seed) });
      ctx.room.start(ctx.host.id);
      assert.equal(ctx.room.current.askerId, ctx.host.id);
    }
  });

  it('goes on to the question when everybody has seen their role, and not before', () => {
    const ctx = car(3);
    ctx.room.start(ctx.host.id);
    throwsCode(() => ctx.room.startQuestion(ctx.host.id), 'not_all');
    ctx.room.roleSeen(ctx.host.id, ctx.players[0].id);
    ctx.room.roleSeen(ctx.host.id, ctx.players[1].id);
    ctx.room.roleSeen(ctx.host.id, ctx.players[1].id); // (twice is once)
    assert.deepEqual(ctx.room.viewFor(ctx.host.id).seen, [ctx.players[0].id, ctx.players[1].id]);
    throwsCode(() => ctx.room.startQuestion(ctx.host.id), 'not_all');
    ctx.room.roleSeen(ctx.host.id, ctx.players[2].id);
    ctx.room.startQuestion(ctx.host.id);
    assert.equal(ctx.room.phase, PHASE.QUESTION);
    assert.equal(ctx.room.current.discussionEndsAt, ctx.clock.now() + DEFAULT_TIMINGS.discussionMs);
    const view = ctx.room.viewFor(ctx.host.id);
    assert.equal(view.question.options.length, 4, 'the host has the question');
    assert.ok(!('seen' in view));
    assert.equal(view.table.length, 3, 'and can look the roles up again');
  });

  it('refuses the phone-goes-round messages to others, to unknown players, outside the role round and in the cabin', () => {
    const ctx = car(3);
    ctx.room.start(ctx.host.id);
    throwsCode(() => ctx.room.roleSeen(ctx.players[1].id, ctx.players[1].id), 'not_host');
    throwsCode(() => ctx.room.roleSeen(ctx.host.id, 'ukjent'), 'bad_value');
    toQuestion(car(2)); // (a whole role round works)
    const later = car(2);
    toQuestion(later);
    throwsCode(() => later.room.roleSeen(later.host.id, later.players[1].id), 'bad_phase');
    throwsCode(() => later.room.startQuestion(later.host.id), 'bad_phase');
    const other = cabin(3);
    other.room.start(other.host.id);
    throwsCode(() => other.room.roleSeen(other.host.id, other.players[1].id), 'bad_mode');
    throwsCode(() => other.room.startQuestion(other.host.id), 'bad_mode');
  });

  it('plays the rest as the game always was: the host locks, the countdown, the points, the next round with new roles', () => {
    const ctx = car(3, { rand: scripted(1, 5) });
    toQuestion(ctx);
    ctx.room.select(ctx.host.id, right(ctx));
    ctx.room.setTimer(ctx.host.id, 120);
    lockAndShow(ctx, right(ctx));
    assert.equal(ctx.room.phase, PHASE.SUMMARY);
    assert.deepEqual([score(ctx, 0), score(ctx, 1), score(ctx, 2)], [1, 0, 1], 'the loyal ones are right');
    assert.equal(ctx.room.viewFor(ctx.host.id).table, undefined, 'the points have no roles on them');
    ctx.room.nextRound(ctx.host.id);
    assert.equal(ctx.room.phase, PHASE.ROLE);
    assert.equal(ctx.room.round, 2);
    assert.deepEqual(ctx.room.viewFor(ctx.host.id).seen, [], 'nobody has seen the new roles');
  });

  it('gives the impostor the point when the group is fooled', () => {
    const ctx = car(3, { rand: scripted(2, 5) });
    toQuestion(ctx);
    lockAndShow(ctx, wrong(ctx));
    assert.deepEqual([score(ctx, 0), score(ctx, 1), score(ctx, 2)], [0, 0, 1]);
  });

  it('works when the host\'s phone locked itself between two rounds (it is still everybody\'s phone)', () => {
    const ctx = car(3);
    toQuestion(ctx);
    lockAndShow(ctx, right(ctx));
    ctx.room.disconnect(ctx.host.id);
    ctx.room.nextRound(ctx.host.id);
    assert.equal(ctx.room.phase, PHASE.ROLE);
    assert.equal(ctx.room.current.participants.length, 3, 'the host is in the round too');
  });

  it('can be skipped, ended and played again with the same players', () => {
    const ctx = car(3);
    ctx.room.start(ctx.host.id);
    ctx.room.skipRound(ctx.host.id);
    assert.equal(ctx.room.phase, PHASE.SUMMARY);
    ctx.room.endGame(ctx.host.id);
    assert.equal(ctx.room.phase, PHASE.FINISHED);
    ctx.room.playAgain(ctx.host.id);
    assert.equal(ctx.room.phase, PHASE.LOBBY);
    assert.equal(ctx.room.players.size, 3);
    assert.equal(ctx.room.mode, MODE.CAR);
  });

  it('is saved and brought back with everything: the mode, the players on it, who has seen their role', () => {
    const ctx = car(3);
    ctx.room.start(ctx.host.id);
    ctx.room.roleSeen(ctx.host.id, ctx.players[0].id);
    const saved = JSON.parse(JSON.stringify(ctx.room));
    const back = Room.fromJSON(saved, { now: ctx.clock.now });
    assert.equal(back.mode, MODE.CAR);
    assert.deepEqual([...back.players.values()].map((p) => [p.name, p.local ?? false, p.connected]), [['Vert', false, false], ['Spiller1', true, true], ['Spiller2', true, true]]);
    assert.deepEqual(back.viewFor(ctx.host.id).seen, [ctx.players[0].id]);
    back.connect(ctx.host.id);
    for (const p of ctx.players.slice(1)) back.roleSeen(ctx.host.id, p.id);
    back.startQuestion(ctx.host.id);
    assert.equal(back.phase, PHASE.QUESTION);
  });
});

// ------------------------------------------------------------------ through the hub

describe('the car: through the hub', () => {
  const fakeSocket = () => ({ readyState: 1, sent: [], send(m) { this.sent.push(JSON.parse(m)); }, close() {} });
  const last = (ws, type) => ws.sent.filter((m) => m.t === type).at(-1);

  function hosted(mode = 'car', opts = {}) {
    const hub = new Hub({ rand: seeded(3), ...opts });
    const ws = fakeSocket();
    const conn = { ws, code: null, playerId: null };
    hub.handle(conn, { t: 'create', mode });
    const send = (msg) => hub.handle(conn, msg);
    return { hub, ws, conn, send, view: () => (last(ws, 'state') ?? last(ws, 'welcome')).view };
  }

  it('opens a car room when it is asked to, and a cabin otherwise (also for a client from before there were two ways)', () => {
    assert.equal(hosted('car').view().mode, 'car');
    assert.equal(hosted('cabin').view().mode, 'cabin');
    assert.equal(hosted('noe annet').view().mode, 'cabin');
    const ws = fakeSocket();
    new Hub().handle({ ws, code: null, playerId: null }, { t: 'create' });
    assert.equal(last(ws, 'welcome').view.mode, 'cabin');
  });

  it('plays a whole round by messages: players put in, the phone goes round, the question, the points', () => {
    const h = hosted();
    h.send({ t: 'profile', name: 'Fredrik', avatar: AVATAR_IDS[0] });
    h.send({ t: 'player.add', name: 'Bjarne', avatar: AVATAR_IDS[1] });
    h.send({ t: 'player.add', name: 'Siri', avatar: AVATAR_IDS[2] });
    const siri = h.view().players[2];
    h.send({ t: 'profile', id: siri.id, name: 'Siri S', avatar: AVATAR_IDS[2] });
    assert.deepEqual(h.view().players.map((p) => p.name), ['Fredrik', 'Bjarne', 'Siri S']);
    h.send({ t: 'target', value: 1 });
    h.send({ t: 'start' });
    assert.equal(h.view().phase, 'role');
    h.send({ t: 'begin' });
    assert.equal(last(h.ws, 'error').code, 'not_all', 'nobody has seen a role yet');
    const ids = h.view().players.map((p) => p.id);
    for (const id of ids) h.send({ t: 'seen', id });
    assert.deepEqual(h.view().seen, ids);
    h.send({ t: 'begin' });
    assert.equal(h.view().phase, 'question');
    const q = QUESTIONS.find((x) => x.text === h.view().question.text);
    h.send({ t: 'lock', index: q.correct });
    assert.equal(h.view().phase, 'locked');
  });

  it('says what is wrong: a join to a car, the car\'s things in a cabin, and a stranger', () => {
    const cab = hosted('cabin');
    cab.send({ t: 'profile', name: 'Vert', avatar: AVATAR_IDS[0] });
    cab.send({ t: 'player.add', name: 'Ola', avatar: AVATAR_IDS[1] });
    assert.equal(last(cab.ws, 'error').code, 'bad_mode');
    const h = hosted();
    const stranger = { ws: fakeSocket(), code: null, playerId: null };
    h.hub.handle(stranger, { t: 'join', code: h.view().code });
    assert.equal(last(stranger.ws, 'error').code, 'single_phone');
    for (const msg of [{ t: 'seen', id: 'x' }, { t: 'begin' }, { t: 'player.add', name: 'Lur', avatar: AVATAR_IDS[4] }, { t: 'profile', id: 'ukjent', name: 'Lur', avatar: AVATAR_IDS[4] }]) {
      h.hub.handle(stranger, msg);
      assert.equal(last(stranger.ws, 'error').code, 'no_session', JSON.stringify(msg));
    }
  });

  it('keeps a room on one phone for as long as any room is kept, though the phone has let go of its connection', () => {
    const clock = fakeClock();
    const hub = new Hub({ rand: seeded(3), now: clock.now });
    const connect = () => {
      const conn = { ws: fakeSocket(), code: null, playerId: null };
      return { conn, send: (msg) => hub.handle(conn, msg) };
    };
    const one = connect();
    one.send({ t: 'create', mode: 'car' });
    one.send({ t: 'profile', name: 'Vert', avatar: AVATAR_IDS[0] });
    one.send({ t: 'player.add', name: 'Ola', avatar: AVATAR_IDS[1] });
    const codeOne = last(one.conn.ws, 'welcome').code;
    const host = connect();
    host.send({ t: 'create' });
    host.send({ t: 'profile', name: 'Vert', avatar: AVATAR_IDS[0] });
    const codeTwo = last(host.conn.ws, 'welcome').code;
    const guest = connect();
    guest.send({ t: 'join', code: codeTwo });
    guest.send({ t: 'profile', name: 'Mari', avatar: AVATAR_IDS[1] });
    for (const c of [one, host, guest]) hub.close(c.conn);
    clock.advance(31 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.has(codeTwo), false, 'a game of phones is given up after half an hour with nobody connected');
    assert.equal(hub.rooms.has(codeOne), true, 'a game on one phone is not: the phone comes back to it');
    clock.advance(6 * 60 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.has(codeOne), false, 'but not for ever');
  });

  it('is gone when its host leaves it in the lobby (the phone was all there was), and a phone-each room is not', () => {
    const h = hosted();
    h.send({ t: 'profile', name: 'Vert', avatar: AVATAR_IDS[0] });
    h.send({ t: 'player.add', name: 'Ola', avatar: AVATAR_IDS[1] });
    const code = h.view().code;
    assert.equal(h.hub.rooms.has(code), true);
    h.send({ t: 'leave' });
    assert.equal(last(h.ws, 'removed').reason, 'left');
    assert.equal(h.hub.rooms.has(code), false);

    const cab = hosted('cabin');
    cab.send({ t: 'profile', name: 'Vert', avatar: AVATAR_IDS[0] });
    const cabCode = cab.view().code;
    cab.send({ t: 'leave' });
    assert.equal(cab.hub.rooms.has(cabCode), true, 'it waits for its sweep, as it always did');
  });

  it('can be left in the middle of a round too (the host ends it: there is nobody to hand it to), and a cabin cannot', () => {
    const h = hosted();
    h.send({ t: 'profile', name: 'Vert', avatar: AVATAR_IDS[0] });
    h.send({ t: 'player.add', name: 'Ola', avatar: AVATAR_IDS[1] });
    h.send({ t: 'start' });
    assert.equal(h.view().phase, 'role');
    const code = h.view().code;
    h.send({ t: 'leave' });
    assert.equal(last(h.ws, 'removed').reason, 'left');
    assert.equal(h.hub.rooms.has(code), false);

    const cab = hosted('cabin');
    cab.send({ t: 'profile', name: 'Vert', avatar: AVATAR_IDS[0] });
    const guest = { ws: fakeSocket(), code: null, playerId: null };
    cab.hub.handle(guest, { t: 'join', code: cab.view().code });
    cab.hub.handle(guest, { t: 'profile', name: 'Mari', avatar: AVATAR_IDS[1] });
    cab.send({ t: 'start' });
    assert.equal(cab.view().phase, 'role');
    cab.send({ t: 'leave' }); // (a round is on: the phone that leaves is told its screen is out of date, and stays)
    assert.equal(cab.view().phase, 'role');
    assert.equal(cab.hub.rooms.has(cab.view().code), true);
  });

  it('can be made with a code of the host\'s own choice (the page picks it, no network is asked)', () => {
    const hub = new Hub();
    const ws = fakeSocket();
    hub.createWithCode({ ws, code: null, playerId: null }, 'QXZK', 'car');
    const welcome = last(ws, 'welcome');
    assert.equal(welcome.code, 'QXZK');
    assert.equal(welcome.view.mode, 'car');
  });
});
