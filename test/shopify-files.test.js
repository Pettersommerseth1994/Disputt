// The files that go into Shopify (shopify/): tried with the little Liquid that tools/qa/miniliquid.mjs knows, and held to what the page and the
// payment server say about the same things (the name of the cart attribute that carries the code, the address of the game, the packages).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { PLANS } from '../public/js/pay/plans.js';
import { renderLiquid } from '../tools/qa/miniliquid.mjs';
import { line, makeFilters, order, VARIANT } from '../tools/qa/shopify-order.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readBinary = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const FRONT = read('shopify/forside.liquid');
const MAIL = read('shopify/ordrebekreftelse.liquid');
const text = (html) =>
  html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&zwnj;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

describe('the little Liquid that the tests know', () => {
  const r = (source, vars = {}, options) => renderLiquid(source, vars, options);

  it('does comments, names, escape, if, elsif, else and unless', () => {
    assert.equal(r('a{% comment %}hidden {{ nope }}{% endcomment %}b'), 'ab');
    assert.equal(r('{% if x.y %}yes{% else %}no{% endif %}', { x: { y: 'v' } }), 'yes');
    assert.equal(r('{% if x.y %}yes{% else %}no{% endif %}'), 'no');
    assert.equal(r('{% if x %}yes{% endif %}', { x: '' }), 'yes', 'in Liquid an empty text is true');
    assert.equal(r('{{ x | escape }}', { x: '<b>"&"</b>' }), '&lt;b&gt;&quot;&amp;&quot;&lt;/b&gt;');
    assert.equal(r('{% if a %}{% if b %}1{% else %}2{% endif %}{% else %}3{% endif %}', { a: 1, b: 0 }), '1', 'nested (0 is true in Liquid)');
    assert.equal(r('{% if a == 1 %}A{% elsif a == 2 %}B{% else %}C{% endif %}', { a: 2 }), 'B');
    assert.equal(r('{% if a == 1 %}A{% elsif a == 2 %}B{% else %}C{% endif %}', { a: 3 }), 'C');
    assert.equal(r('{% unless x %}no{% else %}yes{% endunless %}', { x: 1 }), 'yes');
    assert.equal(r('{% unless x %}no{% else %}yes{% endunless %}'), 'no');
  });

  it('trims the spaces next to a tag that has a "-" at the brace', () => {
    assert.equal(r('a  {%- if x -%}  b  {%- endif -%}  c', { x: 1 }), 'abc');
    assert.equal(r('a  {{- x -}}  b', { x: 1 }), 'a1b');
    assert.equal(r('a  {% if x %}  b  {% endif %}  c', { x: 1 }), 'a    b    c', 'and leaves the spaces alone otherwise');
  });

  it('assigns and captures, and chains filters from the left', () => {
    assert.equal(r('{% assign a = "Hei" | append: " du" | upcase %}{{ a }}'), 'HEI DU');
    assert.equal(r('{% capture c %}x{{ y }}{% endcapture %}[{{ c }}]', { y: 2 }), '[x2]');
    assert.equal(r('{{ a | default: "d" }}|{{ b | default: "d" }}|{{ c | default: "d" }}|{{ e | default: "d" }}|{{ f | default: "d" }}', { b: '', c: false, e: 0, f: 'v' }), 'd|d|d|0|v');
    assert.equal(r('{% assign lang = x | default: y | default: "nb" | downcase | slice: 0, 2 %}{{ lang }}', { y: 'DA-dk' }), 'da');
    assert.equal(r('{{ x | round }} {{ y | round: 1 }} {{ 25.0 | round }}', { x: 24.6, y: 24.66 }), '25 24.7 25');
    assert.equal(r('{{ x | round: 1 | remove: ".0" | replace: ".", "," }}|{{ y | round: 1 | remove: ".0" | replace: ".", "," }}', { x: 25, y: 25.5 }), '25|25,5', 'the way the e-mail writes a VAT rate');
    assert.equal(r('{{ s | size }} {{ list | size }}', { s: 'abc', list: [1, 2] }), '3 2');
    assert.equal(r('{% assign a = 1 %}{% assign a = 2 %}{{ a }}'), '2');
    assert.equal(r('{{ x | remove: "a" }}|{{ x | replace: "a", "o" }}', { x: 'banana' }), 'bnn|bonono', 'remove and replace take every place, not the first');
  });

  it('loops with forloop, takes {% else %} for an empty or missing list, and lets an assign inside the loop out', () => {
    assert.equal(r('{% for i in list %}{{ i }}{% if forloop.last %}.{% else %},{% endif %}{% endfor %}', { list: [1, 2, 3] }), '1,2,3.');
    assert.equal(r('{% for i in list %}x{% else %}none{% endfor %}', { list: [] }), 'none');
    assert.equal(r('{% for i in list %}x{% else %}none{% endfor %}'), 'none');
    assert.equal(r('{% for i in list %}{% assign last = i %}{% endfor %}{{ last }}', { list: [1, 2, 3] }), '3');
    assert.throws(() => r('{% for i in list %}{% endfor %}{{ i }}', { list: [1] }), /not set/, 'the variable of the loop does not leak');
    assert.equal(r('{{ list.size }}/{{ list.first }}/{{ list.last }}', { list: [4, 5, 6] }), '3/4/6');
  });

  it('compares like Liquid: only numbers with numbers, and "and" and "or" read from the right', () => {
    assert.equal(r('{% if a == "1" %}y{% else %}n{% endif %}', { a: 1 }), 'n', 'the number 1 is not the text "1"');
    assert.equal(r('{% if a > 0 %}y{% else %}n{% endif %}', { a: 5 }), 'y');
    assert.equal(r('{% if a > 0 %}y{% else %}n{% endif %}'), 'n', 'nothing is not more than 0');
    assert.equal(r('{% if a > 0 %}y{% else %}n{% endif %}', { a: '5' }), 'n', 'a text is not compared with a number');
    assert.equal(r('{% if s contains "ab" %}y{% else %}n{% endif %}', { s: 'xabx' }), 'y');
    assert.equal(r('{% if s contains "ab" %}y{% else %}n{% endif %}'), 'n');
    assert.equal(r('{% if list contains 2 %}y{% else %}n{% endif %}', { list: [1, 2] }), 'y');
    assert.equal(r('{% if a and b or c %}y{% else %}n{% endif %}', { a: false, b: false, c: true }), 'n', 'a and (b or c), not (a and b) or c');
    assert.equal(r('{% if a or b and c %}y{% else %}n{% endif %}', { a: true, b: false, c: false }), 'y');
    for (const [value, blank] of [['', true], [' ', true], [null, true], [false, true], [[], true], ['a', false], [0, false]]) {
      assert.equal(r('{% if x == blank %}y{% else %}n{% endif %}', { x: value }), blank ? 'y' : 'n', `blank: ${JSON.stringify(value)}`);
      assert.equal(r('{% if x != blank %}y{% else %}n{% endif %}', { x: value }), blank ? 'n' : 'y');
    }
    assert.equal(r('{% if x == blank %}y{% else %}n{% endif %}'), 'y', 'a name that is not set is blank');
  });

  it('knows the filters that only Shopify has when it is given them, and says so when it is asked for more', () => {
    assert.equal(r('{{ x | money }}', { x: 8900 }, { filters: { money: (v) => `${v / 100} kr` } }), '89 kr');
    assert.throws(() => r('{{ x | money }}', { x: 1 }), /filter "money" is not tried/);
    assert.throws(() => r('{{ x | sort }}', { x: 1 }), /filter "sort" is not tried/);
    assert.throws(() => r('{% include "x" %}'), /tag "include" is not tried/);
    assert.throws(() => r('{% case x %}{% endcase %}', { x: 1 }), /tag "case" is not tried/);
    assert.throws(() => r('{% if (a or b) %}x{% endif %}', { a: 1 }), /not a name/, 'there are no brackets in Liquid\'s tests');
    assert.throws(() => r('{% if a == b == c %}x{% endif %}', { a: 1 }), /more than a comparison/);
    assert.throws(() => r('{% for i in a.b | sort %}{% endfor %}'), /more than a plain for-loop/);
    assert.throws(() => r('{{ a-b }}', { a: 1 }), /not a name/);
  });

  it('says when something is never closed, or a name is not set when it is written out', () => {
    assert.throws(() => r('{% if x %}never closed', { x: 1 }), /never closed/);
    assert.throws(() => r('{% for i in x %}never closed', { x: [] }), /never closed/);
    assert.throws(() => r('{% capture c %}never closed'), /never closed/);
    assert.throws(() => r('{% comment %}never closed'), /never closed/);
    assert.throws(() => r('{% if x %}a{% endunless %}', { x: 1 }), /closed with/);
    assert.throws(() => r('{{ missing }}'), /not set/);
    assert.throws(() => r('{{ x.y }}', { x: {} }), /not set/);
    assert.throws(() => r('{{ x }}', { x: { a: 1 } }), /not a text or a number/);
    assert.throws(() => r('{% for i in x %}{% endfor %}', { x: 'text' }), /not a list/);
  });
});

describe('the order confirmation (shopify/ordrebekreftelse.liquid)', () => {
  const html = (plan = 'evening', over = {}, attached = []) => renderLiquid(MAIL, order(plan, over), { filters: makeFilters(attached) });
  const said = (plan, over, attached) => text(html(plan, over, attached));
  const langOf = (over) => /<html lang="(\w+)">/.exec(html('evening', over))[1];
  const DK = { name: 'Mette Hansen', address1: 'Eksempelvej 12', zip: '2100', city: 'København Ø', country: 'Danmark', country_code: 'DK' };

  describe('in Norwegian', () => {
    const mail = html();
    const t = text(mail);

    it('thanks the customer and shows the code that the page made up, for how long it lasts, and that it is ready', () => {
      assert.match(mail, /<html lang="nb">/);
      assert.match(t, /Takk for bestillingen! Bestilling #1003/);
      assert.match(t, /Koden din K7M2-9QXD-4TRB Gjelder i 12 timer fra betalingen Fornyes ikke av seg selv\. Tilgangen er klar i spillet allerede\./);
    });

    it('says how to use the code on another phone, with the name of the button that the game really has', () => {
      assert.match(t, /Skal du bruke den på en annen telefon\? 1 Åpne Disputt 2 Trykk «Allerede kunde\? Logg inn» 3 Skriv inn koden Ta vare på denne e-posten\./);
      assert.ok(read('public/js/screens/home.js').includes('Logg inn'), 'the game has a button called "Logg inn" (and the e-mail says "Allerede kunde? Logg inn" in every language until the game is translated)');
    });

    it('lists what was bought, the total with VAT, how it was paid and the billing address', () => {
      assert.match(t, /Bestillingen din Disputt – En kveld \(12 timer\) × 1 89,00 kr Totalt 89,00 kr NOK Herav mva \(25 %\) 17,80 kr/);
      assert.match(t, /Betalt med Visa •••• 5031 Fakturaadresse Kari Nordmann Eksempelveien 1 0123 Oslo Norge/);
    });

    it('confirms the consent to getting the access at once, and that the right of withdrawal ends, and names the terms', () => {
      assert.match(t, /Angrerett: Du godtok vilkårene og at tilgangen leveres med en gang før du betalte\. Da bortfaller angreretten \(angrerettloven § 22\)\./);
      assert.match(mail, /href="https:\/\/disputt\.site\/vilkar\.html"/);
      assert.match(mail, /href="https:\/\/disputt\.site\/personvern\.html"/);
    });

    it('says who sells it and where to ask, and links to the game, the order and the mail address', () => {
      assert.match(t, /Spørsmål\? Svar på denne e-posten eller skriv til kontakt@disputt\.site Vilkår · Personvern Pesom Holding AS · org\.nr\. 923 729 674 MVA · Agathe Grøndahls gate 46, 0478 Oslo/);
      assert.match(mail, /<a href="https:\/\/disputt\.site\/" target="_blank"[^>]*>Åpne Disputt<\/a>/);
      assert.match(mail, /href="https:\/\/shop\.disputt\.site\/107365\/orders\/4f2c91ab\/authenticate\?key=abc123"[^>]*>Se bestillingen din</);
      assert.match(mail, /href="mailto:kontakt@disputt\.site"/);
    });
  });

  describe('in Danish and Swedish', () => {
    it('writes Danish for a Danish customer, and everything that matters is still there', () => {
      const mail = html('evening', { order: { customer_locale: 'da-DK' }, billing_address: DK });
      const t = text(mail);
      assert.match(mail, /<html lang="da">/);
      assert.match(t, /Tak for din bestilling! Ordre #1003/);
      assert.match(t, /Din kode K7M2-9QXD-4TRB Gælder i 12 timer fra betalingen Fornyes ikke automatisk\. Adgangen er allerede klar i spillet\./);
      assert.match(t, /Skal du bruge den på en anden telefon\? 1 Åbn Disputt 2 Tryk på «Allerede kunde\? Logg inn» 3 Indtast koden Gem denne e-mail\./);
      assert.match(t, /Din ordre Disputt – En kveld \(12 timer\) × 1 89,00 kr I alt 89,00 kr NOK Heraf moms \(25 %\) 17,80 kr/);
      assert.match(t, /Betalt med Visa •••• 5031 Faktureringsadresse Mette Hansen Eksempelvej 12 2100 København Ø Danmark/);
      assert.match(t, /Fortrydelsesret: Du accepterede vilkårene og at adgangen leveres med det samme, før du betalte\. Dermed bortfalder fortrydelsesretten\./);
      assert.match(t, /Spørgsmål\? Svar på denne e-mail eller skriv til kontakt@disputt\.site Vilkår · Privatlivspolitik/);
      assert.doesNotMatch(t, /Takk for|Gjelder|Herav|Angrerett|Bestillingen din/, 'no Norwegian is left behind');
    });

    it('writes Swedish for a Swedish customer, and everything that matters is still there', () => {
      const mail = html('evening', { order: undefined, customer: { first_name: 'Sven', locale: 'sv' } });
      const t = text(mail);
      assert.match(mail, /<html lang="sv">/);
      assert.match(t, /Tack för din beställning! Order #1003/);
      assert.match(t, /Din kod K7M2-9QXD-4TRB Gäller i 12 timmar från betalningen Förnyas inte automatiskt\. Tillgången är redan klar i spelet\./);
      assert.match(t, /Ska du använda den på en annan telefon\? 1 Öppna Disputt 2 Tryck på «Allerede kunde\? Logg inn» 3 Skriv in koden Spara det här mejlet\./);
      assert.match(t, /Din beställning Disputt – En kveld \(12 timer\) × 1 89,00 kr Totalt 89,00 kr NOK Varav moms \(25 %\) 17,80 kr/);
      assert.match(t, /Betalat med Visa •••• 5031 Faktureringsadress/);
      assert.match(t, /Ångerrätt: Du godkände villkoren och att tillgången levereras direkt innan du betalade\. Då förlorar du ångerrätten\./);
      assert.match(t, /Frågor\? Svara på det här mejlet eller skriv till kontakt@disputt\.site Villkor · Integritetspolicy/);
      assert.doesNotMatch(t, /Takk for|Gjelder|Herav|Angrerett|Bestillingen din|Tak for|Gælder|Heraf/, 'no Norwegian or Danish is left behind');
    });

    it('picks the language from the attribute "sprak", then the language on the order, then the customer, and ends with Norwegian', () => {
      const attrs = (sprak) => ({ kode: 'K7M2-9QXD-4TRB', samtykke: 'x', ...(sprak ? { sprak } : {}) });
      assert.equal(langOf({}), 'nb');
      assert.equal(langOf({ order: { customer_locale: 'da' } }), 'da');
      assert.equal(langOf({ order: { customer_locale: 'sv-SE' } }), 'sv');
      assert.equal(langOf({ order: { customer_locale: 'DA' } }), 'da', 'in capitals too');
      assert.equal(langOf({ order: undefined, customer: { locale: 'sv' } }), 'sv');
      assert.equal(langOf({ order: undefined, customer: undefined }), 'nb', 'a template that is not told anything is Norwegian');
      assert.equal(langOf({ order: { customer_locale: 'nb' }, customer: { locale: 'da' } }), 'nb', 'the language on the order before the customer\'s');
      assert.equal(langOf({ order: { customer_locale: 'en' } }), 'nb', 'a language that the e-mail has no text for gets Norwegian');
      assert.equal(langOf({ order: { customer_locale: 'nn' } }), 'nb');
      assert.equal(langOf({ order: { customer_locale: 'nb' }, attributes: attrs('sv') }), 'sv', 'the game can say which language, and that goes before Shopify\'s');
      assert.equal(langOf({ order: { customer_locale: 'sv' }, attributes: attrs('xx') }), 'nb', 'an attribute that says something that is not a language gives Norwegian');
    });

    it('has the same texts in all three languages: nothing was added to one and forgotten in the others', () => {
      const start = MAIL.indexOf("{%- if lang == 'da' -%}");
      const sv = MAIL.indexOf("{%- elsif lang == 'sv' -%}");
      const nb = MAIL.indexOf("{%- else -%}\n  {%- assign lang = 'nb' -%}");
      const end = MAIL.indexOf('{%- endif -%}', nb);
      assert.ok(start > 0 && sv > start && nb > sv && end > nb, 'the three blocks are where the test looks for them');
      const names = (block) => [...block.matchAll(/assign (t_[a-z0-9_]+) =/g)].map((m) => m[1]).sort();
      const norwegian = names(MAIL.slice(nb, end));
      assert.ok(norwegian.length > 30, `there are ${norwegian.length} texts`);
      assert.deepEqual(names(MAIL.slice(start, sv)), norwegian, 'Danish has every text that Norwegian has');
      assert.deepEqual(names(MAIL.slice(sv, nb)), norwegian, 'Swedish has every text that Norwegian has');
      for (const name of norwegian) assert.ok((MAIL.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length >= 4, `${name} is set in all three languages and used`);
    });
  });

  describe('how long it lasts', () => {
    it('says the length of each package, the same as the game says', () => {
      for (const plan of PLANS.filter((p) => p.id !== 'lifetime')) {
        assert.match(said(plan.id), new RegExp(`Gjelder i ${plan.length} fra betalingen Fornyes ikke av seg selv\\.`), plan.name);
      }
      assert.match(said('lifetime'), /Gjelder så lenge Disputt finnes Du betaler bare én gang\./);
      assert.doesNotMatch(said('lifetime'), /Fornyes/);
      assert.ok(PLANS.find((p) => p.id === 'lifetime').detail.includes('Gjelder så lenge Disputt finnes'), 'the game says the same about Livstid');
    });

    it('knows the package by the variant id, then by the name, and says something true when it knows neither', () => {
      assert.deepEqual(Object.keys(VARIANT), PLANS.map((p) => p.id), 'the same three packages, in the same order, as the game');
      for (const id of Object.values(VARIANT)) assert.ok(MAIL.includes(`== '${id}' `), `the variant ${id} is in the file`);
      const pill = (over) => said('evening', { subtotal_line_items: [line('evening', over)] }).match(/Gjelder [^.]*?(?= Fornyes| Du betaler)/)?.[0];
      assert.equal(pill({}), 'Gjelder i 12 timer fra betalingen');
      assert.equal(pill({ title: 'Noe annet', presentment_title: undefined, product: { title: 'Noe annet' } }), 'Gjelder i 12 timer fra betalingen', 'the variant id alone is enough, with a name that says nothing');
      assert.equal(pill({ variant_id: VARIANT.year, variant: { id: VARIANT.year } }), 'Gjelder i 12 måneder fra betalingen', 'the variant id says it, whatever the name says');
      assert.equal(pill({ variant_id: undefined, variant: { id: VARIANT.lifetime } }), 'Gjelder så lenge Disputt finnes', 'the id from the variant, when the line has none of its own');
      assert.equal(pill({ variant_id: undefined, variant: undefined, title: 'Disputt – For ett år (12 måneder)', presentment_title: undefined }), 'Gjelder i 12 måneder fra betalingen', 'the name, when there is no variant id to be had');
      assert.equal(pill({ variant_id: undefined, variant: undefined, title: 'Disputt – Livstid', presentment_title: undefined }), 'Gjelder så lenge Disputt finnes');
      const unknown = said('evening', { subtotal_line_items: [line('evening', { variant_id: 111, variant: { id: 111 }, title: 'Noe annet', presentment_title: undefined, product: { title: 'Noe annet' } })] });
      assert.match(unknown, /Koden din K7M2-9QXD-4TRB Hvor lenge tilgangen varer, står i pakken du kjøpte og i vilkårene\./);
      assert.doesNotMatch(unknown, /Gjelder i 12 timer/);
    });

    it('lets the dearest package count when an order has more than one, as the payment server does', () => {
      const two = (a, b) => said('evening', { subtotal_line_items: [line(a), line(b)] });
      assert.match(two('evening', 'lifetime'), /Gjelder så lenge Disputt finnes/);
      assert.match(two('lifetime', 'evening'), /Gjelder så lenge Disputt finnes/, 'in either order');
      assert.match(two('evening', 'year'), /Gjelder i 12 måneder fra betalingen/);
      assert.match(read('payments/worker-shopify.js'), /\.sort\(\(a, b\) => PLANS\[b\]\.rank - PLANS\[a\]\.rank\)/, 'the same rule at the payment server');
    });
  });

  describe('an order that is not an ordinary, paid order from the game', () => {
    it('says what to do when the order has no code, and shows neither a code nor how to use one', () => {
      const t = said('evening', { attributes: {} });
      assert.match(t, /Har du betalt uten å få en kode i spillet\? Svar på denne e-posten, eller skriv til kontakt@disputt\.site med ordrenummeret, så hjelper vi deg\./);
      assert.doesNotMatch(t, /Koden din|Skal du bruke den|Tilgangen er klar/);
      assert.doesNotMatch(t, /Angrerett/, 'and claims no consent that was never given');
      assert.match(t, /Bestillingen din Disputt – En kveld/, 'but the order is still there');
      assert.doesNotMatch(said('evening', { attributes: { samtykke: '2026-10-07T12:00:00.000Z' } }), /Angrerett/, 'nor a consent without a code: no access was given, so there is nothing for the right of withdrawal to lapse for');
    });

    it('does not show a code that the payment server will not honour: without the consent no access is given', () => {
      const t = said('evening', { attributes: { kode: 'K7M2-9QXD-4TRB' } });
      assert.doesNotMatch(t, /K7M2/);
      assert.match(t, /Har du betalt uten å få en kode/);
      assert.match(read('payments/worker-shopify.js'), /no_consent/, 'the server really does give nothing without the consent');
    });

    it('says that the access starts when the payment is confirmed, while the payment is awaited, and not for an order that was paid and later refunded', () => {
      for (const status of ['pending', 'authorized', 'partially_paid']) {
        const t = said('evening', { financial_status: status, transactions: [] });
        assert.match(t, /Koden din K7M2-9QXD-4TRB .*Tilgangen aktiveres så snart betalingen er bekreftet\./, status);
        assert.doesNotMatch(t, /klar i spillet allerede|Betalt med/, status);
      }
      for (const status of ['paid', 'refunded', 'partially_refunded']) {
        assert.match(said('evening', { financial_status: status }), /Tilgangen er klar i spillet allerede\./, `${status}: an order that is sent again after a refund says what a new order says`);
      }
    });

    it('shows a discount as its own line, and the total after it', () => {
      const t = said('evening', { total_discounts: 2000, total_price: 6900, tax_price: 1380, tax_lines: [{ rate_percentage: 25 }] });
      assert.match(t, /× 1 89,00 kr Rabatt −20,00 kr Totalt 69,00 kr NOK Herav mva \(25 %\) 13,80 kr/);
    });

    it('leaves out the parts that the order does not have, and the percentage when it is not certain', () => {
      const t = said('evening', { order_status_url: undefined, transactions: [], billing_address: undefined, tax_lines: [], total_discounts: undefined });
      assert.doesNotMatch(t, /Betalt med|Fakturaadresse|Se bestillingen din|Rabatt/);
      assert.match(t, /Herav mva 17,80 kr/, 'the VAT line without a percentage when there is no tax line to take it from');
      assert.match(said('evening', { tax_price: 0, tax_lines: [] }), /Totalt 89,00 kr NOK Skal du bruke|Totalt 89,00 kr NOK Betalt med/, 'and no VAT line for an order without VAT');
      assert.doesNotMatch(said('evening', { tax_price: 0, tax_lines: [] }), /Herav mva/);
    });

    it('writes the VAT rate the way the order has it: 25 %, 25,5 %, and none when there are several tax lines', () => {
      assert.match(said('evening', { tax_lines: [{ rate_percentage: 25.0 }] }), /Herav mva \(25 %\)/);
      assert.match(said('evening', { tax_lines: [{ rate_percentage: 25.5 }] }), /Herav mva \(25,5 %\)/);
      assert.match(said('evening', { tax_lines: [{ rate_percentage: 15 }, { rate_percentage: 10 }] }), /Herav mva 17,80 kr/, 'two tax lines: no percentage, because it would be only one of them');
    });

    it('names the card or the other way of paying, and the first payment that went through', () => {
      const other = said('evening', { transactions: [{ status: 'success', kind: 'sale', gateway_display_name: 'Shopify Payments', payment_details: { payment_method_display_name: 'Klarna' } }] });
      assert.match(other, /Betalt med Klarna/);
      const gateway = said('evening', { transactions: [{ status: 'success', kind: 'capture', gateway_display_name: 'Vipps', payment_details: {} }] });
      assert.match(gateway, /Betalt med Vipps/);
      const failed = said('evening', { transactions: [{ status: 'failure', kind: 'sale', gateway_display_name: 'Shopify Payments', payment_details: { credit_card_company: 'Visa' } }, { status: 'success', kind: 'sale', gateway_display_name: 'Shopify Payments', payment_details: { credit_card_company: 'Mastercard', credit_card_last_four_digits: '1111' } }] });
      assert.match(failed, /Betalt med Mastercard •••• 1111/);
      assert.doesNotMatch(failed, /Visa/);
    });
  });

  describe('what it writes out', () => {
    it('cannot be made to carry anything else: the code and the names are written out as text', () => {
      const mail = html('evening', { attributes: { kode: '<script>alert(1)</script>', samtykke: 'x' }, subtotal_line_items: [line('evening', { presentment_title: 'A <b>fat</b> & "name"' })] });
      assert.ok(!mail.includes('<script>') && !mail.includes('<b>fat</b>'));
      assert.ok(mail.includes('&lt;script&gt;') && mail.includes('A &lt;b&gt;fat&lt;/b&gt; &amp; &quot;name&quot;'));
    });

    it('is whole HTML in every case: nothing of Liquid left, every tag closed, and small enough for Gmail', () => {
      const cases = [
        html(), html('year'), html('lifetime'), html('evening', { attributes: {} }), html('evening', { financial_status: 'pending', transactions: [] }),
        html('evening', { order: { customer_locale: 'da' } }), html('evening', { order: { customer_locale: 'sv' } }), html('evening', { order: undefined, transactions: [], billing_address: undefined, order_status_url: undefined, tax_price: 0 }),
      ];
      for (const mail of cases) {
        assert.ok(mail.startsWith('<!DOCTYPE html>') && mail.endsWith('</html>'), 'starts and ends as a page: no spaces before it and nothing after it');
        assert.doesNotMatch(mail, /{{|{%|}}|%}/);
        for (const tag of ['table', 'tr', 'td', 'div', 'a', 'b', 'h1', 'style', 'head', 'body']) {
          assert.equal((mail.match(new RegExp(`<${tag}[\\s>]`, 'g')) ?? []).length, (mail.match(new RegExp(`</${tag}>`, 'g')) ?? []).length, `every <${tag}> is closed`);
        }
        assert.ok(Buffer.byteLength(mail) < 60_000, `${Buffer.byteLength(mail)} byte: Gmail cuts an e-mail off at 102 000`);
        assert.doesNotMatch(mail, /<script/i);
        assert.equal((mail.match(/<img /g) ?? []).length, (mail.match(/<img [^>]*alt="[^"]+"/g) ?? []).length, 'every picture has an alt text, which is what a mail program shows when it does not load pictures');
        for (const [, url] of mail.matchAll(/href="([^"]*)"/g)) assert.match(url, /^(https:\/\/|mailto:)/, `${url} is a web or mail address, not something else`);
      }
    });

    it('uses the colours of the app, and no pure white or black (the design rule), written as solid colours that every mail program knows', () => {
      assert.doesNotMatch(MAIL, /#fff\b|#ffffff|#000\b|#000000|:\s*(white|black)\b|rgba?\(/i);
      const tokens = read('public/css/tokens.css').toLowerCase();
      for (const colour of ['#6a1428', '#3d0a18', '#f8e6b8', '#3a2012', '#fae025', '#d7b800']) {
        assert.ok(tokens.includes(colour), `${colour} is in tokens.css`);
        assert.ok(MAIL.toLowerCase().includes(colour), `${colour} is in the mail`);
      }
      const tints = ['#7a4a2c', '#e4c9a4', '#d9b898', '#c3af89']; // the cream and the ink mixed into the burgundy and the cream, as solid colours
      const used = new Set(MAIL.toLowerCase().match(/#[0-9a-f]{6}\b/g));
      for (const colour of used) assert.ok(tints.includes(colour) || tokens.includes(colour), `${colour} is a colour of the app`);
    });

    it('is made for a small phone first: the code and the cards are small without a style sheet, and grow where there is room', () => {
      assert.match(MAIL, /class="code" style="[^"]*font-size:24px;line-height:30px;letter-spacing:2px;/, 'the code is 263 px wide as it stands: it fits a 360 px phone even in a mail program that drops the style sheet');
      assert.match(MAIL, /@media only screen and \(min-width: 481px\) \{[^}]*\.code \{[^}]*font-size: 28px/, 'and it grows where there is room');
      assert.match(MAIL, /@media only screen and \(max-width: 340px\) \{[^}]*\.code \{[^}]*font-size: 21px/, 'and shrinks for the smallest phones');
      assert.doesNotMatch(MAIL, /\.code \{[^}]*font-size: 25px/, 'the old rule is gone');
      assert.match(MAIL, /td p \{ margin: 0 !important; \}/, 'the address that Shopify writes in a paragraph has no margin round it');
      assert.equal((MAIL.match(/padding:26px 20px/g) ?? []).length, 3, 'the three cards have 20 px at the sides, and 28 px where there is room');
    });

    it('has a picture at the top that exists on the site, at twice the size it is shown at', () => {
      const [, path, width, height] = MAIL.match(/<img src="https:\/\/disputt\.site\/(assets\/email\/[^"?]+)(?:\?v=\d+)?" width="(\d+)" height="(\d+)"/);
      const png = readBinary(`public/${path}`);
      assert.deepEqual([...png.slice(0, 4)], [137, 80, 78, 71], 'a PNG');
      const at = (offset) => png[offset] * 2 ** 24 + png[offset + 1] * 2 ** 16 + png[offset + 2] * 2 ** 8 + png[offset + 3];
      assert.deepEqual([at(16), at(20)], [width * 2, height * 2], 'shown at width x height, drawn at twice that');
      assert.match(read('tools/logo/email-header.html'), /\.box \{[^}]*width: 340px; height: 136px/, 'and made by tools/logo/email-header.html at the same size');
    });
  });

  describe('the PDFs for Danish and German customers', () => {
    const policies = { terms_of_service: { body: 'Vilkår' }, refund_policy: { body: 'Angrerett' } };

    it('asks Shopify to attach the terms and the right of withdrawal for a customer in Denmark or Germany, named in the customer\'s language', () => {
      const da = [];
      html('evening', { order: { customer_locale: 'da' }, billing_address: DK, shop: policies }, da);
      assert.deepEqual(da, ['Handelsbetingelser', 'Fortrydelsesret']);
      const de = [];
      html('evening', { billing_address: { ...DK, country_code: 'DE' }, shop: policies }, de);
      assert.deepEqual(de, ['Vilkår for bruk', 'Retningslinjer for angrerett']);
      const sv = [];
      html('evening', { order: { customer_locale: 'sv' }, billing_address: { ...DK, country_code: 'DK' }, shop: policies }, sv);
      assert.deepEqual(sv, ['Villkor', 'Ångerrätt']);
    });

    it('attaches nothing for other countries, and nothing that the shop has not written', () => {
      const no = [];
      html('evening', { shop: policies }, no);
      assert.deepEqual(no, []);
      const empty = [];
      html('evening', { billing_address: DK }, empty);
      assert.deepEqual(empty, []);
      const onlyTerms = [];
      html('evening', { billing_address: DK, shop: { terms_of_service: { body: 'x' }, refund_policy: { body: '' } } }, onlyTerms);
      assert.deepEqual(onlyTerms, ['Vilkår for bruk']);
    });
  });
});

describe('the front page of the shop (shopify/forside.liquid)', () => {
  const html = renderLiquid(FRONT, {});

  it('thanks the customer and closes the tab on a tap, for a tab that the game opened', () => {
    assert.match(text(html), /Takk!/);
    assert.match(html, /id="disputt-close"/);
    assert.match(html, /window\.close\(\)/);
    assert.match(text(html), /Fanen lot seg ikke lukke her\. Bytt tilbake til fanen med spillet/);
  });

  it('shows the link to the game only to a tab that the game did not open, and never says "close it yourself and you are back"', () => {
    assert.match(html, /getElementById\(window\.opener \? 'disputt-from-game' : 'disputt-no-game'\)\.hidden = false/);
    assert.match(html, /id="disputt-no-game" hidden>[\s\S]*href="https:\/\/disputt\.site\/"/, 'the link sits in the part that is hidden from a tab with an opener');
    assert.doesNotMatch(html.match(/<div id="disputt-from-game"[\s\S]*?<\/div>/)[0], /href=/, 'a tab that the game opened has no link to the game: it would open the game a second time, with a copy of the room');
    assert.match(html, /<noscript>[\s\S]*href="https:\/\/disputt\.site\/"/, 'and a browser without scripts gets the link');
    assert.doesNotMatch(text(html), /Lukk den selv/);
  });

  it('has nothing in it that depends on Shopify: no tags and no names are left for Liquid', () => {
    assert.ok(!/{%|{{/.test(html));
  });
});

describe('what the files, the page and the payment server agree on', () => {
  it('calls the cart attribute that carries the code "kode" everywhere', () => {
    assert.match(read('public/js/pay/shop.js'), /\?attributes\[kode\]=\$\{encodeURIComponent\(code\)\}/);
    assert.match(read('payments/worker-shopify.js'), /String\(a\?\.name\)\.toLowerCase\(\) === 'kode'/);
    assert.match(MAIL, /attributes\.kode/);
  });

  it('calls the consent "samtykke" in the page and in the shop\'s files', () => {
    assert.match(read('public/js/pay/shop.js'), /&attributes\[samtykke\]=\$\{encodeURIComponent\(at\.toISOString\(\)\)\}/);
    assert.match(read('docs/SHOPIFY.md'), /samtykke/);
  });

  it('points at the terms and the game at addresses that exist in the app', () => {
    const files = ['public/vilkar.html', 'public/personvern.html', 'public/index.html'];
    for (const file of files) assert.ok(read(file).length > 0, file);
    assert.ok(MAIL.includes('disputt.site/vilkar.html') && MAIL.includes('disputt.site/personvern.html') && FRONT.includes('https://disputt.site/'));
    assert.match(read('public/js/pay/shop.js'), /attributes\[samtykke\]/);
    assert.match(MAIL, /attributes\.samtykke/);
    assert.match(read('payments/worker-shopify.js'), /=== 'samtykke'/);
  });

  it('says the same consent sentence in the e-mail as the terms quote from the game\'s box', () => {
    assert.match(read('public/vilkar.html'), /Jeg godtar vilkårene og at tilgangen leveres med en gang/);
    assert.match(read('public/js/screens/shoppay.js'), /Jeg godtar <a [^>]*>vilkårene<\/a> og at tilgangen leveres med en gang\./, 'the box in the game: "vilkårene" is the link to the terms');
    assert.match(MAIL, /Du godtok vilkårene og at tilgangen leveres med en gang før du betalte/);
  });

  it('names the contact address and the seller the same in the e-mail and in the terms', () => {
    const terms = read('public/vilkar.html');
    for (const part of ['kontakt@disputt.site', 'Pesom Holding AS', '923 729 674', 'Agathe Grøndahls gate 46']) {
      assert.ok(terms.includes(part), `${part} is in the terms`);
      assert.ok(MAIL.includes(part), `${part} is in the e-mail`);
    }
  });
});
