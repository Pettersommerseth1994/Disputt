// The host leaves the page to pay (Stripe's page) and comes back a little later. The room is saved and returns with the host
// (p2p/host.js), but the guests only see the line to the host die, and give up on the game after about a minute (net.js). So the
// host tells them first, and they wait for the host instead.
// (A file of its own: pages are cached for ten minutes ...)

/** How long the guests wait for a host who has gone to pay. Paying with Vipps means opening another app: it can take a while. */
export const AWAY_MS = 10 * 60_000;

let announcer = null;

/** net.js says how to reach the guests (only the page that runs the game has any). */
export function setAwayAnnouncer(fn) {
  announcer = fn;
}

/**
 * Tells the guests that the host is going away for a while. Resolves a moment later, so that the message is on its way before the
 * page is. Does nothing for a page that is not running a game.
 */
export async function announceAway(why = 'pay') {
  let reached = 0;
  try {
    reached = announcer?.({ t: 'away', why, ms: AWAY_MS }) ?? 0;
  } catch {
    /* the payment must not fail because the guests could not be told */
  }
  if (reached > 0) await new Promise((resolve) => setTimeout(resolve, 250));
}
