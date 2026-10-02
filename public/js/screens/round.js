// The screens of one round: role reveal -> question/discussion -> countdown -> reveal -> summary.

import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { useHold } from '../hold.js';
import { actions } from '../net.js';
import { serverNow } from '../net.js';
import { asset } from '../paths.js';
import { setStore } from '../store.js';
import { Avatar, Button, RoleStrip, Scoreboard, Timer, TrophyIcon } from '../ui.js';
import { cx, letter, playerById, useRemaining, vibrate } from '../util.js';

/** Round number + score shortcut, shown above the in-round screens. */
export function GameBar({ view }) {
  const round = view.turn?.number ?? view.summary?.round ?? view.round;
  return html`<header class="gamebar row row--between">
    <span class="chip">Runde ${round} · først til ${view.target}</span>
    <${Button} variant="ghost" size="small" onClick=${() => setStore({ sheet: 'scores' })} aria-label="Se poengtavle"><${TrophyIcon} /> Poeng</${Button}>
  </header>`;
}

// ------------------------------------------------------------------ 1. role reveal (8 s)

// Nothing about the role is on the screen until a finger holds the button, and it is gone when the finger lifts. The rest of
// the time every phone shows the same thing, so a neighbour who glances at your screen learns nothing from it.

const EYES = { impostor: 'assets/art/eye-impostor.svg', loyal: 'assets/art/eye-loyal.svg' };
const TIPS = {
  impostor: 'Få de andre til å svare feil – uten å bli avslørt.',
  loyal: 'Finn ut hva som er riktig svar sammen – og ikke la imposteren lure dere.',
};

/** The card that appears while the button is held. Both roles get a card of the same size: the loyal player's answer is a "?". */
function RoleCard({ you }) {
  const impostor = you.role === 'impostor';
  return html`<article class="rolecard pop-in">
    <div class="rolecard__head">
      <img class="rolecard__eye" src=${asset(EYES[you.role])} alt="" width="400" height="300" />
      <h1 class=${cx('rolecard__word', impostor ? 'rolecard__word--impostor' : 'rolecard__word--loyal')}>${impostor ? 'Imposter' : 'Lojal'}</h1>
    </div>
    <div class="rolecard__answer">
      <span class="rolecard__label">Riktig svar</span>
      <p class="rolecard__pill"><span>${impostor ? you.secret.letter : '?'}</span>${impostor ? you.secret.text : 'Finn det sammen'}</p>
    </div>
  </article>`;
}

export function RoleReveal({ view }) {
  const { you } = view;
  const asker = playerById(view, view.turn.askerId);
  const total = view.timings.roleMs;
  const left = useRef(Math.max(0, Math.min(total, view.roleEndsAt - serverNow())));
  const { held, bind } = useHold();
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
          ? html`<${RoleCard} you=${you} />`
          : html`<div class="slot__closed">
              <img class="slot__eye" src=${asset('assets/art/eye-wait.svg')} alt="" width="300" height="200" />
              <p>Rollen din er skjult</p>
            </div>`}
      </div>
    </div>
    <div class="role__hold">
      <p class="role__hint">${held ? TIPS[you.role] : 'Hold telefonen inntil deg og dekk til med hånda.'}</p>
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
    <${RoleStrip} you=${you} />

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
    <${RoleStrip} you=${you} />

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

export function Countdown({ view }) {
  const isAsker = view.you.isAsker;
  const asker = playerById(view, view.turn.askerId);
  const ms = useRemaining(view.countdown.endsAt, 10);
  const n = Math.max(1, Math.min(9, Math.ceil(ms / 1000)));
  useEffect(() => vibrate(35), [n]);
  const chosen = isAsker && view.question && view.selected != null ? view.question.options[view.selected] : null;

  return html`<main class="screen countdown">
    <div class="countdown__body grow">
      <p class="eyebrow">${isAsker ? 'Svaret er låst' : `${asker?.name} har låst svaret`}</p>
      <div class="countdown__n" key=${n} aria-live="polite">${n}</div>
      ${isAsker
        ? html`<p class="lead">Du låste <strong>${letter(view.selected)}: ${chosen}</strong>.<br />Fasiten kommer på din telefon …</p>`
        : html`<p class="lead">Se på <strong>${asker?.name}</strong> – fasiten avsløres på telefonen deres!</p>`}
    </div>
  </main>`;
}

// ------------------------------------------------------------------ 4. reveal (asker only) / waiting (everyone else)

export function RevealAsker({ view }) {
  const r = view.reveal;
  useEffect(() => vibrate(r.correct ? [60, 40, 60, 40, 180] : 350), []);
  return html`<main class=${cx('screen reveal', r.correct ? 'reveal--right' : 'reveal--wrong')}>
    <div class="reveal__body grow">
      <img class="reveal__art" src=${asset(r.correct ? 'assets/art/eye-right.svg' : 'assets/art/eye-wrong.svg')} alt="" width="400" height="300" />
      <h1 class="reveal__word pop-in">${r.correct ? 'Riktig!' : 'Feil!'}</h1>
      <div class="card card--paper center reveal__answer rise-in">
        <p class="eyebrow" style="color:var(--ink);opacity:.78">Riktig svar</p>
        <p class="role__answer"><span>${r.correctLetter}</span>${r.correctText}</p>
      </div>
      <p class="lead">${r.correct ? 'Gruppa lot seg ikke lure.' : 'Imposteren lurte dere.'} Si det høyt til de andre – og trykk så på knappen.</p>
    </div>
    <div class="dock"><${Button} block variant="cream" onClick=${() => actions.proceed()}>Gå videre</${Button}></div>
  </main>`;
}

export function WaitReveal({ view }) {
  const asker = playerById(view, view.turn.askerId);
  const stuck = view.you.isHost && asker && !asker.connected;
  return html`<main class="screen">
    <${GameBar} view=${view} />
    <${RoleStrip} you=${view.you} />
    <div class="grow center stack stack--loose" style="justify-content:center;align-items:center">
      <${Avatar} id=${asker?.avatar} size="xl" alive />
      <h2>Se på ${asker?.name}!</h2>
      <p class="lead muted">Fasiten avsløres bare på telefonen til ${asker?.name}.</p>
      ${stuck && html`<${Button} variant="cream" onClick=${() => actions.proceed()}>${asker.name} er borte – gå videre</${Button}>`}
    </div>
  </main>`;
}

// ------------------------------------------------------------------ 5. summary

export function Summary({ view }) {
  const s = view.summary;
  const impostor = playerById(view, s.impostorId) ?? s.impostor; // the impostor may have been removed since
  const isHost = view.you.isHost;
  const headline = s.skipped ? 'Runden ble hoppet over' : s.correct ? 'Gruppa hadde rett!' : 'Imposteren lurte dere!';
  const sub = s.skipped ? 'Ingen fikk poeng.' : s.correct ? 'Alle lojale fikk 1 poeng.' : `${impostor?.name ?? 'Imposteren'} fikk 1 poeng.`;

  return html`<main class="screen summary">
    <${GameBar} view=${view} />
    <header class="center stack stack--tight summary__head">
      <h1 class="rise-in">${headline}</h1>
      <p class="lead muted">${sub}</p>
    </header>

    <section class="card card--paper impostor-card row pop-in">
      <${Avatar} id=${impostor?.avatar} size="md" alive />
      <div>
        <p class="eyebrow" style="color:var(--ink);opacity:.78">Imposteren var</p>
        <p class="display impostor-card__name">${impostor?.name}</p>
      </div>
    </section>

    ${s.tiebreak && html`<p class="chip chip--yellow center" role="status" style="align-self:center">Uavgjort i teten – én runde til!</p>`}

    <section class="card stack">
      <h3>Poengtavle</h3>
      <${Scoreboard} view=${view} gains=${s.gained} />
      <p class="small muted center">Først til ${view.target} poeng vinner.</p>
    </section>

    ${isHost
      ? html`<div class="dock">
          <${Button} block variant="lime" onClick=${() => actions.next()}>Neste runde</${Button}>
          <div class="row row--center row--wrap">
            <${Button} variant="text" onClick=${() => setStore({ sheet: 'host' })}>Vertsvalg</${Button}>
          </div>
        </div>`
      : html`<p class="foot center muted" role="status">Venter på at verten starter neste runde …</p>`}
  </main>`;
}
