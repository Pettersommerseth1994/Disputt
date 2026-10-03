# Protokoll

Klient og server snakker JSON over én WebSocket (`/ws`). (I peer-to-peer-modus, se [P2P.md](P2P.md), er det en WebRTC-datakanal til vertens telefon i stedet for en WebSocket; meldingene er de samme.) Serveren er autoritativ: klienten sender *intensjoner*, og serveren svarer med en **skreddersydd visning** (`view`) til hver spiller etter hver endring. Klienten tegner bare det den får.

## Klient → server

| `t` | Felt | Hvem | Svar / virkning |
| --- | --- | --- | --- |
| `ping` | `c` (klokke) | alle | `pong {c, s}`; brukes til å synkronisere klokka |
| `create` | | ny vert | `welcome` |
| `join` | `code` | ny spiller | `welcome`, eller feil `room_not_found`, `started` (med `seats`), `full`. Et nytt `join` på en tilkobling som allerede er med i rommet gir samme plass igjen, ikke en ny. Forlatte plassholdere (ingen navn, frakoblet) blir liggende en stund, så den som lot skjermen låse seg på profilsiden kan komme tilbake. Ligger det mer enn to igjen (eller er rommet fullt av dem), overtar neste som kommer den som har vært borte lengst, så gjentatte forsøk ikke fyller lobbyen med spøkelser |
| `resume` | `code, playerId, token` | tilbakevendende | `welcome`, eller feil `bad_token` / `room_not_found` |
| `claim` | `code, playerId` | spiller uten nettleserdata | `welcome` med ny token (kun for frakoblede plasser). Krever ingen hemmelighet, for en telefon som har mistet nettleserdataene har ingen, så alle andre i rommet får `notice` om at plassen er overtatt. Tilkoblingen slipper plassen den hadde fra før |
| `profile` | `name, avatar` | lobby | setter/endrer navn og avatar (unike) |
| `target` | `value` (1–99) | vert, når som helst før spillet er ferdig | poengmål (sjekkes for vinner når runden er ferdig) |
| `start` | | vert, lobby | starter første runde (min. 3 klare og tilkoblede) |
| `select` | `index` (0–3 / null) | den som svarer | lagrer foreløpig valg (overlever sideoppdatering) |
| `timer.set` | `seconds` (30–3600) | den som svarer | setter gjenstående tid (2/6/10 min i UI) |
| `timer.add` | `seconds` | den som svarer | legger til tid (starter fra nå hvis tiden er ute) |
| `lock` | `index` | den som svarer | låser svaret, starter 5-sekunders nedtelling |
| `continue` | | den som svarte, eller verten | teller poeng, viser oppsummering (eller vinner) |
| `next` | | vert, oppsummering | neste runde |
| `skip` | | vert, under en runde | hopper over runden uten poeng |
| `end` | | vert | avslutter spillet; de som leder vinner |
| `again` | | vert, ferdig | tilbake til lobbyen med nullstilte poeng |
| `kick` | `id` | vert | fjerner spiller (i spill: bare frakoblede) |
| `leave` | | spiller, lobby | forlater rommet |

## Server → klient

| `t` | Innhold |
| --- | --- |
| `welcome` | `code, playerId, token, view`: send `token` tilbake i `resume` (klienten lagrer den i `sessionStorage`) |
| `state` | `view`: ny visning (sendes til alle ved enhver endring) |
| `error` | `code, message` (norsk, vises direkte), evt. ekstra felt (f.eks. `seats`) |
| `removed` | `reason`: spilleren er fjernet (`kicked`, `not_ready`, `left`, `timeout`) |
| `closed` | `reason`: `expired` (rommet er borte) eller `replaced` (samme spiller åpnet en annen fane) |
| `notice` | `text`: en kort melding alle skal se (nå bare: «Plassen til … ble tatt over av en ny telefon»). Eldre klienter ignorerer den |
| `pong` | `c, s`: `s` er serverklokka (ms) |

**Utdaterte trykk:** kommer en melding i en fase den ikke hører hjemme i (dobbelttrykk, treg linje), svarer serveren *ikke* med en feil, men sender bare spilleren en fersk `state`, så skjermen rettes opp uten at det dukker opp en feilmelding.

Feilkoder: `room_not_found`, `bad_token`, `started`, `full`, `busy`, `bad_name`, `name_taken`, `bad_avatar`, `avatar_taken`, `not_host`, `not_asker`, `bad_phase`, `need_players`, `need_connected`, `not_ready`, `bad_value`, `no_session`, `bad_message`, `seat_gone`, `seat_taken`, `server`.

## Faser

`lobby → role (8 s) → question → locked (5 s) → reveal → summary → role …  → finished`

Overgangene `role → question` og `locked → reveal` skjer av seg selv på serveren. Resten utløses av meldinger.

## Visningen (`view`)

```jsonc
{
  "code": "KRAP", "phase": "question", "round": 3, "target": 5, "hostId": "…", "now": 1790000000000,
  "limits": { "min": 3, "max": 10, "twoImpostorsFrom": 6 },   // fra så mange spillere i runden er det to imposterer
  "timings": { "roleMs": 8000, "countdownMs": 5000 },
  "players": [{ "id": "…", "name": "Mari", "avatar": "mandarin", "score": 2, "connected": true, "isHost": false }],
  "pending": 0,                       // tilkoblede som ikke har valgt profil ennå
  "you": {
    "id": "…", "isHost": false, "ready": true, "name": "Mari", "avatar": "mandarin",
    "role": "impostor",               // i runde: "impostor" | "loyal"
    "isAsker": false,
    "secret": { "index": 2, "letter": "C", "text": "Frankrike" },  // KUN for imposterne
    "mates": [{ "id": "…", "name": "Kari", "avatar": "sky" }]      // KUN for en imposter i en runde med to: den andre
  },
  "turn": { "number": 3, "askerId": "…", "impostors": 1 },   // antall imposterer er ingen hemmelighet
  "roleEndsAt": 0,                    // fase role
  "discussion": { "endsAt": 0 },      // fase question (alle)
  "question": { "text": "…", "options": ["…","…","…","…"] },   // KUN den som svarer
  "selected": 2,                      // KUN den som svarer
  "countdown": { "endsAt": 0 },       // fase locked
  "reveal": { "correct": true, "chosen": 2, "correctIndex": 2, "correctLetter": "C", "correctText": "Frankrike", "question": {} }, // KUN den som svarer, fase reveal
  "summary": { "round": 3, "correct": true, "skipped": false, "gained": { "<id>": 1 }, "tiebreak": false, "impostorId": "…", "impostor": { "id": "…", "name": "Ola", "avatar": "blabaer" }, "impostorIds": ["…"], "impostors": [{ "id": "…", "name": "Ola", "avatar": "blabaer" }], "askerId": "…" },
  "winners": ["<id>"]                 // fase finished
}
```

Én imposter blir to når runden har seks spillere eller flere (de som er tilkoblet ved rundestart). `impostorId`/`impostor` er den første av dem og finnes for klienter som ikke er oppdatert; nyere klienter leser `impostorIds`/`impostors`. `you.mates` og `turn.impostors` er nye felt (alt nytt er lagt til, ingenting er endret), så en klient og en vert som ikke er like nye virker fortsatt sammen: den eldre ser bare én imposter.

Alle tidspunkter er serverens epoch-millisekunder. Klienten regner ut `serverNow = Date.now() + offset`, der `offset` måles med `ping`/`pong` (lavest RTT vinner), så klokka er lik på alle telefoner uansett hva de viser.

## Gjenoppkobling

1. Klienten lagrer `{code, playerId, token}` i `sessionStorage` ved `welcome`.
2. Ved hver (re)tilkobling sender den `resume`. Serveren svarer med `welcome` og full `view`: spilleren er tilbake i samme fase, med samme rolle og hemmelighet.
3. Åpnes samme identitet i en annen fane, får den første `closed {reason:"replaced"}`.
4. Er nettleserdata borte, gir `join` på et spill som har startet feilen `started` med `seats` (frakoblede spillere). `claim` overtar en plass og gir ny token.
