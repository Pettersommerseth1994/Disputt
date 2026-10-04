import { html, useEffect } from './vendor/htm-preact.js';
import { Finished } from './screens/finale.js';
import { Connecting, Home, SeatPicker } from './screens/home.js';
import { Lobby } from './screens/lobby.js';
import { HomeSheet } from './screens/leave.js';
import { Profile } from './screens/profile.js';
import { PointsStep, hostStep } from './screens/setup.js';
import { Countdown, Discussion, Question, RevealAsker, RoleReveal, Summary, WaitReveal } from './screens/round.js';
import { FasitSheet } from './screens/fasit.js';
import { HostSheet, QrSheet, RulesSheet, ScoresSheet, SettingsSheet } from './screens/sheets.js';
import { isP2P } from './settings.js';
import { useStore } from './store.js';
import { Button, useWakeLock } from './ui.js';

// Two failed attempts in a row (about 30 s): most likely a network that does not let phones talk to each other directly.
const STUCK_HINT = 'Får ikke kontakt ennå. Sjekk at verten har Disputt åpent og skjermen våken. Det hjelper ofte å bytte mellom Wi‑Fi og mobildata, for noen nett slipper ikke telefoner i direkte kontakt med hverandre.';

function gameScreen(view, s) {
  switch (view.phase) {
    case 'lobby':
      // Everybody picks a profile first. The host then goes on to the points, and last to the invitation, where the game waits.
      if (view.you.isHost && !s.editing) {
        const step = hostStep(view, s.step);
        if (step === 1) return html`<${Profile} view=${view} wizard />`;
        if (step === 2) return html`<${PointsStep} view=${view} />`;
        return html`<${Lobby} view=${view} />`;
      }
      return s.editing || !view.you.ready ? html`<${Profile} view=${view} editing=${s.editing} />` : html`<${Lobby} view=${view} />`;
    case 'role':
      return html`<${RoleReveal} view=${view} />`;
    case 'question':
      return view.you.isAsker && view.question ? html`<${Question} view=${view} />` : html`<${Discussion} view=${view} />`;
    case 'locked':
      return html`<${Countdown} view=${view} />`;
    case 'reveal':
      return view.you.isAsker ? html`<${RevealAsker} view=${view} />` : html`<${WaitReveal} view=${view} />`;
    case 'summary':
      return html`<${Summary} view=${view} />`;
    case 'finished':
      return html`<${Finished} view=${view} />`;
    default:
      return html`<${Connecting} />`;
  }
}

function Replaced() {
  return html`<main class="screen">
    <div class="grow center stack stack--loose" style="justify-content:center">
      <h1>Spillet er åpnet et annet sted</h1>
      <p class="lead muted">Du har Disputt åpent i en annen fane eller på en annen enhet. Last inn siden på nytt for å bruke denne i stedet.</p>
      <${Button} onClick=${() => location.reload()}>Last inn på nytt</${Button}>
    </div>
  </main>`;
}

export function App() {
  const s = useStore();
  const { view } = s;
  useWakeLock(Boolean(view));

  // every new screen starts at the top
  useEffect(() => window.scrollTo(0, 0), [view?.phase, view?.turn?.number, view?.you?.ready, s.editing, s.step]);

  const hint = isP2P && s.stuck >= 2 ? STUCK_HINT : null;
  let screen;
  if (s.replaced) screen = html`<${Replaced} />`;
  else if (view) screen = gameScreen(view, s);
  else if (s.seats) screen = html`<${SeatPicker} />`;
  else if (s.creating) screen = html`<${Connecting} text="Starter spillet …" />`;
  else if (s.session) screen = html`<${Connecting} text="Kobler til spillet ditt …" hint=${hint} />`;
  else if (s.joining || s.route.page === 'join') screen = html`<${Connecting} text=${`Blir med i ${s.joining ?? s.route.code} …`} hint=${hint} />`;
  else screen = html`<${Home} />`;

  const offline = s.conn !== 'open' && !s.replaced && (s.everOpened || s.conn === 'closed');
  let sheet = null;
  if (s.sheet === 'rules') sheet = html`<${RulesSheet} />`;
  else if (view && s.sheet === 'scores') sheet = html`<${ScoresSheet} view=${view} />`;
  else if (view && s.sheet === 'host') sheet = html`<${HostSheet} view=${view} />`;
  else if (view && s.sheet === 'qr') sheet = html`<${QrSheet} view=${view} />`;
  else if (view?.summary && s.sheet === 'fasit') sheet = html`<${FasitSheet} view=${view} />`;
  else if (view && s.sheet === 'settings') sheet = html`<${SettingsSheet} />`;
  else if (view && s.sheet === 'home') sheet = html`<${HomeSheet} view=${view} />`;

  return html`
    ${offline && html`<div class="banner" role="status">${s.everOpened ? 'Mistet forbindelsen – kobler til igjen' : isP2P ? 'Får ikke kontakt med verten' : 'Får ikke kontakt med serveren'}</div>`}
    ${screen}
    ${sheet}
    ${s.toast && html`<div class="toast" role="alert" key=${s.toast}>${s.toast}</div>`}
  `;
}

