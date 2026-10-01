// Builds the static site (GitHub Pages or any static host) into dist/. No dependencies, no bundler: it copies
// public/ and the shared engine, writes the deployment config, and adds a Content-Security-Policy to the pages.
//
//   node tools/pages/build.mjs [--out dist] [--base /Disputt/] [--mode p2p|server] [--server-url wss://host/ws]
//                              [--peer-host h] [--peer-port 443] [--peer-path /peerjs] [--peer-secure 1]
//                              [--ice-servers '<json array>'] [--timings '<json object>'] [--no-csp]
//
// The same settings can come from the environment (handy in CI): DISPUTT_MODE, DISPUTT_SERVER_URL, DISPUTT_PEER_HOST,
// DISPUTT_PEER_PORT, DISPUTT_PEER_PATH, DISPUTT_PEER_SECURE, DISPUTT_ICE_SERVERS.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Parses `--key value` / `--flag` arguments; values fall back to the given environment variables. */
function options(argv, env) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = true;
    else flags[key] = argv[++i];
  }
  const pick = (flag, envName) => flags[flag] ?? (env[envName] ? env[envName] : undefined);
  return {
    out: flags.out ?? 'dist',
    base: flags.base ?? null,
    mode: pick('mode', 'DISPUTT_MODE') ?? 'p2p',
    serverUrl: pick('server-url', 'DISPUTT_SERVER_URL') ?? null,
    peerHost: pick('peer-host', 'DISPUTT_PEER_HOST'),
    peerPort: pick('peer-port', 'DISPUTT_PEER_PORT'),
    peerPath: pick('peer-path', 'DISPUTT_PEER_PATH'),
    peerSecure: pick('peer-secure', 'DISPUTT_PEER_SECURE'),
    iceServers: pick('ice-servers', 'DISPUTT_ICE_SERVERS'),
    timings: pick('timings', 'DISPUTT_TIMINGS'),
    csp: !flags['no-csp'],
  };
}

function copyDir(from, to, filter = () => true) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || !filter(entry.name, from)) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst, filter);
    else fs.copyFileSync(src, dst);
  }
}

export async function buildConfig(opts) {
  const defaults = (await import(pathToFileURL(path.join(ROOT, 'public', 'config.js')).href)).default;
  const config = { ...defaults, mode: opts.mode === 'server' ? 'server' : 'p2p', serverUrl: opts.serverUrl || null, peer: { ...defaults.peer } };
  if (opts.peerHost) {
    config.peer = {
      host: opts.peerHost,
      port: Number(opts.peerPort || 443),
      path: opts.peerPath || '/peerjs',
      secure: !['0', 'false'].includes(String(opts.peerSecure ?? '1')),
    };
  }
  if (opts.iceServers) {
    const parsed = JSON.parse(opts.iceServers);
    if (!Array.isArray(parsed)) throw new Error('--ice-servers must be a JSON array');
    config.iceServers = parsed;
  }
  if (opts.timings) config.timings = JSON.parse(opts.timings);
  // A remote server only makes sense in server mode; without one, a "server" build would have nobody to talk to.
  if (config.mode === 'server' && !config.serverUrl) throw new Error('Server mode on static hosting needs --server-url');
  return config;
}

/** The Content-Security-Policy for the built pages: only this site, plus whatever the config says we talk to. */
export function contentSecurityPolicy(config) {
  const connect = new Set(["'self'"]);
  if (config.mode === 'p2p') {
    if (config.peer.host) {
      const scheme = config.peer.secure ? 'wss' : 'ws';
      const http = config.peer.secure ? 'https' : 'http';
      const port = config.peer.port ? `:${config.peer.port}` : '';
      connect.add(`${scheme}://${config.peer.host}${port}`);
      connect.add(`${http}://${config.peer.host}${port}`);
    } else {
      connect.add('wss://0.peerjs.com');
      connect.add('https://0.peerjs.com');
    }
  } else if (config.serverUrl) {
    connect.add(new URL(config.serverUrl).origin.replace(/^http/, 'ws'));
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${[...connect].join(' ')}`,
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}

function withMeta(html, config, opts, extraHead = '') {
  const tags = [];
  if (opts.csp) tags.push(`<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(config)}">`);
  tags.push('<meta name="referrer" content="no-referrer">');
  if (extraHead) tags.push(extraHead);
  return html.replace('<head>', `<head>\n  ${tags.join('\n  ')}`);
}

export async function build(argv = [], env = process.env) {
  const opts = options(argv, env);
  const out = path.resolve(ROOT, opts.out);
  const config = await buildConfig(opts);

  fs.rmSync(out, { recursive: true, force: true });
  copyDir(path.join(ROOT, 'public'), out);
  // the engine and roster are shared between the Node server and the browser (the p2p host runs the engine in the page)
  copyDir(path.join(ROOT, 'shared'), path.join(out, 'shared'), (name) => /\.m?js$/.test(name));

  fs.writeFileSync(
    path.join(out, 'config.js'),
    `// Generated by tools/pages/build.mjs. Edit public/config.js (defaults) or the build settings, not this file.\nexport default ${JSON.stringify(config, null, 2)};\n`,
  );

  // every page gets the CSP; 404.html is the app shell with a <base>, so old /j/ABCD paths still render on static hosts
  const pages = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) pages.push(p);
    }
  };
  walk(out);
  for (const page of pages) fs.writeFileSync(page, withMeta(fs.readFileSync(page, 'utf8'), config, opts));
  const index = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  fs.writeFileSync(path.join(out, '404.html'), opts.base ? index.replace('<head>', `<head>\n  <base href="${opts.base}">`) : index);
  fs.writeFileSync(path.join(out, '.nojekyll'), '');

  let files = 0;
  let bytes = 0;
  const count = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) count(p);
      else {
        files++;
        bytes += fs.statSync(p).size;
      }
    }
  };
  count(out);
  return { out, config, files, bytes, pages: pages.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await build(process.argv.slice(2));
  console.log(`Built ${result.files} files (${(result.bytes / 1024 / 1024).toFixed(1)} MB) -> ${path.relative(ROOT, result.out)}/`);
  console.log(`mode: ${result.config.mode}${result.config.serverUrl ? `, server: ${result.config.serverUrl}` : ''}${result.config.peer.host ? `, peer server: ${result.config.peer.host}` : result.config.mode === 'p2p' ? ', peer server: PeerJS cloud' : ''}`);
}
