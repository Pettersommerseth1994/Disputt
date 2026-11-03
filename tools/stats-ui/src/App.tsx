import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { ArrowDownRight, ArrowUpRight, CircleAlert, Loader2, LogOut, Minus, ShieldCheck } from "lucide-react"
import { LANG_NAMES, METHOD_NAMES, MODE_NAMES, PLAN_NAMES, change, percent, splitPeriods, summarize } from "@math"
import { loadStats } from "@/api"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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
  game_start: { label: "Første runde", color: "#a855f7" },
  paywall: { label: "Så pakkene", color: "#f59e0b" },
  checkout: { label: "Trykket betal", color: "#3b82f6" },
  sold: { label: "Kjøp", color: "#10b981" },
  income: { label: "Inn (kr)", color: "#10b981" },
  cabin: { label: "Hytteturmodus", color: "#3b82f6" },
  car: { label: "Bilturmodus", color: "#f59e0b" },
  other: { label: "Annet", color: "#a1a1aa" },
} satisfies ChartConfig

// the series of each view of the big chart
const VIEWS = {
  game: { title: "Besøk og spill", description: "Besøk, spill som ble laget og spill der første runde kom i gang", keys: ["visit", "lobby", "game_start"], kind: "area" },
  pay: { title: "Betaling", description: "Så pakkene, trykket for å betale og kjøp per dag", keys: ["paywall", "checkout", "sold"], kind: "bar" },
  income: { title: "Inntekt", description: "Kroner inn per dag, etter refusjoner", keys: ["income"], kind: "bar" },
} as const
type ViewKey = keyof typeof VIEWS

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

/** The change since the period before, as a small badge (nothing when there is nothing to compare with). */
function Delta({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return null
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus
  return (
    <Badge variant="outline" className="font-normal tabular-nums">
      <Icon data-icon="inline-start" /> {value > 0 ? "+" : ""}
      {value} %
    </Badge>
  )
}

function Stat({ title, value, hint, delta, small }: { title: string; value: string; hint: string; delta?: number | null; small?: boolean }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="flex items-center justify-between gap-2">
          {title}
          <Delta value={delta} />
        </CardDescription>
        <div className={`${small ? "text-2xl" : "text-3xl"} font-semibold tracking-tight tabular-nums`}>{value}</div>
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
    loadStats(days < 90 ? days * 2 : days, key).then((r) => {  // (twice as many days, to have a period before to compare with)
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

  const periods = useMemo(() => {
    if (!data) return null
    const { current, previous } = splitPeriods(data, days)
    return { current, s: summarize(current), p: previous ? summarize(previous) : null }
  }, [data, days])
  const s = periods?.s ?? null
  const p = periods?.p ?? null
  const [view, setView] = useState<ViewKey>("game")
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


  const money = (revenue: Record<string, number>) =>
    Object.entries(revenue)
      .map(([cur, v]) => `${nf.format(Math.round(v))} ${cur === "NOK" ? "kr" : cur}`)
      .join(" og ") || "0 kr"
  const chartData = s.days.map((d: any) => ({ ...d, label: d.day.slice(5).replace("-", ".") }))
  const activeDays = [...s.days].reverse().filter((d: any) => d.visit || d.lobby || d.game_start || d.paywall || d.checkout || d.sold)
  const v = VIEWS[view]
  const vs = (key: string) => (p ? change(s[key], p[key]) : null) // the change since the period before
  const plans = Object.keys(s.sales.perPlan).sort((a, b) => s.sales.perPlan[b] - s.sales.perPlan[a])
  const spanText = p ? `mot de ${s.days.length} dagene før` : "kommer når tellingen har pågått i to perioder (ingen sammenligning ennå)"
  const noData = !s.first

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Statistikk</h1>
          <p className="text-sm text-muted-foreground">Disputt · det spillet har talt og de kjøpene som er betalt{s.first ? ` · talt siden ${s.first.slice(8)}.${s.first.slice(5, 7)}.` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={String(days)} onValueChange={(x) => setDays(Number(x))}>
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

      <div className={`flex flex-col gap-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat title="Åpnet siden" value={n(s.visits)} hint="besøk, ikke personer" delta={vs("visits")} />
          <Stat title="Spill laget" value={n(s.games)} hint={`${percent(s.games, s.visits)} av besøkene`} delta={vs("games")} />
          <Stat title="Runder spilt" value={n(s.rounds)} hint={`${n(s.joined)} gjester kom inn med QR-kode`} delta={vs("rounds")} />
          <Stat title="Kjøp" value={n(s.sales.orders)} hint={`${money(s.sales.revenue)} inn etter refusjoner`} delta={p ? change(s.sales.orders, p.sales.orders) : null} />
        </section>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat small title="Gjester per spill" value={s.kpi.guestsPerGame === null ? "–" : String(s.kpi.guestsPerGame).replace(".", ",")} hint="som kom inn med QR-kode" />
          <Stat small title="Runder per spill" value={s.kpi.roundsPerGame === null ? "–" : String(s.kpi.roundsPerGame).replace(".", ",")} hint="av spill der første runde kom i gang" />
          <Stat small title="Spilt ferdig" value={s.kpi.finishRate} hint="av spill som kom i gang" />
          <Stat small title="Snittkjøp" value={s.kpi.averageOrder === null ? "–" : `${n(s.kpi.averageOrder)} kr`} hint={s.sales.refunded ? `${s.sales.refunded} kjøp refundert helt` : "ingen refunderte"} />
        </section>
        <p className="text-xs text-muted-foreground">Endring i prosent {spanText}.</p>
      </div>

      {noData && (
        <Alert>
          <CircleAlert />
          <AlertDescription>Ingenting er talt i denne perioden ennå.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{v.title}</CardTitle>
          <CardDescription>
            {v.description} (siste {s.days.length} dager, norsk klokke)
          </CardDescription>
          <CardAction>
            <Tabs value={view} onValueChange={(x) => setView(x as ViewKey)}>
              <TabsList>
                <TabsTrigger value="game">Spill</TabsTrigger>
                <TabsTrigger value="pay">Betaling</TabsTrigger>
                <TabsTrigger value="income">Inntekt</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
            {v.kind === "area" ? (
              <AreaChart data={chartData} margin={{ left: 0, right: 8 }}>
                <defs>
                  {v.keys.map((k) => (
                    <linearGradient key={k} id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={`var(--color-${k})`} stopOpacity={0.5} />
                      <stop offset="95%" stopColor={`var(--color-${k})`} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                {v.keys.map((k) => (
                  <Area key={k} dataKey={k} type="monotone" isAnimationActive={false} fill={`url(#fill-${k})`} stroke={`var(--color-${k})`} />
                ))}
              </AreaChart>
            ) : (
              <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                {v.keys.map((k) => (
                  <Bar key={k} dataKey={k} fill={`var(--color-${k})`} radius={3} isAnimationActive={false} />
                ))}
              </BarChart>
            )}
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spillet, steg for steg</CardTitle>
            <CardDescription>Merkelappen viser andelen av forrige steg</CardDescription>
          </CardHeader>
          <CardContent>
            <Funnel rows={s.game} relativeToFirst />
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Gjester som kom inn med QR-koden teller ikke som besøk, bare som «gjester» ({n(s.joined)}). Verten teller, ikke gjestene. En vert som laster siden på nytt midt i en runde kan telle samme runde to ganger.
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Betaling</CardTitle>
            <CardDescription>{percent(s.pay[2].n, s.pay[0].n)} av dem som så pakkene, endte med et kjøp</CardDescription>
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
                {s.checkouts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">Ingen har trykket for å betale ennå</TableCell>
                  </TableRow>
                )}
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
          <CardFooter className="text-xs text-muted-foreground">«Trykket for å betale» teller også de som angret i nettbutikken eller hos Vipps.</CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kjøp per pakke</CardTitle>
          <CardDescription>Fra bestillingene (uten testbestillinger), etter refusjoner</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pakke</TableHead>
                <TableHead className="text-right">Kjøp</TableHead>
                <TableHead className="text-right">Inn</TableHead>
                <TableHead className="text-right">Andel av kjøpene</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">Ingen kjøp i perioden</TableCell>
                </TableRow>
              )}
              {plans.map((k) => (
                <TableRow key={k}>
                  <TableCell className="font-medium">{PLAN_NAMES[k] ?? k}</TableCell>
                  <TableCell className="text-right tabular-nums">{n(s.sales.perPlan[k])}</TableCell>
                  <TableCell className="text-right tabular-nums">{n(Math.round(s.sales.perPlanIncome[k]))} kr</TableCell>
                  <TableCell className="text-right tabular-nums">{percent(s.sales.perPlan[k], s.sales.orders)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Måten å spille på</CardTitle>
            <CardDescription>Hytte (hver sin telefon) og Bil (én telefon) ved siden av hverandre</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead className="text-right">Valgt</TableHead>
                    <TableHead className="text-right">Spill</TableHead>
                    <TableHead className="text-right">1. runde</TableHead>
                    <TableHead className="text-right">Runder</TableHead>
                    <TableHead className="text-right">Ferdig</TableHead>
                    <TableHead className="text-right">Pakker</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.byMode.map((m: any) => (
                    <TableRow key={m.mode}>
                      <TableCell className="font-medium">{m.mode === "cabin" ? "Hytte" : m.mode === "car" ? "Bil" : MODE_NAMES[m.mode]}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(m.chosen)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(m.lobby)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(m.game_start)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(m.round)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(m.finished)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(m.paywall)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Språk</CardTitle>
            <CardDescription>Språket på verten sin telefon</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead className="text-right">Åpnet</TableHead>
                    <TableHead className="text-right">Spill</TableHead>
                    <TableHead className="text-right">1. runde</TableHead>
                    <TableHead className="text-right">Pakker</TableHead>
                    <TableHead className="text-right">Betal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.byLang.map((l: any) => (
                    <TableRow key={l.lang}>
                      <TableCell className="font-medium">{LANG_NAMES[l.lang] ?? l.lang}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(l.visit)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(l.lobby)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(l.game_start)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(l.paywall)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(l.checkout)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Spillere og lengde</CardTitle>
          <CardDescription>
            {s.countedGames
              ? `Fra ${n(s.countedGames)} spill som kom i gang · i snitt ${String(s.kpi.playersPerGame).replace(".", ",")} spillere`
              : "Telles fra spillet som kommer i gang. Ingen spill er talt med spillere og lengde ennå."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium">Antall spillere</div>
            <ChartContainer config={chartConfig} className="aspect-auto h-44 w-full">
              <BarChart data={s.players.map((x: any) => ({ ...x, label: String(x.size) }))} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="cabin" stackId="a" fill="var(--color-cabin)" isAnimationActive={false} />
                <Bar dataKey="car" stackId="a" fill="var(--color-car)" isAnimationActive={false} />
                <Bar dataKey="other" stackId="a" fill="var(--color-other)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#3b82f6]" /> Hytteturmodus</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#f59e0b]" /> Bilturmodus</span>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="text-sm font-medium">Lengde på spillet</div>
            {s.lengths.map((l: any) => (
              <div key={l.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium">{l.label}</span> <span className="text-xs text-muted-foreground">{l.hint}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-normal tabular-nums">{percent(l.n, s.lengths.reduce((t: number, x: any) => t + x.n, 0))}</Badge>
                    <span className="w-10 text-right font-semibold tabular-nums">{n(l.n)}</span>
                  </span>
                </div>
                <Progress value={s.lengths.reduce((t: number, x: any) => t + x.n, 0) ? (l.n / s.lengths.reduce((t: number, x: any) => t + x.n, 0)) * 100 : 0} />
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">Telles når første runde begynner. Spillere som kommer inn senere, eller en lengde som endres underveis, telles ikke på nytt.</CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ukedager</CardTitle>
          <CardDescription>Når på uka spilles det? Summen av besøk og spill per ukedag i perioden</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="aspect-auto h-44 w-full">
            <BarChart data={s.weekdays.map((d: any) => ({ ...d, label: d.name.slice(0, 3) }))} margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
              <Bar dataKey="visit" fill="var(--color-visit)" radius={3} isAnimationActive={false} />
              <Bar dataKey="lobby" fill="var(--color-lobby)" radius={3} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

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
                  <TableHead className="hidden text-right sm:table-cell">Runder</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Pakker</TableHead>
                  <TableHead className="text-right">Betal</TableHead>
                  <TableHead className="text-right">Kjøp</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Inn</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeDays.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">Ingenting talt i perioden ennå</TableCell>
                  </TableRow>
                )}
                {activeDays.map((d: any) => (
                  <TableRow key={d.day}>
                    <TableCell className="font-medium">{d.day.slice(5).replace("-", ".")}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(d.visit)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(d.lobby)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{n(d.game_start)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{n(d.round)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{n(d.paywall)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(d.checkout)}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.sold ? <Badge>{d.sold}</Badge> : 0}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{d.income ? `${n(Math.round(d.income))} kr` : "–"}</TableCell>
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
