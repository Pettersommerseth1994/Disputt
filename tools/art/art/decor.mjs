// Decorative bits: crown, lips, star, sparkle, six sticker blobs, cream scribbles.
import { Shape } from '../lib/shape.mjs';
import { paint, render, G_OPEN } from '../lib/pastel.mjs';
import { blobPoints, ellipsePoints, TAU } from '../lib/geom.mjs';
import { Canvas } from '../lib/svg.mjs';
import { Rng } from '../lib/rng.mjs';
import { pastelSpec, PAPER } from '../lib/recipes.mjs';
import { lips, sparklePts } from '../lib/parts.mjs';
import { VIOLET_LIPS } from '../characters/leppa.mjs';

const GOLD = {
  base: '#fae025', mid: '#fdf435', dark: '#f8b42a', deep: '#f8852c', alt: '#e55666',
  light: '#fff27a', pale: '#fffbd0', rim: '#c4452a', rim2: '#f8852c', rimDeep: '#a62f38',
};

function jewel(cv, rng, cx, cy, r, pal) {
  const sh = new Shape(blobPoints(rng, { cx, cy, rx: r, ry: r * 0.92, n: 8, jitter: 0.04, harmonics: [] }));
  return paint(cv, sh, rng, pastelSpec(pal, {
    sc: Math.max(0.3, r / 40), follow: 1, band: 99,
    scratch: { n: 1, dots: 1, depth: [0.25, 0.6], lit: 1, len: [r * 0.35, r * 0.6], w: [Math.max(2.4, r * 0.2)], minGap: 2 },
  })).svg;
}

export function crown() {
  const cv = new Canvas('crown', 400, 240);
  const rng = new Rng('crown');
  const pts = [[54, 210], [50, 150], [36, 52], [122, 120], [200, 26], [278, 120], [364, 52], [350, 150], [346, 210], [200, 220]];
  const sh = new Shape(pts, { tension: 0.55 });
  let s = paint(cv, sh, rng.fork('body'), pastelSpec(GOLD, { angle: -60, follow: 0.9, band: 30, sc: 0.85, scratch: { n: 14, dots: 6 } })).svg;
  // band line + jewels
  const br = rng.fork('band');
  s += G_OPEN + render([[[56, 152], [200, 160], [346, 152]], [[58, 162], [200, 170], [344, 162]]], { c: '#f8852c', w: [6, 4], op: 0.75, split: 1, prec: 1, rng: br }) + '</g>';
  const PINK = { base: '#f48b8f', mid: '#f6a0a4', dark: '#e55666', light: '#f9c6cc', pale: '#fde4e6', rim: '#a62f38', rim2: '#c4364a' };
  const ORANGE = { base: '#f8852c', mid: '#fa9a3a', dark: '#e0622a', light: '#fbb04a', pale: '#fdd27a', rim: '#a62f38', rim2: '#c43d2a' };
  s += jewel(cv, br.fork('j1'), 112, 188, 15, PINK);
  s += jewel(cv, br.fork('j2'), 200, 190, 20, ORANGE);
  s += jewel(cv, br.fork('j3'), 288, 188, 15, PINK);
  s += jewel(cv, br.fork('t1'), 40, 50, 13, PINK);
  s += jewel(cv, br.fork('t2'), 200, 24, 15, ORANGE);
  s += jewel(cv, br.fork('t3'), 360, 50, 13, PINK);
  const f = cv.paperFilter({ ...PAPER, seed: 301 });
  return cv.render(s, { filter: f });
}

export function lipsArt() {
  const cv = new Canvas('lips', 400, 260);
  const rng = new Rng('lips-art');
  const s = lips(cv, rng, { x: 200, y: 134, W: 356, H: 196, rotDeg: -2, pal: VIOLET_LIPS, gap: 0.04, smile: 0.03 });
  const f = cv.paperFilter({ ...PAPER, seed: 311 });
  return cv.render(s, { filter: f });
}

export function star() {
  const cv = new Canvas('star', 200, 200);
  const rng = new Rng('star');
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * TAU + rng.range(-0.04, 0.04);
    const r = i % 2 === 0 ? 90 * rng.range(0.95, 1.03) : 40;
    pts.push([100 + Math.cos(a) * r, 106 + Math.sin(a) * r]);
  }
  const sh = new Shape(pts, { tension: 0.5 });
  const s = paint(cv, sh, rng.fork('p'), pastelSpec({
    base: '#fdf435', mid: '#fae025', dark: '#f8c42a', deep: '#f8a42c', light: '#fff6c0', pale: '#fffbe6',
    rim: '#e0622a', rim2: '#f8a42c', rimDeep: '#c4452a',
  }, { sc: 0.55, follow: 1, band: 99, scratch: { n: 6, dots: 3, len: [5, 10] } })).svg;
  const f = cv.paperFilter({ ...PAPER, seed: 321 });
  return cv.render(s, { filter: f });
}

export function sparkle() {
  const cv = new Canvas('sparkle', 200, 200);
  const rng = new Rng('sparkle');
  const sh = new Shape(sparklePts(100, 100, 92, 0.22, 0), { tension: 0.5 });
  const s = paint(cv, sh, rng.fork('p'), pastelSpec({
    base: '#fff6e3', mid: '#fffbe6', dark: '#fde05a', deep: '#fac53a', light: '#ffffff', pale: '#ffffff',
    rim: '#f8a42c', rim2: '#fde05a', rimDeep: '#f8852c',
  }, { sc: 0.5, follow: 1, band: 99, toneK: { depthW: 0.8, litW: 0.1, base: 0.1 }, scratch: false })).svg;
  const f = cv.paperFilter({ ...PAPER, seed: 331, speckColor: '#fdf435', speckA: 0.5 });
  return cv.render(s, { filter: f });
}

const BLOBS = [
  ['blob-1', { base: '#fae025', mid: '#fdf435', dark: '#f8c42a', deep: '#f8a42c', alt: '#f8852c', light: '#fdf6a0', pale: '#fffbe0', warm: '#ffffff', rim: '#e0762a', rim2: '#f8b42a', rimDeep: '#c4452a' }],
  ['blob-2', { base: '#7eba2d', mid: '#8cc63a', dark: '#4f9a24', deep: '#2e7a2a', alt: '#1b838c', light: '#c4d74a', pale: '#eef3a0', warm: '#fae54f', rim: '#2b6e1e', rim2: '#3f8a22', rimDeep: '#1f5a1a' }],
  ['blob-3', { base: '#f8852c', mid: '#fa9a3a', dark: '#e0622a', deep: '#c43d2a', alt: '#e55666', light: '#fbb04a', pale: '#fdd27a', warm: '#fae54f', rim: '#b8321f', rim2: '#d4552a', rimDeep: '#8e2420' }],
  ['blob-4', { base: '#f48b8f', mid: '#f6a0a4', dark: '#e55666', deep: '#c4364a', alt: '#b170b4', light: '#f9c6cc', pale: '#fde4e6', warm: '#fdd27a', rim: '#a62f38', rim2: '#d04a5a', rimDeep: '#7e1f2c' }],
  ['blob-5', { base: '#9a5aae', mid: '#b170b4', dark: '#7b3f9e', deep: '#5a2a80', alt: '#2e7ece', light: '#c99ad0', pale: '#e8c8ec', warm: '#f48b8f', rim: '#3e1460', rim2: '#6a3592', rimDeep: '#2a0a44' }],
  ['blob-6', { base: '#88c6db', mid: '#9ad0e2', dark: '#53a0c0', deep: '#2e7ece', alt: '#b170b4', light: '#c2e2ee', pale: '#e8f6fa', warm: '#fff6e3', rim: '#2e5f9e', rim2: '#4a86c4', rimDeep: '#1d3f7e' }],
];

export const blobs = Object.fromEntries(BLOBS.map(([id, pal], i) => [id, () => {
  const cv = new Canvas(id, 400, 400);
  const rng = new Rng(id);
  const sh = new Shape(blobPoints(rng.fork('shape'), {
    cx: 200, cy: 200, rx: 168 - (i % 3) * 6, ry: 160 + (i % 2) * 8, n: 10 + (i % 3), rot: rng.range(-0.5, 0.5), jitter: 0.05,
    harmonics: [[2, 0.05 + 0.02 * (i % 2)], [3, 0.05], [5, 0.02]],
  }));
  const s = paint(cv, sh, rng.fork('p'), pastelSpec(pal, { angle: -38 + i * 7, follow: 0.85, scratch: { n: 18, dots: 8 } })).svg;
  const f = cv.paperFilter({ ...PAPER, seed: 401 + i * 10 });
  return cv.render(s, { filter: f });
}]));

const CREAM = '#fff6e3';
const SCRIBBLE_PAPER = { ...PAPER, speckA: 0, knock: [0.3, 0.36], fuzz: 2 };

export function scribbleUnderline() {
  const cv = new Canvas('scribble-underline', 400, 40);
  const rng = new Rng('scribble-underline');
  const line = (y0, y1, x0, x1, amp, n) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI * 2.2 + 0.4) * amp + rng.range(-0.6, 0.6)]);
    }
    return { poly: pts };
  };
  let s = G_OPEN;
  s += render([line(25, 19, 12, 384, 3, 16)], { c: CREAM, w: 8, op: 0.95, split: 1, prec: 1, rng });
  s += render([line(29, 23, 40, 362, 2.4, 14)], { c: CREAM, w: 4.5, op: 0.8, split: 1, prec: 1, rng });
  s += render([[[352, 22], [372, 14], [388, 9]]], { c: CREAM, w: 5.5, op: 0.85, split: 1, prec: 1, rng });
  s += '</g>';
  const f = cv.paperFilter({ ...SCRIBBLE_PAPER, seed: 501 });
  return cv.render(s, { filter: f });
}

export function scribbleCircle() {
  const cv = new Canvas('scribble-circle', 400, 400);
  const rng = new Rng('scribble-circle');
  const ring = (rx, ry, a0, turns, n, drift) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = a0 + t * turns * TAU;
      const k = 1 + 0.035 * Math.sin(3 * a + 1) + drift * t;
      pts.push([200 + Math.cos(a) * rx * k, 204 + Math.sin(a) * ry * k]);
    }
    return { poly: pts };
  };
  let s = G_OPEN;
  s += render([ring(168, 150, -2.2, 1.12, 64, 0.06)], { c: CREAM, w: 9, op: 0.95, split: 1, prec: 1, rng });
  s += render([ring(160, 144, -1.4, 0.55, 30, 0.03)], { c: CREAM, w: 5, op: 0.75, split: 1, prec: 1, rng });
  s += '</g>';
  const f = cv.paperFilter({ ...SCRIBBLE_PAPER, seed: 511 });
  return cv.render(s, { filter: f });
}
