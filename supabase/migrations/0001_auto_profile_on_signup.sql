-- 0001_auto_profile_on_signup.sql
-- Fixes: schema.sql claimed "profiles are created automatically" but no
-- trigger existed. Without this, every new auth.users row has no matching
-- profiles row, and authenticate() in server/index.js falls back to a
-- viewer-role stub -- fine for login itself, but /api/users and the admin
-- screens will misbehave, and manually-created Supabase Auth users never
-- get a profile at all.
--
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_user boolean;
begin
  -- If this is the very first user ever created, make them admin so
  -- there's at least one account that can invite everyone else.
  select not exists (select 1 from public.profiles) into is_first_user;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case when is_first_user then 'admin' else 'viewer' end,
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: if you already created a user manually before this trigger
-- existed (e.g. via Supabase Dashboard -> Authentication -> Add user),
-- run this once to give them a profile. Uncomment and edit the email:
--
-- insert into public.profiles (id, email, full_name, role, is_active)
-- select id, email, email, 'admin', true
-- from auth.users
-- where email = 'you@yourcompany.com'
-- on conflict (id) do nothing;
