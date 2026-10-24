// The language card comes up three seconds after the first visit (public/js/i18n/chooser.js). A test browser has never been there before, and
// the card would lie over the screens it is looking at: so every page of the tools starts with a language already chosen.
// DISPUTT_LANG=da (or sv) runs a tool in that language instead of Norwegian (the tools that look for Norwegian words will not find them: fit.mjs and overlap.mjs measure).

export const LANG = process.env.DISPUTT_LANG ?? 'no';

/** Makes the page start with the language chosen. Call it right after `newPage()`, before the first `goto`. */
export const quiet = (page, lang = LANG) =>
  page.evaluateOnNewDocument((l) => {
    try {
      localStorage.setItem('disputt:sprak', l);
    } catch {
      /* a page without storage */
    }
  }, lang);
