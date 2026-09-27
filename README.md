# Bakeshop Weather — UI Build 0.1.0

This is the first working build of the branch weather-monitoring application.

## Included now
- Professional responsive dashboard matching the approved UI direction
- Branch selector
- Branch management with editable latitude/longitude
- Live coordinate-based weather via Open-Meteo
- Current weather metrics
- Hourly forecast
- 7-day forecast
- Weather forecast detail table
- Historical weather screen with demo rows
- Forecast verification screen with demo rows
- Settings screen
- Mobile navigation
- LocalStorage for branch settings during this prototype stage
- Supabase production schema prepared in `supabase/schema.sql`

## Run

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Important
The sample branch coordinates are placeholders for the UI prototype. Replace them with the exact latitude/longitude of the real bakeshop branches before production use.

The historical and verification screens currently contain demo records. The next production stage is to connect Supabase and store forecast snapshots + branch observations.

## Production data model
- `branches`: exact branch location and timezone
- `weather_forecasts`: the forecast as it existed at each forecast run
- `weather_observations`: what the branch actually reported

The `forecast_run_time` field is intentionally separate from `forecast_time`. This allows the system to answer questions such as: "What did the system predict for Matina at 1 PM when the forecast was fetched at 8 AM?"


## v0.2.0 changes
- Added professional branch add/edit modal instead of browser prompts.
- Added branch coordinate validation.
- Added real local forecast verification entry form.
- Added per-branch verification match-rate calculation.
- Added automatic 15-minute weather refresh.
- Kept Supabase schema ready for persistent production data.
