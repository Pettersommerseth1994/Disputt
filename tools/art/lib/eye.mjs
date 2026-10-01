// The giant crayon eye: hatched eyelid "socket", sclera, ringed iris with fibres, pupil,
// white highlights, lash line, crease and lashes. Drawn in a local frame
// (centre 0,0; inner corner left, outer corner right) and placed with a transform.

import { Shape } from './shape.mjs';
import { paint, render, hatch, G_OPEN, LIGHT } from './pastel.mjs';
import { PathWriter } from './path.mjs';
import { blobPoints, lerpP, bezierPoint, clamp, smoothstep, DEG, TAU, norm, rot as rotP, lerp } from './geom.mjs';
import { tf } from './svg.mjs';

export function splitCubic(s, t) {
  const [p0, p1, p2, p3] = s;
  const a = lerpP(p0, p1, t), b = lerpP(p1, p2, t), c = lerpP(p2, p3, t);
  const d = lerpP(a, b, t), e = lerpP(b, c, t);
  const f = lerpP(d, e, t);
  return [[p0, a, d, f], [f, e, c, p3]];
}
export function subCubic(s, t0, t1) {
  const r = splitCubic(s, t0)[1];
  return splitCubic(r, (t1 - t0) / (1 - t0))[0];
}
export function cubicPts(s, n) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(bezierPoint(s, i / n));
  return out;
}
export function cubicTan(s, t) {
  const a = bezierPoint(s, Math.max(0, t - 0.01)), b = bezierPoint(s, Math.min(1, t + 0.01));
  return norm([b[0] - a[0], b[1] - a[1]]);
}
export const offsetCubic = (s, dx, dy) => s.map((p) => [p[0] + dx, p[1] + dy]);

/** Default colour set – lime's eye from ref 1. */
export const EYE_LIME = {
  socket: '#b170b4', socketLight: '#e6aee0', socketDark: '#7b3f9e', socketAlt: '#f48b8f',
  blend: ['#8cc63a', '#c4d74a'],
  sclera: '#e55666', scleraLight: '#f69aa0', scleraDark: '#a62f38', scleraHi: '#f9d0d2',
  iris: '#55b23a', irisLight: '#d4e65a', irisDark: '#2a7a3a', irisRing: '#2e7ece', irisRingDark: '#2230c8', irisInner: '#e8ef8a',
  pupil: '#1d1652', pupilLight: '#3340c8',
  lashLine: '#2a2a9e', lashInk: '#1c0a30', lash: '#2e7ece', lash2: '#2230c8', lowerLine: '#8e2a5a', water: '#f6c9cf', lidShadow: '#6e3592',
  hl: '#fffdf4', vein: '#a62f38',
};

const DEF_SOCKET = { rx: 1.3, ry: 0.95, dy: -0.1, dx: 0 };

function socketCP(rng, w, socket) {
  const hw = w / 2;
  return blobPoints(rng.fork('socket'), {
    cx: (socket.dx || 0) * w, cy: socket.dy * w, rx: hw * socket.rx, ry: hw * socket.ry,
    n: 11, jitter: 0.05, harmonics: [[2, 0.04], [3, 0.035]],
  });
}

/** The eye's socket outline in world coordinates (use as a hatch guide for the head). */
export function socketWorld(rng, o) {
  const socket = { ...DEF_SOCKET, ...(o.socket || {}) };
  const cp = socketCP(rng, o.w, socket).map((p) => {
    const q = [o.flip ? -p[0] : p[0], p[1]];
    const r = rotP(q, (o.rot || 0) * DEG);
    return [r[0] + o.x, r[1] + o.y];
  });
  return new Shape(cp);
}

export function eye(cv, rng, o) {
  const {
    x, y, w, rot = 0, flip = false,
    hu = 0.3, hl = 0.2, peak = 0,
    gaze = [0, 0], iris = 0.25, pupil = 0.42, pupilKind = 'round',
    c = EYE_LIME,
    lashes = { up: 8, down: 5, len: 0.13 },
    closed = null, tear = null, brow = null, veins = 0,
    hlPos = [0.62, -0.62], hlSize = 1, crease = 0.12,
    lidW = 1, detail = 1,
  } = o;
  const socket = o.socket === false ? null : { ...DEF_SOCKET, ...(o.socket || {}) };
  const hw = w / 2;
  const HU = hu * w, HL = hl * w;
  const S = (v) => v * w;
  const W = (v, min = 1.6) => +Math.max(min, v * w).toFixed(1);
  let s = `<g transform="${tf(x, y, rot)}${flip ? ' scale(-1 1)' : ''}">`;

  // ---- geometry -----------------------------------------------------------
  const P0 = [-hw, 0], P3 = [hw, 0];
  const pk = peak * hw;
  const up = [P0, [-hw * 0.62 + pk, -HU * 4 / 3], [hw * 0.38 + pk, -HU * 4 / 3], P3];
  const lo = [P3, [hw * 0.55, HL * 4 / 3], [-hw * 0.45, HL * 4 / 3], P0];
  const upPts = cubicPts(up, 24), loPts = cubicPts(lo, 24);
  const poly = [...upPts.slice(0, -1), ...loPts.slice(0, -1)];
  const opw = new PathWriter(1);
  opw.M(P0[0], P0[1]);
  opw.C(up[1][0], up[1][1], up[2][0], up[2][1], P3[0], P3[1]);
  opw.C(lo[1][0], lo[1][1], lo[2][0], lo[2][1], P0[0], P0[1]);
  opw.Z();
  const op = new Shape(null, { polys: [poly], d: opw.toString() });

  // ---- socket (eyelid region), feathered into the head --------------------
  if (socket) {
    const sr = rng.fork('socketpaint');
    const cp = socketCP(rng, w, socket);
    const sk = new Shape(cp);
    const cx0 = (socket.dx || 0) * w, cy0 = socket.dy * w;
    const inset = new Shape(cp.map((p) => [cx0 + (p[0] - cx0) * 0.86, cy0 + (p[1] - cy0) * 0.86]));
    const ell = (p) => {
      const hy = p[1] < 0 ? HU : HL;
      return Math.hypot(p[0] / hw, p[1] / Math.max(hy, S(0.05)));
    };
    const toneFn = (p) => {
      const e = ell(p);
      const lit = p[1] < 0 ? 0.1 : -0.06;
      return clamp(0.06 + 0.85 * smoothstep(1.02, 2.0, e) + lit);
    };
    const pl = { follow: 0.35, band: S(0.05), angle: 0, jitter: 13, bend: 0.16, soft: 0.2, toneJitter: 0.13, guides: [{ shape: op, band: S(0.16), w: 1.2 }] };
    // crayon strokes keep a minimum physical size, even on small eyes
    const sp = Math.max(6, S(0.032)) * detail, ln = [Math.max(10, S(0.07)), Math.max(18, S(0.16))];
    const Wm = (v) => W(v, 2.8);
    s += paint(cv, sk, sr, {
      base: c.socket, baseShape: inset, clipTo: null, outside: S(socket.feather ?? 0.07), toneFn,
      passes: [
        { ...pl, c: c.socket, w: Wm(0.034), op: 0.75, sp: sp * 1.3, len: ln },
        { ...pl, c: c.socketAlt, w: Wm(0.03), op: 0.45, sp: sp * 1.5, len: ln, tone: [0.3, 0.85] },
        { ...pl, c: c.socketDark, w: Wm(0.028), op: 0.6, sp, len: ln, tone: [0, 0.4] },
        { ...pl, c: c.socketLight, w: Wm(0.03), op: 0.62, sp, len: ln, tone: [0.55, 1] },
        { ...pl, c: c.hl, w: W(0.016, 2), op: 0.4, sp: sp * 2.2, len: [Math.max(6, S(0.04)), Math.max(10, S(0.09))], tone: [0.82, 1] },
      ],
      rims: [
        { c: c.blend[0], w: W(0.03), op: 0.5, len: [S(0.06), S(0.14)], inset: [-S(0.03), S(0.02)], prob: socket.blendProb ?? 0.55, key: 'a' },
      ],
    }).svg;
  }

  // ---- crease ---------------------------------------------------------------
  if (crease && !closed) {
    const cr = rng.fork('crease');
    const k = 1 + crease * 2.2;
    const cs = [
      [-hw * 0.9, -S(0.03)],
      [up[1][0], up[1][1] * k - S(crease * 0.3)],
      [up[2][0], up[2][1] * k - S(crease * 0.3)],
      [hw * 0.95, -S(0.05)],
    ];
    s += G_OPEN;
    s += render([{ cubic: subCubic(cs, 0.08, 0.6) }, { cubic: subCubic(cs, 0.35 + cr.range(0, 0.1), 0.88) }],
      { c: c.socketDark, w: [W(0.024)], op: 0.7, split: 1, prec: 1, rng: cr });
    s += render([{ cubic: offsetCubic(subCubic(cs, 0.15, 0.8), 0, -S(0.022)) }],
      { c: c.socketLight, w: W(0.02), op: 0.6, split: 1, prec: 1, rng: cr });
    s += '</g>';
  }

  if (closed) {
    // ---- closed / winking lid ----------------------------------------------
    const cr = rng.fork('closed');
    const bulge = closed === 'up' ? -HU * 0.9 : HL * 1.1;
    const lid = [P0, [-hw * 0.5, bulge * 4 / 3], [hw * 0.5, bulge * 4 / 3], P3];
    s += G_OPEN;
    s += lashLine(lid, c, W, S, cr, lidW * 1.15);
    const ls = [];
    const n = lashes.up;
    for (let i = 0; i < n; i++) {
      const t = lerp(0.14, 0.9, (i + cr.range(-0.2, 0.2)) / (n - 1));
      const p = bezierPoint(lid, t), tg = cubicTan(lid, t);
      let nn = [-tg[1], tg[0]];
      if (nn[1] < 0) nn = [-nn[0], -nn[1]];
      nn = rotP(nn, (lerp(25, -30, t) + cr.range(-8, 8)) * DEG);
      const L = S(lashes.len) * (0.6 + 0.5 * Math.sin(Math.PI * t)) * cr.range(0.8, 1.2);
      const e = [p[0] + nn[0] * L, p[1] + nn[1] * L];
      const m = [lerp(p[0], e[0], 0.5) + tg[0] * L * 0.18, lerp(p[1], e[1], 0.5) + tg[1] * L * 0.18];
      ls.push([p, m, e]);
    }
    s += render(ls, { c: c.lash, w: [W(0.012, 1.5), W(0.009, 1.3)], op: 0.95, split: 1, prec: 1, rng: cr });
    s += '</g>';
  } else {
    // ---- opening: sclera ---------------------------------------------------
    const er = rng.fork('open');
    const ytop = (px) => -HU * (1 - Math.min(1, (px / hw) ** 2)), ybot = (px) => HL * (1 - Math.min(1, (px / hw) ** 2));
    const scleraTone = (p) => {
      const v = clamp((p[1] - ytop(p[0])) / Math.max(1, ybot(p[0]) - ytop(p[0])));
      const side = Math.abs(p[0]) / hw;
      return clamp(0.05 + 0.62 * (1 - side ** 1.5) + 0.42 * smoothstep(0.08, 0.75, v));
    };
    const R = iris * w;
    const rp = pupil * R;
    const ic = [gaze[0] * Math.max(0, hw - R * 0.9), (HL - HU) / 2 + gaze[1] * R * 0.55];
    const pl = { angle: 0, jitter: 10, follow: 0.75, band: S(0.06), bend: 0.12, toneFn: scleraTone };
    let inner = '';
    inner += G_OPEN;
    const spS = Math.max(5.2, S(0.026)) * detail;
    const L1 = (a, b) => [Math.max(8, S(a)), Math.max(14, S(b))];
    for (const [i, ps] of [
      { c: c.scleraLight, w: W(0.028, 2.6), op: 0.7, sp: spS, len: L1(0.05, 0.12), tone: [0.42, 1] },
      { c: c.scleraDark, w: W(0.028, 2.6), op: 0.6, sp: spS, len: L1(0.04, 0.1), tone: [0, 0.4] },
      { c: c.scleraHi || c.hl, w: W(0.02, 2), op: 0.5, sp: spS * 2.2, len: L1(0.03, 0.08), tone: [0.78, 1] },
    ].entries()) {
      const r = er.fork('s' + i);
      const st = hatch(op, r, { ...pl, ...ps });
      inner += render(st, { ...ps, rng: r });
    }
    // veins
    if (veins) {
      const vr = er.fork('veins');
      const vs = [];
      for (let i = 0; i < veins; i++) {
        const side = i % 2 ? 1 : -1;
        let p = [side * hw * vr.range(0.72, 0.95), vr.range(-HU * 0.2, HL * 0.3)];
        const pts = [p];
        let a = side > 0 ? Math.PI + vr.range(-0.4, 0.4) : vr.range(-0.4, 0.4);
        for (let k = 0; k < 4; k++) {
          a += vr.range(-0.7, 0.7);
          p = [p[0] + Math.cos(a) * S(0.04), p[1] + Math.sin(a) * S(0.03)];
          pts.push(p);
        }
        vs.push({ poly: pts });
      }
      inner += render(vs, { c: c.vein, w: W(0.008, 1.2), op: 0.8, split: 1, prec: 1, rng: vr });
    }
    inner += '</g>';

    // ---- iris -------------------------------------------------------------
    const ir = rng.fork('iris');
    const icx = +ic[0].toFixed(1), icy = +ic[1].toFixed(1);
    inner += `<circle cx="${icx}" cy="${icy}" r="${+R.toFixed(1)}" fill="${c.iris}"/>`;
    inner += G_OPEN;
    const fibL = [], fibD = [];
    const nf = Math.round(30 * Math.min(1.3, Math.max(0.6, R / 50)));
    for (let k = 0; k < nf; k++) {
      const a = (k / nf) * TAU + ir.range(-0.08, 0.08);
      const r0 = rp * ir.range(1.05, 1.3), r1 = R * ir.range(0.72, 0.95);
      const st = [[ic[0] + Math.cos(a) * r0, ic[1] + Math.sin(a) * r0],
        [ic[0] + Math.cos(a + 0.05) * (r0 + r1) / 2, ic[1] + Math.sin(a + 0.05) * (r0 + r1) / 2],
        [ic[0] + Math.cos(a) * r1, ic[1] + Math.sin(a) * r1]];
      (k % 2 ? fibD : fibL).push(st);
    }
    inner += render(fibL, { c: c.irisLight, w: W(0.014), op: 0.7, split: 1, prec: 1, rng: ir });
    inner += render(fibD, { c: c.irisDark, w: W(0.012), op: 0.55, split: 1, prec: 1, rng: ir });
    inner += render(arcs(ir, ic, rp * 1.5, 2, 0.04), { c: c.irisInner, w: W(R * 0.24 / w), op: 0.55, split: 1, prec: 1, rng: ir });
    inner += render(arcs(ir, ic, R * 0.86, 3, 0.03), { c: c.irisRing, w: W(R * 0.24 / w), op: 0.85, split: 1, prec: 1, rng: ir });
    inner += render(arcs(ir, ic, R * 0.97, 2, 0.02), { c: c.irisRingDark, w: W(R * 0.1 / w), op: 0.85, split: 1, prec: 1, rng: ir });
    inner += '</g>';
    // ---- pupil ------------------------------------------------------------
    if (pupilKind === 'slit') {
      const ry = R * 0.86, rx = rp * 0.42;
      const pp = new PathWriter(1);
      pp.M(ic[0], ic[1] - ry).Q(ic[0] + rx * 2, ic[1], ic[0], ic[1] + ry).Q(ic[0] - rx * 2, ic[1], ic[0], ic[1] - ry).Z();
      inner += `<path d="${pp}" fill="${c.pupil}"/>`;
    } else if (pupilKind === 'spiral') {
      const pts = [];
      const turns = 3.2, nPts = 46;
      for (let i = 0; i <= nPts; i++) {
        const t = i / nPts;
        const a = t * turns * TAU;
        const r = R * 0.08 + t * R * 0.78;
        pts.push([ic[0] + Math.cos(a) * r, ic[1] + Math.sin(a) * r]);
      }
      inner += `<circle cx="${icx}" cy="${icy}" r="${+(R * 0.12).toFixed(1)}" fill="${c.pupil}"/>`;
      inner += G_OPEN + render([{ poly: pts }], { c: c.pupil, w: W(R * 0.13 / w), op: 0.95, split: 1, prec: 1, rng: ir }) + '</g>';
    } else {
      inner += `<circle cx="${icx}" cy="${icy}" r="${+rp.toFixed(1)}" fill="${c.pupil}"/>`;
      inner += G_OPEN + render(arcs(ir, ic, rp * 0.72, 2, 0.05), { c: c.pupilLight, w: W(rp * 0.22 / w), op: 0.45, split: 1, prec: 1, rng: ir }) + '</g>';
    }

    // ---- upper-lid shadow + waterline (inside the opening) ------------------
    const lr = rng.fork('lidsh');
    inner += G_OPEN;
    const shadow = [];
    for (const [a, b] of [[0, 0.55], [0.28, 0.8], [0.5, 1]]) {
      shadow.push({ cubic: offsetCubic(subCubic(up, a, b), 0, S(lr.range(0.008, 0.022))) });
    }
    inner += render(shadow, { c: c.lidShadow, w: W(0.05), op: 0.55, split: 1, prec: 1, rng: lr });
    inner += render([{ cubic: offsetCubic(subCubic(lo, 0.06, 0.92), 0, -S(0.012)) }], { c: c.water, w: W(0.022), op: 0.6, split: 1, prec: 1, rng: lr });
    inner += '</g>';

    // ---- highlights ---------------------------------------------------------
    const hr = rng.fork('hl');
    let wo = rotP([hlPos[0], hlPos[1]], -rot * DEG);
    if (flip) wo = [-wo[0], wo[1]];
    const hs = R * 0.32 * hlSize;
    const hc = [ic[0] + wo[0] * rp * 1.15, ic[1] + wo[1] * rp * 1.15];
    const hlStrokes = [
      [[hc[0] - hs * 0.28, hc[1] - hs * 0.18], [hc[0], hc[1] - hs * 0.24], [hc[0] + hs * 0.26, hc[1] - hs * 0.16]],
      [[hc[0] - hs * 0.22, hc[1] + hs * 0.16], [hc[0], hc[1] + hs * 0.2], [hc[0] + hs * 0.24, hc[1] + hs * 0.12]],
    ];
    inner += G_OPEN + render(hlStrokes, { c: c.hl, w: W(hs * 0.62 / w), op: 0.96, split: 1, prec: 1, rng: hr });
    const sd = [ic[0] - wo[0] * R * 0.55, ic[1] - wo[1] * R * 0.5];
    inner += render([{ dot: sd }], { c: c.hl, w: W(R * 0.14 / w), op: 0.9, split: 1, prec: 1, rng: hr });
    inner += '</g>';

    const clipId = cv.clip(op.d);
    s += `<path d="${op.d}" fill="${c.sclera}"/><g clip-path="url(#${clipId})">${inner}</g>`;

    // ---- lash line, lower lid ----------------------------------------------
    const lr2 = rng.fork('lash');
    s += G_OPEN;
    s += lashLine(up, c, W, S, lr2, lidW);
    s += render([{ cubic: subCubic(lo, 0.03, 0.6) }, { cubic: subCubic(lo, 0.4, 0.97) }], { c: c.lowerLine, w: W(0.018), op: 0.8, split: 1, prec: 1, rng: lr2 });
    s += render([{ cubic: offsetCubic(subCubic(lo, 0.2, 0.75), 0, S(0.008)) }], { c: c.lowerLine, w: W(0.026), op: 0.45, split: 1, prec: 1, rng: lr2 });

    // ---- lashes -------------------------------------------------------------
    const ups = [], downs = [];
    for (let i = 0; i < lashes.up; i++) {
      const t = lerp(0.1, 0.94, (i + lr2.range(-0.3, 0.3)) / Math.max(1, lashes.up - 1));
      const p = bezierPoint(up, t), tg = cubicTan(up, t);
      let nn = [tg[1], -tg[0]];
      if (nn[1] > 0) nn = [-nn[0], -nn[1]];
      const reps = lr2.chance(0.3) ? 2 : 1;
      for (let r = 0; r < reps; r++) {
        const nr = rotP(nn, (lerp(-30, 40, t) + lr2.range(-9, 9) + r * 9) * DEG);
        const L = S(lashes.len) * (0.5 + 0.65 * Math.sin(Math.PI * t)) * lr2.range(0.75, 1.25) * (r ? 0.7 : 1);
        const b = [p[0] + nr[0] * S(0.008) + tg[0] * r * S(0.012), p[1] + nr[1] * S(0.008) + tg[1] * r * S(0.012)];
        const e = [b[0] + nr[0] * L, b[1] + nr[1] * L];
        const bend = lr2.range(0.08, 0.26);
        const m = [lerp(b[0], e[0], 0.5) + tg[0] * L * bend, lerp(b[1], e[1], 0.5) + tg[1] * L * bend];
        ups.push([b, m, e]);
      }
    }
    for (let i = 0; i < lashes.down; i++) {
      const t = lerp(0.1, 0.82, (i + lr2.range(-0.3, 0.3)) / Math.max(1, lashes.down - 1));
      const p = bezierPoint(lo, t), tg = cubicTan(lo, t);
      let nn = [tg[1], -tg[0]];
      if (nn[1] < 0) nn = [-nn[0], -nn[1]];
      nn = rotP(nn, (lerp(-30, 10, t) + lr2.range(-10, 10)) * DEG);
      const L = S(lashes.len) * 0.5 * (0.6 + 0.5 * Math.sin(Math.PI * t)) * lr2.range(0.7, 1.3);
      const b = [p[0] + nn[0] * S(0.012), p[1] + nn[1] * S(0.012)];
      const e = [b[0] + nn[0] * L, b[1] + nn[1] * L];
      downs.push([b, lerpP(b, e, 0.5), e]);
    }
    s += render(ups, { c: c.lash, w: [W(0.011, 1.5), W(0.008, 1.3)], op: 0.92, split: 1, prec: 1, rng: lr2 });
    s += render(downs, { c: c.lash2 || c.lash, w: [W(0.01, 1.4), W(0.008, 1.2)], op: 0.85, split: 1, prec: 1, rng: lr2 });
    s += '</g>';
  }

  // ---- tear -----------------------------------------------------------------
  if (tear) {
    const tr = rng.fork('tear');
    const tx = (tear.x ?? 0.62) * hw, ty = HL + S(tear.y ?? 0.16);
    const r = S(tear.r ?? 0.075);
    s += drop(cv, tr, tx, ty, r, tear.c, W, S);
    s += G_OPEN + render([[[hw * 0.78, HL * 0.35], [tx + r * 0.3, (HL * 0.35 + ty - r * 2.3) / 2], [tx, ty - r * 2]]],
      { c: (tear.c && tear.c.light) || '#e3f3f7', w: W(0.016), op: 0.75, split: 1, prec: 1, rng: tr }) + '</g>';
  }

  // ---- brow -----------------------------------------------------------------
  if (brow) {
    const br = rng.fork('brow');
    const by = -S(brow.y ?? 0.62), tilt = (brow.tilt ?? 0) * DEG;
    const bl = hw * (brow.len ?? 1);
    const strokes = [];
    for (let i = 0; i < 4; i++) {
      const o2 = S(0.011) * (i - 1.5);
      const k = 1 - Math.abs(i - 1.5) * 0.16; // outer strokes shorter → tapered ends
      const a = rotP([-bl * k + br.range(-4, 4), by + o2], tilt, [0, by]), b = rotP([bl * k + br.range(-4, 4), by - o2 * 0.5], tilt, [0, by]);
      const m = rotP([br.range(-5, 5), by - S(brow.arch ?? 0.08) + o2], tilt, [0, by]);
      strokes.push([a, m, b]);
    }
    s += G_OPEN + render(strokes, { c: brow.c || c.lashLine, w: [W(brow.w ?? 0.06), W((brow.w ?? 0.06) * 0.7)], op: 0.9, split: 1, prec: 1, rng: br });
    if (brow.hi) {
      // lighter crayon pass along the top of the brow
      const a = rotP([-bl * 0.8, by - S(0.02)], tilt, [0, by]), b = rotP([bl * 0.75, by - S(0.02)], tilt, [0, by]);
      const m = rotP([0, by - S(brow.arch ?? 0.08) - S(0.02)], tilt, [0, by]);
      s += render([[a, m, b]], { c: brow.hi, w: W((brow.w ?? 0.06) * 0.35), op: 0.7, split: 1, prec: 1, rng: br });
    }
    s += '</g>';
  }

  return s + '</g>';
}

/** Crayon lash line: several overlapping partial strokes of varying weight. */
function lashLine(curve, c, W, S, rng, k = 1) {
  const parts = [];
  const segs = [[0.0, 0.58], [0.22, 0.82], [0.45, 1.0], [0.1, 0.9]];
  for (const [a, b] of segs) {
    parts.push({ cubic: offsetCubic(subCubic(curve, Math.max(0.005, a + rng.range(-0.03, 0.03)), Math.min(0.995, b + rng.range(-0.03, 0.03))), rng.range(-1, 1), S(rng.range(-0.006, 0.004))) });
  }
  let s = render(parts.slice(0, 3), { c: c.lashLine, w: [W(0.03 * k), W(0.022 * k)], op: 0.85, split: 1, prec: 1, rng });
  s += render([parts[3]], { c: c.lashLine, w: W(0.042 * k), op: 0.7, split: 1, prec: 1, rng });
  s += render([{ cubic: subCubic(curve, 0.04, 0.96) }], { c: c.lashInk || c.lashLine, w: W(0.012 * k, 1.3), op: 0.7, split: 1, prec: 1, rng });
  return s;
}

/** Tear / rain drop. */
export function drop(cv, rng, tx, ty, r, col, W, S) {
  const pts = [[tx, ty - r * 2.3]];
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + 0.75 + (i / 8) * (TAU - 1.5);
    pts.push([tx + Math.cos(a) * r, ty + Math.sin(a) * r]);
  }
  const tsh = new Shape(pts);
  const tc = col || { base: '#88c6db', light: '#e3f3f7', dark: '#2e7ece', rim: '#2230c8' };
  const sw = Math.max(1.6, r * 0.28);
  return paint(cv, tsh, rng, {
    base: tc.base,
    passes: [
      { c: tc.dark, w: sw, op: 0.5, sp: r * 0.33, len: [r * 0.4, r * 0.8], follow: 1, band: 99, tone: [0, 0.5] },
      { c: tc.light, w: sw, op: 0.6, sp: r * 0.33, len: [r * 0.4, r * 0.8], follow: 1, band: 99, tone: [0.5, 1] },
    ],
    rims: [{ c: tc.rim, w: Math.max(1.6, r * 0.22), op: 0.85, len: [r * 0.6, r * 1.3], inset: [0, r * 0.1] }],
    scratch: { n: 1, dots: 1, len: [r * 0.4, r * 0.7], depth: [0.25, 0.7], w: [Math.max(1.5, r * 0.22)], minGap: 2, lit: 1 },
  }).svg;
}

/** Hand-drawn ring made of overlapping arcs. */
export function arcs(rng, c, r, n, wob = 0.03) {
  const out = [];
  const a0 = rng.range(0, TAU);
  for (let i = 0; i < n; i++) {
    const st = a0 + (i / n) * TAU + rng.range(-0.3, 0.3);
    const span = rng.range(0.62, 0.8) * TAU;
    out.push({ arc: { cx: c[0] + rng.range(-wob, wob) * r, cy: c[1] + rng.range(-wob, wob) * r, r: r * rng.range(0.97, 1.03), a0: st, a1: st + span } });
  }
  return out;
}

export { LIGHT };
