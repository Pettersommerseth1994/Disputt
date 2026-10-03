// The favicon: the lime from the start screen, yellow instead of green.
// Usage: node tools/logo/favicon.mjs
// Takes the drawing in public/assets/avatars/lime.svg, moves every green in it to yellow (the eye, the purple swirls and the
// pink lid keep their colours), trims the canvas to the lime, and writes public/favicon.svg plus a 32 px PNG for the browsers
// that cannot use an SVG icon. The home-screen icons (the D) are made by icons.mjs.
import fs from 'node:fs';
import sharp from 'sharp';

const SOURCE = 'public/assets/avatars/lime.svg';
const PNG_OUT = 'public/assets/icons/favicon-32.png';
const SIZE = 512; // the size the SVG says it is (the browser scales it)
const MARGIN = 0.04; // of the lime's width, kept free around it

const toHsl = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, s, l];
};

const fromHsl = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
};

/** Yellow-greens turn yellow, the darker greens (and the teal strokes among them) turn amber. Everything else stays. */
function toYellow(hex) {
  const [h, s, l] = toHsl(hex);
  if (h < 60 || h > 195 || s < 0.2) return hex;
  const hue = 56 - Math.min(h - 64, 70) * 0.2; // yellow-green (64°) -> yellow (56°), dark green (130°+) -> amber (42°)
  const sat = Math.min(1, 0.3 + s * 0.9); // greens are duller than yellows
  const light = Math.min(0.92, l + 0.1 * (1 - Math.abs(2 * l - 1))); // and the mid-tones need a little more light
  return fromHsl(hue, sat, light);
}

const yellow = fs.readFileSync(SOURCE, 'utf8').replace(/#[0-9a-fA-F]{6}\b/g, toYellow);

// where the lime is on the canvas (the drawing leaves some room around it), so the icon can fill its square
const { data, info } = await sharp(Buffer.from(yellow)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let [x0, y0, x1, y1] = [info.width, info.height, 0, 0];
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] < 40) continue;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
}
const side = Math.max(x1 - x0, y1 - y0) * (1 + MARGIN * 2);
const left = ((x0 + x1) / 2 - side / 2).toFixed(1);
const top = ((y0 + y1) / 2 - side / 2).toFixed(1);
const svg = yellow.replace(/<svg [^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${side.toFixed(1)} ${side.toFixed(1)}" width="${SIZE}" height="${SIZE}">`);

fs.writeFileSync('public/favicon.svg', svg);
await sharp(Buffer.from(svg), { density: 300 }).resize(32, 32).png({ compressionLevel: 9 }).toFile(PNG_OUT);
console.log(`favicon.svg (${(svg.length / 1024).toFixed(1)} kB), ${PNG_OUT}`);
