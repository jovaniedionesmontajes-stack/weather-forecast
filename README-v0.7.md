# Bakeshop Weather v0.7.0

Operational verification and historical forecast audit layer.

## Added
- Historical Weather filters: target date, forecast run, and minimum rain probability.
- Exact forecast audit trail with separate forecast-run and forecast-time timestamps.
- Verification workflow no longer asks staff to manually type forecast temperature/probability.
- Verification modal automatically retrieves the nearest saved forecast from the latest forecast run available before the observation time.
- Actual observation fields: rain yes/no, rain intensity, actual temperature, notes.
- Verification table shows original forecast and automatic rain result when database records are available.
- Brier score shown in the verification panel.
- Responsive filter and verification styling.

## Important behavior
The saved forecast snapshot is the source of truth for "what the system predicted at that time." If no snapshot exists near the selected observation time, the verification screen tells the user to save a snapshot first rather than inventing forecast values.

## Run
```bash
npm install
npm run dev
```

Optional backend:
```bash
npm run server
```

Production deployment still requires installing dependencies in a normal network-enabled environment and configuring Supabase credentials.
