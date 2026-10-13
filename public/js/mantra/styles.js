// The mantra has its own style sheet (css/mantra.css), and the module that draws it makes sure the sheet is there.
// (Pages are cached for ten minutes: a new script next to an old index.html would otherwise draw a strip with no styles at all.)

import { useEffect, useState } from '../vendor/htm-preact.js';
import { asset } from '../paths.js';

const HREF = asset('css/mantra.css');
let loading = null;

function load() {
  loading ??= new Promise((resolve) => {
    let link = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => l.href === HREF);
    if (link?.sheet) return resolve(true);
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = HREF;
      document.head.append(link);
    }
    link.addEventListener('load', () => resolve(true), { once: true });
    link.addEventListener('error', () => resolve(false), { once: true });
  });
  return loading;
}

/** Is it in already? (Normally it is: index.html has the link, and a script does not run before the sheets in the head are in. Then the strip is there from the first picture, and the screen does not jump when it arrives.) */
const isIn = () => [...document.styleSheets].some((sheet) => sheet.href === HREF);

/** True when the style sheet is in. Nothing is drawn before that: a strip without its styles would only be a loose button. */
export function useMantraStyles() {
  const [ready, setReady] = useState(isIn);
  useEffect(() => {
    if (ready) return undefined;
    let alive = true;
    load().then((ok) => alive && setReady(ok));
    return () => {
      alive = false;
    };
  }, [ready]);
  return ready;
}
