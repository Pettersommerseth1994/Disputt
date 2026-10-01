// Sky – pale-blue puffy cloud with one sleepy, droopy-lidded eye and a few rain drops.
import { Shape } from '../lib/shape.mjs';
import { paint, render, G_OPEN } from '../lib/pastel.mjs';
import { eye, socketWorld, drop, EYE_LIME } from '../lib/eye.mjs';
import { blobPoints } from '../lib/geom.mjs';
import { Canvas } from '../lib/svg.mjs';
import { Rng } from '../lib/rng.mjs';
import { pastelSpec, PAPER } from '../lib/recipes.mjs';

export default function sky() {
  const cv = new Canvas('sky');
  const rng = new Rng('sky');
  const br = rng.fork('cloud');
  const B = (cx, cy, rx, ry, k) => blobPoints(br.fork(k), { cx, cy, rx, ry, n: 10, jitter: 0.03, harmonics: [[2, 0.02], [3, 0.02]] });
  const cloud = new Shape([
    B(200, 226, 164, 70, 'base'),
    B(104, 184, 64, 62, 'l'),
    B(180, 132, 82, 78, 'm'),
    B(270, 146, 72, 68, 'r'),
    B(330, 200, 50, 48, 'rr'),
  ]);
  const E = {
    x: 202, y: 206, w: 196, rot: 2, hu: 0.06, hl: 0.17, gaze: [0.05, 0.45], iris: 0.2, pupil: 0.44,
    socket: { rx: 1.06, ry: 0.74, dy: -0.04 }, lashes: { up: 8, down: 4, len: 0.11 }, crease: 0.2, lidW: 1.45,
    c: {
      ...EYE_LIME,
      socket: '#b9a0d8', socketLight: '#e4daf2', socketDark: '#7b6fb8', socketAlt: '#d8a8d8',
      blend: ['#b8dbe8'],
      sclera: '#fff6e3', scleraLight: '#ffffff', scleraDark: '#c8c0dc', scleraHi: '#ffffff',
      iris: '#2e7ece', irisLight: '#88c6db', irisDark: '#1d3f9e', irisRing: '#2230c8', irisRingDark: '#141a7a', irisInner: '#c2e2ee',
      pupil: '#140f3a', pupilLight: '#2a2a9e',
      lashLine: '#3a3a9e', lashInk: '#1c1450', lash: '#2e5fae', lash2: '#3a3a9e', lowerLine: '#8a7ab8', water: '#efe8f8', lidShadow: '#7b6fb8',
    },
  };
  const er = rng.fork('eye');
  const sock = socketWorld(er, E);
  const exclude = (p) => sock.inside(p) && sock.nearest(p).d > 16;
  let s = '';
  // rain first (drops hang below the cloud)
  const rr = rng.fork('rain');
  const dc = { base: '#88c6db', light: '#e3f3f7', dark: '#2e7ece', rim: '#2230c8' };
  s += drop(cv, rr.fork('a'), 116, 340, 14, dc);
  s += drop(cv, rr.fork('b'), 206, 360, 15, dc);
  s += drop(cv, rr.fork('c'), 292, 336, 12, dc);
  s += G_OPEN + render([
    [[154, 312], [151, 324], [148, 338]], [[250, 318], [247, 332], [244, 348]], [[332, 296], [330, 306], [327, 318]], [[78, 300], [76, 309], [74, 318]],
  ], { c: '#2e7ece', w: [4.4, 3.4], op: 0.85, split: 1, prec: 1, rng: rr }) + '</g>';
  s += paint(cv, cloud, rng.fork('paint'), pastelSpec({
    base: '#a9d4e4', mid: '#b8dbe8', dark: '#6fa9cc', deep: '#3f7fbf', alt: '#b170b4',
    light: '#d6ecf3', pale: '#f2f9fb', warm: '#fff6e3',
    rim: '#2e5f9e', rim2: '#4a86c4', rimDeep: '#1d3f7e',
  }, { exclude, guides: [{ shape: sock, band: 26, w: 0.8 }], follow: 1, band: 70, altOp: 0.3, warmOp: 0.45, scratch: { n: 18, dots: 8 } })).svg;
  // soft seams between the puffs
  const sr = rng.fork('seams');
  const seams = cloudSeams(cloud, sr);
  s += G_OPEN + render(seams, { c: '#6fa9cc', w: [5, 3.5], op: 0.45, split: 1, prec: 1, rng: sr }) + '</g>';
  s += eye(cv, er, E);
  const f = cv.paperFilter({ ...PAPER, seed: 61 });
  return cv.render(s, { filter: f });
}

import { rim } from '../lib/pastel.mjs';
function cloudSeams(sh, rng) {
  // strokes along the parts of each puff outline that lie inside the cloud (upper halves only)
  const out = rim(sh, rng, { runs: sh.inner, len: [14, 30], inset: [0, 3], prob: 0.75, where: (p) => p[1] < 215 });
  return out;
}
