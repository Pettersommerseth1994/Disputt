// Name + avatar. Used when joining, and again when someone wants to change their profile in the lobby. For the host it is
// also the second step of the set-up (`wizard`; the first, how to play, is chosen before the game exists).

import { AVATARS } from '../../shared/avatars.mjs';
import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { actions } from '../net.js';
import { setStore } from '../store.js';
import { Avatar, Button } from '../ui.js';
import { SetupHeader, Steps } from './setup.js';

const NAME_MAX = 14;

export function Profile({ view, editing, wizard = false, late = false }) {
  const you = view.you;
  const [points, setPoints] = useState(0); // (somebody who comes into a game that has started chooses what to begin with)
  const highest = Math.max(0, view.target - 1);
  // (players who were in this game and are offline now: somebody who lost their browser takes their own seat back, and the points with it)
  const gone = late ? view.players.filter((p) => !p.connected) : [];
  const takenBy = new Map(view.players.filter((p) => p.id !== you.id).map((p) => [p.avatar, p.name]));
  const [name, setName] = useState(you.name ?? '');
  const [avatar, setAvatar] = useState(you.avatar ?? null);
  const [busy, setBusy] = useState(false);
  const submitted = useRef(false);

  // someone else grabbed my avatar while I was choosing
  useEffect(() => {
    if (avatar && takenBy.has(avatar)) setAvatar(null);
  }, [view.players]);

  const trimmed = name.trim();
  const ready = trimmed.length > 0 && avatar && !busy;

  // The server accepted the profile: leave edit mode, or go on to the next step. (A rejection arrives as a toast instead, and we stay here.)
  useEffect(() => {
    if (submitted.current && (editing || wizard) && you.name === trimmed && you.avatar === avatar) {
      submitted.current = false;
      setStore(wizard ? { step: 2 } : { editing: false });
    }
    setBusy(false);
  }, [view]);

  // Back to where the way to play is chosen: the game that was made for it is given up. Only while nobody else is in it (somebody
  // who has come in through the QR code would be thrown out of a game that is theirs too).
  // (`pending` counts the phones that have not picked a profile yet, and a host who has not is one of them)
  const alone = view.players.every((p) => p.id === you.id) && view.pending - (you.ready ? 0 : 1) <= 0;
  const backToMode = () => {
    actions.leave();
    setStore({ modeStep: true });
  };

  const submit = (e) => {
    e.preventDefault();
    if (!ready) return;
    if (wizard && you.ready && you.name === trimmed && you.avatar === avatar) return setStore({ step: 2 }); // nothing to tell the game
    submitted.current = true;
    // (a host who has no profile yet loses this screen the moment the game accepts one, so the next step is set now; the
    // screen stays until then, and a rejection - a toast - leaves it where it is)
    if (wizard && !you.ready) setStore({ step: 2 });
    setBusy(true);
    setTimeout(() => setBusy(false), 2500); // a rejection does not change the view, so never stay locked
    actions.profile(trimmed, avatar, undefined, late ? points : 0);
  };
  const edit = (fn) => (value) => {
    setBusy(false);
    fn(value);
  };

  return html`<main class=${wizard ? 'screen setup' : 'screen'}>
    ${wizard && html`<${SetupHeader} /><${Steps} current=${2} onBack=${alone ? backToMode : undefined} />`}
    <form class="stack stack--loose grow" onSubmit=${submit}>
      <header class="stack stack--tight">
        ${!wizard && html`<p class="eyebrow">${late ? `Spill ${view.code} har startet` : `Spill ${view.code}`}</p>`}
        <h1 class="rise-in">${late ? 'Hopp inn i spillet' : 'Hvem er du?'}</h1>
      </header>

      ${gone.length > 0 &&
      html`<div class="field">
        <span class="field__label" id="seat-label">Var du med før?</span>
        <div class="player-grid" role="group" aria-labelledby="seat-label">
          ${gone.map(
            (p) => html`<button type="button" class="player picker__item" style="width:5.6rem;aspect-ratio:auto;border-radius:0" key=${p.id} onClick=${() => actions.claim(view.code, p.id)}>
              <${Avatar} id=${p.avatar} size="md" offline />
              <span class="player__name">${p.name}</span>
            </button>`,
          )}
        </div>
        <span class="field__hint">Trykk på deg selv for å få plassen og poengene dine tilbake.</span>
      </div>`}

      <div class="field">
        <label class="field__label" for="name">Navn</label>
        <input
          id="name"
          class="input"
          value=${name}
          onInput=${edit((e) => setName(e.currentTarget.value))}
          maxlength=${NAME_MAX}
          autocomplete="off"
          autocapitalize="words"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="done"
          placeholder="Skriv navnet ditt"
        />
        <span class="field__hint">Det er dette de andre ser.</span>
      </div>

      <div class="field">
        <span class="field__label" id="avatar-label">Velg avatar</span>
        <div class="picker" role="radiogroup" aria-labelledby="avatar-label">
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

      ${late &&
      html`<div class="field">
        <span class="field__label" id="points-label">Poeng du hopper inn med</span>
        <div class="stepper" role="group" aria-labelledby="points-label">
          <${Button} type="button" variant="cream" size="icon" onClick=${() => setPoints(Math.max(0, points - 1))} aria-label="Ett poeng mindre" disabled=${points <= 0}>−</${Button}>
          <output class="input input--number" aria-live="polite">${points}</output>
          <${Button} type="button" variant="cream" size="icon" onClick=${() => setPoints(Math.min(highest, points + 1))} aria-label="Ett poeng mer" disabled=${points >= highest}>+</${Button}>
        </div>
        <span class="field__hint">0 er vanlig. Spillet er til ${view.target} poeng, så du kan hoppe inn med fra 0 til ${highest}. Du spiller fra neste runde.</span>
      </div>`}

      <div class="dock">
        <${Button} block type="submit" disabled=${!ready}>${wizard ? 'Neste' : late ? 'Hopp inn' : you.ready ? 'Lagre' : 'Klar!'}</${Button}>
        ${editing && html`<${Button} block variant="ghost" onClick=${() => setStore({ editing: false })}>Avbryt</${Button}>`}
      </div>
    </form>
  </main>`;
}

