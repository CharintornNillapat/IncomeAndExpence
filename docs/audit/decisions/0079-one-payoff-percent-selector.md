# 0079: A debt's payoff percentage is one selector, `payoffPercent`, and each caller states its own figure for nothing borrowed

**Status:** Accepted. Code `c91e3c1`, docs `cf52633`, draft PR #54; not merged.
- **Amends** ADR `0028`: the share of a debt that is paid off joins L3 to L5 in `src/selectors/debts.ts`.
- **Amends** ADR `0015`: `TransactionForm`'s payoff block still mirrors `DebtCard`, now by calling the same function rather than repeating its formula.

**Date:** 2026-10-06

## Context

1. **The prompt.** A `graphify` knowledge graph of the repository put the debt plan and the Dashboard's figures in one community of 118 nodes with the lowest cohesion of any (0.042), and the owner asked for the pure debt-plan projection to be separated from the presentation components without changing a figure.
2. **What the code already does.** L3 to L5 are pure functions in `src/selectors/` (`netWorth`, `monthsLeft`, `requiredMonthly`, `debtPlan`, `monthlySurplus`), each view computes them once (`DashboardView`, `DebtsView`, ADR `0030` and `0035`), and the cards import only their types. Most of the community is the graph's clustering: it holds the shared UI primitives (`Card`, `ProgressBar`, `Money`), ADR nodes and `unit/dashboard.test.tsx` beside the debt code. Splitting it along those lines would move nothing that is coupled.
3. **What the code does not do.** One debt figure is computed inline, four times, in two presentation components, a form and a hook:

   | Where | Formula | With nothing borrowed |
   |---|---|---|
   | `DebtCard` (Debt payoff page, one debt) | `repaid = total - remaining`; `repaid / total * 100` | 100 |
   | `DebtPayoffCard`'s `debtProgress` (Dashboard, one debt) | `(total - remaining) / total * 100` | 0 |
   | `TransactionForm`'s payoff block (projected) | `(total - projected) / total * 100` | 100 |
   | `useDebts().metrics.progressPercent` (every debt) | `paid / total * 100` | 0 |

   `DebtCard`'s comment said it was "`DebtPayoffCard`'s figure". It is, except when nothing was borrowed.
4. **Nothing borrowed is reachable.** `DebtSchema` requires a positive total, but `public.debts.total_amount` has no check (`20260901_baseline_schema.sql`), and a restored backup (ADR `0075`) or a row written outside the app can carry 0. Such a debt reads 100% paid on the Debt payoff page and 0% on the Dashboard.

## Decision

- **`payoffPercent(total, remaining, ifNothingBorrowed)`** in `src/selectors/debts.ts`: `total > 0 ? ((total - remaining) / total) * 100 : ifNothingBorrowed`. It is not clamped; `ProgressBar` clamps its bar, and `TransactionForm` keeps its own clamp on the printed number (ADR `0015`).
- **All four call sites use it**, and each passes the figure it already had: `DebtCard` and `TransactionForm` 100, `DebtPayoffCard` and `useDebts` 0. `DebtCard` keeps its `isSettled ? 0 : remaining` and passes the result.
- **Every figure is unchanged, to the bit.** `(total - remaining) / total * 100` is the same IEEE operations as `repaid / total * 100` with `repaid = total - remaining`; a unit test compares them with `Object.is` over a grid that includes cents and a total of 999,999,999.99.
- **The disagreement for nothing borrowed stays, named.** Making it one figure changes what a person sees, which the owner ruled out for this phase. It is now an argument at each call site rather than a constant inside four formulas, and two tests pin it (the Debt payoff page's card and summary, the Dashboard's row). Choosing one figure is the owner's decision for a later phase.
- **Not done:** moving `useDebts`' totals (`totalTarget`, `remainingTarget`, `paidTarget`) into a selector. They are sums over the hook's own filtered list, not a projection, and no second copy exists.

## Verification

- **Red first:** `unit/selectors-debts.test.ts`'s four `payoffPercent` tests failed against the unchanged code (`payoffPercent is not a function`); the two zero-total pins passed against it, as a record of today's figures, and pass after.
- **Unit:** the formula, no clamp either way, the caller's figure for a zero or negative total whatever is owed, and the four formulas compared bit for bit.
- **Pins:** `unit/debts-page.test.tsx` (a zero-total debt's card reads "100.0% paid" and the summary "Paid off0.0%") and `unit/dashboard.test.tsx` (the same debt's Dashboard row reads "0.0% · no due date").
- **Gate:** in the refactor log.
