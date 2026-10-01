// Sol – sunny yellow-orange disc with stubby crayon rays and one big startled cyan eye
// with orange lids. Strong crimson rim so it reads on the yellow tile.
import { Shape } from '../lib/shape.mjs';
import { paint } from '../lib/pastel.mjs';
import { eye, socketWorld, EYE_LIME } from '../lib/eye.mjs';
import { blobPoints, TAU } from '../lib/geom.mjs';
import { Canvas } from '../lib/svg.mjs';
import { Rng } from '../lib/rng.mjs';
import { pastelSpec, PAPER } from '../lib/recipes.mjs';

export default function sol() {
  const cv = new Canvas('sol');
  const rng = new Rng('sol');
  const C = [200, 202];
  // rays: one multi-part shape (one clip, one rim pass)
  const rr = rng.fork('rays');
  const rays = [];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * TAU + rr.range(-0.04, 0.04);
    const tip = (i % 2 ? 160 : 178) + rr.range(-5, 5);
    const da = 0.2;
    const P = (r, aa) => [C[0] + Math.cos(aa) * r, C[1] + Math.sin(aa) * r];
    rays.push([P(96, a - da), P((96 + tip) / 2, a - da * 0.55), P(tip - 9, a - 0.07), P(tip + 2, a), P(tip - 9, a + 0.07), P((96 + tip) / 2, a + da * 0.55), P(96, a + da)]);
  }
  const rayShape = new Shape(rays);
  let s = paint(cv, rayShape, rr, pastelSpec({
    base: '#f8852c', mid: '#fa9a3a', dark: '#e0622a', light: '#fbb04a', pale: '#fdd27a',
    rim: '#a62f38', rim2: '#d4452a', rimDeep: '#7a1f2a',
  }, { sc: 0.55, follow: 1, band: 99, scratch: { n: 12, dots: 4, depth: [0.15, 0.6], len: [5, 10] } })).svg;

  const disc = new Shape(blobPoints(rng.fork('disc'), { cx: C[0], cy: C[1], rx: 122, ry: 120, n: 12, jitter: 0.025, harmonics: [[3, 0.02]] }));
  const E = {
    x: 200, y: 208, w: 190, rot: -3, hu: 0.34, hl: 0.27, gaze: [0.3, -0.3], iris: 0.19, pupil: 0.36,
    socket: { rx: 1.1, ry: 0.98, dy: -0.08 }, lashes: { up: 9, down: 6, len: 0.13 }, crease: 0.12,
    c: {
      ...EYE_LIME,
      socket: '#f8852c', socketLight: '#fdd27a', socketDark: '#d4452a', socketAlt: '#e55666',
      blend: ['#fcc23a'],
      sclera: '#fff6e3', scleraLight: '#ffffff', scleraDark: '#c2d2d4', scleraHi: '#ffffff',
      iris: '#88c6db', irisLight: '#d2ecf3', irisDark: '#2e7ece', irisRing: '#2e7ece', irisRingDark: '#2230c8', irisInner: '#e8f6fa',
      pupil: '#1d1652', pupilLight: '#3340c8',
      lashLine: '#a62f38', lashInk: '#6a1428', lash: '#c4364a', lash2: '#a62f38', lowerLine: '#d4452a', water: '#fde6c8', lidShadow: '#c4364a',
    },
  };
  const er = rng.fork('eye');
  const sock = socketWorld(er, E);
  const exclude = (p) => sock.inside(p) && sock.nearest(p).d > 16;
  s += paint(cv, disc, rng.fork('paint'), pastelSpec({
    base: '#fbb631', mid: '#fcc23a', dark: '#f8852c', deep: '#e55a2a', alt: '#e55666',
    light: '#fde05a', pale: '#fff2a0', warm: '#fff6e3',
    rim: '#a62f38', rim2: '#e0622a', rimDeep: '#7a1f2a',
  }, { exclude, guides: [{ shape: sock, band: 30, w: 1 }], follow: 1, band: 110, warmOp: 0.35, scratch: { n: 18, dots: 8 } })).svg;
  s += eye(cv, er, E);
  const f = cv.paperFilter({ ...PAPER, seed: 51 });
  return cv.render(s, { filter: f });
}
