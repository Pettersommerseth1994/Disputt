// Where the «Betal med Vipps» button is offered: Vipps takes Norwegian kroner from Norwegian users, so only when the app is in Norwegian.
// (Vipps MobilePay reaches the other Nordic countries, but a Dane or a Swede paying a Norwegian shop in NOK is not confirmed: see docs/I18N.md.)
// ONE place to change it. (A file of its own: pages are cached for ten minutes ...)

import { getLang } from '../i18n/lang.js';

export const vippsIsOfferedIn = (lang = getLang()) => lang === 'no';
