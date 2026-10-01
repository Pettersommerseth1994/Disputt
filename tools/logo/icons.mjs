// App icons: the "D" of the wordmark in ink on crayon yellow, with a small eye in its bowl.
// Usage: node tools/logo/icons.mjs   (needs tmp/fonts/fraunces-display.ttf from tools/fonts/build.sh)
import fs from 'node:fs';
import * as fontkit from 'fontkit';
import sharp from 'sharp';

const FONT_PATH = process.argv[2] ?? 'tmp/fonts/fraunces-display.ttf';
const INK = '#3a2012'; // keep in sync with --ink in public/css/tokens.css
const CREAM = '#f8e6b8'; // ... and --cream
const YELLOW = '#fae025';
const font = fontkit.openSync(FONT_PATH).getVariation({ wght: 900, opsz: 144 });
const D = font.glyphForCodePoint('D'.codePointAt(0));
const { minX, maxX, minY, maxY } = D.bbox;

/** SVG for a square icon. `pad` = fraction of the canvas kept free around the D. */
function iconSvg({ pad, radius }) {
  const size = 512;
  const target = size * (1 - pad * 2);
  const scale = target / Math.max(maxX - minX, maxY - minY);
  const w = (maxX - minX) * scale;
  const h = (maxY - minY) * scale;
  const tx = (size - w) / 2 - minX * scale + size * 0.012; // optical centring for the italic slant
  const ty = (size + h) / 2 + minY * scale;
  const path = D.path.transform(scale, 0, 0, -scale, tx, ty).toSVG();
  // the eye sits in the counter (bowl) of the D
  const ex = tx + 770 * scale;
  const ey = ty - 700 * scale;
  const rx = 205 * scale;
  const ry = 150 * scale;
  const bg = radius ? `<rect width="512" height="512" rx="${radius}" fill="${YELLOW}"/>` : `<rect width="512" height="512" fill="${YELLOW}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${bg}<path d="${path}" fill="${INK}"/>
<ellipse cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${CREAM}" transform="rotate(-8 ${ex.toFixed(1)} ${ey.toFixed(1)})"/>
<circle cx="${(ex + rx * 0.1).toFixed(1)}" cy="${(ey + ry * 0.05).toFixed(1)}" r="${(ry * 0.78).toFixed(1)}" fill="#2230c8"/>
<circle cx="${(ex + rx * 0.1).toFixed(1)}" cy="${(ey + ry * 0.05).toFixed(1)}" r="${(ry * 0.42).toFixed(1)}" fill="${INK}"/>
<circle cx="${(ex + rx * 0.3).toFixed(1)}" cy="${(ey - ry * 0.28).toFixed(1)}" r="${(ry * 0.2).toFixed(1)}" fill="${CREAM}"/></svg>`;
}

const out = 'public/assets/icons';
fs.mkdirSync(out, { recursive: true });
const rounded = iconSvg({ pad: 0.1, radius: 112 });
fs.writeFileSync('public/favicon.svg', rounded);
const jobs = [
  ['icon-192.png', rounded, 192],
  ['icon-512.png', rounded, 512],
  ['apple-touch-icon.png', iconSvg({ pad: 0.1, radius: 0 }), 180], // iOS rounds the corners itself
  ['icon-maskable-512.png', iconSvg({ pad: 0.2, radius: 0 }), 512], // safe zone for adaptive icons
];
for (const [name, svg, px] of jobs) {
  await sharp(Buffer.from(svg), { density: 300 }).resize(px, px).png({ compressionLevel: 9 }).toFile(`${out}/${name}`);
  console.log(name, px);
}
