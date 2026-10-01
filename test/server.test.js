import assert from 'node:assert/strict';
import http from 'node:http';
import zlib from 'node:zlib';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../server/index.js';

let app;
let base;

before(async () => {
  app = createApp({ port: 0, host: '127.0.0.1', silent: true });
  base = `http://127.0.0.1:${await app.listen()}`;
});
after(() => app.close());

const get = (path, headers = {}) => fetch(base + path, { headers, redirect: 'manual' });

/** Raw request, so odd paths reach the server untouched (fetch normalises `..`). */
const raw = (path) =>
  new Promise((resolve, reject) => {
    const url = new URL(base);
    http.get({ host: url.hostname, port: url.port, path }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    }).on('error', reject);
  });

describe('static files', () => {
  it('serves the app shell with security headers', async () => {
    const res = await get('/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(await res.text(), /<div id="app">/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
    assert.match(res.headers.get('content-security-policy'), /connect-src 'self' ws: wss:/);
  });

  it('serves the app for QR-code links (/j/ABCD) so the client can join', async () => {
    for (const path of ['/j/ABCD', '/j/abcd', '/j/ABCD/']) {
      const res = await get(path);
      assert.equal(res.status, 200, path);
      assert.match(await res.text(), /<div id="app">/);
    }
  });

  it('does not fall back to the app for unknown files', async () => {
    assert.equal((await get('/nope.js')).status, 404);
    assert.equal((await get('/assets/avatars/ikke-en-avatar.svg')).status, 404);
  });

  it('serves modules with the right type, and the shared avatar roster', async () => {
    const js = await get('/js/main.js');
    assert.match(js.headers.get('content-type'), /javascript/);
    const roster = await get('/shared/avatars.mjs');
    assert.equal(roster.status, 200);
    assert.match(await roster.text(), /export const AVATARS/);
  });

  it('revalidates code with ETags and caches fonts for a year', async () => {
    const first = await get('/css/tokens.css');
    const etag = first.headers.get('etag');
    assert.ok(etag);
    assert.equal(first.headers.get('cache-control'), 'no-cache');
    assert.equal((await get('/css/tokens.css', { 'if-none-match': etag })).status, 304);

    const font = await get('/assets/fonts/lora.woff2');
    assert.equal(font.status, 200);
    assert.match(font.headers.get('cache-control'), /immutable/);
  });

  it('compresses text assets (brotli and gzip) without changing them', async () => {
    const fetchRaw = (path, encoding) =>
      new Promise((resolve, reject) => {
        const url = new URL(base);
        http.get({ host: url.hostname, port: url.port, path, headers: { 'accept-encoding': encoding } }, (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
        }).on('error', reject);
      });
    const plain = await fetchRaw('/js/vendor/qrcode.js', 'identity');
    const gz = await fetchRaw('/js/vendor/qrcode.js', 'gzip');
    const br = await fetchRaw('/js/vendor/qrcode.js', 'br, gzip');
    assert.equal(plain.headers['content-encoding'], undefined);
    assert.equal(gz.headers['content-encoding'], 'gzip');
    assert.equal(br.headers['content-encoding'], 'br');
    assert.ok(gz.body.length < plain.body.length / 2);
    assert.equal(zlib.gunzipSync(gz.body).toString(), plain.body.toString());
    assert.equal(zlib.brotliDecompressSync(br.body).toString(), plain.body.toString());
    const font = await fetchRaw('/assets/fonts/lora.woff2', 'gzip');
    assert.equal(font.headers['content-encoding'], undefined, 'already-compressed formats are left alone');
  });

  it('refuses path traversal', async () => {
    for (const path of ['/../package.json', '/%2e%2e/package.json', '/..%2fpackage.json', '/shared/../package.json', '/shared/%2e%2e/server/game.js', '/assets/../../server/index.js']) {
      const status = await raw(path);
      assert.ok(status === 404 || status === 400, `${path} -> ${status}`);
    }
    assert.equal((await get('/shared/avatars.json')).status, 404, 'only .mjs files are shared');
  });

  it('only allows GET and HEAD', async () => {
    assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
    assert.equal((await fetch(base + '/', { method: 'HEAD' })).status, 200);
  });
});

describe('api', () => {
  it('has a health check and an info endpoint for the QR code', async () => {
    assert.equal(await (await get('/healthz')).text(), 'ok');
    const info = await (await get('/api/info')).json();
    assert.ok(Array.isArray(info.lanUrls));
    assert.equal(typeof info.rooms, 'number');
    assert.equal((await get('/api/info')).headers.get('cache-control'), 'no-store');
  });
});
