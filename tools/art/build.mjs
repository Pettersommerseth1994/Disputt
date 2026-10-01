#!/usr/bin/env node
// Regenerates every Disputt illustration deterministically.
//   node tools/art/build.mjs                 → everything
//   node tools/art/build.mjs --only=lime,sol → just those assets (by id)
//   node tools/art/build.mjs --no-textures   → skip PNG textures
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AVATAR_SET } from './characters/index.mjs';
import { ART_SET } from './art/index.mjs';
import { buildTextures } from './textures.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (id) => !only.length || only.includes(id);

const SOFT = 45 * 1024, HARD = 80 * 1024;
const rows = [];
let failed = false;

function out(rel, content) {
  const file = join(ROOT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  const size = Buffer.byteLength(content);
  const flag = rel.endsWith('.svg') && size > HARD ? '  ✗ over 80 KB' : rel.endsWith('.svg') && size > SOFT ? '  ! over 45 KB' : '';
  if (flag.includes('✗')) failed = true;
  rows.push([rel, size, flag]);
}

for (const [id, fn] of Object.entries(AVATAR_SET)) {
  if (want(id)) out(`public/assets/avatars/${id}.svg`, fn());
}
for (const [name, fn] of Object.entries(ART_SET)) {
  if (want(name)) out(`public/assets/art/${name}.svg`, fn());
}
if (!args.includes('--no-textures') && (!only.length || only.includes('textures'))) {
  for (const t of await buildTextures(ROOT)) rows.push([relative(ROOT, t.file), t.size, '']);
}

for (const [rel, size, flag] of rows) console.log(`${(size / 1024).toFixed(1).padStart(7)} KB  ${rel}${flag}`);
if (failed) {
  console.error('Some SVGs exceed the 80 KB hard cap.');
  process.exit(1);
}
