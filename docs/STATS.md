# Statistikk: hva spillet teller, og hvor du ser det

Spillet teller anonymt hva som skjer (siden åpnes, et spill lages, pakkene vises …) og legger tallene i den samme Cloudflare-databasen (D1) som betalingstjenesten bruker. Du ser dem på **<https://disputt.site/stats/>** (skriv inn ADMIN_TOKEN fra Cloudflare). Det koster ingenting ved dagens trafikk: Cloudflare D1 er med i gratisplanen (100 000 skrivinger og 5 millioner lesinger per dag, 5 GB), og tellingen er begrenset til 10 000 hendelser per dag. Sjekket mot [Cloudflares prisside for D1](https://developers.cloudflare.com/d1/platform/pricing/) 3. november 2026.

## Å ta i bruk (én gang)

Ingenting nytt å opprette: databasen finnes, og tabellen `stats` lages av seg selv første gang Workeren kalles.

1. Lim inn nyeste `payments/worker-shopify.js` i Worker-editoren i Cloudflare og trykk **Deploy** (som sist).
2. `ADMIN_TOKEN` står allerede i Worker-innstillingene hvis Vipps-knappen er satt opp (ellers: Settings › Variables and secrets › legg til en hemmelig tekst på minst 16 tegn). Det er den samme teksten du skriver inn på `stats.html`.
3. Vent til siden er publisert (Actions › Pages er grønn), og åpne `/stats/`.

Tallene begynner å komme inn fra det øyeblikket Workeren er oppdatert. Før det ignorerer den bare meldingene fra spillet.

## Hva som telles

Bare **antall per dag** (etter norsk klokke), delt på språk, måte å spille på, pakke og betalingsmåte. Ingen navn, ingen IP-adresse, ingen informasjonskapsler, ingen id, ingen romkoder, og ingenting i nettleseren huskes. Det står i [personvernerklæringen](../public/personvern.html) (på norsk, dansk og svensk).

| Hendelse | Når |
| --- | --- |
| `visit` | Siden åpnes av en ny besøkende (ikke gjester med QR-kode, ikke noen som er på vei tilbake til et spill) |
| `start` | Verten trykker «Opprett spill» |
| `mode` | Verten velger måten å spille på (hytte eller bil) |
| `lobby` | Spillet er laget (verten er i lobbyen) |
| `joined` | En gjest er kommet inn i et spill |
| `game_start` | Første runde begynner |
| `round` | Hver runde som begynner (verten teller) |
| `players_2` … `players_10` | Hvor mange som spiller, talt når første runde begynner (ett av dem per spill) |
| `length_8`, `length_12`, `length_other` | Lengden på spillet, talt samtidig: Småkrangel (første til 8), Storkrangel (første til 12), eller et annet poengmål |
| `finished` | Spillet er spilt ferdig |
| `paywall` | Pakkene vises |
| `checkout` | Verten trykker for å betale (kort/nettbutikk eller Vipps-knappen, med pakken) |

**Kjøp** telles ikke i spillet. De hentes fra bestillingene Workeren allerede har (uten testbestillinger), så tallene stemmer med Shopify: antall, pakke og beløp etter refusjoner.

Ingen telling skjer for den som har «Do Not Track» eller «Global Privacy Control» på, på din egen maskin (localhost), eller mens betaling er av (da finnes ingen tjeneste å sende til).

## Hvordan tallene leses

- Det er **antall, ikke personer**. Samme person som åpner siden fem ganger, gir fem besøk.
- En vert som laster siden på nytt midt i en runde kan telle samme runde to ganger.
- «Trykket for å betale» teller også de som angrer i nettbutikken eller hos Vipps. Forskjellen til «Betalte» er dem som ikke fullførte.
- Prosentene i trakten er «av forrige steg» og «av første». Den som kommer inn med en QR-kode er med i `joined`, ikke i `visit`.

## Sperre mot gjetting av nøkkelen

Siden `/stats/` kan åpnes av hvem som helst som kjenner adressen, men de ser bare innloggingsboksen. Tallene gis bare ut mot `ADMIN_TOKEN`. Gjetter noen: etter **10 gale nøkler på en time** stenges alle admin-dørene (tallene, og Vipps-oppsettet og -sjekken) i resten av timen, også for riktig nøkkel (ellers ville en riktig gjetning avsløre seg selv). Avviste forsøk skrives ikke ned, så ingen kan fylle databasen på den måten. Spillet og betalingene påvirkes ikke.

Prisen er at en som gjetter kan stenge deg ute i en time. Da står det «Adminsidene er låst i en time», og du prøver igjen senere. Vil du åpne med en gang, tøm tabellen `admin_fails` i D1 (Cloudflare › D1 › databasen › Console: `DELETE FROM admin_fails;`).

Vil du ha siden helt lukket for andre, kan Cloudflare Access sette en innlogging foran den (gratis, men krever oppsett hos Cloudflare).

## Hvis noen misbruker det

Workeren tar bare imot kall fra spillsiden og teller høyst 10 000 hendelser per dag (`STATS_DAILY_CAP` i Worker-innstillingene kan endre det). Det hindrer at en som sender falske meldinger fyller opp den daglige skrivegrensen, som betalingene også bruker. Går grensen, slutter tellingen for dagen, men betalingene påvirkes ikke.
Rader eldre enn 400 dager slettes av seg selv.

## Filene

- `payments/worker-shopify.js`: `POST /e` (teller) og `GET /stats` (leser, krever ADMIN_TOKEN), tabellen `stats`.
- `public/js/stats.js`: sender hendelsen (`track`). `public/js/stats-watch.js`: ser på spillets tilstand og sier fra om hvert steg.
- `tools/stats-ui/`: kildekoden til siden du leser tallene på (React, Tailwind og shadcn/ui, med tekstene og oppsettet i `src/App.tsx`). Den er et eget lite prosjekt, og resten av spillet berøres ikke.
- `public/stats/`: den ferdig bygde siden, som er det som publiseres. **Den er sjekket inn**, slik at nettstedets egen bygging bare kopierer filer. Endrer du noe i `tools/stats-ui/`, må du bygge på nytt med `npm run stats:build` og sjekke inn begge deler.
- `public/js/stats-math.js`: regnestykkene bak tallene (samme fil brukes av siden og av testene).
- Tester: `test/worker-stats.test.js`, `test/stats.test.js`.
