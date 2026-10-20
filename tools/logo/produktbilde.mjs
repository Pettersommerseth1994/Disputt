// Draws tools/logo/produktbilde-helg.html as a 2048 x 2048 PNG (the product picture in Shopify) in ~/Disputt-Produktbilder/.
// Needs Google Chrome and puppeteer-core (the same as the other QA tools): node tools/logo/produktbilde.mjs
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const out = path.join(homedir(), 'Disputt-Produktbilder');
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(path.resolve('tools/logo/produktbilde-helg.html')).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const file = path.join(out, 'Disputt-produktbilde-en-helg.png');
await page.screenshot({ path: file });
await browser.close();
console.log(file);
