# Build report: T835 (Reconcile Phase 161 npm run lint slowdown figure and close Phase 163)

- Task ID: T835
- Phase: Phase 163 (Branch `phase-163-loader-check`)
- Files changed (3 files):
  - `docs/audit/baseline-metrics.md` (1 insertion, 1 deletion: Phase 161 Lint bullet updated)
  - `docs/audit/refactor-log.md` (11 insertions, 0 deletions: Phase 163 entry inserted above Phase 162)
  - `docs/audit/task-ledger.md` (bookkeeping: T835 row appended to Phase 163 section)

## Tests added

None. As specified in Section 6 of `task-T835-spec.md`, this is a docs-only task with no app code changes.

## Fail-then-pass evidence

None (no test additions required).

## Gate results

- **G1 (text landed):** `new 1 old 0` (exit 0)
- **G2 (figures match source files):**
  - `02_build/output/logs/T832-time-before.txt:2`
  - `02_build/output/logs/T832-time-after.txt:2`
  - `03_review/output/logs/T832-time-before.txt:2`
  - `03_review/output/logs/T832-time-after.txt:2`
  - Deltas: `7891 758 1681`
- **G3 (T832 text unchanged):**
  - `758` count in `refactor-log.md`: 2
  - `delta +1681ms` matches: 1 in `refactor-log.md`, 1 in `task-ledger.md`
- **G4 (em dashes and line endings):**
  - Added lines em dash count: 0
  - Whole files em dash count: 0 for all target files and build report
  - Line endings: all `w/crlf` with 0 bare LF
- **G5 (Phase 163 entry landed once above Phase 162):** `true true true true` (exit 0)
- **G6 (scope):**
  - Numstat: `1 1 docs/audit/baseline-metrics.md`, `11 0 docs/audit/refactor-log.md`
  - Clean scope matching allowed files
  - Log path: `workflow/stages/02_build/output/logs/T835-gates.log`

## Left to the reviewer

None. No Playwright tests were part of this task.

## Anything not done

None.
