// The mantra: a small strip at the very top of every screen, «★ Mantra». A tap opens a bubble with what Team Disputt wants to say:
// Disputt is a game between people, and the phone is only a tool for the quiz, to be used as little as possible.
// The strip is in the flow above the screen and keeps its place at the top while the screen scrolls (css/mantra.css makes the room for it).
// The bubble hangs under it and lies over the screen. A tap anywhere closes it, and does nothing else, so the tap that closes it never
// presses a button by mistake. So do Escape and another screen coming up (the bubble would otherwise lie over the countdown).
// (A folder of its own: pages are cached for ten minutes, and a module that imports something an older cached copy of another module does
// not have would not load. The style sheet is loaded by the script itself for the same reason: styles.js.)

import { html, useEffect, useState } from '../vendor/htm-preact.js';
import { t, tx } from '../i18n/lang.js';
import { useMantraStyles } from './styles.js';

/** What the strip says and what the bubble says. The signature is Team Disputt: the people who made the game. */
export const MANTRA = {
  label: tx('Mantra'),
  lines: [
    tx('Disputt er et sosialt selskapsspill, laget for å spilles mellom mennesker.'),
    tx('Telefonen er bare et støtteverktøy for quizen. Vi vil at du bruker den så lite som mulig.'),
    tx('Se på hverandre, ikke på skjermen.'),
  ],
  signature: tx('Team Disputt'),
};

/** The star (like the other icons of the app: round line ends, the colour of the text around it). */
const Star = () =>
  html`<svg class="mantra__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3L14.65 8.96L21.13 9.63L16.28 13.99L17.64 20.37L12 17.1L6.36 20.37L7.72 13.99L2.87 9.63L9.35 8.96Z" fill="currentColor" /></svg>`;

/** `screen` is anything that changes when a new screen comes up: the bubble closes then. */
export function Mantra({ screen }) {
  const ready = useMantraStyles();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [screen]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!ready) return null;

  const close = () => setOpen(false);
  return html`<div class="mantra">
    <div class="mantra__bar">
      <button type="button" class="mantra__pill" aria-expanded=${open} aria-controls=${open ? 'mantra-bubble' : undefined} onClick=${() => setOpen(!open)}>
        <${Star} /><span>${t(MANTRA.label)}</span>
      </button>
    </div>
    ${open &&
    html`<div class="mantra__catcher" onClick=${close}></div>
      <div class="mantra__bubble" id="mantra-bubble" role="note">
        ${MANTRA.lines.map((line, i) => html`<p class="mantra__line" key=${i}>${t(line)}</p>`)}
        <p class="mantra__sign">${t(MANTRA.signature)}</p>
      </div>`}
  </div>`;
}
