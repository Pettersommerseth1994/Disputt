# Designsystem

Disputt ser ut som en tegning med fargestifter på burgunder papir: flate krittfarger med strek og korn oppå, blobbete former, hard «kritt-kant» i stedet for skygge, og øyne overalt.

**Se det levende:** kjør `npm start` og åpne `/design-system/`. Siden bruker de samme CSS-filene som spillet og leser fargene rett fra tokens.

## Filer

| Fil | Innhold |
| --- | --- |
| `public/css/tokens.css` | Fonter (`@font-face`), farger, typografiskala, rom, former, skygger, bevegelse. **Eneste sted med råverdier.** |
| `public/css/base.css` | Reset, side, overskrifter, skjermskall (`.screen`, `.dock`), animasjoner (`pop`, `rise`, `wobble`, `float`, `pulse`, …). |
| `public/css/components.css` | Knapper, kort, felt, stepper, segmentert valg, avatar, spillerrutenett, avatarvelger, chips, klokke, svaralternativer, fremdriftsstrek, poengtavle, sheet, toast, banner, logo-klistremerke, rollestripe, konfetti. |
| `public/css/screens.css` | Layout og stemning per skjerm, og sidetemaer (`html[data-theme]`). |
| `public/js/ui.js` | JS-komponentene (`Avatar`, `Button`, `Timer`, `Sheet`, `Scoreboard`, `QR`, `HoldToReveal`, …) som bruker klassene over. |
| `public/design-system/` | Stilguide-siden. |
| `shared/avatars.mjs` | Avatar-rosteret (id, navn, aksentfarge). |
| `public/config.js`, `public/js/paths.js` | Distribusjonsinnstillinger og stedsuavhengige stier (alle URL-er er relative, så siden virker både på `/` og under `/Disputt/`). |

## Tokens i korte trekk

**Farger:** burgunder (`--burgundy-950…500`, siden er `700`), kritt (`--yellow --lime --orange --coral --pink --violet --blue --blue-light --teal`), skjermfarger (`--red` imposter, `--blue` lojal, `--lime` riktig, `--pink` feil), papir/blekk (`--cream --ink`). Kritt-fargene er trukket ut av referansetegningene.

**Aldri ren hvit eller svart.** «Hvitt» er en smørkrem (`--cream`, `#f8e6b8`) og «svart» en mørk sjokoladebrun (`--ink`, `#3a2012`): all tekst, logoen, papirkort, kremknapper og QR-koden (brune moduler på kremfarget bunn) bruker dem. Gjennomsiktige varianter lages av kanalene (`rgb(var(--cream-rgb) / .5)`, `--ink-rgb`, og `--shadow-rgb` for de harde kritt-skyggene), så paletten står ett sted. Kremtekst på de røde og blå rolleskjermene skal holde minst 4,5:1 i kontrast, og det er derfor `--red` og `--blue` er så dype som de er. Stilguiden (`/design-system/`) viser kontrasten for alle fargene.

**Typografi:** `--font-display` (Fraunces, tung kursiv, *soft + wonky*) til overskrifter, knapper, tall og navn på store flater; `--font-text` (Lora) til alt annet. Skala: `--fs-hero --fs-h1 --fs-h2 --fs-h3 --fs-lead --fs-body --fs-small --fs-micro`.

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

## Små skjermer

En nettleser sine verktøylinjer tar 150–300 px, så en telefon viser ofte bare ca. 550–660 px høyde, ikke de 844 px skjermen har. Skjermene man skal se på et øyeblikk (rolle, nedtelling, fasit, diskusjon) må derfor få plass uten scrolling, og knappen nederst skal ikke dekke tekst. Illustrasjonene skalerer med synlig høyde (`dvh`, og `height: auto` slik at `<img height>` ikke holder av tom plass), og `screens.css` strammer inn avstander på lave skjermer. `npm run qa:fit` måler det på flere størrelser, også med lengste spørsmål og svar i banken.

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

1. **Det som er frosset til bunnen av skjermen (`.dock`, `position: sticky`) er skjermens hovedhandling, en knapp**, og har en *ugjennomsiktig* bakgrunn. Ingenting som ruller under skal skinne gjennom tekst eller knapp. (Bakgrunnen er sist i `background`-listen som en vanlig farge. Den gikk en gang tapt på alle vanlige skjermer fordi `--page-bg` pekte på `--theme-bg` uten reserveverdi, og en tom `data-theme` fikk hele deklarasjonen til å bli ugyldig. Derfor har variabelen nå en reserveverdi.) Kanten oppover er en egen, myk gradient (`.dock::before`), ikke en maske over innholdet.
2. **Tekst og lenker som ikke trenger å være frosset (venter på verten, «Slik spiller du») er ikke frosset.** De ligger som `.foot` på slutten av siden, nederst på skjermen når innholdet er kort.

Valg som gjelder deg selv (endre navn eller avatar, vis QR-koden, forlat spillet) ligger bak tannhjulet øverst til høyre i lobbyen (`SettingsSheet`), ikke som løse lenker under spillerlisten.

## Logo

`public/assets/logo/`: `disputt-logo.svg` (mørk brun, hovedlogo), `-cream` (for mørke flater), `-eye` (alternativ med øye i i-prikken). Tegnet opp som konturer av Fraunces med `npm run logo` (fargene står øverst i `tools/logo/build.mjs` og må følge `--ink` og `--cream`). På burgunder brukes den mørke logoen alltid i et gult klistremerke (`.logo-sticker`).
