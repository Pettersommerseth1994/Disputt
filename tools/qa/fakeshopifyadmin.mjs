// A pretend Shopify Admin API, for the tests and the QA tools: what the payment server (payments/worker-shopify.js) asks Shopify for when
// a payment with Vipps is finished (the price of a package, whether an order for it exists, and the order itself), and the token it
// needs for that (the client credentials grant: a token for an app in the Dev Dashboard, good for 24 hours).
//
// It is strict where Shopify is: an input the schema does not have is refused as Shopify refuses it (the lists of fields come from
// shopify.dev/docs/api/admin-graphql: OrderCreateOrderInput and the inputs inside it), a token is needed for every call, and an order is
// made once. It also does what Shopify does when an order is made as paid: it calls the webhook "orders/paid" for it, which the payment
// server has to take in its stride (the order is already written down by then).
import http from 'node:http';
import { PRICES, VARIANTS, order as webhookOrder, webhookRequest } from './fakeshopify.mjs';

export const APP = { clientId: 'qa-shopify-client-id', clientSecret: 'qa-shopify-client-secret' };

/** The names that a query for a discount code may use (the fields and types of DiscountCodeBasic and what is inside it, from shopify.dev/docs/api/admin-graphql). */
const DISCOUNT_NAMES = new Set(
  `query code String codeDiscountNodeByCode codeDiscount __typename on DiscountCodeBasic title status startsAt endsAt usageLimit asyncUsageCount appliesOncePerCustomer context
  minimumRequirement DiscountMinimumSubtotal greaterThanOrEqualToSubtotal amount DiscountMinimumQuantity greaterThanOrEqualToQuantity customerGets value DiscountPercentage percentage
  DiscountAmount appliesOnEachItem items DiscountProducts products first nodes id productVariants`.split(/\s+/),
);

/** A code of the shop's as Shopify's API tells it. `spec` changes what the defaults say (a percentage off everything, for everybody, no limit). */
export function discount(spec = {}) {
  return {
    __typename: 'DiscountCodeBasic',
    title: 'Rabatt',
    status: 'ACTIVE',
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: null,
    usageLimit: null,
    asyncUsageCount: 0,
    appliesOncePerCustomer: false,
    context: { __typename: 'DiscountBuyerSelectionAll' },
    minimumRequirement: null,
    customerGets: { value: { __typename: 'DiscountPercentage', percentage: 0.2 }, items: { __typename: 'AllDiscountItems' } },
    ...spec,
  };
}

/** The fields of the inputs, from Shopify's documentation (2026-07 and later). A field that is not here is an error. */
const SCHEMA = {
  order: ['billingAddress', 'currency', 'customAttributes', 'customer', 'discountCode', 'email', 'financialStatus', 'fulfillment', 'fulfillmentStatus', 'lineItems', 'metafields', 'name', 'note', 'phone', 'poNumber', 'presentmentCurrency', 'processedAt', 'referringSite', 'shippingAddress', 'shippingLines', 'sourceIdentifier', 'sourceName', 'sourceUrl', 'tags', 'taxLines', 'taxesIncluded', 'test', 'transactions', 'customer'],
  lineItem: ['fulfillmentService', 'giftCard', 'priceSet', 'productId', 'properties', 'quantity', 'requiresShipping', 'sku', 'taxLines', 'taxable', 'title', 'variantId', 'variantTitle', 'vendor', 'weight'],
  transaction: ['amountSet', 'authorizationCode', 'deviceId', 'gateway', 'giftCardId', 'kind', 'locationId', 'processedAt', 'receiptJson', 'status', 'test', 'userId'],
  taxLine: ['channelLiable', 'priceSet', 'rate', 'title'],
  attribute: ['key', 'value'],
  options: ['inventoryBehaviour', 'sendFulfillmentReceipt', 'sendReceipt'],
};
const FINANCIAL = ['AUTHORIZED', 'EXPIRED', 'PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED', 'PENDING', 'REFUNDED', 'VOIDED'];
const KINDS = ['AUTHORIZATION', 'CAPTURE', 'CHANGE', 'EMV_AUTHORIZATION', 'REFUND', 'SALE', 'SUSPENDED', 'VOID'];
const STATUSES = ['AWAITING_RESPONSE', 'ERROR', 'FAILURE', 'PENDING', 'SUCCESS', 'UNKNOWN'];
const PLAN_OF = Object.fromEntries(Object.entries(VARIANTS).map(([plan, id]) => [id, plan]));
const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

const unknownFields = (input, allowed, where) => Object.keys(input ?? {}).filter((k) => !allowed.includes(k)).map((k) => `${where}: ${k} is not a field`);
const money = (set, where, problems) => {
  const m = set?.shopMoney;
  if (!m || !/^\d+(\.\d+)?$/.test(String(m.amount)) || m.currencyCode !== 'NOK') problems.push(`${where}: shopMoney needs an amount and the currency NOK`);
  return Number(m?.amount ?? 0);
};

/**
 * @param shop       the shop's name at Shopify: the xxx of xxx.myshopify.com
 * @param deliver    how the webhook "orders/paid" reaches the payment server: (topic, payload) => void. Left out: no webhook.
 */
export async function startFakeShopifyAdmin({ app = APP, prices: given = PRICES, currency = 'NOK', deliver, discountsAccess = true } = {}) {
  const discounts = new Map(); // CODE -> the discount (see discount() above)
  const prices = { ...given }; // (a copy: a test that changes a price changes it for itself)
  const kroner = (n) => n.toFixed(2);
  const tokens = new Set();
  const orders = []; // the orders as the pretend shop keeps them: { id, name, tags, email, input, receipt }
  const calls = []; // { path, query: 'mutation' | 'orders' | 'variant' | 'token', status }
  const receipts = []; // the confirmation e-mails that were asked for: { to, order }
  const failures = []; // [{ match, left, status }]
  let nextToken = 1;
  let nextOrder = 2001;
  let origin = '';
  let forgetting = 0; // the next `forgetting` orders are made but the answer is lost (the payment server gets nothing back)

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, origin);
    const send = (status, data, kind) => {
      calls.push({ path: url.pathname, kind, status });
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    try {
      const text = await readBody(req);
      if (req.method === 'POST' && url.pathname === '/admin/oauth/access_token') {
        const form = new URLSearchParams(text);
        if (req.headers['content-type'] !== 'application/x-www-form-urlencoded' || form.get('grant_type') !== 'client_credentials' || form.get('client_id') !== app.clientId || form.get('client_secret') !== app.clientSecret) {
          return send(400, { error: 'invalid_client' }, 'token');
        }
        const token = `shpat_qa_${nextToken++}`;
        tokens.add(token);
        return send(200, { access_token: token, scope: 'read_orders,write_orders,read_products', expires_in: 86399 }, 'token');
      }
      const graphql = url.pathname.match(/^\/admin\/api\/(\d{4}-\d{2}|unstable|latest)\/graphql\.json$/);
      if (req.method === 'POST' && graphql) {
        if (!tokens.has(req.headers['x-shopify-access-token'])) return send(401, { errors: '[API] Invalid API key or access token (unrecognized login or wrong password)' }, 'auth');
        const { query = '', variables = {} } = JSON.parse(text || '{}');
        const injected = failures.find((f) => f.left > 0 && query.includes(f.match));
        if (injected) {
          injected.left--;
          return send(injected.status, { errors: [{ message: 'pretend failure' }] }, 'failure');
        }

        // ---- the price and the name of a package
        if (/productVariant\(id:/.test(query)) {
          const id = String(variables.id ?? '').replace('gid://shopify/ProductVariant/', '');
          const plan = PLAN_OF[id];
          return send(200, { data: { shop: { currencyCode: currency }, productVariant: plan ? { title: 'Default Title', price: prices[plan], product: { id: `gid://shopify/Product/${7_000_000_000_000 + Number(id)}`, title: `Disputt: ${plan}` } } : null } }, 'variant');
        }
        // ---- a discount code
        if (/codeDiscountNodeByCode\(/.test(query)) {
          const unknown = [...new Set(query.match(/[A-Za-z_][A-Za-z0-9_]*/g))].filter((w) => !DISCOUNT_NAMES.has(w));
          if (unknown.length > 0) return send(200, { errors: unknown.map((w) => ({ message: `Field or type '${w}' doesn't exist (the query for a discount code uses a name that Shopify's schema does not have)` })) }, 'discount');
          if (!discountsAccess) return send(200, { errors: [{ message: 'Access denied for codeDiscountNodeByCode field. Required access: `read_discounts` access scope.' }] }, 'discount');
          const found = discounts.get(String(variables.code ?? '').toUpperCase());
          return send(200, { data: { codeDiscountNodeByCode: found ? { codeDiscount: found } : null } }, 'discount');
        }
        // ---- is there an order with this tag?
        if (/orders\(first:/.test(query)) {
          const tag = String(variables.q ?? '').replace(/^tag:/, '');
          const found = orders.find((o) => o.tags.includes(tag));
          return send(200, { data: { orders: { nodes: found ? [{ id: `gid://shopify/Order/${found.id}`, name: found.name, processedAt: found.processedAt }] : [] } } }, 'orders');
        }
        // ---- make an order
        if (/orderCreate\(/.test(query)) {
          const input = variables.order ?? {};
          const options = variables.options ?? {};
          const problems = [...unknownFields(input, SCHEMA.order, 'order'), ...unknownFields(options, SCHEMA.options, 'options')];
          const lines = Array.isArray(input.lineItems) ? input.lineItems : [];
          const transactions = Array.isArray(input.transactions) ? input.transactions : [];
          if (lines.length === 0) problems.push('order.lineItems: needs a line');
          let total = 0;
          for (const [i, line] of lines.entries()) {
            problems.push(...unknownFields(line, SCHEMA.lineItem, `lineItems[${i}]`));
            if (!Number.isInteger(line.quantity)) problems.push(`lineItems[${i}].quantity: Int! is required`);
            if (line.variantId !== undefined && !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(line.variantId)) problems.push(`lineItems[${i}].variantId: not a global id`);
            if (line.priceSet !== undefined) total += money(line.priceSet, `lineItems[${i}].priceSet`, problems) * (line.quantity ?? 1);
            for (const [j, tax] of (line.taxLines ?? []).entries()) {
              problems.push(...unknownFields(tax, SCHEMA.taxLine, `lineItems[${i}].taxLines[${j}]`));
              if (typeof tax.title !== 'string' || typeof tax.rate !== 'number') problems.push(`lineItems[${i}].taxLines[${j}]: title and rate are required`);
              if (tax.priceSet !== undefined) money(tax.priceSet, `lineItems[${i}].taxLines[${j}].priceSet`, problems);
            }
          }
          let paid = 0;
          for (const [i, t] of transactions.entries()) {
            problems.push(...unknownFields(t, SCHEMA.transaction, `transactions[${i}]`));
            if (t.kind !== undefined && !KINDS.includes(t.kind)) problems.push(`transactions[${i}].kind: ${t.kind} is not a value`);
            if (t.status !== undefined && !STATUSES.includes(t.status)) problems.push(`transactions[${i}].status: ${t.status} is not a value`);
            paid += money(t.amountSet, `transactions[${i}].amountSet`, problems);
          }
          for (const [i, a] of (input.customAttributes ?? []).entries()) {
            problems.push(...unknownFields(a, SCHEMA.attribute, `customAttributes[${i}]`));
            if (typeof a.key !== 'string' || typeof a.value !== 'string') problems.push(`customAttributes[${i}]: key and value are strings`);
          }
          if (input.financialStatus !== undefined && !FINANCIAL.includes(input.financialStatus)) problems.push(`order.financialStatus: ${input.financialStatus} is not a value`);
          if (input.currency !== undefined && input.currency !== currency) problems.push('order.currency: not the shop currency');
          if (input.tags !== undefined && !(Array.isArray(input.tags) && input.tags.every((t) => typeof t === 'string'))) problems.push('order.tags: a list of strings');
          if (options.inventoryBehaviour !== undefined && !['BYPASS', 'DECREMENT_IGNORING_POLICY', 'DECREMENT_OBEYING_POLICY'].includes(options.inventoryBehaviour)) problems.push('options.inventoryBehaviour: not a value');
          // (Shopify takes this as a field error: a mutation with a field that is not there is not run at all)
          if (problems.length > 0) return send(200, { errors: problems.map((message) => ({ message: `Variable $order of type OrderCreateOrderInput! was provided invalid value (${message})` })) }, 'mutation');
          // (what Shopify tells in userErrors: an order that is paid for more or less than it costs is not made)
          if (input.financialStatus === 'PAID' && Math.abs(paid - total) > 0.001) return send(200, { data: { orderCreate: { userErrors: [{ field: ['order', 'transactions'], message: 'The transactions do not add up to the total' }], order: null } } }, 'mutation');

          const id = 5_900_000_000_000 + nextOrder;
          const made = {
            id,
            name: `#${nextOrder++}`,
            processedAt: input.transactions?.[0]?.processedAt ?? new Date().toISOString(),
            tags: input.tags ?? [],
            email: input.email ?? null,
            input,
            options,
          };
          orders.push(made);
          if (options.sendReceipt && input.email) receipts.push({ to: input.email, order: made });
          // Shopify says "orders/paid" for an order that is made as paid: the REST shape that webhooks have
          const plan = PLAN_OF[String(lines[0]?.variantId ?? '').replace('gid://shopify/ProductVariant/', '')];
          if (deliver && input.financialStatus === 'PAID' && plan) {
            const attributes = (input.customAttributes ?? []).map((a) => ({ name: a.key, value: a.value }));
            deliver('orders/paid', { ...webhookOrder({ plan, id, name: made.name, attributes, test: input.test === true, paidAt: new Date(made.processedAt), price: kroner(total) }), email: input.email ?? null });
          }
          if (forgetting > 0) {
            forgetting--;
            res.destroy(); // (the order exists, and the answer never arrives)
            return undefined;
          }
          return send(200, { data: { orderCreate: { userErrors: [], order: { id: `gid://shopify/Order/${id}`, name: made.name, processedAt: made.processedAt } } } }, 'mutation');
        }
        return send(200, { errors: [{ message: 'pretend Shopify does not know this query' }] }, 'unknown');
      }
      return send(404, { errors: 'Not Found' }, 'unknown');
    } catch (err) {
      console.error('fake Shopify admin:', err);
      send(500, { errors: String(err) }, 'error');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;

  return {
    url: origin,
    app,
    orders,
    calls,
    receipts,
    /** The next `count` calls whose query contains `match` (a piece of the GraphQL text) get an error. */
    failNext: (match, count = 1, status = 503) => failures.push({ match, left: count, status }),
    /** The next order is made, but the answer to the payment server is lost: it does not know if it was made. */
    loseNextAnswer: (count = 1) => {
      forgetting = count;
    },
    /** Every token is withdrawn. */
    revokeTokens: () => tokens.clear(),
    /** A code the shop has: addDiscount('VENN20', { customerGets: … }) (see discount()). The same code in any case finds it, as in Shopify. */
    addDiscount: (code, spec) => discounts.set(String(code).toUpperCase(), discount(spec)).get(String(code).toUpperCase()),
    discounts,
    setPrice: (plan, price) => {
      prices[plan] = price;
    },
    stop: async () => {
      server.closeAllConnections?.();
      server.close();
    },
    /** For a test that wants to deliver the webhook itself. */
    webhookRequest,
  };
}
