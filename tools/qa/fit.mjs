// Does each screen fit what a phone really shows? A browser's toolbars eat 150–300 px, so the visible height is more
// like 664 px (iPhone 15, Chrome) or 553 px (iPhone SE, Safari) than the 844 px of the full screen.
// For the screens that are meant to be seen at a glance, nothing may sit under the sticky button bar or need scrolling.
//   node tools/qa/fit.mjs [WxH …]        default: 390x664 375x553 360x640 430x740
//   exits non-zero when a screen that should fit does not
import puppeteer from 'puppeteer-core';
import { createApp } from '../../server/index.js';
import { QUESTIONS } from '../../shared/questions.js';
import { buildFixtures } from './fixtures.mjs';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const viewports = (process.argv.slice(2).length ? process.argv.slice(2) : ['390x664', '375x553', '360x640', '430x740']).map((v) => v.split('x').map(Number));

// screens that must be readable without scrolling (the others are lists or forms and are scrollable by nature)
// (a key ending in "-held" is the same screen with every hold-to-see button held: the role card and the open role strip)
const MUST_FIT = ['role-impostor', 'role-impostor-held', 'role-impostor-longest-held', 'role-loyal', 'role-loyal-held', 'countdown-asker', 'countdown-other', 'reveal-right', 'reveal-wrong', 'reveal-wrong-longest', 'reveal-wait', 'discussion-impostor', 'discussion-impostor-held', 'discussion-loyal', 'discussion-loyal-held'];
// ... and these should at least keep their main action and the text above it in view
const NICE_TO_FIT = ['question-asker-selected', 'question-asker-selected-held', 'question-asker-longest', 'summary-right-guest', 'summary-wrong-guest', 'lobby-guest-3'];

const app = createApp({ port: 0, host: '127.0.0.1', silent: true });
const port = await app.listen();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
await page.goto(`http://127.0.0.1:${port}/?debug=offline`, { waitUntil: 'networkidle0' });

async function show(view, qaHold = false) {
  await page.evaluate((view, qaHold) => {
    window.__realNow ??= Date.now.bind(Date);
    const delta = view.now - window.__realNow();
    Date.now = () => window.__realNow() + delta;
    window.__disputt.setStore({
      conn: 'open', everOpened: true, view, sheet: null, editing: false, seats: null, qaHold,
      session: { code: view.code, playerId: view.you.id, token: 'qa' },
      info: { publicUrl: null, lanUrls: ['http://192.168.100.59:3000'] },
    });
  }, view, qaHold);
}

/** How much of the screen is hidden: text under the sticky bar, and how far the page scrolls. */
const measure = () =>
  page.evaluate(() => {
    window.scrollTo(0, 0);
    const main = document.querySelector('main');
    const dock = main?.querySelector('.dock');
    const dockTop = dock ? dock.getBoundingClientRect().top : innerHeight;
    // lowest piece of text that is not in the dock
    let lowest = 0;
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim() || (dock && dock.contains(n))) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const rect of r.getClientRects()) lowest = Math.max(lowest, rect.bottom);
    }
    // the last visible box of content (cards, images) also counts
    for (const el of main.querySelectorAll('.card, img, .btn, .option, .segmented, .timer')) {
      if (dock && dock.contains(el)) continue;
      lowest = Math.max(lowest, el.getBoundingClientRect().bottom);
    }
    return {
      overflow: Math.round(document.documentElement.scrollHeight - innerHeight),
      hidden: Math.round(lowest - (dock ? dockTop - 8 : innerHeight)), // > 0: something is covered or cut off
      hasDock: Boolean(dock),
    };
  });

const fixtures = buildFixtures();
// the worst case the question bank can throw at the layout: the longest question and the longest answers
const longestQ = QUESTIONS.reduce((a, b) => (b.text.length > a.text.length ? b : a));
const LONG_OPTIONS = ['Valentina Teresjkova', 'Svetlana Savitskaja', 'Bjørnstjerne Bjørnson', 'Store Skagastølstind'];
const variant = (key, patch) => {
  const v = structuredClone(fixtures[key]);
  patch(v);
  return v;
};
fixtures['question-asker-longest'] = variant('question-asker-selected', (v) => Object.assign(v.question, { text: longestQ.text, options: LONG_OPTIONS }));
fixtures['reveal-wrong-longest'] = variant('reveal-wrong', (v) => Object.assign(v.reveal, { correctText: 'Bjørnstjerne Bjørnson' }));
fixtures['role-impostor-longest'] = variant('role-impostor', (v) => Object.assign(v.you.secret, { text: 'Bjørnstjerne Bjørnson' }));
let failures = 0;
for (const [w, h] of viewports) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const rows = [];
  for (const key of [...MUST_FIT, ...NICE_TO_FIT]) {
    const held = key.endsWith('-held');
    await show(fixtures[held ? key.slice(0, -'-held'.length) : key], held);
    await sleep(key.startsWith('role') ? 1300 : 900); // let the entrance animations settle
    const m = await measure();
    const must = MUST_FIT.includes(key);
    const ok = m.hidden <= 0 && (m.hasDock || m.overflow <= 1);
    if (!ok && must) failures++;
    rows.push(`${ok ? 'ok  ' : must ? 'FAIL' : 'tight'}  ${key.padEnd(26)} hidden ${String(m.hidden).padStart(4)} px  scroll ${String(Math.max(0, m.overflow)).padStart(4)} px${m.hasDock ? '  (button bar)' : ''}`);
  }
  console.log(`\n${w}x${h}\n${rows.join('\n')}`);
}
await browser.close();
await app.close();
if (failures) {
  console.error(`\n${failures} screen(s) do not fit.`);
  process.exit(1);
}
console.log('\nAll must-fit screens fit.');
