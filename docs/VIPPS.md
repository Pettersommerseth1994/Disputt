# Betal med Vipps: slik setter du opp knappen i spillet

> Sist kontrollert mot dokumentasjonen til Vipps MobilePay, Shopify og Cloudflare: **15. oktober 2026**. Menyer og knapper flytter seg av og til; navnene under står på engelsk, slik de heter i Vipps-portalen, Shopify og Cloudflare når kontoen er på engelsk. Finner du ikke en knapp, søk etter navnet. Dette er teknisk veiledning, ikke juridisk eller skattemessig rådgivning: vilkår, angrerett, mva og personvern må du få sjekket av en som kan det.
>
> **Dette bygger på [SHOPIFY.md](SHOPIFY.md).** Butikken, produktene, e-posten og betalingsserveren må være satt opp først. Her legger du til én ting: en knapp i spillet som sender verten rett til Vipps.

Innhold: [Kort fortalt](#kort-fortalt) · [1. Slik virker det](#1-slik-virker-det) · [2. Før du begynner](#2-før-du-begynner) · [3. Vipps](#3-vipps-avtale-salgssted-og-nøkler) · [4. Shopify-appen](#4-shopify-appen-som-får-lage-ordrer) · [5. Betalingsserveren](#5-betalingsserveren) · [6. Test alt](#6-test-alt) · [7. Gå live](#7-gå-live) · [8. Drift](#8-drift) · [9. Koden](#9-slik-henger-koden-sammen) · [10. Begrensninger](#10-begrensninger-og-mulige-neste-steg) · [11. Kilder](#11-kilder)

## Kort fortalt

**Det som er laget (i koden):** en oransje knapp **Betal med Vipps** rett over **Betal med kort** på pakkeskjermen, tegnet i spillets egen stil (som de andre knappene) i Vipps' oransje. Verten velger pakke, krysser av for vilkårene (samme boks som før) og trykker knappen. Vipps åpner seg i en **ny fane** (i Vipps-appen på telefonen), verten godkjenner, og spillet viser **«Velkommen!»** av seg selv, akkurat som etter en betaling i butikken. Bak knappen ligger en vanlig, betalt ordre i Shopify, så kvittering, mva og ordreoversikt er der som før, og tilgangen og koden virker som før. **Alt er av som standard:** knappen vises først når alt i denne veiledningen er satt opp og du har skrudd på `VIPPS_ENABLED`. «Betal med kort» (Shopifys kasse med kort, Apple Pay og Vipps) er der fortsatt.

**Hvorfor ikke «hurtigkasse»?** Det du har satt opp i Shopify (hurtigkasse og Vipps MobilePay-tillegget) virker i Shopifys kasse, og det blir stående som det er. Men Vipps' tillegg for Shopify kan ikke starte en betaling fra en knapp utenfor kassen: tillegget har ikke hurtigbetaling («Express»). Skal knappen ligge i spillet og gå rett til Vipps, må spillet (via betalingsserveren) snakke med Vipps selv. Det er det denne veiledningen setter opp.

**Hva som er prøvd, og hva ikke.** 79 nye automatiske tester og en kjøring i en ekte nettleser går gjennom hele løpet mot en **etterlikning** av Vipps og en **etterlikning** av Shopify, begge bygget etter dokumentasjonen: knappen, ny fane, avbrutt og avvist betaling, betaling med Vipps' varsel forsinket, «Velkommen!»-siden, ordren i butikken og at ingenting skjer to ganger. **Det er ikke prøvd mot ekte Vipps eller ekte Shopify.** Det første testkjøpet i Vipps' testmiljø ([del 6](#6-test-alt)) er den ekte prøven. Skulle noe være annerledes enn dokumentasjonen sier (en tilgang som mangler i Shopify-appen, et felt Shopify tolker på sin måte), står feilen i `/health` og i Cloudflares logg, og er som regel en variabel eller en tilgang å rette.

**Prisene** er de samme som i butikken: betalingsserveren henter dem fra produktene i Shopify (og husker dem i ti minutter). Endrer du en pris der, gjelder den begge veier.

**Det du må gjøre** (tidsbruk er et grovt anslag; ventetid hos andre kommer i tillegg):

| # | Hva | Hvor | Tid |
| --- | --- | --- | --- |
| 1 | **Vipps:** testsalgssted og nøkler, testbruker og testapp, og eventuelt bestille eget salgssted i live ([del 3](#3-vipps-avtale-salgssted-og-nøkler)) | Vipps-portalen, telefon | 30 til 45 min; et eget live-salgssted kan ta opptil ti virkedager hos Vipps. **Start med en gang.** |
| 2 | Lag appen i Shopify som får lage ordrer ([del 4](#4-shopify-appen-som-får-lage-ordrer)) | Shopify Dev Dashboard | 20 min |
| 3 | Oppdater betalingsserveren, legg inn variablene og klokken ([del 5.1 til 5.4](#51-legg-inn-den-nye-koden)) | Cloudflare | 45 min |
| 4 | Registrer webhooken og kjør sjekken ([del 5.5 og 5.6](#55-registrer-webhooken-hos-vipps)) | Terminal | 10 min |
| 5 | Test med testappen ([del 6](#6-test-alt)) | telefon | 1 til 2 timer |
| 6 | Gå live ([del 7](#7-gå-live)) | alle | 1 til 2 timer |

**Forutsetning:** Shopify-oppsettet fra [SHOPIFY.md](SHOPIFY.md) (del 3 til 12) er gjort, altså at butikken og betalingsserveren allerede tar imot betaling. Det er det hos deg.

**Det jeg har antatt** (si fra hvis noe skal være annerledes):

- Knappen er **i tillegg til** «Betal med kort», ikke i stedet. Kunder som vil bruke kort eller Apple Pay har fortsatt butikken.
- Pengene **tas ut med en gang** verten har godkjent (capture). Det er et digitalt produkt som leveres med en gang, så det er ingen grunn til å vente.
- Fra Vipps hentes **bare e-postadressen**, og bare for at kvitteringen har et sted å gå. Ikke navn og ikke telefonnummer. Vipps ber kunden godkjenne delingen i appen (én linje). Godkjenner kunden ikke, blir betalingen ikke gjennomført.
- Ordrer fra Vipps merkes i Shopify med kilden «Vipps», taggene `vipps` og referansen hos Vipps, og betalingsmåten «Vipps».
- Bare **norske kroner**. Butikken må selge i NOK.

## 1. Slik virker det

### Det verten opplever

1. På pakkeskjermen velger verten pakke og krysser av for vilkårene. **Betal med Vipps** er grå til boksen er krysset av.
2. Verten trykker knappen. Vipps åpner seg i en **ny fane**. På en telefon åpner Vipps-appen seg og viser beløpet, og ber verten dele e-postadressen. På en datamaskin skriver verten telefonnummeret sitt.
3. Verten godkjenner. Vipps sender verten tilbake til en liten side i spillet, **«Velkommen!»** (`takk.html`), i den nye fanen. Den sier at betalingen er gjennomført og lukker seg selv, eller har en knapp som lukker fanen.
4. Spillet står i fanen bak og sier «Venter på betalingen …». Så snart betalingen er funnet, viser det **«Velkommen!»** med tilgang og kode, og lukker Vipps-fanen hvis den fortsatt er åpen. **Start runde 3** fortsetter spillet. Gjestene har vært tilkoblet hele tiden.
5. Avbryter verten i Vipps, eller blir betalingen avvist: «Velkommen!»-siden sier «Betalingen ble ikke gjennomført. Ingen penger er trukket.» Verten trykker **Avbryt** i spillet og kan prøve igjen (da må boksen krysses av på nytt).
6. Vipps åpner siden verten kommer tilbake til i **telefonens standardnettleser**, og det trenger ikke være den nettleseren spillet står i. Det gjør ingenting: spillet spør selv, og finner betalingen så snart verten er tilbake i det. Og står ikke spillet lenger der (nettleseren la det i dvale): koden står i e-posten, og «Logg inn» (under pakkene) gir tilgangen tilbake.

**Færre faner på telefon.** Vipps sender kunden tilbake ved at appen ber telefonen åpne returadressen i standardnettleseren, og telefonen åpner den i en **ny fane** som ikke kan styres derfra. Derfor åpner en **telefon** Vipps-appen rett fra spillfanen (Vipps' flyt `NATIVE_REDIRECT`, en adresse som `vipps://…`), uten en egen fane for Vipps. Returfanen er da den eneste nye fanen, slik som med kortbetaling. Linjen nederst sier «Fullfør betalingen i Vipps-appen» og har knappen «Åpne Vipps igjen». En datamaskin kan ikke åpne appen og bruker en egen fane med Vipps' side (der skriver du telefonnummeret). Har ikke kunden Vipps-appen på telefonen, skjer det ingenting når hun trykker: hun trykker «Avbryt» og bruker «Betal med kort». **Ikke prøvd mot ekte Vipps.**

### Fire deler

```
 Verten (nettleseren)        Betalingsserveren (Cloudflare)         Vipps                    Butikken (Shopify)
 ────────────────────        ──────────────────────────────         ─────                    ──────────────────
 «Betal med Vipps»  ───────▶ /vipps/start: skriver ned betalingen
 (ny fane åpnes)             og lager den hos Vipps  ────────────▶ betalingen lages
                    ◀─────── adressen hos Vipps  ◀────────────────
 verten sendes dit  ─────────────────────────────────────────────▶ verten godkjenner i appen
                                                    ◀── webhook ── «godkjent»  (signert)
                             spør Vipps, tar ut pengene (capture) ▶
                             lager en betalt ordre  ───────────────────────────────────────▶ ordren, med kode og samtykke
                             skriver ned koden, som for en vanlig ordre
 spør «er koden betalt?» ──▶ /restore
                    ◀─────── { token, code }: en signert tilgang
 «Velkommen!» · «Start runde 3»
```

| Del | Gjør | Vet og lagrer |
| --- | --- | --- |
| **Telefonen** (appen på GitHub Pages) | viser knappen, lager koden, åpner Vipps i en ny fane, spør om koden er betalt | tilgangen og koden (`localStorage`), den pågående betalingen (`sessionStorage`) |
| **Vipps** | tar imot godkjenningen, trekker pengene, sender e-postadressen kunden deler | betalingen, med referansen vår |
| **Betalingsserveren** (Cloudflare Worker, `payments/worker-shopify.js`, med D1-databasen) | lager betalingen, passer på at den blir ferdig, tar ut pengene, lager ordren i Shopify, svarer på «er koden betalt?» | referansen, koden, pakken, beløpet, tidspunktene, ordrenummeret og hvor langt betalingen har kommet. **Ingen navn og ingen e-postadresser.** E-postadressen går bare gjennom, på vei til Shopify. |
| **Butikken** (Shopify) | holder ordren, sender e-post, tar imot refusjoner | ordren: pakken, prisen med mva, e-postadressen, koden og tidspunktet for samtykket |

### Tre veier til samme mål

Å bli ferdig med en betaling betyr alltid det samme: spør Vipps hvordan det gikk, ta ut pengene (én gang), lag ordren i Shopify (én gang), skriv ned koden. Tre ting kan sette det i gang, og det er med vilje:

1. **Vipps ringer** betalingsserveren (webhook, signert). Det går raskest.
2. **Siden spør.** «Velkommen!»-siden spør hvert andre sekund (i ca. 30 sekunder), og spillet spør hvert tredje sekund mens verten betaler. Hver gang betalingsserveren blir spurt, spør den Vipps selv. Kommer ikke Vipps' webhook (den kan bli forsinket), er det likevel ikke noe problem.
3. **Klokken.** En Cron Trigger i Cloudflare ser etter betalinger som er godkjent men som ingen har spurt om, hvert femte minutt (for eksempel en vert som lukket telefonen rett etter å ha godkjent).

Alle tre kan komme samtidig og flere ganger, og det skjer likevel bare én gang: databasen holder en lås på hver betaling, Vipps teller et uttak med samme nøkkel bare én gang, og ordren i Shopify søkes opp på referansen (en tag) før en ny lages.

### Hva som passer på pengene

- **Ingenting leveres før Vipps har bekreftet at pengene er tatt ut**, og betalingsserveren sjekker beløpet i det Vipps svarer, ikke bare at kallet gikk bra.
- **Prisen kommer fra Shopify, ikke fra siden.** En side som er endret kan ikke sette en lavere pris. Er beløpet hos Vipps ikke det betalingsserveren ba om, tas ingenting ut, og beløpet som er reservert slippes.
- **Samtykket** (tidspunktet for avkrysningen) følger med ordren som attributten `samtykke`, akkurat som i butikken. En betaling uten samtykke starter ikke.
- **En betaling som aldri ble godkjent** (verten ga opp) gir ingenting. Betalingen går ut hos Vipps, og betalingsserveren gir den opp etter et døgn.
- **Uttaket feiler eller ordren lar seg ikke lage?** Pengene er da tatt ut uten at kunden har fått noe. Det vises i `/health` som `stuck` etter fem minutter, klokken prøver igjen hvert femte minutt i syv dager, og `note` i databasen sier hva som gikk galt ([del 8](#8-drift)).

## 2. Før du begynner

Alt i [SHOPIFY.md, del 2](SHOPIFY.md#2-før-du-begynner-virksomhet-skatt-og-jus) gjelder også her. Det som er nytt med Vipps-knappen:

- [ ] **Shopify-oppsettet fungerer.** Butikken, produktene, e-posten, betalingsserveren og webhooken fra SHOPIFY.md del 3 til 12, og `…/health` på Workeren viser `"ok":true` med alt under `set` på `true`. Test-kopien først.
- [ ] **Avtale med Vipps MobilePay for Pesom Holding AS.** Du har allerede et salgssted fra Shopify-tillegget ([del 3](#3-vipps-avtale-salgssted-og-nøkler) sier hva du kan gjøre med det).
- [ ] **Vilkår og personvern er skrevet om for knappen.** Dette står nå i [`public/vilkar.html`](../public/vilkar.html) og [`public/personvern.html`](../public/personvern.html), og skal leses av en som kan jus sammen med spørsmålene i SHOPIFY.md del 2:
  - *Vilkårene, punkt 2:* du kan betale på to måter, med knappen i spillet (betalingen skjer hos Vipps MobilePay, og kjøpet registreres i butikken etterpå) eller i butikken. E-postadressen deles i Vipps-appen, og ordrebekreftelsen sendes dit.
  - *Personvern:* Vipps MobilePay er også betalingsleverandør direkte; vi ber Vipps om e-postadressen; betalingsserveren lagrer fortsatt ingen navn eller e-postadresser (referansen hos Vipps lagres i tillegg);.
  - Spørsmål til juristen: dekker avkrysningen i spillet også betaling i en annen app (Vipps)?
- [ ] **Gebyrer.** Vipps MobilePay tar gebyr per betaling etter avtalen du får (se prislisten i portalen). Sammenlign med butikken: der betaler du Shopifys 2 % ekstra for Vipps som tredjepartsbetaling, i tillegg til Vipps' eget gebyr (SHOPIFY.md del 4). **Ikke sjekket:** om Shopify tar transaksjonsgebyr for en ordre som betalingsserveren legger inn som betalt med Vipps. Se på første faktura fra Shopify og spør dem om du ser et gebyr du ikke venter.

## 3. Vipps: avtale, salgssted og nøkler

Alt her gjøres i Vipps MobilePays **portal**: <https://portal.vippsmobilepay.com>. Innloggingen er med eID (se på innloggingsskjermen hva som gjelder for Norge). Nøklene er hemmelige: lim dem inn i Cloudflare selv, og send dem ikke til noen, heller ikke til meg.

**To måter å få nøkler på.** Salgsstedet du har fra Shopify-tillegget er allerede godkjent, og nøklene fra det er nøkler til samme API (ePayment). Du kan bruke dem. Det **ryddigste** er et eget salgssted for spillet: egne nøkler som kan byttes uten å røre butikken, og egne rapporter. Min anbefaling: lag et **testsalgssted** nå (det tar minutter og koster ingenting), og velg for live når du har sett hvordan det virker. Vil du ha et eget salgssted i live, må det bestilles og godkjennes (opptil ti virkedager). Er du usikker på om to løsninger kan dele et salgssted, spør Vipps.

### 3.1 Bestill betalingsløsning (live)

*Bare hvis du vil ha et eget salgssted i live.*

1. - [ ] Logg inn på portalen, velg **Order solution** i menyen, og velg løsningen med **betalingsintegrasjon via API** (*Payment Integration*, ePayment API). Fyll inn salgsstedets navn (**Disputt**), adressen `https://disputt.site`, selskapet (Pesom Holding AS) og bankkontoen for utbetaling.
2. - [ ] Vipps gjør kundekontroll (KYC og lignende) og legger produksjonsnøklene i portalen. De fleste bestillinger håndteres manuelt og kan ta **opptil ti virkedager**.

### 3.2 Testsalgssted og testnøkler

1. - [ ] I portalen: **For developers** → fanen **API keys** → velg **Test** → **Add test sales unit**. Salgsstedet dukker opp etter et par minutter. (Testsalgsstedet får samme land som selskapet ditt og kan ikke endres; lag et nytt om du trenger.)
2. - [ ] Finn salgsstedet i listen og trykk **Show keys**. Kopier disse fire verdiene til passordbehandleren din (test og live er helt adskilte nøkler):

   | Hos Vipps | Skal inn i Cloudflare som | Type |
   | --- | --- | --- |
   | **Merchant Serial Number** (MSN) | `VIPPS_MSN` | Text |
   | **client_id** | `VIPPS_CLIENT_ID` | Text |
   | **client_secret** | `VIPPS_CLIENT_SECRET` | **Secret** |
   | **Ocp-Apim-Subscription-Key** (primary; secondary er en reserve som virker likt) | `VIPPS_SUBSCRIPTION_KEY` | **Secret** |

   Er nøklene noen gang vist for noen som ikke skulle sett dem: lag nye i portalen med en gang (de gamle slutter å virke), og bytt dem i Cloudflare.

### 3.3 Testbruker og testapp

Testmiljøet har egne «kunder» og en egen app. Din vanlige Vipps virker ikke der.

1. - [ ] I portalen: **For developers** → fanen **Test users** → **Add a new test user**. Skriv ned telefonnummeret og personnummeret (NIN) testbrukeren får (begge lages automatisk). Testbrukeren har et kort som allerede er lagt inn.
2. - [ ] Installer testappen (**Merchant Test**, kalt MT-appen). **iPhone:** bli med i Apples TestFlight på <https://testflight.apple.com/join/hTAYrwea> (du trenger ingen invitasjonskode). **Android:** bli først med i Google-gruppen på <https://groups.google.com/u/0/g/vipps-mobilepay-test-app>, og installer så appen fra <https://play.google.com/store/apps/details?id=no.dnb.vipps.mt>, med samme Google-konto begge steder. Appen kan stå ved siden av vanlig Vipps. (Adressene er hentet fra Vipps' side om testmiljøet, 15. oktober 2026.)
3. - [ ] Sett opp appen: velg landet (Norge), «Over 15» hvis den spør, skriv inn testbrukerens personnummer og telefonnummer (landet må være det samme som testbrukerens, ellers feiler registreringen), bekreft telefonnummeret med koden **0000** (eller 000000), trykk *Next* (et nettleservindu åpnes og lukkes av seg selv), og lag en personlig kode: **1236**, som du skriver to ganger.
4. - [ ] **Legg inn en e-postadresse** i testappen (*Profile → Personal information → Email*). Bruk en ekte adresse du kan lese: betalingen ber om e-postadressen, og kvitteringen fra Shopify kommer dit.

### 3.4 Produksjonsnøkler

Når Vipps har godkjent salgsstedet ditt: **For developers** → velg **Production** → finn salgsstedet → **Show keys**. Samme fire verdier, men andre tall. De skal inn i den **ekte** Workeren ([del 7](#7-gå-live)), aldri i test-Workeren.

### 3.5 Portalen som feilsøking

Under **For developers** finnes også fanene **Webhooks** (hva som er registrert hos Vipps) og **Webhook errors** (hva Vipps ikke fikk levert til betalingsserveren). Se her først hvis spillet ikke finner en betaling.

## 4. Shopify-appen som får lage ordrer

Betalingsserveren må kunne lese prisene i butikken og lage en betalt ordre når Vipps har pengene. Det krever en liten app i Shopify. **Nye «custom apps» lages ikke lenger i butikkens admin:** appen lages i **Dev Dashboard**, og betalingsserveren henter selv et token (en tilgangsnøkkel som varer i 24 timer; den henter et nytt av seg selv).

> **Samme konto.** Appen og butikken må ligge i samme Shopify-organisasjon. Logg inn i Dev Dashboard med den **samme Shopify-kontoen som eier butikken**. Står ikke butikken i listen din der, svarer Shopify `shop_not_permitted` når betalingsserveren ber om tilgang, og da er det feil konto.

1. - [ ] Åpne <https://dev.shopify.com/dashboard> og logg inn.
2. - [ ] **Apps** → **Create app** → **Start from Dev Dashboard** → gi den navnet **Disputt Vipps** → **Create**.
3. - [ ] På siden **Versions** fyller du ut: *App URL* (la standardadressen stå), *Webhooks API version* (den siste stabile), og **Scopes**: `read_products,read_orders,write_orders,read_discounts`. Trykk **Release**.

   Det er alt appen får lov til: lese prisene, lete etter en ordre den selv har laget, lage ordrer, og slå opp rabattkodene dine (`read_discounts`, bare for feltet «Har du rabattkode?», se [del 5.8](#58-rabattkoder)). Ingen kundeopplysninger.
4. - [ ] Trykk **Install app** (øverst på kortet *Installs*), velg butikken, og trykk **Install**.
5. - [ ] Åpne **App settings** og kopier **Client ID** og **Client secret** til passordbehandleren:

   | I Dev Dashboard | Skal inn i Cloudflare som | Type |
   | --- | --- | --- |
   | **Client ID** | `SHOPIFY_CLIENT_ID` | Text |
   | **Client secret** | `SHOPIFY_CLIENT_SECRET` | **Secret** |

6. - [ ] **Butikkens navn hos Shopify** (`SHOPIFY_STORE`, Text): navnet foran `.myshopify.com`. Du ser det i adressen når du er i admin (`admin.shopify.com/store/xxx`: «xxx» er navnet) og under *Settings → Domains*. Skriv bare «xxx», uten `.myshopify.com`.

Mangler appen en tilgang senere (et nytt felt, en annen feilmelding om «access denied»): legg til tilgangen på en ny versjon under **Versions**, trykk **Release**, og godkjenn endringen i butikkens admin. Shopify tar ikke i bruk nye tilganger av seg selv.

## 5. Betalingsserveren

Du oppdaterer Workeren du allerede har (SHOPIFY.md del 9). **Gjør alt i test-Workeren først** (`disputt-pay-shopify-test`), og live til slutt ([del 7](#7-gå-live)).

### 5.1 Legg inn den nye koden

1. - [ ] Cloudflare → **Workers & Pages** → Workeren → **Edit code**. Marker alt (Cmd+A), slett det, åpne [`payments/worker-shopify.js`](../payments/worker-shopify.js) og lim inn **hele** filen. Trykk **Deploy**.
2. - [ ] Databasen trenger du ikke røre: de to nye tabellene (`vipps` og `settings`) lages av Workeren selv første gang den brukes. Åpne `…/health` for å få det til.
3. - [ ] Alt som virket før skal virke nå: `…/health` viser fortsatt `"ok":true`, og Shopify-betalingen fungerer som før. Knappen vises **ikke** ennå (den slås på sist).

### 5.2 Variabler og hemmeligheter

Workeren → **Settings → Variables and Secrets → Add**. *Secret*-verdier kan ikke leses igjen etter at de er lagret, så ha dem i passordbehandleren.

| Navn | Type | Verdi |
| --- | --- | --- |
| `VIPPS_MSN` | Text | Merchant Serial Number ([del 3.2](#32-testsalgssted-og-testnøkler)) |
| `VIPPS_CLIENT_ID` | Text | client_id |
| `VIPPS_CLIENT_SECRET` | **Secret** | client_secret |
| `VIPPS_SUBSCRIPTION_KEY` | **Secret** | Ocp-Apim-Subscription-Key |
| `SHOPIFY_STORE` | Text | navnet foran `.myshopify.com` ([del 4](#4-shopify-appen-som-får-lage-ordrer)) |
| `SHOPIFY_CLIENT_ID` | Text | Client ID |
| `SHOPIFY_CLIENT_SECRET` | **Secret** | Client secret |
| `ADMIN_TOKEN` | **Secret** | en lang, tilfeldig tekst som bare du kjenner (minst 16 tegn). Den åpner to kall som bare du skal bruke: å registrere Vipps-webhooken og å kjøre sjekken. Lag en i Terminal: `LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom \| head -c 40; echo`. Ta vare på den i passordbehandleren. |
| `VIPPS_ENV` | Text | `test` mens du bruker testnøklene. **Slettes** (eller settes til `live`) for live. |
| `ACCEPT_TEST_ORDERS` | Text | `true` så lenge `VIPPS_ENV` er `test` (ellers sier Workeren at Vipps ikke kan brukes: en testbetaling ville ikke gitt noen tilgang). Fjernes før live, som i SHOPIFY.md. |
| `VIPPS_ENABLED` | Text | `true` slår knappen på. **Legg den inn sist**, når sjekken i del 5.6 er grønn. Slett den (eller sett `false`) for å skru knappen av igjen. |

Trykk **Deploy** etter at du har lagt dem inn. Den siste raden avgjør om spillet viser knappen: spillet spør Workeren (`/shop`) hver gang siden lastes, og viser den bare når alt over er på plass. En side som allerede er åpen, viser den først etter at den er lastet på nytt.

### 5.3 Klokken

Klokken er en Cron Trigger som ser etter betalinger som er godkjent men ikke avsluttet.

1. - [ ] Workeren → **Settings → Triggers → Cron Triggers** → legg til uttrykket `*/5 * * * *` (hvert femte minutt, UTC).
2. - [ ] Det kan ta opptil 15 minutter før en ny Cron Trigger virker. Klokken er et sikkerhetsnett, ikke noe du venter på i testen.

### 5.4 Se at alt er på plass

Åpne `…/health`. Under `vipps` skal det stå omtrent:

```json
"vipps":{"enabled":false,"ready":false,"env":"test","set":{"VIPPS_MSN":true,"VIPPS_CLIENT_ID":true,"VIPPS_CLIENT_SECRET":true,"VIPPS_SUBSCRIPTION_KEY":true,"SHOPIFY_STORE":true,"SHOPIFY_CLIENT_ID":true,"SHOPIFY_CLIENT_SECRET":true,"ADMIN_TOKEN":true},"webhook":false,"waiting":0,"stuck":0}
```

| Du ser … | Betyr |
| --- | --- |
| `"ready":false` | `VIPPS_ENABLED` er ikke `true` ennå (riktig før du skrur på), eller en av variablene i listen mangler (se `set`), eller `VIPPS_ENV` er `test` uten at `ACCEPT_TEST_ORDERS` er `true`. `ready` er `true` først når alt er på plass **og** knappen er slått på |
| `"enabled":false` | `VIPPS_ENABLED` er ikke `true`. Det er riktig inntil alt er sjekket |
| `"webhook":false` | webhooken er ikke registrert hos Vipps ennå (neste punkt) |
| `"waiting"` | betalinger som verten holder på med akkurat nå |
| `"stuck"` | betalinger der pengene er tatt ut for mer enn fem minutter siden uten at ordren er laget. **Skal være 0.** Se [del 8](#8-drift) |

### 5.5 Registrer webhooken hos Vipps

Webhooken er det som lar Vipps si fra til betalingsserveren med en gang noe har skjedd. Du ber Workeren registrere seg selv: det gjøres én gang per Worker (test og live hver for seg), og på nytt hvis webhooken noen gang forsvinner (se [del 8](#8-drift)).

1. - [ ] Åpne **Terminal** (Cmd+mellomrom, skriv «Terminal»). Lim inn linjen under, trykk Enter, lim inn `ADMIN_TOKEN` (du ser ingenting mens du limer; det er meningen) og trykk Enter:

   ```bash
   read -rs ADMIN_TOKEN
   ```
2. - [ ] Lim så inn denne, men bytt adressen (alt etter `https://`, frem til `/vipps/…`) med adressen til **din** Worker, den du har i `DISPUTT_PAYMENTS_URL`:

   ```bash
   curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" https://disputt-pay-shopify-test.<ditt-navn>.workers.dev/vipps/admin/webhook
   ```

   **Du skal se** noe slikt: `{"ok":true,"url":"https://…/vipps/webhook","events":["epayments.payment.authorized.v1","epayments.payment.aborted.v1","epayments.payment.expired.v1","epayments.payment.terminated.v1"],"id":"…"}`. Workeren har da fått en signeringsnøkkel fra Vipps og lagret den i databasen (aldri i en variabel eller i noe du ser). Siden alle varsler fra Vipps er signert, tar Workeren ikke imot noe uten den.
3. - [ ] Åpne `…/health` igjen: `"webhook":true`.

| Svar | Betyr |
| --- | --- |
| `{"error":"unauthorized",…}` | `ADMIN_TOKEN` du limte inn er ikke den i Cloudflare. Skriv `read -rs ADMIN_TOKEN` på nytt og lim inn riktig |
| `{"error":"unavailable","message":"ADMIN_TOKEN mangler…"}` | variabelen mangler eller er for kort |
| `{"error":"vipps_auth",…}` | Vipps slapp oss ikke inn: nøklene er feil, eller de hører til live mens `VIPPS_ENV` sier `test` (eller omvendt) |
| `{"error":"vipps",…}` | Vipps avviste kallet. Detaljene står i Cloudflares logg |

### 5.6 Kjør sjekken

Sjekken prøver hver forbindelse for seg og sier hva som virker. Den viser aldri nøkler.

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" https://disputt-pay-shopify-test.<ditt-navn>.workers.dev/vipps/admin/check
```

**Du skal se** (omtrent): `{"ok":true,"env":"test","enabled":false,"problem":null,"vipps":true,"webhook":true,"shopify":true,"prices":{"evening":149,"weekend":199,"year":299}}`. Alt skal være `true`, og prisene skal være dem du har satt i Shopify.

| Du ser … | Betyr |
| --- | --- |
| `"problem":"Vipps er ikke satt opp ennå (… mangler)."` | variablene som står i parentesen mangler |
| `"vipps":false` og `vippsError` | nøklene til Vipps stemmer ikke (feil MSN, client_secret eller subscription key), eller de er test mens miljøet sier live |
| `"webhook":false` | webhooken er ikke registrert (del 5.5), eller den er slettet hos Vipps |
| `"shopify":false` og `shopifyError` | Shopify slapp oss ikke inn. `shop_not_permitted`: appen og butikken er ikke i samme organisasjon ([del 4](#4-shopify-appen-som-får-lage-ordrer)). `invalid_client`: feil Client ID eller Client secret. Manglende tilgang: legg den til på en ny versjon |
| `"discounts":false` og `discountsError` | appen mangler tilgangen `read_discounts` (legg den til på en ny versjon, trykk Release og godkjenn i butikkens admin). Resten virker; det er bare feltet for rabattkoder som svarer med en feil |
| `"prices":null` | Shopify svarer, men finner ikke en av pakkene (feil `VARIANT_…`), eller butikken selger ikke i NOK |

Når alt er grønt: legg inn **`VIPPS_ENABLED` = `true`** og trykk Deploy. Last test-kopien på nytt: pakkeskjermen viser nå den oransje knappen.

### 5.7 Test-kopien av siden

Siden trenger ingen nye variabler på GitHub: den spør Workeren om knappen skal vises. Men siden må få **den nye koden** (knappen, «Velkommen!»-siden). Be meg legge koden inn i test-kopien, så bygges den på nytt av seg selv.

### 5.8 Rabattkoder

Under pakkene står en linje **Har du rabattkode?** som åpner et felt. Koden er en vanlig rabattkode som du lager i Shopify (*Discounts*), og den virker begge veier: i butikkens kasse (koden følger med handlekurvlenken, og Shopify regner den ut) og med **Betal med Vipps** (betalingsserveren slår opp koden i butikken, regner ut prisen og ber Vipps om det beløpet). Pakkekortene viser den gamle prisen strøket over og den nye under.

**Slik gjør du det:**

1. [ ] **Tilgangen:** Dev Dashboard → appen → **Versions** → ny versjon med `read_discounts` lagt til i Scopes → **Release**. Godkjenn så endringen i butikkens admin (Shopify spør, og tar ikke i bruk nye tilganger av seg selv). Sjekken i [del 5.6](#56-kjør-sjekken) viser da `"discounts":true`.
2. [ ] **Lag koden i Shopify:** *Discounts → Create discount → Amount off products* (eller *Amount off order*), metode **Discount code**, skriv koden, velg prosent eller beløp, og velg pakkene den gjelder (eller alle).

**Det Vipps forstår:**

| Gjør | Gjør ikke |
| --- | --- |
| prosent eller beløp av, på alle produkter eller utvalgte produkter | koder av andre typer (kjøp X få Y, gratis frakt, utvalgte samlinger): feltet sier at de må skrives inn i butikkens kasse |
| *Customer eligibility*: **All customers** | koder for utvalgte kunder eller «én gang per kunde»: prisen vises, men Vipps-knappen er av, og kassen i butikken tar koden |
| *Limit number of times this discount can be used in total* (brukt i butikken og med Vipps telles sammen) | en pris på 0 kr eller under 1 kr: Vipps tar ikke imot det. Gratiskoder (100 %) bruker butikkens kasse. **Ikke prøvd** med en ekte gratisordre i Shopify |

**Hva du ser:** en Vipps-ordre med rabattkode har den **nedsatte prisen** på varelinjen (ikke en egen rabattlinje), attributtene `rabattkode` og `ordinaer_pris` (prisen uten kode), og taggen `rabatt`. Shopify teller ikke bruken av en kode som er brukt med Vipps, så en grense på antall bruk telles i betalingsserveren (og trekkes fra det Shopify har talt). Rabattkodene går gjennom `/discount`, som stopper på 600 spørsmål i timen.

## 6. Test alt

Test i test-kopien, med testsalgsstedet, testappen og `ACCEPT_TEST_ORDERS` = `true`. Testbestillinger er merket som tester i Shopify og telles bare mens den variabelen er `true`.

| # | Test | Du skal se |
| --- | --- | --- |
| 1 | Start et spill med to eller tre telefoner, spill to runder, trykk **Neste runde** | pakkene, og **Betal med Vipps** (oransje) over **Betal med kort**. Begge er grå til boksen er krysset av. De andre telefonene sier bare «Venter på at verten starter neste runde». |
| 2 | Kryss av og trykk **Betal med Vipps** | en ny fane åpner seg hos Vipps (testmiljøet), med riktig beløp. Spillet står bak og sier «Venter på betalingen …». |
| 3 | Åpne testappen og godkjenn (kode 1236), del e-postadressen når den spør | Vipps sender deg tilbake til «Velkommen!»-siden. I spillet: **Velkommen!** med kode og pakke, innen noen sekunder. Vipps-fanen lukker seg. |
| 4 | I Shopify admin, åpne ordren | merket som test, **betalt**, kilde «Vipps», taggene `vipps` og `disputt-…`, betalingsmåte «Vipps», riktig pris med mva, og under *Additional details* `kode`, `samtykke`, `betaling` og `vipps_referanse` |
| 5 | Sjekk e-posten du la inn i testappen | ordrebekreftelsen i Disputts stil, med koden og teksten om angreretten |
| 6 | Trykk **Betal med Vipps**, men avbryt i testappen | «Velkommen!»-siden sier «Betalingen ble ikke gjennomført. Ingen penger er trukket.» Det blir ingen ordre. Trykk **Avbryt** i spillet og prøv igjen. |
| 7 | Trykk **Betal med Vipps**, og lukk Vipps-fanen uten å betale | spillet venter fortsatt. **Åpne betalingen igjen** åpner den samme betalingen hos Vipps. **Avbryt** tar deg tilbake, og boksen må krysses av på nytt. |
| 8 | Godkjenn, og gjør ingenting mer (lukk alt) | etter høyst fem minutter har klokken funnet betalingen: ordren står i Shopify, og koden virker under «Logg inn» (under pakkene) på en ny telefon (**Merk:** klokken kan bruke opptil 15 minutter på å starte første gang, del 5.3) |
| 9 | Ny telefon (eller privat fane): spill tre runder, trykk **Logg inn** under pakkene, skriv koden | «Velkommen tilbake!» |
| 10 | Refunder testordren i Shopify (*Orders → ordren → Refund*) | koden slutter å virke: «Logg inn» sier at betalingen er refundert. Shopify kan ikke sende pengene tilbake via Vipps (betalingen er ikke gjort hos Shopify), så velg at refusjonen skal gjøres manuelt. **Ikke prøvd:** går det ikke å refundere ordren, stopp koden for hånd ([del 8](#8-drift)). |
| 11 | Bruk en nettleser som ikke åpner nye faner (eller slå av popup-tillatelsen) | fanen du står i går til Vipps. Etter betalingen kommer du til «Velkommen!»-siden, og lenken **Tilbake til spillet** åpner spillet, som finner betalingen selv. |
| 12 | Sjekk `…/health` | `waiting` og `stuck` er 0 |
| 13 | Åpne portalen: **For developers → Webhooks** (og **Webhook errors**) | webhooken for Workeren er der, og det står ingen feil |
| 14 | Lag en rabattkode i Shopify (20 %), skriv den under pakkene og betal med Vipps | kortene viser gammel og ny pris, Vipps viser det nye beløpet, ordren har den nedsatte prisen og attributtene `rabattkode` og `ordinaer_pris`. Prøv også en kode som ikke finnes (feltet sier det), og i butikkens kasse (koden står i kassen). |

**Refusjon i Vipps testes ikke her.** Testmiljøet har ikke portalen, så pengene kan ikke refunderes derfra. Det prøves første gang i live, med ett lite kjøp ([del 7](#7-gå-live)).

**Automatiske tester.** Disse trenger ingen konto og gjør det samme mot etterlikningene:

```bash
npm test                  # alle tester, også betalingsserveren og siden mot Vipps
npm run play:pay-vipps    # hele kvelden i en ekte nettleser: knappen, en falsk Vipps, «Velkommen!»-siden og ordren i en falsk butikk
npm run qa:fit            # pakkene må vises uten å rulle på 390×664 og de andre størrelsene, også med Vipps-knappen
npm run qa:overlap        # ingen tekst oppå annen tekst, heller ikke på betalingsskjermene
```

## 7. Gå live

1. - [ ] **Vipps har godkjent salgsstedet** (eller du har bestemt deg for å bruke salgsstedet fra butikken) og du har produksjonsnøklene ([del 3.4](#34-produksjonsnøkler)).
2. - [ ] I den **ekte** Workeren (`disputt-pay-shopify`): legg inn de samme variablene som i test ([del 5.2](#52-variabler-og-hemmeligheter)), men med **produksjonsnøkler fra Vipps**, **uten** `VIPPS_ENV` (eller `live`) og **uten** `ACCEPT_TEST_ORDERS`. Shopify-verdiene er de samme som i test: det er samme butikk og samme app. Lim inn den nye koden ([del 5.1](#51-legg-inn-den-nye-koden)) og legg inn klokken ([del 5.3](#53-klokken)).
3. - [ ] **Registrer webhooken for den ekte Workeren** ([del 5.5](#55-registrer-webhooken-hos-vipps)), med den ekte Worker-adressen, og kjør sjekken ([del 5.6](#56-kjør-sjekken)). Skal vise `"env":"live"` og alt `true`.
4. - [ ] **Vipps vil se at løpet fungerer i produksjon.** Vipps' egen liste for direkte integrasjoner sier: kjør en komplett ordre i produksjon som ender i **AUTHORIZED, CAPTURED, REFUNDED og CANCELLED**, og sjekk helst det via API-et. Slik gjør du det med Disputt: kjøp «En kveld» (89 kr) med din egen Vipps (da er betalingen **AUTHORIZED** og **CAPTURED**: betalingsserveren tar ut pengene med en gang), og refunder den (**REFUNDED**, [del 8](#8-drift)). Disputt kansellerer nesten aldri selv: en godkjent betaling tas alltid ut med en gang. Den eneste kanselleringen er om beløpet hos Vipps ikke er det Disputt ba om (da tas ingenting ut, og beløpet som er reservert slippes), og det skal ikke skje. Skulle Vipps kreve å se en kansellering også (**CANCELLED**), si fra til meg, så finner vi en måte å lage den på. Ellers er kravene: Vipps' merkevare skal brukes etter designreglene deres (**se del 10: knappen vår er tegnet i spillets stil, så spør Vipps om den godtas**), håndter betalinger som avbrytes eller går ut (det gjør vi), og abonner på **Vipps MobilePay Operational Status Page** (lenke under [kilder](#11-kilder)).
5. - [ ] **Sett `VIPPS_ENABLED` = `true`** i den ekte Workeren. Spillet viser knappen neste gang siden lastes.
6. - [ ] **Ett lite, ekte kjøp** med din egen Vipps: «En kveld» på 149 kr. Sjekk at «Velkommen!» og e-posten kommer, og at ordren står i Shopify med riktig pris og mva. Refunder så kjøpet i Vipps-portalen og i Shopify ([del 8](#8-drift)), og sjekk at «Logg inn» med koden nå sier at betalingen er refundert.
7. - [ ] **Skru av igjen når som helst:** slett `VIPPS_ENABLED` (eller sett den til `false`). Knappen forsvinner neste gang siden lastes. Betalinger som allerede er i gang blir ferdige likevel, og klokken fortsetter.

## 8. Drift

- **Ordrene** står i Shopify admin (*Orders*), som før. Vipps-ordrene har kilden «Vipps», taggene `vipps` og `disputt-…` (referansen hos Vipps), og koden og samtykket under *Additional details*. Kunden har mistet koden? Finn ordren på e-postadressen og send koden.
- **Databasen** (Cloudflare → *Storage & databases → D1 → databasen → Console*). Betalingene via Vipps:

  ```sql
  SELECT reference, plan, amount / 100.0 AS kr, state, note, datetime(created_at, 'unixepoch') AS startet, order_id, test FROM vipps ORDER BY created_at DESC LIMIT 20;
  ```

  `state` er `started` (verten holder på, eller har ikke betalt), `captured` (pengene er tatt ut, ordren er ikke laget ennå), `done` (alt er gjort) eller `failed` (aldri godkjent, avvist, utløpt eller beløpet stemte ikke; `note` sier hvilket). **Ingen navn og ingen e-postadresser** står der. `orders`-tabellen er som før (SHOPIFY.md del 14).
- **Pengene er tatt ut, men det er ingen ordre** (`stuck` i `/health` er over 0, eller en rad står som `captured` i mer enn fem minutter). Betalingsserveren prøver igjen hvert femte minutt i syv dager, så ofte går det over av seg selv (Shopify var nede et øyeblikk). Står den fast, sier `note` hvorfor: en tilgang som mangler i Shopify-appen ([del 4](#4-shopify-appen-som-får-lage-ordrer)), en pakke som ikke finnes (`VARIANT_…`), eller en feil i butikken. Rett årsaken, så tar neste runde fra klokken resten. Får du det ikke til: refunder kunden hos Vipps (under), og lag ordren for hånd i Shopify hvis kunden skal beholde tilgangen.
- **Refusjon.** To steg, i denne rekkefølgen:
  1. **Hos Vipps:** logg inn i portalen, finn betalingen (*Transactions*; referansen står i taggene på ordren i Shopify) og refunder den. **Ikke prøvd:** jeg har ikke kunnet bekrefte hvor knappen står i portalen, og Vipps skriver selv at portalen ikke er laget for kundeservice. Finner du den ikke, spør Vipps' kundeservice, eller si fra til meg, så lager jeg et lite kall i betalingsserveren som gjør det (det ville flytte penger, så det gjør jeg ikke uten at du ber om det). Pengene trekkes fra utbetalingen din etter to virkedager.
  2. **I Shopify:** *Orders → ordren → Refund*, manuelt (Shopify har ikke selve betalingen). Da sier Shopify fra til betalingsserveren, og **koden slutter å virke** på nye telefoner (en tilgang som allerede ligger på en telefon varer til den går ut, som i SHOPIFY.md del 16). Går det ikke: `UPDATE orders SET state = 'refunded' WHERE code = '<koden>';` i konsollen gjør det samme.
- **Webhooken.** Vipps prøver et varsel igjen når Workeren svarer med en feil eller ikke svarer innen ti sekunder, med stadig lengre pauser i opptil sju dager (Vipps kan endre tidene). **Vipps sletter webhooken** hvis ingen varsler har kommet fram på to uker. Er Workeren nede lenge, så **se under *For developers → Webhooks*** at den fortsatt er registrert. Er den borte: kjør registreringen på nytt ([del 5.5](#55-registrer-webhooken-hos-vipps)). Mens den mangler, virker alt likevel (siden spør, og klokken ser etter), bare ikke like raskt.
- **Bytte nøkler hos Vipps** (hvis de har kommet på avveie): lag nye i portalen (*Show keys*), bytt `VIPPS_CLIENT_SECRET` og `VIPPS_SUBSCRIPTION_KEY` i Cloudflare, og trykk Deploy.
- **Bytte `ADMIN_TOKEN`:** lag en ny, bytt den i Cloudflare, og bruk den i Terminal ([del 5.5](#55-registrer-webhooken-hos-vipps)).
- **Statusside.** Abonner på Vipps MobilePays statusside ([kilder](#11-kilder)), så du får vite om Vipps har problemer.
- **Cloudflare-kvoten.** Klokken er 288 kjøringer i døgnet, og hver ser bare på betalinger som ikke er ferdige: ubetydelig mot gratisplanen.
- **Skru av alt** (også etter at noen har betalt): slett `VIPPS_ENABLED`. Alt som er betalt står i Shopify, og kodene virker som før.

## 9. Slik henger koden sammen

| Fil | Hva |
| --- | --- |
| [`payments/worker-shopify.js`](../payments/worker-shopify.js) | Betalingsserveren. Delen «Vipps: the button «Betal med Vipps»» har alt som er nytt: kallene til Vipps og Shopify, å bli ferdig med en betaling (`settle`), webhooken, klokken (`scheduled`) og de to admin-kallene. |
| [`public/js/pay/vipps.js`](../public/js/pay/vipps.js) | Siden: åpner en fane i selve trykket, ber betalingsserveren lage betalingen, sender fanen til Vipps, og lukker den når betalingen er funnet. |
| [`public/js/screens/discount.js`](../public/js/screens/discount.js), [`public/js/pay/discount.js`](../public/js/pay/discount.js) | Feltet «Har du rabattkode?» og kallet til `/discount`. Koden og prisene ligger i `store.discount`, som kortene og betalingen leser. |
| [`public/js/screens/shoppay.js`](../public/js/screens/shoppay.js), `public/css/components.css` (`.btn--vipps`) | Bunnlinjen på pakkeskjermen: avkrysning, **Betal med Vipps** (en vanlig knapp i spillets stil, i Vipps' oransje `#ff5b24`) og **Betal med kort** |
| [`public/takk.html`](../public/takk.html), [`public/js/takk.js`](../public/js/takk.js) | Siden Vipps sender verten tilbake til. Den kjenner bare referansen, spør betalingsserveren og sier «Velkommen!», «Betalingen ble ikke gjennomført» eller «Vi venter fortsatt på Vipps». Den vet om fanen er åpnet av spillet (da kan den lukkes derfra), er spillets egen (da er lenken tilbake veien videre), eller er en annen fane (da sier den at verten skal bytte tilbake til spillet). |
| `tools/qa/fakevipps.mjs`, `fakeshopifyadmin.mjs`, `shop-stack.mjs`, `vippsflow.mjs` | falsk Vipps (med en side der «kunden» godkjenner eller avviser), falsk Shopify Admin (like streng som dokumentasjonen om feltene), hele kjeden, og kjøringen i nettleseren |
| `test/worker-vipps.test.js`, `test/vipps-flow.test.js` | betalingsserveren mot de falske tjenestene (63 tester), og siden (15 tester) |

### Betalingsserverens nye kall

| Kall | Gjør | Svar |
| --- | --- | --- |
| `GET /shop` | har også `vipps` (skal knappen vises?) og `discounts` (skal feltet for rabattkode vises?) | `{ shop, variants, vipps, discounts }` |
| `POST /discount` `{ code }` | er det en rabattkode i butikken, og hva koster pakkene med den? | `{ ok, code, summary, plans: { evening: { price, now, vipps }, … } }` (øre), eller `400` med en tekst til verten (ukjent, ikke gyldig, brukt opp, gjelder ikke pakkene, typen støttes ikke), `429`, `503` (rabattkoder er ikke satt opp) |
| `POST /vipps/start` `{ plan, code, samtykke, rabatt? }` | skriver ned betalingen, lager den hos Vipps, sier hvor verten skal sendes | `{ url, reference }`; `400` (ukjent pakke, ugyldig kode, mangler samtykke), `429` (over 200 starter i timen), `503` (ikke satt opp), `502` (Vipps eller butikken svarte feil) |
| `POST /vipps/status` `{ reference }` | «Velkommen!»-siden spør: er det ferdig? Ser på betalingen hos Vipps på veien. | `{ state: "started" \| "done" \| "failed" }` |
| `POST /vipps/webhook` | Vipps sier at en betaling er godkjent, avbrutt eller gått ut. Signert (HMAC-SHA256 over datoen, adressen og kroppen). | `{ ok: true }`, `401` for feil signatur, `503` hvis betalingen ikke er ferdig ennå (da ringer Vipps på nytt) |
| `POST /vipps/admin/webhook` | registrerer webhooken hos Vipps (krever `ADMIN_TOKEN`) | `{ ok, url, events, id }` |
| `GET /vipps/admin/check` | prøver hver forbindelse (krever `ADMIN_TOKEN`) | se [del 5.6](#56-kjør-sjekken) |
| `POST /restore` | som før, men ser først etter en Vipps-betaling for koden som ikke er ferdig | som før |
| `GET /health` | har også `vipps`-blokken | se [del 5.4](#54-se-at-alt-er-på-plass) |

### Databasen

| Tabell | Innhold |
| --- | --- |
| `vipps` | én rad per betaling: `reference` (`disputt-` og 24 tegn; ingenting som kan knyttes til en person), `code`, `plan`, `amount` (øre), `consented_at`, `created_at`, `state`, `order_id`, `test`, `note`, `discount_code` og `list_amount` (prisen uten kode, i øre; bare for betalinger med rabattkode) og to felt for låsing. **Ingen navn og ingen e-postadresser.** |
| `settings` | `vipps_webhook_secret`: signeringsnøkkelen Vipps ga da webhooken ble registrert |
| `orders` | som før. En Vipps-betaling skrives hit når ordren er laget, og er fra da av en ordre som alle andre. |

### Hvordan en betaling går, i detalj

1. Siden kaller `/vipps/start` med pakken, koden og tidspunktet for samtykket. Betalingsserveren sjekker dem, ber Shopify om prisen, **skriver betalingen ned** og ber Vipps lage den (med `userFlow: WEB_REDIRECT`, `returnUrl` til `takk.html?ref=…` og `profile.scope: email`). Å skrive ned først er med vilje: en betaling som Vipps kjenner og vi ikke gjør, kunne blitt betalt uten at noen leverte noe.
2. Verten sendes til adressen Vipps ga.
3. `settle` (fra webhooken, fra siden eller fra klokken): ta lås, spør Vipps om betalingen. **Avvist, avbrutt eller utgått** gir `failed`. **Ikke godkjent ennå** blir stående (og gis opp etter et døgn). **Godkjent:** sjekk at beløpet er det vi ba om, **ta ut pengene** (capture, med en nøkkel som gjør at et kall som gjøres to ganger teller en gang), sjekk i svaret at beløpet er tatt ut, og sett `captured`.
4. Finn eller lag **ordren i Shopify** (søk på taggen først; `orderCreate` med `financialStatus: PAID`, mva 25 % i prisen, attributtene `kode`, `samtykke`, `betaling` og `vipps_referanse`, betalingsmåten Vipps og kvittering til e-postadressen fra Vipps). Etter et kall til Shopify som ikke fikk svar, venter den to minutter før den prøver igjen (ordren kan ha blitt laget likevel).
5. Skriv ordren ned i `orders` (`ON CONFLICT DO NOTHING`: Shopifys eget varsel «orders/paid» for den samme ordren kan komme først, og er også greit) og sett `done`.
6. Siden spør `/restore` med koden, og får tilgangen på vanlig måte.

### Å huske når koden endres

Sidene i spillet blir liggende i nettleserens hurtigminne i ca. ti minutter, så ny logikk legges i **nye filer**, og en ny fil bruker bare det de gamle filene allerede eksporterer. Det er derfor Vipps-koden ligger i egne filer (`vipps.js`, `takk.js`) og ikke inni `shop.js` og `pay.js`. Finner en gammel kopi av `shop.js` ikke `vipps`-feltet, blir knappen bare skjult.

## 10. Begrensninger og mulige neste steg

- **Refusjon er manuell, i to steg** ([del 8](#8-drift)). Et kall i betalingsserveren som refunderer hos Vipps og stopper koden i ett grep er enkelt å lage, men flytter penger, så det er ikke bygget uten at du ber om det.
- **Ikke prøvd mot ekte Vipps og ekte Shopify.** Alt er prøvd mot etterlikninger bygget etter dokumentasjonen. Første testkjøp kan avsløre en liten forskjell (se [Kort fortalt](#kort-fortalt)).
- **Appflyten på telefon er ny og ikke prøvd mot ekte Vipps** (se «Færre faner på telefon» i del 1). Virker den ikke, må vi tilbake til fanen med Vipps for telefoner også.
- **Vipps åpner siden verten kommer tilbake til i telefonens standardnettleser.** Er det en ny fane som Vipps-appen åpnet, eller en annen nettleser enn den spillet står i, har den ingen forbindelse til spillet og lukkes ikke av det. «Velkommen!»-siden ber da verten bytte tilbake til fanen med spillet, og har en lenke til spillet bare som siste utvei (den åpner spillet en gang til, uten rommet). Spillet finner betalingen når verten kommer tilbake til det.
- **Knappen er vår egen, ikke Vipps' offisielle.** Den er tegnet i spillets stil, i Vipps' oransje (`#ff5b24`), med hvit tekst «Betal med Vipps», men uten Vipps' logo. Vipps' sjekkliste sier at merkevaren skal følge designreglene deres, og reglene står i en portal jeg ikke kunne lese herfra, så jeg vet ikke om Vipps godtar den. Spør Vipps før live (send gjerne et skjermbilde). Vil de ha den offisielle knappen, bytter jeg tilbake: den er en web component som hentes fra `cdn.vippsmobilepay.com` (og må slippes gjennom sikkerhetsreglene i bygget), og den vil da stå i personvernerklæringen at Vipps ser IP-adressen når pakkene vises. Så lenge knappen er vår egen, hentes ingenting fra Vipps før kunden trykker.
- **Kunden må dele e-postadressen i Vipps.** Vipps skriver at betalingen feiler hvis kunden ikke godkjenner delingen. Det er med vilje (kvitteringen og koden i e-posten trengs), men noen vil avbryte der.
- **Et kjøp betalt hos Vipps på en annen telefon enn den spillet står på** virker like godt: koden hører til betalingen, ikke til telefonen.
- **Bare NOK**, og bare ordinære Vipps- og MobilePay-brukere (wallet). Ingen kortbetaling hos Vipps.
- **Vipps' hurtigbetaling («Express»)** er ikke i bruk: den er laget for varer som sendes og trengs ikke her.
- **Webhook-nøkkelen ligger i databasen**, ikke som en hemmelighet i Cloudflare. Den brukes bare til å sjekke signaturen på varsler fra Vipps. Skal den byttes: kjør registreringen på nytt (del 5.5).
- **Alle kan banke på Workeren** (`/vipps/start` kan kalles med `curl`): den lager bare betalinger som ingen betaler, og stopper på 200 starter i timen. Gjør noen det med vilje, kan knappen svare «Mange betaler akkurat nå» resten av timen, og kundene har «Betal med kort» så lenge. Klokken ser på ti ufullførte betalinger om gangen (de der pengene alt er tatt ut først), så mange halvferdige gjør den tregere; webhooken og siden gjør jobben først, så en ekte betaling blir likevel ferdig. De to admin-kallene krever `ADMIN_TOKEN`.
- **Gratisrunder, koden som kan deles, myk betalingsmur:** som i [SHOPIFY.md, del 16](SHOPIFY.md#16-begrensninger-og-mulige-neste-steg).
- **Mulige neste steg:** et refusjonskall; å kreve at Vipps-betalinger også kan kanselleres fra spillet; å vise kunden «Betalingen ble ikke gjennomført» i selve spillet (nå står det bare på «Velkommen!»-siden); en egen side for en kunde som lukket alt.

## 11. Kilder

- Vipps MobilePay: [Kom i gang](https://developer.vippsmobilepay.com/docs/getting-started/) · [API-nøkler](https://developer.vippsmobilepay.com/docs/knowledge-base/api-keys/) · [Testmiljøet](https://developer.vippsmobilepay.com/docs/knowledge-base/test-environment/) (testbruker, testapp, PIN-koder) · [Portalen](https://developer.vippsmobilepay.com/docs/knowledge-base/portal/) · [Sjekklisten for ePayment](https://developer.vippsmobilepay.com/docs/APIs/epayment-api/checklist/) · [Å dele profil (e-postadressen)](https://developer.vippsmobilepay.com/docs/APIs/epayment-api/api-guide/features/profile-sharing/) · [Vipps' egen knapp (web component), hvis du vil bytte](https://developer.vippsmobilepay.com/docs/knowledge-base/buttons/) · [Webhooks API](https://developer.vippsmobilepay.com/docs/APIs/webhooks-api/) · [Vipps for Shopify](https://developer.vippsmobilepay.com/docs/plugins/shopify/)
- Shopify: [Dev Dashboard: lag en app](https://shopify.dev/docs/apps/build/dev-dashboard/create-apps-using-dev-dashboard) · [Token med «client credentials grant»](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant) · [`orderCreate`](https://shopify.dev/docs/api/admin-graphql/latest/mutations/orderCreate)
- Cloudflare: [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) · [Workers: priser og grenser](https://developers.cloudflare.com/workers/platform/pricing/)
- Statusside for Vipps MobilePay: finn den fra [developer.vippsmobilepay.com](https://developer.vippsmobilepay.com/) (sjekklisten ber om at du abonnerer).
