// The mantra: the strip at the top of every screen with «★ Vårt mantra», and the bubble it opens (public/js/mantra/mantra.js, css/mantra.css).
// What this guards: the strip must not cost a screen its height or lie over what has to be on top of it, it must not need an index.html
// that is as new as the script (pages are cached for ten minutes), and the words must keep to the rules for what players read.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { MANTRA } from '../public/js/mantra/mantra.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = read('public/css/mantra.css');
const components = read('public/css/components.css');
const base = read('public/css/base.css');
/** The declarations of the first rule that starts a line with exactly this selector (so `.mantra` is not `.mantra__bar`). */
const rule = (text, selector) => {
  const found = text.match(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\>]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm'));
  assert.ok(found, `a rule for ${selector}`);
  return found[1];
};
const zIndex = (declarations) => Number(declarations.match(/z-index:\s*(\d+)/)?.[1]);

describe('the words', () => {
  it('say who speaks, and what the game is and is not', () => {
    assert.equal(MANTRA.label, 'Vårt mantra');
    assert.equal(MANTRA.signature, 'Team Disputt');
    const said = MANTRA.lines.join(' ');
    assert.match(said, /mellom mennesker/, 'a game between people');
    assert.match(said, /støtteverktøy/, 'the phone is a tool for the quiz');
    assert.match(said, /så lite som mulig/, 'and is used as little as possible');
    for (const line of MANTRA.lines) assert.match(line, /[.!?]$/, `"${line}" is a sentence`);
  });

  it('have no unnecessary dashes: players read them', () => {
    for (const text of [MANTRA.label, MANTRA.signature, ...MANTRA.lines]) assert.doesNotMatch(text, /[–—]/, text);
  });
});

describe('the strip', () => {
  it('keeps its place at the top, and lies under the sheets, the banner and the toast', () => {
    const strip = rule(css, '.mantra');
    assert.match(strip, /position:\s*sticky/);
    assert.match(strip, /top:\s*0/);
    const own = zIndex(strip);
    assert.ok(own > 5, 'above the bar at the bottom of a screen, which scrolls under it too');
    for (const selector of ['.sheet-backdrop', '.banner', '.toast']) assert.ok(own < zIndex(rule(components, selector)), `under ${selector}`);
  });

  it('is solid, and has the texture of the page: the screen scrolls under it', () => {
    assert.match(rule(css, '.mantra__bar'), /background:\s*var\(--tex-grain\),\s*var\(--tex-dark\),\s*var\(--bg\)\s*;/);
  });

  it('keeps clear of the status bar of a phone that has the page under it', () => {
    assert.match(css, /--mantra-total:\s*calc\(var\(--mantra-h\)\s*\+\s*env\(safe-area-inset-top/);
    assert.match(rule(css, '.mantra__bar'), /height:\s*var\(--mantra-total\)/);
  });

  it('is room that the screens give up, so that a screen is still as tall as the phone', () => {
    const screen = css.match(/#app:has\(> \.mantra\) \.screen \{([^}]*)\}/)?.[1];
    assert.ok(screen, 'a rule for the screen that has the strip above it');
    assert.match(screen, /min-height:\s*calc\(100dvh - var\(--mantra-total\)\)/, 'as much shorter as the strip is tall');
    assert.match(screen, /min-height:\s*calc\(100vh - var\(--mantra-total\)\)/, 'and for a browser that does not know dvh');
    assert.match(base, /\.screen \{[^}]*padding: var\(--page-top\)/, 'the top margin it takes the place of');
  });

  it('is as tall as it says: a button that is a part of it never makes it taller', () => {
    assert.match(rule(css, '.mantra__pill'), /white-space:\s*nowrap/);
    const pill = Number(rule(css, '.mantra__pill').match(/height:\s*([\d.]+)rem/)?.[1]);
    const strip = Number(css.match(/--mantra-h:\s*([\d.]+)rem/)?.[1]);
    assert.ok(pill > 0 && pill < strip, 'the button fits in the strip');
  });
});

describe('the bubble', () => {
  const bubble = rule(css, '.mantra__bubble');

  it('is centred without a transform, which its animation would replace', () => {
    // (the same mistake once ran every toast off the right edge: see css.test.js)
    assert.doesNotMatch(bubble, /(?<!-)transform:/);
    assert.match(bubble, /left:\s*0\s*;/);
    assert.match(bubble, /right:\s*0\s*;/);
    assert.match(bubble, /margin:\s*[\d.]+rem auto 0\s*;/);
  });

  it('pops up with an animation that exists, and that ends where the bubble stays', () => {
    const name = bubble.match(/animation:\s*([\w-]+)/)?.[1];
    assert.equal(name, 'mantra-pop');
    const frames = css.match(/@keyframes mantra-pop \{[^\n]*\}/)?.[0];
    assert.ok(frames, 'the keyframes exist');
    assert.match(frames, /to \{ transform: none; opacity: 1; \}/);
  });

  it('is closed by a tap anywhere, which a button under the finger does not get', () => {
    assert.match(rule(css, '.mantra__catcher'), /position:\s*fixed;\s*inset:\s*0/);
    const source = read('public/js/mantra/mantra.js');
    assert.match(source, /class="mantra__catcher" onClick=\$\{close\}/);
    assert.match(source, /e\.key === 'Escape'/, 'Escape closes it too');
    assert.match(source, /useEffect\(\(\) => setOpen\(false\), \[screen\]\)/, 'and so does a new screen');
  });
});

describe('where it is drawn', () => {
  const app = read('public/js/app.js');

  it('sits above the screen in every app view, after the banners and before the screen', () => {
    const mantra = app.indexOf('<${Mantra} screen=${screenKey} />');
    assert.ok(mantra > 0, 'the app draws it');
    assert.ok(app.indexOf('class="banner"') < mantra, 'after the banners');
    assert.ok(mantra < app.indexOf('${screen}\n'), 'before the screen');
    assert.match(app, /const screenKey = \[[^\]]*view\?\.phase[^\]]*\]\.join/, 'it is told when a new screen comes up');
  });

  it('brings its style sheet along: a new script with an old index.html from the cache still has its styles', () => {
    assert.match(read('public/js/mantra/styles.js'), /asset\('css\/mantra\.css'\)/);
    assert.match(read('public/js/mantra/mantra.js'), /useMantraStyles\(\)/);
    assert.match(read('public/index.html'), /<link rel="stylesheet" href="css\/mantra\.css">/, 'and index.html has it too, so that the strip is there from the first picture');
  });

  it('is in the style guide as well', () => {
    const guide = read('public/design-system/index.html');
    assert.match(guide, /href="\.\.\/css\/mantra\.css"/);
    assert.match(guide, /class="mantra__bubble"/);
    assert.match(guide, new RegExp(MANTRA.signature), 'with the same signature');
  });
});
