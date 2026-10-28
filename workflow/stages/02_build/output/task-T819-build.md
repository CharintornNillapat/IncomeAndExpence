# Build Report - T819

## 1. Summary of Changes

Fixed Backlog row SL-01 (finding SL-01 from Audit 2026-10-16 / T759, ADR 0110): retrying a transfer whose row was soft-deleted by the user now replays that row (`reused: true`, balances unchanged) rather than raising `unique_violation` (23505). Server-side only; ships Phase 151.

- **ADR 0110 (`docs/audit/decisions/0110-transfer-funds-replays-any-row.md`):** Documented Context, Decision (D1-D4), Consequences, Not done, and Release steps for re-creating `transfer_funds` without the `is_deleted = false` filter in both the replay check and the `unique_violation` exception handler.
- **Migration (`supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql`):** Re-created `transfer_funds` starting from deployed Phase 93 body (`03b469921a7c0d01909608cb8c6a53d7`, CR stripped), changing only the replay lookup and exception handler lookup to match any row with the key (`order by is_deleted asc, created_at asc`). Signature, security definer, pinned search path, and grants to authenticated remain identical.
- **Probe (`supabase/tests/20261028_phase151.probe.sql`):** Added database probe verifying deleted transfer retry replays and moves nothing, live transfer retry replays, account key isolation, catalog definition, absence of `and is_deleted = false` in prosrc, pinned Phase 151 body md5 `9923588c3826c0b5f6f4439236c552d6`, and advisor's 11 SECURITY DEFINER functions, rolling back cleanly with `PHASE 151 PROBE OK`.
- **Replay Tests (`unit/migration-replay.test.ts`):** Updated migration count to 23, defined `upTo150` helper bounding probes that pin Phase 93 body, and added before-migration, after-migration, and pre-migration failure tests for Phase 151 / SL-01.
- **Phase 151 Closing Docs:**
  - `AGENTS.md` and `README.md`: Updated Vitest count to 1601 tests in 72 files.
  - `docs/audit/task-ledger.md`: Added Phase 151 section, marked T819 done with gate results, and marked Backlog row SL-01 done in Phase 151.
  - `docs/audit/refactor-log.md`: Added Phase 151 entry.
  - `docs/audit/baseline-metrics.md`: Added Phase 151 delta section against Phase 149.

## 2. Files Changed (9 files)

1. `docs/audit/decisions/0110-transfer-funds-replays-any-row.md` (created)
2. `supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql` (created)
3. `supabase/tests/20261028_phase151.probe.sql` (created)
4. `unit/migration-replay.test.ts` (modified)
5. `AGENTS.md` (modified)
6. `README.md` (modified)
7. `docs/audit/refactor-log.md` (modified)
8. `docs/audit/baseline-metrics.md` (modified)
9. `docs/audit/task-ledger.md` (modified)

## 3. Tests Added and Fail-then-Pass Evidence

Tests added in `unit/migration-replay.test.ts`:
- `Phase 151, before its migration: applies it, passes and rolls back`
- `Phase 151, after its migration: passes against every file`
- `Phase 151: the probe fails on the schema before it, with the migration left out`
- Count update: `expect(migrationFiles()).toHaveLength(23)`

### Red Gate (before adding migration file):
- Command: `npx vitest run unit/migration-replay.test.ts`
- Log: `workflow/stages/02_build/output/logs/T819-red.log`
- Result: 1 failed file, 3 failed tests, 33 passed tests (36 total) in 48.68s.
- Failures:
  1. `applies in file order, starting from the baseline`: `AssertionError: expected [ ...(22) ] to have a length of 23 but got 22`
  2. `Phase 151, before its migration: applies it, passes and rolls back`: `Error: ENOENT: no such file or directory, open '...supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql'`
  3. `Phase 151, after its migration: passes against every file`: `error: 1 a retry of a deleted transfer did not replay it: 23505`
  Notice: `Phase 151: the probe fails on the schema before it, with the migration left out` passed as expected.

### Green Gate (after adding migration and updating probe md5):
- Command: `npx vitest run unit/migration-replay.test.ts`
- Result: 1 passed file, 36 passed tests (0 failed) in 31.92s.

## 4. Verification Gates Run

### Gate 1: Red Run
- Verified 3 expected failures; log saved to `workflow/stages/02_build/output/logs/T819-red.log`.

### Gate 2: `npm run lint`
- Command: `npm run lint`
- Output: check:node-globals (139 files clean), check:safe-ids (139 files clean), `tsc --noEmit` (0 errors), `tsc -p api/tsconfig.json` (0 errors). Exit 0.

### Gate 3: Targeted Migration Vitest Files
- Command: `npx vitest run unit/migration-replay.test.ts unit/drift-runner.test.ts unit/migration-history.test.ts`
- Result: 3 passed files, 81 passed tests (+3 tests over Phase 149's 78) in 32.32s.

### Gate 4: Offline Schema Drift Check
- Command: `npm run schema:drift`
- Result: Exit 0. Output: `schema-drift: 23 migrations replayed from empty; expected rows: 75 column, 28 constraint, 1 extension, 17 function, 68 function grant, 17 index, 7 policy, 5 publication, 8 table, 24 table grant, 2 trigger, 23 migration`. Printed read-only SQL query.

### Gate 5: Parity Guards
- Command: `npx vitest run unit/authenticated-ledger.test.tsx unit/ledger-guards.test.tsx`
- Result: 2 passed files, 215 passed tests in 75.66s.

### Gate 6: Full Unit Suite
- Command: `npm run test:unit`
- Log: `workflow/stages/02_build/output/logs/T819-unit.log`
- Result: 72 passed files, 1601 passed tests (+3 tests over Phase 149's 1598) in 55.54s.

### Gate 7: Function Body Hashes (CR stripped)
- Command: md5 hash check of Phase 93 and Phase 151 function bodies
  - Phase 93: `03b469921a7c0d01909608cb8c6a53d7`
  - Phase 151: `9923588c3826c0b5f6f4439236c552d6`
- Probe check: `grep -n "md5(replace(prosrc" supabase/tests/20261028_phase151.probe.sql` matches `9923588c3826c0b5f6f4439236c552d6`.

### Gate 8: Body Diff Verification
- Command: line and diff comparison between Phase 93 and Phase 151 bodies (comments excluded):
  - Line count: 143 vs 143
  - Removed lines: `[ '       and is_deleted = false', '       and is_deleted = false' ]`
  - Added lines: `[ '     order by is_deleted asc, created_at asc', '     order by is_deleted asc, created_at asc' ]`
  - Statements after body: `revoke all on function public.transfer_funds(...) from public, anon;` and `grant execute on function public.transfer_funds(...) to authenticated;` matching Phase 93 lines 204-205.

### Gate 9: Stated Counts Grep
- `git grep -n "1598" AGENTS.md README.md`: 0 matches.
- `git grep -n "1601 tests" AGENTS.md README.md`: prints `AGENTS.md:11` and `README.md:157`.

### Gate 10: Em Dash Verification
- Added lines in `git diff -U0 HEAD`: 0 em dashes (`\u2014`).
- New files (`docs/audit/decisions/0110-transfer-funds-replays-any-row.md`, `supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql`, `supabase/tests/20261028_phase151.probe.sql`): 0 em dashes.

### Gate 11: Bundle Unaffected
- `git diff --stat a6147d7 -- src index.html vite.config.ts package.json package-lock.json`: 0 lines output (clean).

### Gate 12: Line Endings
- Tracked files (`AGENTS.md`, `README.md`, `unit/migration-replay.test.ts`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md`): `w/crlf` preserved.
- New files (`0110-transfer-funds-replays-any-row.md`: CRLF 35 / bare LF 0; `20261028_phase151_transfer_funds_replay_any_row.sql`: CRLF 202 / bare LF 0; `20261028_phase151.probe.sql`: CRLF 157 / bare LF 0).

### Gate 13: Scope
- `git status --porcelain`: lists only the 9 target files, `docs/audit/task-ledger.md`, and workflow files.

## 5. Anything Not Done

- The `unique_violation` handler is not exercised by the probe (needs two concurrent sessions; covered by text and md5 checks).
- No client test for a deleted replay (the client path is the existing replay path, unchanged).
- No change to `record_transaction` or other ledger functions.
- No Playwright run: no file under `src/` or `tests/` changed.
- Filling `<sha>` placeholders in `refactor-log.md` and the `Commit` cell in `task-ledger.md`, left to the owner-approved post-merge deploy record.
