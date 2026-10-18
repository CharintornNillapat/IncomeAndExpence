# Build report: T778

Phase 139: Phase 139 closing docs (refactor-log entry, baseline-metrics section, unit test count 1444 in 63 files in AGENTS.md and README.md; no ADR). This task ships Phase 139.

## Files changed (4 target files + task-ledger.md)

1. `AGENTS.md`:
   - Line 11: updated Vitest test count from `1438 tests, 62 files` to `1444 tests, 63 files`.

2. `README.md`:
   - Line 157: updated Vitest test count from `1438 tests in 62 files` to `1444 tests in 63 files`.

3. `docs/audit/baseline-metrics.md`:
   - Added `### Phase 139 - delta against Phase 137` section with entry chunk, all app JS, CSS, Vitest, and Playwright measurements.

4. `docs/audit/refactor-log.md`:
   - Inserted `## Phase 139 - Subagent trial: T776-T778 (2026-10-18, code `<sha>`, docs `<sha>`, merged `<sha>`)` entry at the top of the refactor log above Phase 138.
   - Recorded Brief, Changed, Verified, Surprises (with the verified sub-agent model results block), and Deliberately not done.

5. `docs/audit/task-ledger.md` (bookkeeping):
   - Added T778 row under T777 in Phase 139 table with Status `done`, empty `Commit` cell, and full gate result summary.

## Tests to add

None. Docs only; this task adds no code and alters no runtime behaviour (spec section 6).

## Gate commands and results

1. Full unit test suite:
   - `npm run test:unit`: 63 test files passed, 1444 passed in 75.76s.
   - Log path: `workflow/stages/02_build/output/logs/T778-unit.log`.

2. Playwright test count check:
   - `npx playwright test --list`: confirmed 179 tests in 35 files, 537 runs across 3 projects (Chromium, Firefox, WebKit).

3. Clean production build and bundle measurement:
   - Removed `dist/` and ran `npm run build` with repo's `.env` present: built in 4.19s.
   - Measured with level 9 gzip compression:
     - Entry chunk `index-DdI940YI.js`: 193,377 B (+42 B), 56,330 B gzip (-28 B against Phase 137 `index-vzBQwKkr.js`, 193,335 / 56,358).
     - All app JS: 884,689 B (+20 B), 268,554 B gzip (-34 B against Phase 137 884,669 / 268,588, 39 files, 0 file delta).
     - CSS `index-BJZ9fITB.css`: 52,877 B (0 delta), 10,216 B gzip (0 delta against Phase 137 `index-BJZ9fITB.css`, 52,877 / 10,216).

4. Line endings check:
   - `git ls-files --eol AGENTS.md README.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md`: confirmed `w/crlf` across all 5 touched files.

5. Diff precision check:
   - `git diff -U0 HEAD -- AGENTS.md README.md`: shows exactly one line changed in each file, number pair only (1438/62 -> 1444/63).

6. Em dash check:
   - Git diff check: 0 em dashes added.
   - Build report check: 0 em dashes.

7. Stale count check:
   - `grep -rnE "1438" AGENTS.md README.md`: 0 occurrences found in both files.

8. Git status cleanliness:
   - `git status --porcelain`: only the 4 target files, `docs/audit/task-ledger.md`, and workflow stage files.

## Deliberately not done

- An ADR (reasons detailed in spec section 4).
- A shared rollback helper for the three write catch blocks (T777 spec section 9).
- The `cloudRevisionRef` comment at `FinanceContext.tsx:771-782` (names `addTransaction` only).
- A test for a reload that read nothing during delete or restore (pinned at `unit/authenticated-ledger.test.tsx:833-859`).
- Any caller passing `includeDeleted` (CS-01 fixes the hook only).
- The remaining 2026-10-16 audit findings (SL-01 and the rest of the Backlog).
- A full Playwright run (affected specs only, per tier rows).
- `baseline-metrics.md` archiving (under the 150-line threshold).
