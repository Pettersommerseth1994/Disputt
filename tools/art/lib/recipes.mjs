// Shared paint recipes so every creature speaks the same stroke vocabulary.

/**
 * Standard pastel blob: base → mid → shadow tones → neighbour hue → light tones → rims → scratches.
 * pal: { base, mid, dark, deep, alt, light, pale, warm, rim, rim2, rimDeep }
 * o:   { sc (size scale), angle, follow, band, density, exclude, scratch, alt/warm opacity ... }
 */
export function pastelSpec(pal, o = {}) {
  const sc = o.sc ?? 1;
  const d = o.density ?? 1;
  const sp = 9 * sc / d;
  const len = [22 * sc, 46 * sc];
  const f = { follow: o.follow ?? 0.85, band: (o.band ?? 60) * sc, bend: 0.1, jitter: o.jitter ?? 12, toneJitter: o.toneJitter ?? 0.07 };
  const W = (a) => +(a * (o.wsc ?? sc ** 0.6)).toFixed(1);
  const passes = [
    { ...f, c: pal.mid, w: [W(8), W(6)], op: 0.46, sp, len },
    { ...f, c: pal.dark, w: [W(7), W(5)], op: 0.58, sp, len: [18 * sc, 36 * sc], tone: [0, 0.36], follow: 1, band: 90 * sc },
  ];
  if (pal.deep) passes.push({ ...f, c: pal.deep, w: W(6), op: 0.55, sp: sp * 1.2, len: [16 * sc, 32 * sc], tone: [0, 0.17], follow: 1, band: 99 * sc });
  if (pal.alt) passes.push({ ...f, c: pal.alt, w: W(5), op: o.altOp ?? 0.36, sp: sp * 1.7, len: [16 * sc, 30 * sc], tone: o.altTone ?? [0, 0.3] });
  passes.push({ ...f, c: pal.light, w: [W(8), W(6)], op: 0.6, sp, len, tone: [0.48, 1] });
  if (pal.pale) passes.push({ ...f, c: pal.pale, w: [W(7), W(5)], op: 0.52, sp: sp * 1.2, len: [16 * sc, 34 * sc], tone: [0.68, 1] });
  if (pal.warm) passes.push({ ...f, c: pal.warm, w: W(6), op: o.warmOp ?? 0.42, sp: sp * 1.5, len: [16 * sc, 32 * sc], tone: o.warmTone ?? [0.56, 1] });
  const rims = [
    { c: pal.rim, w: [W(7), W(5)], op: 0.8, len: [24 * sc, 60 * sc], inset: [0, 4 * sc] },
    { c: pal.rim2 || pal.dark, w: W(9), op: 0.5, len: [20 * sc, 50 * sc], inset: [4 * sc, 12 * sc] },
  ];
  if (pal.rimDeep) rims.push({ c: pal.rimDeep, w: W(4), op: 0.75, len: [30 * sc, 70 * sc], inset: [-1, 2 * sc] });
  return {
    base: pal.base,
    angle: o.angle ?? -38,
    passes: (o.passesBefore || []).concat(passes, o.passesAfter || []),
    rims: (o.rimsBefore || []).concat(rims, o.rimsAfter || []),
    exclude: o.exclude,
    guides: o.guides,
    toneK: o.toneK,
    toneFn: o.toneFn,
    light: o.light,
    scratch: o.scratch === false ? null : {
      n: 20, dots: 9, len: [6 * sc, 14 * sc], depth: [0.05, 0.38], w: [W(4.4), W(3.2)], ...(o.scratch || {}),
    },
  };
}

export const PAPER = {};
