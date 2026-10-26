# Build Report: T809

## Task ID
T809

## Files Changed (5 edited + 2 untracked owner files unchanged + 1 build report)
1. `src/selectors/timeRange.ts` - exported `monthBounds(monthKey)` returning inclusive `RangeBounds` for a calendar month (`YYYY-MM`).
2. `src/selectors/ledger.ts` - exported `DayTotals`, `dailyTotals`, `HEAT_LEVELS`, `heatLevel`, `SelectionSummary`, and `selectionSummary`.
3. `unit/selectors-ledger.test.ts` - added imports and the 5-test `Transactions redesign (ADR 0109): the Calendar and selection figures` block.
4. `docs/contexts/client-state.md` - added the **Transactions redesign** `[0109]` bullet under `Money rules: src/selectors/`.
5. `docs/audit/task-ledger.md` - added the Phase 149 section and T809 row (`done`, `Commit` left empty).
6. `docs/audit/decisions/0109-transactions-table-and-calendar-views.md` - owner file, untracked, content and LF line endings untouched (`4b233a3025b6b3a725867f88475aa5b3ed81dd5a`).
7. `docs/design/transactions-2026-10/spec.md` - owner file, untracked, content and LF line endings untouched (`f9ee0348663f181c094d16908b76ec3c41769cc4`).
8. `workflow/stages/02_build/output/task-T809-build.md` - this build report.

## Tests Added and Fail-Then-Pass Evidence

Added 5 unit tests in `unit/selectors-ledger.test.ts` under `describe('Transactions redesign (ADR 0109): the Calendar and selection figures', ...)`:
1. `monthBounds spans the 1st to the last day of 28, 29, 30 and 31 day months`
2. `monthBounds steps from December into January`
3. `dailyTotals adds up to cashFlow to the cent, and a transfer moves count only`
4. `heatLevel is 0 to HEAT_LEVELS in thirds of the month top day, and never NaN`
5. `selectionSummary nets the selected rows by L1 and flags a row it leaves out`

### Red Run (before editing `src/selectors/timeRange.ts` and `src/selectors/ledger.ts`)
- Command: `npx vitest run unit/selectors-ledger.test.ts`
- Log path: `workflow/stages/02_build/output/logs/T809-red.log`
- Result: `Test Files 1 failed (1)`, `Tests 5 failed | 22 passed (27)`
- Quoted failure lines from `workflow/stages/02_build/output/logs/T809-red.log`:
```text
 ❯ unit/selectors-ledger.test.ts (27 tests | 5 failed) 67ms
   ❯ Transactions redesign (ADR 0109): the Calendar and selection figures (5)
     × monthBounds spans the 1st to the last day of 28, 29, 30 and 31 day months 8ms
     × monthBounds steps from December into January 1ms
     × dailyTotals adds up to cashFlow to the cent, and a transfer moves count only 2ms
     × heatLevel is 0 to HEAT_LEVELS in thirds of the month top day, and never NaN 4ms
     × selectionSummary nets the selected rows by L1 and flags a row it leaves out 1ms

 FAIL  unit/selectors-ledger.test.ts > Transactions redesign (ADR 0109): the Calendar and selection figures > monthBounds spans the 1st to the last day of 28, 29, 30 and 31 day months
TypeError: monthBounds is not a function
 ❯ unit/selectors-ledger.test.ts:287:12

 FAIL  unit/selectors-ledger.test.ts > Transactions redesign (ADR 0109): the Calendar and selection figures > monthBounds steps from December into January
TypeError: monthBounds is not a function
 ❯ unit/selectors-ledger.test.ts:294:12

 FAIL  unit/selectors-ledger.test.ts > Transactions redesign (ADR 0109): the Calendar and selection figures > dailyTotals adds up to cashFlow to the cent, and a transfer moves count only
TypeError: dailyTotals is not a function
 ❯ unit/selectors-ledger.ts:308:20

 FAIL  unit/selectors-ledger.test.ts > Transactions redesign (ADR 0109): the Calendar and selection figures > heatLevel is 0 to HEAT_LEVELS in thirds of the month top day, and never NaN
AssertionError: expected undefined to be 3 // Object.is equality
- Expected: 3
+ Received: undefined
 ❯ unit/selectors-ledger.test.ts:320:25

 FAIL  unit/selectors-ledger.test.ts > Transactions redesign (ADR 0109): the Calendar and selection figures > selectionSummary nets the selected rows by L1 and flags a row it leaves out
TypeError: selectionSummary is not a function
 ❯ unit/selectors-ledger.test.ts:343:21

 Test Files  1 failed (1)
      Tests  5 failed | 22 passed (27)
```

### Green Run (after editing `src/selectors/timeRange.ts` and `src/selectors/ledger.ts`)
- Command: `npx vitest run unit/selectors-ledger.test.ts unit/selectors-dashboard.test.ts`
- Result: `Test Files 2 passed (2)`, `Tests 68 passed (68)` (`unit/selectors-ledger.test.ts`: 27 passed; `unit/selectors-dashboard.test.ts`: 41 passed).

## Gate Commands and Results

1. **Lint (`npm run lint`)**
   - Result: exit 0 (`node-globals: 133 files in src, no Node globals.`, `safe-ids: 133 files in src, no id from the time alone.`, `tsc --noEmit` clean, `tsc -p api/tsconfig.json` clean).
2. **Related unit tests (`npx vitest run unit/selectors-ledger.test.ts unit/selectors-dashboard.test.ts`)**
   - Result: `Test Files 2 passed (2)`, `Tests 68 passed (68)` (506ms).
3. **Full unit suite (`npm run test:unit`)**
   - Log path: `workflow/stages/02_build/output/logs/T809-unit.log`
   - Result: `Test Files 69 passed (69)`, `Tests 1515 passed (1515)` (87.38s).
4. **Docs & export verification (`git grep -nE "export (function|const|interface) (monthBounds|dailyTotals|heatLevel|HEAT_LEVELS|selectionSummary)\b" src/selectors`)**
   - Result: 5 matching lines (`dailyTotals` at `src/selectors/ledger.ts:243`, `HEAT_LEVELS` at `:261`, `heatLevel` at `:269`, `selectionSummary` at `:286`, `monthBounds` at `src/selectors/timeRange.ts:54`).
5. **Text landed check**
   - Script comparison against `workflow/stages/01_spec/output/task-T809-spec.md` code blocks: `edit1 match: true`, `edit2 match: true`, `edit3 match: true`, `test block match: true`, `doc bullet match: true`.
6. **Owner files unchanged (`git hash-object docs/audit/decisions/0109-transactions-table-and-calendar-views.md docs/design/transactions-2026-10/spec.md`)**
   - Before build:
     - `docs/audit/decisions/0109-transactions-table-and-calendar-views.md`: `4b233a3025b6b3a725867f88475aa5b3ed81dd5a`
     - `docs/design/transactions-2026-10/spec.md`: `f9ee0348663f181c094d16908b76ec3c41769cc4`
   - After build:
     - `docs/audit/decisions/0109-transactions-table-and-calendar-views.md`: `4b233a3025b6b3a725867f88475aa5b3ed81dd5a`
     - `docs/design/transactions-2026-10/spec.md`: `f9ee0348663f181c094d16908b76ec3c41769cc4`
7. **Line endings (`git ls-files --eol src/selectors/timeRange.ts src/selectors/ledger.ts unit/selectors-ledger.test.ts docs/contexts/client-state.md docs/audit/task-ledger.md`)**
   - Result: all 5 tracked files show `w/crlf`.
8. **Em-dash check**
   - Added lines in `git diff -U0 HEAD`: `0`
   - Whole-file check on `docs/audit/decisions/0109-transactions-table-and-calendar-views.md`, `docs/design/transactions-2026-10/spec.md`, and `workflow/stages/02_build/output/task-T809-build.md`: `0`, `0`, `0`.
9. **Scope (`git status --porcelain`)**
   - Lists only the spec's target files, `docs/audit/task-ledger.md`, and the stage 01/02 output files.

## Anything Not Done
None. Everything in `workflow/stages/01_spec/output/task-T809-spec.md` is complete.
