// Full-stack test: real HTTP + WebSocket server, five simulated phones, a complete game.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { AVATAR_IDS } from '../shared/avatars.mjs';
import { createApp } from '../server/index.js';
import { QUESTIONS } from '../server/questions.js';
import { TestClient, sleep } from './helpers.js';

let app;
let port;

before(async () => {
  app = createApp({ port: 0, host: '127.0.0.1', silent: true, tickMs: 20, hubOptions: { timings: { roleMs: 120, countdownMs: 120 } } });
  port = await app.listen();
});
after(() => app.close());

const questionFor = (text) => QUESTIONS.find((q) => q.text === text);

async function openLobby(names) {
  const host = await TestClient.connect(port);
  host.send({ type: 'noop' }); // unknown messages are ignored
  host.send({ t: 'create' });
  await host.until((c) => c.identity, 'host welcome');
  const code = host.identity.code;
  host.send({ t: 'profile', name: names[0], avatar: AVATAR_IDS[0] });
  const guests = [];
  for (let i = 1; i < names.length; i++) {
    const g = await TestClient.connect(port);
    g.send({ t: 'join', code });
    await g.until((c) => c.identity, `welcome ${names[i]}`);
    g.send({ t: 'profile', name: names[i], avatar: AVATAR_IDS[i] });
    guests.push(g);
  }
  const all = [host, ...guests];
  await Promise.all(all.map((c) => c.until((x) => x.view.players.length === names.length, 'all players registered')));
  return { host, guests, all, code };
}

describe('a full game over WebSockets', () => {
  it('plays from lobby to a crowned winner and back to the lobby', async () => {
    const { host, all, code } = await openLobby(['Anne', 'Bjørn', 'Cathrine', 'Dag', 'Eva']);

    // lobby: everyone sees everyone, only the host is host
    for (const c of all) {
      assert.equal(c.view.phase, 'lobby');
      assert.equal(c.view.players.length, 5);
      assert.equal(c.view.code, code);
      assert.equal(c.view.you.isHost, c === host);
    }

    // non-host cannot start; the host can change the target; invalid targets are refused
    all[1].send({ t: 'start' });
    await all[1].error('not_host');
    host.send({ t: 'target', value: 'abc' });
    await host.error('bad_value');
    host.send({ t: 'target', value: 2 });
    await all[2].until((c) => c.view.target === 2, 'target broadcast');

    host.send({ t: 'start' });
    await Promise.all(all.map((c) => c.phase('role')));

    // a sixth phone arriving now is told the game has started and is offered no (online) seats
    const late = await TestClient.connect(port);
    late.send({ t: 'join', code });
    await late.error('started');
    assert.deepEqual(late.errors.at(-1).seats, []);
    late.close();

    let rounds = 0;
    let sawNonAskerNeverGetsQuestion = true;
    while (all[0].view.phase !== 'finished' && rounds < 40) {
      rounds++;
      await Promise.all(all.map((c) => c.phase('role')));

      // role reveal: exactly one impostor, who alone holds the secret
      const impostors = all.filter((c) => c.view.you.role === 'impostor');
      assert.equal(impostors.length, 1, 'exactly one impostor');
      for (const c of all) {
        assert.equal(Boolean(c.view.you.secret), c.view.you.role === 'impostor');
        assert.equal(c.view.roleEndsAt - c.view.now > 0, true, 'role reveal has a deadline in the future');
      }

      // the server moves on by itself after the reveal
      await Promise.all(all.map((c) => c.phase('question')));
      const asker = all.find((c) => c.view.you.isAsker);
      assert.ok(asker, 'someone is the asker');
      for (const c of all) {
        if (c === asker) continue;
        if (c.view.question) sawNonAskerNeverGetsQuestion = false;
      }
      const q = questionFor(asker.view.question.text);
      assert.ok(q, 'asker received a real question');
      assert.deepEqual(asker.view.question.options, q.options);

      // asker adjusts the clock; others cannot
      const other = all.find((c) => c !== asker);
      other.send({ t: 'timer.set', seconds: 120 });
      await other.error('not_asker');
      asker.send({ t: 'timer.set', seconds: 600 });
      await asker.until((c) => c.view.discussion.endsAt - c.view.now > 590_000, 'timer set to 10 minutes');
      asker.send({ t: 'timer.add', seconds: 60 });
      await asker.until((c) => c.view.discussion.endsAt - c.view.now > 650_000, 'one more minute');
      assert.ok(other.view.discussion.endsAt - other.view.now > 640_000, 'everybody sees the adjusted clock');

      // alternate right and wrong answers so both impostor and loyal scoring are exercised
      const groupRight = rounds % 2 === 1;
      const choice = groupRight ? q.correct : (q.correct + 1) % 4;
      asker.send({ t: 'select', index: choice });
      await asker.until((c) => c.view.selected === choice, 'selection persisted');
      asker.send({ t: 'lock', index: choice });
      await Promise.all(all.map((c) => c.phase('locked')));
      await Promise.all(all.map((c) => c.phase('reveal')));

      // only the asker sees the verdict
      assert.equal(asker.view.reveal.correct, groupRight);
      assert.equal(asker.view.reveal.correctText, q.options[q.correct]);
      for (const c of all) if (c !== asker) assert.equal(c.view.reveal, undefined);

      const before = new Map(all.map((c) => [c.identity.playerId, c.view.players.find((p) => p.id === c.identity.playerId).score]));
      asker.send({ t: 'continue' });
      await Promise.all(all.map((c) => c.until((x) => ['summary', 'finished'].includes(x.view.phase), 'round summary')));

      const impostorId = impostors[0].identity.playerId;
      for (const c of all) {
        const me = c.view.players.find((p) => p.id === c.identity.playerId);
        const gained = me.score - before.get(c.identity.playerId);
        const expected = groupRight ? (c.identity.playerId === impostorId ? 0 : 1) : c.identity.playerId === impostorId ? 1 : 0;
        assert.equal(gained, expected, `${me.name} scored ${gained}, expected ${expected} (groupRight=${groupRight})`);
        assert.equal(c.view.summary.impostorId, impostorId);
      }

      if (all[0].view.phase === 'summary') {
        // only the host may start the next round
        all.find((c) => c !== host).send({ t: 'next' });
        await all.find((c) => c !== host).error('not_host');
        host.send({ t: 'next' });
      }
    }

    assert.equal(sawNonAskerNeverGetsQuestion, true);
    for (const c of all) await c.phase('finished');
    const winners = host.view.winners;
    assert.equal(winners.length, 1, 'a single winner is crowned');
    const scores = host.view.players.map((p) => p.score);
    assert.equal(host.view.players.find((p) => p.id === winners[0]).score, Math.max(...scores));
    assert.ok(Math.max(...scores) >= 2);

    // play again -> lobby with scores reset
    host.send({ t: 'again' });
    for (const c of all) await c.phase('lobby');
    assert.deepEqual(host.view.players.map((p) => p.score), [0, 0, 0, 0, 0]);

    all.forEach((c) => c.close());
  });

  it('lets a phone reconnect mid-game (resume) and take over a lost seat (claim)', async () => {
    const { host, guests, all, code } = await openLobby(['Ida', 'Jon', 'Kari']);
    host.send({ t: 'target', value: 5 });
    host.send({ t: 'start' });
    await Promise.all(all.map((c) => c.phase('role')));

    // Jon's phone locks: socket drops, everyone sees him offline, then he resumes with his token
    const jon = guests[0];
    const roleBefore = jon.view.you.role;
    const identity = jon.identity;
    jon.close();
    await host.until((c) => c.view.players.find((p) => p.id === identity.playerId)?.connected === false, 'Jon shown offline');

    const back = await TestClient.connect(port);
    back.send({ t: 'resume', code, playerId: identity.playerId, token: identity.token });
    await back.until((c) => c.identity, 'resumed');
    assert.equal(back.view.you.role, roleBefore, 'same role after resuming');
    assert.equal(back.view.you.name, 'Jon');
    await host.until((c) => c.view.players.find((p) => p.id === identity.playerId)?.connected === true, 'Jon shown online again');

    // a second tab with the same identity replaces the first
    const dupe = await TestClient.connect(port);
    dupe.send({ t: 'resume', code, playerId: identity.playerId, token: identity.token });
    await dupe.until((c) => c.identity, 'second tab resumed');
    await back.until((c) => c.closedReason === 'replaced', 'first tab told it was replaced');

    // wrong token is refused
    const intruder = await TestClient.connect(port);
    intruder.send({ t: 'resume', code, playerId: identity.playerId, token: 'nope' });
    await intruder.error('bad_token');

    // Kari loses her browser entirely: a fresh phone claims her seat from the "game started" screen
    const kari = guests[1];
    const kariId = kari.identity.playerId;
    kari.close();
    await host.until((c) => c.view.players.find((p) => p.id === kariId)?.connected === false, 'Kari offline');
    const fresh = await TestClient.connect(port);
    fresh.send({ t: 'join', code });
    await fresh.error('started');
    const seats = fresh.errors.at(-1).seats;
    assert.deepEqual(seats.map((s) => s.name), ['Kari']);
    fresh.send({ t: 'claim', code, playerId: seats[0].id });
    await fresh.until((c) => c.identity, 'claimed');
    assert.equal(fresh.view.you.name, 'Kari');
    assert.notEqual(fresh.identity.token, kari.identity.token, 'token rotated');

    // the host can skip a stuck round
    host.send({ t: 'skip' });
    await host.phase('summary');
    assert.equal(host.view.summary.skipped, true);

    for (const c of [host, back, dupe, intruder, fresh, kari, jon]) c.close();
  });

  it('rejects unknown rooms and cross-site WebSocket connections', async () => {
    const c = await TestClient.connect(port);
    c.send({ t: 'join', code: 'QQQQ' });
    await c.error('room_not_found');
    c.send({ t: 'start' });
    await c.error('no_session');
    c.close();

    await assert.rejects(TestClient.connect(port, { origin: 'https://evil.example' }), (e) => e.status === 403);
    await sleep(10);
  });

  it('answers ping with the server clock for time sync', async () => {
    const c = await TestClient.connect(port);
    const before = Date.now();
    c.send({ t: 'ping', c: 42 });
    await c.until((x) => x.messages.some((m) => m.t === 'pong'), 'pong');
    const pong = c.messages.find((m) => m.t === 'pong');
    assert.equal(pong.c, 42);
    assert.ok(pong.s >= before && pong.s <= Date.now() + 5);
    c.close();
  });
});
