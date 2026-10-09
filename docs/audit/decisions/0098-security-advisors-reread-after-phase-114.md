# 0098: The Supabase advisors, read again after the legacy `transfer_funds` drop: nothing new, live matches all 20 migrations

**Status:** Accepted. Released: docs `d163208`, hash backfill `51ffd0d`, merged into `main` as `9d021aa` (PR #73); production deployment READY in `icn1`, serving Phase 121's entry. No migration, no code change. Live drift run `37996758984`: no drift, 20 migrations.
- **Re-reads** ADR `0067`'s triage and ADR `0074`'s re-read, after Phase 102 (ADR `0078`) and Phase 114 (ADR `0090`) took the 20260909 `transfer_funds(p_user_id, ...)` signature off the list and then out of the database.

**Date:** 2026-10-10

## Context

1. **The advisors were last read on 2026-10-06** (Phase 98, ADR `0074`): eleven `SECURITY DEFINER` signatures, the rule-less `ai_request_counts`, leaked password protection off, five unindexed foreign keys and three unused indexes. Since then Phase 102 made the legacy `transfer_funds` signature `SECURITY INVOKER` and Phase 114 dropped it. No other migration has landed.
2. **The owner's brief:** read the security and performance advisors, sort each finding into accepted or new, confirm that no function is exposed to `anon` and that no `search_path` warning is left, and run the live drift check.
3. **How it was read:** the Supabase MCP's `get_advisors` (both kinds) and read-only `SELECT`s on the catalog, project `rmpnzlcufeioxmgoocpt` (the one `vercel.json`'s policy names), on 2026-10-10 (the advisors' `observed_at` is 2026-10-09 21:59 UTC). The drift check ran through `schema-drift.yml`, as `schema_drift_reader`. Nothing was written.

## Decision

### 1. Security: 3 lints, 12 findings, all already decided

| # | Lint (level) | Finding | Decision |
|---|---|---|---|
| S1 | Leaked password protection disabled (WARN) | Supabase Auth does not check new passwords against HaveIBeenPwned. | **Unchanged: the owner's switch** (ADR `0067`), in the Auth settings, if the plan offers it. Still off. |
| S2 | Signed-in users can execute a SECURITY DEFINER function (WARN) | **10 findings, one signature each:** `consume_ai_quota`, `create_wallet`, `delete_user_account`, `import_transactions`, `list_my_sessions`, `record_transaction`, `seed_starter_account`, `set_transaction_deleted`, `transfer_funds` (the Phase 93 signature, without `p_user_id`), `update_transaction`. | **Accept: they are the API** (ADR `0067`, `0072`). ADR `0074` counted eleven, the 20260909 `transfer_funds(p_user_id, ...)` among them; Phase 102 made it `SECURITY INVOKER` (ADR `0078`) and Phase 114 dropped it (ADR `0090`). |
| S3 | RLS enabled, no policy (INFO) | `public.ai_request_counts` | **Accept: by design** (ADR `0049`). Only `consume_ai_quota()` reads or writes it. |

**No `function_search_path_mutable` finding, and none in the catalog either.** All 16 functions in `public` have `search_path=public, pg_temp`: the ten above, `handle_new_user` and `handle_user_updated` (trigger functions, which no client role may execute), and the four private `_ledger_*` helpers (`SECURITY INVOKER`, which no client role may execute).

**No function is exposed to `anon` or `PUBLIC`.** For each of the 16, `has_function_privilege('anon', ..., 'EXECUTE')` is false, and no ACL entry grants `EXECUTE` to `PUBLIC`. `authenticated` may execute exactly the ten in S2.

### 2. Performance: 2 lints, 8 findings, all already decided

| # | Lint (level) | Finding | Decision |
|---|---|---|---|
| P2 | Unindexed foreign keys (INFO) | `keyword_rules.category_id`; `transactions.category_id`, `debt_id`, `destination_wallet_id`, `wallet_id`. | **Accept, with the trigger unchanged** (ADR `0067`, measured in ADR `0073`): add the indexes when `public.transactions` passes 100,000 rows, after re-running `node scripts/bench-cascade-delete.mjs`. It holds **121** today. |
| P3 | Unused indexes (INFO) | `debts_user_created_idx`, `diary_entries_user_date_idx`, `keyword_rules_user_idx`. | **Accept** (ADR `0067`): tables of a few rows, where the planner scans. |

ADR `0067`'s P1 (two permissive SELECT policies) stays gone since Phase 93: live has **7 policies**, one per table except `ai_request_counts`, each for `authenticated` only and each `(select auth.uid()) = user_id` (`id` on `profiles`).

### 3. One observation, no finding: `anon` keeps Supabase's default table grants

- **What:** on `categories`, `debts`, `diary_entries`, `keyword_rules`, `transactions` and `wallets`, `anon` holds `SELECT`, `INSERT`, `UPDATE` and `DELETE`, the platform's default for a table in `public`. `profiles` (ADR `0032`) and `ai_request_counts` (ADR `0049`) give it nothing.
- **Why it reaches no row:** all eight tables have row-level security on, and no policy names `anon` or `PUBLIC`. Under RLS a role with no applicable policy sees no row and writes none.
- **It is not drift:** the drift catalog compares `anon`'s, `authenticated`'s and `service_role`'s grants on every table (24 rows), and the run in section 4 found the replayed migrations and live identical, so the replay grants the same and a change on either side is reported.
- **Accept.** Revoking them would be defence in depth only: a migration, a catalog change and a probe, for no reachable row. Revisit only if a policy for `anon` or `PUBLIC` is ever proposed.

### 4. Live drift: none

`gh workflow run schema-drift.yml --ref main` (run `37996758984`, on `f3e4a51`, 27 s): "20 migrations replayed from empty; expected rows: 75 column, 28 constraint, 1 extension, 16 function, 64 function grant, 17 index, 7 policy, 5 publication, 8 table, 24 table grant, 2 trigger, 20 migration", then "no drift. Live matches all 20 migrations (as schema_drift_reader)". A read-only count of `supabase_migrations.schema_migrations` gives 20 rows too.

**Nothing needs fixing in the database.** S1 is still the owner's.

## Verification

- The two advisor reads and four catalog queries above, all `SELECT`, on the project `vercel.json` names.
- The live drift run `37996758984`.
- **Gate on the branch:** `npm run lint` clean; `npm run test:unit` 1360/1360 in 61 files (67 s). No file in `src/`, `unit/`, `tests/`, `api/` or `supabase/` changes, so Playwright was not run; the pull request's CI skips docs-only changes.

## Consequences

- **The advisor list is the decided list.** A later re-read compares with this ADR first: 10 `SECURITY DEFINER` findings, the rule-less `ai_request_counts`, the leaked-password switch, five unindexed foreign keys and three unused indexes. Anything else is new.
- **The foreign-key trigger is far off:** 121 transactions against 100,000.
- **Owner:** turn on leaked password protection, and set the 8-character password minimum in the Auth settings (ADR `0087`), if the plan allows.

## Release

- PR #73 merged into `main` as `9d021aa` on 2026-10-10.
- Production deployment (GitHub deployment `6972580205`, on `9d021aa`) completed; it serves `index-B8wLrv24.js`, Phase 121's entry, as a docs-only change should, and a guest `POST {}` to `/api/classify` answers 400 from `icn1`.
- `main` CI did not run on the merge: the workflow skips a push that touches only `docs/` and Markdown. The last `main` run of the code is Phase 121's (`37948807018`, green).
