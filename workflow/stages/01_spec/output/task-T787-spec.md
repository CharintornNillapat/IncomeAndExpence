# Spec T787: Round guest addTransaction amount with roundToCents before safeParse and overpayment checks

## 1. Goal

Round the transaction amount with `roundToCents` once at the entry of `addTransaction` before `TransactionSchema.safeParse` and the ADR 0016 overpayment guard, ensuring sub-cent amounts that round to zero are rejected by validation and repayment float noise within half a cent is accepted without falsely tripping overpayment.

## 2. Target files

```
src/context/FinanceContext.tsx
unit/ledger-guards.test.tsx
```

Note: Bookkeeping file `docs/audit/task-ledger.md` is always allowed and updated as described below.

## 3. Context to read

`docs/contexts/client-state.md` (specifically "Money and dates", lines 47-53, and "Ledger behaviour (addTransaction and friends)", lines 67-76).

## 4. Current behaviour

1. `src/context/FinanceContext.tsx:1675`: `TransactionSchema.safeParse(data)` receives the raw input amount before cent rounding. For a sub-cent expense or income like `0.004`, Zod checks `data.amount > 0` on the raw float, which evaluates to `true`. Similarly, for an adjustment of `0.004` (or `-0.004`), `data.amount === 0` is `false`, passing Zod validation.
2. `src/context/FinanceContext.tsx:1749`: For a `DEBT_REPAYMENT`, `data.amount > targetDebt.remainingAmount` compares the raw float against `remainingAmount`. When `targetDebt.remainingAmount` is `100.00` and `data.amount` is `100.004`, `100.004 > 100.00` evaluates to `true`, so `addTransaction` rejects the payment with `'Payment exceeds the ฿100.00 remaining on ...'` even though `roundToCents(100.004)` is `100.00` and does not exceed the remaining balance.
3. `src/context/FinanceContext.tsx:1777`, `1779`, `1784`, `1813`: Optimistic balance and debt calculations pass raw `data.amount`: `roundToCents(sourceWallet.balance - data.amount)`, `roundToCents(sourceWallet.balance + data.amount)`, `roundToCents(destWallet.balance + data.amount)`, and `roundToCents(targetDebt.remainingAmount - data.amount)`.
4. `src/context/FinanceContext.tsx:1841`, `1903`: Authenticated RPC calls pass raw `data.amount` as `p_amount` (`transfer_funds` and `record_transaction`). While PostgreSQL rounds `p_amount` with `v_amount := round(p_amount, 2)` internally (`supabase/migrations/20260928_phase52_security_ledger.sql:221` and `supabase/migrations/20261006_phase93_transfer_funds_from_session.sql:76`), the client optimistic state and Zod validation operated on unrounded floats.
5. `src/context/FinanceContext.tsx:1943`: Guest ledger store assigns `amount: roundToCents(data.amount)` (introduced in T781). When `data.amount` was `0.004`, `roundToCents(0.004)` produces `0.00`, creating and persisting an invalid `amount: 0.00` transaction record in local storage.
6. `docs/audit/task-ledger.md:98`: Backlog item tracking this Opus review finding is currently marked `todo`.

## 5. Parity map

- **Row 1 (`addTransaction` / `setTransactionDeleted` arithmetic in `FinanceContext.tsx` vs `_ledger_apply_effect` and the ledger RPCs in `supabase/migrations/`):**
  PostgreSQL RPCs `record_transaction` (`supabase/migrations/20260928_phase52_security_ledger.sql:221-229`) and `transfer_funds` (`supabase/migrations/20261006_phase93_transfer_funds_from_session.sql:76-79`) execute `v_amount := round(p_amount, 2)` first, then verify `v_amount > 0` (or `v_amount <> 0` for adjustment) and `v_amount <= remaining_amount`. Client `addTransaction` must match this ordering by computing `const roundedAmount = roundToCents(data.amount);` before `safeParse` and overpayment checks.
- **Row 2 (Transfer preview and debt payoff block vs `addTransaction`'s TRANSFER and DEBT_REPAYMENT arithmetic, through `roundToCents`):**
  Transfer preview (`src/components/wallet/WalletTransferForm.tsx:222-228`) and payoff calculations (`src/components/TransactionForm.tsx:562`) compute deltas through `roundToCents`. Ensuring `addTransaction` rounds `amount` up front preserves formula consistency across UI and ledger execution.

## 6. Money invariants and tests to add

### Money invariants to maintain

1. **Single cent-rounding primitive (`src/utils/money.ts:22`):** `roundToCents` remains the single cent-rounding helper across all ledger paths. No inlined `Math.round` or alternative rounding function may be introduced.
2. **Strictly non-zero stored ledger records:** Non-adjustment transactions (`EXPENSE`, `INCOME`, `TRANSFER`, `DEBT_REPAYMENT`) must have `amount > 0` after rounding to whole cents; `ADJUSTMENT` entries must have `amount !== 0` after rounding to whole cents. Storing an entry that rounds to `0.00` is strictly rejected by `TransactionSchema.safeParse`.
3. **Guard parity between client and SQL RPCs:** Client `addTransaction` must round amounts to cents before validation and overpayment checks, matching PostgreSQL RPC behavior (`v_amount := round(p_amount, 2)`).
4. **Exact balance agreement and idempotency:** Wallet balances, debt balances, and stored transaction amounts must all use the rounded cent amount, ensuring `sourceWallet.balance` delta equals `newTx.amount` with zero fractional float drift. Soft-delete and restore must reverse the exact rounded amount.
5. **No overpayment false-positives from float noise:** A debt repayment specifying an amount within half a cent of the remaining balance (e.g. `DEBT_REMAINING + 0.004`) rounds to `DEBT_REMAINING` and must be accepted, settling the debt cleanly rather than falsely tripping the overpayment guard. Conversely, excess exceeding half a cent (e.g. `DEBT_REMAINING + 0.006`) rounds up to `DEBT_REMAINING + 0.01` and must be rejected.

### Tests to add

File: `unit/ledger-guards.test.tsx`

Add a new test suite at the bottom of the file:
```tsx
describe('guest addTransaction rounds amount before validation and overpayment checks (T787)', () => {
  it('rejects an expense whose sub-cent amount rounds to zero', async () => {
    const result = await call(() =>
      actions().addTransaction({
        amount: 0.004,
        type: 'EXPENSE',
        categoryId: 'cat-food',
        walletId: WALLET_MAIN,
        description: 'Sub-cent zero expense',
        transactionDate: TODAY,
      }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Amount must be greater than 0');
    expect(state().transactions).toHaveLength(0);
  });

  it('rejects an adjustment whose sub-cent amount rounds to zero', async () => {
    const result = await call(() =>
      actions().addTransaction({
        amount: 0.004,
        type: 'ADJUSTMENT',
        categoryId: 'cat-adjust',
        walletId: WALLET_MAIN,
        description: 'Sub-cent zero adjustment',
        transactionDate: TODAY,
      }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('An adjustment must not be zero');
    expect(state().transactions).toHaveLength(0);
  });

  it('accepts a debt repayment with sub-cent float excess that rounds to the exact balance', async () => {
    const result = await call(() => repay({ amount: DEBT_REMAINING + 0.004 }));
    expect(result.success).toBe(true);
    expect(debt().remainingAmount).toBe(0);
    expect(debt().isSettled).toBe(true);
    const tx = state().transactions.find((t) => t.id === result.txId)!;
    expect(tx.amount).toBe(DEBT_REMAINING);
  });

  it('rejects a debt repayment whose rounded amount exceeds remaining balance', async () => {
    const result = await call(() => repay({ amount: DEBT_REMAINING + 0.006 }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Payment exceeds');
    expect(debt().remainingAmount).toBe(DEBT_REMAINING);
    expect(state().transactions).toHaveLength(0);
  });
});
```

### Why these tests fail today (Red run expectations)

When run against the unfixed code:
1. `rejects an expense whose sub-cent amount rounds to zero`: Fails because `TransactionSchema.safeParse(data)` receives `data.amount = 0.004 > 0`, succeeding (`result.success === true`), and storing an invalid `amount: 0.00` transaction.
2. `rejects an adjustment whose sub-cent amount rounds to zero`: Fails because `TransactionSchema.safeParse(data)` receives `data.amount = 0.004 !== 0`, succeeding (`result.success === true`), and storing an invalid `amount: 0.00` adjustment.
3. `accepts a debt repayment with sub-cent float excess that rounds to the exact balance`: Fails because line 1749 evaluates raw `4500.004 > 4500`, returning `{ success: false, error: 'Payment exceeds the ฿4,500.00 remaining on Student Loan' }`.
4. `rejects a debt repayment whose rounded amount exceeds remaining balance`: Passes today and confirms the upper overpayment boundary is preserved after rounding.

## 7. Implementation details for the builder

In `src/context/FinanceContext.tsx`:
1. In `addTransaction`:
   At the very start of the function (before `TransactionSchema.safeParse`), compute:
   ```ts
   const roundedAmount = roundToCents(data.amount);
   ```
2. Validate `{ ...data, amount: roundedAmount }` instead of `data`:
   ```ts
   const validation = TransactionSchema.safeParse({ ...data, amount: roundedAmount });
   ```
3. In the ADR 0016 overpayment guard (around line 1749):
   Replace `data.amount > targetDebt.remainingAmount` with:
   ```ts
   if (roundedAmount > targetDebt.remainingAmount) {
     return {
       success: false,
       error: `Payment exceeds the ${formatCurrencyAmount(targetDebt.remainingAmount)} remaining on ${targetDebt.name}`,
     };
   }
   ```
4. In optimistic wallet and debt balance calculations (lines 1777, 1779, 1784, 1813):
   Replace `data.amount` with `roundedAmount`:
   - `sourceNewBalance = roundToCents(sourceWallet.balance - roundedAmount);`
   - `sourceNewBalance = roundToCents(sourceWallet.balance + roundedAmount);`
   - `destNewBalance = ... roundToCents(destWallet.balance + roundedAmount) ...`
   - `debtNewRemaining = ... Math.max(0, roundToCents(targetDebt.remainingAmount - roundedAmount)) ...`
5. In authenticated RPC parameters (lines 1841, 1903):
   Pass `p_amount: roundedAmount` to `transfer_funds` and `record_transaction`.
6. In guest `newTx` construction (line 1943):
   Use `amount: roundedAmount`.
7. In `docs/audit/task-ledger.md`:
   - Update Backlog row 98 from `todo` to `done in Phase 141 (T787)`.
   - Add task row for T787 to the task table.

## 8. Gates

The union of `AGENTS.md` verification tiers for `src/context/FinanceContext.tsx` and `unit/ledger-guards.test.tsx`:

1. Failing test run on unfixed code (save log to `workflow/stages/02_build/output/logs/T787-red.log`):
   ```powershell
   npx vitest run unit/ledger-guards.test.tsx -t "T787"
   ```
2. Linter and type check:
   ```powershell
   npm run lint
   ```
3. Targeted unit tests:
   ```powershell
   npx vitest run unit/ledger-guards.test.tsx unit/authenticated-ledger.test.tsx
   ```
4. Full unit test suite (save log to `workflow/stages/02_build/output/logs/T787-unit.log`):
   ```powershell
   npm run test:unit
   ```
5. Affected Playwright specs on Chromium (save log to `workflow/stages/02_build/output/logs/T787-e2e-chr.log`):
   ```powershell
   npx playwright test tests/transaction.spec.ts tests/debt-repayment.spec.ts tests/soft-delete.spec.ts --project=chromium
   ```
6. Affected Playwright specs on all 3 browsers (save log to `workflow/stages/02_build/output/logs/T787-e2e.log`):
   ```powershell
   npx playwright test tests/transaction.spec.ts tests/debt-repayment.spec.ts tests/soft-delete.spec.ts
   ```
7. Line endings verification (CRLF check):
   ```powershell
   git ls-files --eol src/context/FinanceContext.tsx unit/ledger-guards.test.tsx docs/audit/task-ledger.md
   ```
8. Em-dash check (must be 0):
   ```powershell
   node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
   ```

## 9. Production touch points

none.

## 10. Out of scope

- Do not edit `src/utils/csvExchange.ts` (that is the companion Backlog item on line 99, tracked for a separate task).
- Do not edit `src/utils/zodSchemas.ts` (`TransactionSchema` remains unchanged; normalization occurs at the caller entry in `FinanceContext.tsx`).
- Do not edit `src/utils/money.ts` or alter the implementation of `roundToCents`.
- Do not edit any files under `supabase/`.
- Do not modify `updateTransaction` in `FinanceContext.tsx` (it already rounds `edit.amount` with `roundToCents` before `safeParse` at line 2256).
- Do not edit `src/hooks/useDebts.ts` or any other hook files.
