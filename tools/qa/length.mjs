// How long to play is two cards (first to 8 points, first to 12: screens/lengthcards.js). A test that wants a game of one or two rounds sends the target itself, the way
// a tap on a card does (the engine counts to any target from 1 to 99).
import assert from 'node:assert/strict';

/** Sends a target to the game from the host's phone (the same module the page runs: net.js, found from the page's own script). */
export async function setTarget(page, target) {
  await page.evaluate(
    (n) => import(new URL('./net.js', document.querySelector('script[type="module"]').src).href).then((m) => m.actions.target(n)),
    target,
  );
}

/** The step «Hvor lenge skal dere spille?» is on the screen: both cards are there with their words, the short one is chosen, and a tap picks the other. */
export async function checkLengthCards(page, bodyText, clickButton) {
  const chosen = () => page.$eval('.mc-card.is-chosen .mc-title', (e) => e.textContent.trim()).catch(() => null);
  assert.match(await bodyText(), /Småkrangel\s+Første til 8 poeng\s+ca\. 1 time\s+Passer best for en vanlig spillkveld[\s\S]*Storkrangel\s+Første til 12 poeng\s+ca\. 2 timer\s+Passer best for en helaften/);
  assert.doesNotMatch(await bodyText(), /[Pp]ause/, 'there is no pause');
  assert.equal(await chosen(), 'Småkrangel', 'first to 8 is chosen from the start');
  await clickButton('Storkrangel');
  await page.waitForFunction(() => document.querySelector('.mc-card.is-chosen .mc-title')?.textContent.trim() === 'Storkrangel', { timeout: 5000 });
  await clickButton('Småkrangel');
  await page.waitForFunction(() => document.querySelector('.mc-card.is-chosen .mc-title')?.textContent.trim() === 'Småkrangel', { timeout: 5000 });
  // the words never wrap: every row and every title is on one line
  const wrapped = await page.evaluate(() => [...document.querySelectorAll('.gl-row, .gl-title')].filter((el) => el.getClientRects().length > 1 || el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent));
  assert.deepEqual(wrapped, [], 'the words of the cards do not wrap');
}
