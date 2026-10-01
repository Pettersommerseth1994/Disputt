// Connects rooms to WebSockets: message routing, identity (resume/claim), broadcasting and cleanup.

import { GameError, PHASE, Room } from './game.js';
import { defaultRandom, makeRoomCode, normalizeCode } from './util.js';

const MAX_ROOMS = 500;
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const ABANDONED_TTL_MS = 30 * 60 * 1000;
const EMPTY_LOBBY_TTL_MS = 5 * 60 * 1000; // a lobby nobody is in and nobody has joined is not worth keeping
const MAX_ROOMS_PER_SOCKET = 3;

const send = (ws, msg) => {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
};

export class Hub {
  constructor({ rand = defaultRandom, now = Date.now, timings = {}, questions } = {}) {
    this.rand = rand;
    this.clock = now;
    this.timings = timings;
    this.questions = questions;
    this.rooms = new Map(); // code -> { room, sockets: Map<playerId, ws> }
  }

  // ---------------------------------------------------------------- transport entry points

  /** Called for every parsed JSON message. `conn` is per-socket mutable state: { ws, code, playerId }. */
  handle(conn, msg) {
    try {
      if (!msg || typeof msg.t !== 'string') return;
      switch (msg.t) {
        case 'ping':
          return send(conn.ws, { t: 'pong', c: msg.c, s: this.clock() });
        case 'create':
          return this.create(conn);
        case 'join':
          return this.join(conn, msg);
        case 'resume':
          return this.resume(conn, msg);
        case 'claim':
          return this.claim(conn, msg);
        default:
          return this.game(conn, msg);
      }
    } catch (err) {
      if (err instanceof GameError) {
        // A tap on a screen that is already out of date (double tap, slow network): not the player's fault.
        // Say nothing, just bring their screen up to date.
        if (err.code === 'bad_phase' && this.resync(conn)) return;
        send(conn.ws, { t: 'error', code: err.code, message: err.message, ...err.extra });
      } else {
        console.error('[hub] unexpected error', err);
        send(conn.ws, { t: 'error', code: 'server', message: 'Noe gikk galt på serveren.' });
      }
    }
  }

  close(conn) {
    const entry = this.rooms.get(conn.code);
    if (!entry || !conn.playerId) return;
    if (entry.sockets.get(conn.playerId) === conn.ws) {
      entry.sockets.delete(conn.playerId);
      entry.room.disconnect(conn.playerId);
      this.broadcast(entry);
    }
  }

  /** Drives time-based phases; call ~10x/second. */
  tick() {
    const now = this.clock();
    for (const entry of this.rooms.values()) {
      try {
        if (entry.room.tick(now)) this.afterChange(entry);
      } catch (err) {
        console.error(`[hub] tick failed for room ${entry.room.code}`, err);
      }
    }
  }

  /** Sends one player their current view (used when their screen is stale). */
  resync(conn) {
    const entry = this.rooms.get(conn.code);
    if (!entry || !conn.playerId || !entry.room.players.has(conn.playerId)) return false;
    send(conn.ws, { t: 'state', view: entry.room.viewFor(conn.playerId) });
    return true;
  }

  /** Drops finished or abandoned rooms. */
  sweep() {
    const now = this.clock();
    for (const [code, entry] of this.rooms) {
      const age = now - entry.room.lastActivity;
      const sparseLobby = entry.room.phase === PHASE.LOBBY && entry.room.readyPlayers().length < 2;
      const abandonedFor = sparseLobby ? EMPTY_LOBBY_TTL_MS : ABANDONED_TTL_MS;
      if (age > ROOM_TTL_MS || (entry.room.empty && age > abandonedFor)) {
        for (const ws of entry.sockets.values()) {
          send(ws, { t: 'closed', reason: 'expired' });
          ws.close(1000, 'expired');
        }
        this.rooms.delete(code);
      }
    }
  }

  // ---------------------------------------------------------------- identity

  create(conn) {
    if ((conn.created ?? 0) >= MAX_ROOMS_PER_SOCKET) {
      throw new GameError('busy', 'Du har startet for mange spill på rad. Last inn siden på nytt.');
    }
    if (this.rooms.size >= MAX_ROOMS) throw new GameError('busy', 'Serveren er full akkurat nå. Prøv igjen om litt.');
    this.leaveCurrent(conn);
    conn.created = (conn.created ?? 0) + 1;
    const code = makeRoomCode(this.rand, (c) => this.rooms.has(c));
    const room = new Room({ code, rand: this.rand, now: this.clock, timings: this.timings, questions: this.questions });
    const entry = { room, sockets: new Map() };
    this.rooms.set(code, entry);
    const player = room.addPlayer({ asHost: true });
    this.attach(entry, conn, player);
  }

  join(conn, msg) {
    const entry = this.find(msg.code);
    this.leaveCurrent(conn);
    const player = entry.room.addPlayer();
    this.attach(entry, conn, player);
  }

  resume(conn, msg) {
    const entry = this.find(msg.code);
    const player = entry.room.authenticate(msg.playerId, msg.token);
    this.attach(entry, conn, player);
  }

  claim(conn, msg) {
    const entry = this.find(msg.code);
    const player = entry.room.claimSeat(msg.playerId);
    this.attach(entry, conn, player);
  }

  find(rawCode) {
    const entry = this.rooms.get(normalizeCode(rawCode));
    if (!entry) throw new GameError('room_not_found', 'Fant ikke dette spillet. Sjekk koden og prøv igjen.');
    return entry;
  }

  attach(entry, conn, player) {
    const { room, sockets } = entry;
    const previous = sockets.get(player.id);
    if (previous && previous !== conn.ws) {
      send(previous, { t: 'closed', reason: 'replaced' });
      previous.close(4000, 'replaced');
    }
    sockets.set(player.id, conn.ws);
    conn.code = room.code;
    conn.playerId = player.id;
    room.connect(player.id);
    send(conn.ws, { t: 'welcome', code: room.code, playerId: player.id, token: player.token, view: room.viewFor(player.id) });
    this.broadcast(entry, { except: player.id });
  }

  /** A connection that creates/joins a different room first lets go of the one it had. */
  leaveCurrent(conn) {
    const oldCode = conn.code;
    if (oldCode) this.close(conn);
    conn.code = null;
    conn.playerId = null;
    // A lobby that has just lost its only visitor is dropped at once instead of lingering for half an hour.
    const old = oldCode && this.rooms.get(oldCode);
    if (old && old.room.empty && old.room.phase === PHASE.LOBBY && old.room.readyPlayers().length < 2) this.rooms.delete(oldCode);
  }

  // ---------------------------------------------------------------- game messages

  game(conn, msg) {
    const entry = this.rooms.get(conn.code);
    if (!entry || !conn.playerId) throw new GameError('no_session', 'Du er ikke med i noe spill.');
    const { room } = entry;
    const pid = conn.playerId;
    switch (msg.t) {
      case 'profile':
        room.setProfile(pid, { name: msg.name, avatar: msg.avatar });
        break;
      case 'target':
        room.setTarget(pid, msg.value);
        break;
      case 'start':
        room.start(pid);
        break;
      case 'select':
        room.select(pid, msg.index ?? null);
        break;
      case 'timer.set':
        room.setTimer(pid, msg.seconds);
        break;
      case 'timer.add':
        room.addTime(pid, msg.seconds);
        break;
      case 'lock':
        room.lock(pid, msg.index);
        break;
      case 'continue':
        room.continueRound(pid);
        break;
      case 'next':
        room.nextRound(pid);
        break;
      case 'skip':
        room.skipRound(pid);
        break;
      case 'end':
        room.endGame(pid);
        break;
      case 'again':
        room.playAgain(pid);
        break;
      case 'kick':
        room.kick(pid, msg.id);
        break;
      case 'leave':
        room.leave(pid);
        break;
      default:
        throw new GameError('bad_message', 'Ukjent melding.');
    }
    this.afterChange(entry);
  }

  // ---------------------------------------------------------------- broadcasting

  afterChange(entry) {
    for (const { id, reason } of entry.room.drainRemoved()) {
      const ws = entry.sockets.get(id);
      if (ws) {
        send(ws, { t: 'removed', reason });
        entry.sockets.delete(id);
      }
    }
    this.broadcast(entry);
  }

  broadcast(entry, { except } = {}) {
    for (const [pid, ws] of entry.sockets) {
      if (pid === except) continue;
      send(ws, { t: 'state', view: entry.room.viewFor(pid) });
    }
  }

  get stats() {
    let players = 0;
    for (const { room } of this.rooms.values()) players += room.players.size;
    return { rooms: this.rooms.size, players };
  }
}
