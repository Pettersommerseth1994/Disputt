// Name + avatar. Used when joining, and again when someone wants to change their profile in the lobby.

import { AVATARS } from '/shared/avatars.mjs';
import { html, useEffect, useState } from '../vendor/htm-preact.js';
import { actions } from '../net.js';
import { setStore } from '../store.js';
import { Avatar, Button } from '../ui.js';

const NAME_MAX = 14;

export function Profile({ view, editing }) {
  const you = view.you;
  const takenBy = new Map(view.players.filter((p) => p.id !== you.id).map((p) => [p.avatar, p.name]));
  const [name, setName] = useState(you.name ?? '');
  const [avatar, setAvatar] = useState(you.avatar ?? null);
  const [busy, setBusy] = useState(false);

  // someone else grabbed my avatar while I was choosing
  useEffect(() => {
    if (avatar && takenBy.has(avatar)) setAvatar(null);
  }, [view.players]);

  // the server answered (either way): allow another try
  useEffect(() => setBusy(false), [view]);

  const trimmed = name.trim();
  const ready = trimmed.length > 0 && avatar && !busy;
  const submit = (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    actions.profile(trimmed, avatar);
    if (editing) setStore({ editing: false });
  };

  return html`<main class="screen">
    <form class="stack stack--loose grow" onSubmit=${submit}>
      <header class="stack stack--tight">
        <p class="eyebrow">Spill ${view.code}</p>
        <h1 class="rise-in">Hvem er du?</h1>
      </header>

      <div class="field">
        <label class="field__label" for="name">Navn</label>
        <input
          id="name"
          class="input"
          value=${name}
          onInput=${(e) => setName(e.currentTarget.value)}
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
              onClick=${() => setAvatar(a.id)}
            >
              <${Avatar} id=${a.id} size="md" />
            </button>`;
          })}
        </div>
      </div>

      <div class="dock">
        <${Button} block type="submit" disabled=${!ready}>${editing ? 'Lagre' : 'Klar!'}</${Button}>
        ${editing && html`<${Button} block variant="ghost" onClick=${() => setStore({ editing: false })}>Avbryt</${Button}>`}
      </div>
    </form>
  </main>`;
}

