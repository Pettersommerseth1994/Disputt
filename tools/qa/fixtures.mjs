// Builds realistic per-player views for every screen by driving the real game engine.
// Used by tools/qa/shots.mjs (visual QA) — the views are exactly what the server would send.

import { AVATAR_IDS } from '../../shared/avatars.mjs';
import { DEFAULT_TIMINGS, LIMITS, MODE, Room } from '../../shared/game.js';
import { QUESTIONS } from '../../shared/questions.js';

const NAMES = ['Petter', 'Mari', 'Ola', 'Sofie', 'Jonas', 'Ida'];
// The worst the lobby accepts: 14 characters of the widest letters, long compound names, accents, an emoji sequence.
const STRESS_NAMES = ['WWWWWWWWWWWWWW', 'Bjørnstjerne-Bj', 'Åse-Marie Ødega', 'MMMMMMMMMMMMMM', 'Wolfgang Amade', 'Sigurd Jorsalfa', 'Kristin Lavran', '👨\u200d👩\u200d👧 Familien', 'Nordmann-Hanse', 'Olav den Helli'];

/**
 * Randomness that picks [impostorIndex, askerIndex, ...] first, then zeros (=> the tourists question comes first). With six players
 * or more the third pick is the second impostor, as an index among the players who are not the first impostor.
 */
function scripted(first) {
  const queue = [...first];
  return { int: (n) => (queue.length ? queue.shift() % n : 0) };
}

// `mate` is the seat of the second impostor in a round of six or more (the full stress rooms always have two)
function makeRoom({ players = 5, impostor = 1, asker = 3, mate = 4, target = 5, stress = false, exact = false } = {}) {
  if (stress && !exact) players = Math.max(players, 10); // stress rooms are full unless a screen needs a free seat
  // (a third pick only when the round has a second impostor: otherwise the question shuffle would use it up, and the first
  // question would no longer be the one that every fixture and test counts on)
  const picks = players >= LIMITS.twoImpostorsFrom ? [impostor, asker, mate > impostor ? mate - 1 : mate] : [impostor, asker];
  const room = new Room({ code: 'KRAP', rand: scripted(picks), now: () => Date.now() });
  const ids = [];
  for (let i = 0; i < players; i++) {
    const p = room.addPlayer({ asHost: i === 0 });
    room.setProfile(p.id, { name: stress ? STRESS_NAMES[i] : NAMES[i], avatar: AVATAR_IDS[stress ? i : [0, 1, 2, 4, 6, 8][i]] });
    room.connect(p.id);
    ids.push(p.id);
  }
  room.setTarget(ids[0], target);
  return { room, ids };
}

/**
 * A room in bilturmodus: everybody on the host's phone. `impostor` is the seat of the impostor, `outcome` (two players only) is the
 * one of three: 0 nobody, 1 the first, 2 the second. The host asks, so there is no pick for that.
 */
function makeCarRoom({ players = 3, impostor = 1, mate = 4, outcome = 1, target = 5, stress = false } = {}) {
  const picks = players === 2 ? [outcome] : players >= LIMITS.twoImpostorsFrom ? [impostor, mate > impostor ? mate - 1 : mate] : [impostor];
  const room = new Room({ code: 'KRAP', rand: scripted(picks), now: () => Date.now(), mode: MODE.CAR });
  const host = room.addPlayer({ asHost: true });
  room.setProfile(host.id, { name: stress ? STRESS_NAMES[0] : NAMES[0], avatar: AVATAR_IDS[stress ? 0 : 0] });
  room.connect(host.id);
  const ids = [host.id];
  for (let i = 1; i < players; i++) {
    const p = room.addLocalPlayer(host.id, { name: stress ? STRESS_NAMES[i] : NAMES[i], avatar: AVATAR_IDS[stress ? i : [0, 1, 2, 4, 6, 8, 3, 5, 7, 9][i]] });
    ids.push(p.id);
  }
  room.setTarget(host.id, target);
  return { room, ids };
}

/** Which step of the host's set-up a screen is on (the rest are null: the game's own choice, which is the last step). */
export const STEP_OF = { 'setup-points': 2, 'car-points': 2, 'car-players-1': 1, 'car-players-3': 1, 'car-players-2': 1, 'car-players-10': 1 };

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
    const { room, ids } = room0({ players: 1 });
    out['lobby-host-1'] = room.viewFor(ids[0]); // the invitation, with nobody there yet
    out['setup-points'] = room.viewFor(ids[0]); // the host's second step (shown with `step: 2`)
  }
  {
    const { room, ids } = room0({ players: 2 });
    out['lobby-host-2'] = room.viewFor(ids[0]); // with only two players the host is told about the rule
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
    out['reveal-asker'] = room.viewFor(sofie); // the reveal is spoken: the same screen for everybody, the asker has the button
    out['reveal-wait'] = room.viewFor(ola);
    room.continueRound(sofie);
    out['summary-right-host'] = room.viewFor(petter);
    out['summary-right-guest'] = room.viewFor(ola);
  }

  // ---- a round with two impostors (six players, or ten in the stress rooms): Mari (1) and Jonas (4), asker Sofie (3)
  {
    const { room, ids } = room0({ players: 6, impostor: 1, asker: 3, mate: 4 });
    const [petter, mari, ola, sofie, jonas, ida] = ids;
    room.start(petter);
    out['role-impostor-duo'] = room.viewFor(mari); // sees Jonas as the other impostor
    out['role-loyal-duo'] = room.viewFor(ola);
    tick(room, DEFAULT_TIMINGS.roleMs + 1);
    room.tick(room.clock());
    out['discussion-impostor-duo'] = room.viewFor(jonas);
    out['discussion-loyal-duo'] = room.viewFor(ida);
    room.lock(sofie, 0); // wrong
    tick(room, 20_000);
    room.tick(room.clock());
    out['reveal-duo-asker'] = room.viewFor(sofie);
    out['reveal-duo-wait'] = room.viewFor(ola);
    room.continueRound(sofie);
    out['summary-duo-wrong-host'] = room.viewFor(petter);
    out['summary-duo-wrong-guest'] = room.viewFor(ola);
  }
  {
    const { room, ids } = room0({ players: 6 });
    out['lobby-host-6'] = room.viewFor(ids[0]); // the host's lobby says "to imposterer"
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
    out['reveal-host-asker'] = room.viewFor(petter); // the host had the question: the gear sits next to "Poeng"
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

  // ---- bilturmodus: everybody on the host's phone
  {
    const { room, ids } = makeCarRoom({ players: 1, stress });
    room.players.get(ids[0]).name = '';
    room.players.get(ids[0]).avatar = null; // the host has not put in a name yet: the list asks for it
    out['car-players-new'] = room.viewFor(ids[0]);
  }
  {
    const { room, ids } = makeCarRoom({ players: 1, stress });
    out['car-players-1'] = room.viewFor(ids[0]);
  }
  {
    const { room, ids } = makeCarRoom({ players: 2, stress });
    out['car-players-2'] = room.viewFor(ids[0]); // "Dere er bare to"
  }
  {
    const { room, ids } = makeCarRoom({ players: 3, stress });
    out['car-players-3'] = room.viewFor(ids[0]);
    out['car-how'] = room.viewFor(ids[0]); // the last step: how it works
    out['car-points'] = room.viewFor(ids[0]);
  }
  {
    const { room, ids } = makeCarRoom({ players: 10, stress: true });
    out['car-players-10'] = room.viewFor(ids[0]);
  }
  {
    // the phone goes round: Mari (1) is the impostor
    const { room, ids } = makeCarRoom({ players: 3, impostor: 1, stress });
    const [petter, mari, ola] = ids;
    room.start(petter);
    out['car-roles-start'] = room.viewFor(petter);
    room.roleSeen(petter, petter);
    out['car-roles-next'] = room.viewFor(petter);
    room.roleSeen(petter, mari);
    room.roleSeen(petter, ola);
    out['car-roles-done'] = room.viewFor(petter);
    room.startQuestion(petter);
    out['car-question'] = room.viewFor(petter);
    room.select(petter, 2);
    out['car-question-selected'] = room.viewFor(petter);
    room.lock(petter, 2); // right answer: Frankrike
    out['car-countdown'] = room.viewFor(petter);
    tick(room, DEFAULT_TIMINGS.countdownMs + 2);
    room.tick(room.clock());
    out['car-reveal'] = room.viewFor(petter);
    room.continueRound(petter);
    out['car-summary'] = room.viewFor(petter);
  }
  {
    // ten players, two impostors: the list of names is as long as it gets
    const { room, ids } = makeCarRoom({ players: 10, impostor: 1, mate: 4, stress: true });
    room.start(ids[0]);
    for (const id of ids.slice(0, 6)) room.roleSeen(ids[0], id);
    out['car-roles-10'] = room.viewFor(ids[0]);
    for (const id of ids.slice(6)) room.roleSeen(ids[0], id);
    room.startQuestion(ids[0]);
    out['car-question-10'] = room.viewFor(ids[0]); // (the sheet "Se rolle igjen" has ten names)
  }
  for (const [name, outcome, answer] of [['car-summary-none-right', 0, 2], ['car-summary-none-wrong', 0, 0], ['car-summary-two', 2, 0]]) {
    // two players: nobody is the impostor (or the second is), and the group is right (or not)
    const { room, ids } = makeCarRoom({ players: 2, outcome, stress });
    room.start(ids[0]);
    room.roleSeen(ids[0], ids[0]);
    room.roleSeen(ids[0], ids[1]);
    room.startQuestion(ids[0]);
    room.lock(ids[0], answer);
    tick(room, DEFAULT_TIMINGS.countdownMs + 2);
    room.tick(room.clock());
    room.continueRound(ids[0]);
    out[name] = room.viewFor(ids[0]);
  }
  {
    const { room, ids } = makeCarRoom({ players: 3, impostor: 2, target: 3, stress });
    room.start(ids[0]);
    room.players.get(ids[0]).score = 2;
    for (const id of ids) room.roleSeen(ids[0], id);
    room.startQuestion(ids[0]);
    room.lock(ids[0], 2);
    tick(room, DEFAULT_TIMINGS.countdownMs + 2);
    room.tick(room.clock());
    room.continueRound(ids[0]);
    out['car-finished'] = room.viewFor(ids[0]);
  }

  // A guard: every fixture counts on the first question being the tourists question (right answer "Frankrike"), which only
  // holds while the scripted randomness is used up by exactly the picks the engine makes. The "right" round must be right.
  if (out['role-impostor'].you.secret.text !== 'Frankrike' || out['summary-right-host'].summary.correct !== true || out['summary-wrong-host'].summary.correct !== false) {
    throw new Error('the fixtures no longer start with the tourists question: check scripted() and makeRoom()');
  }

  if (stress) {
    // two-digit scores wherever a scoreboard is drawn
    const scores = [99, 87, 76, 65, 54, 43, 32, 21, 10, 0];
    for (const key of ['summary-right-host', 'summary-right-guest', 'summary-wrong-host', 'summary-wrong-guest', 'finished-host', 'finished-guest', 'car-summary', 'car-finished']) {
      out[key].players.forEach((p, i) => (p.score = scores[i] ?? 0));
    }
    // a tie at the top: three winners with names of the widest kind
    const tie = structuredClone(out['finished-host']);
    tie.winners = tie.players.slice(0, 3).map((p) => p.id);
    out['finished-tie'] = tie;
    // the longest question and the longest answers the bank can produce
    const longest = QUESTIONS.reduce((a, b) => (b.text.length > a.text.length ? b : a));
    const options = ['Valentina Teresjkova', 'Svetlana Savitskaja', 'Bjørnstjerne Bjørnson', 'Store Skagastølstind'];
    for (const key of ['question-asker', 'question-asker-selected', 'question-asker-timeup', 'countdown-asker', 'car-question', 'car-question-selected', 'car-question-10', 'car-countdown']) {
      if (out[key]?.question) out[key].question = { ...out[key].question, text: longest.text, options };
    }
    // what was locked is said on every phone during the countdown, and the answer key has both answers
    for (const key of ['countdown-asker', 'countdown-other', 'car-countdown']) out[key].countdown.chosen = { ...out[key].countdown.chosen, text: options[1] };
    for (const key of ['summary-right-host', 'summary-right-guest', 'summary-wrong-host', 'summary-wrong-guest', 'summary-duo-wrong-host', 'summary-duo-wrong-guest', 'car-summary', 'car-summary-none-right', 'car-summary-none-wrong', 'car-summary-two']) {
      out[key].summary.answer = { ...out[key].summary.answer, correctText: options[2], chosenText: options[1] };
    }
    if (out['role-impostor']?.you?.secret) out['role-impostor'].you.secret = { ...out['role-impostor'].you.secret, text: options[2] };
    for (const key of ['car-roles-start', 'car-roles-next', 'car-roles-done', 'car-roles-10', 'car-question', 'car-question-10']) {
      for (const row of out[key].table ?? []) if (row.secret) row.secret = { ...row.secret, text: options[2] };
    }
  }
  return out;
}
