// The access pass, the restore code and the packages: what the page does with what the payment server hands out.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CODE_ALPHABET, bytesToB64url, formatCodeInput, isActive, needsPayment, normalizeCode, verifyPass } from '../public/js/pay/pass.js';
import { DEFAULT_PLAN, PERKS, PLANS, describeValidity, formatPrice, planById } from '../public/js/pay/plans.js';
import { mod, makeKeys } from './helpers/worker.mjs';

const te = new TextEncoder();
const NOW = Date.UTC(2026, 9, 4, 18, 0, 0); // 4 October 2026, 18:00 UTC

/** Signs whatever payload a test wants, the way the payment server does. */
async function sign(keys, payload, header = { alg: 'ES256', typ: 'JWT' }) {
  const head = bytesToB64url(te.encode(JSON.stringify(header)));
  const body = bytesToB64url(te.encode(JSON.stringify(payload)));
  const privateKey = await crypto.subtle.importKey('pkcs8', Buffer.from(keys.privateKey, 'base64'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, te.encode(`${head}.${body}`)));
  return `${head}.${body}.${bytesToB64url(sig)}`;
}

describe('verifyPass', () => {
  it('accepts what the payment server signs, and says what it is', async () => {
    const keys = await makeKeys();
    const paidAt = Math.floor(NOW / 1000) - 3600;
    const { token } = await mod.signPass({ JWT_PRIVATE_KEY: keys.privateKey }, { plan: 'evening', paidAt, issuedAt: paidAt + 5 });
    const r = await verifyPass(token, keys.publicKey, NOW);
    assert.equal(r.ok, true);
    assert.deepEqual(r.pass, { plan: 'evening', paidAt: paidAt * 1000, issuedAt: (paidAt + 5) * 1000, expiresAt: (paidAt + 12 * 3600) * 1000 });
    assert.equal(isActive(r.pass, NOW), true);
    assert.equal(isActive(r.pass, NOW + 12 * 3600 * 1000), false, 'twelve hours later it is over');
  });

  it('never ends for a lifetime pass', async () => {
    const keys = await makeKeys();
    const { token } = await mod.signPass({ JWT_PRIVATE_KEY: keys.privateKey }, { plan: 'lifetime', paidAt: 1_700_000_000, issuedAt: 1_700_000_000 });
    const r = await verifyPass(token, keys.publicKey, NOW);
    assert.equal(r.ok, true);
    assert.equal(r.pass.expiresAt, null);
    assert.equal(isActive(r.pass, NOW + 100 * 365 * 86_400_000), true);
  });

  it('says "expired" for a pass that has run out, and still says what it was', async () => {
    const keys = await makeKeys();
    const paidAt = Math.floor(NOW / 1000) - 400 * 86400;
    const { token } = await mod.signPass({ JWT_PRIVATE_KEY: keys.privateKey }, { plan: 'year', paidAt, issuedAt: paidAt });
    const r = await verifyPass(token, keys.publicKey, NOW);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'expired');
    assert.equal(r.pass.plan, 'year');
  });

  it('refuses a pass that was changed, signed with another key, or is not a pass', async () => {
    const keys = await makeKeys();
    const other = await makeKeys();
    const { token } = await mod.signPass({ JWT_PRIVATE_KEY: keys.privateKey }, { plan: 'evening', paidAt: Math.floor(NOW / 1000), issuedAt: Math.floor(NOW / 1000) });
    const [h, p, s] = token.split('.');
    // an evening turned into a lifetime pass by editing the payload
    const edited = JSON.parse(Buffer.from(p, 'base64url').toString());
    edited.plan = 'lifetime';
    delete edited.exp;
    const forged = `${h}.${bytesToB64url(te.encode(JSON.stringify(edited)))}.${s}`;
    assert.equal((await verifyPass(forged, keys.publicKey, NOW)).reason, 'signature');
    assert.equal((await verifyPass(token, other.publicKey, NOW)).reason, 'signature');
    for (const junk of ['', 'abc', 'a.b', 'a.b.c', null, undefined, 42, `${h}.${p}`]) {
      assert.equal((await verifyPass(junk, keys.publicKey, NOW)).ok, false, String(junk));
    }
    assert.equal((await verifyPass(token, 'not a key', NOW)).reason, 'key');
  });

  it('refuses a validly signed token that is not a Disputt pass', async () => {
    const keys = await makeKeys();
    const good = { iss: 'disputt', plan: 'year', pa: Math.floor(NOW / 1000), iat: Math.floor(NOW / 1000), exp: Math.floor(NOW / 1000) + 1000 };
    assert.equal((await verifyPass(await sign(keys, good), keys.publicKey, NOW)).ok, true);
    assert.equal((await verifyPass(await sign(keys, { ...good, iss: 'someone' }), keys.publicKey, NOW)).reason, 'plan');
    assert.equal((await verifyPass(await sign(keys, { ...good, plan: 'forever' }), keys.publicKey, NOW)).reason, 'plan');
    assert.equal((await verifyPass(await sign(keys, { ...good, pa: 'x' }), keys.publicKey, NOW)).reason, 'plan');
    assert.equal((await verifyPass(await sign(keys, { ...good, exp: 'x' }), keys.publicKey, NOW)).reason, 'plan');
    assert.equal((await verifyPass(await sign(keys, good, { alg: 'none', typ: 'JWT' }), keys.publicKey, NOW)).reason, 'format', 'no unsigned passes');
    assert.equal((await verifyPass(await sign(keys, good, { alg: 'HS256', typ: 'JWT' }), keys.publicKey, NOW)).reason, 'format');
  });
});

describe('the gate before the next round', () => {
  const on = { enabled: true, freeRounds: 2 };
  const running = (ms = 60_000) => ({ plan: 'evening', expiresAt: NOW + ms });

  it('leaves the free rounds free, and asks from then on', () => {
    assert.equal(needsPayment({ payments: on, round: 0, pass: null, now: NOW }), false);
    assert.equal(needsPayment({ payments: on, round: 1, pass: null, now: NOW }), false);
    assert.equal(needsPayment({ payments: on, round: 2, pass: null, now: NOW }), true, 'after the second round');
    assert.equal(needsPayment({ payments: on, round: 9, pass: null, now: NOW }), true);
  });

  it('follows the number of free rounds that the build says', () => {
    assert.equal(needsPayment({ payments: { enabled: true, freeRounds: 4 }, round: 3, pass: null, now: NOW }), false);
    assert.equal(needsPayment({ payments: { enabled: true, freeRounds: 4 }, round: 4, pass: null, now: NOW }), true);
    assert.equal(needsPayment({ payments: { enabled: true, freeRounds: 0 }, round: 1, pass: null, now: NOW }), true);
  });

  it('never asks while payments are off, whatever else is true', () => {
    for (const payments of [null, undefined, { enabled: false, freeRounds: 2 }, {}]) {
      assert.equal(needsPayment({ payments, round: 50, pass: null, now: NOW }), false, JSON.stringify(payments));
    }
  });

  it('does not ask a host whose pass is running, and asks again when it has run out', () => {
    assert.equal(needsPayment({ payments: on, round: 5, pass: running(), now: NOW }), false);
    assert.equal(needsPayment({ payments: on, round: 5, pass: { plan: 'lifetime', expiresAt: null }, now: NOW }), false, 'a lifetime pass never runs out');
    assert.equal(needsPayment({ payments: on, round: 5, pass: running(-1), now: NOW }), true, 'an evening that has ended');
    assert.equal(needsPayment({ payments: on, round: 5, pass: running(0), now: NOW }), true, 'to the millisecond');
  });
});

describe('the restore code', () => {
  it('forgives how a person types it, and refuses what cannot be a code', () => {
    const canonical = 'K7M2-9QXD-4TRB';
    for (const typed of ['K7M2-9QXD-4TRB', 'k7m2 9qxd 4trb', ' K7M29QXD4TRB ', 'k7m2–9qxd–4trb', 'K7M2.9QXD.4TRB']) assert.equal(normalizeCode(typed), canonical, typed);
    assert.equal(normalizeCode('K7M2-9QXD-4TRB-X'), null);
    assert.equal(normalizeCode('K7M2-9QXD'), null);
    assert.equal(normalizeCode('K7M2-9QXD-4TRU'), null, 'U is not in the alphabet');
    assert.equal(normalizeCode(''), null);
    assert.equal(normalizeCode(null), null);
    // look-alikes: O for 0 and I or L for 1
    assert.equal(normalizeCode('OOOO-IIII-LLLL'), '0000-1111-1111');
  });

  it('is shown with the dashes in place while it is typed', () => {
    assert.equal(formatCodeInput('k7m'), 'K7M');
    assert.equal(formatCodeInput('k7m29'), 'K7M2-9');
    assert.equal(formatCodeInput('k7m29qxd4trb'), 'K7M2-9QXD-4TRB');
    assert.equal(formatCodeInput('k7m2-9qxd-4trb-extra'), 'K7M2-9QXD-4TRB');
    assert.equal(formatCodeInput(''), '');
  });

  it('is the same on the page and in the payment server, for any input', () => {
    const alphabet = `${CODE_ALPHABET}abcdefghijklmnopqrstuvwxyz -_.–`;
    for (let i = 0; i < 500; i++) {
      const n = 10 + (i % 5);
      const typed = [...crypto.getRandomValues(new Uint8Array(n))].map((b) => alphabet[b % alphabet.length]).join('');
      assert.equal(normalizeCode(typed), mod.normalizeCode(typed), typed);
    }
    for (let i = 0; i < 200; i++) {
      const code = mod.newCode();
      assert.match(code, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
      assert.ok(![...code.replace(/-/g, '')].some((c) => 'ILOU'.includes(c)), code);
      assert.equal(normalizeCode(code), code);
    }
  });
});

describe('the packages', () => {
  it('are the three the host can buy, with the prices from the plan', () => {
    assert.deepEqual(PLANS.map((p) => [p.id, p.name, p.price]), [['evening', 'En kveld', 89], ['year', 'For ett år', 249], ['lifetime', 'Livstid', 299]]);
    assert.equal(planById(DEFAULT_PLAN).id, 'year');
    assert.equal(planById('nope'), null);
    assert.equal(formatPrice(89), '89 kr');
    assert.ok(PERKS.length >= 3);
  });

  it('cost on the page what the payment server will accept (and nothing else)', () => {
    assert.deepEqual(PLANS.map((p) => p.id).sort(), Object.keys(mod.PLANS).sort());
    for (const p of PLANS) assert.equal(p.price * 100, mod.PLANS[p.id].amount, `${p.id}: the price on the page and in payments/worker.js must be the same`);
    const noon = Date.UTC(2027, 0, 15, 12) / 1000;
    assert.equal(mod.PLANS.evening.ends(noon), noon + 12 * 3600);
    assert.match(PLANS.find((p) => p.id === 'evening').length, /^12 timer$/);
    assert.equal(mod.PLANS.year.ends(noon), Date.UTC(2028, 0, 15, 12) / 1000, 'a year is twelve months, and 2028 has a 29 February');
    assert.equal(mod.PLANS.year.ends(Date.UTC(2028, 1, 29, 12) / 1000), Date.UTC(2029, 2, 1, 12) / 1000, 'bought on 29 February: ends on 1 March');
    assert.equal(mod.PLANS.lifetime.ends(noon), null);
  });

  it('say when a pass ends', () => {
    const at = (d) => ({ expiresAt: d });
    const noon = new Date(2026, 9, 4, 12, 0).getTime();
    assert.equal(describeValidity(null, noon), '');
    assert.equal(describeValidity(at(null), noon), 'Gjelder for alltid');
    assert.match(describeValidity(at(new Date(2026, 9, 4, 22, 14).getTime()), noon), /^Gjelder til kl\. 22[:.]14$/);
    assert.match(describeValidity(at(new Date(2026, 9, 5, 2, 14).getTime()), noon), /^Gjelder til i morgen kl\. 02[:.]14$/);
    assert.match(describeValidity(at(new Date(2027, 9, 4, 12, 0).getTime()), noon), /^Gjelder til 4\. oktober 2027$/);
  });
});
