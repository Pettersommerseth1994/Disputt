// Disputt game engine: one Room = one game. Pure state machine, no I/O.
//
// Time never comes from timers inside the room: the host process calls `tick(now)` ~10x/second and every
// handler reads the injected clock. That keeps the engine deterministic and easy to test.
//
// Round flow:  ROLE (5 s) -> QUESTION (discussion timer) -> LOCKED (5 s countdown) -> REVEAL (asker only)
//              -> SUMMARY (scores applied) -> next ROLE ...  or FINISHED when someone leads at/above the target.

import { isAvatarId } from '../shared/avatars.mjs';
import { LETTERS, QUESTIONS } from './questions.js';
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
  minPlayers: 3,
  maxPlayers: 10,
  targetMin: 1,
  targetMax: 99,
  timerMinSec: 30,
  timerMaxSec: 60 * 60,
});

export const DEFAULT_TIMINGS = Object.freeze({
  roleMs: 5000,
  countdownMs: 5000,
  discussionMs: 6 * 60_000,
  addMs: 60_000,
  hostGraceMs: 45_000,
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
  constructor({ code, rand = defaultRandom, now = Date.now, timings = {}, questions = QUESTIONS } = {}) {
    this.code = code;
    this.rand = rand;
    this.clock = now;
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.questions = questions;

    this.players = new Map();
    this.hostId = null;
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

  // ---------------------------------------------------------------- players

  addPlayer({ asHost = false } = {}) {
    const now = this.clock();
    if (!asHost) {
      if (this.phase !== PHASE.LOBBY) {
        throw new GameError('started', 'Spillet har allerede startet.', { seats: this.claimableSeats() });
      }
      if (this.players.size >= LIMITS.maxPlayers) {
        throw new GameError('full', `Rommet er fullt (maks ${LIMITS.maxPlayers} spillere).`);
      }
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
    if (asHost) this.hostId = player.id;
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

  setProfile(playerId, { name, avatar }) {
    this.needPhase(PHASE.LOBBY);
    const p = this.player(playerId);
    const clean = cleanName(name);
    if (clean.length < 1) throw new GameError('bad_name', 'Skriv inn et navn.');
    if (!isAvatarId(avatar)) throw new GameError('bad_avatar', 'Velg en avatar.');
    const others = [...this.players.values()].filter((o) => o.id !== playerId && isReady(o));
    if (others.some((o) => o.name.toLowerCase() === clean.toLowerCase())) {
      throw new GameError('name_taken', 'Det navnet er tatt – velg et annet.');
    }
    if (others.some((o) => o.avatar === avatar)) {
      throw new GameError('avatar_taken', 'Den avataren er tatt – velg en annen.');
    }
    p.name = clean;
    p.avatar = avatar;
    this.touch();
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
    const inCurrentRound = cur && IN_ROUND.includes(this.phase) && (cur.impostorId === targetId || cur.askerId === targetId);
    this.removePlayer(targetId, 'kicked');
    if (inCurrentRound) this.finishRoundWithoutPoints();
  }

  leave(playerId) {
    this.needPhase(PHASE.LOBBY);
    this.player(playerId);
    this.removePlayer(playerId, 'left');
  }

  /** The room is abandoned when nobody is connected. */
  get empty() {
    return ![...this.players.values()].some((p) => p.connected);
  }

  migrateHost() {
    const next = this.connectedReadyPlayers().find((p) => p.id !== this.hostId) ?? this.connectedReadyPlayers()[0];
    this.hostId = next ? next.id : null;
    this.hostAwaySince = null;
  }

  // ---------------------------------------------------------------- settings

  setTarget(playerId, value) {
    this.needHost(playerId);
    if (![PHASE.LOBBY, PHASE.SUMMARY].includes(this.phase)) {
      throw new GameError('bad_phase', 'Poengmålet kan bare endres i lobbyen og mellom rundene.');
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < LIMITS.targetMin || n > LIMITS.targetMax) {
      throw new GameError('bad_value', `Velg et tall mellom ${LIMITS.targetMin} og ${LIMITS.targetMax}.`);
    }
    this.target = n;
    if (this.phase === PHASE.SUMMARY) this.finishIfDecided();
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

  /** Advances time-driven phases. Returns true when something changed. */
  tick(now = this.clock()) {
    let changed = false;
    const cur = this.current;

    if (this.phase === PHASE.ROLE && now >= cur.roleEndsAt) {
      this.phase = PHASE.QUESTION;
      cur.discussionEndsAt = now + this.timings.discussionMs;
      changed = true;
    } else if (this.phase === PHASE.LOCKED && now >= cur.locked.endsAt) {
      this.phase = PHASE.REVEAL;
      changed = true;
    }

    // Host went away for good: hand the controls to someone who is still here.
    const host = this.players.get(this.hostId);
    if (!host || !host.connected) {
      this.hostAwaySince ??= now;
      if (now - this.hostAwaySince >= this.timings.hostGraceMs) {
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
        if (!isReady(p) && !p.connected && p.id !== this.hostId && now - p.lastSeen > this.timings.placeholderMs) {
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
    const pool = this.connectedReadyPlayers();
    const now = this.clock();
    const impostor = pool[this.rand.int(pool.length)];
    const asker = pool[this.rand.int(pool.length)]; // may be the impostor too
    this.current = {
      number: ++this.round,
      impostorId: impostor.id,
      askerId: asker.id,
      question: this.nextQuestion(),
      roleEndsAt: now + this.timings.roleMs,
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
      for (const p of this.players.values()) {
        if (isReady(p) && p.id !== cur.impostorId) {
          p.score += 1;
          gained[p.id] = 1;
        }
      }
    } else {
      const impostor = this.players.get(cur.impostorId);
      if (impostor) {
        impostor.score += 1;
        gained[impostor.id] = 1;
      }
    }
    cur.summary = { round: cur.number, correct: cur.correct, skipped: false, gained, tiebreak: false };
    this.history.push({ round: cur.number, impostorId: cur.impostorId, askerId: cur.askerId, correct: cur.correct });
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
    const missing = this.readyPlayers().filter((p) => !p.connected);
    if (this.connectedReadyPlayers().length < LIMITS.minPlayers) {
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

    const view = {
      code: this.code,
      phase: this.phase,
      round: this.round,
      target: this.target,
      hostId: this.hostId,
      now: this.clock(),
      limits: { min: LIMITS.minPlayers, max: LIMITS.maxPlayers },
      timings: { roleMs: this.timings.roleMs, countdownMs: this.timings.countdownMs },
      players: ready.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        connected: p.connected,
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
      const isImpostor = cur.impostorId === playerId;
      const isAsker = cur.askerId === playerId;
      view.you.role = isImpostor ? 'impostor' : 'loyal';
      view.you.isAsker = isAsker;
      if (isImpostor) {
        view.you.secret = { index: q.correct, letter: LETTERS[q.correct], text: q.options[q.correct] };
      }
      view.turn = { number: cur.number, askerId: cur.askerId };

      if (this.phase === PHASE.ROLE) view.roleEndsAt = cur.roleEndsAt;
      if (this.phase === PHASE.QUESTION) {
        view.discussion = { endsAt: cur.discussionEndsAt };
        if (isAsker) {
          view.question = { text: q.text, options: q.options };
          view.selected = cur.selected;
        }
      }
      if (this.phase === PHASE.LOCKED) {
        view.countdown = { endsAt: cur.locked.endsAt };
        if (isAsker) {
          view.question = { text: q.text, options: q.options };
          view.selected = cur.locked.index;
        }
      }
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
      view.summary = {
        ...cur.summary,
        impostorId: cur.impostorId,
        askerId: cur.askerId,
      };
    }
    if (this.phase === PHASE.FINISHED) view.winners = this.winnerIds;

    return view;
  }
}
