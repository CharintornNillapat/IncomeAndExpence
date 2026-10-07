# 0084: The entry form offers its type's own categories; a new debt cannot owe more than it borrowed; a payoff share is 0 to 100

**Status:** Accepted. Draft PR; not merged. No migration.
- **Amends** ADR `0013` (express entry): the Category select is filtered by the entry type, and its first option is the default.
- **Amends** ADR `0079` (`payoffPercent`): the share is clamped to 0 to 100.
- **Amends** ADR `0035` (Debt payoff page): `DebtSchema` refuses `remainingAmount > totalAmount`, as `DebtEditSchema` refuses the reverse.

**Date:** 2026-10-07

## Context

The owner's live audit (findings 1, 2 and 3):

1. **Unrecognised expenses were filed under Balance Adjustment.** `TransactionForm` started on `categories[0]` and listed every category whatever the type. A signed-in account's categories load ordered by name (`.order('name')`), so the list began with "Balance Adjustment". An expense saved without touching the field (a note no rule and no Jev answer matched) went under it, and `isSpending` (L1) leaves a movement category out. So the expense was missing from the Dashboard's spending, the category card, the Cash flow card and the monthly insights. A guest's defaults start with "Food & Dining", which is why no spec saw it.

   On live, read-only counts at the time of writing: **5 live EXPENSE rows in 2 accounts and 2 live INCOME rows in 1 account are filed under an ADJUSTMENT category.** None is under DEBT_REPAYMENT.
2. **A debt could owe more than it borrowed.** `DebtSchema` (Add Debt) bounded each field alone. `DebtEditSchema` had refused a total below the remainder since ADR `0035`, but nothing refused a new debt with remaining > total. `payoffPercent` was unclamped (ADR `0079`), so the card printed "−20.0% paid" and a negative Repaid, beside a bar `ProgressBar` had clamped. The Dashboard's row and both summaries printed the same figure. On live, **1 of 3 live debts owes more than it borrowed.**
3. **Income could be filed under an expense category, and the reverse**, for the same reason as finding 1.

## Decision

1. **The Category select lists `categories.filter(c => c.type === type)`**:
   - For EXPENSE and INCOME, the type match is what leaves the system categories out: Balance Adjustment is `ADJUSTMENT` and Debt Repayment is `DEBT_REPAYMENT`, so no separate check is needed.
   - **What the select shows and the form submits is derived during render** (`shownCategoryId`): the category in state if it is of the entry's type, else the type's first. There is no effect.
   - Switching to Income moves to the first income category, and switching back returns to the expense category picked before. A list that loads late (signed in) is covered the same way.
   - **The state keeps the last pick or match of any type.** The rule chip (ADR `0017`) still reads it, and still requires its type to match, so it offers a rule only for a category the person actually chose and can see.
   - **The keyword matcher and Jev still see every category.** A rule hit can switch the type, and the select then follows.
2. **`DebtSchema` has `DebtEditSchema`'s rule from the other side:** `remainingAmount > totalAmount` is refused, with the message "Remaining can't be more than the total amount (฿x)" on `remainingAmount`, in the Add Debt form's own words. Equal is allowed.
3. **`payoffPercent` clamps to 0 to 100**, so every screen that prints it is covered at once: the card, the Dashboard's row, both summaries and the form's payoff block, whose own clamp is deleted. `DebtCard`'s Repaid and `useDebts().metrics.paidTarget` floor at 0.

   A clamp at the card alone would have left the Dashboard's row and the summaries printing negatives. Clamping in the shared function is the smaller change, and what ADR `0079` existed for: one formula.

## Not changed

- **The live rows are not repaired.** Refiling an expense is the account owner's choice (one may be a real correction), and Phase 108 has no migration. The counts above are the starting point for that decision; the read is a count only.
- **`EditTransactionPanel` and the CSV import preview still list every live category.** An edit or an import can still file an expense under Balance Adjustment. Each needs its own look: the panel edits TRANSFER and ADJUSTMENT rows too, and the importer validates a category by name. Recorded for a later phase.
- **The ledger does not refuse an EXPENSE under a movement category.** `addTransaction` and the RPCs accept it, and `isSpending` is what keeps the figures right for rows already stored.
- **The soft-delete reversal stays uncapped** (ADR `0016`), so a legacy overpaid row can still push a remainder above its total; the clamp absorbs it on screen.
- **A backup restore** (`parseAccountBackup`) accepts remaining > total, for the same reason.

## Consequences

- An expense saved without touching the Category field counts as spending on every account. On name-ordered accounts it now goes to the first expense category by name ("Food & Dining" in the starter set). That is a guess, but the right kind: it is visible, and it counts.
- The select is two to five options shorter, and an income can no longer be filed under an expense category by accident.
- A debt owing more than it borrowed reads "0.0% paid" and Repaid ฿0.00, never a negative.

## Tests

- **`unit/transaction-form-category.test.tsx` (new, 3 tests):** categories in name order, Balance Adjustment first.
  - An expense lists only expense categories and submits the first.
  - Income lists only income categories and submits the first.
  - Switching back to Expense returns the earlier pick.
  - All three failed on the unfixed form, which listed all six categories and submitted Balance Adjustment.
- **`unit/debts-page.test.tsx` (+4):**
  - `DebtSchema` allows remaining equal to the total, and refuses a cent more with the message on `remainingAmount`; its other bounds are kept.
  - A card owing more than it borrowed reads `0.0% paid` (the element's exact text, since "-20.0% paid" contains "0.0% paid") and Repaid ฿0.00, and the summary reads 0.0% and ฿0.00.
  - The Add Debt form refuses ฿1,200 owed of ฿1,000 and adds nothing.
  - All failed first.
- **`unit/selectors-debts.test.ts`:** the "not clamped" test is now "clamped" (−50 to 0, 150 to 100). The pair `[1000, 1500]` leaves the four-formula comparison, which pinned the old unclamped figures.
