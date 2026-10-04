// Name + avatar. Used when joining, and again when someone wants to change their profile in the lobby. For the host it is
// also the first step of the set-up (`wizard`).

import { AVATARS } from '../../shared/avatars.mjs';
import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { actions } from '../net.js';
import { setStore } from '../store.js';
import { Avatar, Button } from '../ui.js';
import { SetupHeader, Steps } from './setup.js';

const NAME_MAX = 14;

export function Profile({ view, editing, wizard = false }) {
  const you = view.you;
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
    actions.profile(trimmed, avatar);
  };
  const edit = (fn) => (value) => {
    setBusy(false);
    fn(value);
  };

  return html`<main class=${wizard ? 'screen setup' : 'screen'}>
    ${wizard && html`<${SetupHeader} /><${Steps} current=${1} />`}
    <form class="stack stack--loose grow" onSubmit=${submit}>
      <header class="stack stack--tight">
        ${!wizard && html`<p class="eyebrow">Spill ${view.code}</p>`}
        <h1 class="rise-in">Hvem er du?</h1>
      </header>

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

      <div class="dock">
        <${Button} block type="submit" disabled=${!ready}>${wizard ? 'Neste' : you.ready ? 'Lagre' : 'Klar!'}</${Button}>
        ${editing && html`<${Button} block variant="ghost" onClick=${() => setStore({ editing: false })}>Avbryt</${Button}>`}
      </div>
    </form>
  </main>`;
}

