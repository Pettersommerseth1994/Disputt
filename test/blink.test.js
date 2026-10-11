// The eyes of the two ways to play blink (screens.css, mode.js). What this guards: it must stay cheap (a few KB of picture, and only a transform that
// moves), and it must give way to a phone that asks for less motion.
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../public/css/screens.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../public/js/screens/mode.js', import.meta.url), 'utf8');

for (const art of ['bil', 'hytte']) {
  test(`the eye of the ${art} blinks with a small picture of its own`, () => {
    const size = statSync(new URL(`../public/assets/art/${art}-lid.svg`, import.meta.url)).size;
    assert.ok(size < 8 * 1024, `${art}-lid.svg is ${size} bytes: it is fetched for nothing but a blink, so it stays a few KB`);
    assert.match(css, new RegExp(`url\\('\\.\\./assets/art/${art}-lid\\.svg'\\)`), 'the stylesheet uses it');
  });
}

test('a blink moves only a transform', () => {
  const frames = css.match(/@keyframes mode-blink \{[\s\S]*?\n\}/)?.[0];
  assert.ok(frames, 'the keyframes are there');
  const properties = [...frames.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(properties)].sort(), ['animation-timing-function', 'transform']);
});

test('nothing blinks for a phone that asks for less motion', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^}]*\.mode__pic::before,[^}]*\.mode__pic::after \{ animation: none !important; \}/);
  assert.match(js, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\) return undefined/, 'and the timer that makes the cards blink by itself does not even start');
  assert.match(js, /document\.hidden/, 'and it rests while the page is hidden');
});
