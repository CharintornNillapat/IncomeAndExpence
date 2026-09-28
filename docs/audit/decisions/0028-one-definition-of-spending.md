# 0028 — One definition of spending: central selectors for the redesign's logic rules (L1 to L13)

**Status:** Accepted.
- **Implements** `docs/design/finlife-redesign-spec.md` section 5 (L1 to L13) and section 9, step 2 (Logic), for Phase 55b.
- **Amends** ADR `0020`: what the monthly insights count as spending.

**Date:** 2026-09-28

## Context

The spec opens its logic section with a screenshot showing three spending figures (9,996.22, 15,673.43 and 9,656.22) for the same dashboard and the same period. Reading the code before this phase found four definitions of "spending" behind them:

| Screen | Counted as spending | Window |
|---|---|---|
| Dashboard Expense card | EXPENSE | rolling 30 days |
| Dashboard category chart | EXPENSE and DEBT_REPAYMENT, grouped by category **name** | rolling 30 days |
| Monthly insights (`spendingSummary.ts`) | EXPENSE and DEBT_REPAYMENT | calendar month |
| Diary outflow (`DiaryView`) | EXPENSE and DEBT_REPAYMENT | one day |

Each screen had its own inline filter, so each one drifted on its own.

There were other gaps:
- **Net worth** summed wallets and ignored every debt.
- **Archived wallets:** `totalNetWorth` left them out, but `useWallets().wallets`, which feeds the hero's wallet count and the wallet grid, left them in.
- **Debt due dates:** `Debt.dueDate` existed, but nothing computed what a debt needs per month to be cleared by it.

## Decision

### `src/selectors/`: pure functions, "today" passed in

Every rule is a pure function in `src/selectors/`. No selector reads the clock: each takes `today` as an ISO `YYYY-MM-DD` string. That makes a date rule testable at its exact boundary, and the spec's worked example is reproducible on the date it was written (2026-09-28). Dates are compared as ISO strings, per CLAUDE.md. `src/utils/date.ts` gains `shiftIsoDate(iso, days)`, which steps local calendar days with `setDate`, and `daysAgoIsoDate` now delegates to it. Money is summed through `roundToCents`, so a total never carries floating-point noise.

| File | Rule | What it answers |
|---|---|---|
| `ledger.ts` | L1, L11 | `isSpending` / `isIncome`, their sums, spending by category, days grouped with their net |
| `timeRange.ts` | L2 | the DAY / WEEK / MONTH / ALL bounds, a range filter, the "Aug 29 – Sep 28" label |
| `wallets.ts` | L3 | active wallets, their total, debt remaining, net worth |
| `debts.ts` | L4, L5 | months left, required per month, overdue, due-date order, the plan against the surplus |
| `display.ts` | L6, L7, L10, L13 | a row's title, its second line, its category label |
| `adjustments.ts` | L8 | folding a cancelling pair of adjustments into one item |
| `categories.ts` | L9 | which colours other categories already use |
| `pagination.ts` | L12 | 25 rows at a time |

### L1: spending is EXPENSE, income is INCOME, and nothing else

- `isSpending(tx, categories)` is a live EXPENSE, and `isIncome` a live INCOME.
- A transfer, a debt repayment and an adjustment are neither, whatever their sign.
- So is an EXPENSE or INCOME filed under a category whose type is DEBT_REPAYMENT or ADJUSTMENT. The category select is unfiltered, and the spec excludes those categories by name.
- An uncategorized row, or one whose category was deleted, still counts.

**`spendingByCategory` groups by category id**, not name, so two categories that share a name stay apart. It adds up to exactly `sumSpending`, which is what makes the chart and the Expense card show one figure.

### L2: the ranges keep the dashboard's existing boundaries

The time-filter ids (`#time-filter-*`) and their meaning are frozen by `date-boundary.spec.ts`:
- DAY is today.
- WEEK is from `today − 7`, eight days inclusive.
- MONTH is from `today − 30`, which is also the spec's own example ("Aug 29 – Sep 28" on Sep 28).
- ALL is everything.

WEEK, MONTH and ALL keep an open end, as the inline filter had: a row dated in the future still shows. The label ends at today.

### L3: net worth subtracts what is still owed

`netWorth(wallets, debts)` is the sum of active wallets minus the remainder of every debt that is not deleted and not settled.

**Active means not deleted and not archived**, in one predicate. `totalNetWorth` and `useWallets().wallets` both use it now, so the hero's count and the grid agree with the total.

**The hero still shows the wallet total under "Total Money Across All Wallets"**, which is what that label says and what `theme.spec.ts` finds. The Net worth card that shows `netWorth` arrives with the dashboard redesign.

### L4 and L5: what each debt needs per month

- **`monthsLeft(due, today)`** is `max(1, (dueYear − year) × 12 + (dueMonth − month) − 1)`, the full months before the due month (the spec's formula).
- **`requiredMonthly`** is `roundToCents(remaining / monthsLeft)`. It is `null` for a debt with no due date and for a settled or deleted one.
- **An overdue debt** is one whose due date is before today. It needs its whole remainder: `monthsLeft` bottoms out at 1.
- **`debtPlan(debts, today, surplus)`** lists the active debts nearest-due first, then:
  - sums `totalRequired` from the rounded per-debt figures, so the total a user sees equals the rows they see;
  - reports the `shortfall`;
  - sets `showWarning` when the total is positive and exceeds the surplus.
- **`monthlySurplus`** is income minus spending (L1) over the MONTH range (L2).

**The spec's example is the test:** on 2026-09-28, ฿13,173.70 due in January 2027 needs ฿4,391.23 a month, and ฿9,403.30 due in April 2028 needs ฿522.41.

### L6 to L13: built and pinned now, adopted with the pages

- **L6:** an empty or default ("Transaction") description falls back to the category name, with "No description · <wallet>" underneath.
- **L7:** a transfer is titled "Transfer", with "From → To" underneath, and has no category label, so never "No category".
- **L8:** an equal and opposite pair of adjustments, on one wallet and one day, folds into one item, described as "2 balance adjustments on Cash that cancel out · net ฿0.00".
- **L9:** a map from each colour in use to the category using it. The category being edited is excluded, and so are deleted categories.
- **L10 and L13:** a category of type DEBT_REPAYMENT or ADJUSTMENT reads "Debt repayment" or "Balance adjustment", whatever its stored name. It is matched by type, never by id, because signed-in rows carry uuids. Every adjustment is labelled "Balance adjustment".
- **L12:** `PAGE_STEP` is 25.

These change what rows say and how the transaction list pages. The screens that show them are rebuilt in the spec's page step, so they are adopted there, together with the spec edits that will need. Wiring them into today's table would mean doing that work twice.

### Where L1 to L5 are wired now

| Place | Before | After |
|---|---|---|
| `DashboardView` | Inline date filter; the chart counted repayments and grouped by name; its total was expense plus repayments | `filterByRange`, `sumIncome` / `sumSpending`, `spendingByCategory`; the chart total is the Expense card's figure |
| `spendingSummary.ts` | EXPENSE and DEBT_REPAYMENT | `isSpending` / `isIncome`. Its calendar-month window stays: whether the insights card survives, or moves to the dashboard's range, is the spec's section 6.1 item 7, a page-phase decision |
| `DiaryView` | Outflow counted repayments | `isSpending` / `isIncome` |
| `FinanceContext` / `useWallets` | Two definitions of an active wallet | `walletTotal` / `activeWallets` |

## Consequences

- **A debt repayment no longer appears in the category chart, the insights or the diary's day outflow.** It still moves the wallet and the debt exactly as before; only what is called spending changed.
- **`unit/spending-summary.test.ts`** asserted that a repayment counted as spending. It now asserts that it does not, with a comment saying why.
- **Three new unit files** (`selectors-ledger`, `selectors-debts`, `selectors-display`) were written before the selectors and run against the missing module first.
- **The spec's net-worth figure (฿9,595.48)** comes from the owner's real data, so it is not reproducible here. The formula is pinned instead.
