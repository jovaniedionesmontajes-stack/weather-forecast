# Bakeshop Weather v0.4.0

This version adds a production-oriented API layer for persistent branch data, forecast snapshots, and branch weather observations.

## 1. Frontend

```bash
npm install
npm run dev
```

## 2. Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in SQL Editor.
3. Copy `.env.example` to `.env`.
4. Put the project URL and **server-only** service role key in `.env`.

Never put `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_*` variable or browser code.

## 3. API

```bash
npm run server
```

Health check:
`GET /api/health`

The API can:
- list/create/update/delete branches
- fetch a branch forecast
- save a complete forecast snapshot with its forecast run time
- retrieve forecast history
- save branch weather observations
- retrieve observations

## Forecast history design

`forecast_run_time` = when the system obtained the forecast.

`forecast_time` = the future hour that the forecast was predicting.

Keeping both is essential for later forecast verification. For example, the system can compare the 10:00 AM forecast made at 10:00 AM with the branch observation at 1:00 PM.
