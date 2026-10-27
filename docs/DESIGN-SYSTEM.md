# Designsystem

Disputt ser ut som en tegning med fargestifter på burgunder papir: flate krittfarger med strek og korn oppå, blobbete former, hard «kritt-kant» i stedet for skygge, og øyne overalt.

**Se det levende:** kjør `npm start` og åpne `/design-system/`. Siden bruker de samme CSS-filene som spillet og leser fargene rett fra tokens.

## Filer

| Fil | Innhold |
| --- | --- |
| `public/css/tokens.css` | Fonter (`@font-face`), farger, typografiskala, rom, former, skygger, bevegelse. **Eneste sted med råverdier.** |
| `public/css/base.css` | Reset, side, overskrifter, skjermskall (`.screen`, `.dock`), animasjoner (`pop`, `rise`, `wobble`, `float`, `pulse`, …). |
| `public/css/components.css` | Knapper, kort, felt, stepper, segmentert valg, avatar, spillerrutenett, avatarvelger, chips, klokke, svaralternativer, fremdriftsstrek, poengtavle, sheet, toast, banner, logo-klistremerke, rollestripe, konfetti. |
| `public/css/screens.css` | Layout og stemning per skjerm. |
| `public/css/legal.css` | Leselayout for `vilkar.html` og `personvern.html`: en smal kolonne i spillets farger, med selgerkortet øverst. |
| `public/js/hold.js` | `useHold()`: trykk og hold, slik hemmeligheter skjules (rollen vises bare mens en finger holder knappen). |
| `public/js/ui.js` | JS-komponentene (`Avatar`, `Button`, `Timer`, `Sheet`, `Scoreboard`, `QR`, `RoleStrip`, …) som bruker klassene over. |
| `public/js/screens/pay.js`, `screens/shoppay.js`, `public/js/pay/`, `public/takk.html` | Pakkene, «Logg inn», «Velkommen!», «Min tilgang» og logikken bak (tilgang, kode, kall til betalingsserveren; `shop.js` for Shopify). Av som standard, se [SHOPIFY.md](SHOPIFY.md) og [BETALING.md](BETALING.md). |
| `public/js/mantra/`, `public/css/mantra.css` | Mantraet: stripen øverst på alle skjermer («★ Mantra») og boblen den åpner. Teksten står i `MANTRA` øverst i `mantra.js`. |
| `public/design-system/` | Stilguide-siden. |
| `shared/avatars.mjs` | Avatar-rosteret (id, navn, aksentfarge). |
| `public/config.js`, `public/js/paths.js` | Distribusjonsinnstillinger og stedsuavhengige stier (alle URL-er er relative, så siden virker både på `/` og under `/Disputt/`). |

## Tokens i korte trekk

**Farger:** burgunder (`--burgundy-950…500`, siden er `700`), kritt (`--yellow --lime --orange --coral --pink --violet --blue --blue-light --teal`), papir/blekk (`--cream --ink`) og rollefargene `--red` (imposter) og `--blue` (lojal), som bare brukes som fargen på *ordet* på rollekortet og aldri fyller en hel skjerm. Kritt-fargene er trukket ut av referansetegningene.

**Aldri ren hvit eller svart.** «Hvitt» er en smørkrem (`--cream`, `#f8e6b8`) og «svart» en mørk sjokoladebrun (`--ink`, `#3a2012`): all tekst, logoen, papirkort, kremknapper og QR-koden (brune moduler på kremfarget bunn) bruker dem. Gjennomsiktige varianter lages av kanalene (`rgb(var(--cream-rgb) / .5)`, `--ink-rgb`, og `--shadow-rgb` for de harde kritt-skyggene), så paletten står ett sted. Rollefargene som tekst på kremfarget kort skal holde minst 4,5:1 i kontrast, og det er derfor `--red` og `--blue` er så dype som de er. Stilguiden (`/design-system/`) viser kontrasten for alle fargene.

**Typografi:** ingen tekst står i STORE BOKSTAVER, heller ikke etiketter over felt (`.eyebrow`) eller rolleordet: `text-transform: uppercase` brukes ikke, bortsett fra i feltet der man skriver spillkoden, siden en kode skrives med store bokstaver. `--font-display` (Fraunces, tung kursiv, *soft + wonky*) til overskrifter, knapper, tall og navn på store flater; `--font-text` (Lora) til alt annet. Skala: `--fs-hero --fs-h1 --fs-h2 --fs-h3 --fs-lead --fs-body --fs-small --fs-micro`.

**Rom:** 4 px-rutenett (`--s-1…7`), `--page-x/top/bottom` tar hensyn til hakk og hjemmelinje (`env(safe-area-inset-*)`).

**Former:** `--r-btn --r-card --r-input --r-blob --r-sheet --r-pill`. Alle har ulike radier per hjørne, slik at ingenting er et perfekt rektangel.

**Dybde:** `--shadow-1/2/3` er harde forskyvninger (`0 6px 0 …`), aldri uklare.

**Bevegelse:** `--ease-bounce`, `--ease-out`, `--dur-1/2/3`. `prefers-reduced-motion` slår alt av.

## Kritt-oppskriften

En flate = en flat farge + korn + strek:

```css
.min-flate {
  background: var(--tex-grain), var(--tex-light), var(--yellow); /* øverst = nærmest deg */
  border-radius: var(--r-card);
  box-shadow: var(--shadow-2);
}
```

`--tex-grain`, `--tex-light` og `--tex-dark` er sømløse, gjennomsiktige PNG-fliser (`public/assets/textures/`, laget av `npm run art`). Samme flis gir kritt-look på alle farger.

## Legge til en komponent

1. Bruk kun tokens, ingen hardkodede farger, størrelser eller radier.
2. Gi den en blobbete radius, en kritt-kant (`--shadow-*`) og, hvis den er en flate, tekstur-lagene.
3. Gi den en `:active`-tilstand (synk ned i kanten) og en tydelig `:focus-visible`.
4. Legg et levende eksempel i `public/design-system/index.html`.

## Avatarer og illustrasjoner

- 10 avatarer i `public/assets/avatars/<id>.svg` (`viewBox 0 0 400 400`, gjennomsiktig bakgrunn). Rosteret styres av `shared/avatars.mjs`; legg du til en avatar, legg til både filen og linjen der (serveren validerer mot rosteret og håndhever at hver avatar bare kan velges av én).
- Rolleskjerm-øyne, krone, dekor og teksturer ligger i `public/assets/art` og `public/assets/textures`.
- Alt genereres deterministisk med `npm run art` (kilde i `tools/art`). Vil du bruke håndtegnede illustrasjoner, overskriv SVG-ene med samme filnavn.

## Roller skal ikke synes for andre

En telefon som er rød eller blå, eller som viser et stort «Imposter», røper rollen til alle i rommet. Derfor:

- **Rolleskjermen (8 s) viser ingenting om rollen før en finger holder knappen.** Resten av tiden er den en tom, stiplet plass for kortet, helt lik for lojale og imposter. Kortet (øye, rollens navn i `--red`/`--blue`, riktig svar eller «?») er like stort for begge roller, og forsvinner når fingeren løftes (`public/js/hold.js`). Plassen tar resten av høyden i skjermen, så et høyere kort aldri skyver knappen bort fra under fingeren.
- **Stripen under runden** (`RoleStrip`) er lik for alle («Din rolle · Hold for å se») og viser rollen, og for imposteren svaret, bare mens den holdes. **Det som kommer fram står til venstre for knappen, aldri i den eller under den**, for der dekker fingeren det: knappen endrer ikke tekst og flytter seg ikke når teksten ved siden av vokser. Det samme gjelder rollekortet, som står over knappen. `npm run qa:overlap` sjekker det (regel 6, med selvtest).
- **To impostere (fra seks spillere):** kortet har en tredje del, «Imposterne». Imposterne ser «Du og Kari» med Karis avatar. De lojale har ingenting å slå opp, så kortet deres er bare rollen, midt i kortets plass. Stripen får en ekstra linje mens den holdes («Sammen med Kari» / «To av dere er impostere»). Rundens antall impostere er ingen hemmelighet og står i `view.turn.impostors`; hvem de er står bare i imposterens egen visning (`you.mates`).
- **Alt annet som ellers kunne røpet rollen er likt:** vibrasjonen ved rolleskjermen, tipset under klokka, og nettleserfargen (`theme-color`). Hele siden skifter aldri farge: det finnes ingen sidetemaer.
- QA kan vise alt som «holdt» uten finger: `setStore({ qaHold: true })` (se `useHold`).

## Mobilen er et støtteverktøy: avsløringen sies høyt

Spillet er til for at folk skal se på, snakke med og diskutere med hverandre, ikke på telefonen. Telefonen leser opp spørsmålet, trekker imposterne og holder styr på poengene. **Nye skjermer skal kreve så få trykk og blikk som mulig.**

- **Fasit, utfall og hvem imposteren er står aldri på en skjerm før imposteren har sagt det høyt.** Etter at svaret er låst telles det ned på alle telefoner («Svaret er låst · 5 · Dere låste B: Japan. Se på hverandre!»), og så viser alle samme skjerm, «Imposteren avslører seg!» (`.stage`: leppene, rollestripen og én linje tekst). Bare den som hadde spørsmålet har en knapp, «Det er sagt, vis poengene». Imposteren kan slå opp svaret i rollestripen (hold) hvis hen har glemt det. Teksten sier ikke at imposteren «må reise seg», for det er opp til dem.
- **Poengene** (`Summary`) er en poengtavle med +1 og én linje om hvordan runden gikk, uten kort som navngir imposteren. Under står en liten tekstknapp, «Uenige? Se fasit», som åpner et ark (`FasitSheet`, `public/js/screens/fasit.js`) med riktig svar, hva dere låste og hvem imposteren var, til når gruppa er uenig om det som ble sagt. Telefonen regner ut poengene selv, så en imposter som lyver høyt får det ikke til å stå på poengtavlen.
- Telefonen kan ikke få en iPhone til å vibrere, så nedtellingen må stå på skjermen.
- **Mantraet** (`Mantra`, `public/js/mantra/mantra.js` og `public/css/mantra.css`) minner om det samme på alle skjermer: en stripe øverst, «★ Mantra», og et trykk gir en boble fra Team Disputt («Disputt er et sosialt selskapsspill, laget for å spilles mellom mennesker. Telefonen er bare et støtteverktøy for quizen …»). Stripen ligger i flyten over skjermen (`position: sticky`, helt dekkende, under arkene, banneret og toasten), og skjermene gir den plass: `#app:has(> .mantra) .screen` er like mye lavere som stripen er høy, så en skjerm er fortsatt like høy som telefonen. Stripen er 26 px høy (`--mantra-h`, 1.625rem; knappen i den er 2 px lavere, og har ingen strek langs toppen, siden den henger fra kanten). Den koster ca. 13 px av høyden, og på korte telefoner gir de tetteste skjermene litt luft tilbake (nederst i `mantra.css`; `node tools/qa/fit.mjs` sjekker dem). Et trykk hvor som helst lukker boblen uten å trykke på noe annet, og den lukkes også av Escape og når en ny skjerm kommer opp. Skriptet laster stilarket selv (`styles.js`), så et nytt skript sammen med en gammel `index.html` fra hurtigbufferen ikke gir en naken stripe. Fem utseender ble prøvd (boble, bånd, ark, plakat, klistremerke), med ti ord og fem tekster; boblen, stjernen, «Mantra» og teksten «Slik mener vi det» ble valgt.

## Vertens oppsett i fem steg

Verten går gjennom fem steg (fire når alle spiller på én telefon), ett valg per skjerm: 1 «Hvordan vil dere spille?» (`ModeStep`, `public/js/screens/mode.js`: før noe spill finnes; «På én telefon» eller «På hver sin telefon», begge for 2–10 spillere), 2 «Er du klar?» (`ReadyStep`, `screens/ready.js`: Sofie sier at det alltid er en eller flere impostere og at dere må bli enige om riktig svar, og verten krysser av for begge; spillet lages først når verten går videre derfra), 3 «Hvem er du?» (`Profile` med `wizard`, knappen heter «Neste»), 4 «Hvor lenge skal dere spille?» (`PointsStep`) og 5 «Få med vennene dine» (`Lobby`, der spillet venter på spillerne). **På én telefon er det fire steg:** modus, «Er du klar?», spillerne og «Hvor lenge skal dere spille?», og det siste har knappen «Start spillet» (ingen «Neste» og ikke noe femte steg). (Internt heter de to måtene `car` = Bilturmodus og `cabin` = Hytteturmodus.) Komponentene ligger i `public/js/screens/setup.js`.

- `Steps` viser fem striper, «‹ Tilbake» til venstre og «Steg 2 av 5» til høyre (fire striper og «av 4» på én telefon: valget av spillemåte teller fire så snart «På én telefon» er valgt). `store.step` husker hvor verten er etter valget av spillemåte (1 profilen, 2 poeng, 3 invitasjonen; på én telefon er 1 spillerlisten og 2 poeng, som starter spillet); stripen viser det tallet pluss én. `hostStep` gir steg 1 til en vert uten profil og siste steg etter en omlasting. «Tilbake» fra «Hvem er du?» gir opp spillet og går til «Er du klar?» (og derfra til valget av spillemåte), men bare mens verten er alene i det.
- **Spillemåtekortene** (`.mc-card`, `css/mode-cards.css`, lastes av `screens/mode.js`) er to brede kort, over hverandre: bildet til venstre og navnet, én linje og «Passer best for bilturen/hytteturen» til høyre. «På én telefon» har en stor gul telefon med en «1» som svinger mellom to ansikter; «På hver sin telefon» har fire telefoner med hvert sitt ansikt som lyser etter tur. Under kortene står en rad ansikter og «2-10 deltakere» (begge måter tar to til ti). Avkrysningen sitter på kortets hjørne, og det valgte kortet er gult. Gammel bildebasert utgave med blunkende øyne er fjernet.
- Invitasjonen har en liten QR-kode (trykk for å forstørre, det eksisterende arket «Bli med»), koden og «Del lenke», og under dem poengmålet med «Endre». **Hvem som er med vises i bunnfeltet** som en rad med overlappende ansikter (`.facepile`) og en kort tekst over Start-knappen, siden spillerlisten ellers havner under bunnfeltet på en 664 px høy skjerm. Listen med navn og fjerning ligger lenger ned.
- Ett poeng tar ca. 6 minutter (`MINUTES_PER_POINT` i `setup.js`). Tallet står også i spillereglene, vertsvalget, README og stilguiden.

## Å komme tilbake til et spill, og skjermen som ikke skal låse seg

- **Spillkoden står i spillet.** Poengtavla («Poeng») og vertsvalgene viser koden (`GameCode` i `screens/sheets.js`), med en forklaring: åpne disputt.site, «Bli med i spill», skriv koden og velg deg selv. Før måtte man huske den.
- **«Hopp inn igjen».** En gjest sin plass huskes på telefonen i tre timer (`public/js/lastgame.js`, localStorage `disputt:last`; fanens egen kopi i sessionStorage forsvinner når fanen lukkes). Lukker gjesten fanen, står det på forsiden «Du var med i spillet ABCD som Lone» med «Hopp inn igjen» (`screens/rejoin.js`): samme spiller, samme poeng. Bare i spill med flere telefoner og bare for gjester (vertens spill er vertens egen side). Minnet slettes når plassen forlates, fjernes eller spillet er over. Å fjerne en frakoblet spiller midt i et spill sletter poengene hans; vertsvalgene sier det.
- **Skjermen holdes våken** (`public/js/wake.js`, bryteren «Hold skjermen våken» i innstillingene og vertsvalgene, `screens/awake.js`). Vertens telefon er spillserveren: låser skjermen seg, mister alle forbindelsen. Først prøves Screen Wake Lock; mangler den eller blir den nektet (for eksempel Chrome på iPhone), spilles en liten, lydløs video i løkke ute av syne (`public/assets/awake/blank.mp4`, 1,4 kB; nettleseren starter den først etter et trykk). Slår man det av, huskes det, og lobbyen gir tipset om å sette skjermlåsen til «Aldri» hvis ingenting virker. `test/wake.test.js`.
- Siden har `translate="no"`: en nettleser som oversetter siden dobler navn og poeng (Preact og oversettere slåss om tekstnodene).

## Reglene som historie: «Slik spiller dere»

Folk vil ikke lese spillregler, så **overalt der spillet forklarer seg** kommer bildet først: arket «Slik spiller dere» (fra forsiden, lobbyen, oppsettet, avslutningen og vertsvalg) (det finnes ingen skrevet versjon ved siden av og ingenting å rulle i: bare historien). Koden ligger i `public/js/regler/`, stilene i `public/css/regler.css` (lastes av skriptet selv, som mantraet).

- **En historie som i Instagram.** Ett kort per steg, et felt per kort øverst som fylles opp, og kortet bytter av seg selv etter 6–8 sekunder. Trykk til høyre går videre, trykk til venstre tilbake. **Hold fingeren på historien, hvor som helst, så stopper klokka** (og alt som beveger seg på kortet; det står ingenting om det i hjørnet), og når fingeren løftes etter en hold bytter ikke kortet. Siste kort blir bare stående (ingen knapp). (`story.js`; trykksonene ligger oppå kortet, så pausen lyttes til på hele historien, ikke på kortet.)
- **Åtte steg:** 1. Alle får en rolle, 2. Imposteren får vite riktig svar (to impostere fra seks spillere, som kjenner hverandre), 3. Én får spørsmålet, 4. Diskuter!, 5. Lås svaret, 6. Imposteren avslører seg, 7. Poengene deles ut, 8. Deretter ny runde. Nummer og navn kommer først på kortet, linjen under, begge til venstre og samtidig (ikke ord for ord). Teksten står i `content.js`; spørsmålet i eksemplet er «Hva er hovedstaden i England?» (B: London er riktig, imposteren bløffer med A).
- **Bordet sett ovenfra** (`bord.js`): beige kort, rosa bord, fem spillere (seks i steg 2). Rollen står på kortet ved hver spiller hele tiden (blå «Lojal», rød «Imposter»), den blir ikke snudd eller skjult igjen. I steg 8 er det en annen som er imposter (`NEW_IMPOSTOR`, ikke Jonas), og teksten sier at ny imposter velges tilfeldig. Svaralternativene står på to linjer, A og B over C og D.
- I Bilturmodus går telefonen rundt bordet og teksten sier «verten» (`car`).
- Den som ber om mindre bevegelse (`prefers-reduced-motion`) får kortene uten animasjon, og bytter steg for hånd. QA-hjelp: `?steg=4` åpner ved fjerde kort, `window.__regler = { beat: 2 }` fryser bordet ved et steg i scenen. Testene: `test/regler.test.js`.

## Lik tid på skjermen (rollen)

Alle som ser en rolle holder knappen **like lenge, 4 sekunder** (`public/js/screens/equal.js`, `css/equal.css`). En imposter må lese det riktige svaret, så imposterens finger ble før på telefonen litt lenger enn en lojals, og de andre kunne gjette ut fra det. Nå holder alle likt:

- **Tiden vises i et felt over kortet** (`TimeField`): en linje som fylles jevnt (en CSS-animasjon) og sekundene som er igjen, aldri på knappen, siden fingeren ligger der. Knappen er den vanlige store knappen, like stor som «Opprett spill».
- Rollen vises bare mens fingeren holder. Slipper man for tidlig, skjules rollen, linjen begynner på nytt, feltet blir rødt («For tidlig! Hold hele tiden») og det teller ikke: på én telefon går den ikke videre til neste. Etter 4 sekunder blir feltet og knappen grønne («Nå kan du slippe»).
- **Imposterens rolle og svar står der med en gang. En lojals tekst («Lojal», «Ikke bli lurt!», og øyet på kortet) venter 1,2 s og ruller så inn fra venstre på 2 s** (`Roll`): det får de lojale til å se litt lenger. Uten bevegelse (reduced motion) står alt der med en gang.
- Hver telefon: rollekortet (`RoleReveal` i `round.js`) har en liten «Du er» over det store ordet. Én telefon: det høye kortet (`CarTurn` i `carturn.js`) med avatar, navn, rolleplassen (samme størrelse åpen og lukket, to impostere gir en høyere plass for alle) og knappen under. Knappen er låst («Vent …») i 1,5 s etter at telefonen er levert.
- QA: `window.__DISPUTT_HOLD_MS` (satt av `tools/qa/quiet.mjs` til 600) gjør tiden kortere i testene; det er det eneste som endrer den.

## Bilturmodus: alle på én telefon

Samme spill, samme skjermer, men verten har alle spillerne på sin telefon (`public/js/screens/car.js`, `carstrip.js`, motorens `MODE.CAR`). Det som er annerledes:

- **Spillerlisten** (`PlayersStep`, `.roster`) er steg 2 (høyst fem, `LIMITS.maxPlayersCar`): en rad per spiller (avatar, navn, «vert» på den øverste, «Endre») og en kryss-knapp som må trykkes to ganger. Et navn er nok å skrive: neste ledige avatar er valgt på forhånd (`PlayerForm`). Er dere bare to, står det et gult merke om at en runde da har ingen imposter hver tredje gang (`TwoPlayersNote`, `twonote.js`, også i Hytteturmodus-lobbyen).
- **Telefonen sendes rundt** (`CarRoles`, `.rolelist`, `.rolerow`): en liste med navnene nedover. Den som står for tur har *den samme stripen som ellers* (`TableStrip`, lik `RoleStrip`): «Din rolle» og en knapp til høyre, og rollen (og imposterens svar) til venstre mens knappen holdes. De andre venter, de som er ferdige har «✓ Sett», og et gult kort sier hvem telefonen skal til. En rolle regnes som sett når knappen er holdt i minst et halvt sekund og sluppet. **Knappen til den neste venter 1,5 sekunder (nedtonet) før den virker** (`TableStrip`, `lockMs`): fingeren som nettopp slapp kan fortsatt være der, og siden kan ha rullet den nye knappen akkurat dit, så et ekstra trykk eller et dobbelttrykk ellers viste neste spillers rolle for feil person (`tools/qa/car.mjs` trykker på det stedet rett etter slippet og krever at ingenting vises). Når alle har sett sin, får verten «Vis spørsmålet».
- **«Glemt rollen din?»** (`CarStrip`) står der `RoleStrip` ellers står, og «Se rolle» åpner arket «Se rolle igjen» (`RolesSheet`): trykk på navnet ditt, og stripen er der. **Listen i arket holder høyden den har med stripen åpen** (`--rows`): et ark sitter nederst på skjermen, og en liste som vokste da stripen åpnet seg ville skjøvet knappen opp og bort fra fingeren (`tools/qa/car.mjs` sjekker at knappen blir stående).
- **Spillerne kan endres midt i spillet**, fra vertsvalgene (`CarPlayers` og `AddPlayerSheet` i `screens/carplayers.js`): «Hvem spiller» viser alle med poengene sine og «Fjern» (to trykk, det første sier «Mister poengene. Sikker?»; det må bli minst to), og «+ Legg til spiller» åpner et skjema med navn, avatar og poengene hen kommer inn med (0 er standard, opptil én under poengmålet). Den nye spiller fra neste runde. Skjemaet er et eget ark ved siden av vertsarket, ikke inni det (et ark inni et ark flytter seg med det første når det glir opp).
- Poengtavlen og resten viser ingen «(deg)»: alle sitter ved bordet.
- QA: `tools/qa/fixtures.mjs` har bilskjermene (`car-…`), de er med i `qa:fit`, `qa:overlap` og `shots`, og `node tools/qa/car.mjs` spiller hele spillet.

## Pakker og betaling

Betaling er av som standard ([SHOPIFY.md](SHOPIFY.md), [BETALING.md](BETALING.md)). Når den er på, kommer tre ting til: pakkene, «Logg inn» og «Velkommen!». Med Shopify har pakkeskjermen én knapp og en avkrysning for samtykket (som må settes før knappen virker), og bunnlinjen sier «Venter på betalingen …» mens verten betaler i den andre fanen (`public/js/screens/shoppay.js`). Når Vipps er satt opp ([VIPPS.md](VIPPS.md)), kommer en **oransje knapp «Betal med Vipps»** rett over «Betal med kort» (`screens/shoppay.js`): en vanlig knapp i spillets stil (tegnet kant, korn, lett skråstilt), men i Vipps' oransje (`.btn--vipps`, `#ff5b24` med kanten `#c7471c`) og med hvit skrift. Uten de lyse krittstrekene de andre knappene har (på oransje blir de til bleke flekker): bare kornet, som her gjør oransjen mørkere og aldri lysere. Den er grå til samtykkeboksen er krysset av, som «Betal med kort». Den gjør bunnlinjen ca. 70 px høyere, så på lave skjermer (under 700 px) gir siden noe tilbake: setningen under tittelen går tidligere, bunnlinjen er tettere, og på de laveste telefonene også kortene (regler under «The packages on a short screen» i `screens.css`; `node tools/qa/fit.mjs` sjekker det). Siden verten kommer tilbake til fra Vipps er `public/takk.html`. Skjermene ligger i `public/js/screens/pay.js`, og tallene og teksten om pakkene i `public/js/pay/plans.js`.

- **Pakkekort** (`.plans`, `.plan`) er radiokort, som svaralternativene: det valgte kortet blir gult, prisen står alltid til høyre, og merkelappen («Mest populær», «Best verdi») sitter på kortets øvre kant, så teksten inni holder seg på to korte linjer. Et kort er en `label` rundt en usynlig radioknapp, så tastatur og skjermleser virker.
- **Pakkeskjermen** (`Paywall`) går rett til pakkene (ingen mellomsteg). Den har tittel, en stiplet boks «Har du en rabattkode?» med feltet åpent (Shopify), tre kort («12 timer • Fornyes ikke» på hvert), linjen «Er du allerede kunde? Logg inn» og så vilkår/personvern, og et bunnfelt med én knapp per betalingsmåte (den første er den store). Det står ikke noe mer om pakkene, og ikke noe «Dette får du». En lang tilgangskode som skrives i rabattfeltet blir kjent igjen, og «Logg inn med den ›» åpner innloggingen med koden. Kortene skal vises over bunnfeltet uten å rulle; under 700–800 px høyde forsvinner setningen under tittelen (og «Dere har spilt …»). `npm run qa:fit` sjekker det (`pay-gate`; Shopify-variantene er «nice to fit»).
- **Koden** (`.passcode`, `.input--passcode`) står i visningsfonten, i store bokstaver. Innskrivingen setter inn bindestreker mens man skriver, og små bokstaver og O/I/L godtas.
- **«Velkommen!»** (`ThanksSheet`) viser tilgangen, koden og én knapp som starter runden verten ba om («Start runde 3»). Mens gjestene er på vei tilbake står det «Venter på at … kommer tilbake …».
- **Gjestene** får bannerteksten «Verten betaler, spillet fortsetter straks» i stedet for «Mistet forbindelsen» mens verten er hos Stripe.
- **Forsiden** har ingen innlogging (koden skrives under pakkene: «Er du allerede kunde? Logg inn»); en telefon som har tilgang ser «Du har tilgang · Min tilgang» nederst. Lenken til reglene er et rosa klistremerke, «▶ Reglene, kort fortalt», litt skjevt under slagordet og over de to store knappene (`.home-tag`, `screens/home.js`); den åpner historien «Slik spiller dere».
- Alle betalingsskjermene ligger i `tools/qa/payfixtures.mjs` og er med i `qa:overlap`, `qa:fit` og `shots`.

## Små skjermer

En nettleser sine verktøylinjer tar 150–300 px, så en telefon viser ofte bare ca. 550–660 px høyde, ikke de 844 px skjermen har. Skjermene man skal se på et øyeblikk (startsiden, rolle, nedtelling, fasit, diskusjon) må derfor få plass uten scrolling, og knappen nederst skal ikke dekke tekst. Illustrasjonene skalerer med synlig høyde (`dvh`, og `height: auto` slik at `<img height>` ikke holder av tom plass), og `screens.css` strammer inn avstander på lave skjermer (under 580 px høyde blir slagordet på startsiden, som har tre linjer, litt mindre). `npm run qa:fit` måler det på flere størrelser, også med lengste spørsmål og svar i banken.

## Aldri tekst oppå andre ting, aldri tekst som blir skåret av

`npm run qa:overlap` går gjennom alle skjermer (alle spillvisninger, startsiden, «jeg har en kode», tilkobling, plassvelger, «åpnet et annet sted» og alle ark) på flere telefonstørrelser. Den kjører også med det verste spillet tillater: ti spillere, de bredeste 14-bokstavsnavnene (`WWWWWWWWWWWWWW`), lengste spørsmål og svar, to-sifrede poeng, og med 125 % større tekst. Reglene:

- ingen synlig tekst ligger oppå annen synlig tekst, uansett hvor siden er rullet til
- ingen tekst går ut over kanten av skjermen (appen klipper sidelengs overflyt, så den ville bare blitt skåret av)
- ingen tekst skjules av sin egen boks (et langt navn som kuttes)
- bunnlinjene følger reglene under

`npm run qa:overlap -- --self-test` ødelegger layouten med vilje på tre måter og sjekker at målingen slår ut: en måling som aldri klager beviser ingenting.

**Navn er den ene tingen i en setning som ikke kan brytes ved et mellomrom.** Derfor har overskrifter og avsnitt `overflow-wrap: anywhere` (et langt navn brytes heller enn å gå ut av skjermen), poengtavlens midtkolonne er `minmax(0, 1fr)` slik at et langt navn brytes i stedet for å skyve poengene ut, og lister med en knapp ved siden av navnet (som «Fjern» i vertens ark) lar navnet gi etter mens knappen ikke gjør det.

### Bunnlinjer

To regler (måles av samme verktøy):

1. **Det som er frosset til bunnen av skjermen (`.dock`, `position: sticky`) er skjermens hovedhandling, en knapp**, og har en *ugjennomsiktig* bakgrunn. Ingenting som ruller under skal skinne gjennom tekst eller knapp. (Bakgrunnen er sist i `background`-listen som en vanlig farge. Den gikk en gang tapt på alle vanlige skjermer fordi `--page-bg` pekte på `--theme-bg` uten reserveverdi, og en tom `data-theme` fikk hele deklarasjonen til å bli ugyldig. Derfor har variabelen nå en reserveverdi.) Kanten oppover er en egen fade (`.dock::before`) som ligger over bunnlinjen og ikke er en maske over innholdet. Den har bunnlinjens eget korn og kritt og tones ut med en maske (`--fade-mask`, 2 rem): en flat fargegradient så ut som en glatt stripe med en skjøt mot den teksturerte siden. `test/css.test.js` vokter dette.
2. **Tekst og lenker som ikke trenger å være frosset (venter på verten, «Slik spiller dere») er ikke frosset.** De ligger som `.foot` på slutten av siden, nederst på skjermen når innholdet er kort.

Valg som gjelder deg selv (endre navn eller avatar, vis QR-koden, forlat spillet) ligger bak tannhjulet øverst til høyre i lobbyen (`SettingsSheet`), ikke som løse lenker under spillerlisten.

## Logo

`public/assets/logo/`: `disputt-logo.svg` (mørk brun, hovedlogo), `-cream` (for mørke flater), `-eye` (alternativ med øye i i-prikken). Tegnet opp som konturer av Fraunces med `npm run logo` (fargene står øverst i `tools/logo/build.mjs` og må følge `--ink` og `--cream`). På burgunder brukes den mørke logoen alltid i et gult klistremerke (`.logo-sticker`).

**Ikoner:** faviconen (fanen i nettleseren, `public/favicon.svg` og `assets/icons/favicon-32.png`) er limen fra startsiden i gult i stedet for grønt, laget av tegningen `assets/avatars/lime.svg` med `node tools/logo/favicon.mjs` (grønntonene flyttes mot gult, resten beholdes). Hjemskjermikonene (`assets/icons/apple-touch-icon.png`, `icon-*.png`) og `public/favicon.ico` er samme lime: på burgunder i ikonene, og alene i `favicon.ico` (16, 32 og 48 piksler, for chat- og e-postprogrammer som spør etter `/favicon.ico` først), laget med `node tools/logo/icons.mjs`. Så en lenke som deles, en fane, et bokmerke og hjemskjermen viser samme bilde. Nettlesere husker ikon-filer lenge, så adressene i `index.html` har `?v=…` bakpå: øk tallet når ikonet byttes. **Delingsbildet** (det en lenke til disputt.site viser i chat, e-post og feeder, `og:image`) er `assets/share/disputt-delingsbilde.jpg`, 1200 × 630, laget med `node tools/logo/share.mjs`; logoen og sloganet ligger i de midterste 630 pikslene, for tjenester som beskjærer bildet til en firkant ved siden av tittelen.

**E-posten** (`shopify/ordrebekreftelse.liquid`, ordrebekreftelsen kunden får) har appens farger, men er skrevet som tabeller med stiler på hvert element, fordi e-postprogrammer ikke kan mer: ingen flex, og ingen `rgba()` (de blandede tonene er massive farger, utregnet fra krem og blekk mot burgunder og krem), Georgia i fet kursiv i stedet for Fraunces, og ingen SVG. Derfor er toppen, logoen på den gule ovalen, en PNG (`assets/email/disputt-epost-logo.png`, laget av `tools/logo/email-header.html` med Chrome, oppskriften står i den filen). Runde hjørner, skygger og skråstilling er pynt som Outlook for Windows kan miste; ingenting avhenger av dem. Ren hvit og svart brukes ikke her heller, og en test passer på fargene. Siden 27. oktober ligner den mer på spillet: samme kornete burgunderpapir som bakgrunn, kremfargede papirkort med de skjeve hjørnene, gul kritt-knapp og -piller (alt som bildefliser fra `public/assets/email/bg-*.png`, laget av `tools/logo/email-textures.py`, med flat farge som reserve), et øye på kortet, logoen halvert (170 × 68) og skriftene til spillet der programmet laster nettskrifter (Apple Mail), ellers Georgia.
