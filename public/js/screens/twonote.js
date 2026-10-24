// With exactly two players a round may have no impostor (one round in three), and the host is told while setting up.
// (A file of its own: pages are cached for ten minutes, and a module that imports something an older cached copy of another
// module does not have would not load.)

import { html } from '../vendor/htm-preact.js';
import { t } from '../i18n/lang.js';

export function TwoPlayersNote() {
  return html`<section class="note card card--yellow" role="note">
    <strong>${t('Dere er bare to')}</strong>
    <p>${t('Da er det ikke alltid en imposter, for ellers ville den ene alltid visst hvem det var. På 1/3 av spørsmålene er ingen impostere. Dette er tilfeldig.')}</p>
  </section>`;
}
