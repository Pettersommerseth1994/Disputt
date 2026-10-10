// Disputt game engine: one Room = one game. Pure state machine, no I/O.
//
// Time never comes from timers inside the room: the host process calls `tick(now)` ~10x/second and every
// handler reads the injected clock. That keeps the engine deterministic and easy to test.
//
// Round flow:  ROLE (8 s) -> QUESTION (discussion timer) -> LOCKED (5 s countdown) -> REVEAL (the impostors say the answer
//              out loud; the asker moves on) -> SUMMARY (scores applied) -> next ROLE ...  or FINISHED when someone leads at/above
//              the target. Nothing is revealed on a screen: the phones only count down and keep the score.
//
// There are two ways to play the same game (MODE): "cabin" (hytteturmodus), a phone each, and "car" (bilturmodus), ONE phone, the host's.
// In the car the other players have no phone of their own (`local`: the host puts them in, they are always "connected"), the host always
// asks the question, and the ROLE phase has no timer: the phone goes round, one player after the other sees their role, and the host
// goes on when everybody has (`roleSeen`, `startQuestion`). Everything else is the same code.

import { isAvatarId } from './avatars.mjs';
import { LETTERS, QUESTIONS } from './questions.js';
import { nameKey } from './names.js';
import { cleanName, defaultRandom, makeId, makeToken, shuffle } from './util.js';

export const PHASE = Object.freeze({
  LOBBY: 'lobby',
  ROLE: 'role',
  QUESTION: 'question',
  LOCKED: 'locked',
  REVEAL: 'reveal',
  SUMMARY: 'summary',
  FINISHED: 'finished',
});

export const LIMITS = Object.freeze({
  minPlayers: 2,
  maxPlayers: 10, // a phone each
  maxPlayersCar: 5, // everybody on one phone: as many as a car holds
  twoImpostorsFrom: 6, // a round with this many players or more has two impostors instead of one
  targetMin: 1,
  targetMax: 99,
  timerMinSec: 30,
  timerMaxSec: 60 * 60,
});

/** The two ways to play: a phone each ("cabin", hytteturmodus) or one phone for everybody ("car", bilturmodus). */
export const MODE = Object.freeze({ CABIN: 'cabin', CAR: 'car' });

/** How many impostors a round with this many players has. (With only two players a round may also have none: see beginRound.) */

export const impostorCount = (players) => (players >= LIMITS.twoImpostorsFrom ? 2 : 1);

const MAX_GHOSTS = 2; // abandoned, nameless lobby placeholders kept around at the same time (see addPlayer)

// With three players or more, a round needs three phones: a friend whose phone has gone to sleep is waited for (it is back in a moment), and
// the others are not left to play a round as if they were only two, where the rule for two players would apply. Only a game of exactly two
// is played by two, and then it needs both phones.
const PHONES_FOR_A_CROWD = 3;

export const DEFAULT_TIMINGS = Object.freeze({
  roleMs: 8000,
  countdownMs: 5000,
  discussionMs: 6 * 60_000,
  addMs: 60_000,
  hostGraceMs: 3 * 60_000, // host offline this long during a game -> someone else takes over
  hostGraceLobbyMs: 10 * 60_000, // phones lock their screens while friends are still scanning the code
  placeholderMs: 60_000,
});

const IN_ROUND = [PHASE.ROLE, PHASE.QUESTION, PHASE.LOCKED, PHASE.REVEAL];

export class GameError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    this.extra = extra;
  }
}

const isReady = (p) => Boolean(p && p.name && p.avatar);

export class Room {
  constructor({ code, rand = defaultRandom, now = Date.now, timings = {}, questions = QUESTIONS, mode = MODE.CABIN } = {}) {
    this.code = code;
    this.mode = mode === MODE.CAR ? MODE.CAR : MODE.CABIN; // (anything else, and a game saved before there were two ways to play, is the cabin)
    this.rand = rand;
    this.clock = now;
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.questions = questions;

    this.players = new Map();
    this.hostId = null;
    this.creatorId = null; // the player who opened the room; never cleaned up as an unfinished profile
    this.phase = PHASE.LOBBY;
    this.round = 0;
    this.target = 5;
    this.current = null;
    this.winnerIds = [];
    this.history = [];
    this.removed = []; // players dropped by the room; the transport layer drains this
    this.hostAwaySince = null;

    this.deck = [];
    this.lastQuestionIndex = -1;
    this.createdAt = this.lastActivity = now();
  }

  // ---------------------------------------------------------------- persistence

  /**
   * Plain-JSON copy of everything needed to carry on later. The peer-to-peer host keeps this in sessionStorage, so a
   * reload (or a browser that discards the tab) does not end the game. `JSON.stringify(room)` uses it too.
   */
  /** The most players this game takes: ten with a phone each (cabin), five on one phone (car). */
  get maxPlayers() {
    return this.mode === MODE.CAR ? LIMITS.maxPlayersCar : LIMITS.maxPlayers;
  }

  toJSON() {
    return {
      v: 1,
      code: this.code,
      mode: this.mode,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      hostId: this.hostId,
      creatorId: this.creatorId,
      phase: this.phase,
      round: this.round,
      target: this.target,
      winnerIds: this.winnerIds,
      history: this.history,
      deck: this.deck,
      lastQuestionIndex: this.lastQuestionIndex,
      questionCount: this.questions.length,
      hostAwaySince: this.hostAwaySince,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        token: p.token,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        joinedAt: p.joinedAt,
        lastSeen: p.lastSeen,
        ...(p.local ? { local: true } : {}),
      })),
      current: this.current,
    };
  }

  /** Rebuilds a room from `toJSON()`. Everybody starts out disconnected; their phones reconnect with their tokens. */
  static fromJSON(data, options = {}) {
    if (!data || data.v !== 1 || typeof data.code !== 'string' || !Array.isArray(data.players)) {
      throw new Error('Unknown room snapshot');
    }
    const copy = JSON.parse(JSON.stringify(data)); // never share state with the caller
    const room = new Room({ ...options, code: copy.code, mode: copy.mode });
    room.createdAt = copy.createdAt;
    room.lastActivity = room.clock();
    room.hostId = copy.hostId;
    room.creatorId = copy.creatorId;
    room.phase = copy.phase;
    room.round = copy.round;
    room.target = copy.target;
    room.winnerIds = copy.winnerIds ?? [];
    room.history = copy.history ?? [];
    room.current = copy.current ?? null;
    if (room.current && !room.current.impostorIds) {
      // a game saved before there could be two impostors
      room.current.impostorIds = [room.current.impostorId];
      room.current.impostors = [room.current.impostor];
    }
    room.hostAwaySince = null;
    // deck positions only make sense for the same question bank
    const sameBank = copy.questionCount === room.questions.length;
    room.deck = sameBank ? copy.deck ?? [] : [];
    room.lastQuestionIndex = sameBank ? copy.lastQuestionIndex ?? -1 : -1;
    const now = room.clock();
    // (the players on the host's own phone are always here: it is only the host's phone that has to come back)
    for (const p of copy.players) room.players.set(p.id, { ...p, connected: Boolean(p.local), lastSeen: now });
    return room;
  }

  // ---------------------------------------------------------------- players

  addPlayer({ asHost = false } = {}) {
    const now = this.clock();
    // Placeholders nobody finished (no name yet) whose phone has gone: a join that never came through, typically a flaky
    // connection that tried twice, or somebody whose screen locked on the profile page and who may be back in a minute.
    // A couple may linger (the second chance for the sleeper); beyond that the newcomer takes over the one that has been
    // gone longest, so retries can neither fill the lobby nor lock real players out.
    const ghosts = asHost ? [] : [...this.players.values()].filter((p) => !isReady(p) && !p.connected && p.id !== this.hostId && p.id !== this.creatorId);
    const crowded = ghosts.length >= MAX_GHOSTS || this.players.size >= this.maxPlayers;
    const leftover = crowded ? ghosts.sort((a, b) => a.lastSeen - b.lastSeen)[0] ?? null : null;
    if (!asHost) {
      if (this.mode === MODE.CAR) throw new GameError('single_phone', 'Dette spillet spilles på én telefon, så ingen kan bli med fra en annen.');
      if (this.phase !== PHASE.LOBBY) {
        throw new GameError('started', 'Spillet har allerede startet.', { seats: this.claimableSeats() });
      }
      if (!leftover && this.players.size >= this.maxPlayers) {
        throw new GameError('full', `Rommet er fullt (maks ${this.maxPlayers} spillere).`);
      }
    }
    if (leftover) {
      leftover.token = makeToken(); // the abandoned phone, should it ever come back, no longer fits
      leftover.joinedAt = now;
      leftover.lastSeen = now;
      this.touch();
      return leftover;
    }
    const player = {
      id: makeId(),
      token: makeToken(),
      name: '',
      avatar: null,
      score: 0,
      connected: false,
      joinedAt: now,
      lastSeen: now,
    };
    this.players.set(player.id, player);
    if (asHost) this.hostId = this.creatorId = player.id;
    this.touch();
    return player;
  }

  /** Seats that a returning player may take over: registered but currently offline. */
  claimableSeats() {
    return this.readyPlayers()
      .filter((p) => !p.connected)
      .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar }));
  }

  claimSeat(playerId) {
    const p = this.players.get(playerId);
    if (!p || !isReady(p)) throw new GameError('seat_gone', 'Den plassen finnes ikke lenger.');
    if (p.connected) throw new GameError('seat_taken', 'Den spilleren er allerede tilkoblet.');
    p.token = makeToken();
    this.touch();
    return p;
  }

  authenticate(playerId, token) {
    const p = this.players.get(playerId);
    if (!p || p.token !== token) throw new GameError('bad_token', 'Vi fant deg ikke i dette spillet.');
    return p;
  }

  connect(playerId) {
    const p = this.players.get(playerId);
    if (!p) return;
    p.connected = true;
    p.lastSeen = this.clock();
    if (playerId === this.hostId) this.hostAwaySince = null;
    this.touch();
  }

  disconnect(playerId) {
    const p = this.players.get(playerId);
    if (!p) return;
    p.connected = false;
    p.lastSeen = this.clock();
    if (playerId === this.hostId) this.hostAwaySince = p.lastSeen;
    this.touch();
  }

  readyPlayers() {
    return [...this.players.values()].filter(isReady);
  }

  connectedReadyPlayers() {
    return this.readyPlayers().filter((p) => p.connected);
  }

  /** Sets a profile. In the car the host also sets the profile of the players who are on the host's phone (`targetId`). */
  setProfile(playerId, { name, avatar }, targetId = playerId) {
    this.needPhase(PHASE.LOBBY);
    this.player(playerId);
    if (targetId !== playerId) {
      this.needHost(playerId);
      const target = this.players.get(targetId);
      // ('bad_value', not the 'bad_token' of `player()`: that one tells a phone that its seat is gone, and the page then leaves the game)
      if (!target) throw new GameError('bad_value', 'Den spilleren finnes ikke lenger.');
      if (!target.local) throw new GameError('bad_value', 'Du kan bare endre spillere som er lagt inn på denne telefonen.');
    }
    const p = this.player(targetId);
    const clean = cleanName(name);
    if (clean.length < 1) throw new GameError('bad_name', 'Skriv inn et navn.');
    if (!isAvatarId(avatar)) throw new GameError('bad_avatar', 'Velg en avatar.');
    const others = [...this.players.values()].filter((o) => o.id !== targetId && isReady(o));
    if (others.some((o) => nameKey(o.name) === nameKey(clean))) {
      throw new GameError('name_taken', 'Det navnet er tatt, velg et annet.');
    }
    if (others.some((o) => o.avatar === avatar)) {
      throw new GameError('avatar_taken', 'Den avataren er tatt, velg en annen.');
    }
    p.name = clean;
    p.avatar = avatar;
    this.touch();
  }

  /**
   * The car: the host puts a player in on this phone. They have no phone of their own, so they never connect or leave: they are
   * here as long as the room is.
   */
  addLocalPlayer(hostId, { name, avatar }) {
    this.needHost(hostId);
    this.needCar();
    this.needPhase(PHASE.LOBBY);
    // ('too_many', not the 'full' of a room that cannot take another phone: the page leaves the game when it hears that one)
    if (this.players.size >= this.maxPlayers) throw new GameError('too_many', `Dere kan være ${this.maxPlayers} spillere.`);
    const now = this.clock();
    const player = { id: makeId(), token: makeToken(), name: '', avatar: null, score: 0, connected: true, local: true, joinedAt: now, lastSeen: now };
    this.players.set(player.id, player);
    try {
      this.setProfile(hostId, { name, avatar }, player.id);
    } catch (err) {
      this.players.delete(player.id);
      throw err;
    }
    return player;
  }

  removePlayer(playerId, reason = 'removed') {
    const p = this.players.get(playerId);
    if (!p) return;
    this.players.delete(playerId);
    this.removed.push({ id: playerId, reason });
    if (playerId === this.hostId) this.migrateHost();
    this.touch();
  }

  drainRemoved() {
    const out = this.removed;
    this.removed = [];
    return out;
  }

  kick(hostId, targetId) {
    this.needHost(hostId);
    if (targetId === hostId) throw new GameError('bad_value', 'Du kan ikke fjerne deg selv.');
    const p = this.players.get(targetId);
    if (!p) return;
    if (this.phase !== PHASE.LOBBY && p.connected) {
      throw new GameError('bad_phase', 'Du kan bare fjerne spillere som er frakoblet.');
    }
    const cur = this.current;
    // (with two impostors the round carries on when only one of them is gone)
    const impostors = cur?.impostorIds;
    const lastImpostorGone = impostors && impostors.includes(targetId) && impostors.every((id) => id === targetId || !this.players.has(id));
    const inCurrentRound = cur && IN_ROUND.includes(this.phase) && (lastImpostorGone || cur.askerId === targetId);
    // Once the answer is locked the result is decided: removing someone must not wipe out a round that was already won or lost.
    const decided = this.phase === PHASE.LOCKED || this.phase === PHASE.REVEAL;
    this.removePlayer(targetId, 'kicked');
    if (inCurrentRound) {
      if (decided) this.applyScoring();
      else this.finishRoundWithoutPoints();
    }
  }

  leave(playerId) {
    // (everybody else is on the host's phone: a game on one phone is over when the host leaves it, whatever it is doing)
    if (this.mode !== MODE.CAR) this.needPhase(PHASE.LOBBY);
    this.player(playerId);
    this.removePlayer(playerId, 'left');
  }

  /** The room is abandoned when nobody is connected. (The players on the host's phone are always "connected": only phones count.) */
  get empty() {
    return ![...this.players.values()].some((p) => p.connected && !p.local);
  }

  migrateHost() {
    const phones = this.connectedReadyPlayers().filter((p) => !p.local); // (a player on the host's phone has nothing to take over with)
    const next = phones.find((p) => p.id !== this.hostId) ?? phones[0];
    this.hostId = next ? next.id : null;
    this.hostAwaySince = null;
  }

  // ---------------------------------------------------------------- settings

  setTarget(playerId, value) {
    this.needHost(playerId);
    if (this.phase === PHASE.FINISHED) throw new GameError('bad_phase', 'Spillet er ferdig.');
    const n = Number(value);
    if (!Number.isInteger(n) || n < LIMITS.targetMin || n > LIMITS.targetMax) {
      throw new GameError('bad_value', `Velg et tall mellom ${LIMITS.targetMin} og ${LIMITS.targetMax}.`);
    }
    this.target = n;
    if (this.phase === PHASE.SUMMARY) this.finishIfDecided(); // mid-round changes are checked when the round ends
    this.touch();
  }

  // ---------------------------------------------------------------- game flow

  start(playerId) {
    this.needHost(playerId);
    this.needPhase(PHASE.LOBBY);
    if (!isReady(this.players.get(playerId))) throw new GameError('not_ready', 'Velg navn og avatar først.');
    if (this.readyPlayers().length < LIMITS.minPlayers) {
      throw new GameError('need_players', `Dere må være minst ${LIMITS.minPlayers} spillere.`);
    }
    this.ensureEnoughConnected();
    for (const p of [...this.players.values()]) {
      if (!isReady(p)) this.removePlayer(p.id, 'not_ready');
    }
    for (const p of this.players.values()) p.score = 0;
    this.round = 0;
    this.history = [];
    this.winnerIds = [];
    this.beginRound();
  }

  nextRound(playerId) {
    this.needHost(playerId);
    this.needPhase(PHASE.SUMMARY);
    if (this.finishIfDecided()) return;
    this.ensureEnoughConnected();
    this.beginRound();
  }

  playAgain(playerId) {
    this.needHost(playerId);
    this.needPhase(PHASE.FINISHED);
    for (const p of this.players.values()) p.score = 0;
    this.round = 0;
    this.current = null;
    this.history = [];
    this.winnerIds = [];
    this.phase = PHASE.LOBBY;
    this.touch();
  }

  endGame(playerId) {
    this.needHost(playerId);
    if (this.phase === PHASE.LOBBY || this.phase === PHASE.FINISHED) {
      throw new GameError('bad_phase', 'Det er ingenting å avslutte akkurat nå.');
    }
    this.finish(this.leaders());
  }

  skipRound(playerId) {
    this.needHost(playerId);
    if (!IN_ROUND.includes(this.phase)) throw new GameError('bad_phase', 'Det er ingen runde å hoppe over.');
    this.finishRoundWithoutPoints();
  }

  /** Asker picks (or changes) the option they are leaning towards. Persisted so a reload keeps it. */
  select(playerId, index) {
    this.needAsker(playerId, PHASE.QUESTION);
    if (index !== null && !this.validOption(index)) throw new GameError('bad_value', 'Ugyldig svaralternativ.');
    this.current.selected = index;
    this.touch();
  }

  /** Sets the remaining discussion time. */
  setTimer(playerId, seconds) {
    this.needAsker(playerId, PHASE.QUESTION);
    const s = Number(seconds);
    if (!Number.isFinite(s) || s < LIMITS.timerMinSec || s > LIMITS.timerMaxSec) {
      throw new GameError('bad_value', 'Ugyldig tid.');
    }
    this.current.discussionEndsAt = this.clock() + Math.round(s) * 1000;
    this.touch();
  }

  addTime(playerId, seconds = this.timings.addMs / 1000) {
    this.needAsker(playerId, PHASE.QUESTION);
    const s = Number(seconds);
    if (!Number.isFinite(s) || s < 1 || s > 600) throw new GameError('bad_value', 'Ugyldig tid.');
    const now = this.clock();
    const base = Math.max(this.current.discussionEndsAt, now);
    this.current.discussionEndsAt = Math.min(base + Math.round(s) * 1000, now + LIMITS.timerMaxSec * 1000);
    this.touch();
  }

  /** Asker locks in the answer the group agreed on; the reveal countdown starts. */
  lock(playerId, index) {
    this.needAsker(playerId, PHASE.QUESTION);
    if (!this.validOption(index)) throw new GameError('bad_value', 'Velg et svaralternativ først.');
    const cur = this.current;
    cur.selected = index;
    cur.locked = { index, endsAt: this.clock() + this.timings.countdownMs };
    cur.correct = index === cur.question.correct;
    this.phase = PHASE.LOCKED;
    this.touch();
  }

  /** After the reveal, the asker (or the host) moves everyone on; this is when points are counted. */
  continueRound(playerId) {
    this.needPhase(PHASE.REVEAL);
    if (playerId !== this.current.askerId && playerId !== this.hostId) {
      throw new GameError('not_asker', 'Bare den som svarte kan gå videre.');
    }
    this.applyScoring();
  }

  /** The car: the host says that a player has seen their role (the phone goes round, one after the other). */
  roleSeen(hostId, id) {
    this.needCar();
    this.needHost(hostId);
    this.needPhase(PHASE.ROLE);
    const cur = this.current;
    if (!cur.participants.includes(id) || !this.players.has(id)) throw new GameError('bad_value', 'Den spilleren er ikke med i denne runden.');
    if (!cur.seen.includes(id)) cur.seen.push(id);
    this.touch();
  }

  /** The car: when everybody has seen their role, the phone is the host's again, and the question comes. */
  startQuestion(hostId) {
    this.needCar();
    this.needHost(hostId);
    this.needPhase(PHASE.ROLE);
    const cur = this.current;
    if (cur.participants.some((id) => this.players.has(id) && !cur.seen.includes(id))) throw new GameError('not_all', 'Alle må se rollen sin først.');
    this.phase = PHASE.QUESTION;
    cur.discussionEndsAt = this.clock() + this.timings.discussionMs;
    this.touch();
  }

  /** Advances time-driven phases. Returns true when something changed. */
  tick(now = this.clock()) {
    let changed = false;
    const cur = this.current;

    if (this.phase === PHASE.ROLE && cur.roleEndsAt != null && now >= cur.roleEndsAt) { // (in the car the phone goes round by hand: no timer)
      this.phase = PHASE.QUESTION;
      cur.discussionEndsAt = now + this.timings.discussionMs;
      changed = true;
    } else if (this.phase === PHASE.LOCKED && now >= cur.locked.endsAt) {
      this.phase = PHASE.REVEAL;
      changed = true;
    }

    // Host went away for good: hand the controls to someone who is still here. (Not in the car: the others are on the host's phone,
    // and have nothing to take over with.)
    const host = this.players.get(this.hostId);
    if (this.mode === MODE.CAR) {
      this.hostAwaySince = null;
    } else if (!host || !host.connected) {
      this.hostAwaySince ??= now;
      const grace = this.phase === PHASE.LOBBY ? this.timings.hostGraceLobbyMs : this.timings.hostGraceMs;
      if (now - this.hostAwaySince >= grace) {
        const before = this.hostId;
        this.migrateHost();
        if (this.hostId !== before) changed = true;
      }
    } else {
      this.hostAwaySince = null;
    }

    // Lobby placeholders that never finished their profile and left are cleaned up.
    if (this.phase === PHASE.LOBBY) {
      for (const p of [...this.players.values()]) {
        if (!isReady(p) && !p.connected && p.id !== this.hostId && p.id !== this.creatorId && now - p.lastSeen > this.timings.placeholderMs) {
          this.removePlayer(p.id, 'timeout');
          changed = true;
        }
      }
    }

    if (changed) this.touch();
    return changed;
  }

  // ---------------------------------------------------------------- internals

  beginRound() {
    const car = this.mode === MODE.CAR;
    // (in the car everybody is on the host's phone, so everybody is here)
    const pool = car ? this.readyPlayers() : this.connectedReadyPlayers();
    const now = this.clock();
    let impostors;
    if (pool.length === 2) {
      // Only two: an impostor in every round would tell the other one who it is. So a round is one of three, each as likely as the
      // others: the first is the impostor, the second is, or nobody is.
      const outcome = this.rand.int(3);
      impostors = outcome === 0 ? [] : [pool[outcome - 1]];
    } else {
      impostors = [pool[this.rand.int(pool.length)]];
    }
    // (in the car the host always asks: the question is on the one phone, and that is the host's)
    const asker = car ? this.players.get(this.hostId) : pool[this.rand.int(pool.length)]; // may be an impostor too
    while (impostors.length > 0 && impostors.length < impostorCount(pool.length)) {
      const rest = pool.filter((p) => !impostors.includes(p));
      impostors.push(rest[this.rand.int(rest.length)]);
    }
    const first = impostors[0] ?? null;
    const info = (p) => ({ id: p.id, name: p.name, avatar: p.avatar });
    this.current = {
      number: ++this.round,
      impostorIds: impostors.map((p) => p.id), // (empty in a round of two that has no impostor)
      impostors: impostors.map(info), // (these survive an impostor being removed later: the summary names them)
      // The first impostor also under the old names: a phone that has not reloaded since an update, and a game saved by
      // this version and read by an older one, only know one impostor.
      impostorId: first ? first.id : null,
      impostor: first ? info(first) : null,
      askerId: asker.id,
      participants: pool.map((p) => p.id), // only players who were in this round can score from it
      question: this.nextQuestion(),
      roleEndsAt: car ? null : now + this.timings.roleMs,
      ...(car ? { seen: [] } : {}), // (who has seen their role: the phone goes round, and the host goes on when all have)
      discussionEndsAt: null,
      selected: null,
      locked: null,
      correct: null,
      skipped: false,
      summary: null,
    };
    this.phase = PHASE.ROLE;
    this.touch();
  }

  nextQuestion() {
    if (this.deck.length === 0) {
      this.deck = shuffle(this.questions.map((_, i) => i), this.rand);
      const last = this.deck.length - 1;
      // `pop()` takes from the end: never serve the same question twice in a row across a reshuffle.
      if (last > 0 && this.deck[last] === this.lastQuestionIndex) {
        [this.deck[0], this.deck[last]] = [this.deck[last], this.deck[0]];
      }
    }
    this.lastQuestionIndex = this.deck.pop();
    return this.questions[this.lastQuestionIndex];
  }

  applyScoring() {
    const cur = this.current;
    const gained = {};
    if (cur.correct) {
      for (const id of cur.participants) {
        const p = this.players.get(id);
        if (p && isReady(p) && !cur.impostorIds.includes(id)) {
          p.score += 1;
          gained[id] = 1;
        }
      }
    } else {
      // the group was fooled: every impostor scores
      for (const id of cur.impostorIds) {
        const impostor = this.players.get(id);
        if (impostor) {
          impostor.score += 1;
          gained[impostor.id] = 1;
        }
      }
    }
    cur.summary = { round: cur.number, correct: cur.correct, skipped: false, gained, tiebreak: false };
    this.history.push({ round: cur.number, impostorId: cur.impostorId, impostorIds: cur.impostorIds, askerId: cur.askerId, correct: cur.correct });
    this.phase = PHASE.SUMMARY;
    this.finishIfDecided();
    this.touch();
  }

  finishRoundWithoutPoints() {
    const cur = this.current;
    cur.skipped = true;
    cur.summary = { round: cur.number, correct: null, skipped: true, gained: {}, tiebreak: false };
    this.phase = PHASE.SUMMARY;
    this.touch();
  }

  leaders() {
    const ready = this.readyPlayers();
    const max = Math.max(0, ...ready.map((p) => p.score));
    return max === 0 ? [] : ready.filter((p) => p.score === max);
  }

  /**
   * A winner is crowned when the top score has reached the target AND is held by exactly one player.
   * If several players tie at the top, the game goes on ("sudden death") until one of them pulls ahead.
   */
  finishIfDecided() {
    const leaders = this.leaders();
    if (leaders.length === 0 || leaders[0].score < this.target) {
      if (this.current?.summary) this.current.summary.tiebreak = false;
      return false;
    }
    if (leaders.length === 1) {
      this.finish(leaders);
      return true;
    }
    if (this.current?.summary) this.current.summary.tiebreak = true;
    return false;
  }

  finish(winners) {
    this.winnerIds = winners.map((p) => p.id);
    this.phase = PHASE.FINISHED;
    this.touch();
  }

  validOption(index) {
    return Number.isInteger(index) && index >= 0 && index < 4;
  }

  ensureEnoughConnected() {
    if (this.mode === MODE.CAR) {
      // (everybody is on the host's phone)
      if (this.readyPlayers().length < LIMITS.minPlayers) throw new GameError('need_players', `Dere må være minst ${LIMITS.minPlayers} spillere.`);
      return;
    }
    const ready = this.readyPlayers();
    const missing = ready.filter((p) => !p.connected);
    const needed = Math.max(LIMITS.minPlayers, Math.min(ready.length, PHONES_FOR_A_CROWD));
    if (this.connectedReadyPlayers().length < needed) {
      throw new GameError(
        'need_connected',
        missing.length ? `Venter på at ${missing.map((p) => p.name).join(', ')} kobler til igjen.` : `Dere må være minst ${LIMITS.minPlayers} spillere.`,
      );
    }
  }

  player(id) {
    const p = this.players.get(id);
    if (!p) throw new GameError('bad_token', 'Vi fant deg ikke i dette spillet.');
    return p;
  }

  needCar() {
    if (this.mode !== MODE.CAR) throw new GameError('bad_mode', 'Det finnes bare i bilturmodus.');
  }

  needHost(id) {
    this.player(id);
    if (id !== this.hostId) throw new GameError('not_host', 'Bare verten kan gjøre dette.');
  }

  needPhase(phase) {
    if (this.phase !== phase) throw new GameError('bad_phase', 'Det kan ikke gjøres akkurat nå.');
  }

  needAsker(id, phase) {
    this.player(id);
    this.needPhase(phase);
    if (id !== this.current.askerId) throw new GameError('not_asker', 'Det er ikke din tur.');
  }

  touch() {
    this.lastActivity = this.clock();
  }

  // ---------------------------------------------------------------- views

  /** Everything one player is allowed to see. Secrets (impostor answer, question, result) never leak to others. */
  viewFor(playerId) {
    const me = this.players.get(playerId);
    const cur = this.current;
    const inRound = cur && IN_ROUND.includes(this.phase);
    const ready = this.readyPlayers();
    const car = this.mode === MODE.CAR;

    const view = {
      code: this.code,
      mode: this.mode,
      phase: this.phase,
      round: this.round,
      target: this.target,
      hostId: this.hostId,
      now: this.clock(),
      limits: { min: LIMITS.minPlayers, max: this.maxPlayers, twoImpostorsFrom: LIMITS.twoImpostorsFrom },
      timings: { roleMs: this.timings.roleMs, countdownMs: this.timings.countdownMs },
      players: ready.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        connected: car || p.connected, // (in the car everybody is on the host's phone, which is here when anybody looks)
        isHost: p.id === this.hostId,
      })),
      pending: [...this.players.values()].filter((p) => !isReady(p) && p.connected).length,
      you: {
        id: playerId,
        isHost: playerId === this.hostId,
        ready: isReady(me),
        name: me?.name ?? '',
        avatar: me?.avatar ?? null,
      },
    };

    if (inRound) {
      const q = cur.question;
      const isImpostor = cur.impostorIds.includes(playerId);
      const isAsker = cur.askerId === playerId;
      view.you.role = isImpostor ? 'impostor' : 'loyal';
      view.you.isAsker = isAsker;
      if (isImpostor) {
        view.you.secret = { index: q.correct, letter: LETTERS[q.correct], text: q.options[q.correct] };
        // with two impostors, each learns who the other is (and nobody else is told)
        if (cur.impostors.length > 1) view.you.mates = cur.impostors.filter((m) => m.id !== playerId).map((m) => ({ ...m }));
      }
      // (how many impostors there are is no secret: it follows from how many are playing. A round of two that has none says one,
      // or the phones would tell the two of them that nobody is.)
      view.turn = { number: cur.number, askerId: cur.askerId, impostors: Math.max(1, cur.impostorIds.length) };

      if (this.phase === PHASE.ROLE && !car) view.roleEndsAt = cur.roleEndsAt;
      if (car && playerId === this.hostId) {
        // The phone is the table's: it knows every player's role, and shows one only while that player holds the button.
        view.table = cur.participants.flatMap((id) => {
          const p = this.players.get(id);
          if (!p) return [];
          const impostor = cur.impostorIds.includes(id);
          const row = { id, name: p.name, avatar: p.avatar, role: impostor ? 'impostor' : 'loyal' };
          if (impostor) {
            row.secret = { index: q.correct, letter: LETTERS[q.correct], text: q.options[q.correct] };
            if (cur.impostors.length > 1) row.mates = cur.impostors.filter((m) => m.id !== id).map((m) => ({ ...m }));
          }
          return [row];
        });
        if (this.phase === PHASE.ROLE) view.seen = [...cur.seen];
      }
      if (this.phase === PHASE.QUESTION) {
        view.discussion = { endsAt: cur.discussionEndsAt };
        if (isAsker) {
          view.question = { text: q.text, options: q.options };
          view.selected = cur.selected;
        }
      }
      if (this.phase === PHASE.LOCKED) {
        // What the group locked is no secret (they have just agreed on it), so every phone can say it during the countdown.
        const picked = cur.locked.index;
        view.countdown = { endsAt: cur.locked.endsAt, chosen: { index: picked, letter: LETTERS[picked], text: q.options[picked] } };
        if (isAsker) {
          view.question = { text: q.text, options: q.options };
          view.selected = cur.locked.index;
        }
      }
      // (The verdict for the asker is not shown by the current client: the impostors say the answer out loud. It is still sent,
      // for phones that have not been updated and still show it.)
      if (this.phase === PHASE.REVEAL && isAsker) {
        view.reveal = {
          correct: cur.correct,
          chosen: cur.locked.index,
          correctIndex: q.correct,
          correctLetter: LETTERS[q.correct],
          correctText: q.options[q.correct],
          question: { text: q.text, options: q.options },
        };
      }
    }

    if (cur && (this.phase === PHASE.SUMMARY || this.phase === PHASE.FINISHED)) {
      const q = cur.question;
      const picked = cur.locked?.index;
      view.summary = {
        ...cur.summary,
        impostorId: cur.impostorId,
        impostor: cur.impostor,
        impostorIds: cur.impostorIds,
        impostors: cur.impostors,
        noImpostor: cur.impostorIds.length === 0, // (a round of two can have none)
        askerId: cur.askerId,
        // the answer key, for "Se fasit" when the group disagrees about what was said (the round is over, so it is no secret now)
        ...(cur.locked && !cur.skipped
          ? {
              answer: {
                correctIndex: q.correct,
                correctLetter: LETTERS[q.correct],
                correctText: q.options[q.correct],
                chosenIndex: picked,
                chosenLetter: LETTERS[picked],
                chosenText: q.options[picked],
              },
            }
          : {}),
      };
    }
    if (this.phase === PHASE.FINISHED) view.winners = this.winnerIds;

    return view;
  }
}
