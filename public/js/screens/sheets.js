// Overlays: scoreboard, rules, QR code, host options.

import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { LANGUAGES, getLang, t } from '../i18n/lang.js';
import { actions } from '../net.js';
import { RulesHub } from '../regler/hub.js';
import { AwakeToggle } from './awake.js';
import { AddPlayerSheet, CarPlayers } from './carplayers.js';
import { setStore, useStore } from '../store.js';
import { Avatar, Button, QR, Scoreboard, Sheet, ShareLink, joinSite, joinUrl } from '../ui.js';

const close = () => setStore({ sheet: null });

/** Two-step button for destructive actions: first tap arms it, second tap confirms. */
function ConfirmButton({ onConfirm, children, label = t('Trykk igjen for å bekrefte'), ...rest }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const tap = () => {
    if (armed) {
      clearTimeout(timer.current);
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), 3500);
  };
  return html`<${Button} onClick=${tap} ...${rest}>${armed ? label : children}</${Button}>`;
}

function HostControls({ view }) {
  const inRound = ['role', 'question', 'locked', 'reveal'].includes(view.phase);
  const canTarget = view.phase !== 'finished';
  const offline = view.players.filter((p) => !p.connected && !p.isHost);
  const bump = (d) => actions.target(Math.min(99, Math.max(1, view.target + d)));
  return html`<section class="stack">
    ${canTarget &&
    html`<div class="field">
      <span class="field__label">${t('Poengmål')}</span>
      <div class="stepper">
        <${Button} variant="cream" size="icon" onClick=${() => bump(-1)} aria-label=${t('Ett poeng mindre')} disabled=${view.target <= 1}>−</${Button}>
        <output class="input input--number" aria-live="polite">${view.target}</output>
        <${Button} variant="cream" size="icon" onClick=${() => bump(1)} aria-label=${t('Ett poeng mer')} disabled=${view.target >= 99}>+</${Button}>
      </div>
      <span class="field__hint">${t('Ett poeng tar ca. 6 minutter. Du kan justere underveis.')}</span>
    </div>`}
    ${inRound && html`<${ConfirmButton} block variant="orange" onConfirm=${() => { actions.skip(); close(); }}>${t('Hopp over denne runden')}</${ConfirmButton}>`}
    ${offline.length > 0 &&
    html`<div class="stack stack--tight">
      <span class="field__label">${t('Frakoblet akkurat nå')}</span>
      ${view.phase !== 'lobby' && view.mode !== 'car' && html`<span class="field__hint">${t('De kan hoppe inn igjen med spillkoden {code} og beholde poengene sine. Fjerner du dem, mister de poengene og kommer ikke inn igjen.', { code: view.code })}</span>`}
      ${offline.map(
        (p) => html`<div class="offline-row" key=${p.id}>
          <span class="offline-row__who"><${Avatar} id=${p.avatar} size="xs" offline /><span>${p.name}</span></span>
          <${ConfirmButton} size="small" variant="ghost" label=${view.phase === 'lobby' ? t('Sikker?') : t('Mister poengene. Sikker?')} onConfirm=${() => actions.kick(p.id)}>${t('Fjern')}</${ConfirmButton}>
        </div>`,
      )}
    </div>`}
    ${view.phase !== 'lobby' && view.phase !== 'finished' && html`<${ConfirmButton} block variant="pink" onConfirm=${() => { actions.end(); close(); }}>${t('Avslutt spillet nå')}</${ConfirmButton}>`}
  </section>`;
}

/** «Språk: Dansk»: opens the card where the language of this phone is chosen (i18n/chooser.js). The questions follow the game, not the phone. */
function LanguageButton() {
  return html`<${Button} block variant="cream" onClick=${() => setStore({ sheet: null, langOpen: true })}>${t('Språk')}: ${LANGUAGES[getLang()].name}</${Button}>`;
}

/** The code of the game, for somebody who has lost the connection or closed the page: with it they can step back in and keep their points. */
function GameCode({ view }) {
  if (view.mode === 'car' || !view.code) return null;
  return html`<div class="card card--deep stack stack--tight center gamecode">
    <span class="small muted">${t('Spillkode')}</span>
    <strong class="display gamecode__code">${view.code}</strong>
    <span class="small muted">${t('Mistet du forbindelsen? Åpne disputt.site, trykk «Bli med i spill» og skriv koden. Velg deg selv, så er du tilbake med poengene dine.')}</span>
  </div>`;
}

export function ScoresSheet({ view }) {
  return html`<${Sheet} title=${t('Poengtavle')} onClose=${close}>
    <div class="stack stack--loose">
      <div class="card stack">
        <${Scoreboard} view=${view} />
        <p class="small muted center">${t('Først til {target} poeng vinner.', { target: view.target })}</p>
      </div>
      <${GameCode} view=${view} />
      ${!view.you.isHost && html`<${Button} block variant="ghost" onClick=${() => setStore({ sheet: 'rules' })}>${t('Slik spiller dere')}</${Button}>`}
    </div>
  </${Sheet}>`;
}

/** What used to hang under the scoreboard for the host: the gear in the header of the round screens opens it. */
export function HostSheet({ view }) {
  const s = useStore();
  const [adding, setAdding] = useState(false);
  // (the form is a sheet of its own, beside this one: a sheet inside a sheet would move with the first one's slide-up)
  return html`<${Sheet} title=${t('Vertsvalg')} onClose=${close}>
    <div class="stack stack--loose">
      <${HostControls} view=${view} />
      ${view.mode === 'car' && html`<${CarPlayers} view=${view} onAdd=${() => setAdding(true)} />`}
      <${GameCode} view=${view} />
      <${AwakeToggle} />
      <${LanguageButton} />
      ${s.payments?.enabled && html`<${Button} block variant="cream" onClick=${() => setStore({ sheet: 'access' })}>${t('Min tilgang')}</${Button}>`}
      <${Button} block variant="ghost" onClick=${() => setStore({ sheet: 'rules' })}>${t('Slik spiller dere')}</${Button}>
    </div>
  </${Sheet}>
  ${adding && html`<${AddPlayerSheet} view=${view} onClose=${() => setAdding(false)} />`}`;
}

/** What used to be three loose links under the player list: change name or avatar, show the QR code, leave. */
export function SettingsSheet() {
  return html`<${Sheet} title=${t('Innstillinger')} onClose=${close}>
    <div class="stack">
      <${AwakeToggle} />
      <${LanguageButton} />
      <${Button} block variant="cream" onClick=${() => setStore({ sheet: null, editing: true })}>${t('Endre navn eller avatar')}</${Button}>
      <${Button} block variant="cream" onClick=${() => setStore({ sheet: 'qr' })}>${t('Vis QR-koden')}</${Button}>
      <${ConfirmButton} block variant="pink" label=${t('Trykk igjen for å forlate spillet')} onConfirm=${() => { close(); actions.leave(); }}>${t('Forlat spillet')}</${ConfirmButton}>
    </div>
  </${Sheet}>`;
}

export function QrSheet({ view }) {
  const s = useStore();
  const url = joinUrl(s.info, view.code);
  return html`<${Sheet} title=${t('Bli med')} onClose=${close}>
    <div class="card card--paper center stack lobby__qr" style="align-items:center">
      <${QR} text=${url} />
      <p class="lobby__code display">${view.code}</p>
      <p class="small">${joinSite(s.info).replace(/^https?:\/\//, '').replace(/\/$/, '')}</p>
      <${ShareLink} url=${url} code=${view.code} />
    </div>
  </${Sheet}>`;
}

/** «Slik spiller dere»: the story of a round (regler/hub.js), nothing written beside it. */
export function RulesSheet({ car = false }) {
  return html`<${Sheet} title=${t('Slik spiller dere')} onClose=${close}>
    <${RulesHub} car=${car} />
  </${Sheet}>`;
}
