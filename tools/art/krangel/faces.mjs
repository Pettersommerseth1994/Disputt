// Brows and an open mouth, drawn in the same oil-pastel style as the one-eyed characters, to make them look like they are arguing.
// Coordinates are in the avatar's own 400 × 400 space: ex/ey = the eye's centre, ew = half its width, mx/my = where the mouth goes, ms = how much bigger the mouth is.
import { INK, blobPath, filterDef, shape, stroke, uid } from './crayon.mjs';

export const SPEC = {
  blabaer: { ex: 188, ey: 192, ew: 100, mx: 196, my: 308 },
  lime: { ex: 200, ey: 190, ew: 105, mx: 200, my: 320 },
  mandarin: { ex: 195, ey: 235, ew: 100, mx: 195, my: 333, ms: 1.25 },
  leppa: { ex: 192, ey: 108, ew: 62, mx: 188, my: 262, ms: 1.8 },
};
const seedOf = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

/** The overlay for one face. `mood`: 'small' (a little cross), 'big' (properly cross) or 'huge' (screaming). */
export function overlay(id, mood) {
  const s = SPEC[id];
  const sd = seedOf(id + mood);
  const k = { small: { slant: 16, bw: 11, mw: 0.62, mh: 0.42 }, big: { slant: 30, bw: 14, mw: 0.85, mh: 0.62 }, huge: { slant: 40, bw: 16, mw: 1.1, mh: 0.95 } }[mood];
  const top = s.ey - s.ew * 0.5 - 8;
  const brow = stroke(`M${s.ex - s.ew * 0.95} ${top - k.slant}L${s.ex} ${top + 6}L${s.ex + s.ew * 0.95} ${top - k.slant}`, INK, k.bw, { seed: sd });
  const w = s.ew * k.mw * (s.ms ?? 1), h = s.ew * k.mh * (s.ms ?? 1);
  const x0 = s.mx - w / 2, y0 = s.my - h / 2;
  const md = blobPath(s.mx, s.my, w / 2, h / 2, sd, 0.05, 10);
  const cid = uid('mo');
  const tongue = shape(blobPath(s.mx, s.my + h * 0.3, w * 0.3, h * 0.26, sd + 1, 0.08, 8), [s.mx - w * 0.3, s.my + h * 0.05, w * 0.6, h * 0.55], 'tongue', { seed: sd + 2, ow: 3, density: 1.6 });
  const teeth = shape(`M${x0 - 4} ${y0 - 4}H${x0 + w + 4}V${y0 + h * 0.22}Q${s.mx} ${y0 + h * 0.3} ${x0 - 4} ${y0 + h * 0.22}Z`, [x0 - 4, y0 - 4, w + 8, h * 0.3], 'teeth', { seed: sd + 3, ow: 3, density: 1.4 });
  const mouth = `<g><clipPath id="${cid}"><path d="${md}"/></clipPath><g clip-path="url(#${cid})">${shape(md, [x0, y0, w, h], 'mouth', { seed: sd + 4, outline: false, density: 1.8 })}${tongue}${teeth}</g><path d="${md}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round" opacity="0.88"/><path d="${blobPath(s.mx + 1, s.my + 1, w / 2, h / 2, sd + 9, 0.05, 10)}" fill="none" stroke="#3a1a6e" stroke-width="2.6" opacity="0.4"/></g>`;
  const fid = uid('cf');
  return `<svg class="face__o" viewBox="0 0 400 400" aria-hidden="true"><defs>${filterDef(fid, 1, [-40, -40, 480, 480], 31)}</defs><g filter="url(#${fid})">${mouth}${brow}</g></svg>`;
}
