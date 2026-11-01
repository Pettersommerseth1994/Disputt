// The two pictures on the cards «Småkrangel» and «Storkrangel»: the game's own characters, made to look like they are arguing a little, or a lot, and the two
// small symbols on the card's lines. Everything is drawn in a 100 × 116 box (the pictures) or a 40 × 40 box (the symbols) in the style of the characters (crayon.mjs).
import { INK, blobPath, filterDef, polyPath, shape, stroke, uid } from './crayon.mjs';
import { overlay } from './faces.mjs';

const U = 0.145; // one avatar unit, in box units (a face is about 58 units wide, for its 400)
const H = 116;
let seed = 40;
const sd = () => (seed += 7);

const g = (transform, inner) => `<g transform="${transform}">${inner}</g>`;
const label = (text, fs, x = 0, y = 0) => `<text x="${x}" y="${y + fs * 0.36}" text-anchor="middle" font-size="${fs}" style="font-family:var(--font-display);font-weight:900;fill:${INK}">${text}</text>`;

/** A face at x, y (top left) with width w, in box units: the avatar, with brows and a mouth over it. */
const face = (src, id, x, y, w, mood, rot) =>
  `<span class="face" style="left:${x}%;top:${(y / H) * 100}%;width:${w}%;transform:rotate(${rot}deg)"><img src="${src}" alt="" width="400" height="400">${overlay(id, mood)}</span>`;

/** circles drawn as one lump: all the outlines first, then the fills on top, so that the lines inside vanish */
const lump = (circles, tone, ow = 6) => {
  const parts = circles.map(([cx, cy, r]) => [blobPath(cx, cy, r, r, sd(), 0.04, 8), [cx - r, cy - r, 2 * r, 2 * r]]);
  const lines = parts.map(([d]) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${(ow * U).toFixed(2)}" stroke-linejoin="round" opacity="0.82"/>`).join('');
  return lines + parts.map(([d, box]) => shape(d, box, tone, { u: U, seed: sd(), outline: false })).join('');
};
/** a scalloped balloon full of swear symbols */
const swear = (cx, cy, r, text, rot, fs, tone = 'cream') => {
  const circles = [[0, 0, 1], [0.8, -0.2, 0.62], [-0.8, -0.1, 0.6], [0.4, 0.55, 0.55], [-0.45, 0.5, 0.55], [0.3, -0.62, 0.5], [-0.35, -0.6, 0.5]].map(([dx, dy, k]) => [cx + dx * r, cy + dy * r, r * k * 0.82]);
  return lump(circles, tone) + g(`rotate(${rot} ${cx} ${cy})`, label(text, fs, cx, cy));
};
/** the cartoon anger mark: four red crayon strokes round a point */
const anger = (cx, cy, s) => g(`translate(${cx} ${cy}) scale(${s / 10})`, ['M-9 -3Q-4 -4 -3 -9', 'M9 -3Q4 -4 3 -9', 'M-9 3Q-4 4 -3 9', 'M9 3Q4 4 3 9'].map((d) => stroke(d, '#c43d2a', 1.7 / (s / 10), { seed: sd(), passes: 2 })).join(''));

const layer = (content) => {
  const fid = uid('sf');
  return `<svg class="layer" viewBox="0 0 100 ${H}" aria-hidden="true"><defs>${filterDef(fid, U, [-10, -10, 120, H + 20], 17)}</defs><g filter="url(#${fid})">${content}</g></svg>`;
};
const scene = (faces, front) => `<div class="scene">${faces}${layer(front)}</div>`;

/** `src` gives the URL of an avatar picture (the red one without its lips is made by build.mjs). */
export const scenes = (src) => ({
  lite: scene(face(src.lime, 'lime', 0, 56, 54, 'small', 5) + face(src.blabaer, 'blabaer', 46, 58, 54, 'small', -5), swear(50, 30, 19, '@#!', -4, 15)),
  stor: scene(face(src.mandarin, 'mandarin', -6, 55, 58, 'huge', -8) + face(src.leppa, 'leppa', 48, 52, 58, 'huge', 8), swear(25, 29, 19, '#@%!', -8, 15, 'yellow') + swear(77, 28, 19, '!?@#', 8, 15, 'pink') + anger(50, 56, 9)),
});

// ---- the two symbols on the lines of the cards: a star for the points, a clock for the time ----------------------------------------------------------------
const UI = 0.4; // one avatar unit in the symbol's 40-unit box
const star = (r1, r2) => polyPath(Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? r2 : r1; const a = (i * Math.PI) / 5 - Math.PI / 2; return [20 + Math.cos(a) * r, 21 + Math.sin(a) * r]; }));
const symbol = (art) => {
  const fid = uid('if');
  return `<svg class="symbol" viewBox="0 0 40 40" aria-hidden="true"><defs>${filterDef(fid, UI, [-4, -4, 48, 48], 9)}</defs><g filter="url(#${fid})">${art}</g></svg>`;
};
export const symbols = () => ({
  star: symbol(shape(star(18.5, 8.5), [2, 2, 36, 36], 'yellow', { u: UI, seed: 13, ow: 5 })),
  clock: symbol(shape(blobPath(20, 20, 16.5, 16.5, 7, 0.03, 9), [3, 3, 34, 34], 'cream', { u: UI, seed: 14, ow: 6 }) + stroke('M20 20L20 8', INK, 3.4, { seed: 15, passes: 2 }) + stroke('M20 20L28.5 24.5', INK, 3.4, { seed: 16, passes: 2 }) + `<circle cx="20" cy="20" r="2.2" fill="${INK}"/>`),
});
