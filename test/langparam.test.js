// The landing page on playdisputt.com hands the visitor's language over in the address (?sprak=da): the game takes it, keeps it like a choice made
// in the game (so the language card does not ask again) and takes it out of the address.
import assert from 'node:assert/strict';
import test from 'node:test';

const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

/** A fresh copy of lang.js that starts on `href`, with a phone memory that already holds `stored`. */
async function start(href, stored, pageAttr) {
  const memory = new Map(stored ? [['disputt:sprak', stored]] : []);
  const replaced = [];
  define('location', { href });
  define('document', pageAttr ? { documentElement: { dataset: { sprak: pageAttr }, lang: 'nb' } } : undefined);
  define('history', { state: null, replaceState: (_s, _t, url) => replaced.push(url) });
  define('localStorage', { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) });
  const mod = await import(`../public/js/i18n/lang.js?${Math.random()}`);
  return { mod, memory, replaced };
}

test('?sprak=da sets Danish, keeps it, and is taken out of the address (the rest of it stays)', async () => {
  const { mod, memory, replaced } = await start('https://disputt.site/?sprak=da&kode=ABCD#spill');
  assert.equal(mod.getLang(), 'da');
  assert.equal(mod.chosenLang(), 'da');
  assert.equal(memory.get('disputt:sprak'), 'da');
  assert.deepEqual(replaced, ['/?kode=ABCD#spill']);
});

test('the language in the address wins over the one kept earlier', async () => {
  const { mod, memory } = await start('https://disputt.site/?sprak=sv', 'da');
  assert.equal(mod.getLang(), 'sv');
  assert.equal(memory.get('disputt:sprak'), 'sv');
});

test('a language we do not have is ignored (and still taken out of the address)', async () => {
  const { mod, memory, replaced } = await start('https://disputt.site/?sprak=fi', 'da');
  assert.equal(mod.getLang(), 'da');
  assert.equal(memory.get('disputt:sprak'), 'da');
  assert.deepEqual(replaced, ['/']);
});

test('without ?sprak= nothing changes: the kept language, or Norwegian with no choice', async () => {
  const kept = await start('https://disputt.site/', 'sv');
  assert.equal(kept.mod.getLang(), 'sv');
  assert.deepEqual(kept.replaced, []);
  const none = await start('https://disputt.site/');
  assert.equal(none.mod.getLang(), 'no');
  assert.equal(none.mod.chosenLang(), null);
});

test('a private window (the phone memory refuses) still gets the language for this visit', async () => {
  define('location', { href: 'https://disputt.site/?sprak=da' });
  define('history', { state: null, replaceState() {} });
  define('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
  const mod = await import(`../public/js/i18n/lang.js?${Math.random()}`);
  assert.equal(mod.getLang(), 'da');
});

test('a page that says its language (disputt.site/da/: <html data-sprak="da">) opens in it, and keeps it like a choice', async () => {
  const { mod, memory } = await start('https://disputt.site/da/', 'sv', 'da');
  assert.equal(mod.getLang(), 'da');
  assert.equal(memory.get('disputt:sprak'), 'da');
  assert.equal(mod.chosenLang(), 'da');
});

test('the address wins over the page, and a page with a language we do not have is ignored', async () => {
  assert.equal((await start('https://disputt.site/da/?sprak=sv', null, 'da')).mod.getLang(), 'sv');
  assert.equal((await start('https://disputt.site/x/', 'da', 'fi')).mod.getLang(), 'da');
});
