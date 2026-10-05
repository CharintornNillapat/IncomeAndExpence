-- =============================================================================
-- Phase 87 (ADR 0063): record in the live project's migration history the
-- four files whose changes are already in its schema but were never applied
-- through the migration tool. Not a migration: it changes no schema and no
-- app data, only supabase_migrations.schema_migrations.
--
--   20260901_baseline_schema.sql       the schema built in the dashboard
--                                      before the first migration (Phase 87)
--   20260909_transfer_funds.sql        applied in the SQL editor (2026-09-09)
--   20261002_phase64_dedupe_categories run in the SQL editor (2026-10-02),
--                                      removing the copies outright (ADR 0039)
--   20261003_phase73_ai_request_quota  applied in the SQL editor (2026-10-03)
--
-- The history is matched to the files by name (the file name without its
-- date), because its versions are the times each migration ran, not the
-- files' dates. A backfilled row's version is its file's date at 00:00:00,
-- since the real time is unknown, and created_by marks it as backfilled.
-- statements stays null: none of these ran through the tool.
--
-- Idempotent: a name or version already recorded is skipped, so a second run
-- inserts nothing. Run it only after `node scripts/schema-drift.mjs` shows
-- these four names as the only drift, so the history then matches the files
-- exactly.
-- =============================================================================

insert into supabase_migrations.schema_migrations (version, name, created_by)
select v.version, v.name, 'phase87 backfill: applied outside the migration tool'
  from (values
    ('20260901000000', 'baseline_schema'),
    ('20260909000000', 'transfer_funds'),
    ('20261002000000', 'phase64_dedupe_categories'),
    ('20261003000000', 'phase73_ai_request_quota')
  ) as v(version, name)
 where not exists (select 1 from supabase_migrations.schema_migrations m where m.name = v.name)
   and not exists (select 1 from supabase_migrations.schema_migrations m where m.version = v.version);
