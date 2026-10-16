// «Har du rabattkode?» under the packages: a line that opens a field, and, when a code has been taken, what it takes off and a way to take it
// away again. (pay/discount.js asks the payment server; the prices on the cards and the payment itself read what is in the store.)
// (A file of its own: pages are cached for ten minutes ...)

import { html, useEffect, useState } from '../vendor/htm-preact.js';
import { setStore, useStore } from '../store.js';
import { Button } from '../ui.js';
import { dealFor, lookUpDiscount } from '../pay/discount.js';
import { knownShop, loadShop } from '../pay/shop.js';

export function DiscountField({ plan }) {
  const s = useStore();
  const [shop, setShop] = useState(knownShop());
  const [open, setOpen] = useState(false);
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
      setOpen(false);
      setText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (s.discount) {
    const here = dealFor(s.discount, plan);
    return html`<div class="discount discount--on" role="status">
      <p class="discount__line"><span class="chip chip--yellow">${s.discount.code}</span> <span>${s.discount.summary}${here ? '' : '. Gjelder ikke denne pakken.'}</span></p>
      <${Button} variant="text" size="small" onClick=${() => setStore({ discount: null })}>Fjern</${Button}>
      ${here && !here.vipps && html`<p class="small muted discount__note">Denne koden gjelder i butikkens kasse (Gå til betaling), ikke med Vipps.</p>`}
    </div>`;
  }
  if (!open) {
    return html`<div class="discount"><${Button} variant="text" onClick=${() => setOpen(true)}>Har du rabattkode?</${Button}></div>`;
  }
  return html`<form class="discount discount--form" onSubmit=${apply}>
    <label class="field__label" for="discount-code">Rabattkode</label>
    <div class="discount__row">
      <input id="discount-code" class="input input--small" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="64" placeholder="Skriv inn koden" value=${text} onInput=${(e) => setText(e.currentTarget.value)} />
      <${Button} size="small" variant="cream" disabled=${busy || text.trim() === ''} onClick=${apply}>${busy ? 'Sjekker …' : 'Bruk'}</${Button}>
    </div>
    ${error && html`<p class="field__error" role="alert">${error}</p>`}
  </form>`;
}
