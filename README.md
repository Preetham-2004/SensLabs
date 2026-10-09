# SensLab

<table>
  <tr>
    <td bgcolor="#f1f4f6">
      <img src="web/public/senslab-wordmark.png" alt="SensLab logo" width="120" />
    </td>
  </tr>
</table>

## Project details

SensLab is a sensitivity calibration and aim-practice tool for **VALORANT** and **Counter-Strike 2**. It measures a player's mouse movement to suggest a practical starting sensitivity, then lets them try it in a browser-based practice range.

## Features

- Calibrate sensitivity from mouse DPI and comfortable mousepad swipes.
- Compare lower, recommended, and higher sensitivity options.
- Practice with flick, tracking, and precision drills in a 3D range.
- Customize the practice crosshair and review round metrics.
- Sign in to save calibration results and practice history.

## Tech stack

- **Frontend:** Next.js 15, React 19, TypeScript, CSS Modules
- **Animation:** Motion
- **3D:** Three.js
- **API:** Python, FastAPI, Uvicorn
- **Authentication and database:** Supabase Auth and PostgreSQL
- **Testing:** Vitest

## Production setup

Before deploying an update:

1. Run `supabase/migrations/20261008_auth_rate_limit.sql` in the Supabase SQL Editor. For a new project, run `supabase/schema.sql` instead.
2. SensLab creates accounts as confirmed and signs users in right away. No email verification step is used.
3. Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`, and `API_ALLOWED_ORIGINS` in the backend host. Keep the secret key on the backend only. The allowed origin must exactly match the website origin.
4. For Netlify, set `API_ORIGIN` to the backend's public HTTPS origin and `SENSLAB_DEPLOY_TARGET=netlify` in the site's build environment. The website proxies API calls through its own origin so the browser can keep the login cookie HttpOnly. Netlify uses its Next.js adapter; Docker builds keep standalone output.
5. Set `FORWARDED_ALLOW_IPS` on the backend only to the trusted proxy addresses or CIDRs documented by the backend host. This lets the shared login throttle use the user's real client address. Do not set it to `*` on a public API.

Login sessions use short-lived HttpOnly cookies. The API checks request origins on write requests, and login attempt counters are shared through Supabase so multiple API workers use the same limits.
