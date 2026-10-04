// Loads payments/worker.js for the tests. The file that is deployed has only a default export (a Worker is pasted into
// Cloudflare as it is), so the tests load a copy of the same text that also exposes the inside.
import { readFileSync } from 'node:fs';
import { createFakeStripe } from '../../tools/qa/fakestripe.mjs';

const source = readFileSync(new URL('../../payments/worker.js', import.meta.url), 'utf8');
if (source.split('export default {').length !== 2) throw new Error('payments/worker.js must have exactly one "export default {"');
const exposed = `${source.replace('export default {', 'const worker = {')}\nexport { worker, PLANS, newCode, normalizeCode, encodeForm, signPass, bytesToB64url };\n`;
export const mod = await import(`data:text/javascript;base64,${Buffer.from(exposed).toString('base64')}`);

/** A fresh P-256 key pair in the shapes the Worker (PKCS#8, base64) and the page (SPKI, base64) are given. */
export async function makeKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const b64 = (buf) => Buffer.from(buf).toString('base64');
  return {
    privateKey: b64(await crypto.subtle.exportKey('pkcs8', pair.privateKey)),
    publicKey: b64(await crypto.subtle.exportKey('spki', pair.publicKey)),
    cryptoKeys: pair,
  };
}

export const SITE = 'https://example.github.io/Disputt/';
export const ORIGIN = 'https://example.github.io';
export const WORKER = 'https://pay.example.workers.dev'; // where the Worker is, and so what a pass it signs is made for

/** A Worker environment with everything set, a fake Stripe, and a way to call the Worker like the browser does. */
export async function setup(overrides = {}) {
  const keys = await makeKeys();
  const stripe = createFakeStripe();
  const env = {
    STRIPE_KEY: stripe.key,
    JWT_PRIVATE_KEY: keys.privateKey,
    SITE_URL: SITE,
    PRICE_EVENING: 'price_evening',
    PRICE_YEAR: 'price_year',
    PRICE_LIFETIME: 'price_lifetime',
    ...overrides,
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    return url.startsWith('https://api.stripe.com') ? stripe.fetch(input, init) : realFetch(input, init);
  };
  const call = (path, { method = 'GET', body, origin = ORIGIN } = {}) =>
    mod.worker.fetch(
      new Request(`${WORKER}${path}`, {
        method,
        headers: { ...(origin ? { Origin: origin } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    );
  return { env, stripe, keys, call, restore: () => (globalThis.fetch = realFetch) };
}
