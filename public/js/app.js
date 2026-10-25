import { html, useEffect } from './vendor/htm-preact.js';
import { LangChip, LangChooser } from './i18n/chooser.js';
import { t, tx, useLang } from './i18n/lang.js';
import { anonymous, carScreen } from './screens/car.js';
import { RolesSheet } from './screens/carstrip.js';
import { Finished } from './screens/finale.js';
import { Connecting, Home, SeatPicker } from './screens/home.js';
import { LateWait } from './screens/latewait.js';
import { Lobby } from './screens/lobby.js';
import { HomeSheet } from './screens/leave.js';
import { useRememberGame } from './lastgame.js';
import { Mantra } from './mantra/mantra.js';
import { ModeStep } from './screens/mode.js';
import { Profile } from './screens/profile.js';
import { PointsStep, hostStep } from './screens/setup.js';
import { Countdown, Discussion, Question, RevealAsker, RoleReveal, Summary, WaitReveal } from './screens/round.js';
import { FasitSheet } from './screens/fasit.js';
import { AccessSheet, LoginSheet, Paywall, ThanksSheet } from './screens/pay.js';
import { HostSheet, QrSheet, RulesSheet, ScoresSheet, SettingsSheet } from './screens/sheets.js';
import { isP2P } from './settings.js';
import { useSlowConnect } from './slowconnect.js';
import { useStore } from './store.js';
import { Button, useWakeLock } from './ui.js';

// Ten seconds on the connecting screen (slowconnect.js), or two failed attempts in a row: most likely a network that does not let phones talk to each other directly.
const STUCK_HINT = tx('Får ikke kontakt ennå. Sjekk at verten har Disputt åpent og skjermen våken. Hjelper ikke det: be verten skru av Wi‑Fi og bruke bare mobildata (5G). Noen nett slipper ikke telefoner i direkte kontakt med hverandre.');

function gameScreen(view, s) {
  if (view.mode === 'car') return carScreen(view, s); // everybody on one phone (screens/car.js)
  // Somebody who comes into a game that has started: a profile first (with the points to come in with), then a wait until the next round
  // (`inRound` is false for a newcomer in the round that is on; a server that does not say, is not told it is false)
  if (view.phase !== 'lobby' && !view.you.ready) return html`<${Profile} view=${view} late />`;
  if (['role', 'question', 'locked', 'reveal'].includes(view.phase) && view.you.inRound === false) return html`<${LateWait} view=${view} />`;
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
      <h1>${t('Spillet er åpnet et annet sted')}</h1>
      <p class="lead muted">${t('Du har Disputt åpent i en annen fane eller på en annen enhet. Last inn siden på nytt for å bruke denne i stedet.')}</p>
      <${Button} onClick=${() => location.reload()}>${t('Last inn på nytt')}</${Button}>
    </div>
  </main>`;
}

export function App() {
  const s = useStore();
  useLang(); // (the whole page is drawn again when the language is changed)
  const { view } = s;
  useWakeLock(Boolean(view));
  useRememberGame(s.session, view); // (a guest's seat is remembered, so that closing the page is not the end of it: screens/rejoin.js)

  // every new screen starts at the top
  useEffect(() => window.scrollTo(0, 0), [view?.phase, view?.turn?.number, view?.round, view?.you?.ready, s.editing, s.step, s.modeStep]);
  // ... and what the mantra's bubble goes away for: a new screen under it (the same things, and the packages)
  const screenKey = [view?.phase, view?.turn?.number, view?.round, view?.you?.ready, s.editing, s.step, s.modeStep, s.paywall].join('|');

  // a guest who is on the way in (a game being joined, or their own game being found again): no game on screen yet, and not the host making one
  const connecting = isP2P && !s.replaced && !view && !s.seats && !s.creating && (Boolean(s.session) || Boolean(s.joining) || s.route.page === 'join');
  const slow = useSlowConnect(connecting);
  const hint = isP2P && (s.stuck >= 2 || slow) ? t(STUCK_HINT) : null;
  let screen;
  let onHome = false; // the start screen: the little flag of the language is on it
  if (s.replaced) screen = html`<${Replaced} />`;
  else if (s.paywall && s.payments?.enabled) screen = html`<${Paywall} view=${view} />`;
  else if (view) screen = gameScreen(view, s);
  else if (s.seats) screen = html`<${SeatPicker} />`;
  else if (s.creating) screen = html`<${Connecting} text=${t('Starter spillet …')} />`;
  else if (s.session) screen = html`<${Connecting} text=${t('Kobler til spillet ditt …')} hint=${hint} />`;
  else if (s.joining || s.route.page === 'join') screen = html`<${Connecting} text=${t('Blir med i {code} …', { code: s.joining ?? s.route.code })} hint=${hint} />`;
  else if (s.modeStep) screen = html`<${ModeStep} />`;
  else {
    screen = html`<${Home} />`;
    onHome = true;
  }

  const offline = s.conn !== 'open' && !s.replaced && (s.everOpened || s.conn === 'closed');
  const hostAway = s.hostAwayUntil > Date.now(); // p2p guest: the host said it was going away to pay
  const car = view?.mode === 'car';
  let sheet = null;
  if (s.sheet === 'rules') sheet = html`<${RulesSheet} car=${car} />`;
  else if (s.payments?.enabled && s.sheet === 'login') sheet = html`<${LoginSheet} />`;
  else if (s.payments?.enabled && s.sheet === 'thanks') sheet = html`<${ThanksSheet} />`;
  else if (s.payments?.enabled && s.sheet === 'access') sheet = html`<${AccessSheet} />`;
  else if (view && s.sheet === 'scores') sheet = html`<${ScoresSheet} view=${car ? anonymous(view) : view} />`;
  else if (view && s.sheet === 'host') sheet = html`<${HostSheet} view=${view} />`;
  else if (view && !car && s.sheet === 'qr') sheet = html`<${QrSheet} view=${view} />`;
  else if (view?.table && car && s.sheet === 'roles') sheet = html`<${RolesSheet} view=${view} />`;
  else if (view?.summary && s.sheet === 'fasit') sheet = html`<${FasitSheet} view=${view} />`;
  else if (view && !car && s.sheet === 'settings') sheet = html`<${SettingsSheet} />`;
  else if (view && s.sheet === 'home') sheet = html`<${HomeSheet} view=${view} />`;

  return html`
    ${s.payBusy && html`<div class="banner" role="status">${t('Sjekker betalingen')}</div>`}
    ${offline && html`<div class="banner" role="status">${hostAway ? t('Verten betaler, spillet fortsetter straks') : s.everOpened ? t('Mistet forbindelsen, kobler til igjen') : isP2P ? t('Får ikke kontakt med verten') : t('Får ikke kontakt med serveren')}</div>`}
    <${Mantra} screen=${screenKey} />
    ${screen}
    ${onHome && !s.modeStep && html`<${LangChip} />`}
    ${sheet}
    <${LangChooser} />
    ${s.toast && html`<div class="toast" role="alert" key=${s.toast}>${s.toast}</div>`}
  `;
}

