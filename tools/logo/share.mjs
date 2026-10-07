// The picture that a link to disputt.site shows when it is shared in a chat, a mail or a feed (the og:image of public/index.html).
// 1200 x 630 px, the size every service wants. Some services (Teams, Slack, Outlook) crop it to a square in the middle for a small thumbnail
// next to the title, so everything that matters (the logo, the slogan) sits in the middle 630 px, and the avatars stay out on the sides.
// Usage: node tools/logo/share.mjs     (needs Google Chrome, CHROME_PATH to override; writes public/assets/share/disputt-delingsbilde.jpg)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve('public');
const OUT = 'public/assets/share/disputt-delingsbilde.jpg';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

const page = `<!doctype html><html lang="nb"><meta charset="utf-8"><style>
@font-face { font-family: 'Disputt Display'; src: url('/assets/fonts/fraunces-italic.woff2') format('woff2'); font-weight: 600 900; font-style: normal; }
@font-face { font-family: 'Disputt Text'; src: url('/assets/fonts/lora-italic.woff2') format('woff2'); font-weight: 400 700; font-style: italic; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1200px; height: 630px; background: #6a1428; }
.card { position: relative; width: 1200px; height: 630px; overflow: hidden; color: #f8e6b8;
  background: url('/assets/textures/grain-soft.png') 0 0 / 384px 384px, radial-gradient(circle at 50% 46%, #8a2140 0%, #6a1428 50%, #46101c 100%); }
.card::after { content: ''; position: absolute; inset: 0; background: url('/assets/textures/crayon-dark.png') 0 0 / 640px 640px; opacity: .22; mix-blend-mode: multiply; pointer-events: none; }
.logo { position: absolute; left: 50%; top: 104px; width: 520px; transform: translateX(-50%); }
h1 { position: absolute; left: 0; right: 0; top: 296px; text-align: center; font: 900 58px/1.02 'Disputt Display'; letter-spacing: -0.012em; text-shadow: 4px 5px 0 #3d0a18; }
p { position: absolute; left: 0; right: 0; top: 468px; text-align: center; font: italic 600 32px/1 'Disputt Text'; color: #fae025; }
.av { position: absolute; }
</style><div class="card">
<img class="av" style="left:30px;top:50px;width:250px;transform:rotate(-14deg)" src="/assets/avatars/lime.svg" alt="">
<img class="av" style="left:96px;top:330px;width:240px;transform:rotate(12deg)" src="/assets/avatars/mandarin.svg" alt="">
<img class="av" style="left:960px;top:64px;width:210px;transform:rotate(-8deg)" src="/assets/avatars/blabaer.svg" alt="">
<img class="av" style="left:880px;top:324px;width:250px;transform:rotate(10deg)" src="/assets/avatars/kirsebaer.svg" alt="">
<img class="logo" src="/assets/logo/disputt-logo-cream.svg" alt="">
<h1>Diskuter, manipuler<br>og vinn</h1>
<p>Et quizspill med uenighetsgaranti</p>
</div>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(page);
  }
  const file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404;
    return res.end();
  }
  res.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
try {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await tab.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle0' });
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await new Promise((resolve) => setTimeout(resolve, 300));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await tab.screenshot({ path: OUT, type: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log(OUT, `${Math.round(fs.statSync(OUT).size / 1024)} KB`);
} finally {
  await browser.close();
  server.close();
}
process.exit(0);
