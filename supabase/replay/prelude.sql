-- =============================================================================
-- Phase 87 (ADR 0063): the parts of a Supabase project that this repo's
-- migrations assume but never create, for replaying them into an empty
-- PostgreSQL (PGlite, in scripts/lib/migrationReplay.mjs). It stands in for
-- the platform, not for any table the app owns: those come from the
-- migrations alone, starting with 20260901_baseline_schema.sql.
--
-- Copied from the live project (2026-10-05) where the migrations can see it:
--   - the four roles the grants name;
--   - "$user", public, extensions as the search path, which decides how
--     PostgreSQL prints a default, a foreign key or a policy;
--   - the default privileges postgres holds in public: every new table,
--     sequence and function is granted to anon, authenticated and
--     service_role, which is why each migration revokes explicitly;
--   - auth.users and auth.sessions with the columns the functions and
--     triggers read, at the live types (list_my_sessions is a SQL function,
--     so its body is checked against them when it is created);
--   - auth.uid() and auth.jwt(), reading the request's claims as Supabase's
--     do;
--   - the empty supabase_realtime publication.
-- Never run this against a Supabase project.
-- =============================================================================

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role supabase_auth_admin nologin;

create schema extensions;
create schema auth;

set search_path to "$user", public, extensions;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create table auth.users (
  id                 uuid primary key,
  email              character varying(255),
  aud                character varying(255),
  role               character varying(255),
  raw_user_meta_data jsonb,
  created_at         timestamptz,
  updated_at         timestamptz
);

create table auth.sessions (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz,
  updated_at   timestamptz,
  refreshed_at timestamp without time zone,
  not_after    timestamptz,
  user_agent   text,
  ip           inet
);

create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

create publication supabase_realtime;
