# 0085: Every category path keeps an entry's own type; overdrafts warn in the entry form; wallets below zero are not "no money"

**Status:** Accepted. Draft PR; not merged. No migration.
- **Completes** ADR `0084` (audit finding 3): the edit panel, the CSV import and `addTransaction` follow the entry form.
- **Amends** ADR `0019` (CSV import): a suggestion of another type is no longer offered, and a category of another type is dropped at commit.
- **Amends** ADR `0014` (overdraft warns, never blocks): a credit card is never overdrawn, and the entry form warns too.
- **Amends** ADR `0042` (the empty allocation bar's caption).

**Date:** 2026-10-07

## Context

The owner's live audit, findings 3 (its remainder), 4, 8 and 11. The owner decided to leave the seven live rows under Balance Adjustment as they are (ADR `0084`), with no refiling migration.

1. **Finding 3, the remaining paths.** After ADR `0084` the entry form offered only its type's categories, but three paths still did not:
   - `EditTransactionPanel` listed every live category, so an edit could move an expense under Balance Adjustment.
   - The CSV import preview's picker listed every category. A Category cell naming one of another type was committed by name.
   - Neither `addTransaction` nor `commitBulkImport` checked the category's type at all.
2. **Finding 4.** An expense that took a cash or bank wallet below zero said nothing. The transfer form warned, but it also warned for a credit card, which owes by design.
3. **Finding 8.** The Dashboard's Wallets card, and the Wallets page's list, captioned an allocation bar with nothing above zero "No money in your wallets yet", even when the wallets added up to less than zero.
4. **Finding 11.** The entry form's wallet field read "Paying Wallet" for an income too.

## Decision

1. **`addTransaction` refuses an EXPENSE or INCOME under a category of another type**, with "An expense can't be filed under Balance Adjustment" (or "Income can't…"). The check is type equality, so it covers the two system categories (types `ADJUSTMENT` and `DEBT_REPAYMENT`) and an income under an expense category alike.
   - **Placement:** after the replay check and before the in-flight key is taken, like ADR `0016`'s repayment guard, so a replay still wins and a refusal leaks no key.
   - **No caller intends otherwise.** The forms offer only matching categories, a repayment carries the Debt Repayment category, and an adjustment carries Balance Adjustment; neither of the last two is EXPENSE or INCOME, so neither is checked.
2. **`commitBulkImport` drops a category of another type** (by id or by name), and the row imports uncategorized. The row's type decides which way the money moves, so it wins, as it already did over the classifier.
   - **The preview agrees:**
     - The picker lists the row type's categories only.
     - A Category cell of another type counts as no category, so the keyword rules and Jev may fill it.
     - Jev's suggestion of another type is not offered as a one-click chip, which would have done nothing.
     - The "Classified N of M" note counts only answers of the row's type.
   - **Not refused.** A file exported before ADR `0084` (an expense under Balance Adjustment) still imports, and that expense now counts as spending.
3. **`EditTransactionPanel` lists the draft type's live categories**, plus the row's own category while its type is unchanged. A legacy mis-filed row still shows what it holds, and an edit to its note leaves the category as it is.
   - Switching type clears a category of the old type; switching back restores the row's own.
   - `updateTransaction` itself is not checked: a mis-filed legacy row must stay saveable.
4. **Overdraft (finding 4): an inline warning, not a confirmation dialog.**
   - **`overdraftBy(wallet, after)`** (`selectors/wallets.ts`) is how far below zero `after` is, or 0 for a credit card.
   - `TransactionForm` warns for an EXPENSE or a repayment ("This overdraws Cash by ฿100.50."), computed with `addTransaction`'s own source arithmetic. `WalletTransferForm` now uses the same function, so it no longer warns for a credit card.
   - **Neither blocks** (ADR `0014`); `canSubmit` does not read the warning.
   - **Why no dialog:** the starter wallets open at ฿0.00 (ADR `0040`), so a new account's first expense would always stop to ask. A warning beside the amount says the same thing before the tap, at no cost.
5. **Finding 8:** `emptyWalletsCaption(wallets)` (`wallet/walletFormStyles.ts`) is the caption on both pages. It reads "Your wallets add up to −฿1,200.00" when the active wallets' `walletTotal` is below zero, and "No money in your wallets yet" otherwise. The bar's caption still shows only when no wallet is above zero.
6. **Finding 11:** the wallet field reads "Receiving Wallet" in Income mode, and "Paying Wallet" for an expense and a repayment.

## Not changed

- **The live rows.** The seven rows under Balance Adjustment stay, by the owner's decision. Editing one keeps its category until another is picked.
- **The database functions.** `record_transaction`, `update_transaction` and `import_transactions` do not check category types. The client checks are the guard, and a server check would need a migration.
- **The transfer preview's red after-balance.** A negative figure is red everywhere, credit card or not; only the warning changed.

## Tests

- **`unit/ledger-guards.test.tsx` (+8):**
  - five refusals: an expense under Balance Adjustment, under Debt Repayment and under an income category; income under Balance Adjustment and under an expense category;
  - a matching category accepted after a refusal on the same key (no leaked key);
  - an adjustment and a repayment on their own categories accepted;
  - an import of five rows, three dropped to uncategorized, two kept.
- **`unit/transactions-page.test.tsx` (+3):**
  - the edit panel lists an income row's two income categories;
  - a legacy expense under Balance Adjustment shows it and keeps it through a note edit;
  - a type switch clears the category, and switching back restores it.
- **`unit/csv-import-categories.test.tsx` (new, 3):**
  - the picker per type (expense, income, adjustment);
  - a cell naming Balance Adjustment on an expense lets Jev fill the row;
  - Jev's income category for an expense row is neither applied nor offered, and the note counts it as no answer.
- **`unit/overdraft-warning.test.tsx` (new, 5):**
  - `overdraftBy`;
  - the entry form warns past zero and stays submittable;
  - no warning for a credit card or for income;
  - "Receiving Wallet" in Income mode;
  - the transfer form warns for cash and not for a credit card.
- **`unit/dashboard.test.tsx`, `unit/wallets-page.test.tsx` (+1 each):** the negative total instead of "no money".
- **Red first:** all 21 failed on the unfixed code. Two failures were the tests' own and were fixed before the code: a quote that broke a file, and a text query that matched the live region too.
