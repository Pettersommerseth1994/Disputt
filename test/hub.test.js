// Hub-level behaviour that needs no real sockets: cleanup of old/abandoned rooms and the capacity guard.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AVATAR_IDS } from '../shared/avatars.mjs';
import { Hub } from '../shared/hub.js';

const fakeSocket = () => ({ readyState: 1, sent: [], closed: null, send(m) { this.sent.push(JSON.parse(m)); }, close(code, reason) { this.closed = { code, reason }; } });

function setup() {
  let t = 1_000_000;
  const hub = new Hub({ now: () => t });
  const advance = (ms) => (t += ms);
  const join = (conn, msg) => hub.handle(conn, msg);
  return { hub, advance, join };
}

describe('hub cleanup', () => {
  it('drops rooms after six hours and tells the players', () => {
    const { hub, advance, join } = setup();
    const ws = fakeSocket();
    const conn = { ws, code: null, playerId: null };
    join(conn, { t: 'create' });
    assert.equal(hub.rooms.size, 1);
    advance(5 * 60 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.size, 1, 'still alive after five hours');
    advance(61 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.size, 0);
    assert.deepEqual(ws.sent.at(-1), { t: 'closed', reason: 'expired' });
    assert.equal(ws.closed.reason, 'expired');
  });

  it('drops a lobby that nobody is in after five minutes', () => {
    const { hub, advance, join } = setup();
    const conn = { ws: fakeSocket(), code: null, playerId: null };
    join(conn, { t: 'create' });
    hub.close(conn); // the host's phone disconnects before anyone joined
    advance(4 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.size, 1);
    advance(2 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.size, 0);
  });

  it('keeps a started game for thirty minutes after everybody disconnected (phones come back)', () => {
    const { hub, advance, join } = setup();
    const conns = [0, 1, 2].map(() => ({ ws: fakeSocket(), code: null, playerId: null }));
    join(conns[0], { t: 'create' });
    const code = conns[0].code;
    join(conns[0], { t: 'profile', name: 'A', avatar: 'lime' });
    for (const [i, c] of conns.slice(1).entries()) {
      join(c, { t: 'join', code });
      join(c, { t: 'profile', name: `B${i}`, avatar: ['mandarin', 'blabaer'][i] });
    }
    join(conns[0], { t: 'start' });
    assert.equal(hub.rooms.get(code).room.phase, 'role');
    for (const c of conns) hub.close(c);
    advance(29 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.size, 1);
    advance(2 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.size, 0);
  });

  it('answers a stale tap with a fresh state instead of an error toast', () => {
    const { hub, join } = setup();
    const conns = [0, 1, 2].map(() => ({ ws: fakeSocket(), code: null, playerId: null }));
    join(conns[0], { t: 'create' });
    const code = conns[0].code;
    join(conns[0], { t: 'profile', name: 'A', avatar: 'lime' });
    for (const [i, c] of conns.slice(1).entries()) {
      join(c, { t: 'join', code });
      join(c, { t: 'profile', name: `B${i}`, avatar: ['mandarin', 'blabaer'][i] });
    }
    join(conns[0], { t: 'start' });
    const before = conns[0].ws.sent.length;
    join(conns[0], { t: 'start' }); // double tap: the game is already running
    const after = conns[0].ws.sent.slice(before);
    assert.equal(after.some((m) => m.t === 'error'), false, 'no error toast');
    assert.equal(after.at(-1).t, 'state');
    assert.equal(after.at(-1).view.phase, 'role');
  });

  it('limits how many rooms one connection can open, and frees an empty lobby it leaves behind', () => {
    const { hub, join } = setup();
    const ws = fakeSocket();
    const conn = { ws, code: null, playerId: null };
    for (let i = 0; i < 3; i++) join(conn, { t: 'create' });
    assert.equal(hub.rooms.size, 1, 'each abandoned empty lobby is dropped right away');
    join(conn, { t: 'create' });
    assert.equal(ws.sent.at(-1).code, 'busy');
    assert.equal(hub.rooms.size, 1);
  });

  it('keeps a room alive while somebody is connected', () => {
    const { hub, advance, join } = setup();
    const conn = { ws: fakeSocket(), code: null, playerId: null };
    join(conn, { t: 'create' });
    advance(3 * 60 * 60 * 1000);
    hub.sweep();
    assert.equal(hub.rooms.size, 1);
  });

  it('refuses new rooms when the server is full', () => {
    const { hub, join } = setup();
    for (let i = 0; i < 500; i++) join({ ws: fakeSocket(), code: null, playerId: null }, { t: 'create' });
    const ws = fakeSocket();
    join({ ws, code: null, playerId: null }, { t: 'create' });
    assert.equal(ws.sent.at(-1).code, 'busy');
    assert.equal(hub.rooms.size, 500);
  });

  it('ignores malformed messages without crashing', () => {
    const { hub, join } = setup();
    const ws = fakeSocket();
    const conn = { ws, code: null, playerId: null };
    // (Hub.handle catches everything itself, so "does not throw" proves nothing: what matters is that no message made
    // the hub fail internally, which it reports to the sender as code "server".)
    const noInternalError = () => assert.ok(ws.sent.every((m) => m.code !== 'server'), `an internal error was reported: ${JSON.stringify(ws.sent.filter((m) => m.code === 'server'))}`);
    for (const bad of [null, undefined, 42, 'x', [], {}, { t: 7 }, { t: '__proto__' }, { t: 'join' }, { t: 'join', code: { toString: 1 } }, { t: 'resume', code: 'ABCD' }]) {
      join(conn, bad);
      noInternalError();
    }
    join(conn, { t: 'create' });
    for (const bad of [{ t: 'profile', name: { a: 1 }, avatar: 5 }, { t: 'target', value: {} }, { t: 'select', index: 'x' }, { t: 'lock', index: NaN }, { t: 'kick' }, { t: 'timer.set', seconds: 'a' }]) {
      join(conn, bad);
      noInternalError();
    }
    assert.equal(hub.rooms.size, 1);
  });
});

describe('hub: caller-chosen codes, export/import, change hook (peer-to-peer host)', () => {
  it('creates a room with the code the caller reserved, and refuses duplicates and bad codes', () => {
    const { hub, join } = setup();
    const a = { ws: fakeSocket(), code: null, playerId: null };
    hub.createWithCode(a, 'KRAP');
    assert.equal(a.code, 'KRAP');
    assert.equal(a.ws.sent[0].t, 'welcome');
    assert.equal(a.ws.sent[0].code, 'KRAP');
    const b = { ws: fakeSocket(), code: null, playerId: null };
    assert.throws(() => hub.createWithCode(b, 'KRAP'), /opptatt/);
    assert.throws(() => hub.createWithCode(b, 'krap'), /opptatt/);
    assert.throws(() => hub.createWithCode(b, 'TOOLONG'), /opptatt/);
    join(b, { t: 'join', code: 'krap' }); // players can still join it (codes are case-insensitive)
    assert.equal(b.ws.sent.at(-1).t, 'welcome');
  });

  it('exports a room and imports it into a fresh hub where players resume with their tokens', () => {
    const first = setup();
    const host = { ws: fakeSocket(), code: null, playerId: null };
    first.hub.createWithCode(host, 'ZXWQ');
    first.join(host, { t: 'profile', name: 'Vert', avatar: 'lime' });
    const guest = { ws: fakeSocket(), code: null, playerId: null };
    first.join(guest, { t: 'join', code: 'ZXWQ' });
    first.join(guest, { t: 'profile', name: 'Gjest', avatar: 'sol' });
    const welcome = host.ws.sent[0];
    const snapshot = JSON.parse(JSON.stringify(first.hub.exportRoom('ZXWQ')));

    const second = setup();
    assert.equal(second.hub.importRoom(snapshot), 'ZXWQ');
    const back = { ws: fakeSocket(), code: null, playerId: null };
    second.join(back, { t: 'resume', code: 'ZXWQ', playerId: welcome.playerId, token: welcome.token });
    const again = back.ws.sent.at(-1);
    assert.equal(again.t, 'welcome');
    assert.equal(again.view.you.name, 'Vert');
    assert.equal(again.view.players.length, 2);
    assert.equal(first.hub.exportRoom('NOPE'), null);
  });

  it('calls the change hook after state changes, so a host can persist them', () => {
    const { hub, join } = setup();
    let calls = 0;
    hub.onChange = () => calls++;
    const conn = { ws: fakeSocket(), code: null, playerId: null };
    hub.createWithCode(conn, 'ABCD');
    const afterCreate = calls;
    assert.ok(afterCreate > 0);
    join(conn, { t: 'profile', name: 'A', avatar: 'lime' });
    assert.ok(calls > afterCreate);
  });
});

describe('hub: one connection speaks for one player', () => {
  const newConn = () => ({ ws: fakeSocket(), code: null, playerId: null });
  const welcomeOf = (conn) => conn.ws.sent.filter((m) => m.t === 'welcome').at(-1);

  function lobbyOf(n) {
    const { hub, join } = setup();
    const conns = Array.from({ length: n }, newConn);
    join(conns[0], { t: 'create' });
    const code = conns[0].code;
    join(conns[0], { t: 'profile', name: 'Vert', avatar: AVATAR_IDS[0] });
    for (const [i, c] of conns.slice(1).entries()) {
      join(c, { t: 'join', code });
      join(c, { t: 'profile', name: `Spiller${i + 1}`, avatar: AVATAR_IDS[i + 1] });
    }
    const room = hub.rooms.get(code).room;
    assert.equal(room.readyPlayers().length, n, 'everybody has a name and an avatar');
    return { hub, join, conns, code, room };
  }

  it('answers a second "join" on the same connection with the same seat, not a new placeholder', () => {
    const { hub, join } = setup();
    const host = newConn();
    join(host, { t: 'create' });
    const code = host.code;
    const guest = newConn();
    join(guest, { t: 'join', code });
    const first = welcomeOf(guest);
    join(guest, { t: 'join', code });
    join(guest, { t: 'join', code });
    const again = welcomeOf(guest);
    assert.equal(hub.rooms.get(code).room.players.size, 2, 'the host and one guest, nobody else');
    assert.equal(again.playerId, first.playerId);
    assert.equal(again.token, first.token);
  });

  it('keeps a sleeper\'s placeholder for them: one newcomer does not take it over', () => {
    const { hub, join } = setup();
    const host = newConn();
    join(host, { t: 'create' });
    const code = host.code;
    const sleeper = newConn();
    join(sleeper, { t: 'join', code });
    const mine = welcomeOf(sleeper);
    hub.close(sleeper); // the screen locked on the profile page
    const newcomer = newConn();
    join(newcomer, { t: 'join', code });
    assert.notEqual(welcomeOf(newcomer).playerId, mine.playerId, 'the newcomer got a placeholder of their own');
    const back = newConn();
    join(back, { t: 'resume', code, playerId: mine.playerId, token: mine.token });
    assert.equal(back.ws.sent.at(-1).t, 'welcome', 'and the sleeper can still come back');
  });

  it('retries cannot fill the lobby with ghosts: beyond a couple, a newcomer takes over the one gone longest', () => {
    const { hub, join, advance } = setup();
    const host = newConn();
    join(host, { t: 'create' });
    const code = host.code;
    const room = hub.rooms.get(code).room;
    const first = newConn();
    join(first, { t: 'join', code });
    const firstSeat = welcomeOf(first);
    hub.close(first);
    for (let i = 0; i < 12; i++) {
      advance(500);
      const flaky = newConn(); // joins, then the line dies before anything else happens
      join(flaky, { t: 'join', code });
      hub.close(flaky);
    }
    assert.ok(room.players.size <= 3, `the host and at most two leftovers, not a lobby full of ghosts (${room.players.size} players)`);
    const honest = newConn();
    join(honest, { t: 'join', code });
    assert.equal(welcomeOf(honest).t, 'welcome', 'a real guest still gets in');
    const gone = newConn();
    join(gone, { t: 'resume', code, playerId: firstSeat.playerId, token: firstSeat.token });
    assert.equal(gone.ws.sent.at(-1).code, 'bad_token', 'the placeholder that had been gone longest was handed on');
  });

  it('a room that is full only because of ghosts still has room for a real guest', () => {
    const { hub, join, conns, code, room } = lobbyOf(8); // eight real players …
    const ghosts = [newConn(), newConn()];
    for (const g of ghosts) {
      join(g, { t: 'join', code });
      hub.close(g);
    }
    assert.equal(room.players.size, 10, '… and two ghosts make ten');
    const guest = newConn();
    join(guest, { t: 'join', code });
    assert.equal(welcomeOf(guest).t, 'welcome', 'the guest got in by taking over a ghost');
    assert.equal(room.players.size, 10);
    assert.equal(conns.length, 8);
  });

  it('never hands a registered (named) seat to a newcomer as a placeholder', () => {
    const { hub, join, conns, code, room } = lobbyOf(3);
    hub.close(conns[1]); // a real player's phone drops
    const newcomer = newConn();
    join(newcomer, { t: 'join', code });
    const ids = [...room.players.keys()];
    assert.equal(ids.length, 4, 'the newcomer got a seat of their own');
    assert.equal(room.players.get(conns[1].playerId ?? ids[1])?.name, 'Spiller1', 'the dropped player keeps their seat');
  });

  it('a connection that claims another seat lets go of its own', () => {
    const { hub, join, conns, code, room } = lobbyOf(3);
    const [, b, c] = conns;
    const bId = b.playerId;
    const cId = c.playerId;
    hub.close(b); // B's phone drops: the seat can be claimed
    assert.equal(room.players.get(bId).connected, false);
    join(c, { t: 'claim', code, playerId: bId });
    assert.equal(room.players.get(bId).connected, true, 'C now speaks for B');
    assert.equal(room.players.get(cId).connected, false, 'and no longer holds their old seat');
    assert.equal(c.playerId, bId);
    assert.equal(hub.rooms.get(code).sockets.has(cId), false);
  });

  it('tells everybody else when a seat is taken over by a new phone, but not the phone that took it', () => {
    const { hub, join, conns, code, room } = lobbyOf(3);
    const [host, b, c] = conns;
    const bId = b.playerId;
    hub.close(b);
    const newPhone = newConn();
    join(newPhone, { t: 'claim', code, playerId: bId });
    assert.equal(room.players.get(bId).connected, true);
    const notices = (conn) => conn.ws.sent.filter((m) => m.t === 'notice');
    assert.equal(notices(host).length, 1);
    assert.match(notices(host)[0].text, /Plassen til Spiller1 ble tatt over av en ny telefon/);
    assert.equal(notices(c).length, 1);
    assert.equal(notices(newPhone).length, 0);
  });

  it('keeps the room when a connection moves between seats of a nearly empty lobby', () => {
    const { hub, join } = setup();
    const a = newConn();
    join(a, { t: 'create' });
    const code = a.code;
    join(a, { t: 'profile', name: 'Vert', avatar: 'lime' });
    const b = newConn();
    join(b, { t: 'join', code });
    join(b, { t: 'profile', name: 'Ola', avatar: 'mandarin' });
    const c = newConn();
    join(c, { t: 'join', code }); // an unnamed placeholder, the only one connected after the others drop
    hub.close(a);
    hub.close(b);
    join(c, { t: 'claim', code, playerId: b.playerId });
    assert.ok(hub.rooms.has(code), 'the room is still there');
    assert.equal(hub.rooms.get(code).room.players.get(b.playerId).connected, true);
  });
});

describe('two impostors over the wire', () => {
  it('sends the name of the other impostor to the impostors and to nobody else', () => {
    const { hub, join } = setup();
    const conns = Array.from({ length: 6 }, () => ({ ws: fakeSocket(), code: null, playerId: null }));
    join(conns[0], { t: 'create' });
    const code = conns[0].code;
    join(conns[0], { t: 'profile', name: 'Vert', avatar: AVATAR_IDS[0] });
    for (const [i, c] of conns.slice(1).entries()) {
      join(c, { t: 'join', code });
      join(c, { t: 'profile', name: `Gjest${i + 1}`, avatar: AVATAR_IDS[i + 1] });
    }
    join(conns[0], { t: 'start' });

    const lastView = (c) => c.ws.sent.filter((m) => m.t === 'state').at(-1).view;
    const impostors = conns.filter((c) => lastView(c).you.role === 'impostor');
    assert.equal(impostors.length, 2, 'six players: two impostors');
    for (const c of conns) {
      const v = lastView(c);
      if (impostors.includes(c)) {
        const other = impostors.find((o) => o !== c);
        assert.deepEqual(v.you.mates.map((m) => m.id), [other.playerId], 'an impostor is told who the other one is');
      } else {
        assert.equal(JSON.stringify(v).includes('mates'), false, 'a loyal player is told nothing about the impostors');
      }
    }
  });
});
