// Where the «Betal med Vipps» button is offered: in every language. Vipps MobilePay reaches the whole of the Nordic countries, and the docs of Vipps MobilePay say that
// any user can pay any Nordic merchant: Swedes with the Vipps app, Danes and Finns with the MobilePay app, in the currency of the shop (NOK for a Norwegian sales unit).
// (developer.vippsmobilepay.com/docs/knowledge-base/across-borders. The payment server asks for no phone number: the page of Vipps finds the app of the user.)
// The Danish texts say MobilePay where the Norwegian say Vipps, because that is the name of the app that a Dane has (i18n/da).
// ONE place to change it. (A file of its own: pages are cached for ten minutes ...)

import { getLang } from '../i18n/lang.js';

export const vippsIsOfferedIn = (lang = getLang()) => ['no', 'da', 'sv'].includes(lang);
