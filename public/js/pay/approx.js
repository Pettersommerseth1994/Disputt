// «ca. 109 DKK» / «ca. 159 SEK»: what a Dane or a Swede can read next to the price in Norwegian kroner. The shop sells in NOK only (and that is what the
// card is charged), so this is a help to read the price, never the price itself: the screens always show the NOK amount first and say that the
// other one is approximate. The amount is the NOK price at the rate below, ROUNDED UP to the next number ending in 9, so the real price is never
// above what is shown (the card issuer's own rate and fee can still move the amount on the statement a little).
//
// THE RATES ARE KEPT BY HAND. To check them: look up the Norges Bank rates (DKK and SEK are quoted per 100 units: 100 DKK = 139,11 NOK means
// nokPer 1.3911), put them in here, change `RATES_DATE`, then run the landing page again (tmp/nettside/publish-landing.py reads this file) and push both.
// Only change them when a rate has moved by about 5 %: the numbers on the page should not jump around. (docs/SHOPIFY.md, «Danske og svenske kroner»)
// (A file of its own: pages are cached for ten minutes ...)

export const RATES_DATE = '2026-11-04';
export const RATES = {
  da: { code: 'DKK', nokPer: 1.3911 },
  sv: { code: 'SEK', nokPer: 0.9476 },
};

/** The smallest number ending in 9 that is at least `x` (a price of 9 or less is 9). */
export const upToNine = (x) => Math.max(9, Math.ceil((x - 9) / 10 - 1e-9) * 10 + 9);

/** { amount: 109, code: 'DKK' } for a price in NOK, or null where the price is the one that is charged (Norwegian) or there is nothing to show. */
export function approxPrice(nok, lang) {
  const rate = RATES[lang];
  if (!rate || !(nok > 0)) return null;
  return { amount: upToNine(nok / rate.nokPer), code: rate.code };
}

/** The three packages for the landing page: { da: { 149: 109, … }, sv: { … } }. */
export function approxTable(prices = [149, 199, 299]) {
  return Object.fromEntries(Object.keys(RATES).map((lang) => [lang, Object.fromEntries(prices.map((p) => [p, approxPrice(p, lang).amount]))]));
}
