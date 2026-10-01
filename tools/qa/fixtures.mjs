// Builds realistic per-player views for every screen by driving the real game engine.
// Used by tools/qa/shots.mjs (visual QA) — the views are exactly what the server would send.

import { AVATAR_IDS } from '../../shared/avatars.mjs';
import { DEFAULT_TIMINGS, Room } from '../../server/game.js';

const NAMES = ['Petter', 'Mari', 'Ola', 'Sofie', 'Jonas'];

/** Randomness that picks [impostorIndex, askerIndex] first, then zeros (=> the tourists question comes first). */
function scripted(first) {
  const queue = [...first];
  return { int: (n) => (queue.length ? queue.shift() % n : 0) };
}

function makeRoom({ players = 5, impostor = 1, asker = 3, target = 5 } = {}) {
  const room = new Room({ code: 'KRAP', rand: scripted([impostor, asker]), now: () => Date.now() });
  const ids = [];
  for (let i = 0; i < players; i++) {
    const p = room.addPlayer({ asHost: i === 0 });
    room.setProfile(p.id, { name: NAMES[i], avatar: AVATAR_IDS[[0, 1, 2, 4, 6][i]] });
    room.connect(p.id);
    ids.push(p.id);
  }
  room.setTarget(ids[0], target);
  return { room, ids };
}

const tick = (room, ms) => {
  room.clock = (() => {
    const base = Date.now() + ms;
    return () => base;
  })();
};

export function buildFixtures() {
  const out = {};

  // ---- lobby / profile
  {
    const { room, ids } = makeRoom({ players: 1 });
    room.players.get(ids[0]).name = '';
    room.players.get(ids[0]).avatar = null; // the host has not picked a profile yet
    out['lobby-host-new'] = room.viewFor(ids[0]);
  }
  {
    const { room, ids } = makeRoom({ players: 3 });
    out['lobby-host-3'] = room.viewFor(ids[0]);
    out['lobby-guest-3'] = room.viewFor(ids[1]);
    const fresh = room.addPlayer();
    room.connect(fresh.id);
    out['profile-new'] = room.viewFor(fresh.id);
    out['profile-edit'] = room.viewFor(ids[1]);
  }
  {
    const { room, ids } = makeRoom({ players: 5 });
    out['lobby-host-5'] = room.viewFor(ids[0]);
  }

  // ---- a round: impostor = Mari (1), asker = Sofie (3, loyal)
  {
    const { room, ids } = makeRoom({ impostor: 1, asker: 3 });
    const [petter, mari, ola, sofie] = ids;
    room.start(petter);
    out['role-impostor'] = room.viewFor(mari);
    out['role-loyal'] = room.viewFor(ola);

    tick(room, DEFAULT_TIMINGS.roleMs + 1);
    room.tick(room.clock());
    out['question-asker'] = room.viewFor(sofie);
    out['discussion-impostor'] = room.viewFor(mari);
    out['discussion-loyal'] = room.viewFor(ola);

    room.select(sofie, 2);
    out['question-asker-selected'] = room.viewFor(sofie);

    const low = structuredClone(out['discussion-loyal']);
    low.discussion.endsAt = Date.now() + 18_000;
    out['discussion-low'] = low;
    const over = structuredClone(out['question-asker-selected']);
    over.discussion.endsAt = Date.now() - 4_000;
    out['question-asker-timeup'] = over;

    room.lock(sofie, 2); // right answer: Frankrike
    out['countdown-asker'] = room.viewFor(sofie);
    out['countdown-other'] = room.viewFor(ola);
    tick(room, DEFAULT_TIMINGS.roleMs + DEFAULT_TIMINGS.countdownMs + 2);
    room.tick(room.clock());
    out['reveal-right'] = room.viewFor(sofie);
    out['reveal-wait'] = room.viewFor(ola);
    room.continueRound(sofie);
    out['summary-right-host'] = room.viewFor(petter);
    out['summary-right-guest'] = room.viewFor(ola);
  }

  // ---- wrong answer + mid-game scores, impostor = Ola (2)
  {
    const { room, ids } = makeRoom({ impostor: 2, asker: 0 });
    const [petter, mari, ola] = ids;
    room.start(petter); // start() resets scores, so set the mid-game scores afterwards
    room.players.get(petter).score = 3;
    room.players.get(mari).score = 2;
    room.players.get(ola).score = 1;
    tick(room, DEFAULT_TIMINGS.roleMs + 1);
    room.tick(room.clock());
    room.lock(petter, 0); // wrong
    tick(room, 20_000);
    room.tick(room.clock());
    out['reveal-wrong'] = room.viewFor(petter);
    room.continueRound(petter);
    out['summary-wrong-host'] = room.viewFor(petter);
    out['summary-wrong-guest'] = room.viewFor(mari);
  }

  // ---- finished
  {
    const { room, ids } = makeRoom({ impostor: 2, asker: 0, target: 3 });
    const [petter] = ids;
    room.start(petter);
    room.players.get(petter).score = 2;
    room.players.get(ids[1]).score = 1;
    tick(room, DEFAULT_TIMINGS.roleMs + 1);
    room.tick(room.clock());
    room.lock(petter, 2); // right -> everyone but the impostor gets a point; Petter reaches 3
    tick(room, 20_000);
    room.tick(room.clock());
    room.continueRound(petter);
    out['finished-host'] = room.viewFor(petter);
    out['finished-guest'] = room.viewFor(ids[1]);
  }
  return out;
}
