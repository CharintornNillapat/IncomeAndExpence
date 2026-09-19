-- =============================================================================
-- One-time cleanup: physically remove duplicate category rows already sitting
-- in a live database, left behind by the pre-Phase-30 seeding race.
--
-- `dedupeCategoriesByName` (src/utils/categoryUtils.ts, Phase 30 / T51-T56)
-- already heals this on every client read by marking losing duplicates
-- `isDeleted = true` — no `!isDeleted` picker in the app can show one. But it
-- cannot and does not touch rows a live Supabase project already accumulated
-- before that fix shipped; `docs/audit/refactor-log.md`'s Phase 30 entry
-- explicitly names that gap ("No migration or admin tool to find and
-- physically remove already-duplicated rows in a real Supabase project").
-- This migration is that tool.
--
-- Duplicate key matches the client healing pass exactly, so a row this
-- migration leaves alone is a row the client would also treat as unique:
-- same user_id, same trimmed/case-insensitive name, both currently active
-- (is_deleted = false). Category `type` is deliberately NOT part of the key —
-- `dedupeCategoriesByName` ignores it too, and every duplicate this bug ever
-- produced was a re-seed of the same default set, so a name collision always
-- carried a matching type in practice. An already-`isDeleted` category is
-- left untouched either way, matching the client comment: "a genuinely
-- deleted category and an active one of the same name are not a duplicate to
-- collapse."
--
-- Assumed existing schema (this repo has no schema file; these are the
-- columns the client already reads and writes):
--   categories(id uuid pk, user_id uuid, name text, type text, icon text,
--              color text, is_system bool, is_deleted bool,
--              created_at timestamptz)
--   transactions(..., category_id uuid references categories(id), ...)
--   keyword_rules(id uuid pk, user_id uuid, keyword text,
--                 category_id uuid references categories(id), created_at timestamptz)
--
-- Safety:
--   - Runs as a single transaction: either every reassignment and delete
--     lands together, or none of it does.
--   - Idempotent. The first run collapses every active same-name group down
--     to one row each; every later run finds zero groups with more than one
--     active row sharing a key, so it reassigns and deletes nothing.
--   - Never touches `transactions`/`keyword_rules` rows that don't reference
--     a losing duplicate, and never soft- or hard-deletes a transaction.
--   - Winner selection is deterministic: earliest `created_at`, then lowest
--     `id` as a tiebreaker for rows created in the same instant.
-- =============================================================================

begin;

do $$
declare
  v_repointed_transactions  bigint;
  v_repointed_keyword_rules bigint;
  v_deleted_categories      bigint;
begin
  -- 1. Map every losing duplicate to the single winner it should be replaced
  --    by. `on commit drop` means this table never outlives the migration,
  --    on success or failure.
  create temporary table _category_dedupe_map on commit drop as
  select id as loser_id, winner_id
  from (
    select
      id,
      first_value(id) over (
        partition by user_id, lower(btrim(name))
        order by created_at asc, id asc
      ) as winner_id,
      row_number() over (
        partition by user_id, lower(btrim(name))
        order by created_at asc, id asc
      ) as rn
    from public.categories
    where is_deleted = false
  ) ranked
  where rn > 1;

  -- 2. Re-point transactions off the losing duplicate onto the winner before
  --    any row is deleted, so no ledger entry is ever left with a dangling
  --    category_id.
  update public.transactions t
     set category_id = m.winner_id,
         updated_at  = now()
    from _category_dedupe_map m
   where t.category_id = m.loser_id;
  get diagnostics v_repointed_transactions = row_count;

  -- 3. Same re-point for keyword rules, the other table that references a
  --    category by id.
  update public.keyword_rules k
     set category_id = m.winner_id
    from _category_dedupe_map m
   where k.category_id = m.loser_id;
  get diagnostics v_repointed_keyword_rules = row_count;

  -- 4. Every reference to a losing duplicate now points at its winner, so the
  --    duplicate row itself is safe to remove — a physical delete, not a
  --    soft delete, because these rows are bug artifacts a user never chose
  --    to delete, not ledger history to preserve.
  delete from public.categories c
  using _category_dedupe_map m
  where c.id = m.loser_id;
  get diagnostics v_deleted_categories = row_count;

  raise notice 'Category dedupe: % transaction(s) re-pointed, % keyword rule(s) re-pointed, % duplicate categor(y/ies) deleted.',
    v_repointed_transactions, v_repointed_keyword_rules, v_deleted_categories;
end;
$$;

commit;
