// The icons that are not the tab icon: the home-screen icons (apple-touch-icon, icon-192, icon-512, icon-maskable-512) and favicon.ico.
// All of them are the same mark as the favicon, the yellow lime with the eye (public/favicon.svg, made by favicon.mjs), so a link that is
// shared in a chat, a tab, a bookmark and the home screen all show the same picture. The home-screen icons put the lime on the page's
// burgundy; favicon.ico is the lime alone, on nothing, in three sizes, for the chat and mail programs that ask for /favicon.ico first.
// Usage: node tools/logo/icons.mjs   (run favicon.mjs first if the lime changes)
import fs from 'node:fs';
import sharp from 'sharp';

const BURGUNDY = '#6a1428'; // keep in sync with --burgundy-700 in public/css/tokens.css
const LIME = fs.readFileSync('public/favicon.svg');
const OUT = 'public/assets/icons';
fs.mkdirSync(OUT, { recursive: true });

/** A square icon: the lime on the burgundy, `fill` = how much of the square the lime takes, `radius` = rounded corners (0 = none). */
async function icon(px, { fill, radius }) {
  const big = 1024; // (drawn large, then scaled down: smoother edges)
  const lime = await sharp(LIME, { density: 400 }).resize(Math.round(big * fill), Math.round(big * fill)).png().toBuffer();
  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${big}" height="${big}"><rect width="${big}" height="${big}" rx="${Math.round(big * radius)}" fill="${BURGUNDY}"/></svg>`;
  const flat = await sharp(Buffer.from(bg)).composite([{ input: lime, gravity: 'centre' }]).png().toBuffer(); // (sharp resizes before it composites, so this is two steps)
  return sharp(flat).resize(px, px).png({ compressionLevel: 9 }).toBuffer();
}

const jobs = [
  ['icon-192.png', 192, { fill: 0.7, radius: 0.22 }],
  ['icon-512.png', 512, { fill: 0.7, radius: 0.22 }],
  ['apple-touch-icon.png', 180, { fill: 0.7, radius: 0 }], // iOS rounds the corners itself
  ['icon-maskable-512.png', 512, { fill: 0.56, radius: 0 }], // the lime inside the safe zone of an adaptive icon
];
for (const [name, px, options] of jobs) {
  fs.writeFileSync(`${OUT}/${name}`, await icon(px, options));
  console.log(name, px);
}

/** favicon.ico: PNG pictures in an ICO container (every browser and crawler of today reads those). */
function ico(pictures) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(pictures.length, 4);
  let offset = 6 + 16 * pictures.length;
  const entries = pictures.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e[0] = size;
    e[1] = size;
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([head, ...entries, ...pictures.map((p) => p.png)]);
}
const pictures = [];
for (const size of [16, 32, 48]) pictures.push({ size, png: await sharp(LIME, { density: 400 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer() });
fs.writeFileSync('public/favicon.ico', ico(pictures));
console.log('favicon.ico', pictures.map((p) => p.size).join(', '));
