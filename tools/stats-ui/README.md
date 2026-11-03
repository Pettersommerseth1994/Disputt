# Statistikksiden (`/stats/`)

Kildekoden til eierens side med tall, bygd med [shadcn/ui](https://ui.shadcn.com) (React, Tailwind, Base UI og Recharts). Resten av Disputt bygges uten byggesteg; denne siden er derfor et eget lite prosjekt, og **resultatet er sjekket inn** i `public/stats/`.

```bash
npm run stats:build        # fra prosjektroten: installerer og bygger inn i public/stats/
```

- `src/App.tsx`: siden (innlogging, kort, graf, tabeller). `src/api.ts`: kallet til betalingstjenesten (`GET /stats`); adressen leses fra sidens egen `/config.js`.
- `src/components/ui/`: shadcn-komponentene (lagt til med `npx shadcn@latest add …`).
- Regnestykkene kommer fra `public/js/stats-math.js` (samme fil som testene bruker).
- Endrer du noe her, må du bygge på nytt og sjekke inn `public/stats/` sammen med endringen. Hva siden viser og hvordan tallene telles: `docs/STATS.md`.
