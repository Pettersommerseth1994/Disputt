// The animated rules (public/js/regler/): what the steps say, and the few things in the story's shell and style sheet that a picture will not catch.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { QUESTION, RIGHT, RIGHT_TEXT, slidesFor } from '../public/js/regler/content.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('the steps of the animated rules', () => {
  it('are eight, numbered, in the order of a round', () => {
    const steps = slidesFor();
    assert.deepEqual(steps.map((s) => `${s.n}. ${s.title}`), [
      '1. Alle får en rolle',
      '2. Imposteren får vite riktig svar',
      '3. Én får spørsmålet',
      '4. Diskuter!',
      '5. Lås svaret',
      '6. Imposteren avslører seg',
      '7. Poengene deles ut',
      '8. Deretter ny runde',
    ]);
  });

  it('use the question of the example, with London as the right answer', () => {
    assert.equal(QUESTION.text, 'Hva er hovedstaden i England?');
    assert.equal(RIGHT, 'B');
    assert.equal(RIGHT_TEXT, 'B: London');
  });

  it('say what to do, without the exclamation marks that were taken away, and that the group has to agree for itself', () => {
    const line = (id) => slidesFor().find((s) => s.id === id).line;
    assert.match(line('roles'), /men én er imposter\.$/);
    assert.match(line('talk'), /^Diskuter\. Imposteren/);
    assert.match(line('lock'), /Dere må selv finne ut hvordan dere skal bli enige/);
    assert.match(slidesFor({ car: true }).find((s) => s.id === 'lock').line, /Dere må selv finne ut hvordan dere skal bli enige/);
  });

  it('say that the imposter gets to know the right answer, and that six or more are two imposters who know each other', () => {
    const secret = slidesFor().find((s) => s.id === 'secret');
    assert.match(secret.line, /B: London/);
    assert.match(secret.line, /seks eller flere/);
    assert.match(secret.line, /to imposterer/);
    assert.match(secret.line, /vet hvem den andre er/);
  });

  it('are told in the words of Bilturmodus when one phone goes round (and a car holds five: never two imposters)', () => {
    const car = slidesFor({ car: true });
    assert.match(car.find((s) => s.id === 'roles').line, /Send telefonen rundt/);
    assert.match(car.find((s) => s.id === 'ask').line, /Verten/);
    assert.match(car.find((s) => s.id === 'lock').line, /Verten krysser av/);
    assert.match(car.find((s) => s.id === 'again').line, /Telefonen sendes rundt igjen/);
    assert.doesNotMatch(car.find((s) => s.id === 'secret').line, /to imposterer/);
  });

  it('are three, numbered from 1, in the short version for the set-up', () => {
    const how = slidesFor({ car: true, how: true });
    assert.deepEqual(how.map((s) => [s.n, s.id]), [[1, 'roles'], [2, 'talk'], [3, 'reveal']]);
  });
});

describe('the story', () => {
  const story = read('public/js/regler/story.js');
  const css = read('public/css/regler.css');

  it('stops its clock for a finger held anywhere on it, also on the places that are tapped (the pause of a story)', () => {
    // (the places to tap lie over the card: a handler on the card itself never heard the finger)
    const root = story.slice(story.indexOf('<section'), story.indexOf('<div class="rgS__bars"'));
    assert.match(root, /onPointerDown=/, 'the finger coming down is heard on the whole story');
    assert.match(root, /onPointerUp=/);
    assert.match(root, /onPointerCancel=/);
    assert.match(story, /rgS__zone--next[^\n]*\n?[^\n]*tap\(|onClick=\$\{tap\(/, 'a tap on a side is not a tap after a hold');
    assert.match(css, /\.rgS\.is-held \.rgS__bars \.is-on i \{[^}]*animation-play-state:\s*paused/, 'and the bar stops');
    assert.match(css, /\.rgS__card\.is-held \*[^{]*\{[^}]*animation-play-state:\s*paused/, 'and so does what moves on the card');
    assert.doesNotMatch(story + css, /Pauset|rgS__paused/, 'and nothing in the corner says that it is paused');
  });

  it('keeps the roles on the cards at the players the whole time (no card that is turned or hidden again)', () => {
    const table = read('public/js/regler/bord.js');
    assert.doesNotMatch(table, /glance/);
    assert.doesNotMatch(css, /\.rgE__card img \{[^}]*opacity:\s*0/);
  });

  it('lets the name of the step and its line come at once, to the left, not one word at a time', () => {
    assert.match(css, /\.rgS__top \{[^}]*animation:\s*rgFade/);
    assert.match(css, /\.rgS__head \{[^}]*text-align:\s*left/);
    assert.match(css, /\.rgS__intro \{[^}]*text-align:\s*left/);
    assert.doesNotMatch(read('public/js/regler/story-bord.js'), /Words/);
  });

  it('switches off its movement for people who ask for less', () => {
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  });
});
