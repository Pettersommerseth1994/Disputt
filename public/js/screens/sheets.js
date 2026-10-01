// Overlays: scoreboard, rules, QR code, host options.

import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { actions } from '../net.js';
import { setStore, useStore } from '../store.js';
import { Avatar, Button, QR, Scoreboard, Sheet, joinSite, joinUrl } from '../ui.js';

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
    <h3>Vertsvalg</h3>
    ${canTarget &&
    html`<div class="field">
      <span class="field__label">Poengmål</span>
      <div class="stepper">
        <${Button} variant="cream" size="icon" onClick=${() => bump(-1)} aria-label="Ett poeng mindre" disabled=${view.target <= 1}>−</${Button}>
        <output class="input input--number" aria-live="polite">${view.target}</output>
        <${Button} variant="cream" size="icon" onClick=${() => bump(1)} aria-label="Ett poeng mer" disabled=${view.target >= 99}>+</${Button}>
      </div>
      <span class="field__hint">Ett poeng tar ca. 10 minutter. Du kan justere underveis.</span>
    </div>`}
    ${inRound && html`<${ConfirmButton} block variant="orange" onConfirm=${() => { actions.skip(); close(); }}>Hopp over denne runden</${ConfirmButton}>`}
    ${offline.length > 0 &&
    html`<div class="stack stack--tight">
      <span class="field__label">Frakoblet akkurat nå</span>
      ${offline.map(
        (p) => html`<div class="row row--between" key=${p.id}>
          <span class="row"><${Avatar} id=${p.avatar} size="xs" offline /><span>${p.name}</span></span>
          <${ConfirmButton} size="small" variant="ghost" label="Sikker?" onConfirm=${() => actions.kick(p.id)}>Fjern</${ConfirmButton}>
        </div>`,
      )}
    </div>`}
    ${view.phase !== 'lobby' && view.phase !== 'finished' && html`<${ConfirmButton} block variant="pink" onConfirm=${() => { actions.end(); close(); }}>Avslutt spillet nå</${ConfirmButton}>`}
  </section>`;
}

export function ScoresSheet({ view }) {
  return html`<${Sheet} title="Poengtavle" onClose=${close}>
    <div class="stack stack--loose">
      <div class="card stack">
        <${Scoreboard} view=${view} />
        <p class="small muted center">Først til ${view.target} poeng vinner.</p>
      </div>
      ${view.you.isHost && html`<${HostControls} view=${view} />`}
      <${Button} block variant="ghost" onClick=${() => setStore({ sheet: 'rules' })}>Slik spiller du</${Button}>
    </div>
  </${Sheet}>`;
}

export function HostSheet({ view }) {
  return html`<${Sheet} title="Vertsvalg" onClose=${close}><${HostControls} view=${view} /></${Sheet}>`;
}

export function QrSheet({ view }) {
  const s = useStore();
  const url = joinUrl(s.info, view.code);
  return html`<${Sheet} title="Bli med" onClose=${close}>
    <div class="card card--paper center stack lobby__qr" style="align-items:center">
      <${QR} text=${url} />
      <p class="lobby__code display">${view.code}</p>
      <p class="small">${joinSite(s.info).replace(/^https?:\/\//, '').replace(/\/$/, '')}</p>
    </div>
  </${Sheet}>`;
}

const STEPS = [
  ['Alle får en rolle', 'De fleste er lojale. Én er imposter – og bare imposteren får vite riktig svar.'],
  ['Én spiller får spørsmålet', 'Hen leser spørsmålet og alternativene høyt for de andre.'],
  ['Diskuter!', 'Imposteren prøver å lure dere til å svare feil. Alle andre må finne ut hva som er riktig.'],
  ['Bli enige og lås svaret', 'Spilleren med spørsmålet krysser av. Så telles det ned fra 5 – og fasiten avsløres.'],
  ['Poeng', 'Riktig svar: alle lojale får 1 poeng. Feil svar: imposteren får 1 poeng.'],
  ['Ny runde', 'Ny imposter, ny spiller og nytt spørsmål. Først til målet vinner. Uavgjort? Da spiller dere videre.'],
];

export function RulesSheet() {
  return html`<${Sheet} title="Slik spiller du" onClose=${close}>
    <ol class="rules">
      ${STEPS.map(
        ([title, text], i) => html`<li key=${i}>
          <span class="rules__n">${i + 1}</span>
          <div><h3>${title}</h3><p class="muted">${text}</p></div>
        </li>`,
      )}
    </ol>
    <p class="small muted center" style="margin-top:var(--s-5)">Minst 3 spillere. Ett poeng tar ca. 10 minutter.</p>
  </${Sheet}>`;
}
