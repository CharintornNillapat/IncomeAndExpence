# Spec: T809

This is Phase 149, on branch `phase-149-transactions-views`, which was cut from `main` at `27a6e5f`. T809 is the first task of the phase and covers task 1 of `docs/design/transactions-2026-10/spec.md` section 9. The id T809 is free: the ledger's highest id is T808 (`docs/audit/task-ledger.md:139`), and no `task-T809-*` file exists. ADR 0109 is already written by the owner (untracked), so this task needs no new ADR. The order names no Backlog row, so no Backlog status changes. Later redesign tasks take ids from T810 on.

## 1. Goal

Add four pure helpers to `src/selectors/`, with unit tests, for the Transactions page's Table and Calendar views (ADR 0109): `monthBounds`, `dailyTotals`, `heatLevel` with its `HEAT_LEVELS` constant, and `selectionSummary`. This task also opens Phase 149. It commits the owner's ADR 0109 and the redesign spec, and adds the phase's section to the task ledger.

## 2. Target files

```
src/selectors/timeRange.ts
src/selectors/ledger.ts
unit/selectors-ledger.test.ts
docs/contexts/client-state.md
docs/audit/decisions/0109-transactions-table-and-calendar-views.md
docs/design/transactions-2026-10/spec.md
```

- `src/selectors/timeRange.ts`: edits 1 and 2 in section 4.1, exactly as written there.
- `src/selectors/ledger.ts`: edit 3 in section 4.1, exactly as written.
- `unit/selectors-ledger.test.ts`: the import edits and the test block in section 6, exactly as written.
- `docs/contexts/client-state.md`: insert one new bullet after line 64 (the "L6 to L13" bullet) and before line 65 ("Match a system category by type"). Use exactly this text:
  ```
  - **Transactions redesign** [0109]: `monthBounds` (`selectors/timeRange.ts`, a month key's 1st to last day as `RangeBounds`). In `selectors/ledger.ts`: `dailyTotals` (each day's L1 income and spending, its L11 net and its row count, built on `groupByDay`); `heatLevel` with `HEAT_LEVELS` (0 to 3 against the month's top spending day, worked in whole cents); `selectionSummary` (count, L1 net, and `hasUncounted` when a selected row is neither income nor spending).
  ```
- `docs/audit/decisions/0109-transactions-table-and-calendar-views.md` and `docs/design/transactions-2026-10/spec.md`: the owner wrote these and they are untracked today. **Do not change their content.** They are listed only so that the orchestrator commits them with this task. Both are LF in the working tree (0 CRLF, 0 em dashes; checked while writing this spec). Leave them that way. With `core.autocrlf=true` the index stores LF regardless, and a "LF will be replaced by CRLF" warning on `git add` is harmless. If the builder finds a factual error in either file, it reports the error in the build report and does not fix it.
- Bookkeeping, always allowed: `docs/audit/task-ledger.md`. It has no Phase 149 section yet. Build it from the file's "Template for the next phase" block and place it after Phase 148's section (ends at `:139`) and before `## Backlog` (`:141`):
  - Heading: `## Phase 149 - Transactions redesign: Table and Calendar views (ADR 0109)`
  - A blank line, then the branch line: ``Branch `phase-149-transactions-views`, cut from `main` at `27a6e5f`.``
  - A blank line, then the table header from the template, with one row, exactly:
    ```
    | T809 | Pure helpers for the Transactions views: monthBounds, dailyTotals, heatLevel with HEAT_LEVELS, selectionSummary, and their unit tests (ADR 0109) | `src/selectors/timeRange.ts`, `src/selectors/ledger.ts`, `unit/selectors-ledger.test.ts`, `docs/contexts/client-state.md`, `docs/audit/decisions/0109-transactions-table-and-calendar-views.md`, `docs/design/transactions-2026-10/spec.md`, `docs/audit/task-ledger.md` | in-progress | | |
    ```
    Set Status to `in-progress` at the start of the task. At the end, set it to `done` and fill in the gate result. Leave the Commit cell empty (ledger header, `:3`).
  - Add no rows for T810 and later. The orchestrator assigns those ids when it orders each task.
- Not targets: `src/utils/date.ts`, which already has everything needed (`shiftIsoDate`, `shiftMonth`). Also not targets: `src/utils/money.ts`, `src/selectors/diary.ts`, `src/views/TransactionsView.tsx`, `src/index.css`, `DESIGN.md`, `AGENTS.md`, `README.md` and `docs/audit/test-selector-contract.md`.
- Pause rule: the Target files include `src/selectors/`, a money path. The orchestrator therefore pauses for the owner's go-ahead before sending `build T809`. This matches the "Pause after spec: yes" in design spec section 9, task 1.

## 3. Context to read

- `docs/contexts/client-state.md`, sections "Money and dates" (`:50-53`), "Money rules: `src/selectors/`" (`:55-65`) and "Unit tests for this layer" (`:124-133`). These cover the L1/L11 definitions, the `roundToCents` rule, the local-date rule and the test rules (TZ pinned, nothing exported only for a test).
- `docs/audit/decisions/0109-transactions-table-and-calendar-views.md`, D2 and D5. These explain why `HEAT_LEVELS` is the one exported constant.
- `docs/design/transactions-2026-10/spec.md`, section 6 (the table of the four helpers) and section 2, row O3.
- Not needed: `ui-and-e2e.md` and `DESIGN.md`, because no component or token changes. `supabase-ledger.md` is also not needed.

## 4. Current behaviour

1. None of the four helpers exists. A repo-wide search of `src/`, `unit/` and `tests/` for `monthBounds|dailyTotals|heatLevel|selectionSummary|HEAT_LEVELS` finds nothing.
2. The building blocks exist:
   - L1: `isSpending` and `isIncome` (`src/selectors/ledger.ts:36-43`) count only a live EXPENSE or INCOME that is not filed under a DEBT_REPAYMENT or ADJUSTMENT category, so a deleted row, a transfer, a repayment and an adjustment are never counted.
   - `sumSpending` and `sumIncome` (`:51-57`) round with `roundToCents` (`:45-49`, `src/utils/money.ts:22`).
   - `cashFlow` (`:72-81`) returns `{ income, spending, leftOver, spentPercent }`.
   - `groupByDay` (`:212-227`) groups by `transactionDate.slice(0, 10)`, puts the newest day first, keeps every row it is given (deleted ones included) in the day's `transactions`, and computes the L11 `net` as `roundToCents(sumIncome - sumSpending)`.
3. `RangeBounds` (`src/selectors/timeRange.ts:11-14`) holds inclusive local `YYYY-MM-DD` bounds, and `inRange` (`:37-40`) compares them as strings. `timeRange.ts:1` imports only `shiftIsoDate`.
4. `shiftIsoDate` (`src/utils/date.ts:43-48`) and `shiftMonth` (`:102-106`) step local calendar days and month keys without parsing an ISO string as UTC. `monthGrid` (`:113-124`) builds a month from `new Date(year, month, 0).getDate()`.
5. Today the Transactions page builds its bounds from `rangeBounds` or the day filter (`src/views/TransactionsView.tsx:130-133`) and labels uncounted rows with "Transfers and balance adjustments are not counted" (`:260`). This task does not touch either one.
6. A float trap the heat formula must avoid: in Node, `3 * 0.1 / 0.3` is `1.0000000000000002` and `3 * 0.2 / 0.3` is `2.0000000000000004`. A plain `Math.ceil(HEAT_LEVELS * spending / monthMax)` therefore gives 2 for a day at exactly a third, and 3 for a day at exactly two thirds (checked while writing this spec). The helper works in whole cents to avoid this.

### 4.1 The edits

All comments use plain hyphens and no em dash. Keep each file's CRLF working-tree endings.

**Edit 1, `src/selectors/timeRange.ts:1`.** Replace:
```ts
import { shiftIsoDate } from '../utils/date';
```
with:
```ts
import { shiftIsoDate, shiftMonth } from '../utils/date';
```

**Edit 2, `src/selectors/timeRange.ts`.** Insert after `filterByRange` (after `:47`, before the blank line and `function parts`), with one blank line before it:
```ts

/**
 * A calendar month (`YYYY-MM`) as inclusive bounds, its 1st to its last day:
 * the Transactions Calendar's month (spec 6, ADR 0109). Built from the month
 * key's own parts, so no ISO string is parsed as a UTC `Date`.
 */
export function monthBounds(monthKey: string): RangeBounds {
  return { start: `${monthKey}-01`, end: shiftIsoDate(`${shiftMonth(monthKey, 1)}-01`, -1) };
}
```

**Edit 3, `src/selectors/ledger.ts`.** Append after `groupByDay` (after `:227`, the file's last line), with one blank line before it:
```ts

export interface DayTotals {
  income: number;
  spending: number;
  /** Spec L11, the same figure as `groupByDay`'s `net`. */
  net: number;
  /** Every row given for the day: a transfer, a repayment, an adjustment and a deleted row count here. */
  count: number;
}

/**
 * The Transactions Calendar's figures per local day (spec 6, ADR 0109): L1
 * income and spending, the L11 net and the row count. Built on `groupByDay`,
 * so a calendar cell's net is the Table's day row net to the cent.
 */
export function dailyTotals(txs: Transaction[], categories?: CategoryLookup): Map<string, DayTotals> {
  const totals = new Map<string, DayTotals>();
  for (const day of groupByDay(txs, categories)) {
    totals.set(day.date, {
      income: sumIncome(day.transactions, categories),
      spending: sumSpending(day.transactions, categories),
      net: day.net,
      count: day.transactions.length,
    });
  }
  return totals;
}

/**
 * The Calendar's heat shades (spec O3, ADR 0109 D5): a spending day takes
 * 1 to `HEAT_LEVELS`, relative to the month's highest spending day, so no baht
 * threshold is fixed in code. One `heat-N` colour token per level.
 */
export const HEAT_LEVELS = 3;

/**
 * A day's heat, 0 to `HEAT_LEVELS`: `ceil(HEAT_LEVELS * spending / monthMax)`,
 * and 0 when the day or the month spent nothing. Worked in whole cents: in
 * floating point 3 * 0.1 / 0.3 is 1.0000000000000002, which would lift a day
 * at exactly a third to level 2. Comparison only, not ledger rounding.
 */
export function heatLevel(spending: number, monthMax: number): number {
  const day = Math.round(spending * 100);
  const max = Math.round(monthMax * 100);
  if (!(day > 0) || !(max > 0)) return 0;
  return Math.min(HEAT_LEVELS, Math.ceil((HEAT_LEVELS * day) / max));
}

export interface SelectionSummary {
  /** Selected rows found in `rows`; an id with no row there is not counted. */
  count: number;
  /** L1 income minus spending of the selected rows, to the cent. */
  net: number;
  /** A selected row is neither income nor spending (a transfer, a repayment, an adjustment, a movement-category row or a deleted row), so `net` leaves it out. */
  hasUncounted: boolean;
}

/** The Table's bulk bar (spec 4.1 and 6, ADR 0109 D7): what the selection holds and its L1 net. */
export function selectionSummary(
  rows: Transaction[],
  ids: ReadonlySet<string>,
  categories?: CategoryLookup
): SelectionSummary {
  const selected = rows.filter((tx) => ids.has(tx.id));
  return {
    count: selected.length,
    net: roundToCents(sumIncome(selected, categories) - sumSpending(selected, categories)),
    hasUncounted: selected.some((tx) => !isIncome(tx, categories) && !isSpending(tx, categories)),
  };
}
```

Notes the builder does not need to act on, recorded so the reviewer can check them:

- `heatLevel`'s `Math.round(x * 100)` converts to integer cents for a comparison. It is not the forbidden inline `Math.round(x*100)/100` ledger rounding (`client-state.md:50`), because nothing is divided back and nothing is stored. The `!(x > 0)` guards also return 0 for `NaN`. A `spending` above `monthMax` clamps to `HEAT_LEVELS`.
- `hasUncounted` is true exactly when a selected row is left out of `net`. That includes a deleted row, which design spec 4.1 does not mention, because L1 never counts a deleted row. How the bulk bar words this (and what it shows when every selected row is deleted, so Restore is offered) is a decision for design spec task 5, not this task.
- The categories argument is optional (`categories?: CategoryLookup`), as on every other L1 selector in the file. `ids` is a `ReadonlySet<string>`.

## 5. Parity map

None. These are new read-only selectors. No `AGENTS.md` parity row covers them, and they add no ledger arithmetic.

## 6. Tests to add

All tests go in `unit/selectors-ledger.test.ts`, which already pins `TZ` to Asia/Bangkok (`:20-26`) and has the `tx()` factory (`:39-53`), `BY_ID` (`:37`) and `MIXED` (`:58-70`). Keeping them in this file leaves the file count at 69.

**Import edits** (top of the file):
- `:2` becomes `import { isSpending, isIncome, sumSpending, sumIncome, spendingByCategory, groupByDay, cashFlow, dailyTotals, heatLevel, HEAT_LEVELS, selectionSummary } from '../src/selectors/ledger';`
- `:3` becomes `import { rangeBounds, inRange, filterByRange, formatRangeLabel, monthBounds } from '../src/selectors/timeRange';`
- `:6` becomes `import { shiftIsoDate, shiftMonth } from '../src/utils/date';`
- Insert after `:7` (the `buildLookupMap` import): `import { roundToCents } from '../src/utils/money';`

**Test block.** Append at the end of the file, after the L12 `describe` (`:272-282`), with one blank line before it:

```ts

describe('Transactions redesign (ADR 0109): the Calendar and selection figures', () => {
  it('monthBounds spans the 1st to the last day of 28, 29, 30 and 31 day months', () => {
    expect(monthBounds('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthBounds('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(monthBounds('2026-09')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(monthBounds('2026-10')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
  });

  it('monthBounds steps from December into January', () => {
    expect(monthBounds('2026-12')).toEqual({ start: '2026-12-01', end: '2026-12-31' });
    expect(monthBounds(shiftMonth('2026-12', 1))).toEqual({ start: '2027-01-01', end: '2027-01-31' });
    expect(inRange('2026-12-31', monthBounds('2026-12'))).toBe(true);
    expect(inRange('2027-01-01', monthBounds('2026-12'))).toBe(false);
  });

  it('dailyTotals adds up to cashFlow to the cent, and a transfer moves count only', () => {
    const rows = [
      ...MIXED,
      tx({ type: 'EXPENSE', amount: 0.1, transactionDate: '2026-09-27' }),
      tx({ type: 'EXPENSE', amount: 0.2, transactionDate: '2026-09-27' }),
      tx({ type: 'INCOME', amount: 12.34, transactionDate: '2026-09-27' }),
      tx({ type: 'TRANSFER', amount: 500, destinationWalletId: 'wal-main', transactionDate: '2026-09-26' }),
    ];
    const totals = dailyTotals(rows, BY_ID);
    const flow = cashFlow(rows, BY_ID);
    const days = Array.from(totals.values());
    expect(roundToCents(days.reduce((sum, day) => sum + day.income, 0))).toBe(flow.income);
    expect(roundToCents(days.reduce((sum, day) => sum + day.spending, 0))).toBe(flow.spending);
    expect(totals.get(TODAY)).toEqual({ income: 1000, spending: 150.5, net: 849.5, count: MIXED.length });
    expect(totals.get('2026-09-27')).toEqual({ income: 12.34, spending: 0.3, net: 12.04, count: 3 });
    expect(totals.get('2026-09-26')).toEqual({ income: 0, spending: 0, net: 0, count: 1 });
    expect(totals.has('2026-09-25')).toBe(false);
  });

  it('heatLevel is 0 to HEAT_LEVELS in thirds of the month top day, and never NaN', () => {
    expect(HEAT_LEVELS).toBe(3);
    expect(heatLevel(0, 300)).toBe(0);
    expect(heatLevel(0, 0)).toBe(0);
    expect(heatLevel(5, 0)).toBe(0);
    expect(heatLevel(Number.NaN, 300)).toBe(0);
    expect(heatLevel(300, 300)).toBe(HEAT_LEVELS);
    expect(heatLevel(0.01, 300)).toBe(1);
    expect(heatLevel(100, 300)).toBe(1);
    expect(heatLevel(100.01, 300)).toBe(2);
    expect(heatLevel(200, 300)).toBe(2);
    // In floating point 3 * 0.1 / 0.3 is 1.0000000000000002: still exactly a third.
    expect(heatLevel(0.1, 0.3)).toBe(1);
    expect(heatLevel(0.2, 0.3)).toBe(2);
  });

  it('selectionSummary nets the selected rows by L1 and flags a row it leaves out', () => {
    const rows = [
      tx({ type: 'INCOME', amount: 1000, categoryId: 'cat-salary' }),
      tx({ type: 'EXPENSE', amount: 100.25, categoryId: 'cat-food' }),
      tx({ type: 'EXPENSE', amount: 50.25, categoryId: 'cat-groceries' }),
      tx({ type: 'TRANSFER', amount: 500, destinationWalletId: 'wal-main' }),
    ];
    const [income, food, groceries, transfer] = rows;
    const counted = selectionSummary(rows, new Set([income.id, food.id, 'tx-not-loaded']), BY_ID);
    expect(counted).toEqual({
      count: 2,
      net: roundToCents(sumIncome([income, food], BY_ID) - sumSpending([income, food], BY_ID)),
      hasUncounted: false,
    });
    expect(counted.net).toBe(899.75);
    expect(selectionSummary(rows, new Set([groceries.id, transfer.id]), BY_ID)).toEqual({ count: 2, net: -50.25, hasUncounted: true });
    const deleted = MIXED.find((t) => t.isDeleted)!;
    expect(selectionSummary(MIXED, new Set([deleted.id]), BY_ID)).toEqual({ count: 1, net: 0, hasUncounted: true });
    expect(selectionSummary(rows, new Set(), BY_ID)).toEqual({ count: 0, net: 0, hasUncounted: false });
  });
});
```

What each test catches:
- The two `monthBounds` tests catch a wrong month length (an off-by-one at the 28th to 31st, a leap year) and a December that does not step into the next year.
- The `dailyTotals` test catches per-day sums that drift from `cashFlow`, a net that is not L11, and a `count` that skips transfers or deleted rows. `MIXED.length` is 10 and includes the deleted row and the movement rows.
- The `heatLevel` test catches the float trap in section 4, item 6, a `NaN` or `Infinity` from a zero `monthMax`, and an unclamped level.
- The `selectionSummary` test catches a net that is not L1 income minus spending, an id outside `rows` being counted, and a transfer or deleted row not setting `hasUncounted`.

**Why each fails today:** none of the five exports exists (section 4, item 1). Vitest does not type-check, so each named import is `undefined`, and every new test fails with `TypeError: ... is not a function`. The `heatLevel` test fails first at `expect(HEAT_LEVELS).toBe(3)` (`Received: undefined`). The 22 existing tests in the file pass in both states.

**Red run** (stage 02, step 4). Write the test edits first. Then, with `src/selectors/timeRange.ts` and `src/selectors/ledger.ts` still unedited (or stashed with `git stash push -- src/selectors/timeRange.ts src/selectors/ledger.ts` if they were already edited), run `npx vitest run unit/selectors-ledger.test.ts`. Expect 5 failed and 22 passed, with the 5 failures being exactly the five new tests. Save the output to `workflow/stages/02_build/output/logs/T809-red.log`. Then restore the selector edits (`git stash pop`) and confirm 27 passed.

## 7. Gates

The changed paths are `src/selectors/` (selectors tier), `unit/` (unit tier), and docs (`docs/contexts/client-state.md`, the ledger, plus the two owner files with no change). The union of their tiers, as commands, in this order:

```
npm run lint
npx vitest run unit/selectors-ledger.test.ts unit/selectors-dashboard.test.ts
npm run test:unit
```

- Expected: `unit/selectors-ledger.test.ts` 27 passed. For the full unit run, 1515 tests in 69 files (today 1510 in 69, plus 5 new). Report the real figures. Do not edit the counts in `AGENTS.md` or `README.md`; the task that ships the phase does that.
- Save the full `npm run test:unit` output with `tee` to `workflow/stages/02_build/output/logs/T809-unit.log`.
- Money path: the red run in section 6, saved to `workflow/stages/02_build/output/logs/T809-red.log`.
- No Playwright gate. No existing export or behaviour changes, and nothing in `src/` imports the new helpers yet, so no spec is affected. Tasks 2, 3 and 5 wire them in and run their own specs.
- Docs tier: the new `client-state.md` bullet names `monthBounds`, `dailyTotals`, `heatLevel`, `HEAT_LEVELS`, `selectionSummary`, `groupByDay` and `RangeBounds`. Check that each one exists as written with `git grep -nE "export (function|const|interface) (monthBounds|dailyTotals|heatLevel|HEAT_LEVELS|selectionSummary)\b" src/selectors` (5 lines).
- Text landed: `git diff src/selectors/timeRange.ts src/selectors/ledger.ts` shows only edits 1 to 3 of section 4.1. Their text must be as written there (compare against this spec's code blocks with a script, not by eye), with no other hunk. `git diff unit/selectors-ledger.test.ts` shows only the four import lines and the appended block. `docs/contexts/client-state.md` gains exactly one line.
- Owner files unchanged: `git hash-object docs/audit/decisions/0109-transactions-table-and-calendar-views.md docs/design/transactions-2026-10/spec.md` gives the same two hashes before and after the build. Record both in the build report.
- Line endings: `git ls-files --eol src/selectors/timeRange.ts src/selectors/ledger.ts unit/selectors-ledger.test.ts docs/contexts/client-state.md docs/audit/task-ledger.md` still shows `w/crlf` on each.
- Em dashes: 0 in the added lines, checked with `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"`. Also 0 in the two owner files and the build report, checked with `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" docs/audit/decisions/0109-transactions-table-and-calendar-views.md docs/design/transactions-2026-10/spec.md workflow/stages/02_build/output/task-T809-build.md`.
- Scope: `git status --porcelain` lists only section 2's files, the ledger and the build report.

## 8. Production touch points

None. No Supabase, no `/api/*`, no `vercel.json` or workflow change, no sign-in. The `set_transactions_deleted` migration is design spec task 4 and is not part of this task.

## 9. Out of scope

- Every UI piece: the view switch, `TxCalendar`, the day panel, the bulk bar, the `heat-1` to `heat-3` tokens and `scripts/wcag-tokens.mjs` (design spec tasks 2, 3 and 5). Also the stored-view key constant (task 2).
- `set_transactions_deleted`, the guest twin in `FinanceContext.tsx` and the parity-map row (task 4).
- Changing `groupByDay`, `cashFlow`, `rangeBounds`, `monthGrid`, `shiftMonth` or any other existing export, and moving a helper into `src/utils/date.ts`. The design spec's section 6 table puts all four in `src/selectors/`.
- The "Transfers and balance adjustments are not counted" caption (`TransactionsView.tsx:260`), and how the bulk bar words `hasUncounted` (task 5).
- `DESIGN.md`, `AGENTS.md`, `README.md`, `refactor-log.md`, `baseline-metrics.md` and the test-selector contract.
- Any content edit to ADR 0109 or the design spec, including line endings.
