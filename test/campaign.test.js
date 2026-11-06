// A campaign code in the link (?rabatt=BLACK): taken out of the address, kept for a while, forgotten on request, and only the Black month family gets the sticker.
import assert from 'node:assert/strict';
import test from 'node:test';

const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

/** A fresh copy of campaign.js that starts on `href`, with a phone memory that already holds `stored`. */
async function start(href, stored) {
  const memory = new Map(stored ? [['disputt:rabatt', JSON.stringify(stored)]] : []);
  const replaced = [];
  define('location', { href });
  define('history', { state: null, replaceState: (_s, _t, url) => replaced.push(url) });
  define('localStorage', { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) });
  const mod = await import(`../public/js/pay/campaign.js?${Math.random()}`);
  return { mod, memory, replaced };
}

test('?rabatt=black is kept in capitals and taken out of the address (the rest of it stays)', async () => {
  const { mod, memory, replaced } = await start('https://disputt.site/?rabatt=black&sprak=da#x');
  assert.equal(mod.rememberedCode(), 'BLACK');
  assert.equal(JSON.parse(memory.get('disputt:rabatt')).code, 'BLACK');
  assert.deepEqual(replaced, ['/?sprak=da#x']);
});

test('what is not a code is cleaned away, and nothing is kept for an empty one', async () => {
  const { mod, memory } = await start('https://disputt.site/?rabatt=%20bl%40ck-%C3%A6%201%3Cscript%3E');
  assert.equal(mod.rememberedCode(), 'BLCK-1SCRIPT');
  const empty = await start('https://disputt.site/?rabatt=%20%20');
  assert.equal(empty.mod.rememberedCode(), null);
  assert.equal(empty.memory.size, 0);
  assert.ok(memory.size === 1);
});

test('without ?rabatt= the address is left alone, and a code kept earlier is still there until it is too old', async () => {
  const fresh = await start('https://disputt.site/', { code: 'BLACK', at: Date.now() - 3 * 86_400_000 });
  assert.deepEqual(fresh.replaced, []);
  assert.equal(fresh.mod.rememberedCode(), 'BLACK');
  const old = await start('https://disputt.site/', { code: 'BLACK', at: Date.now() - 20 * 86_400_000 });
  assert.equal(old.mod.rememberedCode(), null, 'a code from three weeks ago is not used');
});

test('forgetCode() removes it from the memory and from the page', async () => {
  const { mod, memory } = await start('https://disputt.site/?rabatt=BLACK');
  mod.forgetCode();
  assert.equal(mod.rememberedCode(), null);
  assert.equal(memory.has('disputt:rabatt'), false);
});

test('a phone that keeps nothing still has the code for this visit', async () => {
  define('location', { href: 'https://disputt.site/?rabatt=BLACK' });
  define('history', { state: null, replaceState() {} });
  define('localStorage', { getItem() { throw new Error('private'); }, setItem() { throw new Error('private'); }, removeItem() { throw new Error('private'); } });
  const mod = await import(`../public/js/pay/campaign.js?${Math.random()}`);
  assert.equal(mod.rememberedCode(), 'BLACK');
});

test('only the Black month family is shown as a campaign', async () => {
  const { mod } = await start('https://disputt.site/');
  assert.equal(mod.isBlackCode('BLACK'), true);
  assert.equal(mod.isBlackCode('black50'), true);
  assert.equal(mod.isBlackCode('VENN20'), false);
  assert.equal(mod.isBlackCode(null), false);
});
