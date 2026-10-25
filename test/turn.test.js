// The relay (TURN): the Worker hands out short-lived access to Cloudflare's relay, and the page adds it to the phones' list of servers
// (public/js/p2p/ice.js). Without a relay set up, or when it does not answer, everything is as it was.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { forgetRelay, prefetchRelay, relayServers, relayUrl, withRelay } from '../public/js/p2p/ice.js';
import { setupShopify } from './helpers/shopify.mjs';

const realFetch = globalThis.fetch;
const realError = console.error;
afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
  forgetRelay();
});

const CLOUDFLARE_LIST = {
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478'] },
    { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'user-1', credential: 'secret-1' },
  ],
};
const json = async (res) => ({ status: res.status, body: await res.json() });

describe('the Worker: GET /turn', () => {
  let t;
  let calls;
  beforeEach(async () => {
    calls = [];
    t = await setupShopify({ TURN_KEY_ID: `key-${Math.random()}`, TURN_KEY_API_TOKEN: 'api-token-1', TURN_API_URL: 'https://turn.test' });
  });
  const pretend = (answer) => {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return answer(String(url));
    };
  };

  it('asks Cloudflare for a day of access with the key, and hands the servers on', async () => {
    pretend(() => Response.json(CLOUDFLARE_LIST));
    const r = await json(await t.call('/turn'));
    assert.equal(r.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `https://turn.test/v1/turn/keys/${encodeURIComponent(t.env.TURN_KEY_ID)}/credentials/generate-ice-servers`);
    assert.equal(calls[0].init.headers.Authorization, 'Bearer api-token-1', 'the token goes to Cloudflare only');
    assert.deepEqual(JSON.parse(calls[0].init.body), { ttl: 86400 });
    assert.deepEqual(r.body.iceServers[1], CLOUDFLARE_LIST.iceServers[1]);
    assert.ok(!JSON.stringify(r.body).includes('api-token-1'), 'the token is never given out');
  });

  it('hands out the same access again for a while, instead of asking every time', async () => {
    pretend(() => Response.json(CLOUDFLARE_LIST));
    await t.call('/turn');
    await t.call('/turn');
    await t.call('/turn');
    assert.equal(calls.length, 1);
  });

  it('also reads the older answer of Cloudflare (an object instead of a list), and tries the older path when the new one is not there', async () => {
    pretend((url) =>
      url.endsWith('/generate-ice-servers')
        ? new Response('not found', { status: 404 })
        : Response.json({ iceServers: { urls: ['turn:turn.cloudflare.com:3478?transport=udp'], username: 'u', credential: 'c' } }),
    );
    const r = await json(await t.call('/turn'));
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.iceServers, [{ urls: ['turn:turn.cloudflare.com:3478?transport=udp'], username: 'u', credential: 'c' }]);
    assert.equal(calls.length, 2);
  });

  it('is an empty list when the relay is not set up, and asks nobody', async () => {
    pretend(() => assert.fail('nobody is asked'));
    for (const missing of [{ TURN_KEY_ID: undefined }, { TURN_KEY_API_TOKEN: undefined }, { TURN_KEY_ID: '', TURN_KEY_API_TOKEN: '' }]) {
      const { call } = await setupShopify({ TURN_KEY_ID: 'k', TURN_KEY_API_TOKEN: 't', ...missing });
      const r = await json(await call('/turn'));
      assert.deepEqual(r, { status: 200, body: { iceServers: [] } });
    }
  });

  it('says 502 when Cloudflare says no (a wrong key) or gives nothing to use, and never what the key was', async () => {
    console.error = () => {};
    pretend(() => new Response('{"error":"unauthorized"}', { status: 401 }));
    const wrong = await json(await t.call('/turn'));
    assert.equal(wrong.status, 502);
    assert.equal(wrong.body.error, 'turn_failed');
    pretend(() => Response.json({ iceServers: [{ urls: ['stun:stun.cloudflare.com:3478'] }] }));
    assert.equal((await json(await t.call('/turn'))).status, 502, 'no credential in it');
    pretend(() => Promise.reject(new Error('offline')));
    assert.equal((await json(await t.call('/turn'))).status, 502);
    for (const r of [wrong]) assert.ok(!JSON.stringify(r).includes(t.env.TURN_KEY_ID));
  });

  it('is refused for a page that is not the game (like every other call), and shows in /health whether it is set up, as true or false', async () => {
    assert.equal((await t.call('/turn', { origin: 'https://evil.example' })).status, 403);
    assert.equal((await json(await t.call('/health'))).body.turn, true);
    const { call } = await setupShopify();
    assert.equal((await json(await call('/health'))).body.turn, false);
  });
});

describe('the page: p2p/ice.js', () => {
  const config = { iceServers: [{ urls: 'stun:stun.example.test' }], payments: { apiUrl: 'https://pay.test' } };
  const answer = (data, status = 200) => async () => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  it('finds the relay at /turn of the payment server, or where the settings say, and nowhere when there is no payment server', () => {
    assert.equal(relayUrl(config), 'https://pay.test/turn');
    assert.equal(relayUrl({ payments: { apiUrl: 'https://pay.test/' } }), 'https://pay.test/turn');
    assert.equal(relayUrl({ turnUrl: 'https://relay.test/x/' }), 'https://relay.test/x/turn');
    assert.equal(relayUrl({ payments: null }), null);
    assert.equal(relayUrl({}), null);
    assert.equal(relayUrl({ ...config, noRelay: true }), null, '?ice=none (the tests) turns it off');
  });

  it('adds the relay to the list the phones already have, and keeps the list as it is when there is no relay', async () => {
    const out = await withRelay(config, answer(CLOUDFLARE_LIST));
    assert.equal(out.iceServers.length, 1 + CLOUDFLARE_LIST.iceServers.length);
    assert.deepEqual(out.iceServers[0], config.iceServers[0]);
    assert.deepEqual(out.iceServers.at(-1), CLOUDFLARE_LIST.iceServers[1]);
    assert.equal(config.iceServers.length, 1, 'the settings themselves are not changed');
    forgetRelay();
    assert.equal(await withRelay({ iceServers: [] }, () => assert.fail('no payment server: nobody is asked')).then((c) => c.iceServers.length), 0);
  });

  it('goes on without the relay when it fails, answers with nonsense or is slow, and tries again a little later, not at once', async () => {
    let asked = 0;
    const failing = async () => {
      asked++;
      throw new Error('offline');
    };
    assert.equal(await withRelay(config, failing), config);
    assert.equal(await withRelay(config, failing), config);
    assert.equal(asked, 1, 'not asked again at once');
    forgetRelay();
    assert.deepEqual(await relayServers(config, answer({ iceServers: 'nonsense' })), []);
    forgetRelay();
    assert.deepEqual(await relayServers(config, answer({ error: 'turn_failed' }, 502)), []);
    forgetRelay();
    const slow = (url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
    const started = Date.now();
    assert.deepEqual(await relayServers(config, slow), []);
    assert.ok(Date.now() - started < 4000, 'a join is never held up for long');
  });

  it('remembers what was handed out, so that the second phone of the page does not ask again', async () => {
    let asked = 0;
    const counting = async () => {
      asked++;
      return Response.json(CLOUDFLARE_LIST);
    };
    await relayServers(config, counting);
    await relayServers(config, counting);
    assert.equal(asked, 1);
    forgetRelay();
    globalThis.fetch = counting;
    prefetchRelay(config);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(asked, 2, 'the early asking when the page opens');
  });
});
