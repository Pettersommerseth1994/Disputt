# Disputt

> **Lur dem. Eller avslør lureren.**

Disputt er et sosialt bløff- og diskusjonsspill for **3–10 spillere**. Alle spiller på sin egen telefon, samlet i samme rom. Én av dere er imposter og vet svaret på spørsmålet. De andre må finne ut hva som er riktig, uten å bli lurt.

Spillet er *mobile first*, uten kontoer og uten app: verten åpner nettsiden, de andre skanner en QR-kode (eller får lenken sendt med «Del lenke»).

**Spill nå: https://pettersommerseth1994.github.io/Disputt/**

### Test med venner (fra hvilket som helst nett)

1. **Verten** åpner lenken over, trykker *Start et spill* og velger navn og avatar.
2. De andre **skanner QR-koden** på vertens skjerm, eller verten trykker *Del lenke* og sender den i en chat. Man kan også gå til siden og skrive den firebokstavers koden.
3. Verten trykker *Start Disputt* når alle er med (minst tre).

Gode råd, fordi siden kjører uten spillserver (se [docs/P2P.md](docs/P2P.md)): **verten er serveren.** Vær vert fra en telefon på Wi-Fi (eller en laptop), og hold siden åpen med skjermen våken. Får en gjest ikke kontakt etter ca. 30 sekunder, står det et råd på skjermen: bytt mellom Wi-Fi og mobildata. Noen mobilnett og bedriftsnett slipper ikke telefoner i direkte kontakt (det finnes ingen TURN-server ennå, se veikartet).

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

Det finnes tre måter å kjøre Disputt på. Spillet og skjermene er helt like i alle tre.

**1. På nettet, uten installasjon: GitHub Pages (peer-to-peer).** Åpne lenken over. Siden ligger på GitHub Pages, som bare kan vise filer, så *vertens telefon kjører selve spillet* og de andre kobler seg rett til den (WebRTC). Verten må holde siden åpen mens dere spiller. Fungerer fra alle nett, men noen strenge nett (bedrift, enkelte mobiloperatører) kan blokkere direkte tilkobling. Detaljer, begrensninger og innstillinger: **[docs/P2P.md](docs/P2P.md)**.

**2. Kjør selv på egen maskin (Node + WebSocket).** Du trenger [Node.js](https://nodejs.org) 22 eller nyere.

```bash
npm install
npm start
```

Terminalen skriver ut to adresser. Åpne **adressen merket «På mobilen (Wi‑Fi)»** på telefonen til verten (ikke `localhost`), så peker QR-koden riktig for de andre. Alle må være på samme Wi‑Fi. Macen kan spørre om `node` skal få ta imot innkommende tilkoblinger, svar «Tillat».

**3. Egen server på nett (Render, Fly, Docker).** Mest robust: en server som alltid står, og ingen avhengighet til vertens telefon. Se **[docs/DEPLOY.md](docs/DEPLOY.md)**. GitHub Pages kan også settes til å bruke en slik server.

## Designsystem

Utseendet er surrealistisk og lekent: fargestift/oljepastell på dyp burgunder, med funky overskrifter (Fraunces) og en vanlig serif til brødtekst (Lora).

- **Levende stilguide:** start serveren og åpne [`/design-system/`](http://localhost:3000/design-system/). Farger, typografi, avatarer, komponenter og skjermer, bygget med de samme CSS-filene som spillet.
- **Dokumentasjon:** [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md).
- **Kode:** `public/css/tokens.css` (farger, typografi, rom, former, bevegelse), `components.css` (knapper, felt, avatarer, klokke, svaralternativer …), `screens.css` (skjermene).
- **Illustrasjoner:** de ti avatarene, rolleskjerm-øyne, teksturer og dekor genereres av `tools/art` (`npm run art`). De kan byttes ut 1:1 med håndtegnede SVG-er (samme filnavn, `viewBox 0 0 400 400`).
- **Logo:** `public/assets/logo/` (svart, krem og «øye i i-prikken»), generert fra fonten med `npm run logo`.

## Spørsmål

Spørsmålene ligger i [`shared/questions.js`](shared/questions.js): tekst, fire alternativer og indeksen til riktig svar. Spillet blander kortstokken og viser alle spørsmål før noe gjentas, og aldri samme spørsmål to ganger på rad. Det er foreløpig **fire testspørsmål**, så de gjentas i lengre spill.

## Struktur

```
server/    Node-serveren (HTTP + WebSocket): index.js og static.js.
shared/    Spillmotoren (game.js = ren tilstandsmaskin, hub.js, questions.js, util.js) og avatar-rosteret.
           Kjører både i Node-serveren og, i peer-to-peer-modus, i vertens nettleser.
public/    Klienten: Preact + htm uten byggesteg (css/, js/, js/p2p/, assets/, design-system/).
tools/     Generatorer (art, logo, fonter), byggeverktøy for GitHub Pages (pages/) og QA-verktøy (qa/).
test/      Enhets-, server-, QR-, bygge- og ende-til-ende-tester.
docs/      Protokoll, drift, peer-to-peer, designsystem.
```

Spillrommene ligger i minnet (ingen database, ingen kontoer). Motoren eier all spillogikk og sender hver spiller *kun det hen skal se*: ingen hemmeligheter (imposterens svar, spørsmålet, fasiten) ligger i andres data. Protokollen er beskrevet i [docs/PROTOCOL.md](docs/PROTOCOL.md).

## Tester og kvalitetssikring

```bash
npm test               # motor, lagring/gjenoppretting, WebSocket-ende-til-ende, QR-koden dekodes, statiske ruter, bygget for Pages
npm run play           # UI-test: flere "telefoner" i ekte nettleser spiller et helt spill (krever Google Chrome)
npm run play -- 6 3    # …med 6 spillere, til 3 poeng
npm run play:p2p -- 4 2  # det samme over WebRTC (peer-to-peer-bygget + lokal megler, uten internett)
npm run play:live      # det samme mot den publiserte siden på GitHub Pages (ekte megler, ekte tidtakere, ca. 1,5 min)
npm run qa:stuck       # en gjest som ikke får linje til verten får et råd på skjermen (ca. 40 s)
npm run qa:signalling  # verten mister kontakten med meglertjenesten (også midt i et spill): nye gjester kommer likevel inn
npm run shots          # skjermbilde av hver skjerm i mobilstørrelse -> tmp/shots/
npm run pages:preview  # bygg og vis GitHub Pages-versjonen lokalt (http://localhost:8080)
```

## Personvern

Ingen kontoer, ingen cookies, ingen sporing. Navn og avatar finnes bare i spillets minne (serverens, eller vertens nettleser i peer-to-peer-modus) mens spillet pågår, og identiteten i nettleseren ligger i `sessionStorage` for den ene fanen. I peer-to-peer-modus kobler PeerJS' offentlige meglertjeneste telefonene sammen (den ser ikke spilltrafikken), og slik WebRTC fungerer kan spillerne teknisk se hverandres IP-adresser.

## Veikart

- En vanlig nettside (forside, regler, kontakt) på disputt.no.
- Flere spørsmål og kategorier, evt. kategorivalg per spill.
- Lyd og haptikk (kun den som svarer), «behold skjermen våken» også uten HTTPS.
- TURN-server for peer-to-peer (de få nettene som blokkerer direkte tilkobling), eller en alltid-på spillserver på Render.
- Håndtegnede avatarer og rolle-illustrasjoner i stedet for de prosedyretegnede.
