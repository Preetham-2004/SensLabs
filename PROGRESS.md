# SensLab Progress

Last updated: 2026-10-06

## Current phase

**Phase 0 — Project setup** is complete.

## Set up so far

- Next.js and TypeScript web scaffold in `web/`.
- FastAPI service in `api/` with `GET /health` returning `{"status":"ok"}`.
- PostgreSQL database and all three services configured in `docker-compose.yml`.
- Local run instructions in `README.md`.
- Docker Compose configuration was validated, and the API source was checked for Python syntax errors.

## Current run instructions

From the repository root, run:

```powershell
docker compose up --build
```

Then check:

- Web: <http://localhost:3000>
- API health: <http://localhost:8000/health>

Stop the services with `Ctrl+C`, then run `docker compose down` if needed.

## Next phase

**Phase 1 — Shooting range core**: mouse look, pointer lock, sensitivity in cm/360, and DPI calibration. Do not start until requested.
