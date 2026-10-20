# Betal med Vipps: rett i produksjon (uten testrunde)

Kortversjonen av [VIPPS.md](VIPPS.md) for deg som setter det opp direkte i live. Alt skjer i den **ekte** betalingsserveren (i Cloudflare heter den `disputt-pay-shopify-test`, men det er den ekte: `disputt.site` bruker den, og `/health` sier `"mode":"live"`. Rør ikke Workeren `disputt` i listen, den har ikke med betalingen å gjøre). Knappen vises ikke for noen før siste steg, så du kan gjøre steg 1 til 4 uten at spillet endrer seg.

**Hva du hopper over, og hva det koster:** testmiljøet hos Vipps. Det første ekte kjøpet er derfor testen. Gjør det selv, med «En kveld» (149 kr), og refunder det. Går noe galt, skru knappen av (slett `VIPPS_ENABLED`) og send meg svaret fra `…/health` og sjekken.

## Steg 1: Vipps-nøkler (live)

1. [ ] https://portal.vippsmobilepay.com → **For developers** → velg **Production**.
2. [ ] Finn salgsstedet butikken allerede bruker (Vipps-tillegget i Shopify) og trykk **Show keys**. Det er nøkler til samme API, og salgsstedet er allerede godkjent, så ingen ventetid.
3. [ ] Kopier til passordbehandleren: Merchant Serial Number (MSN), client_id, client_secret, Ocp-Apim-Subscription-Key (primary). **Ikke send dem til meg.**

## Steg 2: Appen i Shopify

1. [ ] https://dev.shopify.com/dashboard, logg inn med kontoen som eier butikken (samme organisasjon som butikken, ellers `shop_not_permitted`).
2. [ ] **Apps** → **Create app** → **Start from Dev Dashboard** → navn «Disputt Vipps» → **Create**.
3. [ ] **Versions**: la App URL stå, velg siste Webhooks API version, og **Scopes**: `read_products,read_orders,write_orders` → **Release**.
4. [ ] **Install app** (kortet *Installs*) → velg butikken → **Install**.
5. [ ] **App settings**: kopier **Client ID** og **Client secret** til passordbehandleren.
6. [ ] Butikkens navn hos Shopify: «xxx» i `xxx.myshopify.com` (står i adressen `admin.shopify.com/store/xxx`).

## Steg 3: Den ekte betalingsserveren (Cloudflare)

1. [ ] Workers & Pages → `disputt-pay-shopify-test` → **Edit code** → Cmd+A, slett, lim inn hele [payments/worker-shopify.js](../payments/worker-shopify.js) → **Deploy**. (Alt som virket før virker som før.)
2. [ ] **Settings → Variables and Secrets → Add**:

   | Navn | Type | Verdi |
   | --- | --- | --- |
   | `VIPPS_MSN` | Text | Merchant Serial Number |
   | `VIPPS_CLIENT_ID` | Text | client_id |
   | `VIPPS_CLIENT_SECRET` | **Secret** | client_secret |
   | `VIPPS_SUBSCRIPTION_KEY` | **Secret** | Ocp-Apim-Subscription-Key |
   | `SHOPIFY_STORE` | Text | «xxx» fra steg 2 |
   | `SHOPIFY_CLIENT_ID` | Text | Client ID |
   | `SHOPIFY_CLIENT_SECRET` | **Secret** | Client secret |
   | `ADMIN_TOKEN` | **Secret** | lang tilfeldig tekst (Terminal: `LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom \| head -c 40; echo`) |

   **Ikke** legg inn `VIPPS_ENV`, `ACCEPT_TEST_ORDERS` eller `VIPPS_ENABLED`. Trykk **Deploy**.
3. [ ] **Settings → Triggers → Cron Triggers**: legg til `*/5 * * * *`.
4. [ ] Åpne `…/health`: under `vipps` skal det stå `"enabled":false,"env":"live"`, og alle åtte under `set` skal være `true`. (`"ready"` blir først `true` når `VIPPS_ENABLED` er satt i steg 6, så `false` nå er riktig.)

## Steg 4: Webhook og sjekk (Terminal)

1. [ ] Skriv `read -rs ADMIN_TOKEN`, Enter, lim inn ADMIN_TOKEN (du ser ingenting), Enter.
2. [ ] Registrer webhooken (adressen er den ekte Workerens):

   ```bash
   curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" https://disputt-pay-shopify-test.kontakt-276.workers.dev/vipps/admin/webhook
   ```
3. [ ] Kjør sjekken:

   ```bash
   curl -s -H "Authorization: Bearer $ADMIN_TOKEN" https://disputt-pay-shopify-test.kontakt-276.workers.dev/vipps/admin/check
   ```

   Skal vise `"ok":true,"env":"live"`, `vipps`, `webhook` og `shopify` alle `true`, og prisene 149, 199 og 299. Ellers: se feiltabellen i VIPPS.md del 5.5 og 5.6.

## Steg 5: Koden ut på disputt.site

Si fra til meg når steg 1 til 4 er gjort. Da committer og pusher jeg til main (GitHub bygger siden på nytt, ca. 2 til 3 minutter). Dette går også live: den nye knappen (skjult), «Velkommen!»-siden og de omskrevne vilkårene og personvernerklæringen (få juristen til å lese dem).

## Steg 6: Skru på

1. [ ] Legg inn `VIPPS_ENABLED` = `true` i Cloudflare → **Deploy**.
2. [ ] Last disputt.site på nytt og gå til pakkeskjermen: den oransje knappen står over «Betal med kort».

## Steg 7: Første ekte kjøp, og refusjon

1. [ ] Spill to runder, kryss av, trykk **Betal med Vipps**, velg «En kveld» (149 kr), godkjenn i din egen Vipps og del e-postadressen.
2. [ ] Du skal få «Velkommen!» i spillet, e-posten med koden, og i Shopify en **betalt** ordre (ikke test) med kilde «Vipps» og taggene `vipps` og `disputt-…`.
3. [ ] `…/health`: `waiting` og `stuck` skal være 0.
4. [ ] Refunder: i Vipps-portalen (*Transactions*, finn betalingen) og i Shopify (*Orders → ordren → Refund*, manuelt). Sjekk at «Logg inn» med koden nå sier at betalingen er refundert.

**Skru av når som helst:** slett `VIPPS_ENABLED`. Betalinger i gang blir ferdige likevel.

**Vipps' merkevareregler:** knappen er vår egen tegnede, uten Vipps' logo. Spør Vipps om den godtas (se VIPPS.md del 10).

## Etterpå: rabattkoder (ny funksjon)

Under pakkene kommer en linje **Har du rabattkode?**. Koden lager du i Shopify (*Discounts*), og den virker både i butikkens kasse og med Vipps. For at den skal virke må du gjøre to ting i tillegg:

1. [ ] **Ny tilgang i Shopify-appen:** Dev Dashboard → appen «Disputt Vipps» → **Versions** → ny versjon, med `read_discounts` lagt til i Scopes (komma, uten mellomrom: `read_products,read_orders,write_orders,read_discounts`) → **Release**. Åpne så butikkens admin og godkjenn oppdateringen av appen.
2. [ ] **Lim inn den nye betalingsserveren** (ny `payments/worker-shopify.js`): Cloudflare → `disputt-pay-shopify-test` → **Edit code** → Cmd+A, slett, lim inn → **Deploy**. Variablene og webhooken står som de er.
3. [ ] **Sjekk:** dobbeltklikk Registrer-Vipps-webhook-filen igjen (jeg lager den på nytt hvis du ber om det). Sjekken skal nå også vise `"discounts":true`.

Hvilke typer koder som virker med Vipps står i [VIPPS.md, del 5.8](VIPPS.md#58-rabattkoder).

## Etterpå: færre faner på telefon

En telefon åpner nå Vipps-appen rett fra spillfanen, uten en egen Vipps-fane. Den eneste nye fanen er siden telefonen åpner når Vipps sender deg tilbake. Det er ingen bryter: det gjelder for alle telefoner.

1. [ ] Lim inn den nye `payments/worker-shopify.js` i Cloudflare (`disputt-pay-shopify-test` → **Edit code** → Cmd+A, slett, lim inn → **Deploy**). Uten den nye koden i Cloudflare bruker spillet den gamle veien med en egen Vipps-fane, så ingenting går i stykker i mellomtiden.
2. [ ] **Prøv på telefonen din** (last siden på nytt først): **Betal med Vipps** → Vipps-appen åpner seg → godkjenn → du kommer til en side som sier «Velkommen!» → bytt tilbake til spillfanen, som viser «Velkommen!» med koden. Refunder kjøpet.
