// Tiny static file server: ETag + conditional requests, gzip/brotli with an in-memory cache, SPA fallback.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg', '.txt', '.md']);

const cacheControl = (ext, rel) => {
  if (ext === '.woff2') return 'public, max-age=31536000, immutable';
  if (rel.startsWith('/assets/')) return 'public, max-age=86400';
  return 'no-cache'; // html/css/js: always revalidate (cheap thanks to ETag) so deploys show up immediately
};

export function createStaticHandler({ publicDir, sharedDir }) {
  const compressed = new Map(); // key -> Buffer

  function resolve(urlPath) {
    let rel = decodeURIComponent(urlPath);
    if (rel.includes('\0')) return null;
    if (rel.startsWith('/shared/')) {
      const file = path.join(sharedDir, path.normalize(rel.slice('/shared/'.length)));
      return file.startsWith(sharedDir + path.sep) && file.endsWith('.mjs') ? { file, rel } : null;
    }
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(publicDir, path.normalize(rel));
    if (!file.startsWith(publicDir + path.sep)) return null;
    return { file, rel };
  }

  function serve(req, res, urlPath, { fallback = false } = {}) {
    let target;
    try {
      target = resolve(urlPath);
    } catch {
      target = null;
    }
    if (!target) return notFound(res);

    let { file, rel } = target;
    let stat;
    try {
      stat = fs.statSync(file);
      if (stat.isDirectory()) {
        file = path.join(file, 'index.html');
        rel = rel.replace(/\/?$/, '/index.html');
        stat = fs.statSync(file);
      }
    } catch {
      if (!fallback) return notFound(res);
      file = path.join(publicDir, 'index.html');
      rel = '/index.html';
      try {
        stat = fs.statSync(file);
      } catch {
        return notFound(res);
      }
    }

    const ext = path.extname(file).toLowerCase();
    const etag = `W/"${stat.size.toString(16)}-${Math.round(stat.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': cacheControl(ext, rel),
      ETag: etag,
      Vary: 'Accept-Encoding',
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      return res.end();
    }

    const accept = String(req.headers['accept-encoding'] ?? '');
    const encoding = COMPRESSIBLE.has(ext) ? (/\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null) : null;

    if (req.method === 'HEAD') {
      res.writeHead(200, { ...headers, 'Content-Length': stat.size });
      return res.end();
    }

    if (!encoding) {
      res.writeHead(200, { ...headers, 'Content-Length': stat.size });
      return fs.createReadStream(file).pipe(res);
    }

    const key = `${file}|${etag}|${encoding}`;
    let body = compressed.get(key);
    if (!body) {
      const raw = fs.readFileSync(file);
      body = encoding === 'br' ? zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }) : zlib.gzipSync(raw, { level: 9 });
      compressed.set(key, body);
    }
    res.writeHead(200, { ...headers, 'Content-Encoding': encoding, 'Content-Length': body.length });
    res.end(body);
  }

  return { serve };
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Ikke funnet');
}
