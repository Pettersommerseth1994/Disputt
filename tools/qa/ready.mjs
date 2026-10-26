// «Er du klar?», the second step of the host's set-up: Sofie's two rules, each answered with a tick, and then Neste comes alive.
// passReady(page) is called right after «Neste» on the way to play; it ticks both and goes on (the profile or, in the car, the players follows).
import assert from 'node:assert/strict';

/** Waits for the next unanswered reply (Sofie types for a moment first) and ticks it. */
async function tickNext(page) {
  await page.waitForSelector('.ready-reply', { visible: true, timeout: 8000 });
  await page.$eval('.ready-reply', (b) => b.click());
}

/** The step is on the screen: it can be left only when both are ticked. */
export async function passReady(page, { shot } = {}) {
  await page.waitForFunction(() => /Er du klar\?/.test(document.body.innerText), { timeout: 8000 });
  const neste = () => page.$eval('.dock .btn', (b) => b.disabled);
  assert.equal(await neste(), true, 'Neste waits for the two ticks');
  await tickNext(page);
  assert.equal(await neste(), true, 'one tick is not enough');
  await tickNext(page);
  await page.waitForFunction(() => document.querySelectorAll('.ready-sent').length === 2, { timeout: 5000 });
  assert.equal(await neste(), false, 'Neste is there when both are ticked');
  if (shot) await shot();
  await page.evaluate(() => [...document.querySelectorAll('.dock .btn')].find((b) => b.innerText.trim() === 'Neste').click());
}
