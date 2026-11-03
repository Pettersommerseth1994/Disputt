// The calls to the payment server (payments/worker-shopify.js): GET /stats with the admin key. Where the server is comes from the site's own
// /config.js (written by the site's build), so this page needs no setting of its own. docs/STATS.md.

export type Failure = { kind: "no-api" | "key" | "server" | "network"; message: string }
export type Result = { ok: true; data: any } | { ok: false; failure: Failure }

const fail = (kind: Failure["kind"], message: string): Result => ({ ok: false, failure: { kind, message } })

async function apiBase(): Promise<string | null> {
  try {
    const mod = await import(/* @vite-ignore */ new URL("../../config.js", import.meta.url).href)
    const url = mod.default?.payments?.apiUrl
    return url ? String(url).replace(/\/+$/, "") : null
  } catch {
    return null
  }
}

export async function loadStats(days: number, key: string): Promise<Result> {
  const api = await apiBase()
  if (!api) return fail("no-api", "Betalingstjenesten er ikke satt opp i denne utgaven av siden, så det er ingenting å vise.")
  let res: Response
  try {
    res = await fetch(`${api}/stats?days=${days}`, { headers: { Authorization: `Bearer ${key}` }, credentials: "omit" })
  } catch {
    return fail("network", "Fikk ikke kontakt med betalingstjenesten. Prøv igjen om litt.")
  }
  const body = await res.json().catch(() => null)
  if (res.status === 401) return fail("key", "Feil adminnøkkel.")
  if (!res.ok || !body?.events) return fail("server", body?.message ?? "Noe gikk galt hos betalingstjenesten.")
  return { ok: true, data: body }
}
