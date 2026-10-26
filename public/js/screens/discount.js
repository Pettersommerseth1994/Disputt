// «Har du en rabattkode?» above the packages: a dashed box with the field open, and, when a code has been taken, what it takes off and a way to take it
// away again. A code that is the long access code from a receipt (not a discount code) is told so, with a way to «Logg inn» with it. (pay/discount.js asks the payment server; the prices on the cards and the payment itself read what is in the store.)
// (A file of its own: pages are cached for ten minutes ...)

import { html, useEffect, useState } from '../vendor/htm-preact.js';
import { t, tServer } from '../i18n/lang.js';
import { setStore, useStore } from '../store.js';
import { Button } from '../ui.js';
import { dealFor, lookUpDiscount } from '../pay/discount.js';
import { formatCodeInput, normalizeCode } from '../pay/pass.js';
import { knownShop, loadShop } from '../pay/shop.js';
import { vippsIsOfferedIn } from '../pay/vippslang.js';

export function DiscountField({ plan }) {
  const s = useStore();
  const [shop, setShop] = useState(knownShop());
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (shop) return undefined;
    let live = true;
    loadShop()
      .then((info) => live && setShop(info))
      .catch(() => {}); // (the dock under the packages tells that the shop could not be reached)
    return () => {
      live = false;
    };
  }, [shop]);
  if (!shop?.discounts || s.payWaiting) return null;

  const apply = async (e) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const found = await lookUpDiscount(text.trim());
      setStore({ discount: found });
      setText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (s.discount) {
    const here = dealFor(s.discount, plan);
    const summary = tServer(s.discount.summary); // (the server's words: «10 % rabatt», «50 kr rabatt»)
    return html`<div class="discount discount--on" role="status">
      <p class="discount__line"><span class="chip chip--yellow">${s.discount.code}</span> <span>${here ? summary : t('{summary}. Gjelder ikke denne pakken.', { summary })}</span></p>
      <${Button} variant="text" size="small" onClick=${() => setStore({ discount: null })}>${t('Fjern')}</${Button}>
      ${here && !here.vipps && vippsIsOfferedIn() && html`<p class="small muted discount__note">${t('Denne koden gjelder i butikkens kasse (Betal med kort), ikke med Vipps.')}</p>`}
    </div>`;
  }
  // the long code from a receipt is not a discount code: it is the way back in (the sheet «Logg inn» takes it along)
  const access = normalizeCode(text) !== null;
  return html`<form class="discount discount--form" onSubmit=${apply}>
    <label class="discount__title display" for="discount-code">${t('Har du en rabattkode?')}</label>
    <div class="discount__row">
      <input id="discount-code" class="input discount__input" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="64" placeholder="VENN20" value=${text} onInput=${(e) => (setText(e.currentTarget.value), setError(''))} />
      <${Button} size="small" variant="cream" type="submit" disabled=${busy || text.trim() === '' || access}>${busy ? t('Sjekker …') : t('Bruk')}</${Button}>
    </div>
    ${access &&
    html`<div class="discount__wrong" role="status">
      <p><strong>${t('Dette ser ut som en tilgangskode.')}</strong> ${t('Den lange koden fra e-posten gir deg tilgangen tilbake. Den gir ikke rabatt.')}</p>
      <${Button} size="small" variant="lime" onClick=${() => setStore({ sheet: 'login', loginCode: formatCodeInput(text) })}>${t('Logg inn med den ›')}</${Button}>
    </div>`}
    ${error && !access && html`<p class="field__error" role="alert">${error}</p>`}
  </form>`;
}
