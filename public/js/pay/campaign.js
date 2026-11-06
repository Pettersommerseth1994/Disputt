// A campaign discount code that comes with the link (`https://disputt.site/?rabatt=BLACK`, the way the buttons on playdisputt.com open the game):
// it is taken out of the address at once, kept on the phone for a while (the host may open the packages much later, after three free rounds), and the
// screen with the packages asks the payment server about it when it opens and takes it, as if the host had typed it (screens/discount.js). The server
// is what decides: a code that is not good (unknown, ended, or not for these packages) is dropped without a word, and the price is whatever the shop says.
// (A file of its own: pages are cached for ten minutes ...)

const KEY = 'disputt:rabatt';
const KEEP_MS = 14 * 86_400_000;
let pending = null; // (also held here, so that a private window, which keeps nothing, still has it for this visit)

/** The code as the shop knows it: capitals, letters and digits, - and _ only, at most 32 signs. */
export const cleanCode = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);

/** A code in the Black month family (BLACK, BLACK30 …): it is shown as a campaign, with a sticker, and not as the host's own code. */
export const isBlackCode = (code) => /^BLACK/i.test(String(code ?? ''));

const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return v && typeof v.code === 'string' && Number.isFinite(v.at) ? v : null;
  } catch {
    return null;
  }
};

/** The code kept from a link, if it is not too old; otherwise null. */
export function rememberedCode(now = Date.now()) {
  if (pending) return pending;
  const v = read();
  return v && cleanCode(v.code) && now - v.at < KEEP_MS ? cleanCode(v.code) : null;
}

export function forgetCode() {
  pending = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* no memory: nothing to forget */
  }
}

/** Takes `?rabatt=` out of the address and keeps it (the rest of the address stays). Returns the code, or null. */
export function takeCodeFromAddress() {
  let code = null;
  try {
    const url = new URL(location.href);
    const v = url.searchParams.get('rabatt');
    if (v === null) return null;
    url.searchParams.delete('rabatt');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    code = cleanCode(v) || null;
  } catch {
    return null; // (no address, no history: the tests' make-believe pages)
  }
  if (code) {
    pending = code;
    try {
      localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
    } catch {
      /* private window: the code holds for this visit only, which the packages screen cannot know; it is lost on a reload */
    }
  }
  return code;
}

takeCodeFromAddress();
