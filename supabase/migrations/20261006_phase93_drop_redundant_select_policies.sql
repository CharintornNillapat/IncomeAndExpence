-- =============================================================================
-- Phase 93 (ADR 0069): drop the two "view system and their own" SELECT
-- policies on categories and keyword_rules.
--
-- Each table has two permissive policies for `authenticated` that cover
-- SELECT: "manage their own" (FOR ALL, `auth.uid() = user_id`) and this one
-- (`user_id is null or auth.uid() = user_id`). Permissive policies are OR-ed,
-- so a row read checks both. The second adds only rows with no owner, and
-- there are none: starter categories are per account since Phase 64
-- (seed_starter_account(), ADR 0039), and on 2026-10-05 the live project held
-- 0 of 20 categories and 0 of 5 keyword rules with `user_id is null` (ADR
-- 0067, finding P1). Supabase's performance advisor flags the pair.
--
-- After it a signed-in user reads exactly the rows the "manage their own"
-- policy gives them, which is what they read before. A row with no owner,
-- should one ever be written, would be visible to no client.
--
-- The baseline (20260901) no longer creates these policies, so a database
-- replayed from empty never has them and this file finds nothing to drop.
--
-- Probe: supabase/tests/20261006_phase93.probe.sql.
-- =============================================================================

drop policy if exists "Users can view system and their own categories" on public.categories;
drop policy if exists "Users can view system and their own keyword rules" on public.keyword_rules;
