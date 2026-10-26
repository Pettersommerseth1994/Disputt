// Lobby: the host's last step is the invitation (the QR code, the code and a way to share them) while the game waits for its
// players, and then Start. Everyone sees who has joined.

import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { actions } from '../net.js';
import { t } from '../i18n/lang.js';
import { setStore, useStore } from '../store.js';
import { Avatar, Button, CloseIcon, GearIcon, HelpIcon, Logo, QR, ShareLink, joinUrl } from '../ui.js';
import { isP2P } from '../settings.js';
import { cx } from '../util.js';
import { AwakeTip } from './awake.js';
import { MINUTES_PER_POINT, SetupHeader, Steps, duration } from './setup.js';
import { TwoPlayersNote } from './twonote.js';

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
  return html`<button class=${cx('player__kick', armed && 'player__kick--armed')} onClick=${tap} aria-label=${armed ? t('Trykk igjen for å fjerne {name}', { name: player.name }) : t('Fjern {name}', { name: player.name })}>
    ${armed ? t('Fjern?') : html`<${CloseIcon} />`}
  </button>`;
}

function Players({ view, kickable = false, compact = false }) {
  const missing = Math.max(0, view.limits.min - view.players.length);
  const size = compact ? 'sm' : 'md';
  return html`<div class=${cx('player-grid', compact && 'player-grid--compact')}>
    ${view.players.map(
      (p, i) => html`<div class="player" key=${p.id} style=${`animation-delay:${i * 40}ms`}>
        <${Avatar} id=${p.avatar} size=${size} alive=${p.connected} offline=${!p.connected} crown=${p.isHost} label=${p.name} />
        <span class="player__name">${p.name}</span>
        ${!p.connected && html`<span class="player__tag">${t('frakoblet')}</span>`}
        ${kickable && !p.isHost && html`<${KickButton} player=${p} />`}
      </div>`,
    )}
    ${Array.from({ length: Math.min(missing, 3) }, (_, i) => html`<div class="player player--empty" key=${`e${i}`} aria-hidden="true"><span class=${`avatar avatar--${size}`}></span><span class="player__name muted">${t('venter …')}</span></div>`)}
  </div>
  ${view.pending > 0 && html`<p class="center muted small" role="status">${t('{n} til er på vei inn …', { n: view.pending })}</p>`}`;
}

/** Who has come so far, as a row of overlapping faces (the list with names is further down the page). */
function Facepile({ players, max = 6 }) {
  const shown = players.slice(0, max);
  const more = players.length - shown.length;
  return html`<span class="facepile" aria-hidden="true">
    ${shown.map((p) => html`<${Avatar} key=${p.id} id=${p.avatar} size="xs" offline=${!p.connected} class="facepile__face" />`)}
    ${more > 0 && html`<span class="facepile__more">+${more}</span>`}
  </span>`;
}

function HostLobby({ view }) {
  const s = useStore();
  const enough = view.players.length >= view.limits.min;
  const url = joinUrl(s.info, view.code);
  const need = view.limits.min - view.players.length;
  const canStart = enough && view.you.ready && s.conn === 'open';
  // from six players in the round there are two impostors (the round counts the players whose phones are connected)
  const twoImpostors = view.players.filter((p) => p.connected).length >= (view.limits.twoImpostorsFrom ?? Infinity);

  return html`<main class="screen lobby">
    <${SetupHeader} />
    <${Steps} current=${5} onBack=${() => setStore({ step: 2 })} />

    <div class="stack">
      <header class="stack stack--tight">
        <h1 class="setup__title rise-in">${t('Få med vennene dine')}</h1>
        <p class="lead muted">${t('Del QR-koden, så kan de bli med.')}</p>
      </header>

      <section class="card card--paper card--tilt-r invite">
        <button type="button" class="invite__qr" onClick=${() => setStore({ sheet: 'qr' })} aria-label=${t('Vis QR-koden stor')}>
          <${QR} text=${url} />
          <span class="invite__zoom">${t('Trykk for å forstørre')}</span>
        </button>
        <div class="invite__side">
          <p class="invite__label">${t('Spillkode')}</p>
          <p class="lobby__code invite__code display" aria-label=${t('Spillkode {code}', { code: view.code.split('').join(' ') })}>${view.code}</p>
          <${ShareLink} url=${url} code=${view.code} />
        </div>
      </section>

      <div class="row row--center row--wrap lobby__rules">
        <p class="small">${t('Spiller til')} <strong>${t('{n} poeng', { n: view.target })}</strong> · ${duration(view.target * MINUTES_PER_POINT)}${twoImpostors ? ` · ${t('to imposterer')}` : ''}</p>
        <${Button} variant="text" onClick=${() => setStore({ step: 2 })}>${t('Endre')}</${Button}>
      </div>

      <section class="stack">
        <h2 class="center lobby__players">${t('Spillere')} <span class="muted">${view.players.length}/${view.limits.max}</span></h2>
        <${Players} view=${view} kickable compact />
        ${view.you.ready &&
        html`<div class="row row--center">
          <${Button} variant="text" onClick=${() => setStore({ editing: true })}>${t('Endre navn eller avatar')}</${Button}>
        </div>`}
        ${view.players.length === 2 && html`<${TwoPlayersNote} />`}
        <${AwakeTip} />
      </section>

      ${isP2P && html`<p class="small muted center" role="note" style="max-width:24rem;margin-inline:auto">${t('Du er spillets «server». Hold denne siden åpen mens dere spiller. Laster du den på nytt, fortsetter spillet der det var.')}</p>`}
    </div>

    <div class="dock">
      <div class="dock__status" role="status">
        <${Facepile} players=${view.players} />
        <p class="small">
          ${enough
            ? view.players.length === 1
              ? t('{n} spiller er med', { n: view.players.length })
              : t('{n} spillere er med', { n: view.players.length })
            : html`<span class="muted">${need === 1 ? t('Vent på {n} spiller til · minst {min}', { n: need, min: view.limits.min }) : t('Vent på {n} spillere til · minst {min}', { n: need, min: view.limits.min })}</span>`}
        </p>
      </div>
      <${Button} block variant="lime" onClick=${() => actions.start()} disabled=${!canStart}>${t('Start Disputt')}</${Button}>
    </div>
  </main>`;
}

/** «Venter på at Kari starter spillet …» with the name in bold: one sentence for the translation, the name put in where it stands. */
function waitingFor(name) {
  const [before, after] = t('Venter på at {name} starter spillet …', { name: '\u0000' }).split('\u0000');
  return html`${before}<strong>${name}</strong>${after}`;
}

function GuestLobby({ view }) {
  const s = useStore();
  const host = view.players.find((p) => p.isHost);
  const me = view.players.find((p) => p.id === view.you.id);
  return html`<main class="screen screen--padded lobby">
    <header class="row row--between">
      <${Logo} small onClick=${() => setStore({ sheet: 'home' })} />
      <div class="row">
        <${Button} variant="ghost" size="small icon" onClick=${() => setStore({ sheet: 'settings' })} aria-label=${t('Innstillinger')}><${GearIcon} /></${Button}>
        <${Button} variant="ghost" size="small icon" onClick=${() => setStore({ sheet: 'rules' })} aria-label=${t('Slik spiller dere')}><${HelpIcon} /></${Button}>
      </div>
    </header>

    <div class="stack stack--loose grow" style="margin-top:var(--s-5)">
      <section class="center stack" style="align-items:center">
        <${Avatar} id=${me?.avatar} size="xl" alive />
        <h1>${me ? t('Du er med, {name}!', { name: me.name }) : t('Du er med!')}</h1>
        <p class="lead muted">${host ? waitingFor(host.name) : t('Venter på at verten starter spillet …')}</p>
      </section>

      <section class="stack">
        <h2 class="center">${t('Spillere')} <span class="muted">${view.players.length}</span></h2>
        <${Players} view=${view} />
        <${AwakeTip} />
      </section>
    </div>
  </main>`;
}
