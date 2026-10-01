import { randomBytes, randomInt } from 'node:crypto';

/** Default randomness source. Tests inject their own with the same shape. */
export const defaultRandom = { int: (n) => randomInt(n) };

export const makeToken = () => randomBytes(16).toString('hex');
export const makeId = () => randomBytes(5).toString('hex');

/** Fisher–Yates, returns a new array. */
export function shuffle(items, rand = defaultRandom) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const NAME_MAX = 14;

/**
 * Strips control characters, zero-width and bidi-override characters (but keeps the zero-width joiner that
 * emoji sequences need), collapses whitespace and caps the name at NAME_MAX characters.
 */
export function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  const s = raw
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\p{Cf}/gu, (c) => (c === String.fromCodePoint(0x200d) ? c : ''))
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(s).slice(0, NAME_MAX).join('').trim();
}

// No I, L or O: easy to confuse when typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const BLOCKED = /FUCK|SHIT|CUNT|NAZI|RAPE|PORN|SEXY|SLUT|TITS|DICK|COCK|ANAL|PISS|FAGS|HOMO|NEGR|JEWS|HATE|KILL|DEAD|PUSS|BUTT|CRAP|DAMN|HORE|SKIT|JAVL|KUKK|PIKK|FITT|LORT|DRIT|FAEN/;

export function makeRoomCode(rand = defaultRandom, taken = () => false) {
  for (let attempt = 0; attempt < 200; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[rand.int(CODE_ALPHABET.length)];
    if (!BLOCKED.test(code) && !taken(code)) return code;
  }
  throw new Error('Could not allocate a room code');
}

export const normalizeCode = (raw) =>
  typeof raw === 'string' ? raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) : '';
