# Bakeshop Weather v2.0.0

Production-readiness release for the branch weather monitoring system.

## Included
- Multi-branch weather monitoring and 24-hour rain-risk classification
- Persistent alert history with open/cleared status
- Forecast snapshots and verification metrics
- Reports with CSV export
- Admin user invitation, role management, and account activation/deactivation
- Admin audit-log viewer
- Branch management with exact coordinates
- Open-Meteo forecast source and PAGASA radar link
- Supabase/Postgres persistence and RLS foundation

## Important
Set Supabase environment variables in `.env` for persistent production mode. The frontend source has a local fallback for development. Install dependencies with `npm install`, then use `npm run build` and `npm start` in a normal network-enabled environment.
