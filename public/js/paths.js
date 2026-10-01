// Where the site lives. The same files are served from "/" (Node server) and from "/Disputt/" (GitHub Pages),
// so nothing may hard-code an absolute path: everything is resolved against the site root found here.

/** URL of the site root, e.g. https://disputt.no/ or https://user.github.io/Disputt/ (this file is <root>/js/paths.js). */
export const ROOT = new URL('../', import.meta.url);

/** Absolute URL of a file relative to the site root, e.g. asset('assets/avatars/lime.svg'). */
export const asset = (path) => new URL(path, ROOT).href;

/** Puts the address bar back on the plain site address (drops ?j=CODE and legacy /j/CODE paths). */
export function goHome() {
  try {
    history.replaceState(null, '', ROOT.pathname);
  } catch {
    /* sandboxed frames etc. */
  }
}
