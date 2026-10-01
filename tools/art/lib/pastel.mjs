// Oil-pastel stroke vocabulary.
//
//  hatch()     layered, slightly curved strokes that follow a flow field: a dominant diagonal
//              in the interior, bending to follow the outline near the edge (like ref 1).
//  rim()       wobbly strokes hugging the outline (dark saturated rim, rough edge).
//  scratches() short white/cream dashes + dots on the lit side.
//  render()    batches strokes into a few <path>s per (colour, width, opacity).
//  paint()     base fill + clipped hatch passes + rims + scratches for one Shape.

import { DEG, clamp, smoothstep, norm, dist, lerpP, dot } from './geom.mjs';
import { PathWriter } from './path.mjs';

export const LIGHT = [-0.55, -0.83]; // upper-left

/** 0 = deep shadow/rim, 1 = lit centre. Sphere-ish shading of a blob. */
export function toneAt(shape, p, nb, light = LIGHT, k = {}) {
  const { depthW = 0.55, litW = 0.3, base = 0.2, depthEnd = 0.5 } = k;
  const depth = Math.min(1, nb.d / shape.depthMax);
  const rx = (p[0] - shape.cx) / shape.rx, ry = (p[1] - shape.cy) / shape.ry;
  const L = norm(light);
  const lit = rx * L[0] + ry * L[1];
  return clamp(base + depthW * smoothstep(0, depthEnd, depth) + litW * lit);
}

function toneProb(t, range, soft = 0.12) {
  if (!range) return 1;
  const [lo, hi] = range;
  const a = lo <= 0 ? 1 : smoothstep(lo - soft, lo + soft, t);
  const b = hi >= 1 ? 1 : 1 - smoothstep(hi - soft, hi + soft, t);
  return a * b;
}

/**
 * Orientation field (sign-free, blended in doubled-angle space):
 * dominant hatch angle in the interior, own outline tangent near the edge, plus optional
 * guide shapes (e.g. an eye socket) whose outlines make strokes swirl around them.
 */
function orient(shape, p, base, o, nb) {
  const n = nb || shape.nearest(p);
  const ws = [o.follow * Math.exp(-n.d / o.band)];
  const as = [Math.atan2(n.t[1], n.t[0])];
  if (o.guides) {
    for (const g of o.guides) {
      const gn = g.shape.nearest(p);
      ws.push((g.w ?? 1) * Math.exp(-gn.d / g.band));
      as.push(Math.atan2(gn.t[1], gn.t[0]));
    }
  }
  let sum = 0;
  for (const w of ws) sum += w;
  const k = sum > 1 ? 1 / sum : 1;
  let x = Math.max(0, 1 - sum) * Math.cos(2 * base), y = Math.max(0, 1 - sum) * Math.sin(2 * base);
  for (let i = 0; i < ws.length; i++) {
    x += ws[i] * k * Math.cos(2 * as[i]);
    y += ws[i] * k * Math.sin(2 * as[i]);
  }
  const a = Math.atan2(y, x) / 2;
  return [Math.cos(a), Math.sin(a)];
}

/** Trace a short stroke through the orientation field; returns [p0, pmid, p1]. */
function trace(shape, seed, L, base, o, rng, nb0) {
  const steps = 2;
  const h = L / 2 / steps;
  const d0 = orient(shape, seed, base, o, nb0);
  const walk = (sgn) => {
    let p = seed, d = [d0[0] * sgn, d0[1] * sgn];
    const pts = [];
    for (let i = 0; i < steps; i++) {
      const nd = i === 0 ? d : orient(shape, p, base, o);
      if (nd[0] * d[0] + nd[1] * d[1] < 0) { nd[0] = -nd[0]; nd[1] = -nd[1]; }
      d = nd;
      p = [p[0] + d[0] * h, p[1] + d[1] * h];
      pts.push(p);
    }
    return pts;
  };
  const f = walk(1), b = walk(-1);
  const p0 = b[b.length - 1], p1 = f[f.length - 1];
  // random bend
  const bend = (o.bend ?? 0.08) * L * rng.range(-1, 1);
  const pm = [seed[0] + -d0[1] * bend, seed[1] + d0[0] * bend];
  return [p0, pm, p1];
}

/**
 * Directional hatching inside a shape.
 * o: angle(deg) jitter(deg) sp len[min,max] gap[min,max] follow band bend tone[lo,hi]
 *    toneFn(p, nb) prob exclude(p) light toneK
 */
export function hatch(shape, rng, o) {
  const {
    angle = -35, jitter = 12, sp = 9, len = [16, 34], gap = [2, 9],
    tone = null, toneFn = null, prob = 1, exclude = null, light = LIGHT, toneK,
    outside = 0, density = null,
  } = o;
  const oo = { follow: o.follow ?? 0.6, band: o.band ?? 30, bend: o.bend, guides: o.guides };
  const a0 = angle * DEG;
  const dir = [Math.cos(a0), Math.sin(a0)], nrm = [-dir[1], dir[0]];
  const bb = shape.bb;
  const pad = outside || 0;
  const cs = [[bb.x0 - pad, bb.y0 - pad], [bb.x1 + pad, bb.y0 - pad], [bb.x0 - pad, bb.y1 + pad], [bb.x1 + pad, bb.y1 + pad]];
  const us = cs.map((c) => dot(c, dir)), vs = cs.map((c) => dot(c, nrm));
  const u0 = Math.min(...us) - 4, u1 = Math.max(...us) + 4, v0 = Math.min(...vs), v1 = Math.max(...vs);
  const out = [];
  const jit = o.rowJitter ?? 0.5;
  for (let v = v0 + rng.range(0, sp); v < v1; v += sp * rng.range(0.75, 1.25)) {
    let u = u0 - rng.range(0, len[1]);
    while (u < u1) {
      const L = rng.range(len[0], len[1]);
      const cu = u + L / 2 + rng.range(-0.25, 0.25) * L;
      const jv = v + rng.range(-sp * jit, sp * jit);
      u += L + rng.range(gap[0], gap[1]);
      const seed = [cu * dir[0] + jv * nrm[0], cu * dir[1] + jv * nrm[1]];
      let nb;
      let feather = 1;
      if (!shape.inside(seed)) {
        if (!outside) continue;
        nb = shape.nearest(seed);
        if (nb.d > outside) continue;
        feather = 1 - nb.d / outside;
        nb = { ...nb, d: 0 };
      }
      if (exclude && exclude(seed)) continue;
      nb = nb || shape.nearest(seed);
      let t = toneFn ? toneFn(seed, nb) : toneAt(shape, seed, nb, light, toneK);
      if (o.toneJitter) t += rng.gauss(0, o.toneJitter); // fuzzy tonal borders → blended layers
      let pr = prob * toneProb(t, tone, o.soft ?? 0.12) * feather;
      if (density) pr *= density(seed, nb, t);
      if (pr < 1 && rng.next() > pr) continue;
      const base = a0 + rng.gauss(0, jitter * DEG * 0.7);
      out.push(trace(shape, seed, L, base, oo, rng, nb));
    }
  }
  return out;
}

/** Strokes hugging the exterior outline. */
export function rim(shape, rng, o) {
  const {
    len = [22, 55], inset = [0, 5], overlap = [-0.15, 0.25], maxDev = 1.6, prob = 1,
    runs = shape.runs, where = null,
  } = o;
  const out = [];
  for (const run of runs) {
    const idx = run.idx;
    const m = idx.length;
    if (m < 3) continue;
    const P = idx.map((i) => [shape.bx[i], shape.by[i]]);
    const N = idx.map((i) => [shape.nx[i], shape.ny[i]]);
    const cum = [0];
    for (let k = 1; k < m; k++) cum.push(cum[k - 1] + dist(P[k - 1], P[k]));
    const total = cum[m - 1] + (run.closed ? dist(P[m - 1], P[0]) : 0);
    const at = (s) => {
      if (run.closed) s = ((s % total) + total) % total;
      else s = clamp(s, 0, cum[m - 1]);
      let lo = 0, hi = m - 1;
      while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
      const a = lo, b = run.closed ? (lo + 1) % m : Math.min(m - 1, lo + 1);
      const segL = (b === 0 ? total : cum[b]) - cum[a];
      const t = segL > 0 ? clamp((s - cum[a]) / segL) : 0;
      return { p: lerpP(P[a], P[b], t), n: norm(lerpP(N[a], N[b], t)) };
    };
    let s = rng.range(0, len[0]);
    const end = run.closed ? s + total : cum[m - 1];
    while (s < end - 2) {
      let L = rng.range(len[0], len[1]);
      if (!run.closed) L = Math.min(L, end - s);
      const ins = () => rng.range(inset[0], inset[1]);
      let pts;
      for (let tries = 0; tries < 4; tries++) {
        const i0 = ins(), i2 = ins(), i1 = (i0 + i2) / 2 + rng.range(-1, 1);
        const A = at(s), M = at(s + L / 2), B = at(s + L);
        const p0 = [A.p[0] - A.n[0] * i0, A.p[1] - A.n[1] * i0];
        const pm = [M.p[0] - M.n[0] * i1, M.p[1] - M.n[1] * i1];
        const p1 = [B.p[0] - B.n[0] * i2, B.p[1] - B.n[1] * i2];
        // deviation check at quarter points
        const Q1 = at(s + L / 4).p, Q3 = at(s + (3 * L) / 4).p;
        const c = [2 * pm[0] - (p0[0] + p1[0]) / 2, 2 * pm[1] - (p0[1] + p1[1]) / 2];
        const qb = (t) => [
          (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0],
          (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1],
        ];
        const dev = Math.max(Math.abs(dist(qb(0.25), Q1) - (i0 + i1) / 2), Math.abs(dist(qb(0.75), Q3) - (i1 + i2) / 2));
        pts = [p0, pm, p1];
        if (dev <= maxDev || L < 10) break;
        L *= 0.55;
      }
      const mid = pts[1];
      if ((!where || where(mid)) && (prob >= 1 || rng.next() < prob)) out.push(pts);
      s += L * (1 - rng.range(overlap[0], overlap[1]));
    }
  }
  return out;
}

/** White "scratched-through" highlights: short dashes along the contour + dots. */
export function scratches(shape, rng, o) {
  const {
    n = 20, dots = 8, len = [5, 13], depth = [0.05, 0.4], lit = 0.75, light = LIGHT,
    jitter = 18, exclude = null, where = null, across = false, minGap = 7,
  } = o;
  const bb = shape.bb;
  const L = norm(light);
  const dashes = [], dp = [];
  const placed = [];
  let tries = 0;
  while ((dashes.length < n || dp.length < dots) && tries++ < 30000) {
    const p = [rng.range(bb.x0, bb.x1), rng.range(bb.y0, bb.y1)];
    if (!shape.inside(p)) continue;
    if (exclude && exclude(p)) continue;
    if (where && !where(p)) continue;
    const nb = shape.nearest(p);
    const dn = nb.d / shape.depthMax;
    if (dn < depth[0] || dn > depth[1]) continue;
    const rel = norm([(p[0] - shape.cx) / shape.rx, (p[1] - shape.cy) / shape.ry]);
    const l = rel[0] * L[0] + rel[1] * L[1];
    const pr = 1 - lit + lit * clamp(0.35 + 0.75 * l);
    if (rng.next() > pr) continue;
    if (placed.some((q) => dist(q, p) < minGap)) continue;
    placed.push(p);
    if (dashes.length < n) {
      const a = Math.atan2(nb.t[1], nb.t[0]) + (across ? Math.PI / 2 : 0) + rng.gauss(0, jitter * DEG);
      const d = [Math.cos(a), Math.sin(a)];
      const ln = rng.range(len[0], len[1]);
      const b = ln * rng.range(-0.12, 0.12);
      dashes.push([
        [p[0] - (d[0] * ln) / 2, p[1] - (d[1] * ln) / 2],
        [p[0] - d[1] * b, p[1] + d[0] * b],
        [p[0] + (d[0] * ln) / 2, p[1] + (d[1] * ln) / 2],
      ]);
    } else dp.push({ dot: p });
  }
  return [...dashes, ...dp];
}

/** Write strokes as a few batched <path>s. width may be [a,b] → two width groups. */
export function render(strokes, { c, w, op = 1, split = 2, prec = 0, rng, extra = '' }) {
  if (!strokes.length) return '';
  const widths = Array.isArray(w) ? w : [w];
  const groups = [];
  for (const wd of widths) for (let s = 0; s < split; s++) groups.push({ wd, pw: new PathWriter(prec), n: 0 });
  for (const s of strokes) {
    const wi = widths.length > 1 ? rng.int(0, widths.length - 1) : 0;
    const g = groups[wi * split + (split > 1 ? rng.int(0, split - 1) : 0)];
    g.n++;
    if (s.dot) g.pw.dot(s.dot[0], s.dot[1]);
    else if (s.cubic) {
      const [p0, c1, c2, p1] = s.cubic;
      g.pw.M(p0[0], p0[1]);
      g.pw.C(c1[0], c1[1], c2[0], c2[1], p1[0], p1[1]);
    } else if (s.arc) {
      const { cx, cy, r, a0, a1 } = s.arc;
      g.pw.M(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
      g.pw.A(r, r, Math.abs(a1 - a0) > Math.PI, a1 > a0, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
    } else if (s.poly) {
      g.pw.M(s.poly[0][0], s.poly[0][1]);
      for (let i = 1; i < s.poly.length; i++) g.pw.L(s.poly[i][0], s.poly[i][1]);
    } else {
      const [p0, pm, p1] = s;
      g.pw.M(p0[0], p0[1]);
      const cx = 2 * pm[0] - (p0[0] + p1[0]) / 2, cy = 2 * pm[1] - (p0[1] + p1[1]) / 2;
      // bend below the quantisation step is invisible → straight segment (shorter)
      const dev = Math.hypot(pm[0] - (p0[0] + p1[0]) / 2, pm[1] - (p0[1] + p1[1]) / 2);
      if (dev < (prec === 0 ? 0.9 : 0.25)) g.pw.L(p1[0], p1[1]);
      else g.pw.Q(cx, cy, p1[0], p1[1]);
    }
  }
  const opS = op >= 1 ? '' : ` opacity="${+op.toFixed(2)}"`;
  return groups
    .filter((g) => g.n)
    .map((g) => `<path d="${g.pw}" stroke="${c}" stroke-width="${+g.wd.toFixed(1)}"${opS}${extra}/>`)
    .join('');
}

export const G_OPEN = '<g fill="none" stroke-linecap="round" stroke-linejoin="round">';

/**
 * Paint one shape the pastel way.
 * spec: { base, baseOp, light, angle, passes:[...hatch opts + c,w,op], rims:[...], scratch:{...} | [..],
 *         under: string (inside clip, before hatch), over: string (inside clip, after hatch) }
 */
export function paint(cv, sh, rng, spec) {
  const light = spec.light || LIGHT;
  let s = '';
  // clipTo: undefined → own outline, null → unclipped (feathered edges), string → that path
  const clipD = spec.clipTo === undefined ? sh.d : spec.clipTo;
  const clipId = clipD ? cv.clip(clipD) : null;
  const opA = spec.baseOp ? ` opacity="${spec.baseOp}"` : '';
  // base colour: when clipped to its own outline, a clipped bbox rect avoids writing the path twice
  const rectBase = spec.base && clipD === sh.d && !spec.baseShape;
  if (spec.base && !rectBase) s += `<path d="${spec.baseShape ? spec.baseShape.d : sh.d}" fill="${spec.base}"${opA}/>`;
  s += clipId ? `<g clip-path="url(#${clipId})">` : '<g>';
  if (rectBase) {
    const b = sh.bb;
    s += `<rect x="${Math.floor(b.x0 - 2)}" y="${Math.floor(b.y0 - 2)}" width="${Math.ceil(b.w + 4)}" height="${Math.ceil(b.h + 4)}" fill="${spec.base}"${opA}/>`;
  }
  if (spec.under) s += spec.under;
  s += G_OPEN;
  (spec.passes || []).forEach((ps, i) => {
    const r = rng.fork('hatch' + i);
    const st = hatch(sh, r, {
      angle: spec.angle, light, exclude: spec.exclude, toneK: spec.toneK, toneFn: spec.toneFn,
      guides: spec.guides, outside: spec.outside || 0, ...ps,
    });
    s += render(st, { ...ps, rng: r });
  });
  s += '</g>';
  if (spec.over) s += spec.over;
  s += '</g>';
  s += paintRims(sh, rng, spec.rims || [], spec);
  s += paintScratches(sh, rng, spec.scratch, { light, exclude: spec.exclude });
  return { svg: s, clipId };
}

export function paintRims(sh, rng, rims, spec = {}) {
  if (!rims.length) return '';
  let s = G_OPEN;
  rims.forEach((rp, i) => {
    const r = rng.fork('rim' + i + (rp.key || ''));
    const st = rim(sh, r, rp);
    s += render(st, { ...rp, rng: r });
  });
  return s + '</g>';
}

export function paintScratches(sh, rng, scratch, ctx = {}) {
  if (!scratch) return '';
  const list = Array.isArray(scratch) ? scratch : [scratch];
  let s = G_OPEN;
  list.forEach((sc, i) => {
    const r = rng.fork('scr' + i);
    const st = scratches(sh, r, { light: ctx.light, exclude: ctx.exclude, ...sc });
    s += render(st, { c: sc.c || '#fffaf0', w: sc.w || [4.2, 3], op: sc.op ?? 0.92, split: 1, prec: 1, rng: r });
  });
  return s + '</g>';
}
