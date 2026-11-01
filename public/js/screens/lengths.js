// The two lengths of a game the host is offered: «Småkrangel» (first to 8 points, about an hour) and «Storkrangel» (first to 12, about two hours). Only data, so that
// the tests can read it (the cards themselves are screens/lengthcards.js). The engine counts to any target from 1 to 99; these are the two that have a card.

import { tx } from '../i18n/lang.js';

export const LENGTHS = [
  { id: 'lite', target: 8, tone: 'one', blob: 'blob-6', title: tx('Småkrangel'), time: tx('ca. 1 time'), hint: tx('Passer best for en vanlig spillkveld') },
  { id: 'stor', target: 12, tone: 'each', blob: 'blob-4', title: tx('Storkrangel'), time: tx('ca. 2 timer'), hint: tx('Passer best for en helaften') },
];

/** The card that goes with a target (a game may have a target of its own, from an older page: then there is none). */
export const lengthOf = (target) => LENGTHS.find((l) => l.target === target);
