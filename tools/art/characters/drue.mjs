// Drue – violet/mauve grape cluster with THREE eyes (big, medium, tiny), each looking elsewhere.
import { Shape } from '../lib/shape.mjs';
import { paint, render, rim, scratches, G_OPEN } from '../lib/pastel.mjs';
import { eye, socketWorld, EYE_LIME } from '../lib/eye.mjs';
import { blobPoints } from '../lib/geom.mjs';
import { Canvas } from '../lib/svg.mjs';
import { Rng } from '../lib/rng.mjs';
import { pastelSpec, PAPER } from '../lib/recipes.mjs';
import { tube, curl, STEM } from '../lib/parts.mjs';

const LOBES = [
  [128, 150, 72], [212, 122, 76], [292, 158, 70],
  [162, 238, 82], [262, 244, 78], [210, 306, 64], [206, 206, 96],
];
const EYE_D = {
  ...EYE_LIME,
  socket: '#f48b8f', socketLight: '#f9c6d0', socketDark: '#c8508a', socketAlt: '#e7a0d8',
  blend: ['#b170b4'],
  sclera: '#fdf08a', scleraLight: '#fffbd0', scleraDark: '#e8c23a', scleraHi: '#fffef0',
  lashLine: '#3a1458', lashInk: '#200830', lash: '#3a3a9e', lash2: '#3a3a9e', lowerLine: '#c8508a', water: '#fde4ee', lidShadow: '#b8457a',
};

export default function drue() {
  const cv = new Canvas('drue');
  const rng = new Rng('drue');
  const lr = rng.fork('lobes');
  const cluster = new Shape(LOBES.map(([cx, cy, r], i) => blobPoints(lr.fork('l' + i), { cx, cy, rx: r, ry: r * 0.97, n: 9, jitter: 0.03, harmonics: [[2, 0.02]] })));
  const eyes = [
    { x: 182, y: 220, w: 136, rot: -3, hu: 0.3, hl: 0.22, gaze: [0.05, 0.1], iris: 0.21, pupil: 0.44, socket: { rx: 1.08, ry: 0.92, dy: -0.07 }, lashes: { up: 8, down: 5, len: 0.13 },
      c: { ...EYE_D, iris: '#55b23a', irisLight: '#d4e65a', irisDark: '#2a7a3a', irisRing: '#2e7ece', irisRingDark: '#2230c8', irisInner: '#e8ef8a' } },
    { x: 288, y: 160, w: 90, rot: 14, hu: 0.3, hl: 0.24, gaze: [-0.55, -0.45], iris: 0.21, pupil: 0.42, socket: { rx: 1.08, ry: 0.94, dy: -0.07 }, lashes: { up: 6, down: 3, len: 0.13 },
      c: { ...EYE_D, iris: '#f8852c', irisLight: '#fdd27a', irisDark: '#c4452a', irisRing: '#a62f38', irisRingDark: '#6e1424', irisInner: '#fff2a0', pupil: '#2a0a3a' } },
    { x: 262, y: 300, w: 62, rot: -10, hu: 0.16, hl: 0.17, gaze: [0.8, 0.2], iris: 0.22, pupil: 0.44, socket: { rx: 1.1, ry: 0.85, dy: -0.04 }, lashes: { up: 5, down: 0, len: 0.14 }, lidW: 1.3, crease: 0.16,
      c: { ...EYE_D, iris: '#88c6db', irisLight: '#e3f3f7', irisDark: '#2e7ece', irisRing: '#2230c8', irisRingDark: '#141a7a', irisInner: '#e8f6fa' } },
  ];
  const ers = eyes.map((_, i) => rng.fork('eye' + i));
  const socks = eyes.map((e, i) => socketWorld(ers[i], e));
  const exclude = (p) => socks.some((sk) => sk.inside(p) && sk.nearest(p).d > 12);
  let s = '';
  s += tube(cv, rng.fork('stem'), { spine: [[212, 62], [216, 44], [226, 26]], r: 7.5 }).svg;
  const tr = rng.fork('tendril');
  s += G_OPEN + render([curl([246, 40], 14, 1.4, 3.2, -1)], { c: '#7f8e33', w: 3.6, op: 0.9, split: 1, prec: 1, rng: tr }) + '</g>';
  s += paint(cv, cluster, rng.fork('paint'), pastelSpec({
    base: '#9a5aae', mid: '#b170b4', dark: '#7b3f9e', deep: '#5a2a80', alt: '#2e7ece',
    light: '#c99ad0', pale: '#e8c8ec', warm: '#f48b8f',
    rim: '#3e1460', rim2: '#6a3592', rimDeep: '#2a0a44',
  }, { exclude, guides: socks.map((sk) => ({ shape: sk, band: 20, w: 0.8 })), follow: 1, band: 40, scratch: false })).svg;
  // grape seams + a highlight on every grape
  const gr = rng.fork('grapes');
  const seams = rim(cluster, gr, { runs: cluster.inner, len: [14, 32], inset: [0, 3], prob: 0.9 });
  s += G_OPEN + render(seams, { c: '#5a2a80', w: [5.5, 4], op: 0.6, split: 1, prec: 1, rng: gr });
  const hl = [];
  LOBES.slice(0, 6).forEach(([cx, cy, r]) => {
    const a = -2.3 + gr.range(-0.2, 0.2);
    const p = [cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62];
    if (exclude(p)) return;
    const d = [Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2)];
    hl.push([[p[0] - d[0] * 7, p[1] - d[1] * 7], p, [p[0] + d[0] * 7, p[1] + d[1] * 7]]);
    hl.push({ dot: [p[0] + d[0] * 13 + 3, p[1] + d[1] * 13 + 3] });
  });
  s += render(hl, { c: '#fffaf0', w: [4.6, 3.4], op: 0.92, split: 1, prec: 1, rng: gr });
  s += render(scratches(cluster, gr.fork('s'), { n: 10, dots: 8, depth: [0.05, 0.35], exclude, minGap: 14 }), { c: '#fffaf0', w: [4, 3], op: 0.88, split: 1, prec: 1, rng: gr }) + '</g>';
  eyes.forEach((e, i) => { s += eye(cv, ers[i], e); });
  const f = cv.paperFilter({ ...PAPER, seed: 91 });
  return cv.render(s, { filter: f });
}
