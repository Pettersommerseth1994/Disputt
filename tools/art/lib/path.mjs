// Compact SVG path writer.
// Coordinates are quantised to integer "units" (prec 0 = whole units, prec 1 = tenths) and
// written as relative commands, so rounding never accumulates and numbers stay short.

const UNIT = [1, 10, 100];

function fmtInt(i, prec) {
  if (i === 0) return '0';
  const neg = i < 0;
  const a = Math.abs(i);
  let s;
  if (prec === 0) s = String(a);
  else {
    const d = UNIT[prec];
    const whole = Math.floor(a / d);
    let frac = String(a % d).padStart(prec, '0').replace(/0+$/, '');
    s = frac ? (whole ? whole + '.' + frac : '.' + frac) : String(whole);
  }
  return neg ? '-' + s : s;
}

export class PathWriter {
  constructor(prec = 1) {
    this.prec = prec;
    this.k = UNIT[prec];
    this.out = '';
    this.cx = 0; this.cy = 0; // current point (quantised)
    this.sx = 0; this.sy = 0; // subpath start
    this.lastCmd = '';
    this.lastNum = null;
  }
  q(v) { return Math.round(v * this.k); }
  _emit(cmd, ints) {
    const repeat = cmd === this.lastCmd && cmd !== 'm' && cmd !== 'z';
    if (!repeat) { this.out += cmd; this.lastNum = null; }
    for (const v of ints) {
      const s = fmtInt(v, this.prec);
      if (this.lastNum !== null && !(s[0] === '-' || (s[0] === '.' && this.lastNum.includes('.')))) this.out += ' ';
      this.out += s;
      this.lastNum = s;
    }
    this.lastCmd = cmd;
  }
  M(x, y) {
    const X = this.q(x), Y = this.q(y);
    this._emit('m', [X - this.cx, Y - this.cy]);
    this.cx = this.sx = X; this.cy = this.sy = Y;
    this.lastCmd = 'm*'; // implicit lineto after m must not be merged with a following 'l'
    return this;
  }
  L(x, y) {
    const X = this.q(x), Y = this.q(y);
    this._emit('l', [X - this.cx, Y - this.cy]);
    this.cx = X; this.cy = Y;
    return this;
  }
  Q(x1, y1, x, y) {
    const X1 = this.q(x1), Y1 = this.q(y1), X = this.q(x), Y = this.q(y);
    this._emit('q', [X1 - this.cx, Y1 - this.cy, X - this.cx, Y - this.cy]);
    this.cx = X; this.cy = Y;
    return this;
  }
  C(x1, y1, x2, y2, x, y) {
    const X1 = this.q(x1), Y1 = this.q(y1), X2 = this.q(x2), Y2 = this.q(y2), X = this.q(x), Y = this.q(y);
    this._emit('c', [X1 - this.cx, Y1 - this.cy, X2 - this.cx, Y2 - this.cy, X - this.cx, Y - this.cy]);
    this.cx = X; this.cy = Y;
    return this;
  }
  /** Relative elliptical arc (flags are never quantised). */
  A(rx, ry, large, sweep, x, y) {
    const X = this.q(x), Y = this.q(y);
    const r1 = fmtInt(this.q(rx), this.prec), r2 = fmtInt(this.q(ry), this.prec);
    const dx = fmtInt(X - this.cx, this.prec), dy = fmtInt(Y - this.cy, this.prec);
    this.out += `a${r1} ${r2} 0 ${large ? 1 : 0} ${sweep ? 1 : 0} ${dx}${dy[0] === '-' ? '' : ' '}${dy}`;
    this.lastCmd = 'a*';
    this.lastNum = dy;
    this.cx = X; this.cy = Y;
    return this;
  }
  Z() {
    this.out += 'z';
    this.lastCmd = 'z';
    this.lastNum = null;
    this.cx = this.sx; this.cy = this.sy;
    return this;
  }
  /** Zero-ish length segment: a round-capped dot. */
  dot(x, y) {
    this.M(x, y);
    this._emit('l', [1, 0]);
    this.cx += 1;
    return this;
  }
  toString() { return this.out; }
}

/** Closed or open smooth path through points (Catmull-Rom → cubic Bézier). */
export function smoothPath(pts, { closed = true, prec = 1, tension = 1, pw = null } = {}) {
  const w = pw || new PathWriter(prec);
  const n = pts.length;
  if (n < 2) return w;
  const get = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  w.M(pts[0][0], pts[0][1]);
  const segs = closed ? n : n - 1;
  const t = tension / 6;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    w.C(
      p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t,
      p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t,
      p2[0], p2[1],
    );
  }
  if (closed) w.Z();
  return w;
}

export function polyPath(pts, { closed = true, prec = 1 } = {}) {
  const w = new PathWriter(prec);
  w.M(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) w.L(pts[i][0], pts[i][1]);
  if (closed) w.Z();
  return w.toString();
}
