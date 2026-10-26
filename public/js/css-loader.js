// A screen that has a style sheet of its own loads it itself (pages are cached for ten minutes: a script and an index.html that are not equally new, from the
// cache, must still work). `useStylesheet(href)` is true when the sheet is in; the screen draws nothing until it is, so that it never shows unstyled.

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
    load(href).then((ok) => alive && setReady(ok));
    return () => {
      alive = false;
    };
  }, [href, ready]);
  return ready;
}
