// The host's room, saved in sessionStorage so a reload (or a browser that throws the tab away) does not end the game.
// Kept separate from host.js so guests never download the game engine just to check whether they were hosting.

const KEY = 'disputt:hostroom';

export function saveHostSnapshot(code, room) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ v: 1, code, savedAt: Date.now(), room }));
  } catch {
    /* storage full or blocked: the game still works, it just cannot survive a reload */
  }
}

/** The saved room for `code`, or null. */
export function loadHostSnapshot(code) {
  try {
    const data = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    return data && data.v === 1 && data.code === code && data.room ? data : null;
  } catch {
    return null;
  }
}

export function clearHostSnapshot() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
