// When the card «Mistet forbindelsen» comes up (screens/reconnect.js). Pure, so that the tests can run it in Node.

export const OFFER_AFTER_MS = 3000; // without a line this long before the card comes up (a blink that mends itself is not worth a card)
export const RELOAD_AFTER_MS = 7000; // after the button: no line yet, so the page is loaded again

/** Is the phone in a game (or on its way back into one) and without a line to it (a host: without a line to the introduction service), with nothing that explains it (a host who went off to pay, a game opened elsewhere)? */
export function lostLine(s, now = Date.now()) {
  const inGame = Boolean(s.view || s.session);
  return inGame && (s.conn !== 'open' || Boolean(s.hostOffline)) && !s.replaced && !s.creating && !(s.hostAwayUntil > now);
}
