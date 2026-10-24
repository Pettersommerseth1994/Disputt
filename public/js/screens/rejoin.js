// On the start screen: «Du var med i spillet ABCD» and a way back into it, for a guest whose page was closed (lastgame.js). The same player comes
// back, with the points. (A file of its own: pages are cached for ten minutes, and this one only uses what already was in the other files.)

import { html, useState } from '../vendor/htm-preact.js';
import { actions } from '../net.js';
import { t } from '../i18n/lang.js';
import { isP2P } from '../settings.js';
import { setStore, saveSession, useStore } from '../store.js';
import { Button } from '../ui.js';
import { forgetLastGame, lastGame } from '../lastgame.js';

export function RejoinCard() {
  const s = useStore();
  const [gone, setGone] = useState(false);
  const last = lastGame();
  if (!isP2P || gone || !last || s.session || s.view || s.joining || s.seats || s.creating) return null;
  const back = () => {
    const session = { code: last.code, playerId: last.playerId, token: last.token };
    saveSession(session);
    setStore({ session, notice: null });
    actions.join(last.code); // (the same link as for a new guest: it asks for the seat with the token, and the host answers with the game)
  };
  const no = () => {
    forgetLastGame();
    setGone(true);
  };
  return html`<div class="card card--yellow rejoin rise-in" role="status">
    <p><strong>${last.name ? t('Du var med i spillet {code} som {name}.', { code: last.code, name: last.name }) : t('Du var med i spillet {code}.', { code: last.code })}</strong></p>
    <div class="row row--center">
      <${Button} size="small" variant="lime" onClick=${back}>${t('Hopp inn igjen')}</${Button}>
      <${Button} variant="text" onClick=${no}>${t('Nei takk')}</${Button}>
    </div>
  </div>`;
}
