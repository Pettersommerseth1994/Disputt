// Previews the static build locally, exactly as GitHub Pages will serve it.
//   node tools/pages/serve.mjs [--port 8080] [build options, see build.mjs]
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticHandler } from '../../server/static.js';
import { build } from './build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = portIndex >= 0 ? Number(args.splice(portIndex, 2)[1]) : 8080;

const { out, config, files } = await build(['--out', 'dist', ...args]);
const statics = createStaticHandler({ publicDir: out, sharedDir: path.join(out, 'shared'), sharedExtensions: ['.mjs', '.js'] });
http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://x');
    statics.serve(req, res, pathname);
  })
  .listen(port, '0.0.0.0', () => {
    console.log(`\nStatic build (${files} files, mode: ${config.mode}) -> ${path.relative(ROOT, out)}/`);
    console.log(`  Denne maskinen:    http://localhost:${port}/`);
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const a of addrs ?? []) if (a.family === 'IPv4' && !a.internal) console.log(`  På mobilen (Wi-Fi): http://${a.address}:${port}/`);
    }
    console.log('');
  });
