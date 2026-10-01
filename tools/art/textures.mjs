// Seamless PNG texture tiles, rasterised in JS (seeded) and encoded with sharp.
//   grain.png        256² – fine paper speckle (white + dark), low alpha
//   crayon-light.png 512² – cream/white directional crayon strokes (alpha ≈ .06–.28)
//   crayon-dark.png  512² – burgundy/black crayon strokes (alpha ≈ .06–.22)
// Every stroke is drawn with toroidal wrap-around, and all noise is periodic, so tiles repeat
// without seams.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Rng } from './lib/rng.mjs';

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

/** Periodic value noise on a w×h torus with the given cell size (must divide w and h). */
function periodicNoise(rng, w, h, cell) {
  const gw = Math.round(w / cell), gh = Math.round(h / cell);
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = rng.next();
  const out = new Float32Array(w * h);
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) {
    const fy = y / cell, y0 = Math.floor(fy), ty = sm(fy - y0);
    const ya = ((y0 % gh) + gh) % gh, yb = (ya + 1) % gh;
    for (let x = 0; x < w; x++) {
      const fx = x / cell, x0 = Math.floor(fx), tx = sm(fx - x0);
      const xa = ((x0 % gw) + gw) % gw, xb = (xa + 1) % gw;
      const a = g[ya * gw + xa], b = g[ya * gw + xb], c = g[yb * gw + xa], d = g[yb * gw + xb];
      out[y * w + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}

class Buf {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.r = new Float32Array(w * h); this.g = new Float32Array(w * h); this.b = new Float32Array(w * h); this.a = new Float32Array(w * h);
  }
  over(i, rgb, a) { // premultiplied source-over
    const ia = 1 - a;
    this.r[i] = rgb[0] * a + this.r[i] * ia;
    this.g[i] = rgb[1] * a + this.g[i] * ia;
    this.b[i] = rgb[2] * a + this.b[i] * ia;
    this.a[i] = a + this.a[i] * ia;
  }
  toRGBA(maxA = 1) {
    const out = Buffer.alloc(this.w * this.h * 4);
    for (let i = 0; i < this.w * this.h; i++) {
      const a = this.a[i];
      const k = a > 0 ? 1 / a : 0;
      const A = Math.min(maxA, a);
      out[i * 4] = Math.round(Math.min(1, this.r[i] * k) * 255);
      out[i * 4 + 1] = Math.round(Math.min(1, this.g[i] * k) * 255);
      out[i * 4 + 2] = Math.round(Math.min(1, this.b[i] * k) * 255);
      out[i * 4 + 3] = Math.round(A * 255);
    }
    return out;
  }
}

/**
 * One waxy crayon stroke (slightly curved, round-ended) on a torus.
 * Alpha is modulated by streaks running along the stroke and by the paper grain.
 */
function crayonStroke(buf, rng, grain, { x, y, ang, len, wid, rgb, alpha, bend, toothOn = true, streakOn = true }) {
  const { w, h } = buf;
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const hl = len / 2, hw = wid / 2;
  const pad = hw + Math.abs(bend) + 2;
  const ext = hl + pad;
  const x0 = Math.floor(x - ext), x1 = Math.ceil(x + ext), y0 = Math.floor(y - ext), y1 = Math.ceil(y + ext);
  // streak profile across the stroke (1D noise in v), different for every stroke
  const ns = 9, prof = [];
  for (let i = 0; i <= ns; i++) prof.push([0.35, 0.6, 0.85, 1][rng.int(0, 3)]);
  const streak = (v) => {
    const t = ((v / wid) + 0.5) * ns, i = Math.max(0, Math.min(ns, Math.round(t)));
    return prof[i];
  };
  const press = 0.75 + 0.25 * rng.next();
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const rx = px + 0.5 - x, ry = py + 0.5 - y;
      let u = rx * dx + ry * dy;
      let v = rx * nx + ry * ny;
      // curved spine: v offset by a parabola in u
      const uc = Math.max(-hl, Math.min(hl, u));
      v -= bend * (1 - (uc / hl) ** 2);
      // capsule distance
      const du = Math.abs(u) > hl ? Math.abs(u) - hl : 0;
      const d = Math.hypot(du, v);
      const cov = Math.max(0, Math.min(1, hw - d + 0.5));
      if (cov <= 0) continue;
      const X = ((px % w) + w) % w, Y = ((py % h) + h) % h;
      const i = Y * w + X;
      const gr = grain[i];
      // tooth: light pressure skips the paper's low points
      const tooth = !toothOn ? 1 : gr < 0.32 ? 0.15 : gr < 0.42 ? 0.55 : 1;
      const end = Math.min(1, (hl + hw - Math.abs(u)) / (hw * 1.6));
      const a = alpha * press * cov * (streakOn ? streak(v) : 1) * tooth * Math.max(0.2, end);
      if (a > 0.002) buf.over(i, rgb, Math.min(1, a));
    }
  }
}

export function crayonTile(seed, { size = 512, colors, alpha, angle = -35, jitter = 10, cell = 21, perCell = 1.3, len = [34, 90], wid = [8, 17], maxA = 0.3, toothOn = true, streakOn = true, grainMix = [0.45, 0.3, 0.25] }) {
  const rng = new Rng(seed);
  const buf = new Buf(size, size);
  const grain = (() => {
    const a = periodicNoise(rng.fork('g1'), size, size, 2), b = periodicNoise(rng.fork('g2'), size, size, 4), c = periodicNoise(rng.fork('g3'), size, size, 1);
    const out = new Float32Array(size * size);
    for (let i = 0; i < out.length; i++) out[i] = grainMix[0] * a[i] + grainMix[1] * b[i] + grainMix[2] * c[i];
    return out;
  })();
  const pressure = periodicNoise(rng.fork('p'), size, size, 128);
  const g = Math.round(size / cell);
  const cells = g * g;
  const n = Math.round(cells * perCell);
  const cols = colors.map(hex);
  const sr = rng.fork('strokes');
  for (let k = 0; k < n; k++) {
    // one stroke per grid cell (even coverage), the remainder anywhere
    let x, y;
    if (k < cells) { x = ((k % g) + sr.next()) * (size / g); y = (Math.floor(k / g) + sr.next()) * (size / g); }
    else { x = sr.next() * size; y = sr.next() * size; }
    const pz = pressure[(Math.floor(y) % size) * size + (Math.floor(x) % size)];
    const ang = (angle + sr.gauss(0, jitter * 0.7)) * Math.PI / 180;
    const L = sr.range(len[0], len[1]);
    crayonStroke(buf, sr, grain, {
      x, y, ang, len: L, wid: sr.range(wid[0], wid[1]),
      rgb: cols[sr.int(0, cols.length - 1)],
      alpha: (alpha[0] + (alpha[1] - alpha[0]) * sr.next()) * (0.82 + 0.3 * pz),
      bend: sr.range(-0.08, 0.08) * L, toothOn, streakOn,
    });
  }
  return buf.toRGBA(maxA);
}

function grainTile(seed, size = 256) {
  const rng = new Rng(seed);
  const n1 = periodicNoise(rng.fork('a'), size, size, 1);
  const n2 = periodicNoise(rng.fork('b'), size, size, 2);
  const n4 = periodicNoise(rng.fork('c'), size, size, 8);
  const out = Buffer.alloc(size * size * 4);
  const light = hex('#fff6e3'), dark = hex('#1c0a10');
  const r = rng.fork('px');
  for (let i = 0; i < size * size; i++) {
    const v = 0.5 * n1[i] + 0.35 * n2[i] + 0.15 * n4[i];
    let rgb = light, a = 0;
    if (v > 0.66) { rgb = light; a = 0.3 + 0.5 * Math.min(1, (v - 0.66) / 0.12); }
    else if (v < 0.33) { rgb = dark; a = 0.22 + 0.4 * Math.min(1, (0.33 - v) / 0.12); }
    else { rgb = r.next() < 0.5 ? light : dark; a = 0.035 * r.next(); }
    out[i * 4] = Math.round(rgb[0] * 255);
    out[i * 4 + 1] = Math.round(rgb[1] * 255);
    out[i * 4 + 2] = Math.round(rgb[2] * 255);
    out[i * 4 + 3] = Math.round(a * 255);
  }
  return out;
}

export async function writePNG(file, rgba, size, colors, dither = 0) {
  await sharp(rgba, { raw: { width: size, height: size, channels: 4 } })
    .png({ compressionLevel: 9, effort: 10, palette: true, colors, dither })
    .toFile(file);
  const { size: bytes } = await import('node:fs').then((fs) => fs.promises.stat(file));
  return { file, size: bytes };
}

export async function buildTextures(root) {
  const dir = join(root, 'public', 'assets', 'textures');
  mkdirSync(dir, { recursive: true });
  const out = [];
  out.push(await writePNG(join(dir, 'grain.png'), grainTile("grain"), 256, 16));
  out.push(await writePNG(join(dir, 'crayon-light.png'), crayonTile('crayon-light', {
    colors: ['#fff8ea', '#ffffff'], alpha: [0.08, 0.28], maxA: 0.32,
  }), 512, 16));
  out.push(await writePNG(join(dir, 'crayon-dark.png'), crayonTile('crayon-dark', {
    colors: ['#1c0a10', '#3a0a18'], alpha: [0.07, 0.22], maxA: 0.27,
  }), 512, 16));
  return out;
}
