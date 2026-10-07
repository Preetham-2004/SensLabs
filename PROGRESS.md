# SensLab progress

## Current status

- Phase 0 project setup is complete: Next.js + TypeScript web app, FastAPI API, Docker Compose, and this progress log.
- Phase 1 includes the first-person range, pointer lock, cm/360 sensitivity controls, DPI calibration, and sensitivity recommendations for CS2 and VALORANT.
- Phase 2 includes flick, tracking, and precision practice drills with measurements, raw mouse sample capture, results, and session history.
- Accounts now use Supabase Auth. Calibration profiles and practice rounds are saved through the Supabase API to `player_profiles`, `calibrations`, and `practice_rounds`.
- Run `supabase/schema.sql` from the Supabase Dashboard SQL Editor once to create the SensLab tables. Accounts are viewed in **Authentication → Users**; player records are viewed in **Table Editor → public**.
- A production Compose file now builds the web app as a standalone Next.js image and runs the API as a non-root user with health checks. Production still requires a public HTTPS reverse proxy, exact origins/URLs, custom SMTP, and Supabase backups/monitoring.

## Run locally

1. Copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` from the Supabase project settings.
2. Run `docker compose up --build` from the repository root.
3. Open <http://localhost:3000>; API health and Supabase schema connectivity are checked at <http://localhost:8000/health>.

Never commit `.env` or expose the Supabase secret key in browser code.
