// Disputt server: static files + WebSocket game transport on one port.
//   PORT        (default 3000)
//   HOST        (default 0.0.0.0, so phones on the same Wi‑Fi can connect)
//   PUBLIC_URL  (optional) canonical public address used for the QR code, e.g. https://disputt.no

import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { Hub } from './hub.js';
import { createStaticHandler } from './static.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "font-src 'self'",
    "connect-src 'self' ws: wss:",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
};

export function lanUrls(port) {
  const urls = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) urls.push(`http://${a.address}:${port}`);
    }
  }
  return urls;
}

export function createApp({
  port = Number(process.env.PORT) || 3000,
  host = process.env.HOST || '0.0.0.0',
  publicUrl = process.env.PUBLIC_URL || null,
  hubOptions = {},
  tickMs = 100,
  silent = false,
} = {}) {
  const hub = new Hub(hubOptions);
  const statics = createStaticHandler({ publicDir: path.join(ROOT, 'public'), sharedDir: path.join(ROOT, 'shared') });

  const server = http.createServer((req, res) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    const { pathname } = new URL(req.url, 'http://x');

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }
    if (pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end('ok');
    }
    if (pathname === '/api/info') {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ publicUrl, lanUrls: lanUrls(actualPort), ...hub.stats }));
    }
    // /j/ABCD (QR-code links) are handled by the client; so is every unknown path under /j/
    return statics.serve(req, res, pathname, { fallback: pathname.startsWith('/j/') });
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://x');
    const origin = req.headers.origin;
    let sameOrigin = true;
    if (origin) {
      try {
        sameOrigin = new URL(origin).host === req.headers.host;
      } catch {
        sameOrigin = false;
      }
    }
    if (pathname !== '/ws' || !sameOrigin) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws) => {
    const conn = { ws, code: null, playerId: null };
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Token bucket: bursts of 30, refilling 15/s. Plenty for a human, stops floods.
    let tokens = 30;
    let last = Date.now();
    ws.on('message', (data, isBinary) => {
      const now = Date.now();
      tokens = Math.min(30, tokens + ((now - last) / 1000) * 15);
      last = now;
      if (tokens < 1) return;
      tokens -= 1;
      if (isBinary) return;
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      hub.handle(conn, msg);
    });
    ws.on('close', () => hub.close(conn));
    ws.on('error', () => {});
  });

  const timers = [
    setInterval(() => hub.tick(), tickMs),
    setInterval(() => hub.sweep(), 60_000),
    setInterval(() => {
      for (const ws of wss.clients) {
        if (!ws.isAlive) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
    }, 25_000),
  ];
  for (const t of timers) t.unref?.();

  return {
    server,
    wss,
    hub,
    listen: () =>
      new Promise((resolve) => {
        server.listen(port, host, () => {
          const actual = server.address().port;
          if (!silent) {
            console.log(`\nDisputt kjører på port ${actual}`);
            console.log(`  Denne maskinen:   http://localhost:${actual}`);
            for (const url of lanUrls(actual)) console.log(`  På mobilen (Wi‑Fi): ${url}`);
            if (publicUrl) console.log(`  Offentlig adresse:  ${publicUrl}`);
            console.log('');
          }
          resolve(actual);
        });
      }),
    close: () =>
      new Promise((resolve) => {
        for (const t of timers) clearInterval(t);
        for (const ws of wss.clients) ws.terminate();
        wss.close();
        server.close(() => resolve());
        server.closeAllConnections?.();
      }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = createApp();
  app.listen();
  const stop = () => app.close().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
