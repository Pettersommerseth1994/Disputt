// Builds the Disputt wordmark as outlined SVG paths (no font needed at runtime).
// Usage: node tools/logo/build.mjs [path/to/fraunces-display.ttf]
// The TTF is the instanced display font that `tools/fonts/build.sh` leaves in tmp/fonts/.
import fs from 'node:fs';
import * as fontkit from 'fontkit';

const FONT_PATH = process.argv[2] ?? 'tmp/fonts/fraunces-display.ttf';
const OUT_DIR = 'public/assets/logo';
const INK = '#3a2012'; // keep in sync with --ink in public/css/tokens.css
const CREAM = '#f8e6b8'; // ... and --cream
const WORD = 'Disputt';
const TRACKING = -0.012; // em; the heavy italic wants to be a little tighter
const SCALE = 0.1;       // font units -> svg units (UPM 2000 -> 200px em)

if (!fs.existsSync(FONT_PATH)) {
  console.error(`Missing ${FONT_PATH}. Run tools/fonts/build.sh first.`);
  process.exit(1);
}

const font = fontkit.openSync(FONT_PATH).getVariation({ wght: 900, opsz: 144 });
const upm = font.unitsPerEm;

const fmt = (n) => (Math.round(n * 10) / 10).toString();
const round = (d) => d.replace(/-?\d+\.\d+/g, (m) => fmt(Number(m)));

/** Lay out the word; returns glyphs with x positions (font units). */
function layout(text, { dotless = false } = {}) {
  const run = font.layout(text);
  let x = 0;
  const glyphs = run.glyphs.map((g, i) => {
    const pos = run.positions[i];
    const out = { glyph: g, x: x + (pos.xOffset || 0), char: text[i] };
    x += pos.xAdvance + TRACKING * upm;
    return out;
  });
  return { glyphs, advance: x };
}

/** Split a glyph path into its separate contours (M…Z runs). */
function contours(path) {
  const list = [];
  let cur = null;
  for (const c of path.commands) {
    if (c.command === 'moveTo') { cur = []; list.push(cur); }
    cur.push(c);
  }
  return list;
}

function contourBBox(cmds) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of cmds) {
    for (let i = 0; i < c.args.length; i += 2) {
      minX = Math.min(minX, c.args[i]); maxX = Math.max(maxX, c.args[i]);
      minY = Math.min(minY, c.args[i + 1]); maxY = Math.max(maxY, c.args[i + 1]);
    }
  }
  return { minX, minY, maxX, maxY };
}

function contourToPath(cmds, dx) {
  const f = (v) => v;
  return cmds.map((c) => {
    const a = c.args;
    const px = (i) => fmt((a[i] + dx) * SCALE);
    const py = (i) => fmt(-a[i + 1] * SCALE);
    switch (c.command) {
      case 'moveTo': return `M${px(0)} ${py(0)}`;
      case 'lineTo': return `L${px(0)} ${py(0)}`;
      case 'quadraticCurveTo': return `Q${px(0)} ${py(0)} ${px(2)} ${py(2)}`;
      case 'bezierCurveTo': return `C${px(0)} ${py(0)} ${px(2)} ${py(2)} ${px(4)} ${py(4)}`;
      case 'closePath': return 'Z';
      default: throw new Error(`unknown command ${c.command} ${f(0)}`);
    }
  }).join('');
}

function glyphPath(g, dx) {
  return contours(g.path).map((cs) => contourToPath(cs, dx)).join('');
}

function build({ eye }) {
  const text = eye ? WORD.replace('i', 'ı') : WORD;
  const { glyphs, advance } = layout(text);
  let d = '';
  let minY = Infinity, maxY = -Infinity, minX = Infinity;
  for (const { glyph, x } of glyphs) {
    d += glyphPath(glyph, x);
    const b = glyph.bbox;
    minX = Math.min(minX, b.minX + x); minY = Math.min(minY, b.minY); maxY = Math.max(maxY, b.maxY);
  }
  let eyeSvg = '';
  if (eye) {
    // Take the dot geometry from the regular "i" glyph, then draw a small eye in its place.
    const iGlyph = font.glyphForCodePoint('i'.codePointAt(0));
    const dot = contours(iGlyph.path).map(contourBBox).sort((a, b) => b.minY - a.minY)[0];
    const iIndex = text.indexOf('ı');
    const ix = glyphs[iIndex].x;
    const cx = (dot.minX + dot.maxX) / 2 + ix + 12;
    const cy = (dot.minY + dot.maxY) / 2 + 8;
    const rx = ((dot.maxX - dot.minX) / 2) * 1.2;
    const ry = ((dot.maxY - dot.minY) / 2) * 1.12;
    maxY = Math.max(maxY, cy + ry);
    const e = (x, y, rX, rY, rot = 0) =>
      `<ellipse cx="${fmt(x * SCALE)}" cy="${fmt(-y * SCALE)}" rx="${fmt(rX * SCALE)}" ry="${fmt(rY * SCALE)}"${rot ? ` transform="rotate(${rot} ${fmt(x * SCALE)} ${fmt(-y * SCALE)})"` : ''}/>`;
    // evenodd: outer lid (fill) -> eyeball (hole) -> pupil (fill) -> glint (hole)
    const path = (cxE, cyE, rX, rY) => {
      const X = cxE * SCALE, Y = -cyE * SCALE, A = rX * SCALE, B = rY * SCALE;
      return `M${fmt(X - A)} ${fmt(Y)}a${fmt(A)} ${fmt(B)} 0 1 0 ${fmt(2 * A)} 0a${fmt(A)} ${fmt(B)} 0 1 0 ${fmt(-2 * A)} 0Z`;
    };
    eyeSvg =
      path(cx, cy, rx, ry) +
      path(cx, cy, rx * 0.74, ry * 0.7) +
      path(cx + rx * 0.14, cy + ry * 0.06, rx * 0.42, ry * 0.44) +
      path(cx + rx * 0.3, cy + ry * 0.26, rx * 0.12, ry * 0.12);
    void e;
  }
  const pad = 2;
  const x0 = (minX - 0) * SCALE - pad;
  const y0 = -maxY * SCALE - pad;
  const w = (advance - TRACKING * upm) * SCALE - x0 + pad * 2 - 2;
  const h = (maxY - minY) * SCALE + pad * 2;
  return { d: round(d), eyeD: round(eyeSvg), viewBox: `${fmt(x0)} ${fmt(y0)} ${fmt(w)} ${fmt(h)}`, w, h };
}

function svg({ d, eyeD, viewBox, w, h }, fill, label) {
  const eye = eyeD ? `<path fill-rule="evenodd" d="${eyeD}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${Math.round(w)}" height="${Math.round(h)}" role="img" aria-label="${label}" fill="${fill}"><title>${label}</title><path d="${d}"/>${eye}</svg>\n`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const plain = build({ eye: false });
const withEye = build({ eye: true });
const files = {
  'disputt-logo.svg': svg(plain, INK, 'Disputt'),
  'disputt-logo-cream.svg': svg(plain, CREAM, 'Disputt'),
  'disputt-logo-eye.svg': svg(withEye, INK, 'Disputt'),
  'disputt-logo-eye-cream.svg': svg(withEye, CREAM, 'Disputt'),
};
for (const [name, body] of Object.entries(files)) {
  fs.writeFileSync(`${OUT_DIR}/${name}`, body);
  console.log(name, `${(body.length / 1024).toFixed(1)} KB`);
}
