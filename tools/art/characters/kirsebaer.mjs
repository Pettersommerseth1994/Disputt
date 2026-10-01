// Kirsebær – two crimson/coral cherries on a shared stem with a leaf. The left one is startled,
// the right one side-eyes it.
import { Shape } from '../lib/shape.mjs';
import { paint, render, G_OPEN } from '../lib/pastel.mjs';
import { eye, socketWorld, EYE_LIME } from '../lib/eye.mjs';
import { blobPoints } from '../lib/geom.mjs';
import { Canvas } from '../lib/svg.mjs';
import { Rng } from '../lib/rng.mjs';
import { pastelSpec, PAPER } from '../lib/recipes.mjs';
import { leaf, tube, GREEN, STEM } from '../lib/parts.mjs';

const CHERRY = {
  base: '#d63a4a', mid: '#e04a58', dark: '#a62f38', deep: '#7e1f2c', alt: '#7b3f9e',
  light: '#e55666', pale: '#f48b8f', warm: '#f8852c', rim: '#5e1020', rim2: '#8e2235', rimDeep: '#40081a',
};
const EYE_C = {
  ...EYE_LIME,
  socket: '#f48b8f', socketLight: '#f9c6cc', socketDark: '#c23a5a', socketAlt: '#f0c3c5',
  blend: ['#e04a58'],
  sclera: '#fff6e3', scleraLight: '#ffffff', scleraDark: '#f0c3c5', scleraHi: '#ffffff',
  iris: '#7eba2d', irisLight: '#c4d74a', irisDark: '#3f7f2a', irisRing: '#2b6e1e', irisRingDark: '#1f5a1a', irisInner: '#e2ee8a',
  pupil: '#1c0a10', pupilLight: '#4a1f3a',
  lashLine: '#5e1020', lashInk: '#30060f', lash: '#7e1f2c', lash2: '#7e1f2c', lowerLine: '#c23a5a', water: '#fde4e6', lidShadow: '#c23a5a',
};

export default function kirsebaer() {
  const cv = new Canvas('kirsebaer');
  const rng = new Rng('kirsebaer');
  let s = '';
  // stems + leaf (behind the fruit)
  s += tube(cv, rng.fork('stemL'), { spine: [[154, 182], [178, 116], [236, 54]], r: 7, pal: { ...STEM, base: '#6f8a2a', mid: '#86a033' } }).svg;
  s += tube(cv, rng.fork('stemR'), { spine: [[268, 166], [258, 108], [240, 54]], r: 6.5, pal: { ...STEM, base: '#6f8a2a', mid: '#86a033' } }).svg;
  s += leaf(cv, rng.fork('leaf'), { B: [240, 56], T: [344, 92], width: 54, pal: GREEN, bend: 0.1 });

  const EL = {
    x: 144, y: 276, w: 126, rot: -4, hu: 0.34, hl: 0.28, gaze: [0.12, -0.08], iris: 0.2, pupil: 0.3,
    socket: { rx: 1.08, ry: 0.98, dy: -0.08 }, lashes: { up: 8, down: 5, len: 0.14 }, crease: 0.1, c: EYE_C,
  };
  const ER = {
    x: 274, y: 250, w: 112, rot: 6, hu: 0.14, hl: 0.14, gaze: [-0.86, 0.15], iris: 0.19, pupil: 0.42,
    socket: { rx: 1.05, ry: 0.72, dy: -0.03 }, lashes: { up: 6, down: 3, len: 0.12 }, crease: 0.16, lidW: 1.3, c: EYE_C,
  };
  const erL = rng.fork('eyeL'), erR = rng.fork('eyeR');
  const sL = socketWorld(erL, EL), sR = socketWorld(erR, ER);
  // right cherry (behind)
  const cR = new Shape(blobPoints(rng.fork('cR'), { cx: 272, cy: 246, rx: 88, ry: 86, n: 11, jitter: 0.03 }));
  s += paint(cv, cR, rng.fork('pR'), pastelSpec(CHERRY, {
    exclude: (p) => sR.inside(p) && sR.nearest(p).d > 14, guides: [{ shape: sR, band: 24, w: 0.8 }], follow: 1, band: 80, density: 0.8,
    scratch: { n: 14, dots: 6 },
  })).svg;
  s += cherryDimple(rng.fork('dR'), 268, 166, 0.85);
  s += eye(cv, erR, ER);
  // left cherry (front)
  const cL = new Shape(blobPoints(rng.fork('cL'), { cx: 146, cy: 268, rx: 97, ry: 94, n: 11, jitter: 0.03 }));
  s += paint(cv, cL, rng.fork('pL'), pastelSpec(CHERRY, {
    exclude: (p) => sL.inside(p) && sL.nearest(p).d > 14, guides: [{ shape: sL, band: 24, w: 0.8 }], follow: 1, band: 80, density: 0.8,
    scratch: { n: 16, dots: 7 },
  })).svg;
  s += cherryDimple(rng.fork('dL'), 154, 180, 0.95);
  s += eye(cv, erL, EL);
  const f = cv.paperFilter({ ...PAPER, seed: 71 });
  return cv.render(s, { filter: f });
}

function cherryDimple(rng, x, y, k) {
  return G_OPEN + render([[[x - 16 * k, y + 2], [x, y + 9 * k], [x + 15 * k, y + 1]]], { c: '#5e1020', w: 5, op: 0.75, split: 1, prec: 1, rng }) +
    render([[[x - 12 * k, y + 10 * k], [x, y + 15 * k], [x + 10 * k, y + 9 * k]]], { c: '#f48b8f', w: 3, op: 0.6, split: 1, prec: 1, rng }) + '</g>';
}
