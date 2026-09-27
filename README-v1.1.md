# Bakeshop Weather v1.1.0

## Added
- Persistent weather alert history in Supabase (`weather_alerts`)
- Open / Cleared alert status
- Watch (50–79%) and High (80%+) severity
- Alert History page with status and severity filters
- Refresh & check alerts action
- Branch drill-down from alert history
- Automatic clearing of alerts that are no longer present during a refresh

## Database
Run the updated `supabase/schema.sql` in Supabase. It creates the `weather_alerts` table, indexes, and RLS policies.

## Validation
- `node --check server/index.js` passes.
- Frontend production build was not run in this workspace because dependencies are not installed and registry access is unavailable here.
