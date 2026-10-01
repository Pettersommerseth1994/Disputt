// Shared UI components (the JS half of the design system; styles live in /css/components.css).

import { AVATARS } from '../shared/avatars.mjs';
import { html, useEffect, useMemo, useRef, useState } from './vendor/htm-preact.js';
import { qrSvg } from './qr.js';
import { ROOT, asset } from './paths.js';
import { config, isP2P } from './settings.js';
import { setStore, toast } from './store.js';
import { clock, cx, ranking, useRemaining } from './util.js';

export const avatarOf = (id) => AVATARS.find((a) => a.id === id);

export function Avatar({ id, size = 'md', alive = false, offline = false, crown = false, badge = null, label, class: cls, style }) {
  const a = avatarOf(id);
  return html`<span
    class=${cx('avatar', `avatar--${size}`, alive && 'avatar--alive', offline && 'avatar--offline', cls)}
    style=${style}
    role="img"
    aria-label=${label ?? a?.name ?? 'Avatar'}
  >
    ${crown && html`<img class="avatar__crown" src=${asset('assets/art/crown.svg')} alt="" />`}
    ${a && html`<img src=${asset(`assets/avatars/${a.id}.svg`)} alt="" width="400" height="400" decoding="async" />`}
    ${badge !== null && html`<span class="avatar__badge">${badge}</span>`}
  </span>`;
}

export function Button({ variant, size, block, class: cls, children, ...rest }) {
  const sizes = String(size ?? '')
    .split(' ')
    .filter(Boolean)
    .map((s) => `btn--${s}`);
  return html`<button
    type="button"
    class=${cx('btn', variant && `btn--${variant}`, ...sizes, block && 'btn--block', cls)}
    ...${rest}
  >
    ${children}
  </button>`;
}

export function Logo({ small = false }) {
  return html`<span class=${cx('logo-sticker', small && 'logo-sticker--sm')}>
    <img src=${asset('assets/logo/disputt-logo.svg')} alt="Disputt" width="300" height="130" />
  </span>`;
}

export const CloseIcon = () => html`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg>`;
export const TrophyIcon = () => html`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8 20h8" /></svg>`;
export const HelpIcon = () => html`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1.1.9-1.1 1.8M12 17h.01" /></svg>`;

/** mm:ss with fixed-width digit cells so the numbers never jitter. */
export function Timer({ endsAt, small = false, label }) {
  const ms = useRemaining(endsAt);
  const text = clock(ms);
  const state = ms <= 0 ? 'out' : ms <= 30_000 ? 'low' : '';
  return html`<div class=${cx('timer', small && 'timer--sm', state && `timer--${state}`)} role="timer" aria-label=${label ?? `Tid igjen ${text}`}>
    ${[...text].map((ch, i) => (ch === ':' ? html`<span class="timer__c" key=${i}>:</span>` : html`<span class="timer__d" key=${i}>${ch}</span>`))}
  </div>`;
}

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return html`<div class="sheet-backdrop" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="sheet" role="dialog" aria-modal="true" aria-label=${title}>
      <div class="sheet__head">
        <h2>${title}</h2>
        <${Button} variant="ghost" size="small icon" class="sheet__close" onClick=${onClose} aria-label="Lukk"><${CloseIcon} /></${Button}>
      </div>
      ${children}
    </div>
  </div>`;
}

/** Press and hold to peek at the impostor's secret answer; letting go hides it again. */
export function HoldToReveal({ secret }) {
  const [open, setOpen] = useState(false);
  const down = (e) => {
    e.preventDefault();
    setOpen(true);
  };
  const up = () => setOpen(false);
  const key = (on) => (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setOpen(on);
    }
  };
  return html`<button
    type="button"
    class=${cx('secret', open && 'secret--open')}
    onPointerDown=${down}
    onPointerUp=${up}
    onPointerLeave=${up}
    onPointerCancel=${up}
    onKeyDown=${key(true)}
    onKeyUp=${key(false)}
    onBlur=${up}
    onContextMenu=${(e) => e.preventDefault()}
    aria-label="Hold inne for å se riktig svar"
  >
    ${open ? `${secret.letter}: ${secret.text}` : 'Hold for svaret'}
  </button>`;
}

/** The slim "you are X" reminder shown above the game screens. */
export function RoleStrip({ you }) {
  if (you.role === 'impostor') {
    return html`<div class="role-strip role-strip--impostor">
      <span>Du er <strong>IMPOSTER</strong></span>
      <${HoldToReveal} secret=${you.secret} />
    </div>`;
  }
  return html`<div class="role-strip role-strip--loyal">
    <span>Du er <strong>LOJAL</strong></span>
    <span>Ikke bli lurt!</span>
  </div>`;
}

export function Scoreboard({ view, gains = {} }) {
  const rows = ranking(view.players);
  return html`<ol class="scoreboard">
    ${rows.map((p) => {
      const accent = avatarOf(p.avatar)?.accent ?? 'var(--yellow)';
      const pct = Math.min(1, p.score / Math.max(1, view.target));
      return html`<li class=${cx('score', p.rank === 1 && p.score > 0 && 'score--leader', !p.connected && 'score--offline')} key=${p.id}>
        <span class="score__rank">${p.rank}</span>
        <${Avatar} id=${p.avatar} size="sm" crown=${p.rank === 1 && p.score > 0} offline=${!p.connected} />
        <div>
          <div class="score__name">${p.name}${p.id === view.you.id ? html`<small>(deg)</small>` : ''}</div>
          <div class=${cx('bar', p.score === 0 && 'bar--zero')} style=${`--p:${pct};--fill:${accent}`}><div class="bar__fill"></div></div>
        </div>
        <span class="score__points">${p.score}${gains[p.id] ? html`<span class="score__gain">+${gains[p.id]}</span>` : ''}</span>
      </li>`;
    })}
  </ol>`;
}

// ------------------------------------------------------------------ QR code

export function QR({ text, label = 'QR-kode for å bli med i spillet' }) {
  const svg = useMemo(() => qrSvg(text), [text]);
  return html`<div class="qr" role="img" aria-label=${label} dangerouslySetInnerHTML=${{ __html: svg }}></div>`;
}

/** Puts text on the clipboard; false when the browser refuses (no HTTPS, no permission). */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall through to the old way */
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    /* not allowed either */
  }
  area.remove();
  return ok;
}

/** "Del lenke": opens the phone's share sheet (Messages, WhatsApp …) so friends who are not in the room can join; elsewhere the link is copied. */
export function ShareLink({ url, code, variant = 'orange' }) {
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Disputt', text: `Bli med på Disputt! Spillkode: ${code}`, url });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return; // the player closed the share sheet
      // anything else: sharing is not available here, so copy instead
    }
    if (await copyText(url)) toast('Lenken er kopiert. Send den til de andre.');
    else toast(`Kopier lenken: ${url}`, 12000);
  };
  return html`<${Button} variant=${variant} size="small" onClick=${share}>Del lenke</${Button}>`;
}

/** Address phones should open: the public URL if configured, else the LAN address when the host page is on localhost. */
export function joinBase(info) {
  if (info?.publicUrl) return info.publicUrl.replace(/\/$/, '');
  const host = location.hostname;
  const local = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local');
  if (local && info?.lanUrls?.length) return info.lanUrls[0];
  return location.origin;
}

/** The site players open to join (always with a trailing slash). */
export function joinSite(info) {
  // On static hosting (peer-to-peer) or with a remote game server, the page itself is the address to share.
  if (isP2P || config.serverUrl) return `${location.origin}${ROOT.pathname}`;
  return `${joinBase(info)}/`;
}

/** The link a phone opens to join `code` (this is what the QR code contains). */
export function joinUrl(info, code) {
  const keep = new URLSearchParams();
  // local test overrides (?mode=p2p&peerHost=…) must follow the link, or the guest would run in a different mode
  for (const [k, v] of new URLSearchParams(location.search)) if (['mode', 'peerHost', 'peerPort', 'peerPath', 'peerSecure', 'ice'].includes(k)) keep.set(k, v);
  keep.set('j', code);
  return `${joinSite(info)}?${keep}`;
}

/** True where the browser can keep the screen awake (needs HTTPS or localhost). Elsewhere we tell players to turn off auto-lock. */
export const keepsAwake = typeof navigator !== 'undefined' && 'wakeLock' in navigator && window.isSecureContext;

/** Keeps the screen awake while a game is on (where the browser allows it). */
export function useWakeLock(active) {
  const lock = useRef(null);
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let cancelled = false;
    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request('screen');
        if (cancelled) l.release();
        else lock.current = l;
        setStore({ wakeLockDenied: false });
      } catch {
        // Refused (low-power mode, a home-screen app …). The game still works, but the screen will lock by itself, so
        // the lobby asks players to turn auto-lock off by hand.
        setStore({ wakeLockDenied: true });
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && acquire();
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock.current?.release().catch(() => {});
      lock.current = null;
    };
  }, [active]);
}

export function Confetti({ count = 36 }) {
  const pieces = useMemo(() => {
    const colors = ['var(--yellow)', 'var(--lime)', 'var(--orange)', 'var(--pink)', 'var(--blue-light)', 'var(--violet)', 'var(--cream)'];
    return Array.from({ length: count }, (_, i) => ({
      x: `${(i * 97) % 100}%`,
      c: colors[i % colors.length],
      d: `${3.2 + ((i * 37) % 30) / 10}s`,
      delay: `${-((i * 53) % 40) / 10}s`,
      w: `${0.45 + ((i * 29) % 6) / 10}rem`,
      r0: `${(i * 41) % 180}deg`,
      r1: `${360 + ((i * 67) % 360)}deg`,
    }));
  }, [count]);
  return html`<div class="confetti" aria-hidden="true">
    ${pieces.map((p, i) => html`<i key=${i} style=${`--x:${p.x};--c:${p.c};--d:${p.d};--delay:${p.delay};--w:${p.w};--r0:${p.r0};--r1:${p.r1}`}></i>`)}
  </div>`;
}
