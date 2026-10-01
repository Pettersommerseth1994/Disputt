# Fonter

Begge fontene er lisensiert under SIL Open Font License 1.1 (se `OFL-*.txt`) og selvhostet, slik at spillet fungerer uten Google Fonts (f.eks. på et lukket Wi‑Fi).

| Fil | Rolle | Opphav | Endringer |
| --- | --- | --- | --- |
| `fraunces-italic.woff2` | Overskrifter, knapper, tall, logo («Disputt Display») | [Fraunces](https://github.com/undercasetype/Fraunces) © 2018 The Fraunces Project Authors | Instansiert: `SOFT=100`, `WONK=1`; `wght` 600–900 og `opsz` 48–144 beholdt variable; subsettet til latin |
| `lora.woff2`, `lora-italic.woff2` | Brødtekst («Disputt Text») | [Lora](https://github.com/cyrealtype/Lora-Cyrillic) © 2011 The Lora Project Authors | `wght` 400–700 variabel; subsettet til latin; **omdøpt internt til «Disputt Text»** (Lora har Reserved Font Name) |

Gjenskap med `tools/fonts/build.sh` (krever Python `fonttools` + `brotli`).
