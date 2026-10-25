// «Får ikke kontakt ennå»: how long a phone may wait on the connecting screen before it is told what to try (turn Wi‑Fi off, use mobile data).
// Ten seconds: a line that comes up at all comes up faster than that, and a network that does not let phones talk to each other never will.
// (A file of its own: pages are cached for ten minutes, and a module that imports something an older cached copy of another module does not have
// would not load.)

import { useEffect, useState } from './vendor/htm-preact.js';

export const SLOW_CONNECT_MS = 10_000;

/** True when `waiting` has been true for `ms` without a break; false again as soon as it is not (the line came up, or the screen is another). */
export function useSlowConnect(waiting, ms = SLOW_CONNECT_MS) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(timer);
  }, [waiting, ms]);
  return waiting && slow;
}
