// Draws shapes the way the game's characters are drawn: a flat base colour, lots of short hatching strokes in lighter and darker tones, a thin dark outline,
// and (on the whole group) the same filter as the avatars: a slow wobble, a rough edge, and a grain where the paper shows through.
// `u` scales everything from the avatars' 400-unit space to whatever space the drawing lives in (u = 1 in an avatar, about 0.15 in the 100-unit scene).
let n = 0;
export const uid = (p) => `${p}${++n}`;
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const INK = '#30211e';

export const TONES = {
  yellow: { base: '#f7d23b', tones: [['#fbe56e', 0.6], ['#e8a62a', 0.5], ['#fffaf0', 0.45]] },
  orange: { base: '#f8852c', tones: [['#fa9a3a', 0.6], ['#d4552a', 0.5], ['#e8604a', 0.45]] },
  pink: { base: '#f48b8f', tones: [['#f8b0a0', 0.6], ['#e55666', 0.5], ['#fff0ea', 0.45]] },
  cream: { base: '#fff6e3', tones: [['#f6e3c0', 0.5], ['#ffffff', 0.6], ['#ead3a6', 0.4]] },
  storm: { base: '#4b5a9a', tones: [['#6a7bbd', 0.6], ['#3a4780', 0.5], ['#8d9bd6', 0.45]] },
  red: { base: '#e0453d', tones: [['#ff7a70', 0.6], ['#b8321f', 0.55], ['#ffb0a0', 0.4]] },
  mouth: { base: '#4a0c18', tones: [['#7e1f2c', 0.55], ['#2a0610', 0.55], ['#a62f38', 0.4]] },
  tongue: { base: '#e55666', tones: [['#f48b8f', 0.6], ['#c4364a', 0.5], ['#f8b0a0', 0.4]] },
  teeth: { base: '#fff6e3', tones: [['#f6e3c0', 0.45], ['#ffffff', 0.6]] },
  drop: { base: '#bfe8ff', tones: [['#e8f7ff', 0.6], ['#8fcbf0', 0.5]] },
};

/** the avatars' filter, rescaled to a space where one avatar unit is `u` units */
export const filterDef = (id, u, box, seed = 21) => {
  const [x, y, w, h] = box;
  return `<filter id="${id}" filterUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${(0.022 / u).toFixed(4)}" numOctaves="1" seed="${seed}" result="a"/><feDisplacementMap in="SourceGraphic" in2="a" scale="${(4.5 * u).toFixed(3)}" xChannelSelector="R" yChannelSelector="G" result="b"/><feTurbulence type="fractalNoise" baseFrequency="${(0.75 / u).toFixed(3)}" numOctaves="2" seed="${seed + 2}" result="e"/><feDisplacementMap in="b" in2="e" scale="${(4.2 * u).toFixed(3)}" xChannelSelector="R" yChannelSelector="G" result="d"/><feTurbulence type="fractalNoise" baseFrequency="${(0.05 / u).toFixed(3)}" numOctaves="1" seed="${seed + 3}" result="e2"/><feComposite in="e" in2="e2" operator="arithmetic" k2="0.6" k3="0.4" result="n"/><feComponentTransfer in="n" result="s"><feFuncA type="table" tableValues="0.75 0.75 0.75 0.75 0.75 0.75 0.75 0.75 0.75 0.75 0.75 0.75 0.75 0.71 0.39 0.07 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0"/></feComponentTransfer><feFlood flood-color="#fff6e3"/><feComposite in2="s" operator="in"/><feComposite in2="d" operator="in" result="g"/><feMerge><feMergeNode in="d"/><feMergeNode in="g"/></feMerge></filter>`;
};

/** a wobbly closed path round an ellipse (hand drawn), through n points, smoothed */
export const blobPath = (cx, cy, rx, ry, seed = 1, j = 0.06, pts = 10) => {
  const r = rng(seed);
  const p = Array.from({ length: pts }, (_, i) => { const a = (i / pts) * Math.PI * 2 + (r() - 0.5) * 0.15; const k = 1 + (r() - 0.5) * 2 * j; return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]; });
  const f = (v) => v.toFixed(1);
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < pts; i++) {
    const p0 = p[(i - 1 + pts) % pts], p1 = p[i], p2 = p[(i + 1) % pts], p3 = p[(i + 2) % pts];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
};
export const polyPath = (pts) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;

/** the hatching strokes, filling a box */
const hatch = (box, tones, { u, seed, density = 1.3, angle = -58 }) => {
  const r = rng(seed);
  const [x, y, w, h] = box;
  const sw = 4.5 * u, len = 12 * u;
  const count = Math.min(520, Math.round(((w * h) / (sw * len)) * density));
  let out = '';
  for (let i = 0; i < count; i++) {
    const [col, op] = tones[Math.floor(r() * tones.length)];
    const a = ((angle + (r() - 0.5) * 36) * Math.PI) / 180;
    const l = len * (0.5 + r());
    const x0 = x + r() * w, y0 = y + r() * h;
    out += `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)}l${(Math.cos(a) * l).toFixed(1)} ${(Math.sin(a) * l).toFixed(1)}" stroke="${col}" stroke-width="${(sw * (0.7 + r() * 0.5)).toFixed(2)}" opacity="${op}"/>`;
  }
  return `<g fill="none" stroke-linecap="round">${out}</g>`;
};

/** a crayon shape: base colour + hatching clipped to the path, and a thin outline drawn twice, slightly off */
export const shape = (d, box, tone, { u = 1, seed = 5, ow = 4.3, outline = true, density = 1.3, angle } = {}) => {
  const id = uid('cl');
  const t = typeof tone === 'string' ? TONES[tone] : tone;
  const line = outline ? `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${(ow * u).toFixed(2)}" stroke-linejoin="round" stroke-linecap="round" opacity="0.82"/><path d="${d}" fill="none" stroke="#3a1a6e" stroke-width="${(ow * 0.6 * u).toFixed(2)}" stroke-linejoin="round" opacity="0.4" transform="translate(${(0.9 * u).toFixed(2)} ${(0.7 * u).toFixed(2)})"/>` : '';
  return `<g><clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})"><path d="${d}" fill="${t.base}" stroke="${t.base}" stroke-width="${(2 * u).toFixed(2)}"/>${hatch(box, t.tones, { u, seed, density, angle })}</g>${line}</g>`;
};

/** a crayon line: several slightly different strokes on top of each other */
export const stroke = (d, color, w, { u = 1, seed = 3, passes = 3 } = {}) => {
  const r = rng(seed);
  return `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${Array.from({ length: passes }, (_, i) => `<path d="${d}" stroke="${i ? '#3a1a6e' : color}" stroke-width="${(w * u * (i ? 0.45 : 1)).toFixed(2)}" opacity="${i ? 0.45 : 0.88}" transform="translate(${((r() - 0.5) * 1.6 * u).toFixed(2)} ${((r() - 0.5) * 1.6 * u).toFixed(2)})"/>`).join('')}</g>`;
};
