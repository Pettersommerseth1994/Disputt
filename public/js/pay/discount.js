// A discount code, seen from the page: the host types the code the owner made in Shopify, the payment server looks it up in the shop and says what
// the packages cost with it (POST /discount), and the page shows that. The code then goes with the payment: in the cart link to the shop's
// checkout (which counts it itself), and to Vipps through the payment server (which takes the price with it).
// (A file of its own: pages are cached for ten minutes, and this one only uses what already was in the other files.)

import { store } from '../store.js';
import { PayError } from './payments.js';

const PLAN_IDS = ['evening', 'weekend', 'year']; // (what is for sale)
const REQUIRED = ['evening', 'year']; // (the weekend is there when the shop has it)
const whole = (n) => Number.isInteger(n) && n >= 0;

/** Asks about a code. Resolves { code, summary, plans: { evening: { price, now, vipps }, … } } (prices in øre); rejects with a PayError whose message is for the host. */
export async function lookUpDiscount(text) {
  let res;
  try {
    res = await fetch(`${store.payments.apiUrl}/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify({ code: text }),
    });
  } catch {
    throw new PayError('network', 'Fikk ikke kontakt med betalingen. Sjekk nettet og prøv igjen.');
  }
  const data = await res.json().catch(() => ({}));
  // (what the server says to a code that is not good is for the host to read; any other trouble is told in one way)
  if (res.status === 400 || res.status === 429) throw new PayError(data.error ?? 'discount', data.message ?? 'Rabattkoden ble ikke godtatt.');
  if (!res.ok) throw new PayError('server', 'Fikk ikke sjekket koden akkurat nå. Prøv igjen om litt, eller skriv den inn i butikkens kasse.');
  const plans = data.plans ?? {};
  if (data.ok !== true || typeof data.code !== 'string' || REQUIRED.some((id) => !whole(plans[id]?.price) || !whole(plans[id]?.now))) {
    throw new PayError('server', 'Fikk ikke sjekket koden akkurat nå. Prøv igjen om litt, eller skriv den inn i butikkens kasse.');
  }
  return {
    code: data.code,
    summary: String(data.summary ?? ''),
    plans: Object.fromEntries(PLAN_IDS.filter((id) => whole(plans[id]?.price) && whole(plans[id]?.now)).map((id) => [id, { price: plans[id].price, now: plans[id].now, vipps: plans[id].vipps === true }])),
  };
}

/** Øre as the host reads it: «89 kr», «199,20 kr». */
export const kr = (ore) => `${ore % 100 === 0 ? ore / 100 : (ore / 100).toFixed(2).replace('.', ',')} kr`;

/** What a chosen package costs with the code in the store: { price, now, vipps } when the code takes something off it, otherwise null. */
export const dealFor = (discount, plan) => {
  const p = discount?.plans?.[plan];
  return p && p.now < p.price ? p : null;
};
