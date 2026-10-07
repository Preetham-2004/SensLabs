# SensLab

SensLab is a sensitivity calibration and practice platform for players of **Counter-Strike 2** and **VALORANT**. It helps players turn their mouse movement into a practical starting sensitivity, then try that setting in a browser-based training range.

## Features

- Choose CS2 or VALORANT and enter the DPI set in your mouse software.
- Estimate DPI if you do not know it.
- Measure a comfortable mouse swipe and use it to calculate a lower, middle, and higher in-game sensitivity.
- Practice the selected setting in a 3D range with flick, tracking, and precision drills.
- Review round metrics such as hit rate, time to hit, accuracy, and movement estimates.
- Create an account and save calibration and practice history to Supabase.
- Customize the practice crosshair and compare settings through your own results.

SensLab provides a **starting point**, not a guaranteed perfect sensitivity. It cannot read or change your mouse hardware or game settings; enter the suggested DPI and sensitivity in your own mouse software and game.

## Tech stack

- **Frontend:** Next.js 15, React 19, TypeScript, CSS Modules
- **3D training range:** Three.js
- **Backend API:** Python, FastAPI, Uvicorn
- **Authentication and database:** Supabase Auth and Supabase Postgres
- **Development and local services:** Docker Compose
- **Unit tests:** Vitest

## Run locally

1. Install Docker Desktop and start it.
2. Copy `.env.example` to `.env` and add your Supabase project URL and secret key.
3. In Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql) to create the required tables and policies.
4. From the repository root, start the app:

   ```powershell
   docker compose up --build
   ```

5. Open [http://localhost:3000](http://localhost:3000). The API health endpoint is [http://localhost:8000/health](http://localhost:8000/health).

Run the frontend unit tests from the `web` directory:

```powershell
npm test
```

## Project structure

```text
api/                 FastAPI endpoints and Supabase integration
web/app/             Next.js pages and user interface
web/lib/             Sensitivity calculations, drill metrics, and data helpers
supabase/schema.sql  Database tables and access policies
```
