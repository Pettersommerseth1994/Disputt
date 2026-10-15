// The page the host comes back to from Vipps (takk.html; the address is the returnUrl that the payment server gave Vipps, with the reference
// of the payment on it). It asks the payment server whether the payment went through, says so, and gets the host back to the game. The
// game itself has been open in the tab behind this one all the time, asks for the access by itself, and closes this tab when it has it.
// Nothing about the host or the order is shown or asked for: the reference is all the page knows.
// Where this page opens decides what it offers: Vipps sends the host back to the phone's own browser, so on a phone it is often a tab that
// nobody here opened (the Vipps app opened it), next to the tab that the game opened and the tab the game stands in.

import { config } from './settings.js';

const REFERENCE = /^disputt-[0-9a-z]{24}$/;
const WAITING_KEY = 'disputt:shop'; // the same as pay/shop.js: a tab that holds a payment it is waiting for is the game's own
const POLL_MS = 2000;
const TRIES = 15; // about half a minute: after that, the host is told that it can take a while, and the page stops asking
const $ = (id) => document.getElementById(id);

const TEXTS = {
  checking: ['Et øyeblikk …', 'Vi sjekker betalingen hos Vipps.'],
  done: ['Takk!', 'Betalingen er gjennomført, og tilgangen dukker opp i spillet av seg selv. Kvitteringen kommer på e-post.'],
  failed: ['Betalingen ble ikke gjennomført', 'Ingen penger er trukket. Gå tilbake til spillet og prøv igjen.'],
  slow: ['Vi venter fortsatt på Vipps', 'Har du godkjent betalingen i Vipps, dukker tilgangen opp i spillet av seg selv så snart Vipps har meldt fra. Kvitteringen kommer på e-post.'],
  lost: ['Vi fikk ikke svar', 'Gå tilbake til spillet. Har du betalt, dukker tilgangen opp av seg selv, og koden kommer på e-post.'],
};

function show(state) {
  const [title, text] = TEXTS[state];
  $('takk-title').textContent = title;
  $('takk-text').textContent = text;
  document.title = `${title} · Disputt`;
  $('takk-actions').hidden = state === 'checking';
}

/** Is this tab the game's own, which left for Vipps and came back (a browser that opens no new tabs)? It then remembers the payment it waits for. */
function gameIsHere() {
  try {
    return sessionStorage.getItem(WAITING_KEY) !== null;
  } catch {
    return true; // (a browser that tells nothing: the link back is offered as the way on, as it was)
  }
}

/**
 * A tab that the game opened has an opener, and can be closed from here. The game's own tab gets a link back to the game. Any other tab (the
 * Vipps app opened it, or it is another browser) is told to go back to the tab with the game, and has the link only as the last way: it would
 * open the game a second time, without the room.
 */
function ways() {
  const fromGame = Boolean(window.opener);
  const own = gameIsHere();
  $('takk-close').hidden = !fromGame;
  $('takk-open').hidden = fromGame;
  if (!fromGame && !own) {
    $('takk-switch').hidden = false;
    $('takk-open').textContent = 'Åpne spillet her i stedet';
    $('takk-open').className = 'btn btn--text';
  }
  $('takk-close').addEventListener('click', () => {
    window.close();
    setTimeout(() => ($('takk-stay').hidden = false), 400); // (a tab that the game did not open cannot be closed by a page)
  });
}

async function ask(reference) {
  const res = await fetch(`${config.payments.apiUrl}/vipps/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify({ reference }) });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()).state;
}

async function main() {
  ways();
  const reference = new URLSearchParams(location.search).get('ref') ?? '';
  if (!REFERENCE.test(reference) || !config.payments?.apiUrl) return show('lost');
  show('checking');
  for (let i = 0; i < TRIES; i++) {
    let state;
    try {
      state = await ask(reference);
    } catch {
      state = 'lost';
    }
    if (state === 'done') {
      show('done');
      if (window.opener) setTimeout(() => window.close(), 1500); // (the game closes it too; whichever comes first)
      return undefined;
    }
    if (state === 'failed') return show('failed');
    if (state === 'lost' && i >= 2) return show('lost');
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return show('slow');
}

main();
