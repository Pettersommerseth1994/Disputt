// The modal behind the logo in the lobby: back to the start screen, which means leaving the game (and for the host of a
// peer-to-peer game, ending it for everybody: the host's page is the game).
// (A file of its own: pages are cached for ten minutes, and a new export in an old module would not be found by a new one.)

import { html } from '../vendor/htm-preact.js';
import { actions, forget } from '../net.js';
import { isP2P } from '../settings.js';
import { setStore } from '../store.js';
import { Button, Sheet } from '../ui.js';

const close = () => setStore({ sheet: null });

export function HomeSheet({ view }) {
  const isHost = view.you.isHost;
  const endsForAll = isHost && isP2P;
  const text = endsForAll
    ? 'Du er verten, så spillet avsluttes for alle som er med.'
    : isHost
      ? 'Du forlater spillet, og en annen spiller blir vert.'
      : 'Du forlater spillet. Du kan bli med igjen med koden så lenge spillet ikke har startet.';
  const leave = () => {
    close();
    if (endsForAll) forget(); // stops the page that runs the game, which tells everybody that it is over
    else actions.leave();
  };
  return html`<${Sheet} title="Tilbake til hjemskjermen?" onClose=${close}>
    <div class="stack">
      <p class="lead">${text}</p>
      <${Button} block variant="cream" onClick=${close}>Bli i spillet</${Button}>
      <${Button} block variant="pink" onClick=${leave}>${endsForAll ? 'Avslutt spillet' : 'Forlat spillet'}</${Button}>
    </div>
  </${Sheet}>`;
}
