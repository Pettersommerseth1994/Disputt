// Blåbær – cyan-blue blob with a blueberry crown; pink lids, lime sclera, dreamy upward gaze
// (ref 1, bottom head).
import { Shape } from '../lib/shape.mjs';
import { paint } from '../lib/pastel.mjs';
import { eye, socketWorld, EYE_LIME } from '../lib/eye.mjs';
import { blobPoints } from '../lib/geom.mjs';
import { Canvas } from '../lib/svg.mjs';
import { Rng } from '../lib/rng.mjs';
import { pastelSpec, PAPER } from '../lib/recipes.mjs';
import { calyx } from '../lib/parts.mjs';

export default function blabaer() {
  const cv = new Canvas('blabaer');
  const rng = new Rng('blabaer');
  const body = new Shape(blobPoints(rng.fork('body'), {
    cx: 200, cy: 210, rx: 166, ry: 160, n: 13, jitter: 0.03, harmonics: [[2, 0.02], [3, 0.03]],
  }));
  const E = {
    x: 200, y: 222, w: 228, rot: 3, hu: 0.25, hl: 0.19, gaze: [-0.25, -0.35], iris: 0.205, pupil: 0.46, peak: -0.05,
    socket: { rx: 1.14, ry: 0.86, dy: -0.07 }, lashes: { up: 9, down: 6, len: 0.12 }, crease: 0.14,
    c: {
      ...EYE_LIME,
      socket: '#ee8fb0', socketLight: '#fbd0dc', socketDark: '#c8508a', socketAlt: '#e7a0d8',
      blend: ['#4a9ade'],
      sclera: '#c4d74a', scleraLight: '#e2ee8a', scleraDark: '#7eba2d', scleraHi: '#f4f8c8',
      iris: '#2e7ece', irisLight: '#88c6db', irisDark: '#1d3f9e', irisRing: '#2230c8', irisRingDark: '#141a7a', irisInner: '#9ad0ea',
      pupil: '#140f3a', pupilLight: '#2a2a9e',
      lashLine: '#2230c8', lashInk: '#141a5a', lash: '#2e7ece', lash2: '#2230c8', lowerLine: '#c8508a', water: '#fbd0dc', lidShadow: '#b84a86',
    },
  };
  const er = rng.fork('eye');
  const sock = socketWorld(er, E);
  const exclude = (p) => sock.inside(p) && sock.nearest(p).d > 20;
  let s = paint(cv, body, rng.fork('paint'), pastelSpec({
    base: '#2e7ece', mid: '#3a8ed8', dark: '#2560b8', deep: '#1d3f9e', alt: '#7b3f9e',
    light: '#88c6db', pale: '#d2ecf3', warm: '#fff6e3',
    rim: '#1d3a8e', rim2: '#2456b0', rimDeep: '#14286e',
  }, { exclude, guides: [{ shape: sock, band: 40, w: 1 }], follow: 1, band: 120, warmOp: 0.3, scratch: { n: 26, dots: 12 } })).svg;
  s += calyx(cv, rng.fork('crown'), {
    cx: 202, cy: 48, R: 38,
    pal: { base: '#2230c8', mid: '#2a3fd0', dark: '#1d1a7e', deep: '#140f4a', light: '#5a7ae0', pale: '#9ab8f0', rim: '#120e4a', rim2: '#1d1a7e', rimDeep: '#0a0830', alt: '#7b3f9e' },
  });
  s += eye(cv, er, E);
  const f = cv.paperFilter({ ...PAPER, seed: 31 });
  return cv.render(s, { filter: f });
}
