// Frøken Briller – teal curly hair, grey-lilac face with red cracks/drips, round pink-rimmed
// glasses with iridescent yellow/teal lenses, wine-red lips (ref 2), in the same pastel hand.
import { Shape } from '../lib/shape.mjs';
import { paint, render, G_OPEN } from '../lib/pastel.mjs';
import { arcs } from '../lib/eye.mjs';
import { blobPoints, TAU } from '../lib/geom.mjs';
import { Canvas } from '../lib/svg.mjs';
import { Rng } from '../lib/rng.mjs';
import { pastelSpec, PAPER } from '../lib/recipes.mjs';
import { lips, curl } from '../lib/parts.mjs';

const INK = '#1c0a10';

export default function briller() {
  const cv = new Canvas('briller');
  const rng = new Rng('briller');
  let s = '';

  // ---- hair: big mass + curl bumps around the outline ------------------------------------
  const hr = rng.fork('hair');
  const bumps = [];
  const bumpAt = [];
  for (let i = 0; i < 13; i++) {
    const a = Math.PI * 0.82 + (i / 12) * Math.PI * 1.36 + hr.range(-0.05, 0.05);
    const R = 140 + hr.range(-5, 5);
    const c = [200 + Math.cos(a) * R * 1.04, 200 + Math.sin(a) * R];
    const r = hr.range(24, 31);
    bumpAt.push([c, r, a]);
    bumps.push(blobPoints(hr.fork('b' + i), { cx: c[0], cy: c[1], rx: r, ry: r, n: 7, jitter: 0.06 }));
  }
  const hair = new Shape([
    blobPoints(hr.fork('mass'), { cx: 200, cy: 206, rx: 150, ry: 146, n: 12, jitter: 0.03 }),
    ...bumps,
  ]);
  s += paint(cv, hair, hr.fork('paint'), pastelSpec({
    base: '#1b838c', mid: '#2a9aa2', dark: '#126a72', deep: '#0d5058', alt: '#7b3f9e',
    light: '#53a0a7', pale: '#89b3b5', warm: '#c4d74a',
    rim: '#0b4c54', rim2: '#126a72', rimDeep: '#083a40',
  }, {
    follow: 1, band: 70, warmOp: 0.45, warmTone: [0.45, 1], density: 0.72,
    passesAfter: [{ c: '#0d5058', w: 3.6, op: 0.55, sp: 15, len: [34, 64], follow: 1, band: 99, jitter: 6 }],
    scratch: { n: 14, dots: 6, depth: [0.04, 0.3] },
  })).svg;
  // loopy curls on the bumps
  const cr = hr.fork('curls');
  const dark = [], light = [];
  bumpAt.forEach(([c, r, a], i) => {
    const cc = [c[0] - Math.cos(a) * r * 0.15, c[1] - Math.sin(a) * r * 0.15];
    dark.push(curl(cc, r * 0.78, 1.25, a + cr.range(-0.5, 0.5), i % 2 ? 1 : -1, 15));
    light.push(curl([cc[0] - 3, cc[1] - 3], r * 0.5, 1.0, a + 1 + cr.range(-0.5, 0.5), i % 2 ? 1 : -1, 10));
  });
  for (const c of [[150, 76], [250, 70], [200, 54], [100, 130], [300, 128]]) dark.push(curl(c, 20, 1.3, cr.range(0, TAU), cr.sign(), 14));
  s += G_OPEN + render(dark, { c: '#0b4c54', w: [6.5, 5], op: 0.8, split: 1, prec: 0, rng: cr });
  s += render(light, { c: '#89c8c8', w: [4, 3], op: 0.75, split: 1, prec: 0, rng: cr }) + '</g>';

  // ---- face ------------------------------------------------------------------------------
  const fr = rng.fork('face');
  const face = new Shape(blobPoints(fr.fork('shape'), {
    cx: 200, cy: 240, rx: 100, ry: 128, n: 12, jitter: 0.025, harmonics: [[3, 0.02]],
    shape: (t) => 1 - 0.1 * Math.max(0, Math.sin(t)) ** 2,
  }));
  s += paint(cv, face, fr.fork('paint'), pastelSpec({
    base: '#b4aac6', mid: '#c2b9d2', dark: '#968aae', deep: '#7a6c96', alt: '#e55666',
    light: '#d8d0e4', pale: '#efeaf4', warm: '#c4d74a',
    rim: INK, rim2: '#6a5a84', rimDeep: INK,
  }, {
    follow: 0.8, band: 30, altOp: 0.3, altTone: [0.1, 0.5], warmOp: 0.35, density: 0.85,
    rimsAfter: [{ c: INK, w: [9, 7], op: 0.92, len: [30, 70], inset: [-3, 1] }],
    scratch: { n: 10, dots: 5, depth: [0.06, 0.3] },
  })).svg;

  // ---- red cracks + drips ------------------------------------------------------------------
  const dr = rng.fork('drips');
  const drips = [], dots = [], cracks = [];
  for (const [x0, xs] of [[156, [-27, -9, 4, 22]], [244, [-24, -6, 13, 28]]]) {
    xs.forEach((dx, i) => {
      if (dr.chance(0.2)) return;
      const ang = Math.atan2(dx, 40);
      let p = [x0 + Math.sin(ang) * 40, 212 + Math.cos(ang) * 40];
      const pts = [p];
      const L = dr.range(14, 62);
      for (let k = 0; k < 4; k++) { p = [p[0] + dr.range(-3.5, 3.5), p[1] + L / 4]; pts.push(p); }
      drips.push({ poly: pts });
      dots.push({ dot: [p[0], p[1] + 2] });
      if (dr.chance(0.5)) {
        const q = pts[2], br = [q[0] + dr.sign() * dr.range(6, 12), q[1] + dr.range(4, 10)];
        cracks.push({ poly: [q, [(q[0] + br[0]) / 2, (q[1] + br[1]) / 2 - 1], br] });
      }
    });
  }
  for (let i = 0; i < 7; i++) {
    let p = [dr.range(122, 278), dr.range(140, 330)];
    if (Math.abs(p[0] - 200) < 22 && p[1] > 290) continue;
    const pts = [p];
    let a = dr.range(0, TAU);
    for (let k = 0; k < 5; k++) { a += dr.range(-1, 1); p = [p[0] + Math.cos(a) * 8, p[1] + Math.sin(a) * 8]; pts.push(p); }
    cracks.push({ poly: pts });
  }
  s += G_OPEN + render(drips, { c: '#a62f38', w: [3.8, 2.8], op: 0.85, split: 1, prec: 0, rng: dr });
  s += render(dots, { c: '#a62f38', w: 7, op: 0.9, split: 1, prec: 1, rng: dr });
  s += render(cracks, { c: '#c4364a', w: 2.2, op: 0.75, split: 1, prec: 0, rng: dr });
  // nose
  s += render([[[204, 236], [196, 258], [205, 278]]], { c: '#8a3a52', w: 3.6, op: 0.85, split: 1, prec: 1, rng: dr });
  s += render([[[188, 280], [194, 286], [200, 282]], [[208, 282], [214, 286], [219, 279]]], { c: '#8a3a52', w: 3.2, op: 0.8, split: 1, prec: 1, rng: dr });
  s += render([[[209, 240], [204, 256], [210, 270]]], { c: '#efeaf4', w: 4, op: 0.6, split: 1, prec: 1, rng: dr }) + '</g>';

  // ---- lips + yellow-green teeth -----------------------------------------------------------
  const tr = rng.fork('teeth');
  const teeth = new Shape(blobPoints(tr, { cx: 200, cy: 318, rx: 30, ry: 8, n: 8, jitter: 0.04 }));
  s += paint(cv, teeth, tr, { base: '#d6d66a', passes: [{ c: '#f4f0b0', w: 3, op: 0.7, sp: 5, len: [4, 8], angle: 90, follow: 0, band: 1 }] }).svg;
  s += lips(cv, rng.fork('lips'), {
    x: 200, y: 318, W: 88, H: 40, pal: {
      base: '#a62f38', mid: '#b8384a', dark: '#7a1a2a', deep: '#4a0c18', alt: '#7b3f9e',
      light: '#d4485a', pale: '#f48b8f', warm: '#fdf435', rim: '#3a0612', rim2: '#6e1424', rimDeep: '#2a0410', ink: '#2a0610',
    }, gap: 0.14, hl: 0.35,
  });

  // ---- glasses -------------------------------------------------------------------------------
  const gr = rng.fork('glasses');
  for (const [cx, k] of [[156, 'L'], [244, 'R']]) {
    const lens = new Shape(blobPoints(gr.fork('lens' + k), { cx, cy: 212, rx: 41, ry: 40, n: 10, jitter: 0.015, harmonics: [] }));
    s += paint(cv, lens, gr.fork('lp' + k), {
      base: '#53a0a7', angle: -72,
      passes: [
        { c: '#1b838c', w: 6, op: 0.6, sp: 11, len: [12, 24], follow: 0.3, band: 10, jitter: 8 },
        { c: '#fdf435', w: [7, 5], op: 0.8, sp: 10, len: [14, 30], follow: 0.3, band: 10, jitter: 8 },
        { c: '#c4d74a', w: 6, op: 0.6, sp: 14, len: [12, 26], follow: 0.3, band: 10, jitter: 8 },
        { c: '#88c6db', w: 6, op: 0.65, sp: 13, len: [12, 26], follow: 0.3, band: 10, jitter: 8 },
        { c: '#fff6e3', w: 4, op: 0.55, sp: 20, len: [8, 16], follow: 0.3, band: 10, jitter: 8 },
      ],
    }).svg;
    const c = [cx, 212];
    s += G_OPEN + render(arcs(gr, c, 42.5, 2, 0.01), { c: '#f48b8f', w: [9.5, 8], op: 0.95, split: 1, prec: 1, rng: gr });
    s += render(arcs(gr, c, 38, 2, 0.01), { c: '#e55666', w: 3, op: 0.8, split: 1, prec: 1, rng: gr });
    s += render([{ arc: { cx, cy: 212, r: 45.5, a0: -2.6, a1: -1.6 } }], { c: '#fff6e3', w: 3, op: 0.9, split: 1, prec: 1, rng: gr });
    s += render([[[cx - 22, 196], [cx - 16, 190], [cx - 8, 187]], { dot: [cx - 25, 206] }], { c: '#ffffff', w: [4.5, 3.5], op: 0.9, split: 1, prec: 1, rng: gr }) + '</g>';
  }
  s += G_OPEN + render([[[197, 206], [200, 198], [203, 206]]], { c: '#f48b8f', w: 7, op: 0.95, split: 1, prec: 1, rng: gr });
  s += render([[[114, 208], [104, 204], [94, 202]], [[286, 208], [296, 204], [306, 202]]], { c: '#f48b8f', w: 6, op: 0.9, split: 1, prec: 1, rng: gr }) + '</g>';

  const f = cv.paperFilter({ ...PAPER, seed: 101 });
  return cv.render(s, { filter: f });
}
