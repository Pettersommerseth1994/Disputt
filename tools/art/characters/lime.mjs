// Lime – lime-green blob head, one giant heavy-lidded, bloodshot eye (ref 1, top-left).
import { Shape } from '../lib/shape.mjs';
import { paint } from '../lib/pastel.mjs';
import { eye, socketWorld, EYE_LIME } from '../lib/eye.mjs';
import { blobPoints } from '../lib/geom.mjs';
import { Canvas } from '../lib/svg.mjs';
import { Rng } from '../lib/rng.mjs';
import { pastelSpec, PAPER } from '../lib/recipes.mjs';

/** The eye of the lime, as the open picture and the shut one (the lid that blinks over it on the start screen) both draw it. */
const limeEye = () => ({
  x: 200, y: 190, w: 238, rot: -5, hu: 0.2, hl: 0.2, gaze: [0.18, 0.08], iris: 0.205, pupil: 0.44, peak: 0.1,
  socket: { rx: 1.12, ry: 0.84, dy: -0.06 }, veins: 4, lashes: { up: 9, down: 6, len: 0.12 },
  c: { ...EYE_LIME, blend: ['#a6d244', '#c4d74a'] },
});

/**
 * The lid of the same eye, shut, on a canvas of its own the size of the picture (not the whole socket, as for the car and the cabin in art/modes.mjs: just the eyelid):
 * on the page it lies over the open eye, folded away, and closes over it for a moment now and then. Same grain, same random streams.
 */
export function limeLid() {
  const cv = new Canvas('lime-lid');
  const er = new Rng('lime').fork('eye');
  const s = eye(cv, er, { ...limeEye(), closed: 'down', socket: false, lidFill: true });
  return cv.render(s, { filter: cv.paperFilter({ ...PAPER, seed: 11 }) });
}

export default function lime() {
  const cv = new Canvas('lime');
  const rng = new Rng('lime');
  const head = new Shape(blobPoints(rng.fork('head'), {
    cx: 200, cy: 202, rx: 172, ry: 176, n: 12, jitter: 0.03,
    harmonics: [[2, 0.025], [3, 0.03]],
    shape: (t) => 1 - 0.08 * Math.max(0, Math.sin(t)) ** 3 + 0.02 * Math.cos(2 * t),
  }));
  const E = limeEye();
  const er = rng.fork('eye');
  const sock = socketWorld(er, E);
  const exclude = (p) => sock.inside(p) && sock.nearest(p).d > 22;
  let body = paint(cv, head, rng.fork('paint'), pastelSpec({
    base: '#86c232', mid: '#9ccf3c', dark: '#58a226', deep: '#2e7a2a', alt: '#1b838c',
    light: '#c8dc4c', pale: '#eef3a0', warm: '#fae54f',
    rim: '#2b6e1e', rim2: '#3f8a22', rimDeep: '#1f5a1a',
  }, { exclude, guides: [{ shape: sock, band: 34, w: 0.9 }] })).svg;

  body += eye(cv, er, E);
  const f = cv.paperFilter({ ...PAPER, seed: 11 });
  return cv.render(body, { filter: f });
}
