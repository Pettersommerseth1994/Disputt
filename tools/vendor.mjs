// Copies the browser-ready builds of third-party libraries into public/js/vendor (no build step in production).
// Run after upgrading dependencies:  npm run vendor
import fs from 'node:fs';

const FILES = [
  ['node_modules/htm/preact/standalone.module.js', 'public/js/vendor/htm-preact.js'], // preact + hooks + htm in one ES module
  ['node_modules/qrcode-generator/dist/qrcode.mjs', 'public/js/vendor/qrcode.js'],
];
for (const [from, to] of FILES) {
  fs.copyFileSync(from, to);
  console.log(`${from} -> ${to}`);
}
