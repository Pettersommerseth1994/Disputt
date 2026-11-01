// «Mistet forbindelsen»: when a phone has been without a line to the game for a few seconds (it was in another app or tab, the Wi-Fi blinked, the phone
// slept), a card comes up in the middle of the screen with one big button, «Koble til igjen». The button is a shortcut for what a refresh would do: the line
// that is being set up is thrown away and a new one is made from nothing (net.js: reconnectNow({ force: true })), and if there is still no line a few seconds
// later the page is loaded again (the seat is remembered, so the same player comes back with the points; a host's game is brought back from the phone).
// (A file of its own with a style sheet of its own, css/reconnect.css, that it loads itself: pages are cached for ten minutes.)

import { html, useEffect, useRef, useState } from '../vendor/htm-preact.js';
import { t } from '../i18n/lang.js';
import { useStylesheet } from '../css-loader.js';
import { asset } from '../paths.js';
import { reconnectNow } from '../net.js';
import { useStore } from '../store.js';
import { Avatar, Button } from '../ui.js';
import { OFFER_AFTER_MS, RELOAD_AFTER_MS, lostLine } from './lostline.js';

export function ReconnectModal() {
  const s = useStore();
  const styled = useStylesheet(asset('css/reconnect.css'));
  const lost = lostLine(s);
  const [shown, setShown] = useState(false);
  const [trying, setTrying] = useState(false);
  const [waved, setWaved] = useState(false); // «Vent litt»: put away for this break in the line
  const reload = useRef(null);

  useEffect(() => {
    if (!lost) {
      setShown(false);
      setTrying(false);
      setWaved(false);
      clearTimeout(reload.current);
      return undefined;
    }
    const timer = setTimeout(() => setShown(true), OFFER_AFTER_MS);
    return () => clearTimeout(timer);
  }, [lost]);
  useEffect(() => () => clearTimeout(reload.current), []);

  if (!lost || !shown || waved || !styled) return null;
  const host = Boolean(s.view?.you?.isHost);
  const press = () => {
    setTrying(true);
    reconnectNow({ force: true });
    clearTimeout(reload.current);
    // (a host whose game is fine and who has only lost the line to the introduction service has nothing to load again: back to the button)
    const lineOnly = host && s.conn === 'open';
    reload.current = setTimeout(() => (lineOnly ? setTrying(false) : location.reload()), RELOAD_AFTER_MS);
  };
  return html`<div class="rc-back">
    <div class="rc-card" role="alertdialog" aria-modal="true" aria-labelledby="rc-title" aria-describedby="rc-text">
      <${Avatar} id="sky" size="md" alive class="rc-card__peek" style="--tilt:-10deg" />
      <h2 id="rc-title">${t('Mistet forbindelsen')}</h2>
      <p id="rc-text" class="rc-card__text" role="status">
        ${trying ? t('Kobler til igjen …') : host ? t('Spillet kjører på din telefon, og vennene dine venter. Trykk for å koble til igjen.') : t('Du ble koblet fra spillet. Trykk for å komme tilbake i det.')}
      </p>
      <${Button} block variant="lime" onClick=${press} disabled=${trying}>${trying ? t('Kobler til …') : t('Koble til igjen')}</${Button}>
      ${!trying && html`<${Button} variant="text" onClick=${() => setWaved(true)}>${t('Vent litt')}</${Button}>`}
    </div>
  </div>`;
}
