-- Close the Supabase Data API (PostgREST / pg_graphql) path to Payload's tables.
--
-- Payload creates its tables in `public`, the schema Supabase's Data API
-- exposes, and Supabase's default privileges grant `anon` and `authenticated`
-- full access to every new table there. With row-level security off, anyone
-- holding the project's publishable (anon) key — a key Supabase treats as
-- public — could read `users` (password hashes and salts), `users_sessions` and
-- `invite_requests` (applicants' personal data, CLAUDE.md DB5), and INSERT a
-- row into `users`, i.e. create their own admin.
--
-- Nothing in this app uses the Data API: Payload talks to Postgres directly as
-- `postgres`, which has BYPASSRLS, and uploads go through the Storage API with
-- the secret key. So both layers below are invisible to the site and the admin.
--
-- Idempotent. Re-run after any schema push (`pnpm dev`, CLAUDE.md D1/SEC6):
-- a push can recreate tables, and new tables would pick up RLS-off defaults.
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

-- Layer 2: take the grants away too, so a push that flips RLS back off still
-- exposes nothing. Drizzle push manages tables, not grants.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- And stop future tables created by `postgres` (i.e. by Payload) from getting
-- them in the first place.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

commit;
