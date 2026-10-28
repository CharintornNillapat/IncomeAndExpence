# T819 review

## Round 1

### 1. Metadata

- **Task:** T819, transfer_funds replays a soft-deleted transfer instead of raising unique_violation (Backlog SL-01)
- **Date:** 2026-10-28
- **Round:** 1
- **Verdict:** APPROVED
- **Branch / HEAD:** `phase-151-transfer-replay-soft-deleted` at `a6147d7` (working tree)
- **Target files:** `docs/audit/decisions/0110-transfer-funds-replays-any-row.md` (new), `supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql` (new), `supabase/tests/20261028_phase151.probe.sql` (new), `unit/migration-replay.test.ts`, `AGENTS.md`, `README.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md`. `git check-ignore -v` on all nine: none ignored (exit 1).

### 2. Summary

A new migration re-creates `transfer_funds` from the Phase 93 body, and the only change is its two idempotency lookups (the replay check and the `unique_violation` handler). They now match any row with the key, `order by is_deleted asc, created_at asc`, as `record_transaction` does, so a retry of a deleted transfer replays it instead of raising 23505. A new probe, three PGlite replay tests and the `toHaveLength(23)` edit cover the change, and ADR 0110 plus the Phase 151 closing docs record it.

### 3. Invariants and parity

- **Body is Phase 93 byte for byte apart from the two edits:** I diffed `20261006_phase93...sql:29-205` against `20261028_phase151...sql:23-202` with CR removed. The only differences are the replay comment (2 lines become the spec's 4), the two `and is_deleted = false` lines replaced by `order by is_deleted asc, created_at asc`, and the one added handler comment line. Declarations, guards, locking, updates, insert, return objects, revoke and grant are identical. No `service_role` grant.
- **md5:** Phase 93 body `03b469921a7c0d01909608cb8c6a53d7` (unchanged, still matches the Phase 102/114 pins). Phase 151 body `9923588c3826c0b5f6f4439236c552d6`, which equals the value pinned at `supabase/tests/20261028_phase151.probe.sql:146`.
- **Probe text** matches spec section 2c verbatim, with `<NEW_MD5>` filled in.
- **Test edits** match spec section 2d exactly: the count goes to 23, `upTo150` is added and `upTo148` derives from it (`upTo113`, `upTo101` and `upTo122` still chain from `upTo148`), and the three tests sit in the specified place.
- **Parity row `addTransaction`/`setTransactionDeleted` vs ledger RPCs:** the arithmetic (`balance - v_amount`, `balance + v_amount`) is unchanged, and only the choice of replay row changed. `unit/authenticated-ledger.test.tsx` and `unit/ledger-guards.test.tsx` pass (gate 5), and the probes pass in `unit/migration-replay.test.ts`. Spec section 4 notes the client already handles a replayed row with `is_deleted: true`, and no `src/` file changed (gate 11).
- **No other parity row touched.**
- **ADR 0110** has every spec section in order (Status with Amends/Completes, Date, Context, Decision D1-D4, Consequences, Not done, Release with five numbered steps). Its line references check out against Phase 93.
- **Closing docs:** the ledger Phase 151 section and the Backlog flip to `done in Phase 151 (T819)` are in place, and the Commit cell is empty. The refactor-log entry has every template heading. The baseline-metrics section quotes Phase 149's figures correctly (`index-achQGTXo.js` 198,233 B, 910,934 B in 39 files, CSS 54,969 B).

### 4. Gates run (reviewer, this round)

| # | Command | Result | Log |
|---|---|---|---|
| 1 / step 6 | `git stash push --include-untracked -- supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql`; `npx vitest run unit/migration-replay.test.ts`; `git stash pop --index` | 1 file failed; 3 failed, 33 passed (36). Failures: length 23 vs 22; ENOENT naming the Phase 151 migration; `1 a retry of a deleted transfer did not replay it: 23505`. The guard test (`the probe fails on the schema before it`) passed. `git status --porcelain` before and after: identical | `workflow/stages/03_review/output/logs/T819-red.log` |
| 2 | `npm run lint` | exit 0 (node-globals 139 clean, safe-ids 139 clean, both tsc clean) | `.../logs/T819-lint.log` |
| 3 | `npx vitest run unit/migration-replay.test.ts unit/drift-runner.test.ts unit/migration-history.test.ts` | 3 files passed, 81 passed, 0 failed, 0 skipped (27.87 s) | `.../logs/T819-supabase-tier.log` |
| 4 | `npm run schema:drift` | exit 0; `23 migrations replayed from empty`; 17 function, 68 function grant, 17 index, 23 migration; read-only query printed and not run | `.../logs/T819-drift.log` |
| 5 | `npx vitest run unit/authenticated-ledger.test.tsx unit/ledger-guards.test.tsx` | 2 files, 215 passed, 0 failed (52.58 s) | `.../logs/T819-parity.log` |
| 6 | `npm run test:unit` | 72 files passed, 1601 passed, 0 failed, 0 skipped (55.49 s) | `.../logs/T819-unit.log` |
| 7 | md5 script + grep | Phase 93 `03b4699...53d7`, Phase 151 `9923588...52d6`; probe line 146 pins the same | inline |
| 8 | body diff script; revoke/grant grep | `lines 143 143`; removed two `and is_deleted = false`; added two `order by is_deleted asc, created_at asc`; lines 201-202 equal Phase 93 204-205. The spec's expected output shows one element each, but the filter dedupes nothing, so each list holds two identical entries, as the edit requires | inline |
| 9 | stated counts grep | `1598`: no match; `1601 tests`: `AGENTS.md:11`, `README.md:157` | inline |
| 10 | em dash checks | 0 in added diff lines; 0 in each new file and in the build report | inline |
| 11 | `git diff --stat a6147d7 -- src index.html vite.config.ts package.json package-lock.json` | empty | inline |
| 12 | `git ls-files --eol` | all six tracked files `w/crlf`; new files all CRLF (ADR 35/0, migration 202/0, probe 157/0 bare LF), matching most of their folders | inline |
| 13 | `git status --porcelain`, `git diff --stat` | only the nine targets plus `workflow/stages/01_spec/output/task-T819-spec.md` and `workflow/stages/02_build/output/task-T819-build.md`; no unannounced change | inline |

### 5. Not verified

- The live body md5 and the live apply: both are production touch points, stop-and-ask, and belong to the owner (ADR 0110 Release).
- The concurrent `unique_violation` path: it needs two sessions, which matches the spec's Not done. The text check (`position('and is_deleted = false')` = 0) and the md5 cover it.
- No Playwright run. No `src/` or `tests/` file changed and no spec reaches `transfer_funds`, so the set of affected specs is empty, per spec section 7.

### 6. Blocking

None.

### 7. Non-blocking

- `docs/audit/refactor-log.md:27` and the ledger Gate result cell quote the builder's timings (32.32 s, 75.66 s, 55.54 s). They are accurate for the builder's run, and mine were close (27.87 s, 52.58 s, 55.49 s), so no change is needed.
- ADR 0110 D3 runs to three sentences, one opening with "Furthermore". That is within the spec's "two or three sentences".

### 8. Rule candidates

None. `docs/contexts/supabase-ledger.md` already states the replay rule that `transfer_funds` now follows.
