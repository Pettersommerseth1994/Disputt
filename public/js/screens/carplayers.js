// Bilturmodus, from the host's options: who is playing can be changed in the middle of a game. A player can be put in (name, avatar and the points
// they come in with, 0 by default; they play from the next round) and taken out (with their points). (A file of its own: pages are cached for ten
// minutes, and this one only uses what already was in the other files.)

import { AVATARS } from '../../shared/avatars.mjs';
import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { t } from '../i18n/lang.js';
import { actions } from '../net.js';
import { Avatar, Button, Sheet } from '../ui.js';

const NAME_MAX = 14;

/** Two taps to take somebody out: the first says what it costs. */
function RemoveButton({ player }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const tap = () => {
    if (armed) return actions.kick(player.id);
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), 3500);
  };
  return html`<${Button} size="small" variant="ghost" onClick=${tap} aria-label=${armed ? t('Trykk igjen for å fjerne {name}', { name: player.name }) : t('Fjern {name}', { name: player.name })}>${armed ? (player.score > 0 ? t('Mister poengene. Sikker?') : t('Sikker?')) : t('Fjern')}</${Button}>`;
}

/** The players, each with a way to take them out, and a button to put one in. `onAdd` opens the form (AddPlayerSheet, which stands outside this sheet). */
export function CarPlayers({ view, onAdd }) {
  const players = view.players;
  const full = players.length >= view.limits.max;
  const few = players.length <= view.limits.min; // (it takes two to play)
  return html`<section class="stack stack--tight carplayers">
    <span class="field__label">${t('Hvem spiller')}</span>
    <ul class="roster">
      ${players.map(
        (p) => html`<li class="offline-row" key=${p.id}>
          <span class="offline-row__who"><${Avatar} id=${p.avatar} size="xs" /><span>${p.name}${p.isHost ? ` (${t('vert')})` : ''}</span><span class="muted"> · ${t('{n} poeng', { n: p.score })}</span></span>
          ${!p.isHost && !few && html`<${RemoveButton} player=${p} />`}
        </li>`,
      )}
    </ul>
    ${few && html`<span class="field__hint">${t('Dere må være minst {min}. Legg til en ny før du fjerner noen.', { min: view.limits.min })}</span>`}
    ${!full
      ? html`<${Button} block variant="cream" onClick=${onAdd}>${t('+ Legg til spiller')}</${Button}>`
      : html`<span class="field__hint">${t('Det er plass til {max} i bilen.', { max: view.limits.max })}</span>`}
    <span class="field__hint">${t('Den som legges til spiller fra neste runde. Den som fjernes, tar poengene sine med seg.')}</span>
  </section>`;
}

/** Name, avatar and the points to come in with. Closes when the game has put the player in (a rejection arrives as a toast, and this stays). */
export function AddPlayerSheet({ view, onClose }) {
  const takenBy = new Map(view.players.map((p) => [p.avatar, p.name]));
  const firstFree = AVATARS.find((a) => !takenBy.has(a.id))?.id ?? null; // (the next face that is free is already chosen: a name is all it takes)
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(firstFree);
  const [points, setPoints] = useState(0);
  const [busy, setBusy] = useState(false);
  const count = useRef(view.players.length);
  const clean = name.replace(/\s+/g, ' ').trim();
  const ready = clean.length > 0 && avatar && !busy;
  const highest = Math.max(0, view.target - 1);
  const choosesPoints = view.phase !== 'finished'; // (a game that is over starts from nothing again)

  useEffect(() => {
    setBusy(false);
    if (view.players.length > count.current) onClose();
  }, [view]);

  const submit = (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setTimeout(() => setBusy(false), 2500);
    actions.addPlayer(clean, avatar, choosesPoints ? points : 0);
  };

  return html`<${Sheet} title=${t('Ny spiller')} onClose=${onClose}>
    <form class="stack" onSubmit=${submit}>
      <div class="field">
        <label class="field__label" for="new-player-name">${t('Navn')}</label>
        <input id="new-player-name" class="input" value=${name} onInput=${(e) => (setBusy(false), setName(e.currentTarget.value))} maxlength=${NAME_MAX} autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder=${t('Skriv navnet')} />
      </div>
      <div class="field">
        <span class="field__label" id="new-player-avatar-label">${t('Velg avatar')}</span>
        <div class="picker" role="radiogroup" aria-labelledby="new-player-avatar-label">
          ${AVATARS.map((a) => {
            const taken = takenBy.has(a.id);
            return html`<button type="button" role="radio" class="picker__item" key=${a.id} aria-checked=${avatar === a.id} aria-label=${taken ? t('{avatar} (tatt av {name})', { avatar: t(a.name), name: takenBy.get(a.id) }) : t(a.name)} disabled=${taken} onClick=${() => (setBusy(false), setAvatar(a.id))}>
              <${Avatar} id=${a.id} size="md" />
            </button>`;
          })}
        </div>
      </div>
      ${choosesPoints &&
      html`<div class="field">
        <span class="field__label" id="new-player-points-label">${t('Poeng hen kommer inn med')}</span>
        <div class="stepper" role="group" aria-labelledby="new-player-points-label">
          <${Button} type="button" variant="cream" size="icon" onClick=${() => setPoints(Math.max(0, points - 1))} aria-label=${t('Ett poeng mindre')} disabled=${points <= 0}>−</${Button}>
          <output class="input input--number" aria-live="polite">${points}</output>
          <${Button} type="button" variant="cream" size="icon" onClick=${() => setPoints(Math.min(highest, points + 1))} aria-label=${t('Ett poeng mer')} disabled=${points >= highest}>+</${Button}>
        </div>
        <span class="field__hint">${t('0 er vanlig. Spillet er til {target} poeng, så fra 0 til {highest}. Hen spiller fra neste runde.', { target: view.target, highest })}</span>
      </div>`}
      <${Button} block type="submit" disabled=${!ready}>${t('Legg til')}</${Button}>
    </form>
  </${Sheet}>`;
}
