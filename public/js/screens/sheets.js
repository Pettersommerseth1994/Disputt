// Overlays: scoreboard, rules, QR code, host options.

import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { actions } from '../net.js';
import { RulesHub } from '../regler/hub.js';
import { AwakeToggle } from './awake.js';
import { setStore, useStore } from '../store.js';
import { Avatar, Button, QR, Scoreboard, Sheet, ShareLink, joinSite, joinUrl } from '../ui.js';

const close = () => setStore({ sheet: null });

/** Two-step button for destructive actions: first tap arms it, second tap confirms. */
function ConfirmButton({ onConfirm, children, label = 'Trykk igjen for å bekrefte', ...rest }) {
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
      <span class="field__label">Poengmål</span>
      <div class="stepper">
        <${Button} variant="cream" size="icon" onClick=${() => bump(-1)} aria-label="Ett poeng mindre" disabled=${view.target <= 1}>−</${Button}>
        <output class="input input--number" aria-live="polite">${view.target}</output>
        <${Button} variant="cream" size="icon" onClick=${() => bump(1)} aria-label="Ett poeng mer" disabled=${view.target >= 99}>+</${Button}>
      </div>
      <span class="field__hint">Ett poeng tar ca. 6 minutter. Du kan justere underveis.</span>
    </div>`}
    ${inRound && html`<${ConfirmButton} block variant="orange" onConfirm=${() => { actions.skip(); close(); }}>Hopp over denne runden</${ConfirmButton}>`}
    ${offline.length > 0 &&
    html`<div class="stack stack--tight">
      <span class="field__label">Frakoblet akkurat nå</span>
      ${view.phase !== 'lobby' && view.mode !== 'car' && html`<span class="field__hint">De kan hoppe inn igjen med spillkoden ${view.code} og beholde poengene sine. Fjerner du dem, mister de poengene og kommer ikke inn igjen.</span>`}
      ${offline.map(
        (p) => html`<div class="offline-row" key=${p.id}>
          <span class="offline-row__who"><${Avatar} id=${p.avatar} size="xs" offline /><span>${p.name}</span></span>
          <${ConfirmButton} size="small" variant="ghost" label=${view.phase === 'lobby' ? 'Sikker?' : 'Mister poengene. Sikker?'} onConfirm=${() => actions.kick(p.id)}>Fjern</${ConfirmButton}>
        </div>`,
      )}
    </div>`}
    ${view.phase !== 'lobby' && view.phase !== 'finished' && html`<${ConfirmButton} block variant="pink" onConfirm=${() => { actions.end(); close(); }}>Avslutt spillet nå</${ConfirmButton}>`}
  </section>`;
}

/** The code of the game, for somebody who has lost the connection or closed the page: with it they can step back in and keep their points. */
function GameCode({ view }) {
  if (view.mode === 'car' || !view.code) return null;
  return html`<div class="card card--deep stack stack--tight center gamecode">
    <span class="small muted">Spillkode</span>
    <strong class="display gamecode__code">${view.code}</strong>
    <span class="small muted">Mistet du forbindelsen? Åpne disputt.site, trykk «Bli med i spill» og skriv koden. Velg deg selv, så er du tilbake med poengene dine.</span>
  </div>`;
}

export function ScoresSheet({ view }) {
  return html`<${Sheet} title="Poengtavle" onClose=${close}>
    <div class="stack stack--loose">
      <div class="card stack">
        <${Scoreboard} view=${view} />
        <p class="small muted center">Først til ${view.target} poeng vinner.</p>
      </div>
      <${GameCode} view=${view} />
      ${!view.you.isHost && html`<${Button} block variant="ghost" onClick=${() => setStore({ sheet: 'rules' })}>Slik spiller dere</${Button}>`}
    </div>
  </${Sheet}>`;
}

/** What used to hang under the scoreboard for the host: the gear in the header of the round screens opens it. */
export function HostSheet({ view }) {
  const s = useStore();
  return html`<${Sheet} title="Vertsvalg" onClose=${close}>
    <div class="stack stack--loose">
      <${HostControls} view=${view} />
      <${GameCode} view=${view} />
      <${AwakeToggle} />
      ${s.payments?.enabled && html`<${Button} block variant="cream" onClick=${() => setStore({ sheet: 'access' })}>Min tilgang</${Button}>`}
      <${Button} block variant="ghost" onClick=${() => setStore({ sheet: 'rules' })}>Slik spiller dere</${Button}>
    </div>
  </${Sheet}>`;
}

/** What used to be three loose links under the player list: change name or avatar, show the QR code, leave. */
export function SettingsSheet() {
  return html`<${Sheet} title="Innstillinger" onClose=${close}>
    <div class="stack">
      <${AwakeToggle} />
      <${Button} block variant="cream" onClick=${() => setStore({ sheet: null, editing: true })}>Endre navn eller avatar</${Button}>
      <${Button} block variant="cream" onClick=${() => setStore({ sheet: 'qr' })}>Vis QR-koden</${Button}>
      <${ConfirmButton} block variant="pink" label="Trykk igjen for å forlate spillet" onConfirm=${() => { close(); actions.leave(); }}>Forlat spillet</${ConfirmButton}>
    </div>
  </${Sheet}>`;
}

export function QrSheet({ view }) {
  const s = useStore();
  const url = joinUrl(s.info, view.code);
  return html`<${Sheet} title="Bli med" onClose=${close}>
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
  return html`<${Sheet} title="Slik spiller dere" onClose=${close}>
    <${RulesHub} car=${car} />
  </${Sheet}>`;
}
