-- =============================================================================
-- Phase 90 (ADR 0066): schema_drift_reader, the login the scheduled drift check
-- (.github/workflows/schema-drift.yml) connects as. Not a migration: a role
-- belongs to the cluster, not to the schema the migrations build, and nothing
-- here appears in supabase/catalog.sql, so the drift check does not see it.
--
-- What it can do, and nothing more:
--   - read the system catalogs (pg_catalog, information_schema), which every
--     role can read in PostgreSQL;
--   - look up names in the public and extensions schemas (USAGE). Without it
--     PostgreSQL skips those schemas in the search path and prints
--     `extensions.uuid_generate_v4()` and `public.categories(id)` where the
--     catalog expects the short names, which the check would report as drift.
--     USAGE on a schema reads no row of any table in it;
--   - read supabase_migrations.schema_migrations, the history.
--
-- What it cannot do: read or write a row of any app table (no grant on any
-- table in public; row-level security would answer it with nothing anyway),
-- write anything at all (every transaction is read-only by default, and the
-- runner opens its own as `read only` too), bypass row-level security, create
-- objects, roles or databases, or run a statement past 30 s. It holds two
-- connections at most.
--
-- It is created with no password, so it cannot log in yet. The owner sets one
-- in the SQL editor, never in this file or the repo:
--
--   alter role schema_drift_reader with password '<a long random password>';
--
-- then builds the connection string from the dashboard's Session pooler string
-- (Connect > Session pooler), with the user `schema_drift_reader.<project ref>`
-- and that password, URL-encoded, and stores it as the repository secret
-- SUPABASE_DRIFT_DB_URL. GitHub's runners reach the pooler over IPv4; the
-- direct host is IPv6 only.
--
-- Idempotent: run it again and it changes nothing. To remove the role:
--   revoke all on supabase_migrations.schema_migrations from schema_drift_reader;
--   revoke usage on schema supabase_migrations, public, extensions from schema_drift_reader;
--   drop role schema_drift_reader;
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'schema_drift_reader') then
    create role schema_drift_reader with
      login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls
      connection limit 2;
  end if;
end
$$;

-- Read-only and short-lived by default, whatever the client asks for.
alter role schema_drift_reader set default_transaction_read_only = on;
alter role schema_drift_reader set statement_timeout = '30s';
alter role schema_drift_reader set idle_in_transaction_session_timeout = '60s';

-- Name lookup only: no table, view, sequence or function in these schemas.
grant usage on schema public, extensions to schema_drift_reader;

-- The migration history, read only.
grant usage on schema supabase_migrations to schema_drift_reader;
grant select on supabase_migrations.schema_migrations to schema_drift_reader;
