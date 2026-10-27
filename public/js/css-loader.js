// A screen that has a style sheet of its own loads it itself (pages are cached for ten minutes: a script and an index.html that are not equally new, from the
// cache, must still work). `useStylesheet(href)` is true when the sheet is in; the screen draws nothing until it is, so that it never shows unstyled.
// A sheet that cannot be fetched (a bad connection) is no reason to draw nothing: the screen is drawn without it, which is better than a blank one where a role
// or a way to play is to be chosen. `preloadStylesheets` asks for the sheets of the screens of a game when the page starts, so that they are there in time.

import { useEffect, useState } from './vendor/htm-preact.js';

const loading = new Map();

function load(href) {
  if (!loading.has(href)) {
    loading.set(
      href,
      new Promise((resolve) => {
        let link = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => l.href === href);
        if (link?.sheet) return resolve(true);
        if (!link) {
          link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = href;
          document.head.append(link);
        }
        link.addEventListener('load', () => resolve(true), { once: true });
        link.addEventListener('error', () => resolve(false), { once: true });
        return undefined;
      }),
    );
  }
  return loading.get(href);
}

const isIn = (href) => [...document.styleSheets].some((sheet) => sheet.href === href);

export function useStylesheet(href) {
  const [ready, setReady] = useState(() => isIn(href));
  useEffect(() => {
    if (ready) return undefined;
    let alive = true;
    load(href).then(() => alive && setReady(true)); // (also when it could not be fetched: see above)
    return () => {
      alive = false;
    };
  }, [href, ready]);
  return ready;
}

/** Asks for style sheets now (`hrefs` as the screens give them to useStylesheet), without waiting for them. */
export function preloadStylesheets(hrefs) {
  const go = () => hrefs.forEach((href) => load(href));
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 500);
}
