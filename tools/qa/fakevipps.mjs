// A pretend Vipps, for the tests and the QA tools: the part of Vipps' ePayment and Webhooks APIs that the payment server
// (payments/worker-shopify.js) uses, and a landing page where a pretend customer approves or turns the payment down. It follows the
// documentation (developer.vippsmobilepay.com) where that matters for us: the headers every call must have, the amount in øre, a reference
// that is unique on the sales unit, a state that stays "AUTHORIZED" after the money is captured (the captured amount is what changes),
// an idempotency key on create and capture, and webhooks that are signed with HMAC-SHA256 over the date, the address and the hash of the body.
//
//   const vipps = await startFakeVipps();           // { url, keys, payments, webhooks, approve(ref), reject(ref), … }
//   // give the Worker VIPPS_API_URL = vipps.url and the keys; the host's browser is sent to vipps.url/landing/<reference>
import http from 'node:http';

export const KEYS = { msn: '123456', clientId: 'qa-client-id', clientSecret: 'qa-client-secret', subscriptionKey: 'qa-subscription-key' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

/** How Vipps signs a webhook (the same text as in Vipps' documentation): returns the headers to send with `body` to `url`. */
export async function signWebhook(url, body, secret, date = new Date().toUTCString()) {
  const target = new URL(url);
  const bytes = new TextEncoder().encode(body);
  const hash = b64(await crypto.subtle.digest('SHA-256', bytes));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = b64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`POST\n${target.pathname}${target.search}\n${date};${target.host};${hash}`)));
  return {
    'Content-Type': 'application/json',
    'x-ms-date': date,
    'x-ms-content-sha256': hash,
    Host: target.host,
    Authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
  };
}

/**
 * @param keys       the keys of the sales unit (a call with others is turned away)
 * @param user       what the customer shares in the Vipps app when the payment asks for it (profile.scope)
 * @param deliver    how a webhook reaches the payment server: (url, { headers, body }) => Response. By default a real HTTP call.
 */
export async function startFakeVipps({ keys = KEYS, user = { email: 'kari@example.com', firstName: 'Kari', lastName: 'Nordmann', mobileNumber: '4712345678' }, deliver } = {}) {
  const payments = new Map(); // reference -> the payment as Vipps keeps it
  const webhooks = new Map(); // id -> { id, url, events, secret }
  const tokens = new Set();
  const calls = []; // every call: { method, path, status }
  const failures = []; // [{ match: 'POST …/capture', left, status }]: the next calls that match are answered with an error
  const sent = []; // every webhook that was sent: { name, reference, status, attempts }
  let holding = false;
  const held = [];
  let silent = 0; // the next `silent` captures are answered with a yes and do nothing (the status code says yes, the amount says no)
  let nextToken = 1;
  let nextId = 1;
  let origin = '';
  const post = deliver ?? ((url, init) => fetch(url, { method: 'POST', ...init }));

  const aggregate = (p) => {
    const money = (value) => ({ currency: 'NOK', value });
    return { authorizedAmount: money(p.state === 'AUTHORIZED' ? p.amount : 0), cancelledAmount: money(p.cancelled), capturedAmount: money(p.captured), refundedAmount: money(p.refunded) };
  };
  const view = (p) => ({
    aggregate: aggregate(p),
    amount: { currency: 'NOK', value: p.amount },
    state: p.state,
    paymentMethod: { type: 'WALLET' },
    ...(p.state === 'AUTHORIZED' && p.scope ? { profile: { sub: `c:${p.reference}` }, userDetails: { ...pick(user, p.scope) } } : {}),
    pspReference: p.pspReference,
    reference: p.reference,
  });
  // (what the customer agreed to share: name gives first and last name, email the address)
  const pick = (u, scope) => ({ ...(scope.includes('email') ? { email: u.email } : {}), ...(scope.includes('name') ? { firstName: u.firstName, lastName: u.lastName } : {}), ...(scope.includes('phoneNumber') ? { mobileNumber: u.mobileNumber } : {}) });

  /** What Vipps does when something happens to a payment: calls every webhook that wants to hear of it, and again if it is not answered with a 2xx. */
  async function emit(payment, name) {
    const body = JSON.stringify({
      msn: keys.msn,
      reference: payment.reference,
      pspReference: payment.pspReference,
      name,
      amount: { currency: 'NOK', value: payment.amount },
      timestamp: new Date().toISOString(),
      idempotencyKey: null,
      success: true,
      ...(name === 'AUTHORIZED' ? { sub: `c:${payment.reference}` } : {}),
    });
    const event = `epayments.payment.${name.toLowerCase()}.v1`;
    for (const hook of webhooks.values()) {
      if (!hook.events.includes(event)) continue;
      const record = { name, reference: payment.reference, status: 0, attempts: 0 };
      sent.push(record);
      for (let attempt = 0; attempt < 5; attempt++) {
        record.attempts++;
        try {
          const res = await post(hook.url, { headers: await signWebhook(hook.url, body, hook.secret), body });
          record.status = res.status;
          if (res.status >= 200 && res.status < 300) break;
        } catch {
          record.status = 0;
        }
        await sleep(120);
      }
    }
  }
  const tell = (payment, name) => {
    if (holding) held.push([payment, name]);
    else return emit(payment, name);
    return undefined;
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, origin);
    const text = req.method === 'GET' || req.method === 'HEAD' ? '' : await readBody(req);
    const send = (status, data, headers = {}) => {
      calls.push({ method: req.method, path: url.pathname, status });
      res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
      res.end(data === undefined ? '' : JSON.stringify(data));
    };
    const html = (status, page) => {
      calls.push({ method: req.method, path: url.pathname, status });
      res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vipps (pretend)</title><body style="font:18px system-ui;padding:24px;background:#ff5b24;color:#fff">${page}</body></html>`);
    };
    try {
      if (url.pathname === '/favicon.ico') {
        res.writeHead(204); // (a browser that was sent here asks for an icon; no keys: it is the customer's browser)
        return res.end();
      }
      // ---- the landing page, where the pretend customer decides (no keys: it is the customer's browser)
      const landing = url.pathname.match(/^\/landing\/([^/]+)(\/approve|\/reject)?$/);
      if (landing) {
        const payment = payments.get(decodeURIComponent(landing[1]));
        if (!payment) return html(404, '<p id="gone">Fant ikke betalingen.</p>');
        if (req.method === 'POST' && landing[2]) {
          if (payment.state === 'CREATED') {
            payment.state = landing[2] === '/approve' ? 'AUTHORIZED' : 'ABORTED';
            tell(payment, payment.state); // (not waited for: the customer is on his way back by the time Vipps has told us)
          }
          res.writeHead(303, { Location: payment.returnUrl });
          calls.push({ method: req.method, path: url.pathname, status: 303 });
          return res.end();
        }
        return html(
          200,
          `<h1 id="amount">${(payment.amount / 100).toFixed(2).replace('.', ',')} kr</h1><p id="what">${payment.description}</p><p id="state">${payment.state}</p>
<form method="post" action="/landing/${encodeURIComponent(payment.reference)}/approve"><button id="approve" style="font-size:20px;padding:12px 24px">Godkjenn</button></form>
<form method="post" action="/landing/${encodeURIComponent(payment.reference)}/reject" style="margin-top:12px"><button id="reject" style="font-size:20px;padding:12px 24px">Avbryt</button></form>`,
        );
      }

      const body = text ? JSON.parse(text) : {};
      const header = (name) => req.headers[name.toLowerCase()];
      const keyed = header('ocp-apim-subscription-key') === keys.subscriptionKey && header('merchant-serial-number') === keys.msn;

      // ---- the access token
      if (req.method === 'POST' && url.pathname === '/accesstoken/get') {
        if (!(header('client_id') === keys.clientId && header('client_secret') === keys.clientSecret && keyed)) return send(401, { error: 'unauthorized_client' });
        const token = `qa-token-${nextToken++}`;
        tokens.add(token);
        return send(200, { token_type: 'Bearer', expires_in: '3600', ext_expires_in: '3600', access_token: token });
      }
      // ---- everything else needs the token, the subscription key and the serial number
      if (!tokens.has((header('authorization') ?? '').replace(/^Bearer /, '')) || !keyed) return send(401, { title: 'Unauthorized' });
      const injected = failures.find((f) => f.left > 0 && `${req.method} ${url.pathname}`.includes(f.match));
      if (injected) {
        injected.left--;
        return send(injected.status, { title: 'Service unavailable', detail: 'pretend failure' });
      }

      // ---- the Webhooks API
      if (url.pathname === '/webhooks/v1/webhooks') {
        if (req.method === 'POST') {
          if (typeof body.url !== 'string' || !Array.isArray(body.events) || body.events.length === 0) return send(400, { title: 'Bad Request' });
          const hook = { id: `wh-${nextId++}`, url: body.url, events: body.events, secret: `${crypto.randomUUID()}` };
          webhooks.set(hook.id, hook);
          return send(201, { id: hook.id, secret: hook.secret });
        }
        if (req.method === 'GET') return send(200, { webhooks: [...webhooks.values()].map(({ id, url: to, events }) => ({ id, url: to, events })) });
      }
      const hookPath = url.pathname.match(/^\/webhooks\/v1\/webhooks\/([^/]+)$/);
      if (hookPath && req.method === 'DELETE') {
        if (!webhooks.delete(decodeURIComponent(hookPath[1]))) return send(404, { title: 'Not Found' });
        return send(204);
      }

      // ---- the ePayment API
      if (req.method === 'POST' && url.pathname === '/epayment/v1/payments') {
        const key = header('idempotency-key');
        if (!key) return send(400, { title: 'Bad Request', detail: 'Idempotency-Key is required' });
        const problems = [];
        if (body.amount?.currency !== 'NOK') problems.push('amount.currency');
        if (!Number.isInteger(body.amount?.value) || body.amount.value < 100) problems.push('amount.value (øre, an integer, 100 at least)');
        if (body.paymentMethod?.type !== 'WALLET') problems.push('paymentMethod.type');
        if (!/^[A-Za-z0-9-]{6,64}$/.test(String(body.reference ?? ''))) problems.push('reference (letters, digits and hyphens)');
        if (body.userFlow !== 'WEB_REDIRECT') problems.push('userFlow');
        if (!/^https:\/\/|^http:\/\/127\.0\.0\.1/.test(String(body.returnUrl ?? ''))) problems.push('returnUrl (https)');
        if (body.profile?.scope !== undefined && typeof body.profile.scope !== 'string') problems.push('profile.scope');
        if (problems.length > 0) return send(400, { title: 'Bad Request', detail: `invalid: ${problems.join(', ')}` });
        const existing = payments.get(body.reference);
        if (existing) {
          if (existing.idempotencyKey === key) return send(200, { redirectUrl: `${origin}/landing/${existing.reference}`, reference: existing.reference });
          return send(409, { title: 'Conflict', detail: 'the reference is used' });
        }
        const payment = {
          reference: body.reference,
          idempotencyKey: key,
          amount: body.amount.value,
          state: 'CREATED',
          captured: 0,
          cancelled: 0,
          refunded: 0,
          returnUrl: body.returnUrl,
          description: String(body.paymentDescription ?? ''),
          scope: body.profile?.scope ?? '',
          pspReference: crypto.randomUUID(),
          captures: new Set(),
        };
        payments.set(payment.reference, payment);
        return send(202, { redirectUrl: `${origin}/landing/${payment.reference}`, reference: payment.reference });
      }
      const op = url.pathname.match(/^\/epayment\/v1\/payments\/([^/]+)(?:\/(capture|cancel|refund))?$/);
      if (op) {
        const payment = payments.get(decodeURIComponent(op[1]));
        if (!payment) return send(404, { title: 'Not Found' });
        if (req.method === 'GET' && !op[2]) return send(200, view(payment));
        if (req.method === 'POST' && op[2]) {
          const key = header('idempotency-key');
          if (!key) return send(400, { title: 'Bad Request', detail: 'Idempotency-Key is required' });
          if (op[2] === 'capture') {
            if (payment.captures.has(key)) return send(200, { aggregate: aggregate(payment), state: payment.state, pspReference: payment.pspReference, reference: payment.reference });
            const value = body.modificationAmount?.value;
            if (payment.state !== 'AUTHORIZED') return send(400, { title: 'Bad Request', detail: 'not authorized' });
            if (silent > 0) {
              silent--;
              return send(200, { aggregate: aggregate(payment), state: payment.state, pspReference: payment.pspReference, reference: payment.reference });
            }
            if (body.modificationAmount?.currency !== 'NOK' || !Number.isInteger(value) || value <= 0 || value > payment.amount - payment.captured - payment.cancelled) return send(400, { title: 'Bad Request', detail: 'amount' });
            payment.captured += value;
            payment.captures.add(key);
            return send(200, { aggregate: aggregate(payment), state: payment.state, pspReference: payment.pspReference, reference: payment.reference });
          }
          if (op[2] === 'cancel') {
            if (payment.captured > 0 || payment.state !== 'AUTHORIZED') return send(400, { title: 'Bad Request', detail: 'cannot cancel' });
            payment.cancelled = payment.amount;
            return send(200, { aggregate: aggregate(payment), state: payment.state, pspReference: payment.pspReference, reference: payment.reference });
          }
          const value = body.modificationAmount?.value;
          if (!Number.isInteger(value) || value <= 0 || value > payment.captured - payment.refunded) return send(400, { title: 'Bad Request', detail: 'amount' });
          payment.refunded += value;
          return send(200, { aggregate: aggregate(payment), state: payment.state, pspReference: payment.pspReference, reference: payment.reference });
        }
      }
      return send(404, { title: 'Not Found' });
    } catch (err) {
      console.error('fake Vipps:', err);
      send(500, { title: String(err) });
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;

  return {
    url: origin,
    keys,
    payments,
    webhooks,
    calls,
    sent,
    /** The customer approves in the Vipps app (the webhook goes out and is waited for). */
    approve: async (reference) => {
      const payment = payments.get(reference);
      if (payment?.state !== 'CREATED') throw new Error(`${reference} is ${payment?.state ?? 'unknown'}`);
      payment.state = 'AUTHORIZED';
      await tell(payment, 'AUTHORIZED');
    },
    reject: async (reference) => {
      const payment = payments.get(reference);
      payment.state = 'ABORTED';
      await tell(payment, 'ABORTED');
    },
    expire: async (reference) => {
      const payment = payments.get(reference);
      payment.state = 'EXPIRED';
      await tell(payment, 'EXPIRED');
    },
    /** The next `count` calls whose "METHOD /path" contains `match` are answered with an error (Vipps is down). */
    failNext: (match, count = 1, status = 503) => failures.push({ match, left: count, status }),
    /** The next `count` captures are answered 200 and nothing is captured: a Worker that trusts the status code would deliver for nothing. */
    captureNothing: (count = 1) => {
      silent = count;
    },
    /** Every token is withdrawn (the next call is turned away, and the Worker has to ask for a new one). */
    revokeTokens: () => tokens.clear(),
    /** Webhooks wait until release(): Vipps has the payment and has not told anybody yet. */
    hold: () => {
      holding = true;
    },
    release: async () => {
      holding = false;
      for (const [payment, name] of held.splice(0)) await emit(payment, name);
    },
    stop: async () => {
      server.closeAllConnections?.();
      server.close();
    },
  };
}
