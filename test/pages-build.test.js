// The static (GitHub Pages) build must work from any sub-path: no absolute URLs, no missing modules, the right config.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { build, buildConfig, contentSecurityPolicy } from '../tools/pages/build.mjs';

let out;
let result;
before(async () => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'disputt-pages-'));
  result = await build(['--out', out, '--base', '/Disputt/'], {});
});
after(() => fs.rmSync(out, { recursive: true, force: true }));

const files = (dir, test) => {
  const found = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) found.push(...files(p, test));
    else if (test(p)) found.push(p);
  }
  return found;
};
const isVendor = (p) => p.includes(`${path.sep}vendor${path.sep}`);
const rel = (p) => path.relative(out, p);

describe('static build', () => {
  it('produces a peer-to-peer site with the engine and the question bank next to the roster', () => {
    assert.equal(result.config.mode, 'p2p');
    for (const f of ['index.html', '404.html', 'config.js', '.nojekyll', 'manifest.webmanifest', 'shared/avatars.mjs', 'shared/game.js', 'shared/hub.js', 'shared/questions.js', 'shared/util.js', 'js/vendor/peerjs.min.js', 'js/p2p/host.js', 'design-system/index.html']) {
      assert.ok(fs.existsSync(path.join(out, f)), `${f} exists`);
    }
    const config = fs.readFileSync(path.join(out, 'config.js'), 'utf8');
    assert.match(config, /"mode": "p2p"/);
    assert.match(config, /stun:/);
  });

  it('contains no absolute URLs: it must work under /Disputt/ as well as at the root', () => {
    const offenders = [];
    const patterns = [
      /(?:src|href|content)="\/(?!\/)/,
      /url\(\s*['"]?\/(?!\/)/,
      /^\s*(?:import|export)\b[^;\n]*\bfrom\s+['"]\//m,
      /import\(\s*['"]\//,
      /new URL\(\s*['"]\//,
      // paths written as JavaScript strings: they would send a Pages visitor to github.io/… instead of github.io/Disputt/…
      /\bfetch\(\s*['"`]\/(?!\/)/,
      /\b(?:replaceState|pushState)\([^)]*,\s*['"`]\/(?!\/)/,
      /\blocation(?:\.href|\.pathname)?\s*=\s*['"`]\/(?!\/)/,
      /\blocation\.(?:assign|replace)\(\s*['"`]\/(?!\/)/,
      /\bnew (?:Worker|EventSource|SharedWorker)\(\s*['"`]\/(?!\/)/,
    ];
    for (const f of files(out, (p) => /\.(html|css|js|mjs|webmanifest)$/.test(p) && !isVendor(p))) {
      // (404.html's <base href="/Disputt/"> is absolute on purpose: it is what makes the relative URLs work there)
      const text = fs.readFileSync(f, 'utf8').replace(/<base\s[^>]*>/g, '');
      for (const re of patterns) if (re.test(text)) offenders.push(`${rel(f)} matches ${re}`);
    }
    assert.deepEqual(offenders, []);
  });

  it('every module import resolves to a file in the build', () => {
    const missing = [];
    const importRe = /(?:from\s+|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g;
    for (const f of files(out, (p) => /\.m?js$/.test(p) && !isVendor(p))) {
      const text = fs.readFileSync(f, 'utf8');
      for (const m of text.matchAll(importRe)) {
        const target = path.resolve(path.dirname(f), m[1]);
        if (!fs.existsSync(target)) missing.push(`${rel(f)} -> ${m[1]}`);
      }
    }
    assert.deepEqual(missing, []);
  });

  it('every page carries a strict Content-Security-Policy that allows the signalling server and nothing else', () => {
    const pages = files(out, (p) => p.endsWith('.html'));
    assert.ok(pages.length >= 3);
    for (const page of pages) {
      const html = fs.readFileSync(page, 'utf8');
      const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1];
      assert.ok(csp, `${rel(page)} has a CSP`);
      assert.match(csp, /script-src 'self'(;|$)/);
      assert.match(csp, /connect-src 'self' wss:\/\/0\.peerjs\.com https:\/\/0\.peerjs\.com(;|$)/);
      assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, `${rel(page)} has no inline scripts`);
    }
  });

  it('serves legacy /j/ABCD links on static hosts through 404.html with the right <base>', () => {
    const html = fs.readFileSync(path.join(out, '404.html'), 'utf8');
    assert.match(html, /<base href="\/Disputt\/">/);
    assert.doesNotMatch(fs.readFileSync(path.join(out, 'index.html'), 'utf8'), /<base /);
  });
});

describe('build configuration', () => {
  it('lets a remote server, a self-hosted signalling server and TURN servers be configured', async () => {
    const remote = await buildConfig({ mode: 'server', serverUrl: 'wss://disputt.example/ws' });
    assert.equal(remote.mode, 'server');
    assert.match(contentSecurityPolicy(remote), /connect-src 'self' wss:\/\/disputt\.example(;|$)/);

    const selfHosted = await buildConfig({ mode: 'p2p', peerHost: 'peers.example', peerPort: '443', peerPath: '/peerjs', peerSecure: '1' });
    assert.deepEqual(selfHosted.peer, { host: 'peers.example', port: 443, path: '/peerjs', secure: true });
    assert.match(contentSecurityPolicy(selfHosted), /wss:\/\/peers\.example:443 https:\/\/peers\.example:443/);

    const turn = await buildConfig({ mode: 'p2p', iceServers: JSON.stringify([{ urls: 'turn:t.example', username: 'u', credential: 'c' }]) });
    assert.equal(turn.iceServers[0].urls, 'turn:t.example');
    await assert.rejects(buildConfig({ mode: 'p2p', iceServers: '{"not":"an array"}' }), /JSON array/);
    await assert.rejects(buildConfig({ mode: 'server' }), /--server-url/);
  });
});

describe('build settings from repository variables are checked, not trusted', () => {
  const attempt = (argv, env = {}) => build(['--out', path.join(os.tmpdir(), `disputt-bad-${process.pid}`), ...argv], env);

  it('refuses values that could break out of the HTML attributes or the CSP', async () => {
    for (const bad of [
      ['--peer-host', 'peer.example.com"><script>alert(1)</script>'],
      ['--peer-host', "peer.example.com; script-src *"],
      ['--peer-host', 'peer example.com'],
      ['--peer-port', '443; img-src *'],
      ['--peer-port', '70000'],
      ['--peer-path', '/peerjs"'],
      ['--base', '/Disputt"><script>x</script>/'],
      ['--base', '/Disputt'], // must end with a slash
      ['--base', 'https://evil.example/'],
      ['--mode', 'server', '--server-url', 'https://example.com/ws'], // not a WebSocket address
      ['--mode', 'server', '--server-url', 'wss://exa"mple.com/ws'],
    ]) {
      await assert.rejects(attempt(bad), Error, `should refuse ${JSON.stringify(bad)}`);
    }
    await assert.rejects(attempt(['--peer-host', 'x'], { DISPUTT_PEER_PORT: '1 2' }), Error, 'the same checks apply to environment variables');
  });

  it('accepts ordinary values and puts them in the CSP', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'disputt-ok-'));
    try {
      const r = await build(['--out', dir, '--base', '/Disputt/', '--peer-host', 'peer.example.com', '--peer-port', '9000', '--peer-path', '/peerjs', '--peer-secure', '1'], {});
      const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
      assert.match(html, /connect-src 'self' wss:\/\/peer\.example\.com:9000 https:\/\/peer\.example\.com:9000/);
      assert.equal(r.config.peer.host, 'peer.example.com');
      assert.match(fs.readFileSync(path.join(dir, '404.html'), 'utf8'), /<base href="\/Disputt\/">/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
