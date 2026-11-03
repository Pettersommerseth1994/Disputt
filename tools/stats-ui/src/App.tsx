import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { ArrowDownRight, CircleAlert, Loader2, LogOut, ShieldCheck } from "lucide-react"
import { LANG_NAMES, METHOD_NAMES, MODE_NAMES, PLAN_NAMES, percent, summarize } from "@math"
import { loadStats } from "@/api"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const KEY = "disputt:stats-key" // sessionStorage: the admin key lasts until the tab is closed
const nf = new Intl.NumberFormat("nb-NO")
const n = (v: number) => nf.format(v)
const chartConfig = {
  visit: { label: "Åpnet siden", color: "#3b82f6" },
  lobby: { label: "Spill laget", color: "#10b981" },
} satisfies ChartConfig

type Step = { name: string; label: string; n: number }

function Funnel({ rows, relativeToFirst }: { rows: Step[]; relativeToFirst: boolean }) {
  const first = rows[0]?.n ?? 0
  return (
    <div className="flex flex-col gap-4">
      {rows.map((r, i) => (
        <div key={r.name} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{r.label}</span>
            <span className="flex items-center gap-2">
              {i > 0 && (
                <Badge variant="secondary" className="font-normal tabular-nums">
                  <ArrowDownRight data-icon="inline-start" /> {percent(r.n, rows[i - 1].n)}
                </Badge>
              )}
              <span className="w-12 text-right font-semibold tabular-nums">{n(r.n)}</span>
            </span>
          </div>
          <Progress value={relativeToFirst ? (first ? (r.n / first) * 100 : 0) : first ? (r.n / first) * 100 : 0} />
        </div>
      ))}
    </div>
  )
}

function Stat({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <div className="text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      </CardHeader>
      <CardFooter className="text-xs text-muted-foreground">{hint}</CardFooter>
    </Card>
  )
}

function Login({ error, onLogin }: { error: string; onLogin: (key: string) => void }) {
  const [value, setValue] = useState("")
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <CardTitle>Statistikk</CardTitle>
          <CardDescription>Skriv inn adminnøkkelen (ADMIN_TOKEN fra Cloudflare) for å se tallene.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (value.trim()) onLogin(value.trim())
            }}
          >
            {error && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="token">Adminnøkkel</Label>
              <Input id="token" type="password" autoComplete="off" autoCapitalize="off" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <Button type="submit">Vis tallene</Button>
          </form>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">Nøkkelen sendes bare til betalingstjenesten og huskes til du lukker fanen.</CardFooter>
      </Card>
    </div>
  )
}

const readKey = () => {
  try {
    return sessionStorage.getItem(KEY) ?? ""
  } catch {
    return ""
  }
}
const writeKey = (key: string) => {
  try {
    if (key) sessionStorage.setItem(KEY, key)
    else sessionStorage.removeItem(KEY)
  } catch {
    /* no storage: the key then lasts for this page only */
  }
}

export default function App() {
  const [key, setKey] = useState(readKey)
  const [days, setDays] = useState(30)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // light or dark, as the phone has it
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => document.documentElement.classList.toggle("dark", media.matches)
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [])

  const logout = (message = "") => {
    writeKey("")
    setKey("")
    setData(null)
    setError(message)
  }

  useEffect(() => {
    if (!key) return
    let stale = false
    setLoading(true)
    loadStats(days, key).then((r) => {
      if (stale) return
      setLoading(false)
      if (r.ok) {
        setData(r.data)
        setError("")
      } else if (r.failure.kind === "key") logout(r.failure.message)
      else setError(r.failure.message)
    })
    return () => {
      stale = true
    }
  }, [key, days])

  const s = useMemo(() => (data ? summarize(data) : null), [data])
  if (!key) return <Login error={error} onLogin={(k) => { writeKey(k); setError(""); setKey(k) }} />
  if (!s) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-sm text-muted-foreground">
        {error ? (
          <Alert variant="destructive" className="max-w-sm">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Henter tallene …</span>
        )}
        {error && <Button variant="outline" onClick={() => logout()}>Tilbake</Button>}
      </div>
    )
  }

  const money =
    Object.entries(s.sales.revenue as Record<string, number>)
      .map(([cur, v]) => `${nf.format(Math.round(v))} ${cur === "NOK" ? "kr" : cur}`)
      .join(" og ") || "0 kr"
  const chartData = s.days.map((d: any) => ({ ...d, label: d.day.slice(5).replace("-", ".") }))
  const activeDays = [...s.days].reverse().filter((d: any) => d.visit || d.lobby || d.game_start || d.paywall || d.checkout || d.sold)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Statistikk</h1>
          <p className="text-sm text-muted-foreground">Disputt · det spillet har talt og de kjøpene som er betalt</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <TabsList>
              <TabsTrigger value="7">7 dager</TabsTrigger>
              <TabsTrigger value="30">30 dager</TabsTrigger>
              <TabsTrigger value="90">90 dager</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="icon" aria-label="Logg ut" onClick={() => logout()}>
            <LogOut />
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className={`grid grid-cols-2 gap-3 transition-opacity lg:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
        <Stat title="Åpnet siden" value={n(s.visits)} hint="besøk, ikke personer" />
        <Stat title="Spill laget" value={n(s.game[3].n)} hint={`${percent(s.game[3].n, s.visits)} av besøkene`} />
        <Stat title="Runder spilt" value={n(s.rounds)} hint={`${n(s.joined)} gjester kom inn med QR-kode`} />
        <Stat title="Kjøp" value={n(s.sales.orders)} hint={`${money} inn etter refusjoner`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Dag for dag</CardTitle>
          <CardDescription>Besøk og spill som ble laget, siste {data.days} dager (norsk klokke)</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
            <AreaChart data={chartData} margin={{ left: 0, right: 8 }}>
              <defs>
                {(["visit", "lobby"] as const).map((k) => (
                  <linearGradient key={k} id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={`var(--color-${k})`} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={`var(--color-${k})`} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" labelFormatter={(v) => `${v}`} />} />
              <Area dataKey="visit" type="monotone" fill="url(#fill-visit)" stroke="var(--color-visit)" />
              <Area dataKey="lobby" type="monotone" fill="url(#fill-lobby)" stroke="var(--color-lobby)" />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spillet, steg for steg</CardTitle>
            <CardDescription>Pilen viser andelen av forrige steg</CardDescription>
          </CardHeader>
          <CardContent>
            <Funnel rows={s.game} relativeToFirst />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Betaling</CardTitle>
            <CardDescription>
              {percent(s.pay[2].n, s.pay[0].n)} av dem som så pakkene, endte med et kjøp
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Funnel rows={s.pay} relativeToFirst />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pakke</TableHead>
                  <TableHead>Betalingsmåte</TableHead>
                  <TableHead className="text-right">Trykket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.checkouts.map((c: any) => (
                  <TableRow key={c.plan + c.method}>
                    <TableCell className="font-medium">{PLAN_NAMES[c.plan] ?? c.plan}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{METHOD_NAMES[c.method] ?? c.method}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{n(c.n)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            «Trykket for å betale» teller også de som angret i nettbutikken eller hos Vipps.
          </CardFooter>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Måten å spille på</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead className="text-right">Spill</TableHead>
                  <TableHead className="text-right">Runder</TableHead>
                  <TableHead className="text-right">Ferdig</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.byMode.map((m: any) => (
                  <TableRow key={m.mode}>
                    <TableCell className="font-medium whitespace-normal">{MODE_NAMES[m.mode]}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(m.lobby)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(m.round)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(m.finished)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Språk</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead className="text-right">Åpnet</TableHead>
                  <TableHead className="text-right">Spill</TableHead>
                  <TableHead className="text-right">Så pakkene</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.byLang.map((l: any) => (
                  <TableRow key={l.lang}>
                    <TableCell className="font-medium">{LANG_NAMES[l.lang] ?? l.lang}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(l.visit)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(l.lobby)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(l.paywall)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tabell, dag for dag</CardTitle>
          <CardDescription>Nyeste dag øverst. Dager uten aktivitet er utelatt.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Dag</TableHead>
                  <TableHead className="text-right">Åpnet</TableHead>
                  <TableHead className="text-right">Spill</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Første runde</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Pakker</TableHead>
                  <TableHead className="text-right">Betal</TableHead>
                  <TableHead className="text-right">Kjøp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeDays.map((d: any) => (
                  <TableRow key={d.day}>
                    <TableCell className="font-medium">{d.day.slice(5).replace("-", ".")}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(d.visit)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(d.lobby)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{n(d.game_start)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{n(d.paywall)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(d.checkout)}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.sold ? <Badge>{d.sold}</Badge> : 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="pb-4 text-xs text-muted-foreground">
        Tallene er antall, ikke personer. Kjøpene hentes fra bestillingene (uten testbestillinger), ikke fra tellingen i spillet. Ingen telling for dem som har «Do Not Track» på.
      </p>
    </div>
  )
}
