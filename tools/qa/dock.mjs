// Text and buttons must never be drawn on top of other things. Two rules for the bar at the bottom of a screen (`.dock`):
//   1. A bar that is frozen to the bottom of the screen (position: sticky) carries the screen's main action, a button,
//      and has a solid background: nothing scrolling underneath may show through its text or its button.
//   2. A bar that only has text or links in it (waiting for the host, "how to play") is not frozen at all: it sits at the
//      end of the page, as `.foot`.
// A third rule covers everything else: no two pieces of visible text may overlap, at any scroll position.
// The solid-background rule is checked on pixels: the bar is photographed as it is, then again with everything else on
// the page hidden. If the two pictures differ, something showed through.
//   node tools/qa/dock.mjs [WxH …]        default: 390x664 375x553 430x740
//   exits non-zero when a screen breaks a rule
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { createApp } from '../../server/index.js';
import { buildFixtures } from './fixtures.mjs';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const viewports = (process.argv.slice(2).length ? process.argv.slice(2) : ['390x664', '375x553', '430x740']).map((v) => v.split('x').map(Number));

const app = createApp({ port: 0, host: '127.0.0.1', silent: true });
const port = await app.listen();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
await page.goto(`http://127.0.0.1:${port}/?debug=offline`, { waitUntil: 'networkidle0' });

async function show(view, extra = {}) {
  await page.evaluate(
    (view, extra) => {
      window.__realNow ??= Date.now.bind(Date);
      const delta = view.now - window.__realNow();
      Date.now = () => window.__realNow() + delta;
      window.__disputt.setStore({
        conn: 'open', everOpened: true, view, sheet: null, editing: false, seats: null,
        session: { code: view.code, playerId: view.you.id, token: 'qa' },
        info: { publicUrl: null, lanUrls: ['http://192.168.100.59:3000'] },
        ...extra,
      });
    },
    view,
    extra,
  );
}

/** The screens: every fixture, plus the start page (no game view at all). */
const fixtures = buildFixtures();
const screens = [
  ['home', async () => page.evaluate(() => window.__disputt.setStore({ view: null, session: null, seats: null, sheet: null, editing: false, conn: 'open', everOpened: true }))],
  ...Object.entries(fixtures).map(([key, view]) => [key, () => show(view, key === 'profile-edit' ? { editing: true } : {})]),
];

/** The pixels of a rectangle given in viewport coordinates (a screenshot's own clip option counts from the top of the document). */
const raw = async (rect) => {
  const png = await page.screenshot({ captureBeyondViewport: false });
  const { data, info } = await sharp(png).extract({ left: rect.x, top: rect.y, width: rect.width, height: rect.height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
};
/** Share of pixels that differ visibly between two photographs of the same rectangle. */
const difference = (a, b) => {
  let bad = 0;
  const n = a.data.length / 4;
  for (let i = 0; i < a.data.length; i += 4) {
    const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
    if (d > 14) bad++;
  }
  return bad / n;
};

/** Pairs of visible text that overlap each other (text hidden behind something opaque does not count). */
const collisions = () =>
  page.evaluate(() => {
    const lines = [];
    const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent.trim();
      const el = n.parentElement;
      if (!text || !el || getComputedStyle(el).visibility === 'hidden' || el.closest('.confetti, .decor, [aria-hidden="true"]')) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const box = el.getBoundingClientRect();
      for (const line of range.getClientRects()) {
        // A line's own box can be taller than what is drawn (a big numeral with a tight line-height): keep to the element's box.
        const r = { left: Math.max(line.left, box.left), right: Math.min(line.right, box.right), top: Math.max(line.top, box.top), bottom: Math.min(line.bottom, box.bottom) };
        r.width = r.right - r.left;
        r.height = r.bottom - r.top;
        if (r.width < 3 || r.height < 3 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
        // is this text actually the topmost thing where it is? (something opaque on top hides it, which is fine)
        const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
        const cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
        const top = document.elementFromPoint(cx, cy);
        if (!top || !(top === el || el.contains(top) || top.contains(el))) continue;
        lines.push({ text: text.slice(0, 24), el, r });
      }
    }
    const found = [];
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const a = lines[i];
        const b = lines[j];
        if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (w > 2 && h > 2 && (w * h) / Math.min(a.r.width * a.r.height, b.r.width * b.r.height) > 0.2) found.push(`"${a.text}" over "${b.text}"`);
      }
    }
    return found;
  });

let failures = 0;
let checked = 0;
for (const [w, h] of viewports) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const problems = [];
  for (const [key, setup] of screens) {
    await setup();
    await sleep(key.startsWith('role') || key.startsWith('finished') ? 1300 : 800); // entrance animations
    // rule 3, at the top, halfway and at the bottom of the page
    const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (const at of [0, Math.round(maxScroll / 2), maxScroll]) {
      await page.evaluate((y) => window.scrollTo(0, Math.max(0, y)), at);
      await sleep(200);
      for (const c of await collisions()) problems.push(`${key}: text over text (scrolled to ${Math.max(0, at)}px): ${c}`);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    const facts = await page.evaluate(() => {
      const dock = document.querySelector('main .dock');
      if (!dock) return null;
      const style = getComputedStyle(dock);
      return {
        sticky: style.position === 'sticky' || style.position === 'fixed',
        hasButton: Boolean(dock.querySelector('.btn:not(.btn--text)')),
        scrolls: document.documentElement.scrollHeight > innerHeight + 1,
        maxScroll: document.documentElement.scrollHeight - innerHeight,
      };
    });
    if (!facts) continue;
    checked++;
    // rule 2: frozen means "has the main action"
    if (facts.sticky && !facts.hasButton) problems.push(`${key}: the bar only has text or links but is frozen to the screen (give it class "foot" instead of "dock")`);
    // rule 1: solid, checked on pixels at the top of the page (most content below the fold = most under the bar) and halfway
    if (facts.sticky && facts.scrolls) {
      for (const at of [0, Math.round(facts.maxScroll / 2)]) {
        await page.evaluate((y) => window.scrollTo(0, y), at);
        await sleep(250);
        const clip = await page.evaluate(() => {
          const r = document.querySelector('main .dock').getBoundingClientRect();
          return { x: Math.max(0, Math.floor(r.left)), y: Math.max(0, Math.floor(r.top)), width: Math.ceil(Math.min(r.width, innerWidth)), height: Math.ceil(Math.min(r.height, innerHeight - r.top)) };
        });
        const asIs = await raw(clip);
        // (everything in the screen is hidden except the bar and what is in it; the bar may sit inside a form, so hide by visibility)
        await page.addStyleTag({ content: 'main * { visibility: hidden !important; } main .dock, main .dock * { visibility: visible !important; } #qa-hide {}' });
        await sleep(100);
        const alone = await raw(clip);
        await page.evaluate(() => {
          document.querySelectorAll('style').forEach((s) => s.textContent.includes('#qa-hide') && s.remove());
        });
        const share = difference(asIs, alone);
        if (share > 0.004) problems.push(`${key}: ${(share * 100).toFixed(1)}% of the bar's pixels show something from underneath (scrolled to ${at}px)`);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  }
  failures += problems.length;
  console.log(`${w}x${h}: ${problems.length ? `${problems.length} problem(s)\n  ${problems.join('\n  ')}` : 'ok'}`);
}
await browser.close();
await app.close();
if (failures) {
  console.error(`\n${failures} problem(s) with the bottom bars.`);
  process.exit(1);
}
console.log(`\nAll ${checked} bottom bars are solid, and only bars with a button are frozen.`);
