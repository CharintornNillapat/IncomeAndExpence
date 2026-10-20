# Review report: T787

## Round 1

### 1. Metadata

- **Task:** T787
- **Date:** 2026-10-19
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:**
  - `src/context/FinanceContext.tsx`
  - `unit/ledger-guards.test.tsx`

### 2. Summary

In `src/context/FinanceContext.tsx`, `addTransaction` now computes `const roundedAmount = roundToCents(data.amount);` at entry and validates `{ ...data, amount: roundedAmount }` through `TransactionSchema.safeParse`. Sub-cent amounts that round to zero (`0.004` or `-0.004`) fail schema validation with `'Amount must be greater than 0'` or `'An adjustment must not be zero'`, preventing zero-value rows in guest and authenticated stores. Repayment float noise within half a cent (`DEBT_REMAINING + 0.004`) rounds to `DEBT_REMAINING` and settles debts cleanly without triggering the ADR 0016 overpayment guard.

### 3. Invariants and parity

- **Parity Map Row 1 (`addTransaction` / `setTransactionDeleted` arithmetic vs `_ledger_apply_effect` and ledger RPCs):** Checked and verified. PostgreSQL RPCs `record_transaction` (`20260928_phase52_security_ledger.sql:221`) and `transfer_funds` (`20261006_phase93_transfer_funds_from_session.sql:76`) execute `v_amount := round(p_amount, 2)` before non-zero checks and debt overpayment checks. Client `addTransaction` now matches this sequence identically.
- **Parity Map Row 2 (Transfer preview and debt payoff block vs `addTransaction`'s TRANSFER and DEBT_REPAYMENT arithmetic, through `roundToCents`):** Checked and verified. Transfer previews in `WalletTransferForm.tsx` and payoff calculations in `TransactionForm.tsx` compute deltas using `roundToCents`, matching `addTransaction`'s `roundedAmount` updates.
- **Single cent-rounding primitive (`src/utils/money.ts:22`):** Checked. Uses `roundToCents` throughout; no custom or inline `Math.round` variants introduced.
- **Strictly non-zero stored ledger records:** Verified. Sub-cent inputs rounding to zero are rejected by `safeParse` before mutating state or persisting.
- **Guard parity between client and SQL RPCs:** Verified. Both client and PostgreSQL RPCs round first and guard second.
- **Exact balance agreement and idempotency:** Verified. Optimistic balance deltas, authenticated RPC arguments (`p_amount`), and guest records use `roundedAmount`. Soft-delete reversals restore the exact recorded amount.
- **Debt overpayment boundary:** Verified. Amounts within `+0.004` round to the exact remaining debt and succeed; amounts of `+0.006` round up and trip the guard.
- **Caller safety audit:** Full text of `addTransaction` and all callers (`applyPreset`, `useTransactions`, `QuickAddModal`, `WalletTransferForm`, `DebtsView`, `WalletsView`, `TransactionsView`) inspected. None bypass or conflict with entry-level cent rounding.

### 4. Gates run

1. **Target file ignore check:**
   - Command: `git check-ignore -v src/context/FinanceContext.tsx unit/ledger-guards.test.tsx`
   - Result: Exit 1, no ignored files.
2. **Red test verification (stashed non-test changes):**
   - Command: `npx vitest run unit/ledger-guards.test.tsx -t "T787"`
   - Result: 1 failed test file, 3 failed, 1 passed, 50 skipped. Exact assertion failures verified on unfixed code.
3. **Linter and type check:**
   - Command: `npm run lint`
   - Result: Exit 0. Node-globals clean (132 files), safe-ids clean (132 files), `tsc --noEmit` clean, `tsc -p api/tsconfig.json` clean.
4. **Targeted unit tests:**
   - Command: `npx vitest run unit/ledger-guards.test.tsx unit/authenticated-ledger.test.tsx`
   - Result: 2 test files, 181 passed in 39.07s.
5. **Full unit test suite:**
   - Command: `npm run test:unit`
   - Result: 63 test files, 1460 passed in 70.63s.
   - Log: `workflow/stages/03_review/output/logs/T787-unit.log`
6. **Affected Playwright specs on Chromium:**
   - Command: `npx playwright test tests/transaction.spec.ts tests/debt-repayment.spec.ts tests/soft-delete.spec.ts --project=chromium`
   - Result: 23 passed in 26.0s.
   - Log: `workflow/stages/03_review/output/logs/T787-e2e-chr.log`
7. **Affected Playwright specs on all 3 browsers:**
   - Command: `npx playwright test tests/transaction.spec.ts tests/debt-repayment.spec.ts tests/soft-delete.spec.ts`
   - Result: 69 passed (23 chromium, 23 firefox, 23 webkit) in 1.7m.
   - Log: `workflow/stages/03_review/output/logs/T787-e2e.log`
8. **Line endings check:**
   - Command: `git ls-files --eol src/context/FinanceContext.tsx unit/ledger-guards.test.tsx docs/audit/task-ledger.md`
   - Result: All target and bookkeeping files `i/lf w/crlf`.
9. **Em dash check:**
   - Command: Node diff check on `git diff -U0 HEAD`
   - Result: 0 em dashes found.

### 5. Not verified

none.

### 6. Blocking

none.

### 7. Non-blocking

none.

### 8. Rule candidates

none.
