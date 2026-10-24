// The screens of the paid part: the packages (shown when the host has to pay to go on), "Logg inn" (a code from a receipt gets
// the pass back on a new phone), "Takk!" (after paying) and "Min tilgang" (in the host's options).
// (A file of its own: pages are cached for ten minutes ...)

import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { t, tx } from '../i18n/lang.js';
import { setStore, toast, useStore } from '../store.js';
import { Button, Sheet } from '../ui.js';
import { joinNames } from '../impostors.js';
import { cx } from '../util.js';
import { formatCodeInput, isActive, normalizeCode } from '../pay/pass.js';
import { requestNextRound } from '../pay/gate.js';
import { forgetPass, restoreWithCode, startCheckout } from '../pay/payments.js';
import { DEFAULT_PLAN, PERKS, describeValidity, formatPrice, planById } from '../pay/plans.js';
import { dealFor, kr } from '../pay/discount.js';
import { DiscountField } from './discount.js';
import { ShopDock } from './shoppay.js';
import { useOffered } from './offer.js';

const close = () => setStore({ sheet: null });
// (a number written out gets one text for each number, so that every language can put the words in its own order)
const ROUNDS = [tx('ingen runder'), tx('én runde'), tx('to runder'), tx('tre runder'), tx('fire runder'), tx('fem runder')];
const rounds = (n) => (ROUNDS[n] ? t(ROUNDS[n]) : t('{n} runder', { n }));
const FREE = [null, tx('Den første runden i hvert spill er gratis.'), tx('De to første rundene i hvert spill er gratis.'), tx('De tre første rundene i hvert spill er gratis.'), tx('De fire første rundene i hvert spill er gratis.'), tx('De fem første rundene i hvert spill er gratis.')];
/** "De to første rundene i hvert spill er gratis." */
const freeLine = (n) => (FREE[n] ? t(FREE[n]) : t('De {n} første rundene i hvert spill er gratis.', { n }));

// A text with a tag in the middle: the sentence is translated whole, with {} where the element goes.
const around = (text, node) => {
  const [before, after = ''] = text.split('{}');
  return html`${before}${node}${after}`;
};

async function copyCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    return toast(t('Koden er kopiert.'));
  } catch {
    /* fall through to the old way */
  }
  const area = document.createElement('textarea');
  area.value = code;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    /* not allowed either */
  }
  area.remove();
  toast(ok ? t('Koden er kopiert.') : t('Skriv ned koden: {code}', { code }), ok ? 3500 : 12000);
}

/** The name of a package, in the language of the phone (a pass of a package that is gone has no name). */
const planName = (id) => {
  const plan = planById(id);
  return plan ? t(plan.name) : '';
};

const Check = () => html`<svg class="perk__check" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>`;

// ------------------------------------------------------------------------------------------------ the packages

function PlanCard({ plan, selected, locked = false, deal = null, onSelect }) {
  return html`<label class=${cx('plan', selected && 'is-selected', locked && 'plan--locked')}>
    <input type="radio" name="plan" value=${plan.id} checked=${selected} disabled=${locked} onChange=${() => onSelect(plan.id)} />
    <span class="plan__radio" aria-hidden="true"></span>
    <span class="plan__main">
      <span class="plan__name">${t(plan.name)}</span>
      <span class="plan__sub">${t(plan.length)}</span>
    </span>
    ${deal
      ? html`<span class="plan__price plan__price--deal"><s class="plan__was">${formatPrice(plan.price)}</s><span>${kr(deal.now)}</span></span>`
      : html`<span class="plan__price">${formatPrice(plan.price)}</span>`}
    ${plan.badge && html`<span class="plan__badge">${t(plan.badge)}</span>`}
  </label>`;
}

/**
 * The packages and the way to pay. Opened when the host presses "Neste runde" after the free rounds (`gate`), and from
 * "Min tilgang" and "Logg inn" (then it is only a list of what there is to buy).
 */
export function Paywall({ view = null }) {
  const s = useStore();
  const pay = s.payments;
  const offered = useOffered(pay.provider);
  const [picked, setPlan] = useState(s.payWaiting?.plan ?? DEFAULT_PLAN); // (a payment that is waited for keeps its package chosen, also after a reload)
  const plan = offered.some((p) => p.id === picked) ? picked : (offered.find((p) => p.id === DEFAULT_PLAN) ?? offered[0]).id; // (one that is not for sale here is not chosen)
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  // coming back with the back button must not leave the buttons waiting for a page that never opens
  useEffect(() => {
    const reset = () => setBusy(null);
    addEventListener('pageshow', reset);
    return () => removeEventListener('pageshow', reset);
  }, []);
  const chosen = planById(plan);
  const have = isActive(s.pass);
  const gate = Boolean(view?.you?.isHost) && view.round >= pay.freeRounds && !have;
  const go = async (method) => {
    setBusy(method);
    setError('');
    try {
      await startCheckout(plan, method);
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  };
  const label = { vipps: 'Vipps', applepay: 'Apple Pay' };
  const terms = [pay.termsUrl && [tx('Vilkår'), pay.termsUrl], pay.privacyUrl && [tx('Personvern'), pay.privacyUrl]].filter(Boolean);

  return html`<main class="screen paywall">
    <div class="paywall__top"><${Button} variant="text" onClick=${() => setStore({ paywall: false })}>${t('‹ Tilbake')}</${Button}></div>
    <header class="stack stack--tight">
      <p class="eyebrow">${gate ? (view.round <= pay.freeRounds ? t('Dere har spilt {rounds} gratis', { rounds: rounds(view.round) }) : t('Dere har spilt {rounds}', { rounds: rounds(view.round) })) : t('For verter')}</p>
      <h1 class="setup__title rise-in">${gate ? t('Fortsett quizen') : t('Pakker')}</h1>
      <p class="lead muted">${gate ? t('Verten betaler én gang, så kan alle spille videre.') : t('Bare verten betaler. {free}', { free: freeLine(pay.freeRounds) })}</p>
    </header>

    ${have && html`<p class="chip chip--yellow paywall__have" role="status">${t('Du har tilgang: {plan} · {validity}', { plan: planName(s.pass.plan), validity: describeValidity(s.pass) })}</p>`}

    <div class="plans" role="radiogroup" aria-label=${t('Velg pakke')}>
      ${offered.map((p) => html`<${PlanCard} key=${p.id} plan=${p} selected=${plan === p.id} locked=${Boolean(s.payWaiting)} deal=${dealFor(s.discount, p.id)} onSelect=${setPlan} />`)}
    </div>
    <p class="small muted center plans__detail" aria-live="polite">${t(chosen.detail)}</p>
    ${pay.provider === 'shopify' && html`<${DiscountField} plan=${plan} />`}

    <section class="card stack stack--tight perks">
      <h3>${t('Dette får du')}</h3>
      <ul class="perks__list">
        ${PERKS.map(([title, text]) => html`<li key=${title}><${Check} /><span><strong>${t(title)}</strong><small>${t(text)}</small></span></li>`)}
      </ul>
    </section>

    <p class="small muted center paywall__fine">
      ${t('Engangsbetaling inkl. mva, ingen abonnement.')}${terms.length > 0 && ' '}
      ${terms.map(([name, href], i) => html`${i > 0 && ' · '}<a href=${href} target="_blank" rel="noopener">${t(name)}</a>`)}
    </p>
    <p class="center"><span class="muted">${t('Allerede kunde?')}</span> <${Button} variant="text" onClick=${() => setStore({ sheet: 'login' })}>${t('Logg inn')}</${Button}></p>

    <div class="dock">
      ${pay.provider === 'shopify'
        ? html`<${ShopDock} plan=${plan} />`
        : html`${error && html`<p class="field__error center" role="alert">${error}</p>`}
          ${pay.methods.map(
            (m, i) => html`<${Button} key=${m} block variant=${i === 0 ? undefined : 'cream'} disabled=${busy !== null} onClick=${() => go(m)}>
              ${busy === m ? t('Åpner betalingen …') : t('Betal med {method}', { method: label[m] })}
            </${Button}>`,
          )}`}
    </div>
  </main>`;
}

// ------------------------------------------------------------------------------------------------ "Logg inn"

/** A customer with a code from a receipt gets their pass back. There are no accounts: the code is the login. */
export function LoginSheet() {
  const shopify = useStore().payments?.provider === 'shopify';
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const field = useRef(null);
  useEffect(() => field.current?.focus(), []);
  const valid = normalizeCode(typed) !== null;
  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      const pass = await restoreWithCode(typed);
      setStore({ sheet: null, paywall: false }); // (opened from the packages: back to the game, where the next round can start now)
      toast(t('Velkommen tilbake! {plan}: {validity}.', { plan: planName(pass.plan), validity: describeValidity(pass).toLowerCase() }), 6000);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  return html`<${Sheet} title=${t('Logg inn')} onClose=${close}>
    <form class="stack" onSubmit=${submit}>
      <p class="muted">${t('Skriv inn koden du fikk da du betalte, så får du tilgangen din tilbake på denne telefonen.')}</p>
      <div class="field">
        <label class="sr-only" for="pass-code">${t('Koden fra kvitteringen')}</label>
        <input
          id="pass-code"
          ref=${field}
          class="input input--passcode"
          value=${typed}
          onInput=${(e) => {
            const v = formatCodeInput(e.currentTarget.value);
            e.currentTarget.value = v; // a re-render alone would not undo a rejected character
            setTyped(v);
            setError('');
          }}
          maxlength="14"
          autocomplete="off"
          autocapitalize="characters"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="go"
          placeholder="K7M2-9QXD-4TRB"
          aria-describedby="pass-code-error"
        />
        ${error && html`<span class="field__error" id="pass-code-error" role="alert">${error}</span>`}
      </div>
      <${Button} block type="submit" disabled=${!valid || busy}>${busy ? t('Sjekker …') : t('Hent tilgangen')}</${Button}>
      <p class="small muted">${shopify ? t('Koden står i bestillingsbekreftelsen på e-post, og under Vertsvalg › Min tilgang på telefonen du betalte med.') : t('Koden gjelder uansett om du betalte med Vipps eller Apple Pay. Du fikk den da du betalte («Takk!»-siden), og den står under Vertsvalg › Min tilgang på telefonen du betalte med.')}</p>
      <p class="center"><${Button} variant="text" onClick=${() => setStore({ sheet: null, paywall: true })}>${t('Har du ikke kjøpt ennå? Se pakkene')}</${Button}></p>
    </form>
  </${Sheet}>`;
}

// ------------------------------------------------------------------------------------------------ "Takk!" and "Min tilgang"

function CodeCard({ code }) {
  return html`<article class="card card--paper center stack stack--tight accesscode">
    <p class="eyebrow">${t('Koden din')}</p>
    <p class="passcode display" aria-label=${t('Koden din er {code}', { code: code.split('').join(' ') })}>${code}</p>
    <${Button} variant="cream" size="small" onClick=${() => copyCode(code)}>${t('Kopier koden')}</${Button}>
  </article>`;
}

/** Shown when the host is back from Stripe. The code is the way back in on another phone, so it is shown here, big. */
export function ThanksSheet() {
  const s = useStore();
  const plan = s.pass && planById(s.pass.plan);
  const view = s.view;
  // the host pressed "Neste runde" and got the packages instead: now that it is paid, the round is one tap away
  const next = Boolean(view?.you?.isHost) && view.phase === 'summary';
  const away = next ? view.players.filter((p) => !p.connected && !p.isHost).map((p) => p.name) : []; // still on their way back from the wait
  const go = () => {
    close();
    if (next) requestNextRound(view);
  };
  return html`<${Sheet} title=${t('Velkommen!')} onClose=${close}>
    <div class="stack">
      <p class="lead">${plan ? around(t('Du har tilgang: {plan}.', { plan: '{}' }), html`<strong>${t(plan.name)}</strong>`) : t('Du har tilgang.')} ${s.pass && describeValidity(s.pass)}.</p>
      ${s.passCode && html`<${CodeCard} code=${s.passCode} />`}
      <p class="small muted">${t('Ta vare på koden, for eksempel med et skjermbilde. Med den får du tilgangen tilbake på en ny telefon, uten konto.')}${s.payments?.provider === 'shopify' ? ` ${t('Den står også i bestillingsbekreftelsen på e-post.')}` : ''}</p>
      ${away.length > 0 && html`<p class="small center" role="status">${t('Venter på at {names} kommer tilbake …', { names: joinNames(away) })}</p>`}
      <${Button} block variant="lime" onClick=${go}>${next ? t('Start runde {n}', { n: view.round + 1 }) : t('Fortsett spillet')}</${Button}>
    </div>
  </${Sheet}>`;
}

/** In the host's options: what this phone has, the code, and the way to buy or to take the pass off the phone. */
export function AccessSheet() {
  const s = useStore();
  const [armed, setArmed] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const have = isActive(s.pass);
  const plan = have && planById(s.pass.plan);
  const forget = () => {
    if (armed) return forgetPass();
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), 3500);
  };
  return html`<${Sheet} title=${t('Min tilgang')} onClose=${close}>
    <div class="stack">
      ${have
        ? html`<p class="lead">${around(t('Du har tilgang: {plan}.', { plan: '{}' }), html`<strong>${plan ? t(plan.name) : ''}</strong>`)} ${describeValidity(s.pass)}.</p>
            ${s.passCode && html`<${CodeCard} code=${s.passCode} />`}
            <p class="small muted">${t('Bare verten trenger tilgang. Koden gir deg den tilbake på en annen telefon. Fjerner du tilgangen her, fjernes koden fra denne telefonen også, så skriv den ned først.')}</p>
            ${s.pass.expiresAt !== null && html`<${Button} block variant="cream" onClick=${() => setStore({ sheet: null, paywall: true })}>${t('Se pakkene')}</${Button}>`}
            <${Button} block variant="ghost" onClick=${forget}>${armed ? t('Trykk igjen for å fjerne') : t('Fjern tilgangen fra denne telefonen')}</${Button}>`
        : html`<p class="lead">${t('Du har ikke tilgang ennå.')}</p>
            <p class="muted">${t('{free} Vil dere spille lenger, betaler verten én gang.', { free: freeLine(s.payments.freeRounds) })}</p>
            <${Button} block onClick=${() => setStore({ sheet: null, paywall: true })}>${t('Se pakkene')}</${Button}>
            <p class="center"><span class="muted">${t('Allerede kunde?')}</span> <${Button} variant="text" onClick=${() => setStore({ sheet: 'login' })}>${t('Logg inn')}</${Button}></p>`}
    </div>
  </${Sheet}>`;
}
