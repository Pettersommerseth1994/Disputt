// A sample order shaped like what Shopify hands to the order-confirmation e-mail (shopify/ordrebekreftelse.liquid): the same names, and the money in
// øre (cents), as Shopify has it. For trying the file with tools/qa/miniliquid.mjs; it is not Shopify, and what Shopify really hands over is what the
// guide (docs/SHOPIFY.md, part 7) says to look at in a real test order. `order(plan, over)` is a paid order of one package, and `over` replaces any
// of its parts (a part that is set to undefined is left out, as a part that a real order does not have).

/** The variant ids of the three packages in the shop (shop.disputt.site/products.json); the same as VARIANT_EVENING/YEAR/LIFETIME at the payment server. */
export const VARIANT = { evening: 67625895526534, year: 67625896280198, lifetime: 67625896870022 };
const TITLE = { evening: 'Disputt – En kveld (12 timer)', year: 'Disputt – For ett år (12 måneder)', lifetime: 'Disputt – Livstid' };
const PRICE = { evening: 8900, year: 24900, lifetime: 29900 };

/** 8900 → "89,00 kr", the way the shop writes money. */
export const kr = (øre) => `${(øre / 100).toFixed(2).replace('.', ',')} kr`;

/** The filters that only Shopify has. `attached` collects the names of the PDFs that the e-mail asks Shopify to attach. */
export const makeFilters = (attached = []) => ({
  money: (value) => kr(value),
  money_with_currency: (value) => `${kr(value)} NOK`,
  format_address: (a) => [a.name, a.address1, `${a.zip} ${a.city}`, a.country].join('<br>'),
  attach_as_pdf: (policy, name) => {
    attached.push(name);
    return '';
  },
});

/** One line of the order: the package `plan`, with `over` laid on top. */
export const line = (plan, over = {}) => ({
  title: TITLE[plan],
  presentment_title: TITLE[plan],
  quantity: 1,
  original_line_price: PRICE[plan],
  final_line_price: PRICE[plan],
  variant_id: VARIANT[plan],
  variant: { id: VARIANT[plan], title: 'Default Title' },
  product: { title: TITLE[plan] },
  ...over,
});

const vat = (total) => Math.round(total * 0.2); // 25 % on top of a price without VAT is 20 % of a price with it

export function order(plan = 'evening', over = {}) {
  const total = PRICE[plan];
  return {
    order_name: '#1003',
    order_status_url: 'https://shop.disputt.site/107365/orders/4f2c91ab/authenticate?key=abc123',
    financial_status: 'paid',
    attributes: { kode: 'K7M2-9QXD-4TRB', samtykke: '2026-10-07T12:00:00.000Z' },
    order: { customer_locale: 'nb' },
    customer: { first_name: 'Kari' },
    subtotal_line_items: [line(plan)],
    total_discounts: 0,
    total_price: total,
    tax_price: vat(total),
    tax_lines: [{ title: 'MVA', rate: 0.25, rate_percentage: 25, price: vat(total) }],
    transactions: [{ status: 'success', kind: 'sale', gateway_display_name: 'Shopify Payments', payment_details: { credit_card_company: 'Visa', credit_card_last_four_digits: '5031' } }],
    billing_address: { name: 'Kari Nordmann', address1: 'Eksempelveien 1', zip: '0123', city: 'Oslo', country: 'Norge', country_code: 'NO' },
    shop: { terms_of_service: { body: '' }, refund_policy: { body: '' } },
    ...over,
  };
}
