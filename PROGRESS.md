# SensLab Progress

Last updated: 2026-10-06

## Completed

- **Phase 0 — Project setup:** Next.js + TypeScript web app, FastAPI API with `GET /health`, PostgreSQL, and Docker Compose.
- **Phase 1 — Game sensitivity setup:** choose CS2 or VALORANT, enter the active mouse DPI or estimate counts per inch with three card-length swipes, measure a comfortable mousepad swipe as 180 degrees, and receive lower/middle/higher game sensitivity candidates.
- CS2 uses approximate yaw `0.022`; VALORANT uses approximate yaw `0.06996` degrees per count at sensitivity 1. The values are sourced from [KovaaK's converter](https://www.kovaak.com/kovaaks/sens-converter) and cross-checked with [Gear Geeks gaming constants](https://geargeeksgaming.com/data/game-sensitivity-constants/). Treat outputs as starting estimates and adjust settings manually.
- The player explicitly chooses the candidate to practice. SensLab never auto-selects a winner. Players set DPI in their mouse app and game sensitivity in the game themselves.
- **Phase 2 — Practice drills:** flick (30 targets), tracking (20 seconds), precision (20 small targets), countdown, measurements, raw mouse samples and click times held only in page memory, and a comparison history labeled with the Phase 1 candidate used.
- All visuals are original plain shapes. No game screens or memory are read; no game inputs are changed.
- Degrees-per-count unit test remains in `web/lib/sensitivity.test.ts`. Drill configurations and metric functions/tests are in `web/lib/drillConfig.ts` and `web/lib/metrics/`.

## Run

At the repository root, run `docker compose up --build`, then open <http://localhost:3000>. The API health endpoint is <http://localhost:8000/health>. Run tests with `docker compose exec web npm test` while services are running.

## Next

Pilot preparation and testing with players, when requested.
