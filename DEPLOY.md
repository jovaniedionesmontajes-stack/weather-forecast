# Deploying to Vercel (frontend + backend, one project)

Root cause recap: login never worked because (1) no account could ever be
created through the UI, and (2) the backend API was never actually deployed
anywhere reachable by the frontend. This setup fixes both, using a single
Vercel project for everything.

## How it fits together
- `index.html` + `src/` → built by Vite, served as your static site.
- `server/app.js` → the Express app (all routes), with no `app.listen()`.
- `api/index.js` → wraps that Express app as a Vercel serverless function.
- `vercel.json` → rewrites every `/api/*` request to that one function, and
  schedules the daily snapshot cron.
- `server/index.js` → only used for local dev (`npm run server`); Vercel
  ignores it and uses `api/index.js` instead.

Because frontend and API now share one domain, `VITE_API_BASE` stays empty
and there's no CORS to configure for normal browser use.

## 1. Run the Supabase migration
Supabase Dashboard → SQL Editor → New query → paste
`supabase/migrations/0001_auto_profile_on_signup.sql` → Run.
This makes every new signup automatically get a `profiles` row, and makes
the first-ever user an admin.

## 2. Push these changes and import the repo into Vercel
Vercel → Add New → Project → import this GitHub repo. Framework preset
should auto-detect as **Vite** — leave build command as `vite build`,
output directory `dist`.

## 3. Set environment variables (Project → Settings → Environment Variables)
Add all of these to the **same** project — no second deployment needed:

| Variable | Value | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | your Supabase project URL | Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | your Supabase anon key | same page, public key |
| `VITE_API_BASE` | *(leave empty)* | same-origin, no separate host |
| `SUPABASE_URL` | same Supabase project URL | used server-side only |
| `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service_role key | **never** prefix with `VITE_` |
| `AUTH_REQUIRED` | `true` | enforces login on the API |
| `CRON_SECRET` | random 32+ char string | `openssl rand -base64 32` |

Redeploy after adding these — Vite bakes `VITE_*` vars in at build time.

## 4. Create your first account
Supabase Dashboard → Authentication → Users → Add user → set email +
password directly (there's no signup form in the app). The trigger from
step 1 makes them admin automatically since they're the first user.

## 5. About the snapshot cron
`vercel.json` schedules `/api/cron/snapshots` to run once a day
(`0 0 * * *` = midnight UTC). **This is a Vercel Hobby-plan limit** — Hobby
only allows daily cron, not hourly/every-15-minutes. Options:
- Leave it daily — fine if you mainly need forecast history for accuracy
  tracking, not real-time snapshots (the dashboard's live weather still
  refreshes from Open-Meteo directly in the browser regardless of this cron).
- Use the **"Run Snapshot Now"** button in the Reports page for on-demand runs.
- Upgrade to Vercel Pro for per-minute cron schedules.
- Or point a free external scheduler (e.g. cron-job.org) at
  `https://your-app.vercel.app/api/cron/snapshots` every 15–60 minutes, with
  header `Authorization: Bearer <your CRON_SECRET>` — the endpoint doesn't
  care whether Vercel or an external service calls it.

## 6. Test
Visit your Vercel URL → you should see the real Sign In screen → log in
with the account from step 4. Use the Users page afterward to invite
everyone else.

## Ongoing: future schema changes
Add new files as `supabase/migrations/000N_description.sql`, run in order,
instead of hand-editing `supabase/schema.sql`.
