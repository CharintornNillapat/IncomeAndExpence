# T764 spec: the month-to-date comparison (Dashboard redesign SEL-3), and the Phase 134 paperwork

Phase 134, branch `phase-134-dashboard-selectors` (cut from `main` at `3927c83`; T762 `e6fb160` and T763 `30da09d` are on it). Order: Dashboard redesign task SEL-3, owner spec `docs/design/dashboard-2026-10/spec.md:86`, section 5.3 (`spec.md:70`), plus the owner's dates to cover and a tightened T763 test. Money path: tests first. **This task ships Phase 134.**

## 1. Goal

Add one pure selector for the Dashboard's month comparison line: spending and left over for day 1 to N of this month against day 1 to N of last month, N being today's day clamped to last month's length, with the percent change of each (`null` when last month's figure is 0). Make T763's future-dated test state directly that the card counts the row. Ship Phase 134's paperwork.

## 2. Target files

```
src/selectors/ledger.ts
unit/selectors-dashboard.test.ts
docs/contexts/client-state.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

No ADR: ADR 0102 records this work (D4, and Consequences: "Phase 134 adds the three selectors of the owner spec's section 5"). `docs/design/dashboard-2026-10/spec.md` is not changed by this task.

## 3. Context to read

- `docs/contexts/client-state.md`, sections "Money and dates", "Money rules: `src/selectors/`" and "Unit tests for this layer".
- `docs/design/dashboard-2026-10/spec.md` sections 1 (D4, `:12`), 4.3 (`:56`) and 5 (`:66` to `:70`); ADR 0102's D4. Do not open the HTML mock.

## 4. Current behaviour

- `cashFlow(txs, categories?)` (`src/selectors/ledger.ts:71-80`) gives `income`, `spending`, `leftOver` (rounded with `roundToCents`, `:77`) on the L1 definition. `leftOverFor` (`:98-114`) is T762's.
- `ledger.ts` imports `filterByRange, TimeRange` from `./timeRange` (`:3`). `inRange(date, bounds)` (`src/selectors/timeRange.ts:37-40`) compares `date.slice(0, 10)` against inclusive ISO-string bounds.
- `src/utils/date.ts` has `monthKeyOf(iso)` (`:97-99`, `2026-09-28` to `2026-09`) and `shiftIsoDate(iso, days)` (`:43-48`, local calendar parts). It imports nothing, so `ledger.ts` can import it without a cycle. The day before a month's 1st is last month's last day, so `shiftIsoDate(\`${monthKeyOf(today)}-01\`, -1)` gives last month's key and length with no new helper (`debts.ts:14`'s private `daysInMonth` stays where it is).
- Nothing computes a month-to-date comparison today.
- T763's future-dated test (`unit/selectors-dashboard.test.ts:328-345`) proves the card counts the row only through `expect(sum).toBeCloseTo(flow.spending - 30, 10)` (`:343`); T763's review asked for a direct check.
- `docs/contexts/client-state.md:63` lists the Dashboard's selectors as "`cashFlow`, `walletShares`, `moodSpendingDays`".
- Last shipped figures: `docs/audit/baseline-metrics.md`, "Phase 132 - delta against Phase 129" (entry `index-C7LsbYem.js` 191,696 B / 55,810 B gzip; all app JS 878,229 B / 266,912 B gzip, 40 files; CSS `index-CqllkKUj.css` 52,759 / 10,159; Vitest 62 files, 1378 tests). Phase 133 was docs only and added no section.
- All seven touched files are CRLF in the work tree (`git ls-files --eol`: `i/lf w/crlf`).

## 5. Parity map

None. The selector reuses `cashFlow` and `inRange` and adds no ledger arithmetic.

## 6. Tests to add

### 6.1 `monthToDate` tests

In `unit/selectors-dashboard.test.ts`, a new `describe('monthToDate: the month comparison line (owner spec 5.3)', ...)` right after the `dailySpendingSeries` block (after `:385`, before `walletShares`). Change the import at `:2` to `import { cashFlow, leftOverFor, monthToDate, spendingByCategory } from '../src/selectors/ledger';`. Reuse `tx()` and `BY_ID`. Write every date as a literal (no `shiftIsoDate`), so the expected dates do not depend on the code under test. Money compares with `toBe`, percents with `toBeCloseTo(x, 10)`.

Every test fails today: `monthToDate` is not exported from `src/selectors/ledger.ts`, so each call throws `TypeError: ... is not a function` (and `npm run lint` reports TS2305). Write them first, run `npx vitest run unit/selectors-dashboard.test.ts` against the unchanged `ledger.ts`, and record that the new tests fail and the existing ones pass.

1. **Mid-month, L1 only, every field.** `today = '2026-10-17'`. Rows: INCOME 1000 (`cat-salary`) on `2026-10-01`; EXPENSE 300 (`cat-food`) on `2026-10-17`; EXPENSE 99 on `2026-10-18` (after today); EXPENSE 1 on `2026-09-30` (last month, after day 17); INCOME 800 on `2026-09-01`; EXPENSE 200 on `2026-09-17`; EXPENSE 500 on `2026-09-18`; and on `2026-09-10` a TRANSFER 400, a DEBT_REPAYMENT 100 (`cat-debt`), an EXPENSE 60 under `cat-debt`, an ADJUSTMENT -50 (`cat-adjust`) and a deleted EXPENSE 70. Expect `days` 17; `thisMonth` `{ start: '2026-10-01', end: '2026-10-17', spending: 300, leftOver: 700 }`; `lastMonth` `{ start: '2026-09-01', end: '2026-09-17', spending: 200, leftOver: 600 }`; `spendingChange` close to 50; `leftOverChange` close to `100 / 600 * 100`.
2. **The 31st against a 30-day month.** `today = '2026-10-31'`, rows EXPENSE 10 on `2026-10-30`, EXPENSE 45 on `2026-10-31`, EXPENSE 20 on `2026-09-30`. Expect `days` 30; `thisMonth.end` `'2026-10-30'`, `thisMonth.spending` 10 (the 31st is outside day 1 to N); `lastMonth.end` `'2026-09-30'`, `lastMonth.spending` 20; `spendingChange` close to -50.
3. **March 29 to 31 against February, leap and non-leap.** Loop over `'2028-03-29'`, `'2028-03-30'`, `'2028-03-31'` (2028 is a leap year): `days` 29, `lastMonth` `{ start: '2028-02-01', end: '2028-02-29' }`, `thisMonth.end` `'2028-03-29'`. Loop over `'2027-03-29'`, `'2027-03-30'`, `'2027-03-31'`: `days` 28, `lastMonth.end` `'2027-02-28'`, `thisMonth.end` `'2027-03-28'`. With a row EXPENSE 5 on `'2027-02-28'` and EXPENSE 8 on `'2027-03-29'`, on `today = '2027-03-29'` `lastMonth.spending` is 5 and `thisMonth.spending` is 0. Also `today = '2028-03-28'`: `days` 28, not clamped.
4. **January against the previous December.** `today = '2027-01-15'`: `days` 15, `lastMonth` `{ start: '2026-12-01', end: '2026-12-15' }`; with EXPENSE 12 on `2026-12-15` and EXPENSE 13 on `2026-12-16`, `lastMonth.spending` is 12. `today = '2027-01-31'`: `days` 31, `lastMonth.end` `'2026-12-31'`, `thisMonth.end` `'2027-01-31'`. `today = '2027-01-01'`: `days` 1, `lastMonth` `{ start: '2026-12-01', end: '2026-12-01' }`.
5. **No figure last month.** `today = '2026-10-17'`, rows: EXPENSE 50 on `2026-10-05` only. `lastMonth.spending` 0 and `lastMonth.leftOver` 0, so `spendingChange` and `leftOverChange` are both `null`. With `[]`: every money figure 0, both changes `null`, and every number in the result (including nested ones) passes `Number.isFinite`.
6. **A negative base.** `today = '2026-10-17'`. September 1 to 17: INCOME 100, EXPENSE 300 (`leftOver` -200). October 1 to 17: INCOME 100, EXPENSE 200 (`leftOver` -100). `spendingChange` close to `-100 / 300 * 100`; `leftOverChange` close to 50 (left over improved by 100 on a base of 200, so the change is positive: the divisor is the size of last month's figure).
7. **Cents.** `today = '2026-10-17'`, EXPENSE 0.1 and EXPENSE 0.2 on `2026-09-03`: `lastMonth.spending` is exactly `0.3`.
8. **Both time zones.** `for (const zone of ['UTC', 'Asia/Bangkok'] as const)`, one `describe(\`in ${zone}\`, ...)` each, `beforeAll` sets `process.env.TZ = zone`, `afterAll` restores `'Asia/Bangkok'`. One test that first asserts `expect(new Date(2026, 9, 17).getTimezoneOffset()).toBe(zone === 'UTC' ? 0 : -420)`, then: `'2028-03-31'` gives `days` 29 and `lastMonth.end` `'2028-02-29'`; `'2027-03-31'` gives 28 and `'2027-02-28'`; `'2027-01-01'` gives 1 and `lastMonth.start` `'2026-12-01'`; `'2026-10-31'` gives 30.

### 6.2 Tighten T763's future-dated test

In the `it('future-dated row: ...')` at `unit/selectors-dashboard.test.ts:328`, right after `const flow = leftOverFor(rows, range, TODAY, 0, BY_ID);`, add:

```ts
      expect(flow.spending).toBeCloseTo((range === 'WEEK' ? 250.9 : 351) + 30, 10);
```

`250.9` and `351` are test 6's in-range spending (`200.2 + 0.7 + 50`, plus `100.1` for MONTH). Change nothing else in that test or the T763 block. This line passes before and after the `ledger.ts` change (it tests T763's committed code); record that in the build report.

Existing tests stay unchanged apart from 6.2 and must pass.

## 7. The code change

### 7.1 `src/selectors/ledger.ts`

Imports become:

```ts
import { Category, Transaction } from '../types';
import { roundToCents } from '../utils/money';
import { monthKeyOf, shiftIsoDate } from '../utils/date';
import { filterByRange, inRange, TimeRange } from './timeRange';
```

After `leftOverFor` (ends `:114`), add:

```ts
export interface MonthToDateSide {
  /** First and last local day counted, `YYYY-MM-DD`, both inclusive. */
  start: string;
  end: string;
  spending: number;
  leftOver: number;
}

export interface MonthToDate {
  /** N: today's day of the month, clamped to last month's length. Both months count days 1 to N. */
  days: number;
  thisMonth: MonthToDateSide;
  lastMonth: MonthToDateSide;
  /** Spending's change on last month, in percent; `null` when last month spent nothing. */
  spendingChange: number | null;
  /** Left over's change, in percent of the size of last month's, so up means better even from a negative base; `null` when last month's was 0. */
  leftOverChange: number | null;
}

function percentChange(now: number, before: number): number | null {
  return before === 0 ? null : ((now - before) / Math.abs(before)) * 100;
}

/**
 * The Dashboard's month comparison line (owner spec 5.3, ADR 0102 D4): day 1
 * to N of this month against day 1 to N of last month, N being today's day
 * clamped to last month's length. It ignores the page's period.
 */
export function monthToDate(txs: Transaction[], today: string, categories?: CategoryLookup): MonthToDate {
  const lastMonthEnd = shiftIsoDate(`${monthKeyOf(today)}-01`, -1);
  const days = Math.min(Number(today.slice(8, 10)), Number(lastMonthEnd.slice(8, 10)));
  const side = (monthKey: string): MonthToDateSide => {
    const start = `${monthKey}-01`;
    const end = `${monthKey}-${String(days).padStart(2, '0')}`;
    const flow = cashFlow(txs.filter((tx) => inRange(tx.transactionDate, { start, end })), categories);
    return { start, end, spending: flow.spending, leftOver: flow.leftOver };
  };
  const thisMonth = side(monthKeyOf(today));
  const lastMonth = side(monthKeyOf(lastMonthEnd));
  return {
    days,
    thisMonth,
    lastMonth,
    spendingChange: percentChange(thisMonth.spending, lastMonth.spending),
    leftOverChange: percentChange(thisMonth.leftOver, lastMonth.leftOver),
  };
}
```

`percentChange` is not exported. Do not change `cashFlow`, `leftOverFor` or anything else in the file.

Two readings the owner should confirm at the pause; the spec takes these, and the tests pin them:

- **One N for both months**, as `spec.md:70` and D4 read: on March 29 to 31 of a non-leap year, both sides count days 1 to 28, so spending on March 29 to 31 is outside the line until April (test 2 and 3). The `start`/`end` fields let UI-2 label the window ("Mar 1 to 28"). The other reading (this month 1 to today, last month 1 to min(today, its length)) would change tests 2 and 3 only.
- **Left over's change divides by the size of last month's figure**, so improving from -200 to -100 reads +50%, not -50% (test 6). Spending is never negative, so its change is the plain formula.

### 7.2 `docs/contexts/client-state.md:63`

Old (exact):

```
- **L6 to L13** (`display`, `adjustments`, `categories`, `pagination`): the Transactions page sorts newest first, pages with `visibleRows` before `groupByDay`, and takes each day's net from all its filtered rows. `cashFlow`, `walletShares`, `moodSpendingDays` serve the Dashboard, which computes every figure once in `DashboardView`.
```

New (exact):

```
- **L6 to L13** (`display`, `adjustments`, `categories`, `pagination`): the Transactions page sorts newest first, pages with `visibleRows` before `groupByDay`, and takes each day's net from all its filtered rows. `cashFlow`, `walletShares`, `moodSpendingDays` serve the Dashboard, which computes every figure once in `DashboardView`. The 2026-10 redesign adds `leftOverFor` (Left over card, MONTH-only `afterDebtDue`), `dailySpendingSeries` (`selectors/diary.ts`; one point per day from the range's start through today, WEEK 8, MONTH 31) and `monthToDate` (day 1 to N of this month and last month) [0102].
```

Nothing else in that file.

### 7.3 `docs/audit/refactor-log.md`

Insert a new entry right after the `---` line that follows the template (above `## Phase 133`), in the template's headings:

- Heading: ``## Phase 134 - Dashboard selectors: T762-T764 (2026-10-17, code `<sha>`, merged `<sha>`)`` (the deploy record fills the shas, as in Phase 132 and 133).
- ADR line: ADR `0102`, plus one or two sentences: the three new pure selectors of the owner spec's section 5, tests first, nothing on screen until Phase 135.
- **Changed:** `src/selectors/ledger.ts` (`leftOverFor` T762, `monthToDate` T764), `src/selectors/diary.ts` (`dailySpendingSeries` T763), `unit/selectors-dashboard.test.ts` (the three blocks; T764 also tightens T763's future-dated test), `docs/design/dashboard-2026-10/spec.md:69` (T763: WEEK 8 points, owner decision), `docs/contexts/client-state.md:63`, the ledger, this entry and the metrics.
- **Verified:** each task's red run and gate results from the ledger rows, T764's with its real counts.
- **Surprises:** the owner spec's WEEK series said 7 points while the WEEK range is 8 days (owner chose 8, T763); a mid-file `process.env.TZ` switch takes effect only in Vitest's `forks` pool, not in a worker thread, so the zone blocks assert the offset first (T762 and T763 reviews); the future-dated row counts in the card but has no sparkline point (owner kept the series ending at today, T763).
- **Deliberately not done:** wiring any of the three into `DashboardView` (Phase 135); moving `debts.ts`'s `daysInMonth` (not needed); the offset guard in T762's zone block; `AGENTS.md`'s stale test count (1375) and `DESIGN.md`.

### 7.4 `docs/audit/baseline-metrics.md`

Add `### Phase 134 - delta against Phase 132` at the top of "Figures" (above `### Phase 132`), measured per "How to measure" on this branch with T764 in place: `npm run clean`, `npm run build` with the repo's `.env` present (never print or read it), then each file in `dist/assets` gzipped at level 9 (Node `zlib.gzipSync(buf, { level: 9 })`). Lines, in Phase 132's form, each with its delta against Phase 132's figures in section 4: **Entry chunk** (name, raw, gzip), **All app JS** (raw, gzip, file count), **CSS** (name, raw, gzip), **Vitest** (files, tests, passed, time, log `workflow/stages/02_build/output/logs/T764-unit.log`), **Playwright**: "not run: no UI path changed in Phase 134; nothing renders the new selectors". Write the real numbers; if the bundle did not change (the new exports have no caller yet), write 0 deltas.

## 8. Gates

Run in this order; save full-suite output to `workflow/stages/02_build/output/logs/`.

1. Red: after writing 6.1 and 6.2 and before touching `ledger.ts`, `npx vitest run unit/selectors-dashboard.test.ts`: the new `monthToDate` tests fail; the existing tests, including 6.2's tightened one, pass.
2. `npm run lint`
3. `npx vitest run unit/selectors-dashboard.test.ts unit/selectors-ledger.test.ts unit/selectors-debts.test.ts unit/diary-page.test.tsx`
4. `npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T764-unit.log`
5. `npm run clean && npm run build 2>&1 | tee workflow/stages/02_build/output/logs/T764-build.log`, then the gzip measurement for 7.4.
6. Playwright: no affected spec. `monthToDate` has no caller in `src/`; state this in the build report.
7. Docs: every count and path the new docs state matches the code and logs (the selector names and files in 7.2 and 7.3, WEEK 8 and MONTH 31, the Vitest counts in 7.4 against `T764-unit.log`). `git diff --numstat docs/contexts/client-state.md` prints `1	1`.
8. `git ls-files --eol src/selectors/ledger.ts unit/selectors-dashboard.test.ts docs/contexts/client-state.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md` shows `w/crlf` for all six.
9. `node -e "const d = String.fromCharCode(0x2014); for (const f of process.argv.slice(1)) console.log(f, require('fs').readFileSync(f, 'utf8').split(d).length - 1)" src/selectors/ledger.ts unit/selectors-dashboard.test.ts docs/contexts/client-state.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md` prints 0 for all six.
10. `git status --porcelain` lists only the five target files, `docs/audit/task-ledger.md` and this task's stage outputs (`dist/` is gitignored; check it does not appear).

## 9. Bookkeeping

In `docs/audit/task-ledger.md`, after the T763 row in the Phase 134 table, add `| T764 | Dashboard redesign SEL-3: the month-to-date comparison (owner spec 5.3); T763 test tightened; Phase 134 paperwork | \`src/selectors/ledger.ts\`, \`unit/selectors-dashboard.test.ts\`, \`docs/contexts/client-state.md\`, \`docs/audit/refactor-log.md\`, \`docs/audit/baseline-metrics.md\` | done | | <gate results> |`. Leave `Commit` empty. Leave the Phase 134 branch line as it is (the deploy record adds the commits and merge).

## 10. Production touch points

None. `npm run build` reads `.env` locally and writes `dist/` only; no deploy, no SQL, no `/api/*`, no config, no dependency.

## 11. Out of scope

- `src/views/DashboardView.tsx` and every component: the comparison line is UI-2 (Phase 135).
- `cashFlow`, `leftOverFor`, `dailySpendingSeries`, `daySpending`, `src/selectors/debts.ts` (including its private `daysInMonth`), `src/selectors/timeRange.ts`, `src/utils/date.ts`.
- Any test in `selectors-dashboard.test.ts` other than the new block and 6.2's one line; the offset guard in T762's zone block.
- `docs/design/dashboard-2026-10/spec.md`, ADR 0102, `DESIGN.md`, `AGENTS.md` (its test count is stale; leave it), `docs/audit/test-selector-contract.md`, `workflow/stages/*/CONTEXT.md`.
- The Phase 134 branch line's commit list and the `Commit` cells: the deploy record fills them.
