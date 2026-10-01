// Entry screens: home, join-by-code, connecting, "game already started" seat picker.

import { html, useState } from '../vendor/htm-preact.js';
import { actions, forget } from '../net.js';
import { setStore, useStore } from '../store.js';
import { Avatar, Button, Logo } from '../ui.js';

export function Home() {
  const s = useStore();
  const [mode, setMode] = useState('home');
  if (mode === 'code') return html`<${JoinByCode} onBack=${() => setMode('home')} />`;

  return html`<main class="screen home">
    <${Decor} />
    <div class="home__hero grow">
      <div class="pop-in"><${Logo} /></div>
      <h1 class="home__tagline rise-in">Lur dem.<br />Eller avslør <span class="scribble">lureren.</span></h1>
      <p class="lead muted rise-in" style="animation-delay:.1s">Et sosialt spill for 3 eller flere. Alle spiller på sin egen telefon.</p>
      ${s.notice && html`<p class="card card--yellow home__notice rise-in" role="status">${s.notice}</p>`}
    </div>
    <div class="dock">
      <${Button} block onClick=${() => actions.create()} disabled=${s.conn !== 'open'}>Start et spill</${Button}>
      <${Button} block variant="ghost" onClick=${() => setMode('code')}>Jeg har en kode</${Button}>
      <div class="row row--center">
        <${Button} variant="text" onClick=${() => setStore({ sheet: 'rules' })}>Slik spiller du</${Button}>
      </div>
    </div>
  </main>`;
}

function Decor() {
  return html`<div aria-hidden="true">
    <${Avatar} id="lime" size="lg" alive class="decor decor--home-a" style="--tilt:-14deg" />
    <${Avatar} id="mandarin" size="lg" alive class="decor decor--home-b" style="--tilt:12deg;animation-delay:-1.3s" />
    <${Avatar} id="blabaer" size="md" alive class="decor decor--home-c" style="--tilt:-8deg;animation-delay:-2.1s" />
    <${Avatar} id="kirsebaer" size="md" alive class="decor decor--home-d" style="--tilt:10deg;animation-delay:-3.4s" />
  </div>`;
}

function JoinByCode({ onBack }) {
  const s = useStore();
  const [code, setCode] = useState('');
  const ok = code.length === 4;
  const submit = (e) => {
    e.preventDefault();
    if (ok) actions.join(code);
  };
  return html`<main class="screen">
    <form class="stack stack--loose grow" onSubmit=${submit} style="justify-content:center">
      <div class="stack stack--tight center">
        <h1>Skriv inn koden</h1>
        <p class="muted">Du finner den på skjermen til verten – eller skann QR-koden med kameraet.</p>
      </div>
      <div class="field">
        <label class="sr-only" for="code">Spillkode</label>
        <input
          id="code"
          class="input input--code"
          value=${code}
          onInput=${(e) => {
            const v = e.currentTarget.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
            e.currentTarget.value = v; // a re-render alone would not undo a rejected character
            setCode(v);
          }}
          maxlength="4"
          autocomplete="off"
          autocapitalize="characters"
          autocorrect="off"
          spellcheck="false"
          inputmode="text"
          enterkeyhint="go"
          placeholder="ABCD"
        />
      </div>
      <div class="stack">
        <${Button} block type="submit" disabled=${!ok || s.conn !== 'open' || s.joining}>Bli med</${Button}>
        <${Button} block variant="ghost" onClick=${onBack}>Tilbake</${Button}>
      </div>
    </form>
  </main>`;
}

/** Shown while a stored session is being resumed or a QR link is being joined. */
export function Connecting({ text = 'Kobler til …' }) {
  return html`<main class="screen">
    <div class="grow center stack stack--loose" style="justify-content:center;align-items:center">
      <${Avatar} id="sky" size="xl" alive />
      <h2>${text}</h2>
      <${Button} variant="text" onClick=${() => forget()}>Avbryt</${Button}>
    </div>
  </main>`;
}

/** The game has started without you: pick your old seat (if your phone lost it) or wait for the next game. */
export function SeatPicker() {
  const { seats } = useStore();
  const list = seats?.seats ?? [];
  return html`<main class="screen">
    <div class="stack stack--loose grow" style="justify-content:center">
      <div class="stack stack--tight center">
        <h1>Spillet har startet</h1>
        <p class="muted">${list.length ? 'Var du allerede med? Velg deg selv for å hoppe inn igjen.' : 'Du kan ikke bli med midt i en runde. Var du med før? Da kan det ta et halvt minutt før spillet ser at telefonen din er borte. Prøv igjen straks, eller be verten starte et nytt spill.'}</p>
      </div>
      ${list.length === 0 && html`<${Button} block variant="cream" onClick=${() => actions.join(seats.code)}>Sjekk på nytt</${Button}>`}
      ${list.length > 0 &&
      html`<div class="player-grid">
        ${list.map(
          (p) => html`<button class="player picker__item" style="width:5.6rem;aspect-ratio:auto;border-radius:0" key=${p.id} onClick=${() => actions.claim(seats.code, p.id)}>
            <${Avatar} id=${p.avatar} size="md" />
            <span class="player__name">${p.name}</span>
          </button>`,
        )}
      </div>`}
      <${Button} block variant="ghost" onClick=${() => forget()}>Til forsiden</${Button}>
    </div>
  </main>`;
}

