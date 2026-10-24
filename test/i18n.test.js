// Every text written with t('…') / tx('…') in the page's code has a Danish and a Swedish translation, with the same {values} in it.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import DA from '../public/js/i18n/da.js';
import SV from '../public/js/i18n/sv.js';
import { LANGUAGE_CODES, setLang, t, tServer } from '../public/js/i18n/lang.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === 'vendor' || name === 'i18n') continue;
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith('.js')) out.push(path);
  }
  return out;
}

/** Reads the string literal that starts at `i` (a quote) and returns [value, index after it], or null for a template with ${…}. */
function literal(src, i) {
  const quote = src[i];
  let j = i + 1;
  while (j < src.length && src[j] !== quote) {
    if (src[j] === '\\') j++;
    if (quote === '`' && src[j] === '$' && src[j + 1] === '{') return null;
    j++;
  }
  // eslint-disable-next-line no-new-func
  return [new Function(`return ${src.slice(i, j + 1)}`)(), j + 1];
}

/** Every key of every t('…') and tx('…') in the files of the page, with where it is. */
function usedKeys() {
  const found = new Map(); // key -> 'file:line'
  const bad = [];
  for (const file of [...walk(join(ROOT, 'public/js')), join(ROOT, 'shared/avatars.mjs')]) {
    const src = readFileSync(file, 'utf8');
    const re = /(?<![\w$.])(t|tx)\(\s*(?=['"`])/g;
    for (let m = re.exec(src); m; m = re.exec(src)) {
      const at = m.index + m[0].length;
      const line = src.slice(0, m.index).split('\n').length;
      const got = literal(src, at);
      const where = `${file.slice(ROOT.length)}:${line}`;
      if (!got) {
        bad.push(`${where}: a template with \${…} in t(): use {name} and give the values as the second argument`);
        continue;
      }
      const after = src.slice(got[1]).match(/^\s*(\+|,|\))/);
      if (!after || after[1] === '+') bad.push(`${where}: t() takes one string, not pieces put together with +`);
      if (!found.has(got[0])) found.set(got[0], where);
    }
  }
  return { found, bad };
}

const names = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('every text in t() is a plain string', () => {
  assert.deepEqual(usedKeys().bad, []);
});

for (const [code, dict] of [['da', DA], ['sv', SV]]) {
  test(`${code}: every text in the code has a translation, with the same values`, () => {
    const { found } = usedKeys();
    const missing = [...found].filter(([key]) => !Object.hasOwn(dict, key)).map(([key, where]) => `${where}  «${key}»`);
    assert.deepEqual(missing, [], `${missing.length} texts without a ${code} translation`);
    const wrong = Object.entries(dict)
      .filter(([key, value]) => names(key) !== names(value))
      .map(([key, value]) => `«${key}» → «${value}»`);
    assert.deepEqual(wrong, [], 'the {values} of the translation are not those of the text');
    const empty = Object.entries(dict).filter(([, value]) => typeof value !== 'string' || !value.trim());
    assert.deepEqual(empty, []);
  });
}

test('the two dictionaries have the same texts', () => {
  assert.deepEqual(Object.keys(DA).filter((k) => !Object.hasOwn(SV, k)), [], 'in da, not in sv');
  assert.deepEqual(Object.keys(SV).filter((k) => !Object.hasOwn(DA, k)), [], 'in sv, not in da');
});

test('t() fills in values, falls back to Norwegian and follows the language', () => {
  const key = Object.keys(DA).find((k) => /\{\w+\}/.test(k));
  setLang('no');
  assert.equal(t('Noe som ikke finnes {x}', { x: 3 }), 'Noe som ikke finnes 3');
  for (const code of key ? LANGUAGE_CODES : []) {
    setLang(code);
    const vars = Object.fromEntries([...key.matchAll(/\{(\w+)\}/g)].map((m) => [m[1], 'ABC']));
    const text = t(key, vars);
    assert.ok(text.includes('ABC') && !/\{\w+\}/.test(text), `${code}: ${text}`);
  }
  setLang('no');
});

test('tServer() translates the messages of the engine, also when they hold a value', () => {
  setLang('da');
  assert.equal(tServer('En melding som ikke finnes'), 'En melding som ikke finnes');
  const key = Object.keys(DA).find((k) => k.includes('{n}') && k.startsWith('Dere kan være'));
  if (key) assert.ok(!tServer('Dere kan være 5 spillere.').startsWith('Dere kan være'));
  setLang('no');
});

// ---- what the engine says and the names of the avatars are shown through the dictionaries too (tServer / t(avatar.name))
import { AVATARS } from '../shared/avatars.mjs';

const normalize = (s) => s.replace(/\{\w+\}|\$\{[^}]*\}/g, '{}');

/** The messages the engine can send: GameError('code', '…') and notices of the hub, as keys with {} where a value varies. */
function engineMessages() {
  const out = new Set();
  for (const file of ['shared/game.js', 'shared/hub.js']) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    for (const m of src.matchAll(/GameError\(\s*'[\w]+',\s*(['`])((?:\\.|(?!\1)[^\\])*)\1/g)) out.add(normalize(m[2].replace(/\\'/g, "'")));
    for (const m of src.matchAll(/text: `((?:[^`$]|\$\{[^}]*\})*)`/g)) out.add(normalize(m[1]));
  }
  const welcome = readFileSync(join(ROOT, 'shared/hub.js'), 'utf8').match(/const text = `\$\{p\.name\} ble med i spillet/);
  if (welcome) {
    out.add('{} ble med i spillet med {} poeng. {} spiller fra neste runde.');
    out.add('{} ble med i spillet. {} spiller fra neste runde.');
  }
  return [...out].filter((m) => !m.includes('${') && m.trim());
}

for (const [code, dict] of [['da', DA], ['sv', SV]]) {
  test(`${code}: every message of the engine and every avatar has a translation`, () => {
    const keys = new Set(Object.keys(dict).map(normalize));
    const missing = engineMessages().filter((m) => !keys.has(m));
    assert.deepEqual(missing, [], 'engine messages without a translation');
    assert.ok(engineMessages().length > 30, 'the messages of the engine were found');
    assert.deepEqual(AVATARS.filter((a) => !Object.hasOwn(dict, a.name)).map((a) => a.name), [], 'avatar names without a translation');
  });
}
