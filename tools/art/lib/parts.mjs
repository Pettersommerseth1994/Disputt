// Reusable pastel body parts: leaves, stems/tubes, blueberry crown, lips, curls, sparkles.
import { Shape } from './shape.mjs';
import { paint, render, G_OPEN, hatch } from './pastel.mjs';
import { pastelSpec } from './recipes.mjs';
import { add, sub, mul, norm, perp, len, lerp, lerpP, TAU, DEG, tubePoints, rot as rotP, clamp } from './geom.mjs';

export const GREEN = {
  base: '#6fb02c', mid: '#7eba2d', dark: '#3f8a22', deep: '#2b6e1e', alt: '#1b838c',
  light: '#b4d443', pale: '#e2ee8a', rim: '#24601c', rim2: '#3a7e22', rimDeep: '#173f12',
};
export const STEM = {
  base: '#6b7a2a', mid: '#7f8e33', dark: '#4e5a1e', light: '#a8b84a', rim: '#30211e', rim2: '#4a3a22',
};

/** Pointed leaf from base B to tip T with herringbone hatching and a midrib. */
export function leaf(cv, rng, { B, T, width, pal = GREEN, sc = 0.6, bend = 0.12 }) {
  const ax = sub(T, B), L = len(ax), d = norm(ax), n = perp(d);
  const at = (t, wf) => add(add(B, mul(d, L * t)), mul(n, (width / 2) * wf + L * bend * Math.sin(Math.PI * t)));
  const pts = [B, at(0.16, 0.55), at(0.42, 1.0), at(0.72, 0.78), at(0.93, 0.25), T, at(0.93, -0.22), at(0.72, -0.74), at(0.42, -0.98), at(0.16, -0.55)];
  const sh = new Shape(pts);
  const side = (p) => (p[0] - B[0]) * n[0] + (p[1] - B[1]) * n[1] - L * bend * Math.sin(Math.PI * clamp(((p[0] - B[0]) * d[0] + (p[1] - B[1]) * d[1]) / L));
  const axA = Math.atan2(d[1], d[0]) / DEG;
  const spec = pastelSpec(pal, { sc, follow: 0.4, band: 10, scratch: { n: 4, dots: 2, depth: [0.15, 0.6], lit: 0.5 } });
  // herringbone: each half hatched at ±45° to the midrib
  spec.passes = spec.passes.flatMap((ps) => [
    { ...ps, angle: axA + 50, density: (p) => (side(p) > 0 ? 1 : 0) },
    { ...ps, angle: axA - 50, density: (p) => (side(p) <= 0 ? 1 : 0) },
  ]);
  let s = paint(cv, sh, rng, spec).svg;
  // midrib + veins
  const mr = rng.fork('rib');
  const rib = [B, at(0.5, 0), at(0.9, 0)];
  const veins = [];
  for (let i = 0; i < 4; i++) {
    const t = 0.22 + i * 0.17;
    for (const sg of [1, -1]) {
      const p = at(t, 0);
      const q = add(add(p, mul(d, L * 0.12)), mul(n, sg * width * 0.32 * (1 - t * 0.5)));
      veins.push([p, lerpP(p, q, 0.5), q]);
    }
  }
  s += G_OPEN + render([rib], { c: pal.deep || pal.dark, w: Math.max(2, width * 0.07), op: 0.8, split: 1, prec: 1, rng: mr });
  s += render(veins, { c: pal.dark, w: Math.max(1.6, width * 0.04), op: 0.6, split: 1, prec: 1, rng: mr });
  s += render([[at(0.1, 0.1), at(0.45, 0.15), at(0.8, 0.12)]], { c: pal.pale || pal.light, w: Math.max(1.6, width * 0.04), op: 0.55, split: 1, prec: 1, rng: mr }) + '</g>';
  return s;
}

/** Tube (stem, limb, finger): strokes run along its length. */
export function tube(cv, rng, { spine, r, pal = STEM, sc = 0.45, scratch = null, angle = null, rims = true }) {
  const sh = new Shape(tubePoints(spine, r));
  const d = norm(sub(spine[spine.length - 1], spine[0]));
  const spec = pastelSpec(pal, {
    sc, follow: 1, band: 99, angle: angle ?? Math.atan2(d[1], d[0]) / DEG,
    scratch: scratch ?? { n: 3, dots: 1, depth: [0.1, 0.5], lit: 0.6, len: [4, 9], w: [2.6, 2] },
  });
  if (!rims) spec.rims = [];
  return { svg: paint(cv, sh, rng, spec).svg, shape: sh };
}

/** Blueberry crown seen from the side: a little ring of pointy sepals on top of the berry. */
export function calyx(cv, rng, { cx, cy, R, pal }) {
  const j = () => rng.range(-0.05, 0.05) * R;
  const P = (x, y) => [cx + x * R + j(), cy + y * R + j()];
  const pts = [
    P(-0.78, 0.5), P(-1.02, -0.18), P(-0.55, 0.12), P(-0.48, -0.62), P(-0.16, 0.0), P(0.04, -0.8),
    P(0.2, 0.0), P(0.5, -0.6), P(0.6, 0.12), P(1.04, -0.16), P(0.8, 0.5), P(0, 0.72),
  ];
  const sh = new Shape(pts, { tension: 0.62 });
  let s = paint(cv, sh, rng, pastelSpec(pal, {
    sc: 0.42, follow: 0.9, band: 20, angle: -80,
    scratch: { n: 3, dots: 2, depth: [0.15, 0.6], lit: 0.8, len: [4, 8], w: [2.6, 2] },
  })).svg;
  // the dimple ring inside the crown
  const dr = rng.fork('dimple');
  s += G_OPEN + render([[[cx - R * 0.5, cy + R * 0.18], [cx, cy + R * 0.42], [cx + R * 0.5, cy + R * 0.16]]], { c: pal.rimDeep || pal.rim, w: Math.max(2.5, R * 0.14), op: 0.85, split: 1, prec: 1, rng: dr });
  s += render([[[cx - R * 0.4, cy + R * 0.02], [cx, cy - R * 0.05], [cx + R * 0.38, cy]]], { c: pal.pale || pal.light, w: Math.max(2, R * 0.08), op: 0.65, split: 1, prec: 1, rng: dr }) + '</g>';
  return s;
}

/** Big juicy lips centred at (x,y): width W, height H. Returns svg. */
export function lips(cv, rng, { x, y, W, H, rotDeg = 0, pal, gap = 0.05, smile = 0, hl = 1 }) {
  const P = (px, py) => rotP([x + px * W, y + py * H], rotDeg * DEG, [x, y]);
  const sm = smile;
  const upper = [
    P(-0.5, -sm), P(-0.37, -0.3), P(-0.17, -0.54), P(0, -0.4), P(0.17, -0.54), P(0.37, -0.3), P(0.5, -sm),
    P(0.3, 0.02 - sm * 0.5), P(0.1, -0.03), P(-0.1, -0.03), P(-0.3, 0.02 - sm * 0.5),
  ];
  const lower = [
    P(0.5, -sm), P(0.3, 0.04 - sm * 0.5 + gap), P(0.1, 0.0 + gap), P(-0.1, 0.0 + gap), P(-0.3, 0.04 - sm * 0.5 + gap), P(-0.5, -sm),
    P(-0.36, 0.3), P(-0.14, 0.5), P(0.14, 0.5), P(0.36, 0.3),
  ];
  const up = new Shape(upper, { tension: 0.9 }), lo = new Shape(lower, { tension: 0.9 });
  const lipSpec = (shade) => {
    const spec = pastelSpec(shade ? { ...pal, mid: pal.dark, light: pal.mid } : pal, {
      sc: 0.5, follow: 0.9, band: 18, angle: rotDeg,
      scratch: shade
        ? { n: Math.round(4 * hl), dots: Math.round(2 * hl), depth: [0.15, 0.55], lit: 0.7, len: [6, 12], w: [3.4, 2.6] }
        : { n: Math.round(9 * hl), dots: Math.round(5 * hl), depth: [0.2, 0.7], lit: 0.75, len: [6, 15], w: [3.8, 2.8], jitter: 25 },
    });
    // vertical lip creases
    spec.passes.push({ c: pal.deep, w: 2.2, op: 0.45, sp: 9, len: [6, 14], angle: rotDeg + 90, follow: 0.2, band: 6, jitter: 14 });
    return spec;
  };
  let s = paint(cv, up, rng.fork('up'), lipSpec(true)).svg;
  s += paint(cv, lo, rng.fork('lo'), lipSpec(false)).svg;
  // mouth line
  const mr = rng.fork('mouth');
  const ml = [P(-0.48, -sm), P(-0.3, 0.025 + gap * 0.5 - sm * 0.5), P(-0.1, gap * 0.5 - 0.015), P(0.1, gap * 0.5 - 0.015), P(0.3, 0.025 + gap * 0.5 - sm * 0.5), P(0.48, -sm)];
  s += G_OPEN + render([[ml[0], ml[1], ml[2]], [ml[2], [(ml[2][0] + ml[3][0]) / 2, (ml[2][1] + ml[3][1]) / 2 + 1], ml[3]], [ml[3], ml[4], ml[5]]],
    { c: pal.ink || pal.deep, w: [Math.max(2.5, H * 0.07), Math.max(2, H * 0.05)], op: 0.9, split: 1, prec: 1, rng: mr });
  s += render([[ml[1], ml[2], ml[4]]], { c: pal.deep, w: Math.max(3, H * 0.1), op: 0.5, split: 1, prec: 1, rng: mr }) + '</g>';
  return s;
}

/** Loopy curl: a spiral-ish stroke. */
export function curl(c, r, turns = 1.3, a0 = 0, dir = 1, n = 22) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + dir * t * turns * TAU;
    const rr = r * (1 - 0.65 * t);
    pts.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr]);
  }
  return { poly: pts };
}

/** Four-point sparkle polygon (control points). */
export function sparklePts(cx, cy, R, r = 0.28, rotDeg = 0) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = rotDeg * DEG + (i / 8) * TAU - Math.PI / 2;
    const rr = i % 2 === 0 ? R : R * r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}
