# Disputt

> **Lur dem. Eller avslør lureren.**

Disputt er et sosialt bløff- og diskusjonsspill for **3–10 spillere**. Alle spiller på sin egen telefon, samlet i samme rom. Én av dere er imposter og vet svaret på spørsmålet. De andre må finne ut hva som er riktig, uten å bli lurt.

Spillet er *mobile first*, uten kontoer og uten app: verten åpner nettsiden, de andre skanner en QR-kode.

## Slik spilles det

1. **Verten** åpner Disputt og starter et spill. Hen får en QR-kode som de andre skanner.
2. Alle skriver inn **navn** og velger en av ti **avatarer**. Verten ser spillerne komme inn, velger hvor mange **poeng** man spiller til (ett poeng tar ca. 10 min, vi anbefaler minst 5) og trykker **Start Disputt**.
3. **Roller:** én tilfeldig spiller blir **imposter** (rød skjerm, får se riktig svar, f.eks. «C: Frankrike»). Alle andre er **lojale** (blå skjerm). Vises i 5 sekunder.
4. En tilfeldig spiller (kan også være imposteren) får **spørsmålet** med fire alternativer og leser det høyt. Klokka starter med en gang; hen kan sette den til **2, 6 eller 10 minutter** og legge til tid underveis.
5. Alle **diskuterer**. Imposteren prøver å lure de andre til å svare feil. Hvordan man blir enige er opp til gruppa.
6. Spilleren med spørsmålet **krysser av** svaret dere ble enige om og låser det. Så telles det ned **5-4-3-2-1**, og fasiten avsløres **kun på den telefonen**.
7. **Riktig svar:** alle lojale får 1 poeng. **Feil svar:** bare imposteren får 1 poeng. Ny runde med ny imposter, ny spiller og nytt spørsmål.
8. Først til målet vinner. Poengtavlen kan åpnes når som helst, og verten kan justere poengmålet underveis.

### Valg som er tatt (og kan endres)

- **Uavgjort på toppen:** vinneren krones først når noen har nådd målet *og* leder alene. Står flere likt, spiller man videre til én drar fra. Verten kan også avslutte spillet og kåre den som leder.
- **Imposter og spørsmålsstiller er rent tilfeldige** (kryptografisk tilfeldig), uavhengig av hverandre. Samme spiller kan være begge deler, og samme person kan bli imposter flere ganger på rad.
- **Poengene telles først når spilleren som svarte trykker «Gå videre»**, så poengtavlen ikke røper utfallet før avsløringen.
- **Imposteren kan se riktig svar igjen** ved å holde inne en knapp (slipper man, skjules det). Svaret ligger ikke åpent på skjermen mens de andre sitter ved siden av.
- **Mistet forbindelsen?** Telefoner som sovner eller laster siden på nytt kommer rett tilbake til samme sted. Har en spiller mistet nettleseren helt, kan hen velge seg selv fra «Spillet har startet»-skjermen. Faller verten ut, overtar en annen spiller vertsrollen (etter 3 minutter under spillet, 10 minutter i lobbyen). Verten kan hoppe over en runde som står fast, eller fjerne en frakoblet spiller.
- **Bare de som er med i runden kan score på den.** Er en spiller borte når runden starter, får hen verken rolle eller poeng for den runden, så ingen kan «vinne» ved å være fraværende.
- **Skjermlås:** på vanlig `http` (f.eks. lokalt Wi‑Fi) kan ikke nettsiden holde skjermen våken. Appen kobler seg til igjen av seg selv når telefonen våkner, men det er smidigere om dere setter skjermlåsen til «Aldri» mens dere spiller. Over `https` (Render, tunnel) holdes skjermen våken automatisk.

## Kom i gang

Du trenger [Node.js](https://nodejs.org) 22 eller nyere.

```bash
npm install
npm start
```

Terminalen skriver ut to adresser. Åpne **adressen merket «På mobilen (Wi‑Fi)»** på telefonen til verten (ikke `localhost`), så peker QR-koden riktig for de andre. Alle må være på samme Wi‑Fi. Macen kan spørre om `node` skal få ta imot innkommende tilkoblinger, svar «Tillat».

Vil du teste uten felles Wi‑Fi, eller legge spillet ut på nett (Render, Fly, Docker, egen adresse som disputt.no)? Se **[docs/DEPLOY.md](docs/DEPLOY.md)**.

## Designsystem

Utseendet er surrealistisk og lekent: fargestift/oljepastell på dyp burgunder, med funky overskrifter (Fraunces) og en vanlig serif til brødtekst (Lora).

- **Levende stilguide:** start serveren og åpne [`/design-system/`](http://localhost:3000/design-system/). Farger, typografi, avatarer, komponenter og skjermer, bygget med de samme CSS-filene som spillet.
- **Dokumentasjon:** [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md).
- **Kode:** `public/css/tokens.css` (farger, typografi, rom, former, bevegelse), `components.css` (knapper, felt, avatarer, klokke, svaralternativer …), `screens.css` (skjermene).
- **Illustrasjoner:** de ti avatarene, rolleskjerm-øyne, teksturer og dekor genereres av `tools/art` (`npm run art`). De kan byttes ut 1:1 med håndtegnede SVG-er (samme filnavn, `viewBox 0 0 400 400`).
- **Logo:** `public/assets/logo/` (svart, krem og «øye i i-prikken»), generert fra fonten med `npm run logo`.

## Spørsmål

Spørsmålene ligger i [`server/questions.js`](server/questions.js): tekst, fire alternativer og indeksen til riktig svar. Spillet blander kortstokken og viser alle spørsmål før noe gjentas, og aldri samme spørsmål to ganger på rad. Det er foreløpig **fire testspørsmål**, så de gjentas i lengre spill.

## Struktur

```
server/    Node-server (HTTP + WebSocket). game.js er selve spillmotoren: en ren tilstandsmaskin uten I/O.
shared/    Avatar-rosteret, brukt av både server og klient.
public/    Klienten: Preact + htm uten byggesteg (css/, js/, assets/, design-system/).
tools/     Generatorer (art, logo, fonter) og QA-verktøy (skjermbilder, UI-test).
test/      Enhets-, server-, QR- og ende-til-ende-tester.
docs/      Protokoll, drift, designsystem.
```

Serveren er én prosess med spillrom i minnet (ingen database, ingen kontoer). Motoren eier all spillogikk og sender hver spiller *kun det hen skal se*: ingen hemmeligheter (imposterens svar, spørsmålet, fasiten) ligger i andres data. Protokollen er beskrevet i [docs/PROTOCOL.md](docs/PROTOCOL.md).

## Tester og kvalitetssikring

```bash
npm test            # motor, WebSocket-ende-til-ende, QR-koden dekodes, statiske ruter
npm run play        # UI-test: flere "telefoner" i ekte nettleser spiller et helt spill (krever Google Chrome)
npm run play -- 6 3 # …med 6 spillere, til 3 poeng
npm run shots       # skjermbilde av hver skjerm i mobilstørrelse -> tmp/shots/
```

## Personvern

Ingen kontoer, ingen cookies, ingen sporing. Navn og avatar finnes bare i serverens minne mens spillet pågår, og identiteten i nettleseren ligger i `sessionStorage` for den ene fanen.

## Veikart

- En vanlig nettside (forside, regler, kontakt) på disputt.no.
- Flere spørsmål og kategorier, evt. kategorivalg per spill.
- Lyd og haptikk (kun den som svarer), «behold skjermen våken» også uten HTTPS.
- Håndtegnede avatarer og rolle-illustrasjoner i stedet for de prosedyretegnede.
