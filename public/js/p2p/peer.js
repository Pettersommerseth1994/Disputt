// Loading PeerJS and talking to the signalling server. Peer-to-peer mode only.
import { asset } from '../paths.js';

/** Peer ids are "disputt1-<room code>" for hosts, "disputt1-g-<random>" for guests (the 1 is the protocol version). */
export const PEER_PREFIX = 'disputt1-';
export const hostPeerId = (code) => `${PEER_PREFIX}${code}`;

let loading = null;

/** PeerJS is a classic script that sets window.Peer; it is only fetched when somebody actually hosts or joins. */
export function loadPeer() {
  if (globalThis.Peer) return Promise.resolve(globalThis.Peer);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = asset('js/vendor/peerjs.min.js');
    script.onload = () => (globalThis.Peer ? resolve(globalThis.Peer) : reject(new Error('PeerJS did not initialise')));
    script.onerror = () => {
      loading = null;
      reject(Object.assign(new Error('Could not load PeerJS'), { kind: 'offline' }));
    };
    document.head.append(script);
  });
  return loading;
}

export const peerOptions = (config) => ({ ...config.peer, config: { iceServers: config.iceServers }, debug: 1 });

/** Registers `id` with the signalling server. Rejects with kind 'taken' (id in use) or 'offline' (no contact). */
export function openPeer(Peer, id, config, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const peer = new Peer(id, peerOptions(config));
    const fail = (err, kind) => {
      clearTimeout(timer);
      try {
        peer.destroy();
      } catch {
        /* already gone */
      }
      reject(Object.assign(err instanceof Error ? err : new Error(String(err)), { kind }));
    };
    const timer = setTimeout(() => fail(new Error('Signalling server did not answer'), 'offline'), timeoutMs);
    peer.on('open', () => {
      clearTimeout(timer);
      peer.off?.('error', onError);
      resolve(peer);
    });
    const onError = (err) => fail(err, err?.type === 'unavailable-id' ? 'taken' : 'offline');
    peer.on('error', onError);
  });
}
