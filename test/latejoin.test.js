// Coming into a game that has started: the screens (the rules of the engine are in test/game.test.js).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('a newcomer in a game that has started', () => {
  it('first picks a profile (with the points to come in with), and then waits for the next round', () => {
    const app = read('public/js/app.js');
    assert.match(app, /view\.phase !== 'lobby' && !view\.you\.ready\) return html`<\$\{Profile\} view=\$\{view\} late \/>`/);
    assert.match(app, /view\.you\.inRound === false\) return html`<\$\{LateWait\}/);
    const profile = read('public/js/screens/profile.js');
    assert.match(profile, /Poeng du hopper inn med/);
    assert.match(profile, /useState\(0\)/, '0 is the default');
    assert.match(profile, /Math\.max\(0, view\.target - 1\)/, 'and the most is one under the target');
    assert.match(profile, /actions\.profile\(trimmed, avatar, undefined, late \? points : 0\)/);
  });

  it('can still take their own old seat back, with the points, from the same screen', () => {
    const profile = read('public/js/screens/profile.js');
    assert.match(profile, /Var du med før\?/);
    assert.match(profile, /actions\.claim\(view\.code, p\.id\)/);
  });

  it('is not told that the game has started and takes no newcomers: that message is gone from the start screen\'s way in', () => {
    assert.doesNotMatch(read('shared/game.js'), /new GameError\('started'/);
  });

  it('sends the points with the profile, and the others are told who came in', () => {
    assert.match(read('public/js/net.js'), /profile: \(name, avatar, id, points\)/);
    assert.match(read('shared/hub.js'), /ble med i spillet/);
  });
});
