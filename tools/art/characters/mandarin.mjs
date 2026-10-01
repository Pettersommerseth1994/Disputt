// Mandarin – orange blob with a leaf; one suspicious eye glancing sideways (ref 1, top-right).
import { Shape } from '../lib/shape.mjs';
import { paint, render, G_OPEN, scratches } from '../lib/pastel.mjs';
import { eye, socketWorld, EYE_LIME } from '../lib/eye.mjs';
import { blobPoints, TAU } from '../lib/geom.mjs';
import { Canvas } from '../lib/svg.mjs';
import { Rng } from '../lib/rng.mjs';
import { pastelSpec, PAPER } from '../lib/recipes.mjs';
import { leaf, tube, GREEN } from '../lib/parts.mjs';

export default function mandarin() {
  const cv = new Canvas('mandarin');
  const rng = new Rng('mandarin');
  const dent = (t) => {
    const d = Math.atan2(Math.sin(t + Math.PI / 2), Math.cos(t + Math.PI / 2));
    return 1 - 0.06 * Math.exp(-(d * d) / 0.06);
  };
  const body = new Shape(blobPoints(rng.fork('body'), {
    cx: 200, cy: 234, rx: 166, ry: 142, n: 14, jitter: 0.025, harmonics: [[2, 0.02], [3, 0.025]], shape: dent, start: -Math.PI / 2,
  }));
  const E = {
    x: 198, y: 234, w: 216, rot: 11, hu: 0.25, hl: 0.19, gaze: [0.8, 0.32], iris: 0.18, pupil: 0.42, peak: 0.2,
    socket: { rx: 1.02, ry: 0.86, dy: -0.04 }, lashes: { up: 0, down: 0, len: 0.08 }, crease: 0.16, lidW: 1.5,
    c: {
      ...EYE_LIME,
      socket: '#e8604a', socketLight: '#fbb08a', socketDark: '#a62f38', socketAlt: '#f48b8f',
      blend: ['#fa9a3a'],
      sclera: '#fde54a', scleraLight: '#fff59a', scleraDark: '#e8a62a', scleraHi: '#fffbe0',
      iris: '#5aae35', irisLight: '#c4d74a', irisDark: '#2a7a3a', irisRing: '#2f8a3a', irisRingDark: '#1f5a2a', irisInner: '#e2ee8a',
      pupil: '#3a1a6e', pupilLight: '#7b3f9e',
      lashLine: '#7e1f2c', lashInk: '#4a0c18', lash: '#a62f38', lash2: '#a62f38', lowerLine: '#c4364a', water: '#f8b0a0', lidShadow: '#a62f38',
    },
  };
  const er = rng.fork('eye');
  const sock = socketWorld(er, E);
  const exclude = (p) => sock.inside(p) && sock.nearest(p).d > 20;
  let s = '';
  // stem + leaf behind the body top
  s += tube(cv, rng.fork('stem'), { spine: [[202, 106], [206, 82], [213, 62]], r: 8 }).svg;
  s += leaf(cv, rng.fork('leaf'), { B: [211, 78], T: [306, 56], width: 54, pal: GREEN, bend: -0.1 });
  s += paint(cv, body, rng.fork('paint'), pastelSpec({
    base: '#f8852c', mid: '#fa9a3a', dark: '#e0622a', deep: '#c43d2a', alt: '#e55666',
    light: '#fbb04a', pale: '#fdd27a', warm: '#fae54f',
    rim: '#b8321f', rim2: '#d4552a', rimDeep: '#8e2420',
  }, { exclude, guides: [{ shape: sock, band: 30, w: 0.9 }], scratch: { n: 24, dots: 10 } })).svg;
  // peel pores
  const pr = rng.fork('pores');
  const pores = scratches(body, pr, { n: 0, dots: 46, depth: [0.06, 0.55], lit: 0, exclude, minGap: 12 });
  s += G_OPEN + render(pores, { c: '#c94a24', w: [3.6, 2.8], op: 0.55, split: 1, prec: 1, rng: pr }) + '</g>';
  s += eye(cv, er, E);
  const f = cv.paperFilter({ ...PAPER, seed: 21 });
  return cv.render(s, { filter: f });
}
