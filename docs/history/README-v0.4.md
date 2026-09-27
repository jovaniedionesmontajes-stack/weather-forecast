# Bakeshop Weather v0.4.0

This release adds the first real forecast-performance layer.

## Added
- Branch-level forecast accuracy API
- Rain match rate using a 50% operational threshold
- Mean absolute temperature error (MAE)
- Brier score for probabilistic rain forecasts
- Reports overview by active branch
- Manual snapshot run endpoint
- Scheduled server-side forecast snapshots
- Verification page now reads persisted observations when Supabase is online
- Reports page with branch performance table

## Accuracy matching
For each observation, the API selects the latest forecast run available before the observation and the nearest forecast hour within 90 minutes. This prevents the system from comparing an observation with a forecast that was generated after the event.

Rain classification is operational only:
- Forecast probability >= 50% = predicted rain
- Forecast probability < 50% = predicted no rain

The Brier score preserves the probabilistic quality of the forecast instead of reducing everything to a yes/no match.

## Server environment
Copy `.env.example` to `.env` and set:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- optional `PORT`
- optional `SNAPSHOT_INTERVAL_MINUTES` (default 60; minimum 5)

The service-role key must stay server-side. Never put it in `VITE_*` frontend variables.

## Database
Run `supabase/schema.sql` in Supabase SQL Editor first.

## Run
```bash
npm install
npm run server
```
In another terminal:
```bash
npm run dev
```

The frontend can use `VITE_API_BASE` when the API is hosted separately.

## Important
The package has not been production-built in this environment because the npm registry was unavailable during dependency installation. Source syntax for the Node server was validated with `node --check`.
