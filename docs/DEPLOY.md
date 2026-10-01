# Drift: å få Disputt ut til telefonene

Disputt er **én Node-prosess** som serverer nettsiden *og* spillets WebSocket på samme port. Spillrommene ligger i minnet. Det gir to regler:

1. **Kjør nøyaktig én instans.** Flere instanser deler ikke rom, og spillere ville havnet i hver sin verden.
2. En omstart avslutter pågående spill. Spillerne sendes til forsiden med beskjed om at spillet er borte.

| Miljøvariabel | Standard | Betydning |
| --- | --- | --- |
| `PORT` | `3000` | Port å lytte på. Render, Fly og de fleste plattformer setter denne selv. |
| `HOST` | `0.0.0.0` | Hvilket nettverkskort. `0.0.0.0` lar telefoner på samme nett koble til. |
| `PUBLIC_URL` | – | Valgfri. Adressen QR-koden skal peke på (f.eks. `https://disputt.no`). Uten den brukes adressen verten har åpnet, og LAN-adressen hvis verten sitter på `localhost`. |

Helsesjekk: `GET /healthz` svarer `ok`.

## 1. På din egen maskin (samme Wi‑Fi)

```bash
npm install
npm start
```

Åpne adressen merket **«På mobilen (Wi‑Fi)»** på verten sin telefon. Er alle på samme nett, kan resten skanne QR-koden. Spillere på mobildata når deg ikke uten en tunnel (se under).

## 2. Render (anbefalt for å teste med venner)

Gratis, ingen kredittkort for testing, og får en `https://…onrender.com`-adresse som fungerer for alle, uansett nett.

1. Logg inn på [render.com](https://render.com) med GitHub-kontoen.
2. **New + → Blueprint**, velg repoet `Disputt` (gi Render tilgang til repoet hvis det er privat). Render leser [`render.yaml`](../render.yaml).
3. Vent 1–2 minutter på bygget. Åpne adressen på telefonen og trykk **Start et spill**.

Gode å vite:

- Gratisplanen **sovner etter ~15 min uten trafikk**, og første besøk etterpå tar 30–60 sekunder. Åpne siden et minutt før dere skal spille. Betalt «Starter»-plan er alltid våken.
- WebSockets fungerer uten ekstra oppsett. HTTPS gir også *skjerm våken* på telefonene (Wake Lock krever sikker kontekst).

### Egen adresse: disputt.no

1. Render → tjenesten → **Settings → Custom Domains → Add**: `disputt.no` og `www.disputt.no`.
2. Hos domeneregistraren: følg Renders DNS-instruksjoner (`ALIAS`/`ANAME` eller `A`-poster for rotdomenet, `CNAME` for `www`). Sertifikat (HTTPS) ordnes automatisk.
3. Sett miljøvariabelen `PUBLIC_URL=https://disputt.no` i Render, slik at QR-koden alltid peker dit.

## 3. Fly.io

```bash
fly launch --no-deploy          # oppdager Dockerfile; velg region (f.eks. arn eller ams)
fly scale count 1               # viktig: én instans
fly deploy
```

I `fly.toml`: la `internal_port = 3000`, og sett `min_machines_running = 1` og `auto_stop_machines = "off"` hvis spillet alltid skal være våkent.

## 4. Docker

```bash
docker build -t disputt .
docker run -p 3000:3000 -e PUBLIC_URL=https://disputt.no disputt
```

Legg gjerne en omvendt proxy (Caddy, nginx, Cloudflare) foran for HTTPS. WebSocket-stien er `/ws` og må slippes gjennom (`Upgrade`-header).

## 5. Tunnel fra egen maskin (spillere på mobildata)

Gir en offentlig `https`-adresse til serveren på maskinen din uten å publisere noe:

```bash
npm start
cloudflared tunnel --url http://localhost:3000   # brew install cloudflared
```

Åpne `https://….trycloudflare.com`-adressen **på verten sin telefon** (ikke localhost), så peker QR-koden dit. Tunnelen forsvinner når du stopper kommandoen.

## Sikkerhet i korte trekk

- Ingen kontoer eller persondata lagres. Alt ligger i minnet og forsvinner når rommet er ferdig (6 timer, eller 30 minutter uten tilkoblede spillere).
- Alle svar fra serveren er skreddersydd per spiller: hemmeligheter (imposterens svar, spørsmålet, fasiten) sendes bare til den som skal se dem.
- WebSocket godtar bare samme opprinnelse (`Origin` = `Host`), meldinger er maks 4 kB og begrenset til ca. 15 per sekund per tilkobling.
- Strenge sikkerhetshoder (CSP uten inline-skript, `nosniff`, `frame-ancestors 'none'`) på alle svar.
