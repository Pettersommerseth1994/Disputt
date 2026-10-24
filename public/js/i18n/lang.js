// The language of the app: Norwegian (the one it is written in), Danish or Swedish.
//
//   t('Opprett spill')                          the text in the language of the phone; the Norwegian text itself is the key
//   t('{name} ble med', { name })               {name} is filled in; one key for a whole sentence, never pieces put together
//   tx('Tekst')                                 only marks a text that is translated later, with t(), at the place where it is shown (constants)
//   tServer(message)                            a message from the engine (a Norwegian sentence), also when it holds {values} that vary
//
// Norwegian needs no dictionary. Danish and Swedish are the dictionaries in i18n/da/ and i18n/sv/ (docs/I18N.md); a text without a
// translation is shown in Norwegian. The language is kept on the phone (localStorage) and is set for the page (<html lang>). The language of a
// GAME (its question bank) is the language its host had when making it (shared/banks.js); every phone has its own language for what is on its screen.

import { useEffect, useState } from '../vendor/htm-preact.js';
import DA from './da.js';
import SV from './sv.js';

const KEY = 'disputt:sprak';

/** What we know about each language: its name in itself, the language code of the page and of number/date formats. */
export const LANGUAGES = {
  no: { code: 'no', name: 'Norsk', html: 'nb', locale: 'nb-NO' },
  da: { code: 'da', name: 'Dansk', html: 'da', locale: 'da-DK' },
  sv: { code: 'sv', name: 'Svenska', html: 'sv', locale: 'sv-SE' },
};
export const LANGUAGE_CODES = Object.keys(LANGUAGES);

const DICTIONARIES = { da: DA, sv: SV };

const isLang = (v) => typeof v === 'string' && Object.hasOwn(LANGUAGES, v);

/** What is kept on the phone: the language that was chosen, or null when nobody has chosen yet. */
export function chosenLang() {
  try {
    const v = localStorage.getItem(KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

/** <html lang>: for the phone's own help (hyphenation, screen readers, translation offers). The tests' make-believe pages have no <html>. */
function setPageLang(lang) {
  if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = LANGUAGES[lang].html;
}

let current = chosenLang() ?? 'no';
setPageLang(current);

export const getLang = () => current;
export const localeOf = (lang = current) => LANGUAGES[lang].locale;

const listeners = new Set();

/** Draws the component again when the language is changed (App uses it: everything under it is drawn again with it). */
export function useLang() {
  const [lang, set] = useState(current);
  useEffect(() => {
    const on = () => set(current);
    listeners.add(on);
    on(); // (it may have changed between the drawing and now)
    return () => listeners.delete(on);
  }, []);
  return lang;
}

/** Sets the language (and keeps it); every screen is drawn again. */
export function setLang(lang) {
  if (!isLang(lang)) return;
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* private window: the language is then asked for again next time */
  }
  setPageLang(lang);
  for (const on of listeners) on();
}

const fill = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (all, k) => (k in vars ? String(vars[k]) : all)) : text);

/** The text in the language of the phone. */
export function t(key, vars) {
  const dict = DICTIONARIES[current];
  return fill(dict ? dict[key] ?? key : key, vars);
}

/** Marks a text that is shown later (with t): the text itself comes back. */
export const tx = (key) => key;

// Messages from the engine hold values that vary («Dere kan være {n} spillere.»): the dictionary has the sentence with the {n}, and what stands in
// its place is found again here.
const templates = new Map(); // language -> [{ re, key, names }]
function templatesOf(lang) {
  if (!templates.has(lang)) {
    const list = [];
    for (const key of Object.keys(DICTIONARIES[lang] ?? {})) {
      if (!/\{\w+\}/.test(key)) continue;
      const names = [];
      const source = key
        .split(/(\{\w+\})/)
        .map((part) => {
          const m = /^\{(\w+)\}$/.exec(part);
          if (!m) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          names.push(m[1]);
          return '(.+?)';
        })
        .join('');
      list.push({ re: new RegExp(`^${source}$`, 's'), key, names });
    }
    templates.set(lang, list);
  }
  return templates.get(lang);
}

/** A message from the engine (always Norwegian) in the language of the phone. */
export function tServer(message) {
  if (typeof message !== 'string' || current === 'no') return message;
  const dict = DICTIONARIES[current] ?? {};
  if (Object.hasOwn(dict, message)) return dict[message];
  for (const { re, key, names } of templatesOf(current)) {
    const m = re.exec(message);
    if (m) return fill(dict[key], Object.fromEntries(names.map((n, i) => [n, m[i + 1]])));
  }
  return message;
}
