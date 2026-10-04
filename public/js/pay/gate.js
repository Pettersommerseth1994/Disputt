// The paywall: after the free rounds the host has to have paid before the next round can start. Only the host's phone is asked;
// the others just wait at the points, as they always do between rounds.
// (A file of its own: pages are cached for ten minutes ...)

import { actions } from '../net.js';
import { setStore, store } from '../store.js';
import { needsPayment } from './pass.js';
import { whenReady } from './payments.js';

/** What "Neste runde" does on the host's points screen: start the round, or show the packages first. */
export async function requestNextRound(view) {
  await whenReady();
  if (needsPayment({ payments: store.payments, round: view.round, pass: store.pass })) setStore({ paywall: true });
  else actions.next();
}
