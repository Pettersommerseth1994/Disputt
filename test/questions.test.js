// The question bank is data, but data that can quietly go wrong: a missing option, two questions with the same text,
// or a right answer that is always "C". These checks run on every change to shared/questions.js.
import assert from 'node:assert/strict';
import { test as nodeTest } from 'node:test';
import { bankFor } from '../shared/banks.js';
import { LETTERS } from '../shared/questions.js';

// One bank for each language of the game (shared/banks.js): the same rules for all of them.
for (const lang of ['no', 'da', 'sv']) {
const QUESTIONS = bankFor(lang);
const test = (name, fn) => nodeTest(`${lang}: ${name}`, fn);

test('every question is complete', () => {
  assert.ok(QUESTIONS.length >= 50, `at least 50 questions (has ${QUESTIONS.length})`);
  for (const q of QUESTIONS) {
    assert.match(q.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `id "${q.id}" is kebab-case`);
    assert.equal(typeof q.text, 'string');
    assert.ok(q.text.trim() === q.text && q.text.length >= 10 && q.text.length <= 64, `${q.id}: text length (${q.text.length}) keeps the question card short`);
    assert.ok(q.text.endsWith('?'), `${q.id}: a question ends with "?"`);
    assert.equal(q.options.length, LETTERS.length, `${q.id}: exactly four options`);
    for (const o of q.options) {
      assert.equal(typeof o, 'string');
      assert.ok(o.trim() === o && o.length >= 1 && o.length <= 24, `${q.id}: option "${o}" fits on a button`);
    }
    assert.equal(new Set(q.options).size, 4, `${q.id}: options are all different`);
    assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3, `${q.id}: correct is an index 0-3`);
  }
});

test('ids and texts are unique', () => {
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, QUESTIONS.length, 'duplicate id');
  assert.equal(new Set(QUESTIONS.map((q) => q.text)).size, QUESTIONS.length, 'duplicate text');
});

test('the right answer does not always sit in the same place', () => {
  const counts = [0, 0, 0, 0];
  for (const q of QUESTIONS) counts[q.correct]++;
  for (const [i, n] of counts.entries()) {
    const share = n / QUESTIONS.length;
    assert.ok(share >= 0.15 && share <= 0.35, `${LETTERS[i]} is right ${(share * 100).toFixed(0)}% of the time (${counts.join('/')}) – mix them up`);
  }
});

test('the question does not hand over the answer', () => {
  for (const q of QUESTIONS) {
    const right = q.options[q.correct];
    if (right.length < 4) continue; // "Ett", "2" … would match anywhere
    assert.ok(!q.text.toLowerCase().includes(right.toLowerCase()), `${q.id}: the question contains its own answer "${right}"`);
  }
});

// The box «Visste du det?» that backs the right answer up (shared/why-*.js): one or two short sentences and a source.
// These questions have none on purpose: the answer or the wording is too uncertain to back up with a source (the list is in README.md).
const NO_WHY = new Set(['ekvator-land', 'by-flest-hamburg', 'by-flest-toronto', 'film-mest-penger', ...(lang === 'no' ? ['vinmonopolet-liter'] : [])]);

test('every question has an explanation of one or two short sentences, with a source', () => {
  for (const q of QUESTIONS) {
    if (NO_WHY.has(q.id)) {
      assert.equal(q.why, undefined, `${q.id}: has an explanation, so take it off the list of exceptions`);
      continue;
    }
    assert.equal(typeof q.why, 'string', `${q.id}: has no explanation`);
    assert.ok(q.why.length >= 30 && q.why.length <= 260, `${q.id}: explanation length (${q.why.length}) keeps the box short`);
    const sentences = q.why.split(/(?<=[a-zæøåäö0-9)»"]{2}[.!?])\s+(?=[A-ZÆØÅÄÖ«"])/); // (not at an initial such as "D. Roosevelt")
    assert.ok(sentences.length <= 2, `${q.id}: at most two sentences (has ${sentences.length})`);
    assert.ok(typeof q.source === 'string' && q.source.length >= 4, `${q.id}: names its source`);
  }
});

test('the first question is the same in every language (the QA fixtures and the tests start from it)', () => {
  assert.equal(QUESTIONS[0].id, 'turister');
});
}

nodeTest('the three banks are about as big as each other', () => {
  const sizes = ['no', 'da', 'sv'].map((l) => bankFor(l).length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 5, `sizes ${sizes.join('/')}`);
});
