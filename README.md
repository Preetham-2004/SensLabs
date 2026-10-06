# SensLab

SensLab helps FPS players find a starting mouse sensitivity for CS2 or VALORANT, then practice with that setting in an original, plain 3D range.

## Run the project

With Docker Desktop running, open PowerShell at the repository root and run:

```powershell
docker compose up --build
```

Open <http://localhost:3000>. The API health endpoint is <http://localhost:8000/health>. Stop the services with `Ctrl+C`.

## Phase 1: get three game settings

1. Choose CS2 or VALORANT.
2. Enter the DPI currently active on your mouse. SensLab cannot read or change hardware DPI. If unknown, check your mouse software or use the three card-length movement estimate under **How do I set or check my DPI?** The estimate measures counts per distance and does not read your sensor configuration.
3. Click **Measure my comfortable swipe**, click inside the 3D range to capture the mouse, move from one comfortable edge of the mousepad to the other, then press `Esc`. SensLab maps that physical swipe to a 180 degree turn.
4. Review lower, middle, and higher game sensitivity values. Pick one to use in Phase 2.
5. Set the displayed DPI in your mouse's software and enter the displayed sensitivity in the selected game yourself.

The sensitivity math uses approximate yaw constants: CS2 `0.022` and VALORANT `0.06996` degrees per mouse count at sensitivity 1. The VALORANT value is often rounded to `0.07`. These community/reference values are not presented as vendor-verified guarantees. See [KovaaK's converter](https://www.kovaak.com/kovaaks/sens-converter) and [Gear Geeks gaming constants](https://geargeeksgaming.com/data/game-sensitivity-constants/). Treat the resulting in-game values as starting estimates and adjust them in-game yourself.

The three options are simple nearby variants of the measured comfortable turn: lower is 12% slower, middle matches the swipe measurement, and higher is 12% faster. SensLab does not automatically choose a winner.

## Phase 2: practice the chosen setting

Phase 2 unlocks after you choose a Phase 1 candidate. Each drill uses that candidate's measured movement scale and displays its game sensitivity and DPI. Try the candidates separately, then compare your own practice results in the page's session history and decide which feels right. Phase 2 does not select a winner for you.

The drills are flick (30 targets), tracking (20 seconds), and precision (20 small targets). Each round has a short countdown. Results include measured metrics and raw mouse samples/click times, held in memory for the current browser page only. No gameplay screens or game memory are read, and SensLab never changes your game input.

Drill settings live in `web/lib/drillConfig.ts`; pure metric calculations and fake-data tests are in `web/lib/metrics/`.

To run metric and sensitivity unit tests while the web container is running, open another PowerShell at the repository root and run:

```powershell
docker compose exec web npm test
```
