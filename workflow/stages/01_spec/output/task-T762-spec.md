# T762 spec: the Left over selector (Dashboard redesign SEL-1)

Phase 134, branch `phase-134-dashboard-selectors` (cut from `main` at `3927c83`). Order: Dashboard redesign task SEL-1, owner spec `docs/design/dashboard-2026-10/spec.md:84`, section 5.1 (`spec.md:68`). Money path: tests first. This task does not ship the phase (SEL-3 does).

## 1. Goal

Add one pure selector that gives the redesigned Left over card its figures for a period: left over, kept percent of income, the spent and kept shares for its bar, and the left over after this month's debt payments (MONTH only). Unit tests first, in both time zones.

## 2. Target files

```
src/selectors/ledger.ts
unit/selectors-dashboard.test.ts
```

No ADR: ADR 0102 already records this work ("Phase 134 adds the three selectors of the owner spec's section 5, money path, each with tests first", `docs/audit/decisions/0102-dashboard-redesign-2026-10.md`, Consequences). No `refactor-log.md` or `baseline-metrics.md`: SEL-3 ships Phase 134.

## 3. Context to read

- `docs/contexts/client-state.md`, sections "Money and dates" and "Money rules: `src/selectors/`" (L1, L2, `roundToCents`, `today` as an argument, the "Unit tests for this layer" rules on `TZ` and on exporting nothing only for a test).
- `docs/design/dashboard-2026-10/spec.md` sections 4.2 (`:53`) and 5 (`:66` to `:68`). Do not open the HTML mock; this task names no mock lines.

## 4. Current behaviour

- `cashFlow(txs, categories?)` (`src/selectors/ledger.ts:70-79`) returns `{ income, spending, leftOver, spentPercent }`: `income` and `spending` from `sumIncome`/`sumSpending` (L1, `isIncome`/`isSpending`, `:34-55`), `leftOver = roundToCents(income - spending)` (`:76`), `spentPercent = spending / income * 100` or `null` without income, not clamped (`:62`, `:77`). It takes rows already filtered; it knows nothing of a range.
- `filterByRange(rows, range, today)` (`src/selectors/timeRange.ts:186-190`) applies L2: DAY is today, WEEK from `today - 7`, MONTH from `today - 30`, WEEK/MONTH/ALL open-ended (`:166-177`). It compares ISO strings; `shiftIsoDate` (`src/utils/date.ts:43-48`) builds the start from local calendar parts.
- `debtPlan(debts, today, surplus).totalRequired` (`src/selectors/debts.ts:102-121`, `:113`) is the sum of every active debt's rounded monthly payment: the "needed this month" figure.
- `DashboardView` computes `periodRows = filterByRange(...)` and `flow = cashFlow(periodRows, categoryMap)` (`src/views/DashboardView.tsx:88-89`) and `plan = debtPlan(...)` (`:104-107`). Nothing computes a kept percent, the bar shares, or a left over after debt due; `CashFlowCard` draws its bar from `spentPercent ?? 0` (`src/components/dashboard/CashFlowCard.tsx:66`).
- Existing tests for `cashFlow` are in `unit/selectors-dashboard.test.ts:83-118`; the file pins `TZ=Asia/Bangkok` in a top-level `beforeAll` (`:17-23`), uses `TODAY = '2026-09-28'` (`:25`), the `CATEGORIES`/`BY_ID` fixtures (`:27-33`) and the `tx()` builder (`:35-50`). Both target files are CRLF in the work tree (`git ls-files --eol`: `i/lf w/crlf`).

## 5. Parity map

None. The new selector reuses `cashFlow` and `filterByRange` and adds no ledger arithmetic; no row of `AGENTS.md`'s parity map covers it.

## 6. Tests to add

All in `unit/selectors-dashboard.test.ts`, in a new `describe('leftOverFor: the Left over card (owner spec 5.1)', ...)` placed right after the `cashFlow` block (after `:118`). Add `leftOverFor` to the existing `../src/selectors/ledger` import (`:2`) and `shiftIsoDate` is already imported (`:5`). Reuse `tx()`, `BY_ID` and `TODAY`. Percent and share figures compare with `toBeCloseTo(x, 10)`; money with `toBe`.

Every test below fails today: `leftOverFor` is not exported from `src/selectors/ledger.ts`, so each call throws `TypeError: ... is not a function` (and `npm run lint` reports TS2305). Write them all first, run `npx vitest run unit/selectors-dashboard.test.ts` against the unchanged `ledger.ts`, and record in the build report that the new tests fail and the existing ones pass.

1. **Counts L1 only, and every field.** Rows dated `TODAY`: INCOME 13103 (`cat-salary`), EXPENSE 9000.22 and 996 (`cat-food`), a TRANSFER 300, a DEBT_REPAYMENT 5000 (`cat-debt`), an ADJUSTMENT -7900 (`cat-adjust`), a deleted EXPENSE 123. `leftOverFor(rows, 'MONTH', TODAY, 1000, BY_ID)`: `income` 13103, `spending` 9996.22, `leftOver` 3106.78, `spentPercent` close to `9996.22 / 13103 * 100`, `keptPercent` close to `3106.78 / 13103 * 100`, `spentShare` close to `9996.22 / 13103 * 100`, `keptShare` close to `100 - spentShare`, `afterDebtDue` 2106.78. Catches a selector that counts a transfer, repayment, adjustment or deleted row, or that skips `cashFlow`.
2. **The range picks the rows (L2).** One INCOME 10 on each of `TODAY`, `shiftIsoDate(TODAY, -7)`, `shiftIsoDate(TODAY, -8)`, `shiftIsoDate(TODAY, -30)`, `shiftIsoDate(TODAY, -31)`, needed 0: `income` is 10 for DAY, 20 for WEEK, 40 for MONTH, 50 for ALL. Catches a selector that ignores `range` or re-derives its own bounds.
3. **After debt due is MONTH only, to the cent.** Rows: INCOME 10.3 and EXPENSE 10 (`leftOver` 0.3 after `cashFlow`'s rounding). With needed 0.1: `afterDebtDue` is exactly `0.2` for MONTH (`0.3 - 0.1` is `0.19999999999999998` unrounded), and `null` for DAY, WEEK and ALL. With needed 0 and MONTH, `afterDebtDue` equals `leftOver`. Catches a missing `roundToCents` and a figure leaking into other periods.
4. **A negative left over shows a full spent bar.** INCOME 100, EXPENSE 250.5, MONTH, needed 50: `leftOver` -150.5, `keptPercent` close to -150.5 (not clamped), `spentShare` 100, `keptShare` 0, `afterDebtDue` -200.5. Catches an unclamped `spentShare` of 250.5.
5. **Spending equal to income.** INCOME 500, EXPENSE 500: `leftOver` 0, `keptPercent` 0, `spentShare` 100, `keptShare` 0.
6. **No income.** EXPENSE 40 only: `keptPercent` null, `spentShare` 100, `keptShare` 0. Empty rows `[]`, MONTH, needed 0: `toEqual({ income: 0, spending: 0, leftOver: 0, spentPercent: null, keptPercent: null, spentShare: 0, keptShare: 0, afterDebtDue: 0 })`, and every number in the result passes `Number.isFinite` (owner spec 3.8: never `NaN` or `Infinity`).
7. **Both time zones (owner spec 5).** A loop `for (const zone of ['UTC', 'Asia/Bangkok'] as const)` making one `describe(\`in ${zone}\`, ...)` each, with its own `beforeAll(() => { process.env.TZ = zone; })` and `afterAll(() => { process.env.TZ = 'Asia/Bangkok'; })` (the file's pinned zone, restored for the blocks after it). Inside, with `today = '2026-10-17'`: an EXPENSE 7 on `2026-09-17` and an EXPENSE 11 on `2026-09-16` give `spending` 7 for MONTH; an EXPENSE 5 on `2026-10-17` and one on `2026-10-16` give `spending` 5 for DAY. Write the dates as literals, not through `shiftIsoDate`, so the expected bounds do not depend on the zone under test.

Existing `cashFlow` tests (`:83-118`) stay unchanged and must still pass.

## 7. The code change

In `src/selectors/ledger.ts`, after `cashFlow` (`:79`), add the type and the function below, plus `import { filterByRange, TimeRange } from './timeRange';` with the other imports (`timeRange.ts` imports only `utils/date`, so there is no cycle). Do not change `cashFlow` or `CashFlow`.

```ts
export interface LeftOver extends CashFlow {
  /** Left over as a share of income, or `null` with no income. Not clamped: negative when spending passed income. */
  keptPercent: number | null;
  /** The bar's spent part, 0 to 100: 100 when spending reached or passed income, 0 with neither income nor spending. */
  spentShare: number;
  /** The bar's kept part, `100 - spentShare` when there is income, else 0. */
  keptShare: number;
  /** Left over minus what the debts need this month; MONTH only, else `null`. */
  afterDebtDue: number | null;
}

/**
 * The Dashboard's Left over card (owner spec 5.1, ADR 0102) for one period.
 * `neededThisMonth` is `debtPlan(...).totalRequired`, passed in so the plan is
 * computed once in `DashboardView` (D5).
 */
export function leftOverFor(
  txs: Transaction[],
  range: TimeRange,
  today: string,
  neededThisMonth: number,
  categories?: CategoryLookup
): LeftOver {
  const flow = cashFlow(filterByRange(txs, range, today), categories);
  const spentShare = flow.leftOver <= 0 && flow.spending > 0 ? 100 : flow.income > 0 ? (flow.spending / flow.income) * 100 : 0;
  return {
    ...flow,
    keptPercent: flow.income > 0 ? (flow.leftOver / flow.income) * 100 : null,
    spentShare,
    keptShare: flow.income > 0 ? 100 - spentShare : 0,
    afterDebtDue: range === 'MONTH' ? roundToCents(flow.leftOver - neededThisMonth) : null,
  };
}
```

Why these edges: with income above 0 and `leftOver > 0`, `spending / income` is already inside 0 to 100, so no clamp call is needed; `leftOver <= 0` with any spending is the full spent bar (test 4 and 5); with neither income nor spending the bar is empty, 0 and 0 (test 6). That last case is the reviewer's default where the owner spec is silent; the owner can change it at the pause.

Keep the file's CRLF line endings. No em dash in code or comments.

## 8. Gates

Run in this order; save full-suite output to `workflow/stages/02_build/output/logs/`.

1. Red: after writing the tests and before touching `ledger.ts`, `npx vitest run unit/selectors-dashboard.test.ts`: the new `leftOverFor` tests fail, the existing ones pass.
2. `npm run lint`
3. `npx vitest run unit/selectors-dashboard.test.ts unit/selectors-ledger.test.ts unit/selectors-debts.test.ts`
4. `npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T762-unit.log`
5. Playwright: no affected spec. Nothing renders `leftOverFor` yet (`DashboardView` is out of scope), so no spec can see the change; state this in the build report.
6. `git ls-files --eol src/selectors/ledger.ts unit/selectors-dashboard.test.ts` still shows `w/crlf`.
7. `node -e "for (const f of process.argv.slice(1)) console.log(f, (require('fs').readFileSync(f, 'utf8').match(/\u2014/g) || []).length)" src/selectors/ledger.ts unit/selectors-dashboard.test.ts` prints 0 for both (no em dash).
8. `git status --porcelain` lists only the two target files, `docs/audit/task-ledger.md` and this task's stage outputs.

## 9. Bookkeeping

In `docs/audit/task-ledger.md`, before `## Backlog`, add a Phase 134 section in the template's form: heading `## Phase 134 - Dashboard selectors: left over, daily spending series, month-to-date comparison (money path, ADR 0102)`, the line ``Branch `phase-134-dashboard-selectors`, cut from `main` at `3927c83`.``, the table header, and the row `| T762 | Dashboard redesign SEL-1: the Left over selector (owner spec 5.1) | \`src/selectors/ledger.ts\`, \`unit/selectors-dashboard.test.ts\` | done | | <gate results> |`. Leave `Commit` empty.

## 10. Production touch points

None. No SQL, no `/api/*`, no config, no dependency.

## 11. Out of scope

- `src/views/DashboardView.tsx`, `CashFlowCard.tsx` and every other component: wiring the selector into the page is UI-1 (Phase 135).
- `cashFlow`, `CashFlow` and `spentPercent`: unchanged; `CashFlowCard` still reads them.
- `src/selectors/debts.ts` (`debtPlan`, `monthlySurplus`), `src/selectors/timeRange.ts` (L2 bounds) and `src/utils/date.ts`.
- SEL-2 (daily spending series) and SEL-3 (month-to-date comparison).
- `docs/contexts/client-state.md`'s selector list, `DESIGN.md`, `docs/audit/test-selector-contract.md`, `refactor-log.md`, `baseline-metrics.md`: SEL-3 ships the phase and updates what needs it.
- A new test file: the tests go in the existing `selectors-dashboard.test.ts`.
