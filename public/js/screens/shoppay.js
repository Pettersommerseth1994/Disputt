// The bar at the bottom of the packages when the shop is Shopify's: the box to tick, the button «Betal med Vipps» (when the payment server
// says that Vipps is set up: straight to Vipps, docs/VIPPS.md; a button of the game's own kind, drawn in Vipps' orange), the button that
// opens the shop in a new tab, and what the bar says while the host pays there (screens/pay.js has the rest of the packages screen).
// (A file of its own: pages are cached for ten minutes ...)

import { html, useEffect, useState } from '../vendor/htm-preact.js';
import { t } from '../i18n/lang.js';
import { useStore } from '../store.js';
import { Button } from '../ui.js';
import { cancelShopPayment, knownShop, loadShop, reopenShop, startShopCheckout } from '../pay/shop.js';
import { dealFor } from '../pay/discount.js';
import { startVippsCheckout } from '../pay/vipps.js';
import { vippsIsOfferedIn } from '../pay/vippslang.js';

// A text with a link or a tag in the middle: the sentence is translated whole, with {} where the element goes. The consent box below says, in Norwegian
// (test/shopify-files.test.js reads this line, and the terms quote it): Jeg godtar <a href=${pay.termsUrl} target="_blank" rel="noopener">vilkårene</a> og at tilgangen leveres med en gang.
const around = (text, node) => {
  const [before, after = ''] = text.split('{}');
  return html`${before}${node}${after}`;
};

export function ShopDock({ plan }) {
  const s = useStore();
  const pay = s.payments;
  const [agreed, setAgreed] = useState(false);
  const [shop, setShop] = useState(knownShop());
  const [error, setError] = useState('');
  const [tries, setTries] = useState(0);
  const deal = dealFor(s.discount, plan); // the code the host has taken, if it takes something off this package
  // the shop's address is asked for as soon as the packages are on screen, so that the tap can open the tab at once
  useEffect(() => {
    if (shop) return undefined;
    let live = true;
    loadShop()
      .then((info) => live && (setError(''), setShop(info)))
      .catch((err) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, [shop, tries]);
  const go = () => {
    setError('');
    try {
      startShopCheckout(plan, deal ? s.discount.code : ''); // (inside the tap: nothing is waited for before the tab opens)
      setAgreed(false); // (the consent is for this purchase: a new try has to be agreed to again)
    } catch (err) {
      setError(err.message);
    }
  };

  // «Betal med Vipps»: the same consent, and a new try has to be agreed to again. A tab is opened inside the tap, and what goes wrong is told here.
  const goVipps = () => {
    setError('');
    try {
      startVippsCheckout(plan, deal ? s.discount.code : '')
        .then(() => setAgreed(false))
        .catch((err) => setError(err.message));
    } catch (err) {
      setError(err.message);
    }
  };

  if (s.payWaiting) {
    return html`
      <div class="paywait" role="status">
        <p class="paywait__title">${t('Venter på betalingen …')}</p>
        <p class="small">${s.payWaiting.app ? t('Fullfør betalingen i Vipps-appen.') : t('Fullfør betalingen i den andre fanen.')} ${t('Siden her henter tilgangen selv når den er gjennomført. Har du allerede betalt, kommer den om et øyeblikk.')}</p>
      </div>
      <${Button} block variant="cream" onClick=${reopenShop}>${s.payWaiting.app ? t('Åpne Vipps igjen') : t('Åpne betalingen igjen')}</${Button}>
      <${Button} block variant="text" onClick=${cancelShopPayment}>${t('Avbryt')}</${Button}>`;
  }
  return html`
    ${error && html`<p class="field__error center" role="alert">${error}</p>`}
    ${error && !shop && html`<${Button} block variant="cream" onClick=${() => setTries(tries + 1)}>${t('Prøv igjen')}</${Button}>`}
    <label class="consent">
      <input type="checkbox" checked=${agreed} onChange=${(e) => setAgreed(e.currentTarget.checked)} />
      <span class="consent__box" aria-hidden="true"></span>
      <span>${around(t('Jeg godtar {terms} og at tilgangen leveres med en gang.', { terms: '{}' }), html`<a href=${pay.termsUrl} target="_blank" rel="noopener">${t('vilkårene')}</a>`)}</span>
    </label>
    ${shop?.vipps && vippsIsOfferedIn() && html`<${Button} block variant="vipps" disabled=${!agreed || (deal && !deal.vipps)} onClick=${goVipps}>${t('Betal med Vipps')}</${Button}>`}
    <${Button} block disabled=${!agreed || !shop} onClick=${go}>${t('Betal med kort')}</${Button}>`;
}
