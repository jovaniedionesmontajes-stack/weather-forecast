# Bakeshop Weather v1.0.0

## New in v1.0
- Alert Center for active branches
- High Risk alerts for peak precipitation probability of 80%+
- Rain Watch alerts for peak precipitation probability of 50–79%
- Open alert count and severity counts
- Per-branch peak probability, peak time, current temperature, and current rain probability
- Up to three rain-risk windows per branch
- One-click branch navigation from an alert
- Refreshable alert data using the same exact-coordinate Open-Meteo forecast source used by monitoring
- Local-mode fallback remains available when the backend/database is unavailable

## Existing capabilities retained
- Branch monitoring overview
- 24-hour rain-risk timeline
- Historical forecast snapshots and verification
- Forecast accuracy reports
- Exact branch latitude/longitude onboarding
- Supabase authentication foundation and role-based API protection
- PAGASA radar link for official rainfall/radar monitoring

## Run

```bash
npm install
npm run dev
```

For the backend:

```bash
npm run server
```

Configure `.env` using `.env.example` when Supabase is enabled.

## Validation note

The Node.js backend syntax was checked in the build workspace. A full Vite production build was not run here because dependencies are not installed in the workspace and external npm installation is network-limited.
