// The car: who plays can be changed from the host's options in the middle of a game (the rules of the engine are in test/car.test.js).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('the players in the host\'s options of a game on one phone', () => {
  const sheets = read('public/js/screens/sheets.js');
  const players = read('public/js/screens/carplayers.js');

  it('are listed with their points, each with «Fjern» that takes two taps and says what it costs, and a button to put one in', () => {
    assert.match(sheets, /view\.mode === 'car' && html`<\$\{CarPlayers\} view=\$\{view\} onAdd=/);
    assert.match(players, /Hvem spiller/);
    assert.match(players, /Mister poengene\. Sikker\?/);
    assert.match(players, /actions\.kick\(player\.id\)/);
    assert.match(players, /\+ Legg til spiller/);
  });

  it('get the form as a sheet of its own beside the host\'s sheet (a sheet inside a sheet slides with the first one)', () => {
    assert.match(sheets, /\$\{adding && html`<\$\{AddPlayerSheet\} view=\$\{view\} onClose=/);
    assert.match(players, /export function AddPlayerSheet/);
  });

  it('ask for a name, an avatar and the points to come in with (0 is the default, the most is one under the target)', () => {
    assert.match(players, /Poeng hen kommer inn med/);
    assert.match(players, /useState\(0\)/);
    assert.match(players, /Math\.max\(0, view\.target - 1\)/);
    assert.match(players, /actions\.addPlayer\(clean, avatar, choosesPoints \? points : 0\)/);
    assert.match(read('public/js/net.js'), /addPlayer: \(name, avatar, points\)/);
  });

  it('cannot be taken below two: the buttons are gone, and it says why', () => {
    assert.match(players, /few = players\.length <= view\.limits\.min/);
    assert.match(players, /Dere må være minst/);
  });
});
