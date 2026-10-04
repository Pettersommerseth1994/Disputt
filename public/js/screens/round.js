// The screens of one round: role reveal -> question/discussion -> countdown -> reveal -> points.
// The phone only counts down and keeps the score: what is revealed (the answer, the impostors) is said out loud.

import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { useHold } from '../hold.js';
import { actions } from '../net.js';
import { serverNow } from '../net.js';
import { impostorCount, joinNames, matesOf, summaryImpostors } from '../impostors.js';
import { asset } from '../paths.js';
import { requestNextRound } from '../pay/gate.js';
import { setStore } from '../store.js';
import { Avatar, Button, GearIcon, RoleStrip, Scoreboard, Timer, TrophyIcon } from '../ui.js';
import { cx, letter, playerById, useRemaining, vibrate } from '../util.js';

/** Round number + score shortcut, shown above the in-round screens. The host also has the gear with the host's options. */
export function GameBar({ view }) {
  const round = view.turn?.number ?? view.summary?.round ?? view.round;
  return html`<header class="gamebar row row--between">
    <span class="chip">Runde ${round} · først til ${view.target}</span>
    <div class="row gamebar__actions">
      <${Button} variant="ghost" size="small" onClick=${() => setStore({ sheet: 'scores' })} aria-label="Se poengtavle"><${TrophyIcon} /> Poeng</${Button}>
      ${view.you.isHost && html`<${Button} variant="ghost" size="small icon" onClick=${() => setStore({ sheet: 'host' })} aria-label="Vertsvalg"><${GearIcon} /></${Button}>`}
    </div>
  </header>`;
}

// ------------------------------------------------------------------ 1. role reveal (8 s)

// Nothing about the role is on the screen until a finger holds the button, and it is gone when the finger lifts. The rest of
// the time every phone shows the same thing, so a neighbour who glances at your screen learns nothing from it.

const EYES = { impostor: 'assets/art/eye-impostor.svg', loyal: 'assets/art/eye-loyal.svg' };
const TIPS = {
  impostor: 'Få de andre til å svare feil – uten å bli avslørt.',
  impostorDuo: 'Hjelp hverandre med å få de andre til å svare feil – uten å bli avslørt.',
  loyal: 'Finn ut hva som er riktig svar sammen – og ikke la imposteren lure dere.',
  loyalDuo: 'Finn ut hva som er riktig svar sammen – og ikke la imposterne lure dere.',
};

/**
 * The card that appears while the button is held. Both roles get a card of the same size: the loyal player's answer is a "?".
 * With two impostors the card has a third part, "Imposterne": the impostors see who they are, the loyal players a "?".
 */
function RoleCard({ you, count }) {
  const impostor = you.role === 'impostor';
  const mates = matesOf(you);
  return html`<article class=${cx('rolecard pop-in', count > 1 && 'rolecard--duo')}>
    <div class="rolecard__head">
      <img class="rolecard__eye" src=${asset(EYES[you.role])} alt="" width="400" height="300" />
      <h1 class=${cx('rolecard__word', impostor ? 'rolecard__word--impostor' : 'rolecard__word--loyal')}>${impostor ? 'Imposter' : 'Lojal'}</h1>
    </div>
    <div class="rolecard__answer">
      <span class="rolecard__label">Riktig svar</span>
      <p class="rolecard__pill"><span class="rolecard__dot">${impostor ? you.secret.letter : '?'}</span>${impostor ? you.secret.text : 'Finn det sammen'}</p>
    </div>
    ${count > 1 &&
    html`<div class="rolecard__answer">
      <span class="rolecard__label">Imposterne</span>
      <p class="rolecard__pill">
        ${impostor && mates.length > 0
          ? html`<${Avatar} id=${mates[0].avatar} size="xs" class="rolecard__mate" label=${mates[0].name} />`
          : html`<span class="rolecard__dot">?</span>`}
        ${impostor ? joinNames(['Du', ...mates.map((m) => m.name)]) : 'Finn dem sammen'}
      </p>
    </div>`}
  </article>`;
}

export function RoleReveal({ view }) {
  const { you } = view;
  const asker = playerById(view, view.turn.askerId);
  const total = view.timings.roleMs;
  const left = useRef(Math.max(0, Math.min(total, view.roleEndsAt - serverNow())));
  const { held, bind } = useHold();
  const count = impostorCount(view);
  // the same short buzz for everybody: a different pattern per role would give the role away to whoever feels or hears it
  useEffect(() => vibrate(70), []);
  // fetch the picture on the card now, so that the first hold does not show a half-drawn card
  useEffect(() => {
    new Image().src = asset(EYES[you.role]);
  }, [you.role]);

  return html`<main class="screen role">
    <p class="eyebrow role__eyebrow">Din rolle</p>
    <div class="role__mid">
      <div class="slot" role="status">
        ${held
          ? html`<${RoleCard} you=${you} count=${count} />`
          : html`<div class="slot__closed">
              <img class="slot__eye" src=${asset('assets/art/eye-wait.svg')} alt="" width="300" height="200" />
              <p>Rollen din er skjult</p>
            </div>`}
      </div>
    </div>
    <div class="role__hold">
      <p class="role__hint">${held ? TIPS[you.role + (count > 1 ? 'Duo' : '')] : 'Hold telefonen inntil deg og dekk til med hånda.'}</p>
      <button type="button" class=${cx('btn btn--block hold-btn', held && 'is-held')} ...${bind} aria-label="Hold inne for å se rollen din">
        ${held ? 'Slipp for å skjule' : 'Hold for å se rollen din'}
      </button>
      <p class="role__next">${asker ? html`<strong>${asker.name}</strong> får spørsmålet …` : ''}</p>
    </div>
    <div class="role__bar" aria-hidden="true">
      <div class="bar bar--countdown" style=${`--dur:${total}ms;--delay:-${total - left.current}ms;--fill:var(--cream)`}><div class="bar__fill"></div></div>
    </div>
  </main>`;
}

// ------------------------------------------------------------------ 2. question (asker) and discussion (everyone else)

const PRESETS = [2, 6, 10];

export function Question({ view }) {
  const { you, question } = view;
  const [sel, setSel] = useState(view.selected); // restored from the server after a reload, then local
  const [preset, setPreset] = useState(6);
  const ms = useRemaining(view.discussion.endsAt);

  const pick = (i) => {
    setSel(i);
    actions.select(i);
  };
  const setTime = (minutes) => {
    setPreset(minutes);
    actions.setTimer(minutes * 60);
  };

  return html`<main class="screen question">
    <${GameBar} view=${view} />
    <${RoleStrip} you=${you} impostors=${impostorCount(view)} />

    <div class="timebar">
      <${Timer} endsAt=${view.discussion.endsAt} small />
      <div class="segmented segmented--compact" role="group" aria-label="Sett klokka til">
        ${PRESETS.map((m) => html`<button type="button" class="segmented__item" key=${m} aria-pressed=${preset === m} onClick=${() => setTime(m)}>${m}<small>min</small></button>`)}
      </div>
      <${Button} variant="cream" size="small" onClick=${() => actions.addTime(60)} aria-label="Legg til ett minutt">+1</${Button}>
    </div>
    ${ms <= 0 && html`<p class="timeup">Tiden er ute – bli enige og lås svaret!</p>`}

    <section class="card card--paper stack stack--tight question__card">
      <p class="eyebrow" style="color:var(--ink);opacity:.78">Les høyt for de andre</p>
      <h2 class="question__text">${question.text}</h2>
    </section>

    <fieldset class="options" aria-label="Svaralternativer">
      <legend class="sr-only">Svaralternativer</legend>
      ${question.options.map(
        (text, i) => html`<label class=${cx('option', sel === i && 'is-selected')} key=${i}>
          <input type="radio" name="answer" value=${i} checked=${sel === i} onChange=${() => pick(i)} />
          <span class="option__letter">${letter(i)}</span>
          <span class="option__text">${text}</span>
          <span class="option__check" aria-hidden="true"></span>
        </label>`,
      )}
    </fieldset>

    <div class="dock dock--compact">
      <${Button} block variant="lime" disabled=${sel === null || sel === undefined} onClick=${() => actions.lock(sel)}>
        ${sel === null || sel === undefined ? 'Velg svaret dere ble enige om' : 'Lås svaret'}
      </${Button}>
    </div>
  </main>`;
}

export function Discussion({ view }) {
  const { you } = view;
  const asker = playerById(view, view.turn.askerId);
  const ms = useRemaining(view.discussion.endsAt);
  return html`<main class="screen discussion">
    <${GameBar} view=${view} />
    <${RoleStrip} you=${you} impostors=${impostorCount(view)} />

    <section class="center stack" style="align-items:center;margin-top:var(--s-4)">
      <${Avatar} id=${asker?.avatar} size="lg" alive offline=${asker && !asker.connected} />
      <h2>${asker?.name} har spørsmålet</h2>
      <p class="muted discussion__hint">Lytt når ${asker?.name} leser det opp – og diskuter dere frem til riktig svar.</p>
    </section>

    <section class="timer-block center stack stack--tight">
      <p class="eyebrow">Tid til å diskutere</p>
      <${Timer} endsAt=${view.discussion.endsAt} />
      ${ms <= 0 && html`<p class="timeup">Tiden er ute – bli enige! ${asker?.name} låser svaret.</p>`}
    </section>

    <p class="card card--deep center discussion__tip">Diskuter, og bli enige før tiden går ut.</p>
  </main>`;
}

// ------------------------------------------------------------------ 3. locked: the 5-4-3-2-1

/** The same on every phone, and it says what the group locked. (A host that has not been updated does not send it: then only the asker knows.) */
export function Countdown({ view }) {
  const ms = useRemaining(view.countdown.endsAt, 10);
  const n = Math.max(1, Math.min(9, Math.ceil(ms / 1000)));
  useEffect(() => vibrate(35), [n]);
  const locked = view.countdown.chosen ?? (view.you.isAsker && view.question && view.selected != null ? { letter: letter(view.selected), text: view.question.options[view.selected] } : null);

  return html`<main class="screen countdown">
    <div class="countdown__body grow">
      <p class="eyebrow">Svaret er låst</p>
      <div class="countdown__n" key=${n} aria-live="polite">${n}</div>
      <p class="lead">${locked && html`Dere låste <strong>${locked.letter}: ${locked.text}</strong>.<br />`}Se på hverandre!</p>
    </div>
  </main>`;
}

// ------------------------------------------------------------------ 4. the reveal: spoken, not shown

/**
 * Nothing is revealed on a screen. The impostors say the right answer out loud, and so out themselves, while everybody looks
 * at each other. The phones are the same for everybody (a different screen would give the impostors away); only the asker, who
 * had the question, has a button, and moves on when it has been said.
 */
function RevealStage({ view, asker = false }) {
  const count = impostorCount(view);
  const holder = playerById(view, view.turn.askerId);
  const stuck = view.you.isHost && !asker && holder && !holder.connected;
  useEffect(() => vibrate(60), []); // (the same for everybody)
  return html`<main class="screen stage">
    <${GameBar} view=${view} />
    <${RoleStrip} you=${view.you} impostors=${count} />
    <div class="stage__body grow">
      <img class="stage__art" src=${asset('assets/art/lips.svg')} alt="" width="300" height="200" />
      <h1 class="stage__title">${count > 1 ? 'Imposterne avslører seg!' : 'Imposteren avslører seg!'}</h1>
      <p class="lead">${count > 1 ? 'Imposterne sier riktig svar sammen.' : 'Imposteren sier riktig svar høyt.'}</p>
    </div>
    ${asker
      ? html`<div class="dock"><${Button} block variant="cream" onClick=${() => actions.proceed()}>Det er sagt – vis poengene</${Button}></div>`
      : html`<div class="foot center">
          <p class="muted" role="status">${holder?.name ?? 'Spilleren med spørsmålet'} trykker videre når det er sagt.</p>
          ${stuck && html`<${Button} variant="cream" onClick=${() => actions.proceed()}>${holder.name} er borte – gå videre</${Button}>`}
        </div>`}
  </main>`;
}

// (the two names are kept: the app opens them by these names)
export const RevealAsker = ({ view }) => html`<${RevealStage} view=${view} asker />`;
export const WaitReveal = ({ view }) => html`<${RevealStage} view=${view} />`;

// ------------------------------------------------------------------ 5. the points

/**
 * The points, and one line on how the round went. Who the impostors were, and the answer, have been said out loud; for when
 * the group disagrees about it, "Se fasit" (fasit.js) has them.
 */
export function Summary({ view }) {
  const s = view.summary;
  const many = summaryImpostors(view).length > 1; // (an impostor may have been removed since)
  const recap = s.skipped ? 'Runden ble hoppet over. Ingen fikk poeng.' : s.correct ? 'Gruppa hadde rett!' : many ? 'Imposterne lurte dere!' : 'Imposteren lurte dere!';

  return html`<main class="screen summary">
    <${GameBar} view=${view} />
    <header class="center stack stack--tight summary__head">
      <h1 class="rise-in">Poengene</h1>
      <p class="lead muted">${recap}</p>
    </header>

    ${s.tiebreak && html`<p class="chip chip--yellow center" role="status" style="align-self:center">Uavgjort i teten – én runde til!</p>`}

    <section class="card stack">
      <${Scoreboard} view=${view} gains=${s.gained} />
      ${!s.skipped && html`<div class="row row--center"><${Button} variant="text" onClick=${() => setStore({ sheet: 'fasit' })}>Uenige? Se fasit</${Button}></div>`}
    </section>

    ${view.you.isHost
      ? html`<div class="dock">
          <${Button} block variant="lime" onClick=${() => requestNextRound(view)}>Neste runde</${Button}>
        </div>`
      : html`<p class="foot center muted" role="status">Venter på at verten starter neste runde …</p>`}
  </main>`;
}
