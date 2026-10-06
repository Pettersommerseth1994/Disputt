// A pretend Stripe, for tests: just the few calls the payment server (payments/worker.js) makes, kept in memory.
//   - POST /v1/checkout/sessions                    starts a session (with the fields the Worker sends)
//   - GET  /v1/checkout/sessions/:id                 reads it back, with the payment expanded once it is paid
//   - GET  /v1/payment_intents/search?query=…        finds payments by the metadata code and status
// `pay(sessionId)` is the customer paying on the hosted page; `refund(paymentId, { partial })` is a refund in the dashboard and
// `dispute(paymentId)` a chargeback. Every call is written to `calls`, so a test can look at exactly what the Worker sent.
// Things the real Stripe does that a test has to be able to meet: search that is a while behind (`searchLag = true`, then `flush()`),
// and errors (`failNext(status, count)`: the next calls answer with that status, as Stripe does when it is busy or down).
// Like the real one it refuses metadata that is not flat (metadata[plan][0]=year).

const alnum = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62]).join('');

export function createFakeStripe({ key = 'sk_test_fake', prices = { price_evening: 8900, price_year: 24900, price_lifetime: 29900 }, checkoutBase = 'https://checkout.stripe.test', now = () => Date.now() } = {}) {
  const sessions = new Map();
  const payments = new Map();
  const calls = [];
  const state = { searchLag: false, ignoreExpand: false, failures: [] }; // failures: statuses to answer with, one per call

  const reply = (status, body) => ({ status, body });
  const error = (status, message) => reply(status, { error: { message, type: 'invalid_request_error' } });

  /** One request in, { status, body } out. `body` is the text of a form (POST) or null. */
  function handle(method, urlText, bodyText = null, headers = {}) {
    const url = new URL(urlText, 'https://api.stripe.com');
    const params = bodyText ? new URLSearchParams(bodyText) : new URLSearchParams();
    calls.push({ method, path: url.pathname, query: url.searchParams, params, headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])) });
    if ((headers.Authorization ?? headers.authorization) !== `Bearer ${key}`) return error(401, 'Invalid API Key provided');
    if (state.failures.length) {
      const status = state.failures.shift();
      return reply(status, { error: { message: status === 429 ? 'Too many requests hit the API too quickly.' : 'An unknown error occurred', type: status === 429 ? 'rate_limit_error' : 'api_error' } });
    }
    for (const k of params.keys()) if (/^metadata\[[^\]]+\]\[/.test(k) || /^payment_intent_data\[metadata\]\[[^\]]+\]\[/.test(k)) return error(400, `Invalid object: metadata values must be strings (${k})`);

    if (method === 'POST' && url.pathname === '/v1/checkout/sessions') {
      const price = params.get('line_items[0][price]');
      if (params.get('mode') !== 'payment') return error(400, 'mode must be payment');
      if (!(price in prices)) return error(400, `No such price: '${price}'`);
      if (!params.get('success_url')?.includes('{CHECKOUT_SESSION_ID}')) return error(400, 'success_url needs {CHECKOUT_SESSION_ID}');
      const id = `cs_test_${alnum(24)}`;
      // (all the metadata the caller sent, as Stripe keeps it: flat, and every value a string)
      const bag = (prefix) => Object.fromEntries([...params.keys()].filter((k) => k.startsWith(prefix) && k.endsWith(']')).map((k) => [k.slice(prefix.length, -1), params.get(k)]));
      const meta = bag('metadata[');
      const session = {
        id,
        object: 'checkout.session',
        url: `${checkoutBase}/c/pay/${id}`,
        mode: 'payment',
        status: 'open',
        payment_status: 'unpaid',
        currency: 'nok',
        amount_total: prices[price],
        metadata: meta,
        payment_intent: null,
        success_url: params.get('success_url'),
        cancel_url: params.get('cancel_url'),
        payment_method_types: [...params.keys()].filter((k) => k.startsWith('payment_method_types[')).map((k) => params.get(k)),
        allowed_payment_method_types: [...params.keys()].filter((k) => k.startsWith('allowed_payment_method_types[')).map((k) => params.get(k)),
        custom_text: { submit: params.get('custom_text[submit][message]'), terms: params.get('custom_text[terms_of_service_acceptance][message]') },
        consent_collection: params.get('consent_collection[terms_of_service]'),
        intent: {
          description: params.get('payment_intent_data[description]'),
          metadata: bag('payment_intent_data[metadata]['),
        },
      };
      sessions.set(id, session);
      return reply(200, publicSession(session, false));
    }

    const one = url.pathname.match(/^\/v1\/checkout\/sessions\/(cs_test_[A-Za-z0-9]+)$/);
    if (method === 'GET' && one) {
      const s = sessions.get(one[1]);
      if (!s) return error(404, `No such checkout.session: '${one[1]}'`);
      const expand = url.searchParams.getAll('expand[]');
      return reply(200, publicSession(s, expand.some((e) => e.startsWith('payment_intent')), expand.includes('payment_intent.latest_charge')));
    }

    if (method === 'GET' && url.pathname === '/v1/payment_intents/search') {
      const query = url.searchParams.get('query') ?? '';
      const m = query.match(/^metadata\['code'\]:'([^']+)' AND status:'succeeded'$/);
      if (!m) return error(400, `Invalid search query: ${query}`);
      const withCharge = url.searchParams.getAll('expand[]').includes('data.latest_charge');
      const data = [...payments.values()].filter((p) => p.searchable && p.metadata.code === m[1] && p.status === 'succeeded').map((p) => publicPayment(p, withCharge));
      return reply(200, { object: 'search_result', data: data.slice(0, Number(url.searchParams.get('limit') ?? 10)), has_more: false });
    }
    return error(404, `Unrecognized request URL (${method}: ${url.pathname})`);
  }

  function publicPayment(p, expandCharge) {
    const { searchable, refunded, disputed, amountRefunded, ...rest } = p;
    return { ...rest, latest_charge: expandCharge && !state.ignoreExpand ? { id: p.charge, object: 'charge', refunded, amount_refunded: amountRefunded, disputed } : p.charge };
  }

  function publicSession(s, expandPayment, expandCharge = false) {
    const { intent, ...rest } = s;
    return { ...rest, payment_intent: s.payment_intent ? (expandPayment ? publicPayment(payments.get(s.payment_intent), expandCharge) : s.payment_intent) : null };
  }

  return {
    key,
    calls,
    sessions,
    payments,
    handle,
    /** The customer pays on Stripe's page. `amount` can be forced, to look at a price that was set up wrongly. */
    pay(sessionId, { amount, createdAt = Math.floor(now() / 1000) } = {}) {
      const s = sessions.get(sessionId);
      if (!s) throw new Error(`no session ${sessionId}`);
      const id = `pi_${alnum(24)}`;
      payments.set(id, {
        id,
        object: 'payment_intent',
        status: 'succeeded',
        amount: amount ?? s.amount_total,
        currency: 'nok',
        created: createdAt,
        description: s.intent.description,
        metadata: s.intent.metadata,
        charge: `ch_${alnum(24)}`,
        refunded: false,
        amountRefunded: 0,
        disputed: false,
        searchable: !state.searchLag,
      });
      s.payment_intent = id;
      s.payment_status = 'paid';
      s.status = 'complete';
      return id;
    },
    /** A refund in the dashboard. Only a refund of the whole amount makes the charge "refunded", as at Stripe. */
    refund(paymentId, { partial = false } = {}) {
      const p = payments.get(paymentId);
      p.amountRefunded = partial ? Math.floor(p.amount / 2) : p.amount;
      p.refunded = !partial;
    },
    /** The customer's bank disputes the charge. */
    dispute(paymentId) {
      payments.get(paymentId).disputed = true;
    },
    /** Search is a while behind at Stripe: with `searchLag` on, a new payment can be found by search only after `flush()`. */
    get searchLag() {
      return state.searchLag;
    },
    set searchLag(value) {
      state.searchLag = Boolean(value);
    },
    /** A Stripe that does not do what `expand[]` asks (the Worker must not hand out a pass on a payment it could not look at). */
    set ignoreExpand(value) {
      state.ignoreExpand = Boolean(value);
    },
    flush() {
      for (const p of payments.values()) p.searchable = true;
    },
    /** The next `count` calls to the pretend Stripe fail with `status` (429, 500, 503 ...). */
    failNext(status = 500, count = 1) {
      state.failures.push(...Array(count).fill(status));
    },
    /** The URL Stripe sends the customer back to, with the session id filled in. */
    successUrl(sessionId) {
      return sessions.get(sessionId).success_url.replace('{CHECKOUT_SESSION_ID}', sessionId);
    },
    /** A fetch() that answers for api.stripe.com. */
    fetch: async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      const { status, body } = handle(init.method ?? 'GET', url, init.body ?? null, init.headers ?? {});
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    },
  };
}
