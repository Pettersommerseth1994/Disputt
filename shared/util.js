// Helpers shared by the Node server and the browser (the peer-to-peer host runs this same engine in the page).

const webCrypto = globalThis.crypto;

/** Uniform integer in [0, n), by rejection sampling over 32 random bits (no modulo bias). */
function randomInt(n) {
  if (!Number.isInteger(n) || n <= 0 || n > 2 ** 32) throw new RangeError('randomInt: n out of range');
  const limit = Math.floor(2 ** 32 / n) * n;
  const buf = new Uint32Array(1);
  let x;
  do {
    webCrypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % n;
}

/** Default randomness source. Tests inject their own with the same shape. */
export const defaultRandom = { int: randomInt };

const randomHex = (bytes) => Array.from(webCrypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
export const makeToken = () => randomHex(16);
export const makeId = () => randomHex(5);

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
 * emoji sequences need), collapses whitespace and caps the name at NAME_MAX characters. A name with nothing visible
 * in it comes back empty.
 */
export function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  const s = raw
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\p{Cf}/gu, (c) => (c === String.fromCodePoint(0x200d) ? c : ''))
    .replace(/\s+/g, ' ')
    .trim();
  const name = Array.from(s).slice(0, NAME_MAX).join('').trim();
  // Hangul fillers, the blank braille cell and the like are letters or symbols to Unicode but draw nothing: a name made
  // only of those would show up as an empty seat nobody can tell from another.
  return name.replace(/[\p{Default_Ignorable_Code_Point}\p{Z}\u2800]/gu, '') === '' ? '' : name;
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
