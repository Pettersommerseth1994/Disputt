// The three flags, drawn here: a flag emoji is only a pair of letters on some phones and computers.

const FLAGS = {
  no: { full: '0 0 22 16', round: '0 0 16 16', body: '<rect width="22" height="16" fill="#ba0c2f"/><rect x="6" width="4" height="16" fill="#fff"/><rect y="6" width="22" height="4" fill="#fff"/><rect x="7" width="2" height="16" fill="#00205b"/><rect y="7" width="22" height="2" fill="#00205b"/>' },
  da: { full: '0 0 37 28', round: '0 0 28 28', body: '<rect width="37" height="28" fill="#c8102e"/><rect x="12" width="4" height="28" fill="#fff"/><rect y="12" width="37" height="4" fill="#fff"/>' },
  sv: { full: '0 0 16 10', round: '1 0 10 10', body: '<rect width="16" height="10" fill="#006aa7"/><rect x="5" width="2" height="10" fill="#fecc02"/><rect y="4" width="16" height="2" fill="#fecc02"/>' },
};

import { html } from '../vendor/htm-preact.js';

/** `round`: the cross of the flag in a circle; otherwise the whole flag. */
export function Flag({ code, round = false }) {
  const f = FLAGS[code];
  return html`<span class=${`lang-flag ${round ? 'lang-flag--round' : ''}`} aria-hidden="true">
    <svg viewBox=${round ? f.round : f.full} preserveAspectRatio="xMidYMid slice" dangerouslySetInnerHTML=${{ __html: f.body }}></svg>
  </span>`;
}
