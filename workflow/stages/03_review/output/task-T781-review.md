# Task T781 Review

## Round 1

### 1. Metadata
- **Task:** T781 - guest addTransaction rounds newTx.amount with roundToCents (SL-03)
- **Date:** 2026-10-19
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:**
  - `src/context/FinanceContext.tsx` (tracked, `git check-ignore -v` exit 1, `w/crlf`)
  - `unit/ledger-guards.test.tsx` (tracked, `git check-ignore -v` exit 1, `w/crlf`)
  - `docs/audit/task-ledger.md` (bookkeeping, tracked, `git check-ignore -v` exit 1, `w/crlf`)

### 2. Summary
In `src/context/FinanceContext.tsx:1943`, the guest branch of `addTransaction` now assigns `amount: roundToCents(data.amount)` instead of raw `data.amount` when constructing `newTx`. `unit/ledger-guards.test.tsx` imports `roundToCents` and adds the SL-03 suite verifying cent-rounding on positive (`EXPENSE`) and negative (`ADJUSTMENT`) guest entries, wallet delta parity, and exact reversal across `softDeleteTransaction` and `restoreTransaction`. `docs/audit/task-ledger.md` records `T781` under Phase 140 and marks the SL-03 Backlog row done in Phase 140 (T781).

### 3. Invariants and parity
- **Cross-file parity map Row 1 (`addTransaction` / `setTransactionDeleted` arithmetic in `FinanceContext.tsx` vs `_ledger_apply_effect` and the ledger RPCs in `supabase/migrations/`):** Checked and holds. Guest `addTransaction` now stores `roundToCents(data.amount)` on `newTx` (`src/context/FinanceContext.tsx:1943`), matching `record_transaction` (`v_amount := round(p_amount, 2)`, `supabase/migrations/20260928_phase52_security_ledger.sql:221`), `transfer_funds` (`v_amount := round(p_amount, 2)`, `supabase/migrations/20261006_phase93_transfer_funds_from_session.sql:76`), and `updateTransaction` (`amount: roundToCents(edit.amount)`, `src/context/FinanceContext.tsx:2256`).
- **Cross-file parity map Row 2 (Transfer preview and debt payoff block vs `addTransaction`'s TRANSFER and DEBT_REPAYMENT arithmetic, through `roundToCents`):** Checked by hand (`src/components/wallet/WalletTransferForm.tsx:222-228` and `src/components/TransactionForm.tsx:562`). Unchanged and consistent; both preview wallet deltas with `roundToCents(balance +/- amount)`.
- **Money Invariant 1 (Single cent-rounding primitive, `src/utils/money.ts:22`):** Checked. `roundToCents(data.amount)` is used at `src/context/FinanceContext.tsx:1943`; no inline `Math.round` introduced.
- **Money Invariant 2 (Wallet-balance and transaction-amount agreement in guest mode):** Checked. For `sourceWallet.balance` already cent-precise (`2500`), `roundToCents(2500 - 10.124) = 2489.88` and `roundToCents(10.124) = 10.12`, so `roundToCents(2500 - 2489.88) === newTx.amount`.
- **Money Invariant 3 (Soft-delete and restore exact reversal):** Checked. `setTransactionDeleted` (`src/context/FinanceContext.tsx:2080-2092`) computes `roundToCents(sourceWallet.balance + sign * tx.amount)`. Because `tx.amount` is now `10.12` instead of `10.124`, soft-delete (`sign = +1`) computes `roundToCents(2489.88 + 10.12) = 2500` and restore (`sign = -1`) computes `roundToCents(2500 - 10.12) = 2489.88` with zero sub-cent drift.
- **Strict-mode money edge cases and callers checked in full:**
  1. **Signs (`EXPENSE`, `INCOME`, `DEBT_REPAYMENT`, `TRANSFER`, `ADJUSTMENT`):** `TransactionSchema` requires positive amounts for all types except `ADJUSTMENT`, which allows non-zero negative or positive amounts (ADR 0024). In JS, `Math.round(-10.124 * 100) / 100 === -10.12`, matching `roundToCents(2489.88 + (-10.124)) = 2479.76`. Verified in the new SL-03 test (`unit/ledger-guards.test.tsx:756-770`).
  2. **Half-cent boundary rounding:** Both `roundToCents(balance +/- data.amount)` (when `balance` is an integer number of cents) and `roundToCents(data.amount)` scale by `100` and call `Math.round`, keeping the stored `newTx.amount` aligned with the wallet delta.
  3. **Soft-deleted rows (`isDeleted`):** `addTransaction` resolves `sourceWallet` (`:1684`), `destWallet` (`:1694`), and `targetDebt` (`:1743`) with `!isDeleted` guards before mutating state; `newTx` initializes `isDeleted: false` (`:1949`). `setTransactionDeleted` (`:2050-2158`) reverses and reapplies `tx.amount` cleanly on both wallets and `targetDebt`.
  4. **Transfers (`TRANSFER`):** Source (`roundToCents(sourceWallet.balance - data.amount)`, `:1777`) and destination (`roundToCents(destWallet.balance + data.amount)`, `:1784`) both move by `roundToCents(data.amount)`, matching the stored `newTx.amount` (`:1943`) and reversing symmetrically in `setTransactionDeleted` (`:2083`, `:2091`).
  5. **Concurrency and idempotency guards:** `inFlightIdempotencyKeys` check (`:1703`), `existingTx` replay check (`:1708`), category-type guard (`:1719`), and debt overpayment guard (`:1745`) all remain untouched in their load-bearing sequence prior to `inFlightIdempotencyKeys.current.add(clientKey)` (`:1757`), state snapshots (`:1766-1771`), and the `finally` key release (`:2008`).
  6. **All callers of `addTransaction` read in full:**
     - `applyPreset` (`src/context/FinanceContext.tsx:2016-2043`)
     - `QuickAddModal` (`src/components/QuickAddModal.tsx:47-59`)
     - `WalletTransferForm` (`src/components/wallet/WalletTransferForm.tsx:267-283`)
     - `useTransactions` (`src/hooks/useTransactions.ts:126-142`)
     - `DebtsView` (`src/views/DebtsView.tsx:174-191`)
     - `TransactionsView` (`src/views/TransactionsView.tsx:527-536`)
     - `WalletsView` (`src/views/WalletsView.tsx:103-120`, where `const diff = newBalance - Number(target.balance)` can produce IEEE-754 sub-cent float noise such as `10.100000000000009` and passes `amount: diff` directly to `addTransaction`; `roundToCents(data.amount)` at `:1943` now normalizes the stored guest `ADJUSTMENT` row to cents).

### 4. Gates run
- **Scope and ignore check:**
  - `git check-ignore -v src/context/FinanceContext.tsx unit/ledger-guards.test.tsx docs/audit/task-ledger.md`: exit code 1 (no target file is ignored).
  - `git diff --stat`: 3 files changed, 45 insertions(+), 1 deletion(-) (`docs/audit/task-ledger.md` 2+, `src/context/FinanceContext.tsx` 1+/1-, `unit/ledger-guards.test.tsx` 42+).
  - `git status --porcelain`: only `docs/audit/task-ledger.md`, `src/context/FinanceContext.tsx`, `unit/ledger-guards.test.tsx`, and the stage 01/02 output files.
- **Red-run verification (Step 6 stash check):**
  - Stashed `src/context/FinanceContext.tsx` (`git stash push -- src/context/FinanceContext.tsx`) and ran `npx vitest run unit/ledger-guards.test.tsx -t "SL-03"`.
  - Result: 1 file, 1 failed, 49 skipped (50 total) in 1.60s (`AssertionError: expected 10.124 to be 10.12` at `unit/ledger-guards.test.tsx:746:27`).
  - Restored with `git stash pop --index` and confirmed `git status --porcelain` was identical to pre-stash state.
- **Lint (`npm run lint`):**
  - Passed (exit 0): `node-globals: 132 files in src, no Node globals`, `safe-ids: 132 files in src, no id from the time alone`, `tsc --noEmit` (0 errors), `tsc -p api/tsconfig.json` (0 errors).
- **Targeted unit tests (`npx vitest run unit/ledger-guards.test.tsx unit/authenticated-ledger.test.tsx`):**
  - Passed (exit 0): 2 files, 177 tests passed (50 in `unit/ledger-guards.test.tsx`, 127 in `unit/authenticated-ledger.test.tsx`), 0 failed, 0 skipped (38.45s).
- **Full unit suite (`npm run test:unit`):**
  - Passed (exit 0): 63 files passed, 1445 tests passed, 0 failed, 0 skipped (86.35s).
  - Log: `workflow/stages/03_review/output/logs/T781-unit.log`.
- **Playwright Chromium gate (`npx playwright test tests/transaction.spec.ts tests/soft-delete.spec.ts --project=chromium`):**
  - Ports 3000 and 3100 verified clean before launch.
  - Passed (exit 0): 2 spec files, 12 tests passed, 0 failed, 0 skipped (24.5s).
  - Log: `workflow/stages/03_review/output/logs/T781-e2e-chr.log`.
- **Playwright 3-browser gate (`npx playwright test tests/transaction.spec.ts tests/soft-delete.spec.ts`):**
  - Passed (exit 0): 2 spec files across 3 browsers (chromium, firefox, webkit), 36 tests passed, 0 failed, 0 skipped (1.6m).
  - Log: `workflow/stages/03_review/output/logs/T781-e2e.log`.
- **Line endings and em-dash checks:**
  - `git ls-files --eol src/context/FinanceContext.tsx unit/ledger-guards.test.tsx docs/audit/task-ledger.md`: all three report `i/lf w/crlf`.
  - Added-lines em-dash count across `git diff -U0 HEAD`: `0`.

### 5. Not verified
- `docs/audit/task-ledger.md` was left out of the Step 6 `git stash push` because it is a markdown bookkeeping file that no test reads.

### 6. Blocking
None.

### 7. Non-blocking
- In `src/views/WalletsView.tsx:107`, `const diff = newBalance - Number(target.balance)` computes a raw float difference and formats it into the description string at line 113 before passing `amount: diff` to `addTransaction`. `formatCurrencyAmount(Math.abs(diff))` formats to 2 decimals and `addTransaction` now rounds both the wallet balance and `newTx.amount` with `roundToCents`, but wrapping `roundToCents(newBalance - Number(target.balance))` at `WalletsView.tsx:107` could be a minor cleanup in a future task so `diff === 0` at line 108 also ignores sub-cent float noise.

### 8. Rule candidates
None.
