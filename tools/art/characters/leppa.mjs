// Leppa – fleshy coral trunk with muscle-like hatching, dominated by big violet lips,
// one small suspicious eye above (ref 1, bottom-left body).
import { Shape } from '../lib/shape.mjs';
import { paint, render, G_OPEN } from '../lib/pastel.mjs';
import { eye, socketWorld, EYE_LIME } from '../lib/eye.mjs';
import { blobPoints } from '../lib/geom.mjs';
import { Canvas } from '../lib/svg.mjs';
import { Rng } from '../lib/rng.mjs';
import { pastelSpec, PAPER } from '../lib/recipes.mjs';
import { lips } from '../lib/parts.mjs';

export const VIOLET_LIPS = {
  base: '#9a52b0', mid: '#b170b4', dark: '#7b3f9e', deep: '#5a2a80', alt: '#2e7ece',
  light: '#c99ad0', pale: '#ead0ee', warm: '#f48b8f', rim: '#4a1f6e', rim2: '#6a3592', rimDeep: '#3a1458', ink: '#2a0a3a',
};

export default function leppa() {
  const cv = new Canvas('leppa');
  const rng = new Rng('leppa');
  const trunk = new Shape(blobPoints(rng.fork('trunk'), {
    cx: 200, cy: 200, rx: 132, ry: 168, n: 12, rot: 0.08, jitter: 0.03,
    harmonics: [[2, 0.02], [3, 0.03]], shape: (t) => 1 + 0.05 * Math.sin(t),
  }));
  const E = {
    x: 206, y: 112, w: 120, rot: -6, hu: 0.17, hl: 0.12, gaze: [-0.72, 0.15], iris: 0.21, pupil: 0.42,
    socket: { rx: 1.08, ry: 0.84, dy: -0.06 }, lashes: { up: 7, down: 4, len: 0.12 }, crease: 0.14, lidW: 1.2,
    c: {
      ...EYE_LIME,
      blend: ['#ec6f78'],
      sclera: '#fff1d6', scleraLight: '#ffffff', scleraDark: '#e8b0a8', scleraHi: '#ffffff',
      iris: '#2e7ece', irisLight: '#88c6db', irisDark: '#1d3f9e', irisRing: '#2230c8', irisRingDark: '#141a7a', irisInner: '#c2e2ee',
      pupil: '#140f3a', pupilLight: '#2a2a9e',
    },
  };
  const er = rng.fork('eye');
  const sock = socketWorld(er, E);
  const lipZone = (p) => ((p[0] - 200) / 108) ** 2 + ((p[1] - 262) / 46) ** 2 < 1;
  const exclude = (p) => (sock.inside(p) && sock.nearest(p).d > 14) || lipZone(p);
  let s = paint(cv, trunk, rng.fork('paint'), pastelSpec({
    base: '#e55666', mid: '#ec6f78', dark: '#c23a4c', deep: '#a62f38', alt: '#b170b4',
    light: '#f48b8f', pale: '#f8c0c0', warm: '#f8852c',
    rim: '#8e2235', rim2: '#b0303f', rimDeep: '#6e1424',
  }, {
    exclude, angle: -84, follow: 0.55, band: 40, warmOp: 0.3,
    guides: [{ shape: sock, band: 22, w: 0.8 }],
    passesAfter: [
      // long muscle striations
      { c: '#a62f38', w: 3, op: 0.45, sp: 16, len: [30, 60], angle: -86, follow: 0.7, band: 50, jitter: 8, tone: [0, 0.6] },
      { c: '#f8c0c0', w: 3.2, op: 0.5, sp: 20, len: [26, 50], angle: -86, follow: 0.7, band: 50, jitter: 8, tone: [0.5, 1] },
    ],
    scratch: { n: 26, dots: 10, len: [10, 24], jitter: 10, depth: [0.05, 0.45] },
  })).svg;
  // chin folds under the lips
  const fr = rng.fork('folds');
  s += G_OPEN + render([
    [[150, 334], [200, 350], [252, 332]],
    [[170, 352], [205, 362], [240, 350]],
  ], { c: '#a62f38', w: [5, 3.5], op: 0.55, split: 1, prec: 1, rng: fr }) + '</g>';
  s += lips(cv, rng.fork('lips'), { x: 200, y: 262, W: 232, H: 118, rotDeg: -3, pal: VIOLET_LIPS, gap: 0.04, smile: 0.02 });
  s += eye(cv, er, E);
  const f = cv.paperFilter({ ...PAPER, seed: 41 });
  return cv.render(s, { filter: f });
}
