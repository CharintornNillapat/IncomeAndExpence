-- =============================================================================
-- Phase 87 (ADR 0063): what the app's database is made of, one row per
-- object, as (kind, name, detail). The same query runs on a database built
-- from supabase/migrations/ (scripts/schema-drift.mjs replays them into
-- PGlite) and on the live project, and any row that differs is drift.
--
-- It creates a temporary view, schema_catalog, which lasts until the session
-- ends and changes nothing else.
--
-- Covered, in schema public: tables and their row-level security flags,
-- columns (type, not null, default), constraints, indexes, policies,
-- functions (signature, result, language, volatility, security definer,
-- settings, and an md5 of the body with carriage returns removed), which of
-- anon, authenticated, service_role and supabase_auth_admin may run each
-- function, what anon, authenticated and service_role may do with each table,
-- triggers on public tables and triggers anywhere that call a public
-- function, the supabase_realtime publication's public tables, and the
-- uuid-ossp extension. Not covered: comments, column-level grants, and
-- anything the platform owns (the auth, storage and realtime schemas).
--
-- The search path decides how PostgreSQL prints a default, a foreign key or
-- a policy, so it is set to the live project's own.
-- =============================================================================

set search_path to "$user", public, extensions;

create or replace temporary view schema_catalog as
select 'table'::text as kind,
       c.relname::text as name,
       'rls ' || c.relrowsecurity || ', forced ' || c.relforcerowsecurity as detail
  from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm')

union all
select 'column',
       c.relname || '.' || a.attname,
       format_type(a.atttypid, a.atttypmod)
         || case when a.attnotnull then ' not null' else '' end
         || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
 where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
   and a.attnum > 0 and not a.attisdropped

union all
select 'constraint', conrelid::regclass::text || '.' || conname, pg_get_constraintdef(oid)
  from pg_constraint
 where connamespace = 'public'::regnamespace and contype <> 'n'

union all
select 'index', indexname, indexdef
  from pg_indexes
 where schemaname = 'public'

union all
select 'policy',
       tablename || '.' || policyname,
       permissive || ' ' || cmd
         || ' to ' || array_to_string(array(select r from unnest(roles) r order by 1), ',')
         || ' using ' || coalesce(qual, '-')
         || ' check ' || coalesce(with_check, '-')
  from pg_policies
 where schemaname = 'public'

union all
select 'function',
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       'returns ' || pg_get_function_result(p.oid)
         || ' language ' || l.lanname
         || ' volatility ' || p.provolatile::text
         || case when p.prosecdef then ' security definer' else '' end
         || coalesce(' set ' || array_to_string(p.proconfig, ','), '')
         || ' body ' || md5(replace(p.prosrc, chr(13), ''))
  from pg_proc p
  join pg_language l on l.oid = p.prolang
 where p.pronamespace = 'public'::regnamespace

union all
select 'function grant',
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') to ' || r.rolname,
       case when has_function_privilege(r.rolname, p.oid, 'EXECUTE') then 'execute' else 'none' end
  from pg_proc p
 cross join (values ('anon'), ('authenticated'), ('service_role'), ('supabase_auth_admin')) as r(rolname)
 where p.pronamespace = 'public'::regnamespace

union all
select 'table grant',
       c.relname || ' to ' || r.rolname,
       coalesce(nullif(array_to_string(array(
         select x from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) x
          where has_table_privilege(r.rolname, c.oid, x)), ','), ''), 'none')
  from pg_class c
 cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
 where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm')

union all
select 'trigger', t.tgrelid::regclass::text || '.' || t.tgname, pg_get_triggerdef(t.oid)
  from pg_trigger t
 where not t.tgisinternal
   and (t.tgrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace)
        or t.tgfoid in (select oid from pg_proc where pronamespace = 'public'::regnamespace))

union all
select 'publication', pubname || ' ' || schemaname || '.' || tablename, ''
  from pg_publication_tables
 where schemaname = 'public'

union all
select 'extension', extname, extnamespace::regnamespace::text
  from pg_extension
 where extname = 'uuid-ossp';
