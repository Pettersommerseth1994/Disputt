// «Lik tid på skjermen» (screens/equal.js): everybody who looks at a role holds the button the same time, and nothing of the role gives it away.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const equal = read('public/js/screens/equal.js');
const turn = read('public/js/screens/carturn.js');
const round = read('public/js/screens/round.js');
const car = read('public/js/screens/car.js');
const css = read('public/css/equal.css');

test('everybody holds 4 seconds, and a test can shorten it only from the outside', () => {
  assert.match(equal, /export const EQUAL_MS = 4000;/);
  assert.match(equal, /export const equalMs = \(\) => Number\(globalThis\.__DISPUTT_HOLD_MS\) \|\| EQUAL_MS;/, 'only a global that a test sets before the page loads changes it');
  assert.match(equal, /--eq-d:\$\{Math\.round\(equalMs\(\) \* 0\.3\)\}ms;--eq-r:\$\{Math\.round\(equalMs\(\) \* 0\.5\)\}ms/, 'a loyal text waits 1.2 s and rolls in over 2 s (of 4), and follows the time');
  assert.match(read('tools/qa/quiet.mjs'), /window\.__DISPUTT_HOLD_MS = 600;/, 'the QA tools hold 0.6 s');
});

test('the time is shown in a field above the card, never on the button', () => {
  assert.match(turn, /<\$\{TimeField\}[\s\S]*<div class="eq-now">[\s\S]*<\$\{Button\} block class=/, 'the field comes before the card, and the button after it');
  assert.doesNotMatch(turn.match(/<\$\{Button\} block[\s\S]*?<\/\$\{Button\}>/)[0], /left|hold\.ms|Math/, 'the button carries no countdown');
  assert.match(round, /<\$\{TimeField\} hold=\$\{hold\}[\s\S]*<div class="role__mid">/, 'the same on the role screen of a phone each');
  assert.match(css, /\.eq-field\.is-held \.eq-field__bar i \{ animation: eq-fill var\(--eq-t, 4s\) linear forwards; \}/, 'the bar is a CSS animation, so it runs smoothly');
  assert.match(css, /@keyframes eq-fill \{ to \{ transform: scaleX\(1\); \} \}/, 'and it only moves a transform');
});

test('a role counts as seen only after the whole time, and a loyal text rolls in while the imposter\'s is there at once', () => {
  assert.match(equal, /\(took >= total \? cb\.current\.onSeen : cb\.current\.onEarly\)/, 'too early does not count');
  assert.match(car, /onSeen=\$\{seenNow\(r\)\}/, 'the phone going round moves on only from onSeen');
  assert.doesNotMatch(car, /MIN_HOLD_MS/, 'and not from a short touch');
  assert.match(turn, /imp \? html`<strong class="eq-role__word">[\s\S]*<\$\{Roll\}><strong class="eq-role__word">\$\{t\('Lojal'\)\}/, 'the loyal word is rolled, the imposter\'s is not');
  assert.match(round, /\$\{impostor \? head : html`<\$\{Roll\} block>\$\{head\}<\/\$\{Roll\}>`\}/, 'on a phone each the loyal eye and word are rolled together');
  assert.match(round, /<p class="eq-card__lead">\$\{t\('Du er'\)\}<\/p>/, 'a small «Du er» above the big word');
  assert.match(css, /\.eq-roll \{ display: inline-block; animation: eq-roll var\(--eq-r, 2s\)[^;]*var\(--eq-d, 1\.2s\) both; \}/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.eq-roll \{ animation: none; \}/, 'and nothing rolls for a phone that asks for less motion');
});

test('the place of the role has the same size open and closed, so the button never moves', () => {
  assert.match(css, /\.eq-info \{[^}]*height: 8\.2rem;/);
  assert.match(turn, /impostors > 1 && 'eq-info--duo'/, 'taller when there are two impostors: for everybody');
});

test('the big number of the countdown has room round it, so that a slanted 3 is not cut off at the edge (iPhone)', () => {
  const screens = read('public/css/screens.css');
  const rule = screens.match(/\.countdown__n \{[^}]*\}/)[0];
  assert.match(rule, /display: inline-block;/);
  assert.match(rule, /padding: [^;]*0\.3em[^;]*;/, 'room on the right, where the letters and the shadow reach out');
  assert.match(rule, /margin: -[^;]*-0\.3em[^;]*;/, 'taken back with negative margins, so that nothing moves');
});

test('a style sheet that cannot be fetched does not leave a screen blank, and the sheets are asked for when the page starts', () => {
  const loader = read('public/js/css-loader.js');
  assert.match(loader, /load\(href\)\.then\(\(\) => alive && setReady\(true\)\)/, 'the screen is drawn also when the sheet failed');
  assert.match(read('public/js/screens/ready.js'), /loadStyles\(\)\.then\(\(\) => alive && setReady\(true\)\)/);
  assert.match(read('public/js/main.js'), /preloadStylesheets\(\[asset\('css\/mode-cards\.css'\), asset\('css\/ready\.css'\), asset\('css\/equal\.css'\)\]\)/);
});
