// How an amount of money is written. Every price is in Norwegian kroner (NOK). «kr» is read as Danish or Swedish kroner by a Dane or a Swede,
// so outside Norwegian the amount says NOK (with a non-breaking space, so that the number and the currency are never split over two lines).
// ONE place to change it: formatPrice (pay/plans.js), kr (pay/discount.js) and the dictionaries' «{n} kr rabatt» all follow this.
// (A file of its own: pages are cached for ten minutes ...)

import { getLang } from '../i18n/lang.js';

/** The label after the number: «kr» in Norwegian, «NOK» in Danish and Swedish. Asked when an amount is written, never when the file loads. */
export const currencyLabel = () => (getLang() === 'no' ? 'kr' : 'NOK');

/** «149 kr» / «149 NOK»: `amount` is the number as it is written («149», «199,20»). */
export const withCurrency = (amount) => `${amount}${getLang() === 'no' ? ' ' : ' '}${currencyLabel()}`;
