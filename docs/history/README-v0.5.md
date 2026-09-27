# Bakeshop Weather v0.5.0

Production-readiness update for the branch weather monitoring system.

## New in v0.5
- Optional Supabase Authentication login screen
- Bearer-token API authentication when `AUTH_REQUIRED=true`
- Role model: `admin`, `manager`, `viewer`
- Manager/admin protection for branch edits, observations and snapshot controls
- Supabase RLS policies for branches, forecasts, observations, profiles and audit logs
- Audit-log table foundation
- Frontend session persistence and sign-out
- Environment variables for Supabase Auth

## Production setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in SQL Editor.
3. Create users under Supabase Authentication > Users.
4. Add a matching row to `public.profiles` and assign `admin`, `manager`, or `viewer`.
5. Copy `.env.example` to `.env` and fill server secrets.
6. Set `AUTH_REQUIRED=true` for production.
7. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the frontend build.
8. Never put `SUPABASE_SERVICE_ROLE_KEY` in frontend variables or source code.

## Role behavior
- admin: full operational access and audit-log read access
- manager: branch/weather/verification write access
- viewer: read-only operational access

The Node server uses the service-role key only on the server side. The browser uses the Supabase anonymous/public key for login and stores only the short-lived access token needed for API authorization.

## Local development
Authentication is disabled when the frontend Supabase variables are absent. This preserves the local prototype workflow. Before deployment, configure Auth and set `AUTH_REQUIRED=true`.
