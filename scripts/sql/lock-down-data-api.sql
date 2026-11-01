-- Close the Supabase Data API (PostgREST / pg_graphql) path to the app's tables.
--
-- The tables live in `public` (Payload created them there, before it was
-- removed), the schema Supabase's Data API exposes, and Supabase's default
-- privileges grant `anon` and `authenticated` full access to every new table
-- there. With row-level security off, anyone holding the project's publishable
-- (anon) key — a key Supabase treats as public — could read and write
-- `invite_requests` (applicants' personal data, CLAUDE.md DB5) and the leftover
-- `users` table (the old admin's password hash).
--
-- Nothing in this app uses the Data API: the invite action talks to Postgres
-- directly as `postgres`, which has BYPASSRLS, and uploads go through the
-- Storage API with the secret key. So both layers below are invisible to the site.
--
-- Idempotent. Re-run after creating any table (CLAUDE.md SEC6): a new table
-- picks up the RLS-off defaults.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/lock-down-data-api.sql

begin;

-- Layer 1: RLS on, no policies → anon/authenticated see and change nothing.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Layer 2: take the grants away too, so a table whose RLS is later turned off
-- still exposes nothing.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- And stop future tables created by `postgres` (any SQL run with DATABASE_URL)
-- from getting them in the first place.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

commit;
