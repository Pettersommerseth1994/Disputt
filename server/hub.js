// Connects rooms to WebSockets: message routing, identity (resume/claim), broadcasting and cleanup.

import { GameError, Room } from './game.js';
import { defaultRandom, makeRoomCode, normalizeCode } from './util.js';

const MAX_ROOMS = 500;
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const ABANDONED_TTL_MS = 30 * 60 * 1000;

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
      if (entry.room.tick(now)) this.afterChange(entry);
    }
  }

  /** Drops finished or abandoned rooms. */
  sweep() {
    const now = this.clock();
    for (const [code, entry] of this.rooms) {
      const age = now - entry.room.lastActivity;
      if (age > ROOM_TTL_MS || (entry.room.empty && age > ABANDONED_TTL_MS)) {
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
    if (this.rooms.size >= MAX_ROOMS) throw new GameError('busy', 'Serveren er full akkurat nå. Prøv igjen om litt.');
    this.leaveCurrent(conn);
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
    if (conn.code) this.close(conn);
    conn.code = null;
    conn.playerId = null;
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
