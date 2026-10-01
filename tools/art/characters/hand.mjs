// Hånda – surreal pale-pink/peach hand with five stubby sausage fingers, crimson rim,
// and a big blue-green eye in the palm.
import { Shape } from '../lib/shape.mjs';
import { paint, render, G_OPEN } from '../lib/pastel.mjs';
import { eye, socketWorld, EYE_LIME } from '../lib/eye.mjs';
import { blobPoints, tubePoints, alongPoly, sub, norm, perp, add, mul, lerpP, sampleSmooth } from '../lib/geom.mjs';
import { Canvas } from '../lib/svg.mjs';
import { Rng } from '../lib/rng.mjs';
import { pastelSpec, PAPER } from '../lib/recipes.mjs';

const DX = 12;
const FINGERS0 = [
  { spine: [[114, 290], [80, 252], [60, 208]], r: [26, 21] }, // thumb
  { spine: [[142, 196], [130, 132], [120, 80]], r: [24, 21] },
  { spine: [[194, 184], [192, 114], [190, 62]], r: [25, 22] },
  { spine: [[244, 190], [254, 128], [264, 80]], r: [24, 21] },
  { spine: [[284, 222], [304, 172], [318, 132]], r: [21, 18] }, // pinky
];
const FINGERS = FINGERS0.map((f) => ({ ...f, spine: f.spine.map(([x, y]) => [x + DX, y]) }));

export default function hand() {
  const cv = new Canvas('hand');
  const rng = new Rng('hand');
  const fr = rng.fork('fingers');
  const parts = [
    blobPoints(rng.fork('palm'), { cx: 200 + DX, cy: 256, rx: 110, ry: 104, n: 12, jitter: 0.03 }),
    blobPoints(rng.fork('wrist'), { cx: 200 + DX, cy: 330, rx: 72, ry: 46, n: 10, jitter: 0.03 }),
    ...FINGERS.map((f) => {
      const sp = sampleSmooth(f.spine, { closed: false, step: 6 });
      return tubePoints(sp, (t) => f.r[0] + (f.r[1] - f.r[0]) * t, { step: 22, capSteps: 4 }).map((p) => [p[0] + fr.range(-1.2, 1.2), p[1] + fr.range(-1.2, 1.2)]);
    }),
  ];
  const hand = new Shape(parts);
  const E = {
    x: 200 + DX, y: 262, w: 150, rot: -3, hu: 0.3, hl: 0.22, gaze: [0.02, 0.06], iris: 0.22, pupil: 0.42,
    socket: { rx: 1.1, ry: 0.94, dy: -0.07 }, lashes: { up: 8, down: 5, len: 0.13 }, crease: 0.12,
    c: {
      ...EYE_LIME,
      socket: '#e98a9a', socketLight: '#fbd0d4', socketDark: '#b8456a', socketAlt: '#d79ad0',
      blend: ['#f6c4b4'],
      sclera: '#fff6e3', scleraLight: '#ffffff', scleraDark: '#f0c3c5', scleraHi: '#ffffff',
      iris: '#2aa0a8', irisLight: '#c4d74a', irisDark: '#126a72', irisRing: '#2e7ece', irisRingDark: '#2230c8', irisInner: '#e2ee8a',
      pupil: '#140f3a', pupilLight: '#2a2a9e',
      lashLine: '#2a2a9e', lashInk: '#1c0a30', lash: '#2e7ece', lash2: '#2230c8', lowerLine: '#b8456a', water: '#fde4e6', lidShadow: '#b8456a',
    },
  };
  const er = rng.fork('eye');
  const sock = socketWorld(er, E);
  const exclude = (p) => sock.inside(p) && sock.nearest(p).d > 14;
  let s = paint(cv, hand, rng.fork('paint'), pastelSpec({
    base: '#f4b8a8', mid: '#f6c4b4', dark: '#e8907e', deep: '#d06a62', alt: '#b170b4',
    light: '#fbd8c8', pale: '#fff0e4', warm: '#fdd8a0',
    rim: '#a62f38', rim2: '#d06a62', rimDeep: '#7e1f2c',
  }, { exclude, guides: [{ shape: sock, band: 24, w: 0.8 }], follow: 1, band: 40, scratch: { n: 22, dots: 9 } })).svg;

  // knuckle creases + nails
  const kr = rng.fork('knuckles');
  const creases = [], nails = [], nailHi = [];
  FINGERS.forEach((f, i) => {
    const sp = sampleSmooth(f.spine, { closed: false, step: 6 });
    for (const u of i === 0 ? [0.45] : [0.42, 0.7]) {
      const { p, t } = alongPoly(sp, u);
      const n = perp(t);
      const r = (f.r[0] + (f.r[1] - f.r[0]) * u) * 0.62;
      creases.push([add(p, mul(n, -r)), add(add(p, mul(t, 3)), mul(n, 0)), add(p, mul(n, r))]);
    }
    const tip = alongPoly(sp, 0.86);
    const n = perp(tip.t);
    const r = f.r[1];
    const a = add(tip.p, mul(tip.t, -r * 0.35)), b = add(tip.p, mul(tip.t, r * 0.25));
    nails.push([a, lerpP(a, b, 0.5), b]);
    nailHi.push([add(a, mul(n, -r * 0.18)), add(lerpP(a, b, 0.5), mul(n, -r * 0.2)), add(b, mul(n, -r * 0.16))]);
  });
  s += G_OPEN + render(creases, { c: '#c4485a', w: [3.6, 2.8], op: 0.6, split: 1, prec: 1, rng: kr });
  s += render(nails, { c: '#d06a62', w: 17, op: 0.55, split: 1, prec: 1, rng: kr });
  s += render(nails, { c: '#fde8e4', w: 13, op: 0.85, split: 1, prec: 1, rng: kr });
  s += render(nailHi, { c: '#ffffff', w: 3.2, op: 0.9, split: 1, prec: 1, rng: kr }) + '</g>';
  s += eye(cv, er, E);
  const f = cv.paperFilter({ ...PAPER, seed: 81 });
  return cv.render(s, { filter: f });
}
