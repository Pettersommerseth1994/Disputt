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

## Tokens i korte trekk

**Farger:** burgunder (`--burgundy-950…500`, siden er `700`), kritt (`--yellow --lime --orange --coral --pink --violet --blue --blue-light --teal`), skjermfarger (`--red` imposter, `--blue` lojal, `--lime` riktig, `--pink` feil), papir/blekk (`--cream --ink`). Kritt-fargene er trukket ut av referansetegningene.

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

## Logo

`public/assets/logo/`: `disputt-logo.svg` (svart, hovedlogo), `-cream` (for mørke flater), `-eye` (alternativ med øye i i-prikken). Tegnet opp som konturer av Fraunces med `npm run logo`. På burgunder brukes den svarte logoen alltid i et gult klistremerke (`.logo-sticker`).
