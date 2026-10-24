// The animated rules (public/js/regler/): what the steps say, and the few things in the story's shell and style sheet that a picture will not catch.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { IMPOSTOR, NEW_IMPOSTOR, QUESTION, RIGHT, RIGHT_TEXT, slidesFor } from '../public/js/regler/content.js';

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

  it('say in the last step that a new imposter is picked at random, and the table gives the red card to somebody else than Jonas', () => {
    for (const car of [false, true]) assert.match(slidesFor({ car }).find((s) => s.id === 'again').line, /Ny imposter velges tilfeldig/);
    assert.notEqual(NEW_IMPOSTOR, IMPOSTOR);
    assert.match(read('public/js/regler/bord.js'), /id === 'again' \? NEW_IMPOSTOR : IMPOSTOR/);
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
    assert.match(secret.line, /^Bare imposteren får vite riktig svar\. Er dere/, 'a full stop after «riktig svar»: the answer itself is on the note on the table');
    assert.doesNotMatch(secret.line, /London|\{svar\}/);
    assert.match(secret.line, /seks eller flere/);
    assert.match(secret.line, /to imposterer/);
    assert.match(secret.line, /vet hvem den andre er/);
  });

  it('put the two sentences of the points on two lines', () => {
    const line = slidesFor().find((s) => s.id === 'points').line;
    assert.match(line, /1 poeng\.\nFeil svar:/);
    assert.match(read('public/css/regler.css'), /\.rgS__intro \{[^}]*white-space: pre-line/);
  });

  it('are told in the words of Bilturmodus when one phone goes round (and a car holds five: never two imposters)', () => {
    const car = slidesFor({ car: true });
    assert.match(car.find((s) => s.id === 'roles').line, /Send telefonen rundt/);
    assert.match(car.find((s) => s.id === 'ask').line, /Verten/);
    assert.match(car.find((s) => s.id === 'lock').line, /Verten krysser av/);
    assert.match(car.find((s) => s.id === 'again').line, /Telefonen sendes rundt igjen/);
    assert.doesNotMatch(car.find((s) => s.id === 'secret').line, /to imposterer/);
  });
});

describe('the places where the rules are told', () => {
  it('have only the story: no written rules beside it and nothing to switch to', () => {
    const hub = read('public/js/regler/hub.js');
    const sheets = read('public/js/screens/sheets.js');
    assert.doesNotMatch(hub + sheets, /Les reglene|Se animasjon|RulesText|CAR_STEPS/);
    assert.doesNotMatch(read('public/css/regler.css'), /rg__switch|rg__text|rgS--how/);
  });

  it('end the set-up of Bilturmodus at the points, which starts the game (three steps, no «Klar? Slik funker det»)', () => {
    const car = read('public/js/screens/car.js');
    const setup = read('public/js/screens/setup.js');
    assert.doesNotMatch(car, /HowStep|Klar\? Slik funker det/);
    assert.match(read('public/js/screens/steps-count.js'), /export const CAR_SEGMENTS = 3;/);
    assert.match(setup, /Start spillet/, 'the last step of the car has that button');
    assert.match(car, /<\$\{Steps\} current=\$\{2\} total=\$\{CAR_SEGMENTS\}/, 'and the bar before it counts three');
  });
});

describe('the start screen', () => {
  it('has a link to the story of the rules, «Reglene, kort fortalt», whatever the payments say', () => {
    const home = read('public/js/screens/home.js');
    assert.match(home, /const RULES = tx\('Reglene, kort fortalt'\);/);
    assert.match(home, /class="home-tag" onClick=\$\{\(\) => setStore\(\{ sheet: 'rules' \}\)\}/, 'it opens the rules');
    assert.doesNotMatch(home, /forslag|useForslag/, 'and no preview chooser is left');
    const screens = read('public/css/screens.css');
    assert.match(screens, /\.home-tag \{[^}]*background:[^}]*var\(--pink\)/, 'a pink sticker');
    assert.match(screens, /\.home-tag__ic \{[^}]*width: 1\.5rem/, 'a low one, with a small play symbol');
    assert.match(screens, /\.home__hero \.lead \{[^}]*white-space: nowrap/, 'and the slogan under the logo stays on one line');
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

  it('has no button on the last card: it just stays', () => {
    assert.doesNotMatch(read('public/js/regler/story.js') + read('public/js/regler/hub.js') + read('public/js/regler/story-bord.js') + read('public/js/screens/sheets.js'), /La oss spille|onDone/);
    assert.doesNotMatch(css, /rgS__done/);
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
