// The whole payment chain on this machine, for the browser tests: the real payment server (payments/worker.js) in front of a
// pretend Stripe (tools/qa/fakestripe.mjs) with a pretend hosted checkout page, all behind one local HTTP server.
//
//   const stack = await startPaymentsStack();          // { apiUrl, publicKey, fake, … }
//   const site = await startP2PSite({ payments: { url: stack.apiUrl, key: stack.publicKey } });
//   stack.setSite(`${site.base}/`);                    // the payment server needs to know where the game lives
//
// What the test sees: the game calls `${apiUrl}/checkout` and is sent to `${apiUrl}/pay/<session>` (the pretend Stripe page, with a
// "Betal" and an "Avbryt" button); "Betal" marks the payment as paid and sends the browser back to the game, like Stripe does.
import http from 'node:http';
import worker from '../../payments/worker.js';
import { createFakeStripe } from './fakestripe.mjs';

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export async function startPaymentsStack({ vipps = true } = {}) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const b64 = (buf) => Buffer.from(buf).toString('base64');
  const privateKey = b64(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const publicKey = b64(await crypto.subtle.exportKey('spki', pair.publicKey));

  let origin = '';
  const fake = createFakeStripe();
  const env = {
    STRIPE_KEY: fake.key,
    JWT_PRIVATE_KEY: privateKey,
    SITE_URL: 'http://127.0.0.1:1/', // set by setSite(): the game's own address, which is only known once the site is up
    PRICE_EVENING: 'price_evening',
    PRICE_YEAR: 'price_year',
    PRICE_LIFETIME: 'price_lifetime',
    VIPPS_ENABLED: vipps ? 'true' : 'false',
    STRIPE_API_BASE: '',
  };
  const failures = new Map(); // path -> how many of the next calls should fail (a payment server that is down)

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      const body = req.method === 'GET' || req.method === 'HEAD' ? null : await readBody(req);

      // ---- the pretend Stripe API
      if (url.pathname.startsWith('/stripe/')) {
        const { status, body: out } = fake.handle(req.method, `${url.pathname.slice('/stripe'.length)}${url.search}`, body, req.headers);
        res.writeHead(status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(out));
      }

      // ---- the pretend hosted checkout page
      const page = url.pathname.match(/^\/pay\/(cs_test_[A-Za-z0-9]+)(\/confirm)?$/);
      if (page) {
        const session = fake.sessions.get(page[1]);
        if (!session) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('No such session');
        }
        if (page[2] && req.method === 'POST') {
          fake.pay(session.id);
          res.writeHead(303, { Location: fake.successUrl(session.id) });
          return res.end();
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stripe (test)</title>
<body style="font:18px system-ui;padding:24px"><h1 id="amount">${(session.amount_total / 100).toFixed(0)} kr</h1>
<p id="what">${esc(session.intent.description)}</p><p id="methods">${esc([...session.allowed_payment_method_types, ...session.payment_method_types].join(', ') || 'dynamic')}</p>
<p id="note">${esc(session.custom_text.submit ?? '')}</p>
<form method="post" action="/pay/${session.id}/confirm"><button id="pay" style="font-size:20px;padding:12px 24px">Betal</button></form>
<p><a id="cancel" href="${esc(session.cancel_url)}">Avbryt</a></p></body>`);
      }

      // ---- the payment server itself
      const remaining = failures.get(url.pathname) ?? 0;
      if (remaining > 0) {
        failures.set(url.pathname, remaining - 1);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'server', message: 'Noe gikk galt hos oss. Prøv igjen om litt.' }));
      }
      const headers = {};
      for (const [k, v] of Object.entries(req.headers)) if (!['host', 'connection', 'content-length'].includes(k) && typeof v === 'string') headers[k] = v;
      const response = await worker.fetch(new Request(url, { method: req.method, headers, body: body ?? undefined }), env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      console.error('payments stack:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(String(err));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  env.STRIPE_API_BASE = `${origin}/stripe`;
  // the pretend Stripe names its page https://checkout.stripe.test/…; the browser has to be sent to this machine instead
  const handle = fake.handle;
  fake.handle = (method, urlText, bodyText, headers) => {
    const r = handle(method, urlText, bodyText, headers);
    if (r.body?.url) r.body.url = r.body.url.replace('https://checkout.stripe.test/c/pay/', `${origin}/pay/`);
    return r;
  };

  return {
    apiUrl: origin,
    publicKey,
    fake,
    env,
    setSite: (url) => {
      env.SITE_URL = url;
    },
    /** The next `count` calls to this path of the payment server fail (a server that is down). */
    failNext: (pathname, count = 1) => failures.set(pathname, count),
    stop: async () => {
      server.closeAllConnections?.();
      server.close();
    },
  };
}
