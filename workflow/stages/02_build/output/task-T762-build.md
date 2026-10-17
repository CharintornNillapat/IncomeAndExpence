# Build report: T762

Phase 134: Dashboard redesign SEL-1: the Left over selector (owner spec 5.1, ADR 0102).

## Files changed (3 files + build report and logs)

1. `src/selectors/ledger.ts`:
   - Imported `filterByRange` and `TimeRange` from `./timeRange`.
   - Exported `LeftOver` interface extending `CashFlow` with `keptPercent`, `spentShare`, `keptShare`, and `afterDebtDue`.
   - Exported pure selector `leftOverFor(txs, range, today, neededThisMonth, categories?)`.

2. `unit/selectors-dashboard.test.ts`:
   - Imported `leftOverFor` from `../src/selectors/ledger`.
   - Added `describe('leftOverFor: the Left over card (owner spec 5.1)', ...)` with 8 tests covering:
     1. L1 filtering and every returned field.
     2. Range filtering via L2 (`filterByRange`).
     3. Cent-accurate `afterDebtDue` for MONTH only (`roundToCents`), null for DAY/WEEK/ALL.
     4. Negative left over clamped bar shares (`spentShare: 100`, `keptShare: 0`, unclamped `keptPercent`).
     5. Spending equal to income (`leftOver: 0`, `spentShare: 100`, `keptShare: 0`).
     6. No income and empty rows (finite numbers, never NaN/Infinity).
     7. Timezone invariance in both `UTC` and `Asia/Bangkok`.

3. `docs/audit/task-ledger.md`:
   - Added Phase 134 section with branch `phase-134-dashboard-selectors`, cut from `main` at `3927c83`.
   - Added T762 row with status `done`, empty `Commit` cell, and full gate results.

## Tests added and fail-then-pass evidence

- 8 new tests added in `unit/selectors-dashboard.test.ts`.
- **Red run evidence**:
  - Command: `npx vitest run unit/selectors-dashboard.test.ts`
  - Output: 8 failed | 15 passed (23 tests total)
  - Failure cause: `TypeError: leftOverFor is not a function` across all 8 new tests. Existing 15 tests passed.
- **Green run evidence**:
  - Targeted unit run: `npx vitest run unit/selectors-dashboard.test.ts unit/selectors-ledger.test.ts unit/selectors-debts.test.ts`
  - Output: 3 passed (65 tests total) in 501ms.
  - Full unit suite: `npm run test:unit`
  - Output: 62 test files passed, 1386 passed (1378 + 8 new tests) in 50.63s.

## Gate commands and results

1. Gate 1 (Red first money path):
   - Command: `npx vitest run unit/selectors-dashboard.test.ts`
   - Result: 8 failed as expected with `TypeError: leftOverFor is not a function`, 15 passed.

2. Gate 2 (`npm run lint`):
   - Command: `npm run lint`
   - Checks: `check:node-globals` (132 files in src, clean), `check:safe-ids` (132 files in src, clean), `tsc --noEmit` (clean), `tsc -p api/tsconfig.json` (clean).
   - Result: clean, exit 0.

3. Gate 3 (Targeted unit tests):
   - Command: `npx vitest run unit/selectors-dashboard.test.ts unit/selectors-ledger.test.ts unit/selectors-debts.test.ts`
   - Result: 3 test files passed, 65 tests passed in 501ms, exit 0.

4. Gate 4 (Full unit test suite):
   - Command: `npm run test:unit 2>&1 | Tee-Object -FilePath workflow/stages/02_build/output/logs/T762-unit.log`
   - Result: 62 test files passed, 1386 tests passed in 50.63s, exit 0.
   - Log path: `workflow/stages/02_build/output/logs/T762-unit.log`

5. Gate 5 (Playwright):
   - No affected spec. Nothing renders `leftOverFor` yet (`DashboardView` integration is out of scope until Phase 135 UI-1), so no spec can observe the change.

6. Gate 6 (CRLF line endings):
   - Command: `git ls-files --eol src/selectors/ledger.ts unit/selectors-dashboard.test.ts docs/audit/task-ledger.md`
   - Output: all 3 files report `w/crlf`.

7. Gate 7 (No em dashes):
   - Command: `node -e "for (const f of process.argv.slice(1)) console.log(f, (require('fs').readFileSync(f, 'utf8').match(/\u2014/g) || []).length)" src/selectors/ledger.ts unit/selectors-dashboard.test.ts docs/audit/task-ledger.md`
   - Output: 0 em dashes in all touched files.

8. Gate 8 (Working tree cleanliness):
   - Command: `git status --porcelain`
   - Only the target files, `docs/audit/task-ledger.md`, and stage outputs are present.

## Not done

- None. All edits specified for T762 were completed.
- Out of scope per spec: wiring `leftOverFor` into `DashboardView` and `CashFlowCard` (Phase 135 UI-1), SEL-2 (daily spending series), and SEL-3 (month-to-date comparison).
