// The configuration the app actually runs with: /config.js, plus overrides for local testing.
import base from '../config.js';

const isLocalHost = (h) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);

function resolve() {
  const config = { ...base, peer: { ...base.peer }, iceServers: [...(base.iceServers ?? [])] };
  // ?mode=p2p&peerHost=127.0.0.1&peerPort=9000 … only on localhost / private networks, so a crafted link on the public
  // site can never point players at somebody else's signalling server.
  if (isLocalHost(location.hostname)) {
    const q = new URLSearchParams(location.search);
    if (q.has('mode')) config.mode = q.get('mode') === 'p2p' ? 'p2p' : 'server';
    if (q.has('peerHost')) {
      config.peer = { host: q.get('peerHost'), port: Number(q.get('peerPort') || 9000), path: q.get('peerPath') || '/peerjs', secure: q.get('peerSecure') === '1' };
    }
    if (q.get('ice') === 'none') config.iceServers = [];
  }
  return config;
}

export const config = resolve();
export const isP2P = config.mode === 'p2p';
