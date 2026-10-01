import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AVATAR_IDS } from '../shared/avatars.mjs';
import { DEFAULT_TIMINGS, GameError, LIMITS, PHASE, Room } from '../server/game.js';
import { QUESTIONS } from '../server/questions.js';

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

const fakeClock = (start = 1_000_000) => {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
};

function lobby(n = 4, { seed = 1, ...opts } = {}) {
  const clock = fakeClock();
  const room = new Room({ code: 'TEST', now: clock.now, rand: seeded(seed), ...opts });
  const players = [];
  for (let i = 0; i < n; i++) {
    const p = room.addPlayer({ asHost: i === 0 });
    room.setProfile(p.id, { name: i === 0 ? 'Vert' : `Spiller${i}`, avatar: AVATAR_IDS[i] });
    room.connect(p.id);
    players.push(p);
  }
  return { room, clock, players, host: players[0] };
}

const byId = (room, id) => room.players.get(id);
const throwsCode = (fn, code) => assert.throws(fn, (e) => e instanceof GameError && e.code === code, `expected GameError ${code}`);

/** Start a game and fast-forward to the discussion phase. */
function toQuestion(ctx) {
  ctx.room.start(ctx.host.id);
  ctx.clock.advance(DEFAULT_TIMINGS.roleMs);
  ctx.room.tick(ctx.clock.now());
  const cur = ctx.room.current;
  return { cur, impostor: byId(ctx.room, cur.impostorId), asker: byId(ctx.room, cur.askerId), q: cur.question };
}

/** Plays one round to the summary. `groupRight` decides the asker's answer. */
function playRound(ctx, { groupRight }) {
  const { room, clock } = ctx;
  const { cur, asker, q } = toQuestion(ctx);
  const pick = groupRight ? q.correct : (q.correct + 1) % 4;
  room.lock(asker.id, pick);
  clock.advance(DEFAULT_TIMINGS.countdownMs);
  room.tick(clock.now());
  room.continueRound(asker.id);
  return cur;
}

/** Starts games with different seeds until the first round satisfies `wanted` (e.g. "the asker is not the host"). */
function roundWhere(players, wanted, target = 50) {
  for (let seed = 1; seed < 300; seed++) {
    const ctx = lobby(players, { seed });
    ctx.room.setTarget(ctx.host.id, target);
    ctx.room.start(ctx.host.id);
    if (wanted(ctx.room.current, ctx)) return ctx;
  }
  throw new Error('no seed produced a round matching the condition');
}

const finishRound = (ctx, groupRight) => {
  const { room, clock } = ctx;
  const cur = room.current;
  const q = cur.question;
  room.lock(cur.askerId, groupRight ? q.correct : (q.correct + 1) % 4);
  clock.advance(DEFAULT_TIMINGS.countdownMs);
  room.tick(clock.now());
  room.continueRound(cur.askerId);
};

const nextRound = (ctx) => {
  ctx.room.nextRound(ctx.host.id);
  ctx.clock.advance(DEFAULT_TIMINGS.roleMs);
  ctx.room.tick(ctx.clock.now());
};

// ------------------------------------------------------------------ tests

describe('lobby', () => {
  it('registers players with unique names and avatars', () => {
    const { room, players } = lobby(3);
    const extra = room.addPlayer();
    throwsCode(() => room.setProfile(extra.id, { name: '  spiller1 ', avatar: AVATAR_IDS[5] }), 'name_taken');
    throwsCode(() => room.setProfile(extra.id, { name: 'Ny', avatar: AVATAR_IDS[1] }), 'avatar_taken');
    throwsCode(() => room.setProfile(extra.id, { name: 'Ny', avatar: 'finnes-ikke' }), 'bad_avatar');
    throwsCode(() => room.setProfile(extra.id, { name: '   ', avatar: AVATAR_IDS[5] }), 'bad_name');
    room.setProfile(extra.id, { name: 'Ny', avatar: AVATAR_IDS[5] });
    assert.equal(room.readyPlayers().length, players.length + 1);
  });

  it('cleans and truncates names', () => {
    const { room } = lobby(3);
    const p = room.addPlayer();
    room.setProfile(p.id, { name: '  Ola​   Nordmann-med-veldig-langt-navn ', avatar: AVATAR_IDS[7] });
    assert.equal(byId(room, p.id).name, 'Ola Nordmann-m');
  });

  it('lets a player change their profile before the game starts', () => {
    const { room, players } = lobby(3);
    room.setProfile(players[1].id, { name: 'Nytt navn', avatar: AVATAR_IDS[1] });
    assert.equal(byId(room, players[1].id).name, 'Nytt navn');
  });

  it('refuses an 11th player', () => {
    const { room } = lobby(LIMITS.maxPlayers);
    throwsCode(() => room.addPlayer(), 'full');
  });

  it('needs the host and at least three registered players to start', () => {
    const two = lobby(2);
    throwsCode(() => two.room.start(two.host.id), 'need_players');
    const three = lobby(3);
    throwsCode(() => three.room.start(three.players[1].id), 'not_host');
    three.room.start(three.host.id);
    assert.equal(three.room.phase, PHASE.ROLE);
  });

  it('drops players who never finished their profile when the game starts', () => {
    const ctx = lobby(3);
    const ghost = ctx.room.addPlayer();
    ctx.room.connect(ghost.id);
    ctx.room.start(ctx.host.id);
    assert.ok(!ctx.room.players.has(ghost.id));
    assert.deepEqual(ctx.room.drainRemoved().map((r) => r.id), [ghost.id]);
  });

  it('refuses late joiners and offers disconnected seats instead', () => {
    const ctx = lobby(4);
    ctx.room.disconnect(ctx.players[3].id);
    ctx.room.start(ctx.host.id);
    try {
      ctx.room.addPlayer();
      assert.fail('should have thrown');
    } catch (e) {
      assert.equal(e.code, 'started');
      assert.deepEqual(e.extra.seats.map((s) => s.id), [ctx.players[3].id]);
    }
  });

  it('allows seat takeover only for offline players, and rotates their token', () => {
    const ctx = lobby(4);
    const target = ctx.players[2];
    throwsCode(() => ctx.room.claimSeat(target.id), 'seat_taken');
    const oldToken = target.token;
    ctx.room.disconnect(target.id);
    const claimed = ctx.room.claimSeat(target.id);
    assert.notEqual(claimed.token, oldToken);
    throwsCode(() => ctx.room.authenticate(target.id, oldToken), 'bad_token');
    assert.equal(ctx.room.authenticate(target.id, claimed.token).id, target.id);
  });

  it('only counts connected players and refuses to start when too few are online', () => {
    const ctx = lobby(3);
    ctx.room.disconnect(ctx.players[2].id);
    throwsCode(() => ctx.room.start(ctx.host.id), 'need_connected');
  });
});

describe('roles', () => {
  it('assigns exactly one impostor and one asker, and only the impostor learns the answer', () => {
    const ctx = lobby(5);
    ctx.room.start(ctx.host.id);
    const { impostorId, askerId, question } = ctx.room.current;
    assert.equal(ctx.room.phase, PHASE.ROLE);
    assert.ok(ctx.room.players.has(impostorId) && ctx.room.players.has(askerId));

    const letter = 'ABCD'[question.correct];
    let impostors = 0;
    for (const p of ctx.players) {
      const v = ctx.room.viewFor(p.id);
      assert.equal(v.phase, PHASE.ROLE);
      assert.equal(v.roleEndsAt, ctx.clock.now() + DEFAULT_TIMINGS.roleMs);
      if (p.id === impostorId) {
        impostors++;
        assert.equal(v.you.role, 'impostor');
        assert.deepEqual(v.you.secret, { index: question.correct, letter, text: question.options[question.correct] });
      } else {
        assert.equal(v.you.role, 'loyal');
        assert.equal(v.you.secret, undefined);
        assert.ok(!JSON.stringify(v).includes(question.options[question.correct]), 'a loyal view must not contain the answer');
      }
      assert.equal(v.question, undefined, 'nobody sees the question during the role reveal');
    }
    assert.equal(impostors, 1);
  });

  it('picks impostor and asker uniformly at random (and the asker may be the impostor)', () => {
    const counts = { impostor: {}, asker: {} };
    let same = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const ctx = lobby(4, { seed: i + 1 });
      ctx.room.start(ctx.host.id);
      const { impostorId, askerId } = ctx.room.current;
      const seat = (id) => ctx.players.findIndex((p) => p.id === id); // ids are random per lobby, seats are not
      counts.impostor[seat(impostorId)] = (counts.impostor[seat(impostorId)] ?? 0) + 1;
      counts.asker[seat(askerId)] = (counts.asker[seat(askerId)] ?? 0) + 1;
      if (impostorId === askerId) same++;
    }
    for (const kind of ['impostor', 'asker']) {
      const values = Object.values(counts[kind]);
      assert.equal(values.length, 4, `every player is picked as ${kind} sometimes`);
      for (const v of values) assert.ok(Math.abs(v - N / 4) < N * 0.05, `${kind} spread looks uniform (${values})`);
    }
    assert.ok(Math.abs(same - N / 4) < N * 0.05, 'asker == impostor about 1 in 4 times');
  });

  it('skips disconnected players when choosing roles', () => {
    for (let seed = 1; seed < 60; seed++) {
      const ctx = lobby(5, { seed });
      ctx.room.disconnect(ctx.players[4].id);
      ctx.room.start(ctx.host.id);
      assert.notEqual(ctx.room.current.impostorId, ctx.players[4].id);
      assert.notEqual(ctx.room.current.askerId, ctx.players[4].id);
    }
  });

  it('moves from the role reveal to the question after five seconds', () => {
    const ctx = lobby(4);
    ctx.room.start(ctx.host.id);
    ctx.clock.advance(DEFAULT_TIMINGS.roleMs - 1);
    assert.equal(ctx.room.tick(ctx.clock.now()), false);
    assert.equal(ctx.room.phase, PHASE.ROLE);
    ctx.clock.advance(1);
    assert.equal(ctx.room.tick(ctx.clock.now()), true);
    assert.equal(ctx.room.phase, PHASE.QUESTION);
  });
});

describe('question phase', () => {
  it('shows the question and options only to the asker, and the timer to everyone', () => {
    const ctx = lobby(4);
    const { asker, q } = toQuestion(ctx);
    for (const p of ctx.players) {
      const v = ctx.room.viewFor(p.id);
      assert.equal(v.phase, PHASE.QUESTION);
      assert.equal(v.discussion.endsAt, ctx.clock.now() + DEFAULT_TIMINGS.discussionMs);
      assert.equal(v.turn.askerId, asker.id);
      if (p.id === asker.id) {
        assert.deepEqual(v.question, { text: q.text, options: q.options });
        assert.equal(JSON.stringify(v).includes('"correct"'), false, 'the asker is never told which option is right');
      } else {
        assert.equal(v.question, undefined);
        assert.ok(!JSON.stringify(v).includes(q.text));
      }
    }
  });

  it('lets only the asker set the clock (2/6/10 minutes), add time and select an option', () => {
    const ctx = lobby(4);
    const { asker } = toQuestion(ctx);
    const other = ctx.players.find((p) => p.id !== asker.id);
    throwsCode(() => ctx.room.setTimer(other.id, 120), 'not_asker');
    throwsCode(() => ctx.room.addTime(other.id), 'not_asker');
    throwsCode(() => ctx.room.select(other.id, 1), 'not_asker');
    throwsCode(() => ctx.room.lock(other.id, 1), 'not_asker');

    for (const minutes of [2, 6, 10]) {
      ctx.room.setTimer(asker.id, minutes * 60);
      assert.equal(ctx.room.current.discussionEndsAt, ctx.clock.now() + minutes * 60_000);
    }
    ctx.clock.advance(30_000);
    ctx.room.addTime(asker.id);
    assert.equal(ctx.room.current.discussionEndsAt, ctx.clock.now() + 600_000 - 30_000 + 60_000);

    ctx.room.select(asker.id, 2);
    assert.equal(ctx.room.viewFor(asker.id).selected, 2);
    throwsCode(() => ctx.room.select(asker.id, 7), 'bad_value');
    throwsCode(() => ctx.room.setTimer(asker.id, 5), 'bad_value');
  });

  it('adding time after the clock ran out restarts from now', () => {
    const ctx = lobby(4);
    const { asker } = toQuestion(ctx);
    ctx.clock.advance(DEFAULT_TIMINGS.discussionMs + 90_000);
    ctx.room.addTime(asker.id);
    assert.equal(ctx.room.current.discussionEndsAt, ctx.clock.now() + 60_000);
  });

  it('does not lock without a valid choice', () => {
    const ctx = lobby(4);
    const { asker } = toQuestion(ctx);
    throwsCode(() => ctx.room.lock(asker.id, undefined), 'bad_value');
    throwsCode(() => ctx.room.lock(asker.id, 4), 'bad_value');
    assert.equal(ctx.room.phase, PHASE.QUESTION);
  });
});

describe('locking, countdown and reveal', () => {
  it('counts down 5 seconds, then reveals the result to the asker only', () => {
    const ctx = lobby(4);
    const { asker, q } = toQuestion(ctx);
    ctx.room.lock(asker.id, q.correct);
    assert.equal(ctx.room.phase, PHASE.LOCKED);
    for (const p of ctx.players) {
      assert.equal(ctx.room.viewFor(p.id).countdown.endsAt, ctx.clock.now() + DEFAULT_TIMINGS.countdownMs);
      assert.equal(ctx.room.viewFor(p.id).reveal, undefined);
    }
    ctx.clock.advance(DEFAULT_TIMINGS.countdownMs);
    ctx.room.tick(ctx.clock.now());
    assert.equal(ctx.room.phase, PHASE.REVEAL);

    const askerView = ctx.room.viewFor(asker.id);
    assert.equal(askerView.reveal.correct, true);
    assert.equal(askerView.reveal.correctText, q.options[q.correct]);
    for (const p of ctx.players.filter((x) => x.id !== asker.id)) {
      const v = ctx.room.viewFor(p.id);
      assert.equal(v.phase, PHASE.REVEAL);
      assert.equal(v.reveal, undefined, 'only the asker sees the reveal');
      assert.equal(v.summary, undefined, 'and nobody sees the outcome yet');
    }
  });

  it('reports a wrong answer together with the right one', () => {
    const ctx = lobby(4);
    const { asker, q } = toQuestion(ctx);
    ctx.room.lock(asker.id, (q.correct + 2) % 4);
    ctx.clock.advance(DEFAULT_TIMINGS.countdownMs);
    ctx.room.tick(ctx.clock.now());
    const r = ctx.room.viewFor(asker.id).reveal;
    assert.equal(r.correct, false);
    assert.equal(r.correctIndex, q.correct);
    assert.equal(r.correctLetter, 'ABCD'[q.correct]);
  });
});

describe('scoring', () => {
  const scores = (room) => Object.fromEntries([...room.players.values()].map((p) => [p.id, p.score]));

  it('gives every loyal player a point when the group is right', () => {
    const ctx = lobby(4);
    ctx.room.setTarget(ctx.host.id, 10);
    const cur = playRound(ctx, { groupRight: true });
    for (const p of ctx.players) assert.equal(byId(ctx.room, p.id).score, p.id === cur.impostorId ? 0 : 1);
    assert.equal(ctx.room.phase, PHASE.SUMMARY);
    const s = ctx.room.viewFor(ctx.host.id).summary;
    assert.equal(s.correct, true);
    assert.equal(s.impostorId, cur.impostorId);
    assert.deepEqual(Object.keys(s.gained).sort(), ctx.players.filter((p) => p.id !== cur.impostorId).map((p) => p.id).sort());
  });

  it('gives only the impostor a point when the group is wrong', () => {
    const ctx = lobby(4);
    ctx.room.setTarget(ctx.host.id, 10);
    const cur = playRound(ctx, { groupRight: false });
    for (const p of ctx.players) assert.equal(byId(ctx.room, p.id).score, p.id === cur.impostorId ? 1 : 0);
  });

  it('works when the asker is also the impostor', () => {
    let tested = false;
    for (let seed = 1; seed < 200 && !tested; seed++) {
      const ctx = lobby(4, { seed });
      ctx.room.setTarget(ctx.host.id, 10);
      ctx.room.start(ctx.host.id);
      if (ctx.room.current.askerId !== ctx.room.current.impostorId) continue;
      tested = true;
      ctx.clock.advance(DEFAULT_TIMINGS.roleMs);
      ctx.room.tick(ctx.clock.now());
      const v = ctx.room.viewFor(ctx.room.current.askerId);
      assert.equal(v.you.role, 'impostor');
      assert.ok(v.question && v.you.secret, 'sees both the question and the secret answer');
      finishRound(ctx, false);
      assert.equal(byId(ctx.room, ctx.room.current.impostorId).score, 1);
    }
    assert.ok(tested, 'found a seed where asker === impostor');
  });

  it('does not touch the scoreboard until the asker continues', () => {
    const ctx = lobby(4);
    const { asker, q } = toQuestion(ctx);
    ctx.room.lock(asker.id, q.correct);
    ctx.clock.advance(DEFAULT_TIMINGS.countdownMs);
    ctx.room.tick(ctx.clock.now());
    assert.deepEqual(Object.values(scores(ctx.room)), [0, 0, 0, 0]);
    const other = ctx.players.find((p) => p.id !== asker.id && p.id !== ctx.host.id) ?? ctx.players[1];
    if (other.id !== ctx.host.id) throwsCode(() => ctx.room.continueRound(other.id), 'not_asker');
    ctx.room.continueRound(asker.id);
    assert.ok(Object.values(scores(ctx.room)).some((s) => s === 1));
  });

  it('lets the host move things along if the asker is gone', () => {
    const ctx = lobby(4);
    const { asker, q } = toQuestion(ctx);
    ctx.room.lock(asker.id, q.correct);
    ctx.clock.advance(DEFAULT_TIMINGS.countdownMs);
    ctx.room.tick(ctx.clock.now());
    ctx.room.disconnect(asker.id);
    ctx.room.continueRound(ctx.host.id);
    assert.equal(ctx.room.phase, PHASE.SUMMARY);
  });
});

describe('winning', () => {
  it('crowns the single leader once the target is reached', () => {
    const ctx = lobby(4);
    ctx.room.setTarget(ctx.host.id, 2);
    // play until somebody wins; the group is always right, so loyal players climb together
    let guard = 0;
    while (ctx.room.phase !== PHASE.FINISHED && guard++ < 40) {
      if (ctx.room.phase === PHASE.LOBBY) ctx.room.start(ctx.host.id);
      else nextRound(ctx);
      ctx.clock.advance(DEFAULT_TIMINGS.roleMs);
      ctx.room.tick(ctx.clock.now());
      finishRound(ctx, true);
    }
    assert.equal(ctx.room.phase, PHASE.FINISHED);
    assert.equal(ctx.room.winnerIds.length, 1);
    const max = Math.max(...ctx.players.map((p) => byId(ctx.room, p.id).score));
    assert.ok(max >= 2);
    assert.equal(byId(ctx.room, ctx.room.winnerIds[0]).score, max);
    assert.equal(ctx.room.viewFor(ctx.host.id).winners.length, 1);
  });

  it('keeps playing when several players tie at the top (sudden death)', () => {
    const ctx = lobby(4);
    ctx.room.setTarget(ctx.host.id, 1);
    ctx.room.start(ctx.host.id);
    ctx.clock.advance(DEFAULT_TIMINGS.roleMs);
    ctx.room.tick(ctx.clock.now());
    finishRound(ctx, true); // three loyal players reach 1 point at once
    assert.equal(ctx.room.phase, PHASE.SUMMARY, 'no winner yet');
    assert.equal(ctx.room.viewFor(ctx.host.id).summary.tiebreak, true);
    nextRound(ctx);
    assert.equal(ctx.room.phase, PHASE.QUESTION);
  });

  it('ends the game as soon as a sudden-death round separates the leaders', () => {
    const ctx = lobby(3, { seed: 7 });
    ctx.room.setTarget(ctx.host.id, 1);
    ctx.room.start(ctx.host.id);
    ctx.clock.advance(DEFAULT_TIMINGS.roleMs);
    ctx.room.tick(ctx.clock.now());
    finishRound(ctx, false); // only the impostor scores -> unique leader at the target
    assert.equal(ctx.room.phase, PHASE.FINISHED);
    assert.deepEqual(ctx.room.winnerIds, [ctx.room.current.impostorId]);
  });

  it('the host can change the target between rounds, which may decide the game', () => {
    const ctx = lobby(4);
    ctx.room.setTarget(ctx.host.id, 5);
    ctx.room.start(ctx.host.id);
    ctx.clock.advance(DEFAULT_TIMINGS.roleMs);
    ctx.room.tick(ctx.clock.now());
    finishRound(ctx, false);
    assert.equal(ctx.room.phase, PHASE.SUMMARY);
    throwsCode(() => ctx.room.setTarget(ctx.players[1].id, 1), 'not_host');
    throwsCode(() => ctx.room.setTarget(ctx.host.id, 0), 'bad_value');
    throwsCode(() => ctx.room.setTarget(ctx.host.id, 2.5), 'bad_value');
    ctx.room.setTarget(ctx.host.id, 1);
    assert.equal(ctx.room.phase, PHASE.FINISHED, 'lowering the target below the leader ends the game');
  });

  it('can be ended early by the host, and replayed from the lobby', () => {
    const ctx = lobby(4);
    ctx.room.setTarget(ctx.host.id, 9);
    ctx.room.start(ctx.host.id);
    ctx.clock.advance(DEFAULT_TIMINGS.roleMs);
    ctx.room.tick(ctx.clock.now());
    finishRound(ctx, false);
    ctx.room.endGame(ctx.host.id);
    assert.equal(ctx.room.phase, PHASE.FINISHED);
    assert.equal(ctx.room.winnerIds.length, 1);
    throwsCode(() => ctx.room.playAgain(ctx.players[1].id), 'not_host');
    ctx.room.playAgain(ctx.host.id);
    assert.equal(ctx.room.phase, PHASE.LOBBY);
    assert.ok([...ctx.room.players.values()].every((p) => p.score === 0));
  });
});

describe('skipping and kicking', () => {
  it('lets the host skip a stuck round without points', () => {
    const ctx = lobby(4);
    ctx.room.setTarget(ctx.host.id, 9);
    toQuestion(ctx);
    throwsCode(() => ctx.room.skipRound(ctx.players[1].id), 'not_host');
    ctx.room.skipRound(ctx.host.id);
    assert.equal(ctx.room.phase, PHASE.SUMMARY);
    assert.equal(ctx.room.viewFor(ctx.host.id).summary.skipped, true);
    assert.ok([...ctx.room.players.values()].every((p) => p.score === 0));
    nextRound(ctx);
    assert.equal(ctx.room.phase, PHASE.QUESTION);
    assert.equal(ctx.room.round, 2);
  });

  it('kicking is lobby-only for online players but works on offline players in-game', () => {
    const ctx = lobby(5);
    ctx.room.kick(ctx.host.id, ctx.players[4].id);
    assert.ok(!ctx.room.players.has(ctx.players[4].id));
    ctx.room.start(ctx.host.id);
    throwsCode(() => ctx.room.kick(ctx.host.id, ctx.players[3].id), 'bad_phase');
    ctx.room.disconnect(ctx.players[3].id);
    ctx.room.kick(ctx.host.id, ctx.players[3].id);
    assert.ok(!ctx.room.players.has(ctx.players[3].id));
  });

  it('skips the round when the kicked player was part of it', () => {
    const ctx = lobby(5);
    toQuestion(ctx);
    const victim = ctx.room.current.askerId === ctx.host.id ? ctx.room.current.impostorId : ctx.room.current.askerId;
    if (victim === ctx.host.id) return; // host can't be kicked; covered by other seeds
    ctx.room.disconnect(victim);
    ctx.room.kick(ctx.host.id, victim);
    assert.equal(ctx.room.phase, PHASE.SUMMARY);
    assert.equal(ctx.room.viewFor(ctx.host.id).summary.skipped, true);
  });
});

describe('host handover and cleanup', () => {
  it('is patient with a host whose phone locked while friends are still joining (lobby: 10 minutes)', () => {
    const ctx = lobby(4);
    ctx.room.disconnect(ctx.host.id);
    ctx.clock.advance(DEFAULT_TIMINGS.hostGraceLobbyMs - 1);
    ctx.room.tick(ctx.clock.now());
    assert.equal(ctx.room.hostId, ctx.host.id);
    ctx.clock.advance(1);
    assert.equal(ctx.room.tick(ctx.clock.now()), true);
    assert.notEqual(ctx.room.hostId, ctx.host.id);
    assert.ok(byId(ctx.room, ctx.room.hostId).connected);
  });

  it('hands the controls to a connected player after three minutes during a game', () => {
    const ctx = lobby(4);
    ctx.room.start(ctx.host.id);
    ctx.room.disconnect(ctx.host.id);
    ctx.clock.advance(DEFAULT_TIMINGS.hostGraceMs - 1);
    ctx.room.tick(ctx.clock.now());
    assert.equal(ctx.room.hostId, ctx.host.id);
    ctx.clock.advance(1);
    assert.equal(ctx.room.tick(ctx.clock.now()), true);
    assert.notEqual(ctx.room.hostId, ctx.host.id);
  });

  it('never throws the room creator out for an unfinished profile, even after the host role moved on', () => {
    const clock = fakeClock();
    const room = new Room({ code: 'MAKE', now: clock.now, rand: seeded(3) });
    const host = room.addPlayer({ asHost: true });
    room.connect(host.id);
    const guest = room.addPlayer();
    room.setProfile(guest.id, { name: 'Gjest', avatar: AVATAR_IDS[1] });
    room.connect(guest.id);
    room.disconnect(host.id); // the host showed the QR first, then the screen locked: no profile picked yet
    clock.advance(DEFAULT_TIMINGS.hostGraceLobbyMs + 1);
    room.tick(clock.now());
    assert.equal(room.hostId, guest.id, 'someone else holds the controls now');
    clock.advance(60 * 60_000);
    room.tick(clock.now());
    assert.ok(room.players.has(host.id), 'but the creator can still come back');
    assert.equal(room.authenticate(host.id, host.token).id, host.id);
  });

  it('still sweeps other guests who never finished their profile', () => {
    const clock = fakeClock();
    const room = new Room({ code: 'MAKE', now: clock.now, rand: seeded(4) });
    const host = room.addPlayer({ asHost: true });
    room.connect(host.id);
    const ghost = room.addPlayer();
    room.connect(ghost.id);
    room.disconnect(ghost.id);
    clock.advance(DEFAULT_TIMINGS.placeholderMs + 1);
    room.tick(clock.now());
    assert.ok(!room.players.has(ghost.id));
    assert.ok(room.players.has(host.id));
  });

  it('keeps the host if they come back in time', () => {
    const ctx = lobby(4);
    ctx.room.disconnect(ctx.host.id);
    ctx.clock.advance(20_000);
    ctx.room.tick(ctx.clock.now());
    ctx.room.connect(ctx.host.id);
    ctx.clock.advance(60_000);
    ctx.room.tick(ctx.clock.now());
    assert.equal(ctx.room.hostId, ctx.host.id);
  });

  it('removes lobby placeholders that left without choosing a profile', () => {
    const ctx = lobby(3);
    const ghost = ctx.room.addPlayer();
    ctx.room.connect(ghost.id);
    ctx.room.disconnect(ghost.id);
    ctx.clock.advance(DEFAULT_TIMINGS.placeholderMs + 1);
    ctx.room.tick(ctx.clock.now());
    assert.ok(!ctx.room.players.has(ghost.id));
  });
});

describe('question deck', () => {
  it('serves every question once before repeating, never the same one twice in a row', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const room = new Room({ code: 'DECK', rand: seeded(seed) });
      const served = [];
      for (let i = 0; i < QUESTIONS.length * 4; i++) served.push(room.nextQuestion().id);
      for (let c = 0; c < 4; c++) {
        const cycle = served.slice(c * QUESTIONS.length, (c + 1) * QUESTIONS.length);
        assert.equal(new Set(cycle).size, QUESTIONS.length, `cycle ${c} contains each question once`);
      }
      for (let i = 1; i < served.length; i++) assert.notEqual(served[i], served[i - 1]);
    }
  });

  it('ships four well-formed test questions, including the tourists one', () => {
    assert.equal(QUESTIONS.length, 4);
    for (const q of QUESTIONS) {
      assert.equal(q.options.length, 4);
      assert.ok(q.correct >= 0 && q.correct < 4);
      assert.ok(q.text.endsWith('?'));
    }
    const t = QUESTIONS.find((q) => q.id === 'turister');
    assert.equal(t.text, 'Hvilket land har flest turister årlig?');
    assert.deepEqual(t.options, ['USA', 'Japan', 'Frankrike', 'Kina']);
    assert.equal(t.options[t.correct], 'Frankrike');
  });
});

describe('absent players', () => {
  it('only players who were in the round can score from it (an absent friend does not farm points)', () => {
    const ctx = lobby(5, { seed: 11 });
    ctx.room.setTarget(ctx.host.id, 50);
    const absent = ctx.players[4];
    ctx.room.disconnect(absent.id);
    for (let i = 0; i < 6; i++) {
      if (ctx.room.phase === PHASE.LOBBY) ctx.room.start(ctx.host.id);
      else nextRound(ctx);
      ctx.clock.advance(DEFAULT_TIMINGS.roleMs);
      ctx.room.tick(ctx.clock.now());
      finishRound(ctx, true); // the group is always right
    }
    assert.equal(byId(ctx.room, absent.id).score, 0, 'absent the whole game: no points');
    const present = ctx.players.slice(0, 4).map((p) => byId(ctx.room, p.id).score);
    assert.ok(Math.max(...present) > 0);
  });

  it('a player who drops out after the roles were dealt still scores for that round', () => {
    const ctx = lobby(4, { seed: 5 });
    ctx.room.setTarget(ctx.host.id, 50);
    ctx.room.start(ctx.host.id);
    const cur = ctx.room.current;
    const dropper = ctx.players.find((p) => p.id !== cur.impostorId && p.id !== cur.askerId);
    ctx.clock.advance(DEFAULT_TIMINGS.roleMs);
    ctx.room.tick(ctx.clock.now());
    ctx.room.disconnect(dropper.id); // phone locked mid-discussion
    finishRound(ctx, true);
    assert.equal(byId(ctx.room, dropper.id).score, 1);
  });

  it('a seat taken over mid-round does not score that round, but plays the next one', () => {
    const ctx = lobby(4, { seed: 9 });
    ctx.room.setTarget(ctx.host.id, 50);
    ctx.room.disconnect(ctx.players[3].id);
    ctx.room.start(ctx.host.id);
    ctx.clock.advance(DEFAULT_TIMINGS.roleMs);
    ctx.room.tick(ctx.clock.now());
    ctx.room.claimSeat(ctx.players[3].id);
    ctx.room.connect(ctx.players[3].id);
    finishRound(ctx, true);
    assert.equal(byId(ctx.room, ctx.players[3].id).score, 0);
    nextRound(ctx);
    assert.ok(ctx.room.current.participants.includes(ctx.players[3].id));
  });

  it('keeps a decided round when the offline asker is removed after the answer was locked', () => {
    const ctx = roundWhere(5, (cur, c) => cur.askerId !== c.host.id);
    ctx.clock.advance(DEFAULT_TIMINGS.roleMs);
    ctx.room.tick(ctx.clock.now());
    const cur = ctx.room.current;
    ctx.room.lock(cur.askerId, cur.question.correct);
    ctx.clock.advance(DEFAULT_TIMINGS.countdownMs);
    ctx.room.tick(ctx.clock.now());
    ctx.room.disconnect(cur.askerId);
    ctx.room.kick(ctx.host.id, cur.askerId);
    assert.equal(ctx.room.phase, PHASE.SUMMARY);
    const s = ctx.room.viewFor(ctx.host.id).summary;
    assert.equal(s.skipped, false, 'the round still counts');
    assert.equal(s.correct, true);
    // everybody who was in the round and is still here, except the impostor, got the point
    const expected = cur.participants.filter((id) => id !== cur.impostorId && ctx.room.players.has(id));
    assert.deepEqual(Object.keys(s.gained).sort(), expected.sort());
    assert.ok(expected.length >= 1);
  });

  it('the summary names the impostor even if they were removed from the game', () => {
    const ctx = roundWhere(5, (cur, c) => cur.impostorId !== c.host.id);
    const cur = ctx.room.current;
    const impostorName = byId(ctx.room, cur.impostorId).name;
    ctx.room.disconnect(cur.impostorId);
    ctx.room.kick(ctx.host.id, cur.impostorId);
    const s = ctx.room.viewFor(ctx.host.id).summary;
    assert.equal(s.impostor.name, impostorName);
    assert.ok(s.impostor.avatar);
  });

  it('lets the host change the target at any time during a game, and checks for a winner when the round ends', () => {
    const ctx = lobby(4, { seed: 2 });
    ctx.room.setTarget(ctx.host.id, 5);
    ctx.room.start(ctx.host.id);
    ctx.clock.advance(DEFAULT_TIMINGS.roleMs);
    ctx.room.tick(ctx.clock.now());
    ctx.room.setTarget(ctx.host.id, 1); // mid-discussion
    assert.equal(ctx.room.phase, PHASE.QUESTION);
    finishRound(ctx, false); // the impostor scores 1 -> unique leader at the new target
    assert.equal(ctx.room.phase, PHASE.FINISHED);
    throwsCode(() => ctx.room.setTarget(ctx.host.id, 3), 'bad_phase');
  });
});
