// The two ways to play, as pictures in the same oil-pastel hand as the avatars: a cabin (hytte, one phone each) and a car (bil, one
// phone for everybody). Each has one giant eye as its window, like everything else in the game.
import { Shape } from '../lib/shape.mjs';
import { paint, render, G_OPEN } from '../lib/pastel.mjs';
import { eye, socketWorld, EYE_LIME } from '../lib/eye.mjs';
import { blobPoints, lerpP } from '../lib/geom.mjs';
import { Canvas } from '../lib/svg.mjs';
import { Rng } from '../lib/rng.mjs';
import { pastelSpec, PAPER } from '../lib/recipes.mjs';
import { curl } from '../lib/parts.mjs';

/** A polygon with rounded corners, as control points for a closed smooth curve (k: how far from each corner the curve starts). */
function roundedPoly(rng, verts, k = 0.14, wob = 1.2) {
  const n = verts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const v = verts[i], p = verts[(i + n - 1) % n], q = verts[(i + 1) % n];
    out.push(lerpP(v, p, k), lerpP(v, q, k), lerpP(v, q, 0.5)); // (the point halfway along the edge keeps it straight)
  }
  return out.map((pt) => [pt[0] + rng.range(-wob, wob), pt[1] + rng.range(-wob, wob)]);
}

/** pastelSpec drops `over` (strokes drawn on top of the hatching, inside the shape): put it back. */
const withOver = (spec, over) => ({ ...spec, over });

const RED = { base: '#d94a52', mid: '#e55666', dark: '#b8323f', deep: '#8e2430', alt: '#f48b8f', light: '#f07a82', pale: '#f9b0b0', warm: '#fdd27a', rim: '#7e1f2c', rim2: '#a62f38', rimDeep: '#5a1220' };
const TURF = { base: '#7eba2d', mid: '#8cc63a', dark: '#4f9a24', deep: '#2e7a2a', alt: '#1b838c', light: '#c4d74a', pale: '#eef3a0', warm: '#fae54f', rim: '#2b6e1e', rim2: '#3f8a22', rimDeep: '#1f5a1a' };
const CREAM = { base: '#fff0cc', mid: '#fff6e3', dark: '#f0d89a', deep: '#e8c27a', light: '#ffffff', pale: '#ffffff', rim: '#c9a050', rim2: '#e8c27a' };
const WOOD = { base: '#30211e', mid: '#463028', dark: '#1c0a10', light: '#6a4a40', pale: '#8a6a58', rim: '#1c0a10', rim2: '#30211e' };
const STONE = { base: '#89b3b5', mid: '#9ec0c2', dark: '#53a0a7', deep: '#1b838c', light: '#c2d2d4', pale: '#e8f0f0', rim: '#1b6a72', rim2: '#3a8a92' };
const ORANGE = { base: '#f8852c', mid: '#fa9a3a', dark: '#e0622a', deep: '#c43d2a', alt: '#e55666', light: '#fbb04a', pale: '#fdd27a', warm: '#fae54f', rim: '#b8321f', rim2: '#d4552a', rimDeep: '#8e2420' };
const VIOLET = { base: '#9a5aae', mid: '#b170b4', dark: '#7b3f9e', deep: '#5a2a80', alt: '#2e7ece', light: '#c99ad0', pale: '#e8c8ec', warm: '#f48b8f', rim: '#3e1460', rim2: '#6a3592', rimDeep: '#2a0a44' };
const CYAN = { base: '#88c6db', mid: '#9ad0e2', dark: '#53a0c0', deep: '#2e7ece', light: '#c2e2ee', pale: '#e8f6fa', warm: '#fff6e3', rim: '#2e5f9e', rim2: '#4a86c4' };
const BLUEGREY = { base: '#c2d2d4', mid: '#d3e0e1', dark: '#89b3b5', light: '#eef4f4', pale: '#ffffff', rim: '#53a0a7', rim2: '#89b3b5' };

/** A window-eye: the socket is the glass (or the frame), the eyeball looks out of it. */
function windowEye(x, y, w, rot, gaze, c) {
  return {
    x, y, w, rot, hu: 0.31, hl: 0.25, gaze, iris: 0.21, pupil: 0.44, peak: 0.04,
    socket: { rx: 1.14, ry: 0.92, dy: -0.04 }, lashes: { up: 9, down: 5, len: 0.12 }, crease: 0.12,
    c: { ...EYE_LIME, ...c },
  };
}

export function hytte() {
  const cv = new Canvas('hytte', 400, 300);
  const rng = new Rng('hytte');
  let s = '';
  // ground: a few scribbled blades of grass under the house
  const gr = rng.fork('ground');
  const blades = [];
  for (let i = 0; i < 26; i++) {
    const x = 26 + i * 14 + gr.range(-4, 4);
    blades.push([[x, 282], [x + gr.range(-3, 3), 272 - gr.range(0, 6)], [x + gr.range(-6, 6), 262 - gr.range(0, 10)]]);
  }
  s += G_OPEN + render(blades, { c: '#4f9a24', w: [5, 3.6], op: 0.85, split: 1, prec: 1, rng: gr }) + '</g>';
  s += G_OPEN + render([[[20, 284], [200, 290], [380, 284]]], { c: '#2e7a2a', w: 6, op: 0.7, split: 1, prec: 1, rng: gr.fork('line') }) + '</g>';

  // chimney (behind the roof) and its smoke
  const chimney = new Shape(roundedPoly(rng.fork('chimney'), [[262, 56], [296, 56], [296, 128], [262, 128]], 0.16));
  s += paint(cv, chimney, rng.fork('chimney-paint'), pastelSpec(STONE, { sc: 0.5, follow: 1, band: 99, angle: 90, scratch: { n: 4, dots: 2, len: [5, 9] } })).svg;
  const sm = rng.fork('smoke');
  s += G_OPEN +
    render([curl([270, 36], 15, 1.5, 3.6, 1), curl([300, 18], 11, 1.4, 3.4, -1)], { c: '#7fa9b0', w: [8, 6], op: 0.95, split: 1, prec: 1, rng: sm }) +
    render([curl([270, 36], 15, 1.5, 3.6, 1), curl([300, 18], 11, 1.4, 3.4, -1)], { c: '#e8f6fa', w: 3, op: 0.9, split: 1, prec: 1, rng: sm.fork('b') }) + '</g>';

  // walls: red logs, with the seams between them
  const walls = new Shape(roundedPoly(rng.fork('walls'), [[76, 150], [324, 150], [328, 268], [72, 268]], 0.07, 1.6));
  const seamR = rng.fork('seams');
  const seams = [176, 200, 224, 248].map((y) => [[78, y + seamR.range(-1, 1)], [200, y + seamR.range(-2, 2)], [322, y + seamR.range(-1, 1)]]);
  const E = windowEye(158, 212, 104, -3, [0.34, 0.1], {
    socket: '#fff0cc', socketLight: '#ffffff', socketDark: '#e8c27a', socketAlt: '#fdd27a',
    blend: ['#f9b0b0'],
    sclera: '#fff9ec', scleraLight: '#ffffff', scleraDark: '#e8d8b8', scleraHi: '#ffffff',
    iris: '#53a0a7', irisLight: '#c2e2ee', irisDark: '#1b838c', irisRing: '#2e7ece', irisRingDark: '#2230c8', irisInner: '#e8f6fa',
    pupil: '#1d1652', pupilLight: '#3340c8',
    lashLine: '#7e1f2c', lashInk: '#4a0c18', lash: '#a62f38', lash2: '#7e1f2c', lowerLine: '#c4364a', water: '#fde6c8', lidShadow: '#e8c27a',
  });
  const er = rng.fork('eye');
  const sock = socketWorld(er, E);
  const exclude = (p) => sock.inside(p) && sock.nearest(p).d > 14;
  s += paint(cv, walls, rng.fork('walls-paint'), withOver(pastelSpec(RED, {
    sc: 0.7, angle: 0, follow: 0.35, band: 40, exclude, guides: [{ shape: sock, band: 24, w: 0.7 }], scratch: { n: 12, dots: 5 },
  }), G_OPEN + render(seams, { c: '#7e1f2c', w: [4.6, 3.6], op: 0.7, split: 1, prec: 1, rng: seamR.fork('r') }) + '</g>')).svg;

  // corner boards
  for (const [x0, x1, key] of [[76, 96, 'cl'], [304, 328, 'cr']]) {
    const board = new Shape(roundedPoly(rng.fork(key), [[x0, 152], [x1, 152], [x1 + (x1 > 300 ? 2 : -2), 266], [x0 + (x0 < 100 ? -2 : 2), 266]], 0.18));
    s += paint(cv, board, rng.fork(key + 'p'), pastelSpec(CREAM, { sc: 0.4, follow: 1, band: 99, angle: 90, scratch: false })).svg;
  }

  // the door
  const door = new Shape(roundedPoly(rng.fork('door'), [[242, 198], [292, 198], [292, 268], [242, 268]], 0.14));
  s += paint(cv, door, rng.fork('door-paint'), pastelSpec(WOOD, { sc: 0.55, follow: 1, band: 99, angle: 90, scratch: { n: 4, dots: 2, len: [5, 9], depth: [0.1, 0.4] } })).svg;
  const knob = new Shape(blobPoints(rng.fork('knob'), { cx: 280, cy: 236, rx: 6, ry: 6, n: 6, jitter: 0.04, harmonics: [] }));
  s += paint(cv, knob, rng.fork('knob-paint'), pastelSpec({ base: '#fae025', mid: '#fdf435', dark: '#f8b42a', light: '#fff6a0', rim: '#c4452a', rim2: '#f8852c' }, { sc: 0.25, scratch: false })).svg;

  // the roof: grass on top, as on the old cabins
  const roof = new Shape(roundedPoly(rng.fork('roof'), [[26, 172], [200, 34], [374, 172]], 0.13, 1.6));
  s += paint(cv, roof, rng.fork('roof-paint'), pastelSpec(TURF, { sc: 0.75, angle: -30, follow: 0.8, band: 50, scratch: { n: 12, dots: 4 } })).svg;
  // a few blades of grass along the two slopes
  const tufts = [];
  const tr = rng.fork('tufts');
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const t = 0.14 + i * 0.15; // 0 at the foot, 1 at the ridge
      const px = 200 + side * 170 * (1 - t), py = 172 - 138 * t;
      tufts.push([[px + side * -1, py - 4], [px + tr.range(-3, 3), py - 14], [px + tr.range(-6, 6), py - 22 - tr.range(0, 5)]]);
    }
  }
  s += G_OPEN + render(tufts, { c: '#4f9a24', w: [5, 4], op: 0.9, split: 1, prec: 1, rng: tr }) + '</g>';

  s += eye(cv, er, E);
  const f = cv.paperFilter({ ...PAPER, seed: 401 });
  return cv.render(s, { filter: f });
}

export function bil() {
  const cv = new Canvas('bil', 400, 300);
  const rng = new Rng('bil');
  let s = '';
  // the road: a scribbled line with dashes
  const rr = rng.fork('road');
  s += G_OPEN + render([[[16, 284], [200, 290], [384, 284]]], { c: '#53a0a7', w: 7, op: 0.75, split: 1, prec: 1, rng: rr }) +
    render([[[40, 272], [58, 273], [78, 272]], [[320, 272], [338, 273], [358, 272]]], { c: '#89b3b5', w: 5, op: 0.8, split: 1, prec: 1, rng: rr.fork('d') }) + '</g>';

  // a suitcase on the roof
  const case1 = new Shape(roundedPoly(rng.fork('case'), [[152, 28], [258, 28], [258, 72], [152, 72]], 0.2));
  s += G_OPEN + render([{ cubic: [[184, 30], [190, 10], [222, 10], [228, 30]] }], { c: '#5a2a80', w: 7, op: 0.95, split: 1, prec: 1, rng: rr.fork('h') }) + '</g>';
  s += paint(cv, case1, rng.fork('case-paint'), withOver(pastelSpec(VIOLET, {
    sc: 0.6, follow: 1, band: 99, angle: -20, scratch: { n: 6, dots: 3 },
  }), G_OPEN + render([[[184, 30], [184, 50], [184, 72]], [[226, 30], [226, 50], [226, 72]]], { c: '#fff0cc', w: [6, 5], op: 0.9, split: 1, prec: 1, rng: rr.fork('s') }) + '</g>')).svg;

  // the body and the cabin as one shape
  const bodyPts = [[24, 224], [22, 188], [38, 170], [120, 164], [300, 162], [352, 172], [384, 198], [384, 226], [300, 234], [110, 234]];
  const cabinPts = [[92, 170], [112, 118], [146, 88], [214, 76], [262, 86], [298, 114], [330, 170], [210, 174]];
  const body = new Shape([bodyPts, cabinPts]);
  const E = windowEye(214, 134, 100, 2, [0.4, 0.08], {
    socket: '#88c6db', socketLight: '#e8f6fa', socketDark: '#2e7ece', socketAlt: '#c2e2ee',
    blend: ['#fa9a3a'],
    sclera: '#fff9ec', scleraLight: '#ffffff', scleraDark: '#c2d2d4', scleraHi: '#ffffff',
    iris: '#f8852c', irisLight: '#fdd27a', irisDark: '#c43d2a', irisRing: '#a62f38', irisRingDark: '#6a1428', irisInner: '#fdf435',
    pupil: '#1c0a10', pupilLight: '#4a0c18',
    lashLine: '#2e5f9e', lashInk: '#1d1652', lash: '#2e7ece', lash2: '#2230c8', lowerLine: '#4a86c4', water: '#e8f6fa', lidShadow: '#53a0c0',
  });
  const er = rng.fork('eye');
  const sock = socketWorld(er, E);
  const exclude = (p) => sock.inside(p) && sock.nearest(p).d > 14;
  const stripe = rng.fork('stripe');
  s += paint(cv, body, rng.fork('body-paint'), withOver(pastelSpec(ORANGE, {
    sc: 0.75, follow: 0.9, band: 70, exclude, guides: [{ shape: sock, band: 22, w: 0.8 }], scratch: { n: 16, dots: 6 },
  }), G_OPEN +
    render([[[28, 204], [200, 206], [382, 204]]], { c: '#fff0cc', w: [6, 5], op: 0.95, split: 1, prec: 1, rng: stripe }) +
    render([[[28, 215], [200, 217], [382, 215]]], { c: '#88c6db', w: [6, 5], op: 0.95, split: 1, prec: 1, rng: stripe.fork('b') }) + '</g>')).svg;

  // lights
  const head = new Shape(blobPoints(rng.fork('head'), { cx: 368, cy: 192, rx: 13, ry: 13, n: 7, jitter: 0.04, harmonics: [] }));
  s += paint(cv, head, rng.fork('head-paint'), pastelSpec({ base: '#fdf435', mid: '#fff27a', dark: '#f8c42a', light: '#fffbd0', rim: '#e0622a', rim2: '#f8852c' }, { sc: 0.3, scratch: false })).svg;
  const tail = new Shape(blobPoints(rng.fork('tail'), { cx: 38, cy: 192, rx: 9, ry: 11, n: 7, jitter: 0.04, harmonics: [] }));
  s += paint(cv, tail, rng.fork('tail-paint'), pastelSpec({ base: '#e55666', mid: '#f07a82', dark: '#c4364a', light: '#f9b0b0', rim: '#7e1f2c', rim2: '#a62f38' }, { sc: 0.25, scratch: false })).svg;

  // the wheels
  for (const [cx, key] of [[106, 'w1'], [300, 'w2']]) {
    const wheel = new Shape(blobPoints(rng.fork(key), { cx, cy: 236, rx: 44, ry: 44, n: 10, jitter: 0.02, harmonics: [] }));
    s += paint(cv, wheel, rng.fork(key + 'p'), pastelSpec(WOOD, { sc: 0.6, follow: 1, band: 99, scratch: { n: 5, dots: 2, len: [5, 10], depth: [0.1, 0.4] } })).svg;
    const hub = new Shape(blobPoints(rng.fork(key + 'h'), { cx, cy: 236, rx: 19, ry: 19, n: 8, jitter: 0.03, harmonics: [] }));
    s += paint(cv, hub, rng.fork(key + 'hp'), pastelSpec(BLUEGREY, { sc: 0.4, follow: 1, band: 99, scratch: { n: 2, dots: 1, len: [4, 7] } })).svg;
  }

  s += eye(cv, er, E);
  const f = cv.paperFilter({ ...PAPER, seed: 411 });
  return cv.render(s, { filter: f });
}

// (kept for the contact sheet: the cyan the car is shown on, and the cream the cabin is shown on)
export const MODE_BG = { bil: CYAN, hytte: CREAM };
