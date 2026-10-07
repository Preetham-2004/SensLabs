# SensLab

SensLab helps FPS players find a starting mouse sensitivity for CS2 or VALORANT, then practice with that setting in an original, plain 3D range.

## Connect SensLab to Supabase

SensLab uses Supabase for account sign-in and player data. The FastAPI service calls Supabase; the browser never receives the private Supabase key.

### 1. Create the SensLab tables

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Select **SQL Editor** in the left menu, then **New query**.
3. Open `supabase/schema.sql` in this repository, copy all of it into the query editor, and click **Run**.
4. Open **Table Editor**. The `public` schema should now list `player_profiles`, `calibrations`, and `practice_rounds`.

This SQL is safe to run again; it creates any missing tables without deleting existing rows.

### 2. Add the Supabase project keys

1. In Supabase, open **Project Settings → API Keys**.
2. Copy the **Project URL** and a **Secret key**. The secret key is private and must only be used by the API.
3. In PowerShell at the repository root, run:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

4. Put the Project URL in `SUPABASE_URL` and the Secret key in `SUPABASE_SECRET_KEY`. Keep `APP_SITE_URL=http://localhost:3000` while developing locally. Never commit or share `.env`.

### 3. Configure email confirmation

Supabase may require email confirmation before a new account can sign in. In **Authentication → URL Configuration**, add `http://localhost:3000/login` to the allowed redirect URLs. After signup, SensLab tells the player to check their email. The new user appears under **Authentication → Users**; account records are not stored in a SensLab `users` table.

Supabase's default email sender is limited to addresses on your Supabase team and a low number of messages per hour. Configure a custom SMTP provider under **Authentication → Emails → SMTP Settings** before inviting other players. Check Supabase Auth logs for delivery errors.

### 4. Start SensLab

From `P:\SensLabs`, run:

```powershell
docker compose up --build
```

Open <http://localhost:3000>. The API health check at <http://localhost:8000/health> verifies that Supabase is reachable and the SensLab tables exist. If it reports missing tables, rerun `supabase/schema.sql` in the Supabase SQL Editor.

Saved player data appears in **Table Editor → public**. Auth accounts appear separately in **Authentication → Users**. The tables have row-level security enabled; the API uses the private Supabase key and checks the signed-in user before handling player data.

## Production deployment

The default `docker-compose.yml` is the development setup with source mounts and Next.js hot reload. For optimized, non-root containers without source mounts, use `docker-compose.prod.yml`:

1. Set `APP_SITE_URL` to the public HTTPS site origin, `API_ALLOWED_ORIGINS` to that exact site origin, and `NEXT_PUBLIC_API_URL` to the public HTTPS API URL in `.env`.
2. Add the production login URL (for example `https://senslab.example/login`) to **Authentication → URL Configuration** in Supabase.
3. Configure custom SMTP, then place the production containers behind an HTTPS reverse proxy. Do not serve the app or API over plain HTTP on the public internet.
4. Build and start the production containers:

   ```powershell
   docker compose -f docker-compose.prod.yml up --build -d
   ```

The production Compose file has container health checks, the web image uses Next.js standalone output, and the API image runs as a non-root user. Configure host backups and monitoring for your Supabase project before inviting real players.

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

The drills are flick (30 targets), tracking (20 seconds), and precision (20 small targets). Each round has a short countdown. Results include measured metrics, the selected setting and drill preferences, and raw mouse samples/click times. Signed-in rounds are stored in Supabase; guest rounds are stored in this browser until account creation. No gameplay screens or game memory are read, and SensLab never changes your game input.

Drill settings live in `web/lib/drillConfig.ts`; pure metric calculations and fake-data tests are in `web/lib/metrics/`.
