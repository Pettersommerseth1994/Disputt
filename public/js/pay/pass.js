// The access pass: what a paying host carries on their phone. No accounts: a pass is a small signed receipt that the payment
// server hands out after a purchase, and that this page checks with the server's public key.
//
// It is a JWT signed with ES256 (ECDSA, P-256), which every browser's built-in crypto can check:
//   header   {"alg":"ES256","typ":"JWT"}
//   payload  {"iss":"disputt","aud":<the payment server's address>,"plan":"evening"|"year"|"lifetime","pa":<paid at, s>,"iat":<issued at, s>,
//            "exp":<end, s; none for lifetime>}
// `aud` ties a pass to the payment server that made it, so that a pass from a test server is no use on the live page, even if the
// two were given the same key.
//
// This file has no dependencies on the page, so the tests run it in Node too. (A file of its own: pages are cached for ten
// minutes, and a module that imports something an older cached copy of another module does not have would not load.)

export const PLAN_IDS = ['evening', 'year', 'lifetime'];

const te = new TextEncoder();
const td = new TextDecoder();

export function b64urlToBytes(text) {
  const b64 = String(text).replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function bytesToB64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The server's public key as the page gets it: standard base64 of the DER "SubjectPublicKeyInfo" of a P-256 key. */
const importKey = (publicKeyB64) =>
  crypto.subtle.importKey('spki', Uint8Array.from(atob(publicKeyB64), (c) => c.charCodeAt(0)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);

/**
 * Checks a pass. Resolves to { ok: true, pass } or { ok: false, reason } with reason one of
 * 'format' | 'key' | 'signature' | 'plan' | 'audience' | 'expired'. Never throws.
 * pass = { plan, paidAt, issuedAt, expiresAt }   (milliseconds; expiresAt is null for a lifetime pass)
 * `audience`: the payment server the page is set up with; a pass made for another one (or for none) is refused. Leave it out (null) to
 * skip the check.
 */
export async function verifyPass(token, publicKeyB64, now = Date.now(), audience = null) {
  try {
    const parts = typeof token === 'string' ? token.split('.') : [];
    if (parts.length !== 3) return { ok: false, reason: 'format' };
    const header = JSON.parse(td.decode(b64urlToBytes(parts[0])));
    if (header.alg !== 'ES256' || header.typ !== 'JWT') return { ok: false, reason: 'format' };
    let key;
    try {
      key = await importKey(publicKeyB64);
    } catch {
      return { ok: false, reason: 'key' };
    }
    const good = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64urlToBytes(parts[2]), te.encode(`${parts[0]}.${parts[1]}`));
    if (!good) return { ok: false, reason: 'signature' };
    const p = JSON.parse(td.decode(b64urlToBytes(parts[1])));
    if (p.iss !== 'disputt' || !PLAN_IDS.includes(p.plan) || !Number.isFinite(p.pa)) return { ok: false, reason: 'plan' };
    if (p.exp !== undefined && !Number.isFinite(p.exp)) return { ok: false, reason: 'plan' };
    if (audience !== null && p.aud !== audience) return { ok: false, reason: 'audience' };
    const pass = { plan: p.plan, paidAt: p.pa * 1000, issuedAt: (p.iat ?? p.pa) * 1000, expiresAt: p.exp === undefined ? null : p.exp * 1000 };
    if (pass.expiresAt !== null && pass.expiresAt <= now) return { ok: false, reason: 'expired', pass };
    return { ok: true, pass };
  } catch {
    return { ok: false, reason: 'format' };
  }
}

/** True while a verified pass is still running (a lifetime pass never ends). */
export const isActive = (pass, now = Date.now()) => Boolean(pass) && (pass.expiresAt === null || pass.expiresAt > now);

/** Does `next` give more than the pass `current` that is on the phone? One that never ends beats one that does; otherwise the later end wins. */
export function outlasts(next, current, now = Date.now()) {
  if (!isActive(current, now)) return true;
  if (next.expiresAt === null) return current.expiresAt !== null;
  return current.expiresAt !== null && next.expiresAt > current.expiresAt;
}

/** Does the next round need a payment? `round` is the number of rounds played in this game. Never, while payments are off. */
export const needsPayment = ({ payments, round, pass, now = Date.now() }) => Boolean(payments?.enabled) && round >= payments.freeRounds && !isActive(pass, now);

// ---- the restore code: what a customer types to get their pass back on a new phone -----------------------------------------
// 12 characters from an alphabet without the look-alikes (no I, L, O or U), shown as XXXX-XXXX-XXXX: 60 bits, so it cannot be guessed.

export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** What a person typed, as the canonical code, or null. Forgives case, spaces, dashes, and O/I/L typed for 0/1/1. */
export function normalizeCode(input) {
  const raw = String(input ?? '')
    .toUpperCase()
    .replace(/[\s\-–—_.]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (raw.length !== 12 || [...raw].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

/** Shows what has been typed so far with the dashes in place, for the field. */
export function formatCodeInput(input) {
  const raw = String(input ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 12);
  return raw.replace(/(.{4})(?=.)/g, '$1-');
}
