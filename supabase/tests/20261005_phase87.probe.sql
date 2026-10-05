-- =============================================================================
-- Phase 87 probe (ADR 0063): the reconciliation files on the live schema.
--
-- Runs inside BEGIN ... ROLLBACK, so nothing it changes survives. It runs
-- each file Phase 87 adds or records on the live project and checks that the
-- schema files change nothing there, and that the history backfill makes the
-- migration history name every file exactly once:
--   1. 20260901_baseline_schema.sql (new; every statement guarded);
--   2. 20261002_phase64_dedupe_categories.sql and
--      20261003_phase73_ai_request_quota.sql, applied in the SQL editor and
--      never recorded: run again, they must change no schema and no row;
--   3. ops/20261005_phase87_record_migration_history.sql, twice.
-- A runner without psql pastes each file in place of its `\ir` line.
--
-- The `alter table ... enable row level security` lines lock each table
-- until the rollback, so run it at a quiet moment; it takes about a second.
--
-- Success is the final row, `PHASE 87 PROBE OK`.
-- =============================================================================

begin;

\ir ../catalog.sql

create temporary table _schema_before on commit drop as
select kind, name, detail from schema_catalog;

create temporary table _rows_before on commit drop as
select (select count(*) from public.categories) as categories,
       (select count(*) from public.categories where is_deleted) as deleted_categories,
       (select md5(coalesce(string_agg(id::text || ':' || coalesce(category_id::text, '-') || ':' || updated_at::text, ',' order by id), ''))
          from public.transactions) as transactions,
       (select md5(coalesce(string_agg(id::text || ':' || category_id::text, ',' order by id), ''))
          from public.keyword_rules) as keyword_rules;

-- -----------------------------------------------------------------------------
-- 1. The baseline: every object already exists, so nothing changes.
-- -----------------------------------------------------------------------------
\ir ../migrations/20260901_baseline_schema.sql

do $baseline$
begin
  assert not exists (select * from _schema_before except select kind, name, detail from schema_catalog),
    '1 the baseline changed or removed an object';
  assert not exists (select kind, name, detail from schema_catalog except select * from _schema_before),
    '1 the baseline added an object';
end;
$baseline$;

-- -----------------------------------------------------------------------------
-- 2. The two files applied outside the tool, run again.
-- -----------------------------------------------------------------------------
\ir ../migrations/20261002_phase64_dedupe_categories.sql
\ir ../migrations/20261003_phase73_ai_request_quota.sql

do $rerun$
begin
  assert not exists (select * from _schema_before except select kind, name, detail from schema_catalog),
    '2 a re-run changed or removed an object';
  assert not exists (select kind, name, detail from schema_catalog except select * from _schema_before),
    '2 a re-run added an object';
  assert (select row(categories, deleted_categories, transactions, keyword_rules) from _rows_before)
       = row((select count(*) from public.categories),
             (select count(*) from public.categories where is_deleted),
             (select md5(coalesce(string_agg(id::text || ':' || coalesce(category_id::text, '-') || ':' || updated_at::text, ',' order by id), ''))
                from public.transactions),
             (select md5(coalesce(string_agg(id::text || ':' || category_id::text, ',' order by id), ''))
                from public.keyword_rules)),
    '2 the Phase 64 cleanup moved a row';
end;
$rerun$;

-- -----------------------------------------------------------------------------
-- 3. The history backfill, twice: every file named once, and nothing more.
-- -----------------------------------------------------------------------------
\ir ../ops/20261005_phase87_record_migration_history.sql
\ir ../ops/20261005_phase87_record_migration_history.sql

do $history$
declare
  expected text[] := array[
    'add_category_description', 'baseline_schema', 'dedupe_categories',
    'ledger_rpcs', 'phase52_security_ledger', 'phase54_zero_starter_seed',
    'phase58b_update_transaction', 'phase58s_profiles_hardening',
    'phase63_identity_colors', 'phase64_dedupe_categories',
    'phase64_seed_starter_account', 'phase73_ai_request_quota', 'transfer_funds'];
begin
  assert (select array_agg(name order by name collate "C") from supabase_migrations.schema_migrations) = expected,
    '3 the history does not name every file exactly once';
  assert (select count(*) from supabase_migrations.schema_migrations
           where created_by like 'phase87 backfill%') = 4,
    '3 the backfill did not add exactly four rows';
end;
$history$;

select 'PHASE 87 PROBE OK' as result;

rollback;
