// Small 2D geometry toolkit (points are [x, y] arrays).

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, s) => [a[0] * s, a[1] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const len = (a) => Math.hypot(a[0], a[1]);
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const norm = (a) => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};
export const perp = (a) => [-a[1], a[0]];
export const rot = (p, ang, c = [0, 0]) => {
  const s = Math.sin(ang), co = Math.cos(ang);
  const x = p[0] - c[0], y = p[1] - c[1];
  return [c[0] + x * co - y * s, c[1] + x * s + y * co];
};
export const lerpP = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const fromAngle = (a, r = 1) => [Math.cos(a) * r, Math.sin(a) * r];

/** Uniform Catmull-Rom → cubic Bézier segments [p1, c1, c2, p2]. */
export function crSegments(pts, closed = true, tension = 1) {
  const n = pts.length;
  const get = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const segs = [];
  const t = tension / 6;
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    segs.push([
      p1,
      [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t],
      [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t],
      p2,
    ]);
  }
  return segs;
}

export function bezierPoint(s, t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [
    a * s[0][0] + b * s[1][0] + c * s[2][0] + d * s[3][0],
    a * s[0][1] + b * s[1][1] + c * s[2][1] + d * s[3][1],
  ];
}

/** Dense polyline along a smooth closed/open curve through control points. */
export function sampleSmooth(pts, { closed = true, step = 4, tension = 1 } = {}) {
  const segs = crSegments(pts, closed, tension);
  const out = [];
  for (const s of segs) {
    const approx = dist(s[0], s[1]) + dist(s[1], s[2]) + dist(s[2], s[3]);
    const k = Math.max(2, Math.ceil(approx / step));
    for (let i = 0; i < k; i++) out.push(bezierPoint(s, i / k));
  }
  if (!closed) out.push(pts[pts.length - 1]);
  return out;
}

export function polyArea(poly) {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function pointInPoly(p, poly) {
  let inside = false;
  const x = p[0], y = p[1];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function bbox(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) {
    if (p[0] < x0) x0 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[0] > x1) x1 = p[0];
    if (p[1] > y1) y1 = p[1];
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** Polyline arc-length resampling. */
export function resample(poly, step, closed = false) {
  const pts = closed ? [...poly, poly[0]] : poly;
  const out = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1];
    const b = pts[i];
    let d = dist(a, b);
    while (acc + d >= step) {
      const t = (step - acc) / d;
      a = lerpP(a, b, t);
      out.push(a);
      d = dist(a, b);
      acc = 0;
    }
    acc += d;
  }
  return out;
}

/**
 * Wobbly organic blob: control points around an ellipse, radius modulated by a few
 * low harmonics (random phases) plus per-point jitter.
 */
export function blobPoints(rng, {
  cx, cy, rx, ry, n = 12, rot: r = 0, jitter = 0.04,
  harmonics = [[2, 0.04], [3, 0.03]], shape = null, start = null,
}) {
  const ph = harmonics.map(() => rng.range(0, TAU));
  const a0 = start ?? rng.range(0, TAU);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = a0 + (i / n) * TAU + rng.range(-0.25, 0.25) * (TAU / n);
    let k = 1 + rng.range(-jitter, jitter);
    harmonics.forEach(([h, a], j) => { k += a * Math.cos(h * t + ph[j]); });
    if (shape) k *= shape(t);
    const x = Math.cos(t) * rx * k, y = Math.sin(t) * ry * k;
    pts.push(rot([cx + x, cy + y], r, [cx, cy]));
  }
  return pts;
}

/** Plain ellipse control points (for smooth closed curves). */
export function ellipsePoints(cx, cy, rx, ry, n = 12, r = 0, a0 = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = a0 + (i / n) * TAU;
    pts.push(rot([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry], r, [cx, cy]));
  }
  return pts;
}

/**
 * Sausage / tube outline around a spine polyline. `radius` is a number or fn(t∈[0,1]).
 * Returns control points of a closed outline with round caps.
 */
export function tubePoints(spine, radius, { capSteps = 4, step = 18 } = {}) {
  const sp = resample(spine, step);
  if (dist(sp[sp.length - 1], spine[spine.length - 1]) > step * 0.3) sp.push(spine[spine.length - 1]);
  const R = typeof radius === 'function' ? radius : () => radius;
  const n = sp.length;
  const left = [], right = [];
  const dirs = [];
  for (let i = 0; i < n; i++) {
    const a = sp[Math.max(0, i - 1)], b = sp[Math.min(n - 1, i + 1)];
    dirs.push(norm(sub(b, a)));
  }
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const r = R(t);
    const nn = perp(dirs[i]);
    left.push(add(sp[i], mul(nn, r)));
    right.push(add(sp[i], mul(nn, -r)));
  }
  const out = [...left];
  // end cap
  const e = sp[n - 1], de = dirs[n - 1], re = R(1);
  for (let k = 1; k < capSteps; k++) {
    const a = (k / capSteps) * Math.PI;
    const nn = perp(de);
    out.push(add(e, add(mul(nn, Math.cos(a) * re), mul(de, Math.sin(a) * re))));
  }
  for (let i = n - 1; i >= 0; i--) out.push(right[i]);
  const s = sp[0], ds = dirs[0], rs = R(0);
  for (let k = 1; k < capSteps; k++) {
    const a = (k / capSteps) * Math.PI;
    const nn = perp(ds);
    out.push(add(s, add(mul(nn, -Math.cos(a) * rs), mul(ds, -Math.sin(a) * rs))));
  }
  return out;
}

/** Add a little wobble to existing control points. */
export function wobble(rng, pts, amt) {
  return pts.map((p) => [p[0] + rng.range(-amt, amt), p[1] + rng.range(-amt, amt)]);
}

/** Cubic Bézier through endpoints with given controls, sampled. */
export function sampleCubic(p0, c1, c2, p1, n = 16) {
  const s = [p0, c1, c2, p1];
  const out = [];
  for (let i = 0; i <= n; i++) out.push(bezierPoint(s, i / n));
  return out;
}

export function polyLength(poly, closed = false) {
  let L = 0;
  for (let i = 1; i < poly.length; i++) L += dist(poly[i - 1], poly[i]);
  if (closed) L += dist(poly[poly.length - 1], poly[0]);
  return L;
}

/** Point + tangent at arc-length parameter u∈[0,1] along an open polyline. */
export function alongPoly(poly, u) {
  const total = polyLength(poly);
  let target = clamp(u) * total;
  for (let i = 1; i < poly.length; i++) {
    const d = dist(poly[i - 1], poly[i]);
    if (target <= d || i === poly.length - 1) {
      const t = d ? clamp(target / d) : 0;
      return { p: lerpP(poly[i - 1], poly[i], t), t: norm(sub(poly[i], poly[i - 1])) };
    }
    target -= d;
  }
  return { p: poly[poly.length - 1], t: [1, 0] };
}
