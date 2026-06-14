# 🍻 Bytur Taskmaster

En simpel webapp, der kører et "taskmaster"-agtigt spil til en bytur/pub crawl med to hold.

Den har to faser:

1. **Quiz (måneder før)** — hver deltager åbner appen, vælger sit navn og svarer på en række personlige spørgsmål. Svarene holdes skjulte.
2. **Live-tur** — på hvert stop får det ene hold vist det *andet* holds anonymiserede svar på et spørgsmål og skal **matche hvert svar med den person, der skrev det**. Korrekte match giver point. Deltagerne får også **hemmelige opgaver**, de skal udføre i løbet af aftenen for bonuspoint.

Hele spillet køres fra **én delt "taskmaster"-enhed** — ingen logins, ingen real-time-synkronisering.

## Teknologi

- [SvelteKit](https://svelte.dev/) (Svelte 5) som en **statisk SPA** (`adapter-static`) — bygger til almindelige filer, du kan lægge på en hvilken som helst gratis host (GitHub Pages, Netlify, Cloudflare Pages …), og den kører helt offline på enheden på turen.
- Al tilstand ligger i **ét objekt**, der gemmes i `localStorage`, bag en lille storage-abstraktion (`src/lib/storage.ts`), så den senere kan skiftes ud med en rigtig backend uden at røre UI'et.

## Udvikling

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output til ./build
npm run preview  # server produktionsbygget lokalt
npm run check    # typetjek
```

## Projektstruktur

```
src/
  lib/
    types.ts        # datamodel (GameState m.fl.)
    config.ts       # appnavn + point-knapper
    mockData.ts     # start-hold/deltagere/spørgsmål/opgaver
    storage.ts      # storage-abstraktion (localStorage i dag)
    stores.ts       # det ene game-store + handlinger + stilling
    game.ts         # ren logik: bland + pointgivning
    components/     # TeamBadge, Scoreboard
  routes/
    +page.svelte    # forside + stilling
    quiz/           # indtast svar
    game/           # live matche-runder
    tasks/          # kryds hemmelige opgaver af
    setup/          # rediger alt, eksportér/importér, nulstil
```

## Justering af spillet

- **Pointgivning** — rediger `src/lib/config.ts` (`pointsPerCorrectMatch`, `perfectRoundBonus`).
- **Hold / deltagere / spørgsmål / opgaver** — rediger dem live i **Opsætning**-skærmen, eller ret startdata i `src/lib/mockData.ts`. Opsætning kan også **eksportere/importere** hele spillet som JSON (praktisk til at flytte data mellem enheder, indtil storage er sat op).

## Storage / backend (Supabase)

Appen kan køre på en gratis **Supabase**-backend (Postgres + login), så vennerne
kan bruge den fra deres egne telefoner på et rigtigt domæne. Uden miljøvariabler
kører appen videre på `localStorage` (offline) — den skifter automatisk til
Supabase, når `PUBLIC_SUPABASE_URL` og `PUBLIC_SUPABASE_ANON_KEY` er sat.

Se **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** for trin-for-trin opsætning
(opret projekt, kør `supabase/schema.sql`, deploy til Cloudflare Pages, hold-i-live cron).

Kort om datalaget: [src/lib/db/repo.ts](src/lib/db/repo.ts) håndterer CRUD mod
Supabase, og [src/lib/stores.ts](src/lib/stores.ts) kalder det ved hver ændring.
Vil du bruge en helt anden backend, kan du erstatte `repo.ts` bag samme interface.
