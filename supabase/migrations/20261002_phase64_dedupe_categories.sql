-- =============================================================================
-- Phase 64 (ADR 0039): collapse duplicate live categories, by soft delete.
--
-- `20260920_dedupe_categories.sql` ran on 2026-09-19 and removed the
-- duplicates of that day, but the client kept re-seeding an account whenever a
-- wallet read came back empty without a session (see
-- 20261002_phase64_seed_starter_account.sql), and three more seeds followed.
-- This cleans up after them, the same way the client's own
-- `dedupeCategoriesByName` already shows them:
--   - a group is one account's live categories sharing a trimmed,
--     case-insensitive name (type is not part of the key, as in the client
--     and the 2026-09-20 migration);
--   - the winner is the earliest created_at, then the lowest id;
--   - every transaction and keyword rule on a loser is re-pointed to the
--     winner. A re-pointed transaction gets `updated_at = now()`, so an edit
--     panel left open on it reports TRANSACTION_CHANGED instead of saving
--     over it (ADR 0033); keyword_rules has no updated_at;
--   - the losers are then marked `is_deleted = true`. Nothing is removed, and
--     no money moves: a category is a label, and re-pointing changes no
--     amount, wallet or debt.
--
-- Idempotent: once each group has one live row there is nothing to re-point
-- or delete. Runs as one DO block, so it lands whole or not at all.
--
-- Probe: supabase/tests/20261002_phase64.probe.sql.
-- =============================================================================

do $phase64_dedupe$
declare
  moved_transactions bigint;
  moved_rules bigint;
  deleted_categories bigint;
begin
  create temporary table _phase64_category_map on commit drop as
  select id as loser_id, winner_id
  from (
    select
      c.id,
      first_value(c.id) over (
        partition by c.user_id, lower(btrim(c.name))
        order by c.created_at, c.id
      ) as winner_id
    from public.categories c
    where not c.is_deleted
  ) ranked
  where id <> winner_id;

  update public.transactions t
  set category_id = m.winner_id, updated_at = now()
  from _phase64_category_map m
  where t.category_id = m.loser_id;
  get diagnostics moved_transactions = row_count;

  update public.keyword_rules r
  set category_id = m.winner_id
  from _phase64_category_map m
  where r.category_id = m.loser_id;
  get diagnostics moved_rules = row_count;

  update public.categories c
  set is_deleted = true
  from _phase64_category_map m
  where c.id = m.loser_id;
  get diagnostics deleted_categories = row_count;

  drop table _phase64_category_map;

  raise notice 'phase64 dedupe: % transactions and % keyword rules re-pointed, % categories marked deleted',
    moved_transactions, moved_rules, deleted_categories;
end;
$phase64_dedupe$;
