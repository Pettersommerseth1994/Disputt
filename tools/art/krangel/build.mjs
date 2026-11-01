#!/usr/bin/env node
// The pictures of the two game lengths («Småkrangel»: first to 8 points, «Storkrangel»: first to 12) and the two little symbols on their lines (a star, a clock).
// They are drawn in the same pastel style as the characters (the characters' own pictures, with brows and a mouth over them, see faces.mjs), photographed with
// Google Chrome on a transparent background and saved as WebP, so that a phone does not have to run eight more filters to show them.
//   node tools/art/krangel/build.mjs     → public/assets/art/krangel-{lite,stor}.webp and icon-{star,clock}.webp
// (Not part of `npm run art`, which needs no browser. Output is the same every time.)
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { scenes, symbols } from './scene.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = (rel) => pathToFileURL(join(ROOT, rel)).href;
const work = mkdtempSync(join(tmpdir(), 'krangel-'));

/** The red character without its purple lips (a mouth is drawn over it instead): the three layers of the lips (and the line between them) are left out. */
function withoutLips() {
  const svg = readFileSync(join(ROOT, 'public/assets/avatars/leppa.svg'), 'utf8');
  const open = svg.indexOf('</defs>') + '</defs>'.length;
  const filtered = svg.slice(open).match(/^<g filter="[^"]+">/)[0];
  const inner = svg.slice(open + filtered.length);
  const kids = [];
  let depth = 0, start = 0;
  for (const m of inner.matchAll(/<(\/?)(g|rect|path|ellipse|circle)\b[^>]*?\/?>/g)) {
    if (m[2] === 'g' && !m[1]) { if (depth++ === 0) start = m.index; }
    else if (m[2] === 'g') { if (--depth === 0) kids.push(inner.slice(start, m.index + m[0].length)); }
    else if (depth === 0) kids.push(m[0]);
  }
  if (kids.length !== 12) throw new Error(`leppa.svg has ${kids.length} layers, not 12: tools/art/krangel/build.mjs must be looked at again`);
  const tail = inner.slice(inner.lastIndexOf(kids[11]) + kids[11].length);
  const file = join(work, 'leppa-uten-lepper.svg');
  writeFileSync(file, svg.slice(0, open) + filtered + kids.slice(0, 4).join('') + kids[11] + tail);
  return pathToFileURL(file).href;
}

const src = { lime: url('public/assets/avatars/lime.svg'), blabaer: url('public/assets/avatars/blabaer.svg'), mandarin: url('public/assets/avatars/mandarin.svg'), leppa: withoutLips() };
const pics = scenes(src);
const sym = symbols();

const page = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${url('public/css/tokens.css')}"><style>
  html, body { margin: 0; background: transparent; }
  body { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 20px; padding: 20px; }
  .scene { position: relative; width: 150px; height: 174px; }
  .face { position: absolute; display: block; aspect-ratio: 1; }
  .face > img, .face__o { position: absolute; inset: 0; width: 100%; height: 100%; } .face__o { overflow: visible; }
  .layer { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .symbol { display: block; width: 32px; height: 32px; overflow: visible; }
</style></head><body>
  <div id="lite">${pics.lite}</div><div id="stor">${pics.stor}</div><div id="star">${sym.star}</div><div id="clock">${sym.clock}</div>
</body></html>`;
const html = join(work, 'page.html');
writeFileSync(html, page);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files'] });
const tab = await browser.newPage();
await tab.setViewport({ width: 700, height: 400, deviceScaleFactor: 3 });
await tab.goto(pathToFileURL(html).href, { waitUntil: 'networkidle0' });
await tab.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 500));

const out = join(ROOT, 'public/assets/art');
mkdirSync(out, { recursive: true });
for (const [id, name] of [['lite', 'krangel-lite'], ['stor', 'krangel-stor'], ['star', 'icon-star'], ['clock', 'icon-clock']]) {
  const png = await (await tab.$(`#${id}`)).screenshot({ omitBackground: true });
  const webp = await sharp(png).webp({ quality: 88, alphaQuality: 92, effort: 6 }).toBuffer();
  writeFileSync(join(out, `${name}.webp`), webp);
  console.log(`${(webp.length / 1024).toFixed(1).padStart(6)} KB  public/assets/art/${name}.webp`);
}
await browser.close();
