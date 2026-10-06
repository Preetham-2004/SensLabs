# SensLab

SensLab is a visual sensitivity and settings advisor for FPS players. This repository contains the initial project scaffold only: a Next.js web app, a FastAPI API, and a PostgreSQL database running with Docker Compose.

## Prerequisites

- Docker Desktop with Docker Compose v2
- Git (optional, for version control)

## Run the project

1. Open a terminal in the repository root (the directory containing `docker-compose.yml`).
2. Build the app images and start all services:

   ```sh
   docker compose up --build
   ```

3. Open the web scaffold at <http://localhost:3000>.
4. Check the API health endpoint at <http://localhost:8000/health>. It should return:

   ```json
   {"status":"ok"}
   ```

   The interactive API docs are at <http://localhost:8000/docs>.
5. Stop the services with `Ctrl+C`, then run:

   ```sh
   docker compose down
   ```

PostgreSQL is available on `localhost:5432` with the development database `senslab`, user `senslab`, and password `senslab_dev`. These local credentials are for development only.

To also remove the database's persisted Docker volume and its data, run `docker compose down -v`.
