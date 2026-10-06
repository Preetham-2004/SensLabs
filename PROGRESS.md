# SensLab Progress

Last updated: 2026-10-06

## Completed

- **Phase 0 — Project setup:** Next.js + TypeScript web app, FastAPI API with `GET /health`, PostgreSQL, and Docker Compose.
- **Phase 1 — Game sensitivity setup:** choose CS2 or VALORANT, enter the active mouse DPI or estimate counts per inch with three card-length swipes, measure a comfortable mousepad swipe as 180 degrees, and receive lower/middle/higher game sensitivity candidates.
- CS2 uses approximate yaw `0.022`; VALORANT uses approximate yaw `0.06996` degrees per count at sensitivity 1. The values are sourced from [KovaaK's converter](https://www.kovaak.com/kovaaks/sens-converter) and cross-checked with [Gear Geeks gaming constants](https://geargeeksgaming.com/data/game-sensitivity-constants/). Treat outputs as starting estimates and adjust settings manually.
- The player explicitly chooses the candidate to practice. SensLab never auto-selects a winner. Players set DPI in their mouse app and game sensitivity in the game themselves. The Phase 1 setup stays on the home page.
- **Phase 2 — Practice drills:** opens at `/practice` as an immersive, viewport-filling range, carrying the chosen game, DPI, sensitivity, and measured movement baseline from Phase 1. Its UI uses muted slate and blue-gray surfaces with restrained teal accents. The range uses an original low-poly handgun and gloved forearm view model. Flick (30 target hits), tracking (20 seconds), precision (20 targets), countdown, measurements, raw mouse samples and click times held only in page memory, and a comparison history labeled with the Phase 1 candidate used. Flick results count every shot, including misses between target hits, and display total shots. Precision targets are about 0.9 degrees across and placed 24 range units away for micro-adjustment practice. Hits add 100 points and misses subtract 100; flick/precision accuracy is hit rate, while tracking accuracy is time on target. Tracking awards or deducts 100 points each second based on whether most samples in that second were on target, and the player can choose slow, medium, or fast target movement speed.
- Phase 2 setup and results now open in a collapsible panel. The default view keeps a compact drill dock with Start and Setup controls so the range stays visible; results open automatically when a round ends.
- Phase 1 setup now uses the same slate, blue-gray, and muted teal visual palette as Phase 2, including the calibration room lighting and lane colors. Calibration steps, controls, and calculations are unchanged.
- Split the Phase 2 implementation into a focused screen component and separate drill model/audio, Three.js scene builder, engine hook, and metric-format modules. The refactor keeps the existing drill flow and measurements.
- All visuals are original plain shapes. No game screens or memory are read; no game inputs are changed.
- Degrees-per-count unit test remains in `web/lib/sensitivity.test.ts`. Drill configurations and metric functions/tests are in `web/lib/drillConfig.ts` and `web/lib/metrics/`.

## Run

At the repository root, run `docker compose up --build`, then open <http://localhost:3000>. Complete Phase 1 and select **Enter the practice range** to open the full-screen Phase 2 page. The API health endpoint is <http://localhost:8000/health>. Run tests with `docker compose exec web npm test` while services are running.

## Next

Pilot preparation and testing with players, when requested.
