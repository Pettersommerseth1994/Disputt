// The eyes on the start screen blink (screens.css). What this guards: it must stay cheap (a few KB of picture, and only a transform that
// moves), and it must give way to a phone that asks for less motion.
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../public/css/screens.css', import.meta.url), 'utf8');

// The green and the orange eye on the start screen (screens.css, `eye-blink`): the same rules.
for (const art of ['lime', 'mandarin']) {
  test(`the eye of the ${art} on the start screen blinks with a small picture of its own`, () => {
    const size = statSync(new URL(`../public/assets/art/${art}-lid.svg`, import.meta.url)).size;
    assert.ok(size < 12 * 1024, `${art}-lid.svg is ${size} bytes: it is fetched for nothing but a blink, so it stays a few KB`);
    assert.match(css, new RegExp(`url\\('\\.\\./assets/art/${art}-lid\\.svg'\\)`), 'the stylesheet uses it');
  });
}

test('the blink of the start screen moves only a transform, and rests for a phone that asks for less motion', () => {
  for (const name of ['eye-blink', 'eye-blink-twice']) {
    const frames = css.match(new RegExp(`@keyframes ${name} \\{[\\s\\S]*?\\n\\}`))?.[0];
    assert.ok(frames, `the keyframes ${name} are there`);
    assert.deepEqual([...new Set([...frames.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]))].sort(), ['animation-timing-function', 'transform']);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.decor--home-a::after,\s*\.decor--home-b::after \{ animation: none !important; \}/);
});
