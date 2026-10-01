# 0035: The Debt payoff page, an edit that never touches what is owed, and a write-off that asks first

**Status:** Accepted.
- **Implements** spec 6.4, the fourth page of the redesign (spec 9, step 4).
- **Keeps** ADR `0016`'s rules: a repayment cannot exceed what is owed, and `settleDebt` stays the one write-off with no ledger row. This ADR puts a confirmation in front of it.
- **Keeps** ADR `0015`'s payoff block and the repay modal (`TransactionForm` with `presetType`, `lockType`, `presetDebtId`) unchanged.

**Date:** 2026-10-01

## Context

Before this phase the Debts page had five problems:
- a carded `SectionHeader`, "Debts & Loans", and no summary;
- debts in store order, with settled ones mixed into the same grid;
- a lone ✓ icon on each card that wrote the debt off at once, with no confirmation and a failure nobody saw;
- a floating trash icon on each card;
- no way to edit a debt.

Spec 6.4 asks for:
- a PageHeader "Debt payoff", "N active debts · sorted by due date", and a primary "Add debt";
- a three-column summary: Still owed, Paid off, and the L5 box ("Needed per month to hit every due date", or "On track");
- debt cards in two columns, nearest due date first. Each card has:
  - an interest tag and a "Due <date> · ~N months" tag;
  - a ⋯ menu with Edit and Delete;
  - what is still owed in red at 28px, the % paid and a progress bar;
  - Borrowed, Repaid and Needed / month;
  - "Make repayment" and "Mark as paid off";
- a caption saying repayments are not spending.

The owner's decisions (2026-10-01):
- Edit changes the name, interest rate, minimum payment, due date and the borrowed total. Borrowed can never go below what is still owed, and what is still owed is never edited.
- Mark as paid off confirms first, in a dialog that is not styled as destructive. The dialog says the action records no payment and moves no money, and a failure stays in the dialog.
- Paid-off debts go in an open "Paid off (N)" section below the active ones, keeping their current text.
- Antislop runs afterwards, as audit 009 (mode 2).

No migration: every column exists. Edit is a plain update of `debts`, like `settleDebt` and `deleteDebt`.

## Decision

### `editDebt` (`FinanceContext.tsx`)
- **`editDebt(id, { name, totalAmount, interestRate?, minimumPayment?, dueDate? })`**, typed `DebtEdit`. An absent optional field clears it: the row gets `0`, `0` or `null`, which `mapDebtRow` reads back as absent.
- **`DebtEditSchema`** keeps `DebtSchema`'s bounds and receives the debt's current `remainingAmount`. It refuses `totalAmount < remainingAmount` with "Borrowed can't be less than what is still owed (฿X)". The amount is formatted with `formatCurrencyAmount`.
- **The debt is read from `debtsRef` before any state moves** (ADR `0022`), so the schema checks against the remainder on screen.
- **The update names only `name`, `total_amount`, `interest_rate`, `minimum_payment`, `due_date` and `updated_at`. It never sends `remaining_amount` or `is_settled`.** A repayment that lands through `record_transaction` after this device loaded therefore survives the edit. This is Phase 59's `updateWallet` rule applied to debts. A signed-in test pins the absence of both keys, and a control that sent `remaining_amount` failed it.
- **A rejected write rolls back** and returns the Supabase message.
- **What is still owed moves only through repayments and Mark as paid off.** Raising Borrowed raises the share left to pay; it does not create a debt.

### `useDebts`
It now returns `editDebt`, plus `activeDebts` (unsettled) and `settledDebts`, each sorted by `sortByDueDate`: nearest first, with undated debts last in store order. `debts` and `metrics` are unchanged, so the summary and the Dashboard's Debt payoff card show the same figures.

### The page
- **`DebtsView`** computes `debtPlan(debts, today, monthlySurplus(...))` once, exactly as `DashboardView` does. The surplus is always the past 30 days (L5). The summary and the cards only lay figures out (ADR `0028`).
- **`DebtSummaryCard`** (`components/debt/`) has three parts:
  - Still owed, in `text-expense`, "of ฿X borrowed";
  - Paid off, as `progressPercent.toFixed(1)%`, a progress bar, and "฿X repaid" in green;
  - when `plan.showWarning`, an amber `role="note"` box with `totalRequired` and the shortfall; otherwise an inset "On track", with the monthly figure when there is one.
- **`DebtCard`** (`components/debt/`) replaces `DebtCardItem`:
  - `div#debt-card-{id}`;
  - a `Badge` with "{rate}% APR" or "Interest-free";
  - a due tag:
    - "Due <date> · ~N months", amber when the debt alone needs more a month than the surplus (L5);
    - "Overdue · due <date>" in red;
    - "No due date" when there is none;
  - an `OverflowMenu` (`#debt-menu-btn-{id}`) with `#edit-debt-{id}` and `#delete-debt-{id}`;
  - what is still owed at 28px, "{pct}% paid" and a progress bar;
  - Borrowed, Repaid and Needed / month. The last is amber with the same L5 condition, and reads "No due date" or "Paid off" when there is no figure;
  - `#open-repay-modal-{id}` "Make repayment" (primary) and `#settle-debt-{id}` "Mark as paid off" (secondary, ✓), while the debt is owed.
- **A paid-off card** keeps "100% Fully Settled!" and "✓ Debt Fully Settled", which `debts.spec.ts` and `soft-delete.spec.ts` read. It has no actions but its menu.
- **Layout:**
  - the summary;
  - the active debts in a `section` labelled "Active debts", two columns from `md`;
  - "Paid off (N)" as an `h2` and its own section, open;
  - the caption "Debt repayments move money out of a wallet but aren't counted as spending."

  The empty state is unchanged.

### Dialogs
- **Mark as paid off** is a `ConfirmDialog` with `isDestructive={false}`. Its text: "Mark "<name>" as paid off? This sets what is still owed (฿X) to zero without recording a payment or moving money. To pay from a wallet, use Make repayment." The `settleDebt` result is checked now. Before, it was discarded.
- **Edit** is `EditDebtModal`:
  - fields `#edit-debt-name`, `-total`, `-interest`, `-min-payment` and `-due-date`;
  - "Still owed" shown as text beside Borrowed, never as a field;
  - `#save-edit-debt-btn`, and `#edit-debt-error` when a save fails, with the modal kept open.
- **Delete** is the existing dialog, opened from the menu. Its text: "It leaves your payoff goals. Its repayment transactions stay in your history."
- **Focus.** `Modal` returns focus to its opener (audit 008), but three actions remove that opener: a write-off, a repayment of the whole remainder, and a delete. After the first two, focus goes to the debt's ⋯ menu, which a paid-off card keeps. After a delete, it goes to Add debt.

### Deviations from spec 6.4
- **The summary's three columns stack** while the card is narrower than 42rem (a container query), as at 390 and in the 768 to 900 band.
- **A card's three cells become label-and-figure rows** while the card is narrower than 24rem.
- **The "Paid off (N)" section is the owner's addition**, not in the spec. Its cards keep the pre-redesign text that the spec suite reads.
- **Overdue and undated debts have their own tag text** ("Overdue · due <date>", "No due date"). The spec names only the dated case.
- **"On track" shows the monthly figure** when one exists, so the box still answers "how much a month".

## Spec edits (locator and copy moves only, in the page's commit)
- `theme.spec.ts`: the heading `/Debts & Loans/i` became `'Debt payoff'` (exact), the same kind of copy change as Phase 59's "Wallets".
- `soft-delete.spec.ts`: Delete is reached by opening the card's `#debt-menu-btn-{id}` first. The count-0 assertions stay as they were.

`debts.spec.ts`, `debt-repayment.spec.ts`, `transaction-edit.spec.ts` and `smart-rules.spec.ts` passed unedited. `settle-debt-*` is still a visible button, so `debts.spec.ts`'s count-0 check on a settled card still means something.

## Consequences
- **A debt can be corrected without touching what is owed.** A wrong total, rate or date no longer needs a delete and a fresh debt, which lost the link to its repayments.
- **A write-off can no longer happen by accident**, and when it fails, the reason is shown.
- **Paid-off debts no longer sit between the active ones.** They also still count in Paid off and in "of ฿X borrowed", as they did on the Dashboard.
- **`DebtCardItem` is gone.** `TransactionForm`'s payoff-percentage comment now names `DebtCard`.
- **Tests:**
  - `unit/debts-page.test.tsx` (18): the header, order, tags, summary (warning and On track), the menu, Mark as paid off, Edit, Delete, focus, and `DebtEditSchema`'s bounds;
  - 4 signed-in tests for `editDebt`;
  - `tests/debts-page.spec.ts` (3 guest tests, nothing intercepted).

  Controls that each failed their test:
  - `editDebt` sending `remaining_amount`;
  - the borrowed floor removed;
  - Mark as paid off without the confirm;
  - the sort removed;
  - the focus hand-off removed.
- **Audit 009, the owner's decisions (2026-10-01):**
  - finding 1: the L5 box words a zero or negative surplus as the Dashboard's banner does ("The past 30 days left no surplus (฿Y)"), and a small positive one as "฿X more than the past 30 days' surplus of ฿Y";
  - finding 3: the header and mobile More tab read "Debt payoff";
  - findings 2, 4, 5 and 6 are accepted and watched.
