// The animated rules have their own style sheet (css/regler.css), and the module that draws them makes sure the sheet is there.
// (Pages are cached for ten minutes: a new script next to an old index.html would otherwise draw the rules with no styles at all.)

import { useEffect, useState } from '../vendor/htm-preact.js';
import { asset } from '../paths.js';

const HREF = asset('css/regler.css');
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

/** Is it in already? (Normally it is: index.html may have the link, and a script does not run before the sheets in the head are in. Then the rules are there from the first picture.) */
const isIn = () => [...document.styleSheets].some((sheet) => sheet.href === HREF);

/** True when the style sheet is in. Nothing is drawn before that: pictures without their styles would only be loose images. */
export function useReglerStyles() {
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
