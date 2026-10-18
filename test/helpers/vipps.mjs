// The payment server with Vipps switched on, for the tests: the Worker (test/helpers/shopify.mjs), a pretend Vipps and a pretend Shopify Admin
// API (tools/qa/fakevipps.mjs, tools/qa/fakeshopifyadmin.mjs) on this machine, and the calls the game and Vipps make.
import { CODE, SECRET, webhookRequest } from '../../tools/qa/fakeshopify.mjs';
import { KEYS, startFakeVipps } from '../../tools/qa/fakevipps.mjs';
import { APP, startFakeShopifyAdmin } from '../../tools/qa/fakeshopifyadmin.mjs';
import { SITE, WORKER, mod, setupShopify } from './shopify.mjs';

export const ADMIN_TOKEN = 'qa-admin-token-0123456789';
export { CODE, KEYS, APP, SITE, WORKER, mod };

/**
 * @param overrides  settings of the Worker that the test changes (a name set to undefined is taken away)
 * @param fakes      options for the pretend Vipps and the pretend Shopify ({ vipps: { user }, admin: { prices, currency } })
 */
export async function setupVipps(overrides = {}, fakes = {}) {
  // (the Worker keeps tokens and prices for a while: a pretend server that gets the address of an earlier one must not inherit them)
  mod.vippsTokens.clear();
  mod.shopifyTokens.clear();
  mod.priceKept.clear();
  const base = await setupShopify();
  const { env } = base;
  const pending = []; // what is on its way from the pretend Shopify to the Worker
  const vipps = await startFakeVipps({ ...fakes.vipps, deliver: (url, init) => mod.worker.fetch(new Request(url, { method: 'POST', ...init }), env) });
  const admin = await startFakeShopifyAdmin({
    ...fakes.admin,
    // (Shopify says "orders/paid" for an order that is made as paid; a test can switch that off, to look at what the Worker does on its own)
    deliver: fakes.noShopifyWebhook
      ? undefined
      : (topic, payload) => {
          pending.push(
            webhookRequest(`${WORKER}/shopify/webhook`, topic, payload)
              .then((request) => mod.worker.fetch(request, env))
              .catch(() => {}),
          );
        },
  });
  Object.assign(env, {
    VIPPS_ENABLED: 'true',
    VIPPS_API_URL: vipps.url,
    VIPPS_MSN: KEYS.msn,
    VIPPS_CLIENT_ID: KEYS.clientId,
    VIPPS_CLIENT_SECRET: KEYS.clientSecret,
    VIPPS_SUBSCRIPTION_KEY: KEYS.subscriptionKey,
    SHOPIFY_STORE: 'disputt-test',
    SHOPIFY_ADMIN_URL: admin.url,
    SHOPIFY_CLIENT_ID: APP.clientId,
    SHOPIFY_CLIENT_SECRET: APP.clientSecret,
    ADMIN_TOKEN,
    ...overrides,
  });
  for (const [name, value] of Object.entries(overrides)) if (value === undefined) delete env[name];

  const call = base.call;
  const read = async (res) => ({ status: res.status, body: await res.json().catch(() => null) });
  /** The game: "Betal med Vipps". `consent` is the time the host ticked the box. */
  const start = async ({ plan = 'year', code = CODE, consent = new Date(), rabatt, flow } = {}) =>
    read(await call('/vipps/start', { method: 'POST', body: { plan, code, samtykke: consent instanceof Date ? consent.toISOString() : consent, ...(rabatt === undefined ? {} : { rabatt }), ...(flow === undefined ? {} : { flow }) } }));
  /** The game: "Har du rabattkode?" */
  const discount = async (rabatt) => read(await call('/discount', { method: 'POST', body: { code: rabatt } }));
  const status = async (reference) => read(await call('/vipps/status', { method: 'POST', body: { reference } }));
  const restore = async (code = CODE) => read(await call('/restore', { method: 'POST', body: { code } }));
  /** The owner (a person with the admin token): registers the webhook at Vipps. */
  const adminCall = (path, { method = 'GET', token = ADMIN_TOKEN, origin = null } = {}) =>
    mod.worker.fetch(new Request(`${WORKER}${path}`, { method, headers: { ...(token === null ? {} : { Authorization: `Bearer ${token}` }), ...(origin ? { Origin: origin } : {}) } }), env);
  const register = async () => read(await adminCall('/vipps/admin/webhook', { method: 'POST' }));
  /** Vipps' call to the webhook, made by hand (a body, and headers signed with `secret`; leave `headers` to make a call with no signature). */
  const hook = async (payload, { secret, headers, date } = {}) => {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const { signWebhook } = await import('../../tools/qa/fakevipps.mjs');
    return mod.worker.fetch(new Request(`${WORKER}/vipps/webhook`, { method: 'POST', headers: headers ?? (await signWebhook(`${WORKER}/vipps/webhook`, body, secret, date)), body }), env);
  };
  /** A payment started, and approved in the Vipps app (the webhook that Vipps sends is taken in before this returns). */
  const payVipps = async (options = {}) => {
    const { body } = await start(options);
    await vipps.approve(body.reference);
    await Promise.all(pending.splice(0));
    return body.reference;
  };
  const row = (reference) => base.db.sqlite.prepare('SELECT * FROM vipps WHERE reference = ?').get(reference);
  const ordersRows = () => base.db.sqlite.prepare('SELECT * FROM orders ORDER BY paid_at').all();
  const settled = () => Promise.all(pending.splice(0));
  const stop = async () => {
    await vipps.stop();
    await admin.stop();
  };
  return { ...base, vipps, admin, start, discount, status, restore, register, hook, payVipps, row, ordersRows, adminCall, settled, stop, SECRET };
}
