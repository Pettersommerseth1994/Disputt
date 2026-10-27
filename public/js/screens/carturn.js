// Bilturmodus: the turn of the player whose turn it is while the phone goes round. The tall card (screens/car.js, CarRoles, puts it where the strip was):
// the field with the time above it (screens/equal.js), the avatar and the name, the place of the role, and the standard button under it. The place of the role
// has the same size open and closed, so the button never moves when it opens, and it is dark and the same for everybody while nothing is held. The role is on the
// screen only while the finger holds; everybody holds the same time (4 s); a finger that lifts too soon hides the role and does not count.
// A button that has just been handed over is locked for a moment («Vent …»): the finger that let go of the last one may still be there.
// (A file of its own: pages are cached for ten minutes.)

import { html, useState } from '../vendor/htm-preact.js';
import { t } from '../i18n/lang.js';
import { joinNames, matesOf } from '../impostors.js';
import { Avatar, Button } from '../ui.js';
import { cx } from '../util.js';
import { Roll, TimeField, useArmed, useEqualHold, useEqualStyles } from './equal.js';

const LOCK_MS = 1500; // (the same as HANDOVER_LOCK_MS in car.js)

/** What the hold reveals, only while the button is held: «Du er Imposter» and the right answer at once, «Du er Lojal» (after a little while, rolling in) and «Ikke bli lurt!». */
function RoleBody({ row, impostors }) {
  const imp = row.role === 'impostor';
  const answer = imp ? `${row.secret.letter}: ${row.secret.text}` : '';
  return html`<div class=${cx('eq-role', imp ? 'eq-role--imp' : 'eq-role--loyal')}>
    <p class="eq-role__who"><span class="eq-role__lead">${t('Du er')}</span> ${imp ? html`<strong class="eq-role__word">${t('Imposter')}</strong>` : html`<${Roll}><strong class="eq-role__word">${t('Lojal')}</strong></${Roll}>`}</p>
    ${imp
      ? html`<p class="eq-role__ans"><span class="eq-role__label">${t('Riktig svar:')}</span> <b class=${cx('eq-role__answer', answer.length > 15 && 'is-long', answer.length > 24 && 'is-longer')}>${answer}</b></p>`
      : html`<p class="eq-role__tip"><${Roll}>${t('Ikke bli lurt!')}</${Roll}></p>`}
    ${impostors > 1 &&
    html`<p class="eq-role__mates">${imp ? t('Sammen med {names}', { names: joinNames(matesOf(row).map((m) => m.name)) }) : t('To av dere er impostere')}</p>`}
  </div>`;
}

/** What is there while nothing is held: the same for every player, so a glance at the screen tells nothing. */
const Closed = ({ locked, early }) => html`<div class="eq-closed">
  <p class="eq-closed__t">${t('Din rolle')}</p>
  <p class=${cx('eq-closed__s', early && 'is-early')}>${early ? t('For tidlig! Hold hele tiden') : locked ? t('Knappen er klar om et øyeblikk.') : t('Hold knappen, og skjul skjermen for de andre.')}</p>
</div>`;

/** `onSeen()`: the finger held the whole time, so the role counts as seen. `first`: the host starts (the card says so). Keyed by the player by the caller. */
export function CarTurn({ row, n, isHost, first, impostors = 1, onSeen, innerRef }) {
  const styled = useEqualStyles();
  const armed = useArmed(LOCK_MS);
  const [early, setEarly] = useState(false);
  const hold = useEqualHold({
    locked: !armed,
    onSeen: () => {
      setEarly(false);
      onSeen?.();
    },
    onEarly: () => setEarly(true),
  });
  if (!styled) return null;
  const open = hold.held;
  const imp = open && row.role === 'impostor';
  return html`<li class=${cx('eq-turn', open && 'is-open')} ref=${innerRef}>
    <${TimeField} hold=${hold} early=${early} />
    <div class="eq-now">
      <div class="eq-now__head">
        <span class="rolerow__n">${n}</span>
        <${Avatar} id=${row.avatar} size="md" />
        <span class="eq-now__who">
          <span class="eq-now__eyebrow">${first ? t('Verten starter') : t('Gi telefonen til')}</span>
          <span class="rolerow__name eq-now__name">${row.name}${isHost ? html`<small>${t('vert')}</small>` : null}</span>
        </span>
      </div>
      <div class=${cx('eq-info', open && 'is-open', imp && 'is-imp', impostors > 1 && 'eq-info--duo')} role="status" aria-live="polite">
        ${open ? html`<${RoleBody} row=${row} impostors=${impostors} />` : html`<${Closed} locked=${hold.locked} early=${early} />`}
      </div>
    </div>
    <${Button} block class=${cx('eq-hold', open && 'is-held', hold.done && 'eq-done')} disabled=${hold.locked} ...${hold.bind} aria-label=${t('Hold inne for å se rollen din')}>
      ${hold.locked ? t('Vent …') : open ? t('Hold inne …') : t('Hold for å se')}
    </${Button}>
  </li>`;
}
