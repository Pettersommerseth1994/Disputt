import { useEffect, useState } from './vendor/htm-preact.js';
import { serverNow } from './net.js';

export const cx = (...parts) => parts.filter(Boolean).join(' ');
export const LETTERS = ['A', 'B', 'C', 'D'];
export const letter = (i) => LETTERS[i];

const pad = (n) => String(n).padStart(2, '0');

/** mm:ss, rounded up so the display hits 00:00 exactly when time is out. */
export function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export const vibrate = (pattern) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
};

/** Milliseconds left until a server timestamp; re-renders `fps` times a second while it is running. */
export function useRemaining(endsAt, fps = 5) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!endsAt) return undefined;
    const id = setInterval(() => tick((n) => n + 1), Math.round(1000 / fps));
    return () => clearInterval(id);
  }, [endsAt, fps]);
  return endsAt ? endsAt - serverNow() : 0;
}

export const plural = (n, one, many) => (n === 1 ? one : many);

export function playerById(view, id) {
  return view?.players.find((p) => p.id === id) ?? null;
}

/** Players sorted by score (desc), then name. Ties share a rank. */
export function ranking(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'nb'));
  let rank = 0;
  let prev = null;
  return sorted.map((p, i) => {
    if (p.score !== prev) rank = i + 1;
    prev = p.score;
    return { ...p, rank };
  });
}
