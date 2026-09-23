-- =============================================================================
-- Adds the optional per-category description that feeds Jev's choice criteria.
--
-- Phase 40 / ADR 0012. Phase 39 shipped classification sending Jev bare
-- category names as each option's criteria, which is the weakest signal the
-- Choice primitive accepts: "Netflix subscription" classified as the "other"
-- escape option at 0.93 confidence against the default set, because no default
-- category is NAMED anything like a subscription bucket. A short description
-- per category ("Rent, electricity, water, internet ... Netflix or Spotify")
-- is what the ADR 0011 probes that scored 1.00 actually had, and what
-- production did not.
--
-- This column is the storage half of that. The client sends it as
-- ClassifyCandidate.description; api/classify.ts formats each option as
-- "<name>: <description>".
--
-- Assumed existing schema (this repo has no schema file; these are the columns
-- the client already reads and writes):
--   categories(id uuid pk, user_id uuid, name text, type text, icon text,
--              color text, is_system bool, is_deleted bool,
--              created_at timestamptz)
--
-- Safety:
--   - Purely additive and nullable, with no default, so it rewrites no rows and
--     takes only a brief ACCESS EXCLUSIVE lock for the catalog update.
--   - Idempotent via IF NOT EXISTS.
--   - No RLS change: the existing per-user policies on public.categories cover
--     every column of the row, this one included.
--   - No index. The column is never filtered or joined on; it is read as part
--     of the same select * the client already issues.
--
-- ORDERING MATTERS. Apply this BEFORE deploying the client build that writes
-- the column. addCategory/updateCategory send description in their PostgREST
-- payloads, and PostgREST rejects an unknown column outright (PGRST204,
-- "Could not find the 'description' column of 'categories' in the schema
-- cache") rather than ignoring it -- so an authenticated user would be unable
-- to create or edit a category at all until this lands.
-- =============================================================================

alter table public.categories
  add column if not exists description text;

comment on column public.categories.description is
  'Optional user-authored hint describing what belongs in this category. Sent to the Jev classifier as part of each option''s criteria (ADR 0012). NULL means never set, which lets the client backfill a shipped default for a system category; an empty string means the user deliberately cleared it.';
