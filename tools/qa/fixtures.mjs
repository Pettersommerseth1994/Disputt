// Builds realistic per-player views for every screen by driving the real game engine.
// Used by tools/qa/shots.mjs (visual QA) — the views are exactly what the server would send.

import { AVATAR_IDS } from '../../shared/avatars.mjs';
import { DEFAULT_TIMINGS, Room } from '../../shared/game.js';
import { QUESTIONS } from '../../shared/questions.js';

const NAMES = ['Petter', 'Mari', 'Ola', 'Sofie', 'Jonas'];
// The worst the lobby accepts: 14 characters of the widest letters, long compound names, accents, an emoji sequence.
const STRESS_NAMES = ['WWWWWWWWWWWWWW', 'Bjørnstjerne-Bj', 'Åse-Marie Ødega', 'MMMMMMMMMMMMMM', 'Wolfgang Amade', 'Sigurd Jorsalfa', 'Kristin Lavran', '👨\u200d👩\u200d👧 Familien', 'Nordmann-Hanse', 'Olav den Helli'];

/** Randomness that picks [impostorIndex, askerIndex] first, then zeros (=> the tourists question comes first). */
function scripted(first) {
  const queue = [...first];
  return { int: (n) => (queue.length ? queue.shift() % n : 0) };
}

function makeRoom({ players = 5, impostor = 1, asker = 3, target = 5, stress = false, exact = false } = {}) {
  const room = new Room({ code: 'KRAP', rand: scripted([impostor, asker]), now: () => Date.now() });
  const ids = [];
  if (stress && !exact) players = Math.max(players, 10); // stress rooms are full unless a screen needs a free seat
  for (let i = 0; i < players; i++) {
    const p = room.addPlayer({ asHost: i === 0 });
    room.setProfile(p.id, { name: stress ? STRESS_NAMES[i] : NAMES[i], avatar: AVATAR_IDS[stress ? i : [0, 1, 2, 4, 6][i]] });
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

/**
 * Every screen's view, from the real engine. With `stress`, rooms are full (ten players), names are the widest the
 * lobby accepts, scores have two digits, and the texts are the longest the question bank holds.
 */
export function buildFixtures({ stress = false } = {}) {
  const out = {};
  // (stress rooms play to 99: a two-digit target on every screen that shows it; a screen that needs a finished game says so)
  const room0 = (opts) => makeRoom({ ...opts, target: opts.target ?? (stress ? 99 : 5), stress });

  // ---- lobby / profile
  {
    const { room, ids } = room0({ players: 1 });
    room.players.get(ids[0]).name = '';
    room.players.get(ids[0]).avatar = null; // the host has not picked a profile yet
    out['lobby-host-new'] = room.viewFor(ids[0]);
  }
  {
    const { room, ids } = room0({ players: 3 });
    out['lobby-host-3'] = room.viewFor(ids[0]);
    out['lobby-guest-3'] = room.viewFor(ids[1]);
    out['profile-edit'] = room.viewFor(ids[1]);
  }
  {
    // a newcomer who has not picked a profile yet needs a free seat
    const { room } = room0({ players: stress ? 9 : 3, exact: true });
    const fresh = room.addPlayer();
    room.connect(fresh.id);
    out['profile-new'] = room.viewFor(fresh.id);
  }
  {
    const { room, ids } = room0({ players: 5 });
    out['lobby-host-5'] = room.viewFor(ids[0]);
  }

  // ---- a round: impostor = Mari (1), asker = Sofie (3, loyal)
  {
    const { room, ids } = room0({ impostor: 1, asker: 3 });
    const [petter, mari, ola, sofie] = ids;
    room.start(petter);
    out['role-impostor'] = room.viewFor(mari);
    out['role-loyal'] = room.viewFor(ola);

    tick(room, DEFAULT_TIMINGS.roleMs + 1);
    room.tick(room.clock());
    out['question-asker'] = room.viewFor(sofie);
    out['discussion-impostor'] = room.viewFor(mari);
    out['discussion-loyal'] = room.viewFor(ola);
    out['discussion-host'] = room.viewFor(petter); // the host's header has a gear next to "Poeng"

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
    const { room, ids } = room0({ impostor: 2, asker: 0 });
    const [petter, mari, ola] = ids;
    room.start(petter); // start() resets scores, so set the mid-game scores afterwards
    room.players.get(petter).score = 3;
    room.players.get(mari).score = 2;
    room.players.get(ola).score = 1;
    tick(room, DEFAULT_TIMINGS.roleMs + 1);
    room.tick(room.clock());
    out['question-host'] = room.viewFor(petter); // the host is the asker: the densest screen, with the gear in the header
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
    const { room, ids } = room0({ impostor: 2, asker: 0, target: 3 });
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

  {
    const offline = structuredClone(out['summary-wrong-host']);
    offline.players.forEach((p, i) => i >= 1 && i % 2 === 1 && !p.isHost && (p.connected = false));
    out['summary-offline-host'] = offline;
  }

  if (stress) {
    // two-digit scores wherever a scoreboard is drawn
    const scores = [99, 87, 76, 65, 54, 43, 32, 21, 10, 0];
    for (const key of ['summary-right-host', 'summary-right-guest', 'summary-wrong-host', 'summary-wrong-guest', 'finished-host', 'finished-guest']) {
      out[key].players.forEach((p, i) => (p.score = scores[i] ?? 0));
    }
    // a tie at the top: three winners with names of the widest kind
    const tie = structuredClone(out['finished-host']);
    tie.winners = tie.players.slice(0, 3).map((p) => p.id);
    out['finished-tie'] = tie;
    // the longest question and the longest answers the bank can produce
    const longest = QUESTIONS.reduce((a, b) => (b.text.length > a.text.length ? b : a));
    const options = ['Valentina Teresjkova', 'Svetlana Savitskaja', 'Bjørnstjerne Bjørnson', 'Store Skagastølstind'];
    for (const key of ['question-asker', 'question-asker-selected', 'question-asker-timeup', 'countdown-asker']) {
      if (out[key]?.question) out[key].question = { ...out[key].question, text: longest.text, options };
    }
    for (const key of ['reveal-right', 'reveal-wrong']) {
      if (out[key]?.reveal) out[key].reveal = { ...out[key].reveal, correctText: options[2], question: { text: longest.text, options } };
    }
    if (out['role-impostor']?.you?.secret) out['role-impostor'].you.secret = { ...out['role-impostor'].you.secret, text: options[2] };
  }
  return out;
}
