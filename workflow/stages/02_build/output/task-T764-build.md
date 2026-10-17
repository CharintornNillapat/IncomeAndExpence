# Build report: T764

Phase 134: Dashboard redesign SEL-3: the month-to-date comparison (owner spec 5.3, ADR 0102), and Phase 134 paperwork.

## Files changed (6 files + build report and logs)

1. `src/selectors/ledger.ts`:
   - Imported `monthKeyOf` and `shiftIsoDate` from `../utils/date`, and `inRange` from `./timeRange`.
   - Exported `MonthToDateSide` and `MonthToDate` interfaces.
   - Internal helper `percentChange(now, before)`.
   - Exported pure selector `monthToDate(txs, today, categories?)` comparing day 1 to N of this month and last month (clamped to last month's length).

2. `unit/selectors-dashboard.test.ts`:
   - Imported `monthToDate` from `../src/selectors/ledger`.
   - Tightened T763's future-dated test with direct assertion: `expect(flow.spending).toBeCloseTo((range === 'WEEK' ? 250.9 : 351) + 30, 10);`.
   - Added `describe('monthToDate: the month comparison line (owner spec 5.3)', ...)` with 9 tests covering:
     1. Mid-month, L1 only, every field.
     2. The 31st against a 30-day month (N clamped to 30).
     3. March 29 to 31 against February in leap (2028: 29) and non-leap (2027: 28) years, plus unclamped March 28.
     4. January against previous December (crossing year end).
     5. No figure last month (null changes, finite numbers).
     6. Negative base (improving from -200 to -100 yields +50%).
     7. Cents rounding via `roundToCents`.
     8. Timezone and leap-year invariance across `UTC` and `Asia/Bangkok`.

3. `docs/contexts/client-state.md`:
   - Updated line 63 to document `leftOverFor`, `dailySpendingSeries`, and `monthToDate` selectors under [0102].

4. `docs/audit/refactor-log.md`:
   - Added Phase 134 entry with brief, files changed, verification results, surprises, and deliberately not done items.

5. `docs/audit/baseline-metrics.md`:
   - Added Phase 134 section with asset metrics (0 bundle delta, tree-shaken exports), Vitest metrics (62 files, 1404 passed, +26 tests), and Playwright note.

6. `docs/audit/task-ledger.md`:
   - Marked T764 row done with gate verification results; left Commit cell empty.

## Tests added and fail-then-pass evidence

- 9 new unit tests added in `unit/selectors-dashboard.test.ts` for `monthToDate`.
- 1 assertion added to existing future-dated test in `dailySpendingSeries`.
- **Red run evidence**:
  - Command: `npx vitest run unit/selectors-dashboard.test.ts`
  - Output: 9 failed | 32 passed (41 tests total)
  - Failure cause: `TypeError: monthToDate is not a function` across all 9 new tests. All 32 existing tests passed (including the tightened future-dated assertion).
- **Green run evidence**:
  - Targeted unit run: `npx vitest run unit/selectors-dashboard.test.ts unit/selectors-ledger.test.ts unit/selectors-debts.test.ts unit/diary-page.test.tsx`
  - Output: 4 passed (100 tests total) in 2.54s.
  - Full unit suite: `npm run test:unit`
  - Output: 62 test files passed, 1404 passed (1378 + 26 new tests across Phase 134) in 49.85s.

## Gate commands and results

1. Gate 1 (Red first money path):
   - Command: `npx vitest run unit/selectors-dashboard.test.ts`
   - Result: 9 failed as expected with `TypeError: monthToDate is not a function`, 32 passed.

2. Gate 2 (`npm run lint`):
   - Command: `npm run lint`
   - Checks: `check:node-globals` (132 files in src, clean), `check:safe-ids` (132 files in src, clean), `tsc --noEmit` (clean), `tsc -p api/tsconfig.json` (clean).
   - Result: clean, exit 0.

3. Gate 3 (Targeted unit tests):
   - Command: `npx vitest run unit/selectors-dashboard.test.ts unit/selectors-ledger.test.ts unit/selectors-debts.test.ts unit/diary-page.test.tsx`
   - Result: 4 test files passed, 100 tests passed in 2.54s, exit 0.

4. Gate 4 (Full unit test suite):
   - Command: `npm run test:unit 2>&1 | Tee-Object -FilePath workflow/stages/02_build/output/logs/T764-unit.log`
   - Result: 62 test files passed, 1404 tests passed in 49.85s, exit 0.
   - Log path: `workflow/stages/02_build/output/logs/T764-unit.log`

5. Gate 5 (Build and bundle metrics):
   - Command: `Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue; npm run build 2>&1 | Tee-Object -FilePath workflow/stages/02_build/output/logs/T764-build.log`
   - Result: clean build in 4.81s, exit 0.
   - Log path: `workflow/stages/02_build/output/logs/T764-build.log`
   - Asset figures (gzip level 9):
     - Entry chunk `index-C7LsbYem.js`: 191,696 B (0 delta), 55,810 B gzip (0 delta against Phase 132 `index-C7LsbYem.js`, 191,696 / 55,810).
     - All app JS: 878,229 B (0 delta), 266,912 B gzip (0 delta), 40 files (0 delta against Phase 132 878,229 / 266,912, 40 files).
     - CSS `index-CqllkKUj.css`: 52,759 B (0 delta), 10,159 B gzip (0 delta against Phase 132 `index-CqllkKUj.css`, 52,759 / 10,159).

6. Gate 6 (Playwright):
   - No affected spec. Nothing in `src/` calls `monthToDate` yet (`DashboardView` integration is out of scope until Phase 135 UI-2).

7. Gate 7 (Docs verification):
   - Every stated count and path matches the code and logs.
   - `git diff --numstat docs/contexts/client-state.md` printed `1	1`.

8. Gate 8 (CRLF line endings):
   - Command: `git ls-files --eol src/selectors/ledger.ts unit/selectors-dashboard.test.ts docs/contexts/client-state.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md`
   - Output: all 6 files report `w/crlf`.

9. Gate 9 (No em dashes):
   - Command: `node -e "const d = String.fromCharCode(0x2014); for (const f of process.argv.slice(1)) console.log(f, require('fs').readFileSync(f, 'utf8').split(d).length - 1)" src/selectors/ledger.ts unit/selectors-dashboard.test.ts docs/contexts/client-state.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md`
   - Output: 0 em dashes in all touched files.

10. Gate 10 (Working tree cleanliness):
    - Command: `git status --porcelain`
    - Only the target files, `docs/audit/task-ledger.md`, and stage outputs are present.

## Not done

- None. All edits specified for T764 and Phase 134 completion were completed.
- Wiring the selectors into `DashboardView` is deferred to Phase 135 (UI-1 and UI-2).
