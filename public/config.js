// Deployment configuration. The GitHub Pages build (tools/pages/build.mjs) generates its own version of this file.
export default {
  // 'server': the Node server runs the game and everybody talks to it over WebSocket.
  // 'p2p':    there is no server. The host's phone runs the game, and the others connect straight to it (WebRTC).
  mode: 'server',

  // server mode only: WebSocket address of the game server. null = the site that served this page (ws(s)://host/ws).
  serverUrl: null,

  // p2p mode only: the signalling server that introduces phones to each other. {} = the free public PeerJS cloud.
  // To self-host: { host: 'peers.example.com', port: 443, path: '/peerjs', secure: true }
  peer: {},

  // p2p mode only: override the engine's timings (milliseconds), e.g. { roleMs: 1600, countdownMs: 1600 }. null = the real game.
  timings: null,

  // p2p mode only: STUN servers help phones find each other across networks. Add a TURN server here
  // ({ urls: 'turn:…', username: '…', credential: '…' }) if some networks refuse direct connections.
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};
