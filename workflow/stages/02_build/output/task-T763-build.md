# Build report: T763

Phase 134: Dashboard redesign SEL-2: the daily spending series (owner spec 5.2, ADR 0102).

## Files changed (4 files + build report and logs)

1. `src/selectors/diary.ts`:
   - Imported `shiftIsoDate` from `../utils/date` and `filterByRange` from `./timeRange`.
   - Exported `SpendingPoint` interface (`date`, `spending`).
   - Exported pure selector `dailySpendingSeries(txs, range, today, categories?)` returning 8 points for WEEK, 31 points for MONTH, and `null` for DAY and ALL.

2. `unit/selectors-dashboard.test.ts`:
   - Imported `dailySpendingSeries` from `../src/selectors/diary`.
   - Added `describe('dailySpendingSeries: the Left over sparkline (owner spec 5.2)', ...)` with 9 tests covering:
     1. WEEK is 8 points, oldest first, zero-filled.
     2. MONTH is 31 points, oldest first, zero-filled.
     3. DAY and ALL return `null`.
     4. L1 only, summed and rounded per day to cents.
     5. Only the range days are included.
     6. Sum of points adds up to the card's Spending figure from `leftOverFor`.
     7. Future-dated row: documented gap where card counts but sparkline does not.
     8. Timezone and year-end traversal in both `UTC` and `Asia/Bangkok`.

3. `docs/design/dashboard-2026-10/spec.md`:
   - Updated line 69 to state WEEK 8 points and that every series covers exactly the days of `filterByRange` for its period.

4. `docs/audit/task-ledger.md`:
   - Added T763 under Phase 134 with status `done`, empty `Commit` cell, and full gate results.

## Tests added and fail-then-pass evidence

- 9 new unit tests added in `unit/selectors-dashboard.test.ts`.
- **Red run evidence**:
  - Command: `npx vitest run unit/selectors-dashboard.test.ts`
  - Output: 9 failed | 23 passed (32 tests total)
  - Failure cause: `TypeError: dailySpendingSeries is not a function` across all 9 new tests. All 23 existing tests passed.
- **Green run evidence**:
  - Targeted unit run: `npx vitest run unit/selectors-dashboard.test.ts unit/selectors-ledger.test.ts unit/diary-page.test.tsx unit/selectors-debts.test.ts`
  - Output: 4 passed (91 tests total) in 2.41s.
  - Full unit suite: `npm run test:unit`
  - Output: 62 test files passed, 1395 passed (1386 + 9 new tests) in 50.62s.

## Gate commands and results

1. Gate 1 (Red first money path):
   - Command: `npx vitest run unit/selectors-dashboard.test.ts`
   - Result: 9 failed as expected with `TypeError: dailySpendingSeries is not a function`, 23 passed.

2. Gate 2 (`npm run lint`):
   - Command: `npm run lint`
   - Checks: `check:node-globals` (132 files in src, clean), `check:safe-ids` (132 files in src, clean), `tsc --noEmit` (clean), `tsc -p api/tsconfig.json` (clean).
   - Result: clean, exit 0.

3. Gate 3 (Targeted unit tests):
   - Command: `npx vitest run unit/selectors-dashboard.test.ts unit/selectors-ledger.test.ts unit/diary-page.test.tsx unit/selectors-debts.test.ts`
   - Result: 4 test files passed, 91 tests passed in 2.41s, exit 0.

4. Gate 4 (Full unit test suite):
   - Command: `npm run test:unit 2>&1 | Tee-Object -FilePath workflow/stages/02_build/output/logs/T763-unit.log`
   - Result: 62 test files passed, 1395 tests passed in 50.62s, exit 0.
   - Log path: `workflow/stages/02_build/output/logs/T763-unit.log`

5. Gate 5 (Playwright):
   - No affected spec. Nothing in `src/` calls `dailySpendingSeries` yet (`DashboardView` integration is out of scope until Phase 135 UI-1), and `daySpending`/`moodSpendingDays` are unchanged.

6. Gate 6 (`spec.md` single-line diff):
   - Command: `git diff --numstat docs/design/dashboard-2026-10/spec.md`
   - Output: `1	1	docs/design/dashboard-2026-10/spec.md`
   - Diff verified to match section 7.2 exact line replacement.

7. Gate 7 (CRLF line endings):
   - Command: `git ls-files --eol src/selectors/diary.ts unit/selectors-dashboard.test.ts docs/design/dashboard-2026-10/spec.md docs/audit/task-ledger.md`
   - Output: all 4 files report `w/crlf`.

8. Gate 8 (No em dashes):
   - Command: `node -e "for (const f of process.argv.slice(1)) console.log(f, (require('fs').readFileSync(f, 'utf8').match(/\u2014/g) || []).length)" src/selectors/diary.ts unit/selectors-dashboard.test.ts docs/design/dashboard-2026-10/spec.md docs/audit/task-ledger.md`
   - Output: 0 em dashes in all touched files.

9. Gate 9 (Working tree cleanliness):
   - Command: `git status --porcelain`
   - Only the target files, `docs/audit/task-ledger.md`, and stage outputs are present.

## Not done

- None. All edits specified for T763 were completed.
- Out of scope per spec: wiring `dailySpendingSeries` into `DashboardView` (Phase 135 UI-1), and SEL-3 (month-to-date comparison).
