// Bilturmodus: the role strip. Everybody plays on the host's phone, which knows every player's role (`view.table`), so the strip that
// reminds you of your role in the normal game cannot know whose role to show. Instead:
//  - while the phone goes round, the player whose turn it is has the very same strip as in the normal game (screens/car.js, CarRoles):
//    the button on the right, and the role on the left while it is held. `TableStrip` is that strip.
//  - on the game screens the strip only asks "Glemt rollen din?", and a tap opens "Se rolle igjen": say who you are, then hold.
// A role is on the screen only while a finger holds the button, and it is gone when the finger lifts.
// (A file of its own: pages are cached for ten minutes, and a module that imports something an older cached copy of another
// module does not have would not load.)

import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { useHold } from '../hold.js';
import { impostorCount, joinNames, matesOf } from '../impostors.js';
import { setStore, store } from '../store.js';
import { Avatar, Sheet } from '../ui.js';
import { cx } from '../util.js';

const close = () => setStore({ sheet: null });

/**
 * The strip of the normal game (ui.js, RoleStrip) for one row of the table. `onRelease(ms)` is told how long the button was held, when
 * the finger lifts: the phone going round counts a role as seen from that.
 *
 * `lockMs`: a strip that has just been handed to somebody is not armed at once. The finger that let go of the last one may still be there
 * (and the page may have scrolled this very button to the spot where it was): a second press there would show this player's role to the
 * wrong person, and a tap that is too short to count as a look would still show it. The button waits, dimmed, for that long.
 */
export function TableStrip({ row, impostors = 1, onRelease, lockMs = 0 }) {
  const { held, bind } = useHold();
  const impostor = row.role === 'impostor';
  const pressedAt = useRef(0);
  const [locked, setLocked] = useState(lockMs > 0 && !store.qaHold); // (QA shows every strip held, with or without a finger)
  useEffect(() => {
    if (!locked) return undefined;
    const timer = setTimeout(() => setLocked(false), lockMs);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (held) {
      pressedAt.current = Date.now();
      return;
    }
    if (pressedAt.current) {
      const ms = Date.now() - pressedAt.current;
      pressedAt.current = 0;
      onRelease?.(ms);
    }
  }, [held]);
  // What the hold reveals stands beside the button, never in it or under it: the finger covers what is there.
  return html`<div class=${cx('role-strip', held ? 'role-strip--open' : 'role-strip--hidden')}>
    <div class="role-strip__info">
      ${held
        ? html`<span class="role-strip__who">Du er <strong class=${impostor ? 'role-strip__impostor' : 'role-strip__loyal'}>${impostor ? 'Imposter' : 'Lojal'}</strong></span>
            ${impostor
              ? html`<span class="role-strip__line role-strip__line--answer"><span>Riktig svar:</span><span class="role-strip__answer">${row.secret.letter}: ${row.secret.text}</span></span>`
              : html`<span class="role-strip__line">Ikke bli lurt!</span>`}
            ${impostors > 1 &&
            html`<span class="role-strip__line">${impostor ? `Sammen med ${joinNames(matesOf(row).map((m) => m.name))}` : 'To av dere er imposterer'}</span>`}`
        : html`<span>Din rolle</span>`}
    </div>
    <button type="button" class=${cx('secret', held && 'secret--held', locked && 'secret--wait')} disabled=${locked} ...${locked ? {} : bind} aria-label="Hold inne for å se rollen din">Hold for å se</button>
  </div>`;
}

/** On the game screens, where the normal game has the strip: it only asks, and "Se rolle" opens the list of names. */
export function CarStrip() {
  return html`<div class="role-strip role-strip--hidden">
    <div class="role-strip__info"><span>Glemt rollen din?</span></div>
    <button type="button" class="secret" onClick=${() => setStore({ sheet: 'roles' })}>Se rolle</button>
  </div>`;
}

/**
 * "Se rolle igjen": tap your name, and the strip is there: hold the button. Nothing is shown until a finger holds it.
 * (The list keeps the height it has with the strip open, `--rows` names and all: a sheet sits on the bottom of the screen, and a list that
 * grew when the strip opened would push the button up and away from the finger that holds it.)
 */
export function RolesSheet({ view }) {
  const table = view.table ?? [];
  const [who, setWho] = useState(null);
  const count = impostorCount(view);
  const rowRef = useRef(null);
  // (with ten names the row of the one who was tapped, with its button, may lie below what the sheet shows: it is brought into view)
  useEffect(() => {
    if (who) rowRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [who]);
  return html`<${Sheet} title="Se rolle igjen" onClose=${close}>
    <div class="stack">
      <p class="lead">Hvem er du? Trykk på navnet ditt, og hold inne knappen for å se rollen din.</p>
      <ul class="rolelist__list rolelist__list--plain" style=${`--rows:${table.length}`}>
        ${table.map((r) =>
          r.id === who
            ? html`<li class="rolerow rolerow--strip" key=${r.id} ref=${rowRef}>
                <${Avatar} id=${r.avatar} size="sm" />
                <span class="rolerow__name">${r.name}</span>
                <${TableStrip} row=${r} impostors=${count} />
              </li>`
            : html`<li class="roster__item" key=${r.id}>
                <button type="button" class="roster__main" onClick=${() => setWho(r.id)}>
                  <${Avatar} id=${r.avatar} size="sm" />
                  <span class="roster__name">${r.name}</span>
                </button>
              </li>`,
        )}
      </ul>
      <p class="small muted">Skjul skjermen for de andre.</p>
    </div>
  </${Sheet}>`;
}
