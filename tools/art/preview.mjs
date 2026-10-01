#!/usr/bin/env node
// Review sheets (not shipped). Writes HTML into tmp/art-preview/ and, if Google Chrome is
// installed, screenshots it to PNG with headless Chrome.
//   node tools/art/preview.mjs               → contact.html + contact.png
//   node tools/art/preview.mjs --one=lime    → one-lime.html/png (large single view)
//   node tools/art/preview.mjs --art         → art.html/png (illustrations only)
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { AVATARS } from '../../shared/avatars.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'tmp', 'art-preview');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(OUT, { recursive: true });
const A = (p) => '../../public/assets/' + p;
const args = process.argv.slice(2);
const arg = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];

const CSS = `
*{box-sizing:border-box} body{margin:0;padding:24px;background:#3b0a16;color:#fff6e3;font:14px/1.3 -apple-system,Helvetica,sans-serif}
h2{margin:28px 0 10px;font-size:15px;letter-spacing:.06em;text-transform:uppercase;color:#fae025}
.row{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end}
.cell{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px}
.tile{border-radius:50%;background:#fae025;display:flex;align-items:center;justify-content:center;overflow:hidden}
.burg{background:#6a1428;display:flex;align-items:center;justify-content:center;border-radius:14px}
.tile img,.burg img{display:block}
.bg{display:flex;align-items:center;justify-content:center;border-radius:18px}
.tex{width:300px;height:300px;border-radius:12px}
`;

const tile = (id, px, cls = 'tile') => {
  const pad = cls === 'tile' ? Math.round(px * 0.08) : Math.round(px * 0.06);
  return `<div class="${cls}" style="width:${px + pad * 2}px;height:${px + pad * 2}px"><img src="${A('avatars/' + id + '.svg')}" width="${px}" height="${px}"></div>`;
};

function shot(name, w, h) {
  const html = join(OUT, name + '.html'), png = join(OUT, name + '.png');
  if (!existsSync(CHROME)) { console.log('wrote', html, '(Chrome not found – no PNG)'); return; }
  spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
    `--screenshot=${png}`, `--window-size=${w},${h}`, '--virtual-time-budget=4000', 'file://' + html], { stdio: 'ignore' });
  console.log('wrote', png);
}

const ILLU = [
  ['eye-impostor', '#d71f2f', 400, 300], ['eye-loyal', '#2868d4', 400, 300], ['eye-right', '#7eba2d', 400, 300],
  ['eye-wrong', '#f48b8f', 400, 300], ['eye-wait', '#6a1428', 300, 200],
];
const DECO = [
  ['crown', 400, 240], ['lips', 400, 260], ['star', 200, 200], ['sparkle', 200, 200],
  ['blob-1', 400, 400], ['blob-2', 400, 400], ['blob-3', 400, 400], ['blob-4', 400, 400], ['blob-5', 400, 400], ['blob-6', 400, 400],
  ['scribble-underline', 400, 40], ['scribble-circle', 400, 400],
];

const one = arg('one');
if (args.includes('--tex')) {
  // seam check: 3×3 repeats at native resolution (rendered at 1×)
  const box = (tex, n, bg) => `<div style="width:${n * 3}px;height:${n * 3}px;background:url(${A('textures/' + tex)}) 0 0/${n}px ${n}px repeat,${bg}"></div>`;
  const box2 = (tex, n, bg) => `<div style="width:${n * 2}px;height:${n * 2}px;background:url(${A('textures/' + tex)}) 0 0/${n}px ${n}px repeat,${bg}"></div>`;
  const body = `<div style="display:flex;gap:10px">${box2('crayon-light.png', 512, '#6a1428')}${box2('crayon-dark.png', 512, '#fae025')}
    <div style="display:flex;flex-direction:column;gap:10px"><div style="width:512px;height:512px;background:#2a6fdb;position:relative"><div style="position:absolute;inset:0;background:url(${A('textures/grain.png')}) 0 0/256px 256px repeat"></div></div>
    <div style="width:512px;height:502px;background:#7eba2d;position:relative"><div style="position:absolute;inset:0;opacity:.35;background:url(${A('textures/grain.png')}) 0 0/256px 256px repeat"></div></div></div></div>`;
  writeFileSync(join(OUT, 'tex.html'), `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#222}</style>${body}`);
  const html = join(OUT, 'tex.html');
  if (existsSync(CHROME)) spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--screenshot=${join(OUT, 'tex.png')}`, '--window-size=2600,1024', 'file://' + html], { stdio: 'ignore' });
  console.log('wrote', join(OUT, 'tex.png'));
} else if (one) {
  const ids = one.split(',');
  const big = +(arg('size') || 520);
  const body = ids.map((id) => `<div class="row" style="flex-wrap:nowrap">${tile(id, big)}${tile(id, big, 'burg')}<div class="cell">${tile(id, 96)}${tile(id, 96, 'burg')}${tile(id, 48)}${tile(id, 48, 'burg')}</div></div>`).join('');
  writeFileSync(join(OUT, `one-${ids.join('_')}.html`), `<!doctype html><meta charset="utf-8"><style>${CSS}</style>${body}`);
  shot(`one-${ids.join('_')}`, big * 2 + 340, (big + 110) * ids.length + 40);
} else if (args.includes('--art')) {
  const body = `<h2>Illustrations</h2><div class="row">${ILLU.map(([n, bg, w, h]) => `<div class="cell"><div class="bg" style="background:${bg};padding:16px"><img src="${A('art/' + n + '.svg')}" width="${w}" height="${h}"></div>${n}</div>`).join('')}</div>
<h2>Decor</h2><div class="row">${DECO.map(([n, w, h]) => `<div class="cell"><div class="bg" style="background:#6a1428;padding:10px"><img src="${A('art/' + n + '.svg')}" width="${w * 0.6}" height="${h * 0.6}"></div>${n}</div>`).join('')}</div>`;
  writeFileSync(join(OUT, 'art.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}</style>${body}`);
  shot('art', 1400, 1500);
} else {
  const ids = AVATARS.map((a) => a.id);
  const names = Object.fromEntries(AVATARS.map((a) => [a.id, a.name]));
  let body = '';
  body += `<h2>Avatars · 240 px on yellow tiles</h2><div class="row">${ids.map((id) => `<div class="cell">${tile(id, 240)}${names[id]}</div>`).join('')}</div>`;
  body += `<h2>Avatars · 240 px on burgundy</h2><div class="row">${ids.map((id) => `<div class="cell">${tile(id, 240, 'burg')}</div>`).join('')}</div>`;
  body += `<h2>96 px</h2><div class="row">${ids.map((id) => tile(id, 96)).join('')}</div><div class="row" style="margin-top:12px">${ids.map((id) => tile(id, 96, 'burg')).join('')}</div>`;
  body += `<h2>48 px</h2><div class="row">${ids.map((id) => tile(id, 48)).join('')}</div><div class="row" style="margin-top:12px">${ids.map((id) => tile(id, 48, 'burg')).join('')}</div>`;
  body += `<h2>Illustrations on their backgrounds</h2><div class="row">${ILLU.map(([n, bg, w, h]) => `<div class="cell"><div class="bg" style="background:${bg};padding:14px"><img src="${A('art/' + n + '.svg')}" width="${w * 0.75}" height="${h * 0.75}"></div>${n}</div>`).join('')}</div>`;
  body += `<h2>Decor (on burgundy)</h2><div class="row">${DECO.map(([n, w, h]) => `<div class="cell"><div class="bg" style="background:#6a1428;padding:8px"><img src="${A('art/' + n + '.svg')}" width="${Math.round(w * 0.42)}" height="${Math.round(h * 0.42)}"></div>${n}</div>`).join('')}</div>`;
  const texBgs = ['#6a1428', '#fae025', '#2868d4', '#7eba2d'];
  body += `<h2>Textures · 3×3 repeat (300 px boxes)</h2><div class="row">` +
    texBgs.map((bg) => `<div class="cell"><div class="tex" style="background:url(${A('textures/crayon-light.png')}) 0 0/100px 100px repeat,${bg}"></div>crayon-light on ${bg}</div>`).join('') +
    texBgs.map((bg) => `<div class="cell"><div class="tex" style="background:url(${A('textures/crayon-dark.png')}) 0 0/100px 100px repeat,${bg}"></div>crayon-dark on ${bg}</div>`).join('') +
    texBgs.map((bg) => `<div class="cell"><div class="tex" style="background:${bg};position:relative"><div style="position:absolute;inset:0;opacity:.4;background:url(${A('textures/grain.png')}) 0 0/100px 100px repeat"></div></div>grain @40% on ${bg}</div>`).join('') +
    `</div>`;
  writeFileSync(join(OUT, 'contact.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}</style>${body}`);
  shot('contact', 1540, 3300);
}
