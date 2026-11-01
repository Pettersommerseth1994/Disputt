// How long to play: two cards (screens/lengthcards.js, css/length-cards.css) in the host's set-up and in the host's options, instead of a number to type.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { DEFAULT_TARGET, Room } from '../shared/game.js';
import DA from '../public/js/i18n/da.js';
import SV from '../public/js/i18n/sv.js';
import { LENGTHS, lengthOf } from '../public/js/screens/lengths.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('two lengths: first to 8 points (about an hour) and first to 12 (about two hours), and a new game starts at 8', () => {
  assert.deepEqual(LENGTHS.map((l) => [l.title, l.target, l.time]), [['Småkrangel', 8, 'ca. 1 time'], ['Storkrangel', 12, 'ca. 2 timer']]);
  assert.equal(DEFAULT_TARGET, 8);
  assert.equal(new Room({ code: 'TEST' }).target, 8);
  assert.equal(lengthOf(12).id, 'stor');
  assert.equal(lengthOf(5), undefined, 'a target the host cannot pick has no card (the engine counts to any number from 1 to 99)');
});

test('the step and the host\'s options use the cards, and there is no number to type any more', () => {
  const setup = read('public/js/screens/setup.js');
  assert.match(setup, /<\$\{LengthCards\} view=\$\{view\} \/>/);
  assert.doesNotMatch(setup, /id="target"|actions\.target|useTarget/, 'no field for the points in the step');
  const sheets = read('public/js/screens/sheets.js');
  assert.match(sheets, /<\$\{LengthCards\} view=\$\{view\} sheet \/>/);
  assert.doesNotMatch(sheets, /actions\.target|class="stepper"/, 'and none in the host\'s options');
  assert.match(read('public/js/screens/lengthcards.js'), /onClick=\$\{\(\) => actions\.target\(l\.target\)\}/, 'a tap sends the target at once');
});

test('the card says «Første til 8 poeng» and «ca. 1 time», and nothing about a pause or about minutes a point', () => {
  const src = read('public/js/screens/lengthcards.js');
  assert.match(src, /t\('Første til \{n\} poeng', \{ n: l\.target \}\)/);
  assert.doesNotMatch(src, /[Pp]ause/);
  assert.doesNotMatch(read('public/js/screens/setup.js') + read('public/js/screens/sheets.js'), /minutter|6 minutter/);
  const lobby = read('public/js/screens/lobby.js');
  assert.match(lobby, /t\('Første til \{n\} poeng', \{ n: view\.target \}\)/, 'the lobby says it too');
  assert.doesNotMatch(lobby, /MINUTES_PER_POINT/);
});

test('the words never wrap: they are as wide as the card allows, and get smaller on a narrow phone', () => {
  const css = read('public/css/length-cards.css');
  assert.match(css, /\.gl-row \{[^}]*white-space: nowrap/);
  assert.match(css, /\.mc-title\.gl-title \{[^}]*white-space: nowrap/);
  assert.match(css, /\.mc-body\.gl-body \{ container-type: inline-size; \}/);
  assert.match(css, /@supports \(width: 1cqw\)[\s\S]*font-size: min\(0\.9rem, [\d.]+cqw\)/);
  // the longest row, in em (measured in the page's own font): «Første til 12 poeng» is 8.69, and a star, a gap and the text must fit the width: 100 / (1.3 + 0.38 + 8.69) = 9.6
  const rows = Number(css.match(/\.gl-rows \{ font-size: min\(0\.9rem, ([\d.]+)cqw\)/)[1]);
  assert.ok(rows <= 100 / (1.3 + 0.38 + 8.69), `${rows} cqw is more than the longest row has room for`);
  // and the longest title, «Småskænderi», is 6.13 em
  const title = Number(css.match(/\.mc-title\.gl-title \{ font-size: min\(1\.4rem, ([\d.]+)cqw\)/)[1]);
  assert.ok(title <= 100 / 6.13, `${title} cqw is more than the longest title has room for`);
});

test('the texts are in Danish and Swedish, the pictures and the symbols are there and light', () => {
  for (const key of ['Småkrangel', 'Storkrangel', 'Første til {n} poeng', 'ca. 1 time', 'ca. 2 timer', 'Passer best for en vanlig spillkveld', 'Passer best for en helaften', 'Spillets lengde']) {
    assert.ok(DA[key] && SV[key], `«${key}» has a Danish and a Swedish text`);
  }
  for (const [file, max] of [['krangel-lite', 80], ['krangel-stor', 100], ['icon-star', 8], ['icon-clock', 8]]) {
    const path = `public/assets/art/${file}.webp`;
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), path);
    assert.ok(statSync(new URL(`../${path}`, import.meta.url)).size < max * 1024, `${path} is under ${max} KB`);
  }
});
