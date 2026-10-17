# T763 spec: the daily spending series (Dashboard redesign SEL-2)

Phase 134, branch `phase-134-dashboard-selectors` (cut from `main` at `3927c83`; T762's `e6fb160` is on it). Order: Dashboard redesign task SEL-2, owner spec `docs/design/dashboard-2026-10/spec.md:85`, section 5.2 (`spec.md:69`). Money path: tests first. This task does not ship the phase (SEL-3 does).

Owner decision (answer to this task's BLOCKED question, 2026-10-17): WEEK has **8 points**, the same days as the card's figures, not the 7 that `spec.md:69` says. This task corrects that line.

## 1. Goal

Add one pure selector that gives the Left over card's sparkline one spending figure per local day of the period, oldest first and zero-filled: 8 points for WEEK, 31 for MONTH, none (`null`) for DAY and ALL. Fix the owner spec's line to say 8 points for WEEK and that every series covers the days of `filterByRange` for its period.

## 2. Target files

```
src/selectors/diary.ts
unit/selectors-dashboard.test.ts
docs/design/dashboard-2026-10/spec.md
```

No ADR: ADR 0102 records the Phase 134 selectors (Consequences: "Phase 134 adds the three selectors of the owner spec's section 5"), and the 8-point WEEK is the owner's answer recorded here and in `spec.md` itself. No `refactor-log.md` or `baseline-metrics.md`: SEL-3 ships Phase 134.

## 3. Context to read

- `docs/contexts/client-state.md`, sections "Money and dates" and "Money rules: `src/selectors/`" (L1, L2, `roundToCents`, `today` as an argument), and "Unit tests for this layer" (`TZ`, nothing exported only for a test).
- `docs/design/dashboard-2026-10/spec.md` sections 4.2 (`:53`) and 5 (`:66` to `:70`). Do not open the HTML mock; this task names no mock lines.

## 4. Current behaviour

- `daySpending(txs, date, categories?)` (`src/selectors/diary.ts:27-36`) sums one local day's L1 spending (`isSpending`, so transfers, repayments, adjustments, movement-category expenses and deleted rows are out), rounded with `roundToCents`, plus a row count. It matches the day by `transactionDate.slice(0, 10)` (`:31`). Callers: `DiaryView.tsx:50`, `:54`, `moodSpendingDays` (`diary.ts:76`); tested in `unit/diary-page.test.tsx:299-306`.
- `diary.ts` already imports `isSpending` and `CategoryLookup` from `./ledger` (`:2`) and `TimeRange`, `inRange`, `rangeBounds` from `./timeRange` (`:4`). `ledger.ts` does not import `diary.ts`, so the new selector goes in `diary.ts` beside `daySpending` (putting it in `ledger.ts` would make a cycle).
- `rangeBounds` (`src/selectors/timeRange.ts:166-177`): WEEK starts at `today - 7` and MONTH at `today - 30`, both with an open end; DAY is today only; ALL is open both sides. WEEK is 8 days inclusive and MONTH 31 (`timeRange.ts:160-161`). `filterByRange` (`:186-190`) keeps rows inside those bounds; `leftOverFor` (`src/selectors/ledger.ts:98-115`) reads its figures through it.
- `shiftIsoDate(iso, days)` (`src/utils/date.ts:43-48`) steps a calendar day from local date parts.
- Nothing builds a per-day series today. `spec.md:69` reads "WEEK 7 points", which does not match the 8-day WEEK range.
- `unit/selectors-dashboard.test.ts` imports `moodSpendingDays` from `../src/selectors/diary` (`:4`); the `leftOverFor` block runs `:120-245`; the `walletShares` block starts at `:247`. All four touched files are CRLF in the work tree (`git ls-files --eol`: `i/lf w/crlf`).

## 5. Parity map

None. The selector reuses `daySpending`, `filterByRange` and `rangeBounds` and adds no ledger arithmetic.

## 6. Tests to add

All in `unit/selectors-dashboard.test.ts`, in a new `describe('dailySpendingSeries: the Left over sparkline (owner spec 5.2)', ...)` placed right after the `leftOverFor` block (after `:245`, before `walletShares`). Change the import at `:4` to `import { dailySpendingSeries, moodSpendingDays } from '../src/selectors/diary';`. Reuse `tx()`, `BY_ID`, `TODAY` (`'2026-09-28'`), `shiftIsoDate` and `leftOverFor`. Money compares with `toBe`, except test 6's sums (`toBeCloseTo(x, 10)`).

Every test fails today: `dailySpendingSeries` is not exported from `src/selectors/diary.ts`, so each call throws `TypeError: ... is not a function` (and `npm run lint` reports TS2305). Write them all first, run `npx vitest run unit/selectors-dashboard.test.ts` against the unchanged `diary.ts`, and record that the new tests fail and the existing ones pass.

1. **WEEK is 8 points, oldest first, zero-filled.** Rows: EXPENSE 40 (`cat-food`) on `shiftIsoDate(TODAY, -7)`, EXPENSE 25 on `TODAY`, EXPENSE 12.5 on `shiftIsoDate(TODAY, -3)`. `dailySpendingSeries(rows, 'WEEK', TODAY, BY_ID)` has length 8; `.map(p => p.date)` equals `[-7, -6, -5, -4, -3, -2, -1, 0].map(n => shiftIsoDate(TODAY, n))`; spending per point is `[40, 0, 0, 0, 12.5, 0, 0, 25]`. Catches 7 points, newest-first order and missing zero days.
2. **MONTH is 31 points.** Same call with `'MONTH'` and no rows (`[]`): length 31, first date `shiftIsoDate(TODAY, -30)`, last date `TODAY`, every `spending` 0.
3. **DAY and ALL have no series.** With test 1's rows, `'DAY'` and `'ALL'` both return `null`.
4. **L1 only, summed and rounded per day.** All on `TODAY`, WEEK: EXPENSE 0.1 and EXPENSE 0.2 (`cat-food`), an INCOME 500, a TRANSFER 300, a DEBT_REPAYMENT 1000 (`cat-debt`), an EXPENSE 70 filed under `cat-debt`, an ADJUSTMENT -50 (`cat-adjust`), a deleted EXPENSE 9. The last point's `spending` is exactly `0.3` (`0.1 + 0.2` is `0.30000000000000004` unrounded). Catches a series that counts non-spending rows or skips `daySpending`'s rounding.
5. **Only the range's days.** EXPENSE 5 on `shiftIsoDate(TODAY, -8)` and EXPENSE 6 on `shiftIsoDate(TODAY, 1)`: the WEEK series is still 8 points from `-7` to `TODAY`, every `spending` 0. EXPENSE 7 on `shiftIsoDate(TODAY, -31)`: the MONTH series is 31 points, every `spending` 0.
6. **Adds up to the card's Spending.** Rows inside both ranges: EXPENSE 100.1 on `-30`, 200.2 on `-7`, 0.7 on `-1`, 50 on `TODAY`, an INCOME 999 on `-2`. For WEEK and for MONTH, the sum of the series' `spending` is close to `leftOverFor(rows, range, TODAY, 0, BY_ID).spending`. Catches a series that covers other days than the card's figures (the owner's reason for 8 points).
   - **A future-dated row: the intended gap (owner decision).** Add a separate `it` in the same group: test 6's rows plus an EXPENSE 30 (`cat-food`) on `shiftIsoDate(TODAY, 1)`. For WEEK and for MONTH: `leftOverFor(rows, range, TODAY, 0, BY_ID).spending` counts it (close to test 6's figure plus 30); the series has no point whose `date` is `shiftIsoDate(TODAY, 1)`; its length stays 8 (WEEK) and 31 (MONTH); and the sum of its `spending` is close to `leftOverFor(...).spending - 30`. This documents the gap as intended: the card counts a row dated after today, the sparkline does not.
7. **Both time zones.** A loop `for (const zone of ['UTC', 'Asia/Bangkok'] as const)` making one `describe(\`in ${zone}\`, ...)` each, with `beforeAll(() => { process.env.TZ = zone; })` and `afterAll(() => { process.env.TZ = 'Asia/Bangkok'; })`. Inside, one test that first asserts the zone took effect: `expect(new Date(2026, 9, 17).getTimezoneOffset()).toBe(zone === 'UTC' ? 0 : -420)` (T762's review: a worker thread would ignore the switch). Then, with literal dates only: `today = '2026-10-17'`, WEEK has 8 points, first `'2026-10-10'`, last `'2026-10-17'`; MONTH has 31 points, first `'2026-09-17'`; across a year end, `today = '2027-01-03'`, WEEK's first date is `'2026-12-27'` and its dates are 8 distinct, consecutive days (check the list equals `['2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']`).

Existing tests stay unchanged and must still pass.

## 7. The code change

### 7.1 `src/selectors/diary.ts`

Change the imports to:

```ts
import { DiaryEntry, Transaction } from '../types';
import { CategoryLookup, isSpending } from './ledger';
import { roundToCents } from '../utils/money';
import { shiftIsoDate } from '../utils/date';
import { TimeRange, filterByRange, inRange, rangeBounds } from './timeRange';
```

After `daySpending` (`:36`), add:

```ts
export interface SpendingPoint {
  /** Local calendar day, `YYYY-MM-DD`. */
  date: string;
  /** That day's spending on the L1 definition; 0 on a day with none. */
  spending: number;
}

/**
 * The Left over card's sparkline (owner spec 5.2, ADR 0102): one point per
 * local day from the range's first day through `today`, oldest first,
 * zero-filled. WEEK is 8 points and MONTH 31, the days `filterByRange` gives
 * the card's figures. A row dated after today has no point. `null` for DAY
 * and ALL, which show no sparkline.
 */
export function dailySpendingSeries(
  txs: Transaction[],
  range: TimeRange,
  today: string,
  categories?: CategoryLookup
): SpendingPoint[] | null {
  if (range === 'DAY' || range === 'ALL') return null;
  const rows = filterByRange(txs, range, today);
  const points: SpendingPoint[] = [];
  for (let date = rangeBounds(range, today).start!; date <= today; date = shiftIsoDate(date, 1)) {
    points.push({ date, spending: daySpending(rows, date, categories).spending });
  }
  return points;
}
```

`rangeBounds(...).start` is never `null` for WEEK or MONTH, hence the `!`. Do not change `daySpending`, `moodSpendingDays` or `diaryMonth`.

Owner decision (2026-10-17, at the pause): the series stops at `today`, kept as written. WEEK and MONTH have an open end, so a row dated after today counts in `leftOverFor`'s Spending but has no point (tests 5 and 6's future-dated case). Every other case adds up exactly (test 6).

### 7.2 `docs/design/dashboard-2026-10/spec.md`, line 69 only

Old line (exact):

```
2. **Daily spending series:** one point per local day in the range, from `daySpending`, oldest first, zero-filled: WEEK 7 points, MONTH 31. `null` for DAY and ALL.
```

New line (exact):

```
2. **Daily spending series:** one point per local day in the range, from `daySpending`, oldest first, zero-filled: WEEK 8 points, MONTH 31. Every series covers exactly the days of `filterByRange` for its period. `null` for DAY and ALL.
```

Change nothing else in `spec.md`. Keep its CRLF line endings.

Keep CRLF in all three files. No em dash in code, comments or docs.

## 8. Gates

Run in this order; save full-suite output to `workflow/stages/02_build/output/logs/`.

1. Red: after writing the tests and before touching `diary.ts`, `npx vitest run unit/selectors-dashboard.test.ts`: the new `dailySpendingSeries` tests fail, the existing ones pass.
2. `npm run lint`
3. `npx vitest run unit/selectors-dashboard.test.ts unit/selectors-ledger.test.ts unit/diary-page.test.tsx unit/selectors-debts.test.ts`
4. `npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T763-unit.log`
5. Playwright: no affected spec. Nothing in `src/` calls `dailySpendingSeries` yet, and `daySpending`/`moodSpendingDays` are unchanged; state this in the build report.
6. `spec.md` changed one line only: `git diff --numstat docs/design/dashboard-2026-10/spec.md` prints `1	1`, and the added line is exactly 7.2's new line. The count it states (WEEK 8, MONTH 31) is checked by tests 1, 2 and 7.
7. `git ls-files --eol src/selectors/diary.ts unit/selectors-dashboard.test.ts docs/design/dashboard-2026-10/spec.md` still shows `w/crlf` for all three.
8. `node -e "for (const f of process.argv.slice(1)) console.log(f, (require('fs').readFileSync(f, 'utf8').match(/\u2014/g) || []).length)" src/selectors/diary.ts unit/selectors-dashboard.test.ts docs/design/dashboard-2026-10/spec.md` prints 0 for all three.
9. `git status --porcelain` lists only the three target files, `docs/audit/task-ledger.md` and this task's stage outputs.

## 9. Bookkeeping

In `docs/audit/task-ledger.md`, under the Phase 134 table (after the T762 row, `:98`), add: `| T763 | Dashboard redesign SEL-2: the daily spending series (owner spec 5.2); WEEK 8 points (owner decision) | \`src/selectors/diary.ts\`, \`unit/selectors-dashboard.test.ts\`, \`docs/design/dashboard-2026-10/spec.md\` | done | | <gate results> |`. Leave `Commit` empty.

## 10. Production touch points

None. No SQL, no `/api/*`, no config, no dependency.

## 11. Out of scope

- `src/views/DashboardView.tsx` and every component: drawing the sparkline is UI-1 (Phase 135).
- `daySpending`, `moodSpendingDays`, `diaryMonth`, `DiaryView.tsx`: unchanged.
- `src/selectors/ledger.ts` (`leftOverFor`, `cashFlow`), `src/selectors/timeRange.ts`, `src/utils/date.ts`.
- Any other line of `spec.md`, including section 4.2 (`:53`) and 5.3 (`:70`).
- T762's zone tests (`unit/selectors-dashboard.test.ts:220-244`): do not add the offset guard there; only the new block gets it.
- SEL-3, `docs/contexts/client-state.md`, `DESIGN.md`, `refactor-log.md`, `baseline-metrics.md`.
