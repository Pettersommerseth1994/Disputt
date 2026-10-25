// The relay (TURN). Two phones that cannot reach each other directly (two phones on the same home Wi-Fi often cannot, and some networks never let
// them) need a server that passes their traffic on. The payment Worker hands out short-lived access to Cloudflare's relay (GET /turn); this adds it to
// the list of servers the phones use to find each other. The phones still go straight to each other when they can: the relay is only the way
// round when they cannot, and costs nothing then. No payment server, no relay set up, a slow answer or an error: the list stays as it was.
// (A file of its own: pages are cached for ten minutes, and a module that imports something an older cached copy of another module does not have
// would not load.)

const TIMEOUT_MS = 2500; // longer than this and the phones go on without it: a join is never held up by the relay
const KEPT_MS = 20 * 60_000; // what was handed out is good for a day: asked again after twenty minutes
const RETRY_MS = 30_000; // after a failure: not again for half a minute

let kept = null; // { key, at, servers } or { key, at, servers: [] } after a failure

/** Where the relay's access is asked for: `turnUrl` of the settings, or /turn of the payment server. Null: no relay. */
export function relayUrl(config) {
  if (!config || config.noRelay) return null;
  const base = config.turnUrl ?? config.payments?.apiUrl;
  if (typeof base !== 'string' || !base) return null;
  return new URL('turn', base.endsWith('/') ? base : `${base}/`).href;
}

/** The relay's servers (a list that may be empty). Never throws. */
export async function relayServers(config, fetchFn = globalThis.fetch) {
  const url = relayUrl(config);
  if (!url || typeof fetchFn !== 'function') return [];
  const now = Date.now();
  if (kept && kept.key === url && now - kept.at < (kept.servers.length ? KEPT_MS : RETRY_MS)) return kept.servers;
  let servers = [];
  try {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), TIMEOUT_MS);
    try {
      const res = await fetchFn(url, { signal: controller?.signal, cache: 'no-store' });
      const data = res.ok ? await res.json() : null;
      servers = (Array.isArray(data?.iceServers) ? data.iceServers : []).filter((s) => s && s.urls && (Array.isArray(s.urls) ? s.urls.length : true));
    } finally {
      clearTimeout(timer);
    }
  } catch {
    servers = [];
  }
  kept = { key: url, at: Date.now(), servers };
  return servers;
}

/** The settings with the relay's servers added to the phones' list. */
export async function withRelay(config, fetchFn) {
  const extra = await relayServers(config, fetchFn);
  return extra.length ? { ...config, iceServers: [...(config.iceServers ?? []), ...extra] } : config;
}

/** Asks early (when the page is opened), so that the answer is there when somebody taps «Opprett spill» or «Bli med». */
export function prefetchRelay(config) {
  relayServers(config).catch(() => {});
}

/** For the tests: forget what was handed out. */
export function forgetRelay() {
  kept = null;
}
