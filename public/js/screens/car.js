// Bilturmodus: everybody plays on ONE phone, the host's, which is sent round. The engine side is in shared/game.js (MODE.CAR).
//  - set-up: the host puts everybody in (step 2), says how long to play (step 3, the normal one) and reads how it works (step 4)
//  - every round starts with the phone going round: one name after the other sees their role, and the host gets the phone back
//  - the rest is the normal game, on the host's phone: the host always has the question and locks the answer the group agreed on
// (A file of its own: pages are cached for ten minutes, and a module that imports something an older cached copy of another
// module does not have would not load.)

import { AVATARS } from '../../shared/avatars.mjs';
import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { impostorCount } from '../impostors.js';
import { actions } from '../net.js';
import { setStore, useStore } from '../store.js';
import { Avatar, Button, CloseIcon, Sheet } from '../ui.js';
import { cx, plural } from '../util.js';
import { TableStrip } from './carstrip.js';
import { Finished } from './finale.js';
import { Connecting } from './home.js';
import { Countdown, Question, RevealAsker, Summary } from './round.js';
import { MINUTES_PER_POINT, PointsStep, SetupHeader, Steps, duration, hostStep } from './setup.js';
import { TwoPlayersNote } from './twonote.js';

const NAME_MAX = 14;
const MIN_HOLD_MS = 500; // a role counts as seen when the button has been held this long: a stray touch does not use somebody's turn up

/** The same view with nobody marked "(deg)": all of them are at the table. */
export const anonymous = (view) => ({ ...view, you: { ...view.you, id: null } });

/** Which screen a game on one phone is on. (The phone is the host's, and so are the game screens: the host asks every round.) */
export function carScreen(view, s) {
  switch (view.phase) {
    case 'lobby': {
      const step = hostStep(view, s.step);
      if (step === 1) return html`<${PlayersStep} view=${view} />`;
      if (step === 2) return html`<${PointsStep} view=${view} />`;
      return html`<${HowStep} view=${view} />`;
    }
    case 'role':
      return view.table ? html`<${CarRoles} view=${view} />` : html`<${Connecting} />`;
    case 'question':
      return view.question ? html`<${Question} view=${view} />` : html`<${Connecting} />`;
    case 'locked':
      return html`<${Countdown} view=${view} />`;
    case 'reveal':
      return html`<${RevealAsker} view=${view} />`;
    case 'summary':
      return html`<${Summary} view=${anonymous(view)} />`;
    case 'finished':
      return html`<${Finished} view=${anonymous(view)} />`;
    default:
      return html`<${Connecting} />`;
  }
}

// ------------------------------------------------------------------ step 2: who is playing

/** Two taps to remove somebody, so a stray touch cannot throw a player out. */
function RemoveButton({ player }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const tap = () => {
    if (armed) return actions.kick(player.id);
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), 3000);
  };
  return html`<button type="button" class=${cx('roster__remove', armed && 'roster__remove--armed')} onClick=${tap} aria-label=${armed ? `Trykk igjen for å fjerne ${player.name}` : `Fjern ${player.name}`}>
    ${armed ? 'Fjern?' : html`<${CloseIcon} />`}
  </button>`;
}

function Faces({ players, max = 5 }) {
  return html`<span class="facepile" aria-hidden="true">${players.slice(0, max).map((p) => html`<${Avatar} key=${p.id} id=${p.avatar} size="xs" class="facepile__face" />`)}</span>`;
}

export function PlayersStep({ view }) {
  const { you } = view;
  const [form, setForm] = useState(you.ready ? null : you.id); // null, 'new', or the id of the player whose name or avatar is being set
  const players = view.players;
  const need = Math.max(0, view.limits.min - players.length);
  const full = players.length >= view.limits.max;
  // (a form for somebody who is gone by now is not shown)
  const shownForm = form === 'new' || form === you.id || players.some((p) => p.id === form) ? form : null;
  // back to where the way to play is chosen: only while nobody but the host is in (the names that were put in would be lost)
  const backToMode = () => {
    actions.leave();
    setStore({ modeStep: true });
  };
  return html`<main class="screen lobby players-step">
    <${SetupHeader} />
    <${Steps} current=${2} onBack=${players.length <= 1 ? backToMode : undefined} />
    <div class="stack">
      <header class="stack stack--tight">
        <h1 class="setup__title rise-in">Hvem spiller?</h1>
        <p class="lead muted">Legg inn alle som sitter i bilen. Den øverste er verten og leser spørsmålene.</p>
      </header>
      <ul class="roster">
        ${!you.ready &&
        html`<li class="roster__item">
          <button type="button" class="roster__main" onClick=${() => setForm(you.id)}>
            <span class="avatar avatar--sm" aria-hidden="true"></span>
            <span class="roster__name">Skriv navnet ditt<span class="roster__host">vert</span></span>
          </button>
        </li>`}
        ${players.map(
          (p) => html`<li class="roster__item" key=${p.id}>
            <button type="button" class="roster__main" onClick=${() => setForm(p.id)} aria-label=${`Endre ${p.name}`}>
              <${Avatar} id=${p.avatar} size="sm" />
              <span class="roster__name">${p.name}${p.isHost && html`<span class="roster__host">vert</span>`}</span>
              <span class="roster__edit">Endre</span>
            </button>
            ${!p.isHost && html`<${RemoveButton} player=${p} />`}
          </li>`,
        )}
        ${!full && you.ready && html`<li class="roster__item"><button type="button" class="roster__add" onClick=${() => setForm('new')}>+ Legg til spiller</button></li>`}
      </ul>
      ${players.length === 2 && html`<${TwoPlayersNote} />`}
    </div>
    <div class="dock">
      <div class="dock__status" role="status">
        <${Faces} players=${players} />
        <p class="small">
          ${need > 0
            ? html`<span class="muted">Legg inn ${need} ${plural(need, 'spiller', 'spillere')} til · minst ${view.limits.min}</span>`
            : html`${players.length} ${plural(players.length, 'spiller', 'spillere')} er med`}
        </p>
      </div>
      <${Button} block onClick=${() => setStore({ step: 2 })} disabled=${need > 0 || !you.ready}>Neste</${Button}>
    </div>
  </main>
  ${shownForm && html`<${PlayerForm} view=${view} id=${shownForm} onClose=${() => setForm(null)} />`}`; // (the sheet is not inside the screen: like every other sheet it covers the screen's button bar)
}

/** Who is in, and as what: it is how a change is told from nothing having happened. */
const signature = (players) => players.map((p) => `${p.id}|${p.name}|${p.avatar}`).join('\n');

/** Name and avatar of somebody who is put in, or changed. The game answers with the new list of players, and then this is done. */
function PlayerForm({ view, id, onClose }) {
  const adding = id === 'new';
  const myself = id === view.you.id;
  const player = adding ? null : view.players.find((p) => p.id === id);
  const takenBy = new Map(view.players.filter((p) => p.id !== id).map((p) => [p.avatar, p.name]));
  const firstFree = AVATARS.find((a) => !takenBy.has(a.id))?.id ?? null; // (the next face that is free is already chosen: a name is all it takes)
  const [name, setName] = useState(player?.name ?? '');
  const [avatar, setAvatar] = useState(player?.avatar ?? firstFree);
  const [busy, setBusy] = useState(false);
  const sent = useRef(null); // the list of players as it was when the button was pressed
  const clean = name.replace(/\s+/g, ' ').trim();
  const ready = clean.length > 0 && avatar && !busy;

  // The game accepted it: the list of players is not what it was. (A rejection arrives as a toast instead, and this stays.)
  useEffect(() => {
    setBusy(false);
    if (sent.current !== null && signature(view.players) !== sent.current) {
      sent.current = null;
      onClose();
    }
  }, [view]);

  const submit = (e) => {
    e.preventDefault();
    if (!ready) return;
    if (player && player.name === clean && player.avatar === avatar) return onClose(); // nothing to tell the game
    sent.current = signature(view.players);
    // (a host who has no name yet is on the first step until the game accepts one: this says that the step stays, and does not jump to the last)
    if (myself && !view.you.ready) setStore({ step: 1 });
    setBusy(true);
    setTimeout(() => setBusy(false), 2500); // a rejection does not change the view, so never stay locked
    if (adding) actions.addPlayer(clean, avatar);
    else actions.profile(clean, avatar, myself ? undefined : id);
  };
  const edit = (fn) => (value) => {
    setBusy(false);
    fn(value);
  };

  return html`<${Sheet} title=${adding ? 'Ny spiller' : myself && !view.you.ready ? 'Hvem er du?' : 'Endre spiller'} onClose=${onClose}>
    <form class="stack" onSubmit=${submit}>
      <div class="field">
        <label class="field__label" for="player-name">Navn</label>
        <input
          id="player-name"
          class="input"
          value=${name}
          onInput=${edit((e) => setName(e.currentTarget.value))}
          maxlength=${NAME_MAX}
          autocomplete="off"
          autocapitalize="words"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="done"
          placeholder="Skriv navnet"
        />
      </div>
      <div class="field">
        <span class="field__label" id="player-avatar-label">Velg avatar</span>
        <div class="picker" role="radiogroup" aria-labelledby="player-avatar-label">
          ${AVATARS.map((a) => {
            const taken = takenBy.has(a.id);
            return html`<button
              type="button"
              role="radio"
              class="picker__item"
              key=${a.id}
              aria-checked=${avatar === a.id}
              aria-label=${taken ? `${a.name} (tatt av ${takenBy.get(a.id)})` : a.name}
              disabled=${taken}
              onClick=${edit(() => setAvatar(a.id))}
            >
              <${Avatar} id=${a.id} size="md" />
            </button>`;
          })}
        </div>
      </div>
      <${Button} block type="submit" disabled=${!ready}>${adding ? 'Legg til' : 'Lagre'}</${Button}>
    </form>
  </${Sheet}>`;
}

// ------------------------------------------------------------------ step 4: how it works

export function HowStep({ view }) {
  const s = useStore();
  const host = view.players.find((p) => p.isHost);
  const enough = view.players.length >= view.limits.min;
  const twoImpostors = view.players.length >= (view.limits.twoImpostorsFrom ?? Infinity);
  const canStart = enough && view.you.ready && s.conn === 'open';
  const steps = [
    ['Send telefonen rundt', 'Alle trykker på navnet sitt og ser rollen sin, én og én. Skjul skjermen for de andre.'],
    [`${host?.name ?? 'Verten'} leser spørsmålet`, 'Verten leser spørsmålet og alternativene høyt. Diskuter, og bli enige om ett svar.'],
    ['Imposteren avslører seg', 'Imposteren sier riktig svar høyt. Så vises poengene, og neste runde starter med nye roller.'],
  ];
  return html`<main class="screen setup">
    <${SetupHeader} />
    <${Steps} current=${4} onBack=${() => setStore({ step: 2 })} />
    <h1 class="setup__title rise-in">Klar? Slik funker det</h1>
    <ol class="rules">
      ${steps.map(
        ([title, text], i) => html`<li key=${i}>
          <span class="rules__n">${i + 1}</span>
          <div><h3>${title}</h3><p class="muted">${text}</p></div>
        </li>`,
      )}
    </ol>
    <p class="small muted center">Først til ${view.target} poeng · ${duration(view.target * MINUTES_PER_POINT)} · ${view.players.length} ${plural(view.players.length, 'spiller', 'spillere')}${twoImpostors ? ' · to imposterer' : ''}</p>
    <div class="dock">
      <${Button} block variant="lime" onClick=${() => actions.start()} disabled=${!canStart}>Start spillet</${Button}>
    </div>
  </main>`;
}

// ------------------------------------------------------------------ the phone goes round

/**
 * Every round starts here: a list of the names, and the phone goes round. The one whose turn it is has the strip of the normal game
 * (the button on the right, the role on the left while it is held); the others wait. When the finger lifts, the role has been seen, and
 * it is the next one's turn. When all have, the phone goes back to the host, who has the question.
 */
export function CarRoles({ view }) {
  const table = view.table;
  const seen = view.seen ?? [];
  const count = impostorCount(view);
  const now = table.find((r) => !seen.includes(r.id)) ?? null;
  const done = now === null;
  const host = table.find((r) => r.id === view.you.id) ?? table[0];
  const activeRef = useRef(null);

  // the one whose turn it is stays on the screen, also with ten names in the list
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    activeRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [now?.id]);

  const released = (row) => (ms) => {
    if (ms >= MIN_HOLD_MS && !seen.includes(row.id)) actions.seen(row.id);
  };
  const handTo = done ? host : seen.length > 0 ? now : null;

  return html`<main class="screen rolelist">
    <${SetupHeader} />
    <div class="rolelist__head">
      <p class="eyebrow">Runde ${view.round}</p>
      <h1 class="setup__title rise-in">${done ? 'Alle har sett rollen sin' : 'Send telefonen rundt'}</h1>
      <p class="lead muted">${done ? 'Gi telefonen tilbake til verten, som leser spørsmålet høyt for alle.' : 'Alle ser rollen sin, én og én. Hold inne knappen, og skjul skjermen for de andre.'}</p>
    </div>
    <ol class="rolelist__list">
      ${table.map((r, i) => {
        const tag = r.id === host?.id ? html`<small>vert</small>` : null;
        if (seen.includes(r.id)) {
          return html`<li class="rolerow rolerow--done" key=${r.id}><span class="rolerow__n">${i + 1}</span><${Avatar} id=${r.avatar} size="sm" /><span class="rolerow__name">${r.name}${tag}</span><span class="rolerow__state">✓ Sett</span></li>`;
        }
        if (now && r.id === now.id) {
          return html`<li class="rolerow rolerow--strip" key=${r.id} ref=${activeRef}>
            <span class="rolerow__n">${i + 1}</span>
            <${Avatar} id=${r.avatar} size="sm" />
            <span class="rolerow__name">${r.name}${tag}</span>
            <${TableStrip} key=${r.id} row=${r} impostors=${count} onRelease=${released(r)} />
          </li>`;
        }
        return html`<li class="rolerow rolerow--wait" key=${r.id}><span class="rolerow__n">${i + 1}</span><${Avatar} id=${r.avatar} size="sm" /><span class="rolerow__name">${r.name}${tag}</span><span class="rolerow__state">Venter</span></li>`;
      })}
    </ol>
    ${handTo &&
    html`<section class="card card--yellow handover" role="status">
      <${Avatar} id=${handTo.avatar} size="sm" />
      <p>Gi telefonen til <strong>${handTo.name}</strong></p>
    </section>`}
    <div class="dock">
      <p class="small muted dock__count" role="status">${seen.length} av ${table.length} har sett rollen sin</p>
      <${Button} block variant=${done ? 'lime' : undefined} disabled=${!done} onClick=${() => actions.begin()}>${done ? 'Vis spørsmålet' : 'Alle har sett rollen sin'}</${Button}>
    </div>
  </main>`;
}
