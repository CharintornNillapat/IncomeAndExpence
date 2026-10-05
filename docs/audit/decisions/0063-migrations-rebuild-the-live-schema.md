# 0063: The migrations rebuild the live schema, and a check proves it

**Status:** Accepted. Implemented on branch `phase-87-reconcile-db-migrations` (commit `ffd3f13`, docs `0c898b9`), draft PR #37. Not merged yet. The migration history backfill is **not applied** to the live project: that waits for the owner's word after the merge (see "Applying it").

**Date:** 2026-10-05

## Context

`supabase/migrations/` was meant to describe the live database (project `rmpnzlcufeioxmgoocpt`). Three gaps were known when the phase started:
1. Phase 64's duplicate-category cleanup was run in the SQL editor, so the migration history doesn't record it (ADR `0039`).
2. Phase 73's AI request counter (`ai_request_counts`, `consume_ai_quota()`) was applied the same way (ADR `0049`).
3. `transactions_user_idempotency_uidx`, a non-partial unique index ADR `0023` found on the live project, comes from no file.

## What the live project held (read-only, 2026-10-05)

The inventory found more drift than the three known gaps:

| | Live | Repo |
|---|---|---|
| Migration history | 9 rows | 12 files |
| Recorded nowhere | `transfer_funds`, `phase64_dedupe_categories`, `phase73_ai_request_quota` | |
| Created by no file | 7 tables (`profiles`, `wallets`, `categories`, `debts`, `transactions`, `diary_entries`, `keyword_rules`) with their 25 constraints; 6 indexes; all 9 row-level security policies; `handle_new_user()` and its `on_auth_user_created` trigger (Phase 52 only altered them); the 5 tables in `supabase_realtime`; `uuid-ossp`; `transactions_user_idempotency_uidx` | |

**The base schema was never in the repo.** It was built in the Supabase dashboard before the first migration (`20260909_transfer_funds.sql`), and every file assumes it. So a database built from `supabase/migrations/` alone failed at the first file. `20260920_dedupe_categories.sql` says so in its own header: "this repo has no schema file".

Everything else matched once it was checked: every function body, grant, policy expression and trigger that a file does create is what the live project runs (below).

## Decision

### 1. `20260901_baseline_schema.sql`: the schema before the first migration

It sorts before every other file and creates, read from live:
- the `uuid-ossp` extension;
- the seven tables as they stood before the first migration. It leaves out `categories.description` (added in `20260923`) and `wallets.idempotency_key` (added in `20260928`), because those files add them;
- the tables' constraints, six indexes and row-level security;
- the nine policies (no file created any);
- `handle_new_user()` (its live body) and `on_auth_user_created`;
- the realtime publication's five tables;
- `transactions_user_idempotency_uidx`.

Two rules make it safe on the live project:
- **Every statement is guarded.** A statement is either `if not exists` or checks the catalog first, so on a database that has everything it changes nothing. A plain `create or replace function handle_new_user()` would have reset the `search_path` Phase 52 set on it; the unit test's negative control shows exactly that.
- **It holds nothing a later file drops.** The profiles "update their own profile" policy, which Phase 58s removed, isn't in it. Running the baseline can therefore never bring that policy back.

**`transactions_user_idempotency_uidx` is recorded as it is, not dropped.** It blocks a new row whose key belongs to a soft-deleted row. That matches the ledger RPCs' replay rule (ADR `0023`: a retry replays against any row with its key, live or deleted, so a deleted intent is never resurrected). Dropping it would change behaviour, which is not this phase's to decide.

### 2. `supabase/ops/20261005_phase87_record_migration_history.sql`: the history backfill

This isn't a migration: it changes no schema and no app data, only `supabase_migrations.schema_migrations`. It adds the four names live is missing: `baseline_schema`, `transfer_funds`, `phase64_dedupe_categories` and `phase73_ai_request_quota`.
- **Matched by name.** The history's versions are the times each migration ran, not the files' dates, so files and history are matched by name: the file name without its date.
- **Version and marker.** A backfilled row's version is its file's date at `000000`, because the real time is unknown. `created_by` says it was backfilled. `statements` stays null, since none of these ran through the tool.
- **Idempotent.** A name or version already present is skipped.

### 3. A drift check that can be repeated: `npm run schema:drift`

- **`scripts/lib/migrationReplay.mjs`** replays every migration from empty into PGlite, PostgreSQL compiled to WebAssembly, in process. Docker doesn't run on this machine, and a Supabase branch is a paid feature.
- **`supabase/replay/prelude.sql`** stands in for the platform. It copies from live:
  - the four roles;
  - the search path, which decides how a default, a foreign key or a policy prints;
  - the default privileges `postgres` holds in `public`;
  - `auth.users` and `auth.sessions` at the live column types;
  - `auth.uid()` and `auth.jwt()`;
  - the empty `supabase_realtime` publication.
- **`supabase/catalog.sql`** lists the database's parts, one row each, in a temporary view, `schema_catalog`. That covers tables, columns, constraints, indexes, policies, function signatures with an md5 of each body, function and table grants for the Supabase roles, triggers, the publication and the extension.
- **`scripts/schema-drift.mjs`** writes one read-only query that carries the replayed catalog and the file names as expected rows. Run on the live project, it returns only the rows that differ, each marked "only in the repo" or "only in the database". No rows means no drift.
- **PGlite is pinned at `0.4.6`** (PostgreSQL 17.5). Live is 17.6. The 0.5 releases are PostgreSQL 18, which, for one, lists NOT NULL as constraints. Moving to them means re-checking the catalog's output against live first.

### 4. `unit/migration-replay.test.ts` (11 tests, about 3 s)

The tests run on every CI run, in the `checks` job. They check that:
- every file replays from empty in order;
- the result has live's object counts and both idempotency indexes;
- `handle_new_user` ends hardened, and the dropped profile policy stays gone;
- the baseline on a complete database changes nothing;
- the backfill names every file exactly once, and a second run inserts nothing;
- the drift query finds nothing on a matching database but names a dropped policy, an extra index and a missing history row;
- the live probe passes on a replayed database with live's nine-row history and leaves it as it was.

### 5. `supabase/tests/20261005_phase87.probe.sql`

Inside `BEGIN ... ROLLBACK`, the probe:
- runs the baseline, the Phase 64 cleanup and the Phase 73 file on the live schema, and asserts that the schema and every category, transaction and keyword-rule link are unchanged;
- runs the backfill twice and asserts that the history names every file exactly once.

**Rejected:**
- **Dropping `transactions_user_idempotency_uidx`:** a behaviour change (above).
- **`supabase db pull` / `db diff`:** they need Docker and the database password, neither available here.
- **Squashing every migration into one:** it would rewrite files the live history already records, and lose the history of how each change was reviewed.
- **Committing a snapshot of the live catalog:** it would go stale silently. The drift query is generated from the files, and live answers it.

## Verification

- **Replay from empty:** all 13 files apply in order in PGlite. The result has live's counts: 8 tables, 75 columns, 28 constraints, 17 indexes, 9 policies, 15 functions, 2 triggers and 5 published tables.
- **Against live, read-only** (2026-10-05): `schema_catalog` on live and on the replay, hashed per kind of object, are identical for all 11 kinds. That covers every function body, the 60 function grants, the 24 table grants, every policy expression, constraint, index and trigger.
  - The first comparison differed on columns. Drilling down showed my baseline had `numeric` where live has `numeric(15,2)` for the amounts and `numeric(5,2)` for `interest_rate`. The check caught the mistake; after the fix every kind matched.
- **History, read-only:** exactly the four names above are missing from live, and live has none the files lack. Run again, the Phase 64 cleanup would move 0 categories. None of the four backfill versions is taken.
- **The live probe was not run on live, by the owner's decision.** It writes inside a transaction that rolls back, but holds table locks while it runs, so the verification stayed read-only. The same probe passes in the unit suite on a replayed database with live's nine-row history.
- **Negative controls:**
  - the baseline's `handle_new_user` unguarded (`create or replace`): the baseline test, both drift tests and the probe fail, the probe with "1 the baseline changed or removed an object";
  - the backfill unguarded: its second run fails on the version key.
- **Gate:** lint clean; unit 840/840 in 33 files; full Playwright suite in the refactor log. No `src/` change.

## Applying it

After the merge, on the owner's word:
1. `npm run schema:drift > drift-check.sql` and run it on live. It should list exactly the four `migration` rows "only in the repo".
2. Run `supabase/ops/20261005_phase87_record_migration_history.sql` on live.
3. Run `drift-check.sql` again. **No rows** is zero unaccounted drift.

The baseline is never run on live: its objects are already there, which is why the history records it rather than applying it.

## Consequences

- **A database built from `supabase/migrations/` is the live schema,** object for object, so a new environment (a test project, a restore) can start from the repo.
- **A schema change made outside a migration now shows up.** Run `npm run schema:drift` after applying any migration, or whenever the dashboard has been used to change the schema.
- **A new migration must be safe to replay from empty** on top of the prelude. The unit suite fails if it isn't, so a migration that depends on something only live has is caught in CI.
- **`wallets.currency` defaults to `'USD'`** on live and in the baseline. The client sends `'THB'` and `create_wallet` and the starter seed write it, so this is recorded as found, not changed.
- **Still open:** applying the backfill (above).
