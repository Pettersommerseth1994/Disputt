// «ca. 109 DKK» next to the NOK price (public/js/pay/approx.js): rounded UP to a number ending in 9, so the real price is never above what is shown.
import assert from 'node:assert/strict';
import test from 'node:test';

import { RATES, approxPrice, approxTable, upToNine } from '../public/js/pay/approx.js';

test('upToNine: the next number that ends in 9, never lower than the number itself', () => {
  assert.equal(upToNine(107.1), 109);
  assert.equal(upToNine(109), 109);
  assert.equal(upToNine(109.01), 119);
  assert.equal(upToNine(143.06), 149);
  assert.equal(upToNine(1), 9);
  assert.equal(upToNine(9), 9);
});

test('the packages: what a Dane and a Swede read (rates of 2026-11-04)', () => {
  assert.deepEqual(approxTable(), { da: { 149: 109, 199: 149, 299: 219 }, sv: { 149: 159, 199: 219, 299: 319 } });
});

test('what is shown is never less than the NOK price at the rate (for any price a host can pay)', () => {
  for (const lang of ['da', 'sv']) {
    for (let nok = 1; nok <= 600; nok += 0.5) {
      const { amount } = approxPrice(nok, lang);
      assert.ok(amount * RATES[lang].nokPer >= nok - 1e-6, `${nok} NOK in ${lang}`);
      assert.equal(amount % 10, 9);
      assert.ok(amount * RATES[lang].nokPer - nok < 10 * RATES[lang].nokPer + 1e-6, 'and not more than ten units above');
    }
  }
});

test('nothing in Norwegian, and nothing for a price that is not a price', () => {
  assert.equal(approxPrice(149, 'no'), null);
  assert.equal(approxPrice(0, 'da'), null);
  assert.equal(approxPrice(-5, 'sv'), null);
  assert.equal(approxPrice(Number.NaN, 'sv'), null);
  assert.equal(approxPrice(149, 'da').code, 'DKK');
  assert.equal(approxPrice(149, 'sv').code, 'SEK');
});
