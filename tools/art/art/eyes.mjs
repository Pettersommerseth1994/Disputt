// Role / reveal / state eyes. Each sits on a known flat background colour (drawn by the UI),
// so the eyelid socket is coloured to contrast with it and blends into it at the edge.
import { Shape } from '../lib/shape.mjs';
import { paint, render, G_OPEN } from '../lib/pastel.mjs';
import { eye, EYE_LIME } from '../lib/eye.mjs';
import { Canvas } from '../lib/svg.mjs';
import { Rng } from '../lib/rng.mjs';
import { PAPER } from '../lib/recipes.mjs';
import { sparklePts } from '../lib/parts.mjs';

function sparkle(cv, rng, cx, cy, R, { c = '#fff6e3', c2 = '#fdf435', rim = '#f8852c', rotDeg = 0 } = {}) {
  const sh = new Shape(sparklePts(cx, cy, R, 0.26, rotDeg), { tension: 0.55 });
  return paint(cv, sh, rng, {
    base: c,
    passes: [{ c: c2, w: Math.max(2, R * 0.16), op: 0.55, sp: Math.max(3, R * 0.18), len: [R * 0.25, R * 0.6], follow: 1, band: 99, tone: [0, 0.55] }],
    rims: [{ c: rim, w: Math.max(1.8, R * 0.1), op: 0.85, len: [R * 0.5, R * 1.1], inset: [0, R * 0.04] }],
  }).svg;
}

export function eyeImpostor() {
  const cv = new Canvas('eye-impostor', 400, 300);
  const rng = new Rng('eye-impostor');
  let s = eye(cv, rng.fork('eye'), {
    x: 200, y: 162, w: 300, rot: -4, hu: 0.17, hl: 0.14, gaze: [0.42, 0.12], iris: 0.16, pupil: 0.5, pupilKind: 'slit', peak: 0.28,
    socket: { rx: 1.16, ry: 0.72, dy: -0.06, feather: 0.035, blendProb: 0.35 }, lashes: { up: 7, down: 3, len: 0.07 }, crease: 0.17, lidW: 1.9,
    hlPos: [0.9, -0.7], hlSize: 0.9,
    brow: { y: 0.37, tilt: -15, len: 0.66, arch: 0.06, w: 0.05, c: '#1c0a10', hi: '#a62f38' },
    c: {
      ...EYE_LIME,
      socket: '#4a0c18', socketLight: '#a62f38', socketDark: '#1c0a10', socketAlt: '#6a1428',
      blend: ['#d71f2f'],
      sclera: '#fdf2c0', scleraLight: '#fffbe6', scleraDark: '#e8c27a', scleraHi: '#ffffff',
      iris: '#f8a42c', irisLight: '#fde05a', irisDark: '#c4452a', irisRing: '#a62f38', irisRingDark: '#4a0c18', irisInner: '#fdf435',
      pupil: '#1c0a10', pupilLight: '#4a0c18',
      lashLine: '#1c0a10', lashInk: '#000000', lash: '#1c0a10', lash2: '#1c0a10', lowerLine: '#6a1428', water: '#f0c3a0', lidShadow: '#4a0c18',
    },
  });
  const f = cv.paperFilter({ ...PAPER, seed: 201 });
  return cv.render(s, { filter: f });
}

export function eyeLoyal() {
  const cv = new Canvas('eye-loyal', 400, 300);
  const rng = new Rng('eye-loyal');
  let s = eye(cv, rng.fork('eye'), {
    x: 200, y: 158, w: 290, rot: 0, hu: 0.31, hl: 0.24, gaze: [0, 0.05], iris: 0.2, pupil: 0.44, peak: -0.05,
    socket: { rx: 1.14, ry: 0.86, dy: -0.07, feather: 0.035, blendProb: 0.35 }, lashes: { up: 11, down: 7, len: 0.12 }, crease: 0.12,
    c: {
      ...EYE_LIME,
      socket: '#f48b8f', socketLight: '#fbd0d4', socketDark: '#d0567e', socketAlt: '#f0c3c5',
      blend: ['#2a6fdb'],
      sclera: '#fff6e3', scleraLight: '#ffffff', scleraDark: '#e0c8c8', scleraHi: '#ffffff',
      iris: '#9cc63a', irisLight: '#fdf435', irisDark: '#4f8a24', irisRing: '#5a9a2a', irisRingDark: '#2b6e1e', irisInner: '#fdf9a0',
      pupil: '#1d1652', pupilLight: '#2230c8',
      lashLine: '#c4365a', lashInk: '#7e1f3c', lash: '#d0567e', lash2: '#d0567e', lowerLine: '#d0567e', water: '#fde4e6', lidShadow: '#d0567e',
    },
  });
  const f = cv.paperFilter({ ...PAPER, seed: 211 });
  return cv.render(s, { filter: f });
}

export function eyeRight() {
  const cv = new Canvas('eye-right', 400, 300);
  const rng = new Rng('eye-right');
  let s = eye(cv, rng.fork('eye'), {
    x: 200, y: 160, w: 280, rot: 0, hu: 0.36, hl: 0.29, gaze: [0, -0.15], iris: 0.215, pupil: 0.5,
    socket: { rx: 1.12, ry: 0.98, dy: -0.08, feather: 0.035, blendProb: 0.35 }, lashes: { up: 11, down: 7, len: 0.13 }, crease: 0.1, hlSize: 1.25,
    c: {
      ...EYE_LIME,
      socket: '#b170b4', socketLight: '#e6aee0', socketDark: '#7b3f9e', socketAlt: '#f48b8f',
      blend: ['#7eba2d'],
      sclera: '#fff6e3', scleraLight: '#ffffff', scleraDark: '#d8c8e0', scleraHi: '#ffffff',
      iris: '#2e7ece', irisLight: '#88c6db', irisDark: '#1d3f9e', irisRing: '#2230c8', irisRingDark: '#141a7a', irisInner: '#c2e2ee',
    },
  });
  // little sparkles around (and one in the eye)
  const sr = rng.fork('sparkles');
  for (const [x, y, R, r] of [[52, 70, 24, 10], [348, 62, 30, -8], [362, 222, 18, 14], [40, 228, 16, 0], [262, 128, 13, 6]]) {
    s += sparkle(cv, sr.fork(`${x}`), x, y, R, { rotDeg: r });
  }
  const f = cv.paperFilter({ ...PAPER, seed: 221 });
  return cv.render(s, { filter: f });
}

export function eyeWrong() {
  const cv = new Canvas('eye-wrong', 400, 300);
  const rng = new Rng('eye-wrong');
  let s = eye(cv, rng.fork('eye'), {
    x: 196, y: 140, w: 270, rot: 9, hu: 0.26, hl: 0.22, gaze: [0, 0], iris: 0.215, pupil: 0.4, pupilKind: 'spiral',
    socket: { rx: 1.12, ry: 0.88, dy: -0.06, feather: 0.035, blendProb: 0.35 }, lashes: { up: 9, down: 6, len: 0.12 }, crease: 0.14, veins: 6,
    tear: { x: 0.6, y: 0.2, r: 0.085 },
    c: {
      ...EYE_LIME,
      socket: '#7b6fb8', socketLight: '#b9a0d8', socketDark: '#3a3a9e', socketAlt: '#b170b4',
      blend: ['#f48b8f'],
      sclera: '#fff1e6', scleraLight: '#ffffff', scleraDark: '#f0b0b4', scleraHi: '#ffffff',
      iris: '#88c6db', irisLight: '#e3f3f7', irisDark: '#2e7ece', irisRing: '#2e7ece', irisRingDark: '#2230c8', irisInner: '#e8f6fa',
      pupil: '#1d1652', vein: '#c4364a',
      lashLine: '#2a2a7e', lash: '#3a3a9e', lash2: '#3a3a9e', lowerLine: '#5a4aa0', lidShadow: '#3a3a9e',
    },
  });
  const f = cv.paperFilter({ ...PAPER, seed: 231 });
  return cv.render(s, { filter: f });
}

export function eyeWait() {
  const cv = new Canvas('eye-wait', 300, 200);
  const rng = new Rng('eye-wait');
  let s = eye(cv, rng.fork('eye'), {
    x: 150, y: 108, w: 196, rot: -3, hu: 0.29, hl: 0.21, gaze: [0.8, -0.25], iris: 0.2, pupil: 0.44, peak: 0.1,
    socket: { rx: 1.12, ry: 0.86, dy: -0.07, feather: 0.035, blendProb: 0.35 }, lashes: { up: 8, down: 5, len: 0.12 }, crease: 0.12,
    c: {
      ...EYE_LIME,
      socket: '#f48b8f', socketLight: '#fbd0d4', socketDark: '#e55666', socketAlt: '#f8a07a',
      blend: ['#6a1428'],
      sclera: '#fff6e3', scleraLight: '#ffffff', scleraDark: '#f0c3c5', scleraHi: '#ffffff',
      iris: '#7eba2d', irisLight: '#c4d74a', irisDark: '#3f7f2a', irisRing: '#2b6e1e', irisRingDark: '#1f5a1a', irisInner: '#e2ee8a',
      pupil: '#1c0a10', pupilLight: '#4a1f3a',
      lashLine: '#7e1f2c', lashInk: '#30060f', lash: '#a62f38', lash2: '#a62f38', lowerLine: '#e55666', water: '#fde4e6', lidShadow: '#e55666',
    },
  });
  const f = cv.paperFilter({ ...PAPER, seed: 241 });
  return cv.render(s, { filter: f });
}
