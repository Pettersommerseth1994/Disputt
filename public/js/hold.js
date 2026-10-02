// Press and hold: how the game keeps a role secret. The role is only on the screen while a finger is on the button, and it
// is gone the moment the finger lifts, slides off, or the page goes to the background.
// (A file of its own: pages are cached for ten minutes, and a module that imports something an older cached copy of another
// module does not have would not load. New logic goes in new files.)

import { useEffect, useState } from './vendor/htm-preact.js';
import { store } from './store.js';

const isHoldKey = (e) => e.key === ' ' || e.key === 'Enter';

/**
 * `held` is true while the button is pressed; spread `bind` on the <button>.
 * QA only: setStore({ qaHold: true }) shows every hold button as held, so screenshots and layout checks can see the open
 * state without a finger on the screen.
 */
export function useHold() {
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (!pressed) return undefined;
    // a locked screen or a switch to another app must not leave a secret open
    const release = () => setPressed(false);
    document.addEventListener('visibilitychange', release);
    window.addEventListener('blur', release);
    return () => {
      document.removeEventListener('visibilitychange', release);
      window.removeEventListener('blur', release);
    };
  }, [pressed]);

  const bind = {
    onPointerDown: (e) => {
      e.preventDefault();
      setPressed(true);
    },
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    onPointerCancel: () => setPressed(false),
    onKeyDown: (e) => {
      if (!isHoldKey(e)) return;
      e.preventDefault();
      setPressed(true);
    },
    onKeyUp: (e) => isHoldKey(e) && setPressed(false),
    onBlur: () => setPressed(false),
    onContextMenu: (e) => e.preventDefault(),
  };
  return { held: pressed || Boolean(store.qaHold), bind };
}
