// Which packages the packages screen shows. With Shopify as the shop it is the ones the payment server has a variant for (the weekend
// is not there until the shop has a product for it); before the server has answered, and with the other payment edition, all of them.
// (A file of its own: pages are cached for ten minutes ...)

import { useEffect, useState } from '../vendor/htm-preact.js';
import { PLANS } from '../pay/plans.js';
import { knownShop, loadShop } from '../pay/shop.js';

export function useOffered(provider) {
  const [shop, setShop] = useState(provider === 'shopify' ? knownShop() : null);
  useEffect(() => {
    if (provider !== 'shopify' || shop) return undefined;
    let live = true;
    loadShop()
      .then((info) => live && setShop(info))
      .catch(() => {}); // (the bar under the packages tells that the shop could not be reached)
    return () => {
      live = false;
    };
  }, [provider, shop]);
  return shop ? PLANS.filter((p) => shop.variants[p.id]) : PLANS;
}
