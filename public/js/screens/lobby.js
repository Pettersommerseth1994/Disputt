// Lobby: the host shows the QR code, picks the points target and starts; everyone sees who has joined.

import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { actions } from '../net.js';
import { setStore, useStore } from '../store.js';
import { Avatar, Button, CloseIcon, HelpIcon, Logo, QR, joinSite, joinUrl, keepsAwake } from '../ui.js';
import { isP2P } from '../settings.js';
import { cx, plural } from '../util.js';

const MINUTES_PER_POINT = 10;

function duration(minutes) {
  if (minutes < 90) return `ca. ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `ca. ${h} t${m ? ` ${m} min` : ''}`;
}

export function Lobby({ view }) {
  return view.you.isHost ? html`<${HostLobby} view=${view} />` : html`<${GuestLobby} view=${view} />`;
}

/** Removing a friend takes two taps, so a stray touch cannot throw someone out. */
function KickButton({ player }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const tap = () => {
    if (armed) return actions.kick(player.id);
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), 3000);
  };
  return html`<button class=${cx('player__kick', armed && 'player__kick--armed')} onClick=${tap} aria-label=${armed ? `Trykk igjen for å fjerne ${player.name}` : `Fjern ${player.name}`}>
    ${armed ? 'Fjern?' : html`<${CloseIcon} />`}
  </button>`;
}

const AwakeTip = () =>
  keepsAwake ? null : html`<p class="small muted center" style="max-width:22rem;margin-inline:auto">Tips: sett skjermlåsen på telefonen til «Aldri» mens dere spiller, så mister du ikke forbindelsen.</p>`;

function Players({ view, kickable = false }) {
  const missing = Math.max(0, view.limits.min - view.players.length);
  return html`<div class="player-grid">
    ${view.players.map(
      (p, i) => html`<div class="player" key=${p.id} style=${`animation-delay:${i * 40}ms`}>
        <${Avatar} id=${p.avatar} size="md" alive=${p.connected} offline=${!p.connected} crown=${p.isHost} label=${p.name} />
        <span class="player__name">${p.name}</span>
        ${!p.connected && html`<span class="player__tag">frakoblet</span>`}
        ${kickable && !p.isHost && html`<${KickButton} player=${p} />`}
      </div>`,
    )}
    ${Array.from({ length: Math.min(missing, 3) }, (_, i) => html`<div class="player player--empty" key=${`e${i}`} aria-hidden="true"><span class="avatar avatar--md"></span><span class="player__name muted">venter …</span></div>`)}
  </div>
  ${view.pending > 0 && html`<p class="center muted small" role="status">${view.pending} ${plural(view.pending, 'til er', 'til er')} på vei inn …</p>`}`;
}

function HostLobby({ view }) {
  const s = useStore();
  const [text, setText] = useState(String(view.target));
  const timer = useRef(null); // pending (debounced) target update
  const n = Number(text);
  const valid = /^\d{1,2}$/.test(text) && n >= 1 && n <= 99;
  const emptied = text === ''; // the field is cleared while the host types a new number: "unchanged" until they do

  // Follow the server (e.g. after "play again"), but never overwrite what the host is typing right now.
  useEffect(() => {
    if (document.activeElement?.id !== 'target') setText(String(view.target));
  }, [view.target]);

  const onInput = (e) => {
    const v = e.currentTarget.value.replace(/\D/g, '').slice(0, 2);
    e.currentTarget.value = v; // keep the DOM in step with the cleaned value (a re-render alone would not undo a rejected character)
    setText(v);
    clearTimeout(timer.current);
    timer.current = null;
    if (/^\d{1,2}$/.test(v) && Number(v) >= 1) {
      timer.current = setTimeout(() => {
        timer.current = null;
        actions.target(Number(v));
      }, 250);
    }
  };
  // send a target that is still waiting for its debounce before anything else uses it (e.g. Start)
  const flushTarget = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    if (valid) actions.target(n);
  };
  const onBlur = () => {
    flushTarget();
    setText(String(valid ? n : view.target));
  };
  const start = () => {
    flushTarget();
    actions.start();
  };
  const bump = (d) => {
    const next = Math.min(99, Math.max(1, (valid ? n : view.target) + d));
    setText(String(next));
    actions.target(next);
  };

  const enough = view.players.length >= view.limits.min;
  const url = joinUrl(s.info, view.code);
  const shortUrl = joinSite(s.info).replace(/^https?:\/\//, '').replace(/\/$/, '');
  const need = view.limits.min - view.players.length;
  const canStart = enough && (valid || emptied) && view.you.ready && s.conn === 'open';

  return html`<main class="screen lobby">
    <header class="row row--between">
      <${Logo} small />
      <${Button} variant="ghost" size="small icon" onClick=${() => setStore({ sheet: 'rules' })} aria-label="Slik spiller du"><${HelpIcon} /></${Button}>
    </header>

    <div class="stack stack--loose" style="margin-top:var(--s-5)">
      <section class="card card--paper card--tilt-r center stack lobby__qr">
        <p class="eyebrow" style="color:var(--ink);opacity:.7">Skann for å bli med</p>
        <${QR} text=${url} />
        <div class="lobby__join">
          <p class="lobby__code display" aria-label=${`Spillkode ${view.code.split('').join(' ')}`}>${view.code}</p>
          <p class="small">eller gå til<br /><strong>${shortUrl}</strong><br />og skriv koden</p>
        </div>
      </section>

      ${!view.you.ready &&
      html`<button type="button" class="card card--yellow profile-prompt" onClick=${() => setStore({ editing: true })}>
        <span class="avatar avatar--md avatar--unknown" aria-hidden="true">?</span>
        <span class="stack stack--tight">
          <strong class="display">Hvem er du?</strong>
          <span>Velg navn og avatar, så er du med selv.</span>
        </span>
      </button>`}

      ${isP2P && html`<p class="small muted center" role="note" style="max-width:24rem;margin-inline:auto">Du er spillets «server». Hold denne siden åpen mens dere spiller. Laster du den på nytt, fortsetter spillet der det var.</p>`}

      <section class="stack">
        <h2 class="center">Spillere <span class="muted">${view.players.length}/${view.limits.max}</span></h2>
        <${Players} view=${view} kickable />
        ${view.you.ready &&
        html`<div class="row row--center">
          <${Button} variant="text" onClick=${() => setStore({ editing: true })}>Endre navn eller avatar</${Button}>
        </div>`}
        <${AwakeTip} />
      </section>

      <section class="card stack">
        <div class="field">
          <label class="field__label" for="target">Hvor mange poeng skal dere spille til?</label>
          <div class="stepper">
            <${Button} variant="cream" size="icon" onClick=${() => bump(-1)} aria-label="Ett poeng mindre" disabled=${valid && n <= 1}>−</${Button}>
            <input id="target" class="input" value=${text} placeholder=${String(view.target)} onInput=${onInput} onFocus=${() => setText('')} onBlur=${onBlur} inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-describedby="target-hint" />
            <${Button} variant="cream" size="icon" onClick=${() => bump(1)} aria-label="Ett poeng mer" disabled=${valid && n >= 99}>+</${Button}>
          </div>
          ${!valid && !emptied && html`<span class="field__error">Skriv et tall mellom 1 og 99.</span>`}
          <span class="field__hint" id="target-hint">
            Ett poeng tar ca. ${MINUTES_PER_POINT} minutter. Vi anbefaler minst 5 poeng for å krone en vinner.
            ${valid && html` Det blir ${duration(n * MINUTES_PER_POINT)}.`}
          </span>
        </div>
      </section>
    </div>

    <div class="dock">
      <p class="center small" role="status">
        ${!view.you.ready
          ? html`<span class="muted">Velg navn og avatar først, så kan du starte.</span>`
          : enough
            ? html`Spiller til <strong>${view.target} poeng</strong> · ${duration(view.target * MINUTES_PER_POINT)}`
            : html`<span class="muted">Dere må være minst ${view.limits.min}. Vent på ${need} ${plural(need, 'spiller', 'spillere')} til.</span>`}
      </p>
      <${Button} block variant="lime" onClick=${start} disabled=${!canStart}>Start Disputt</${Button}>
    </div>
  </main>`;
}

function GuestLobby({ view }) {
  const host = view.players.find((p) => p.isHost);
  const me = view.players.find((p) => p.id === view.you.id);
  return html`<main class="screen lobby">
    <header class="row row--between">
      <${Logo} small />
      <${Button} variant="ghost" size="small icon" onClick=${() => setStore({ sheet: 'rules' })} aria-label="Slik spiller du"><${HelpIcon} /></${Button}>
    </header>

    <div class="stack stack--loose grow" style="margin-top:var(--s-5)">
      <section class="center stack" style="align-items:center">
        <${Avatar} id=${me?.avatar} size="xl" alive />
        <h1>Du er med${me ? `, ${me.name}` : ''}!</h1>
        <p class="lead muted">Venter på at ${host ? html`<strong>${host.name}</strong>` : 'verten'} starter spillet …</p>
      </section>

      <section class="stack">
        <h2 class="center">Spillere <span class="muted">${view.players.length}</span></h2>
        <${Players} view=${view} />
        <${AwakeTip} />
      </section>
    </div>

    <div class="dock">
      <div class="row row--center row--wrap">
        <${Button} variant="text" onClick=${() => setStore({ editing: true })}>Endre navn eller avatar</${Button}>
        <${Button} variant="text" onClick=${() => setStore({ sheet: 'qr' })}>Vis QR-koden</${Button}>
        <${Button} variant="text" onClick=${() => actions.leave()}>Forlat spillet</${Button}>
      </div>
    </div>
  </main>`;
}
