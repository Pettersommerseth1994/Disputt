// A Shape is a union of smooth closed parts (control points → Catmull-Rom curves).
// It knows its outline path (for fill + clipPath), a dense polygon per part, and the
// samples of the *exterior* boundary (with tangent + outward normal) used to make strokes
// follow the contour.

import { sampleSmooth, polyArea, pointInPoly, bbox, norm } from './geom.mjs';
import { smoothPath, PathWriter } from './path.mjs';

export class Shape {
  /**
   * @param {Array<Array<[number,number]>>|Array<[number,number]>} parts control points (one part or many)
   * @param {{step?:number, tension?:number, dense?:Array}} opts
   */
  constructor(parts, { step = 4, tension = 1, polys = null, d = null } = {}) {
    if (polys) {
      // precomputed dense polygons + path (e.g. eye openings built from Béziers)
      this.parts = polys.map((dense) => ({ cp: null, dense, area: polyArea(dense) }));
      this.d = d;
    } else {
      if (typeof parts[0][0] === 'number') parts = [parts];
      this.parts = parts.map((cp0) => {
        // all parts share one winding direction so nonzero fill/clip = union (no holes)
        let cp = cp0;
        let dense = sampleSmooth(cp, { closed: true, step, tension });
        if (polyArea(dense) < 0) {
          cp = cp0.slice().reverse();
          dense = sampleSmooth(cp, { closed: true, step, tension });
        }
        return { cp, dense, area: polyArea(dense) };
      });
      const pw = new PathWriter(1);
      for (const p of this.parts) smoothPath(p.cp, { closed: true, tension, pw });
      this.d = pw.toString();
    }

    // exterior boundary samples
    const bx = [], by = [], tx = [], ty = [], nx = [], ny = [];
    this.runs = []; // arrays of consecutive exterior sample indices (for rim strokes)
    this.inner = [];
    this.parts.forEach((part, pi) => {
      const pts = part.dense, n = pts.length;
      const sgn = part.area >= 0 ? 1 : -1;
      const ext = pts.map((p) => !this.parts.some((q, qi) => qi !== pi && pointInPoly(p, q.dense)));
      const idx = [];
      for (let k = 0; k < n; k++) {
        const a = pts[(k - 1 + n) % n], c = pts[(k + 1) % n];
        const t = norm([c[0] - a[0], c[1] - a[1]]);
        const out = sgn > 0 ? [t[1], -t[0]] : [-t[1], t[0]];
        idx.push(bx.length);
        bx.push(pts[k][0]); by.push(pts[k][1]);
        tx.push(t[0] * sgn); ty.push(t[1] * sgn); // consistent clockwise-ish tangent
        nx.push(out[0]); ny.push(out[1]);
      }
      part.ext = ext;
      part.idx = idx;
      // interior runs (outline segments hidden inside other parts) – for "grape" seams
      if (!ext.every(Boolean)) {
        let k0 = ext.findIndex(Boolean);
        if (k0 >= 0) {
          let cur = [];
          for (let s = 1; s <= n; s++) {
            const k = (k0 + s) % n;
            if (!ext[k]) cur.push(idx[k]);
            else if (cur.length) { this.inner.push({ idx: cur, closed: false }); cur = []; }
          }
          if (cur.length) this.inner.push({ idx: cur, closed: false });
        }
      }
      // cyclic runs of exterior samples
      if (ext.every(Boolean)) this.runs.push({ idx: idx.slice(), closed: true });
      else {
        let k0 = ext.findIndex((e) => !e);
        let cur = [];
        for (let s = 1; s <= n; s++) {
          const k = (k0 + s) % n;
          if (ext[k]) cur.push(idx[k]);
          else if (cur.length) { this.runs.push({ idx: cur, closed: false }); cur = []; }
        }
        if (cur.length) this.runs.push({ idx: cur, closed: false });
      }
    });
    this.bx = bx; this.by = by; this.tx = tx; this.ty = ty; this.nx = nx; this.ny = ny;
    this.ext = this.parts.flatMap((p) => p.ext);

    const all = this.parts.flatMap((p) => p.dense);
    this.bb = bbox(all);
    this.cx = this.bb.cx; this.cy = this.bb.cy;
    this.rx = this.bb.w / 2; this.ry = this.bb.h / 2;

    // approximate max depth (inscribed radius)
    let dm = 1;
    const g = Math.max(6, Math.min(this.bb.w, this.bb.h) / 14);
    for (let y = this.bb.y0; y <= this.bb.y1; y += g) {
      for (let x = this.bb.x0; x <= this.bb.x1; x += g) {
        if (this.inside([x, y])) dm = Math.max(dm, this.nearest([x, y]).d);
      }
    }
    this.depthMax = dm;
  }

  inside(p) {
    for (const q of this.parts) if (pointInPoly(p, q.dense)) return true;
    return false;
  }

  /** Nearest exterior boundary sample → {d, i, t:[x,y], n:[x,y], p:[x,y]} */
  nearest(p) {
    const { bx, by, ext } = this;
    let best = Infinity, bi = 0;
    const x = p[0], y = p[1];
    for (let i = 0; i < bx.length; i++) {
      if (!ext[i]) continue;
      const dx = bx[i] - x, dy = by[i] - y;
      const d = dx * dx + dy * dy;
      if (d < best) { best = d; bi = i; }
    }
    return {
      d: Math.sqrt(best), i: bi,
      t: [this.tx[bi], this.ty[bi]], n: [this.nx[bi], this.ny[bi]], p: [bx[bi], by[bi]],
    };
  }

  /** Signed-ish depth in [0,1]: 0 at the outline, 1 at the deepest point. */
  depth(p) { return Math.min(1, this.nearest(p).d / this.depthMax); }
}

export const shape = (parts, opts) => new Shape(parts, opts);
