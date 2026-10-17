# Build report: T770

Phase 137: Current test counts in AGENTS.md and README.md, and T767 note 1 (dashboard test 9) (no ADR).

## Files changed (4 target files + task-ledger.md)

1. `AGENTS.md`:
   - Updated Vitest unit test count from 1432 to 1438 at line 11 (`Vitest in unit/ (1438 tests, 62 files, PGlite replays every migration)`).

2. `README.md`:
   - Updated Vitest unit test count from 1432 to 1438 at line 157 (`npm run test:unit    # Vitest: 1438 tests in 62 files, including every migration replayed in PGlite`).

3. `unit/dashboard.test.tsx`:
   - `renderCard` helper at line 480 updated to accept an optional `onOpenTransaction?: (txId: string) => void` handler and pass it to `RecentActivityCard`.
   - Test 9 ("sits in a named region containing the View all button and activity items") at lines 526-535 updated to call `renderCard(() => {})`, capture `container.querySelectorAll('[id^="dashboard-tx-"]')`, assert `expect(rows).toHaveLength(4)`, and assert each row is inside `region`. The other four tests in the describe block continue calling `renderCard()` with no argument.

4. `docs/audit/refactor-log.md`:
   - Updated Phase 137 header from `Small fixes: T769` to `Small fixes: T769-T770`.
   - Appended brief note for T770: unit test counts in `AGENTS.md` and `README.md` brought to 1438, and test 9 made to count its 4 rows.
   - Appended T770 files to **Changed** and gate results to **Verified**.

5. `docs/audit/task-ledger.md` (bookkeeping):
   - Added T770 row under `## Phase 137` section with empty `Commit` cell and gate results.

## Tests strengthened and fail-then-pass evidence

- No new test added (test 9 strengthened in place; unit test count remains 1438).
- **Red run evidence (stage 02 step 4)**:
  - Step 1: Updated test 9 in `unit/dashboard.test.tsx` to assert `expect(rows).toHaveLength(4)` while keeping `renderCard()` with no argument.
  - Step 2: Ran `npx vitest run unit/dashboard.test.tsx -t "sits in a named region"`.
  - Result: Failed with `AssertionError: expected to have a length of 4 but got +0` at line 531:18 (saved to `workflow/stages/02_build/output/logs/T770-red.log`).
- **Green run evidence**:
  - Step 3: Updated `renderCard` to accept optional `onOpenTransaction` and passed callback `(() => {})` in test 9.
  - Result: `npx vitest run unit/dashboard.test.tsx -t "sits in a named region"` passed (1 passed, 48 skipped in 1.77s).
  - Targeted file `npx vitest run unit/dashboard.test.tsx`: passed (49 passed in 2.19s).

## Owner's extra check

Per the orchestrator's order, after fixing test 9, verified that it fails when the rows are missing and passes when restored:
1. **Failure run when rows are missing**:
   - Temporarily modified `renderCard` in `unit/dashboard.test.tsx` to render `RecentActivityCard` with `items={[]}`.
   - Ran `npx vitest run unit/dashboard.test.tsx -t "sits in a named region"`.
   - Result: Failed on `expect(rows).toHaveLength(4)`:
     ```
     FAIL unit/dashboard.test.tsx > Recent activity: L8 fold, L11 nets, and no placeholder labels > sits in a named region containing the View all button and activity items
     AssertionError: expected to have a length of 4 but got +0
     - Expected: 4
     + Received: 0
     ```
2. **Restored passing run**:
   - Restored `items={foldAdjustmentPairs(ROWS)}`.
   - Ran `npx vitest run unit/dashboard.test.tsx -t "sits in a named region"`.
   - Result: Passed (1 passed, 48 skipped in 1.77s; full file 49 passed in 2.19s).

## Gate commands and results

1. Red gate:
   - `npx vitest run unit/dashboard.test.tsx -t "sits in a named region"`: failed with length of 4 expected, 0 received.
   - Log path: `workflow/stages/02_build/output/logs/T770-red.log`

2. Lint:
   - `npm run lint`: exit 0 (132 files checked, check:node-globals clean, check:safe-ids clean, tsc --noEmit clean, tsc -p api/tsconfig.json clean).

3. Targeted unit test:
   - `npx vitest run unit/dashboard.test.tsx`: 49 tests passed in 2.19s (same count as before).

4. Full unit test suite:
   - `npm run test:unit`: 62 test files passed, 1438 passed in 52.65s.
   - Log path: `workflow/stages/02_build/output/logs/T770-unit.log`

5. Docs count check:
   - `AGENTS.md:11` and `README.md:157` match Gate 4's total (1438 tests, 62 files).
   - `npx playwright test --list` output ended with `Total: 537 tests in 35 files`, matching `AGENTS.md:11` (179 tests, 35 specs, 537 runs) and `README.md:158`.
   - `git grep -n "1432" -- AGENTS.md README.md docs/contexts`: returned 0 hits (exit 1).

6. Line endings check:
   - `git ls-files --eol AGENTS.md README.md unit/dashboard.test.tsx docs/audit/refactor-log.md docs/audit/task-ledger.md`: all verified `w/crlf`.

7. Em dash check:
   - Node script evaluated git diff added lines (`+` lines of `git diff -U0`): 0 U+2014 em dashes found.

8. Git status check:
   - `git status --porcelain`: modified only `AGENTS.md`, `README.md`, `unit/dashboard.test.tsx`, `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, and stage outputs.

## Deliberately not done

- Changed only 1432 to 1438 on `AGENTS.md:11` and `README.md:157`; left all other figures, docs/contexts, and files intact.
- Historical figures in `docs/audit/baseline-metrics.md`, `refactor-log.md`, and `task-ledger.md` preserved without changes.
- `docs/audit/baseline-metrics.md` not touched because test count and bundle did not change.
- In `unit/dashboard.test.tsx`, only `renderCard` and test 9 were touched; the other four tests in the describe block continue calling `renderCard()` without argument.
- T767's notes 2 and 3 were not part of T770.
- No changes made to app code under `src/`.
- No Backlog status changes (T770 came from review note).
