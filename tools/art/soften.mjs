// Derives CSS-ready textures from the full-strength tiles. CSS background layers cannot carry their own
// opacity, so the grain (designed to be laid on at ~30 %) gets its alpha baked down here.
//   node tools/art/soften.mjs        (run by `npm run art` after the textures are built)
import sharp from 'sharp';

const DIR = 'public/assets/textures';
const JOBS = [
  ['grain.png', 'grain-soft.png', 0.3], // paper grain: designed to be laid on at ~30 %
  ['crayon-light.png', 'crayon-light-soft.png', 0.6], // for big colour fields that carry text (role / verdict screens)
];

for (const [src, dst, factor] of JOBS) {
  const { data, info } = await sharp(`${DIR}/${src}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * factor);
  await sharp(data, { raw: info }).png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(`${DIR}/${dst}`);
  console.log(`${dst} (alpha x${factor})`);
}
