// The question bank is data, but data that can quietly go wrong: a missing option, two questions with the same text,
// or a right answer that is always "C". These checks run on every change to shared/questions.js.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LETTERS, QUESTIONS } from '../shared/questions.js';

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
