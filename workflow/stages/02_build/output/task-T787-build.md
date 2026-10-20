# Build report: T787

Phase 141, branch `phase-141-fix-money-rounding`. Source: Backlog row 98 from blind Opus review of T781.

## Files changed (3)

1. `src/context/FinanceContext.tsx` (target file: round amount once with `roundToCents` at `addTransaction` entry, validate rounded amount, use rounded amount in ADR 0016 overpayment guard, optimistic balance calculations, RPC params, and guest newTx)
2. `unit/ledger-guards.test.tsx` (target file: add test suite for T787 verifying sub-cent zero rejections and half-cent repayment tolerance)
3. `docs/audit/task-ledger.md` (bookkeeping: add Phase 141 section with T787 row marked done, mark Backlog row 98 done in Phase 141)

## Tests added

In `unit/ledger-guards.test.tsx`:
Added test suite `guest addTransaction rounds amount before validation and overpayment checks (T787)` with 4 tests:
1. `rejects an expense whose sub-cent amount rounds to zero`: verifies `0.004` is rejected by `TransactionSchema.safeParse` with `'Amount must be greater than 0'` and records 0 transactions.
2. `rejects an adjustment whose sub-cent amount rounds to zero`: verifies `0.004` adjustment is rejected with `'An adjustment must not be zero'` and records 0 transactions.
3. `accepts a debt repayment with sub-cent float excess that rounds to the exact balance`: verifies `DEBT_REMAINING + 0.004` rounds to `DEBT_REMAINING`, settles the debt cleanly, and sets `tx.amount` to `DEBT_REMAINING`.
4. `rejects a debt repayment whose rounded amount exceeds remaining balance`: verifies `DEBT_REMAINING + 0.006` rounds up and is rejected by the overpayment guard.

## Fail-then-pass evidence

Red run: before changing `src/context/FinanceContext.tsx`, ran `npx vitest run unit/ledger-guards.test.tsx -t "T787"`.
Output saved to `workflow/stages/02_build/output/logs/T787-red.log`.

Command and failure:
```
npx vitest run unit/ledger-guards.test.tsx -t "T787"

 FAIL  unit/ledger-guards.test.tsx > guest addTransaction rounds amount before validation and overpayment checks (T787) > rejects an expense whose sub-cent amount rounds to zero
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ unit/ledger-guards.test.tsx:785:28
    783|       }),
    784|     );
    785|     expect(result.success).toBe(false);
       |                            ^
    786|     expect(result.error).toContain('Amount must be greater than 0');
    787|     expect(state().transactions).toHaveLength(0);

 FAIL  unit/ledger-guards.test.tsx > guest addTransaction rounds amount before validation and overpayment checks (T787) > rejects an adjustment whose sub-cent amount rounds to zero
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ unit/ledger-guards.test.tsx:801:28
    799|       }),
    800|     );
    801|     expect(result.success).toBe(false);
       |                            ^
    802|     expect(result.error).toContain('An adjustment must not be zero');
    803|     expect(state().transactions).toHaveLength(0);

 FAIL  unit/ledger-guards.test.tsx > guest addTransaction rounds amount before validation and overpayment checks (T787) > accepts a debt repayment with sub-cent float excess that rounds to the exact balance
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ unit/ledger-guards.test.tsx:808:28
    806|   it('accepts a debt repayment with sub-cent float excess that rounds ...
    807|     const result = await call(() => repay({ amount: DEBT_REMAINING + 0.004 }));
    808|     expect(result.success).toBe(true);
       |                            ^
    809|     expect(debt().remainingAmount).toBe(0);
    810|     expect(debt().isSettled).toBe(true);

Test Files  1 failed (1)
Tests  3 failed | 1 passed | 50 skipped (54)
```

After updating `src/context/FinanceContext.tsx`:
Targeted tests pass: `npx vitest run unit/ledger-guards.test.tsx unit/authenticated-ledger.test.tsx`: 2 test files, 181 passed.

## Gate commands and results

1. Red run on unfixed code:
   - `npx vitest run unit/ledger-guards.test.tsx -t "T787"`: 3 failed, 1 passed, 50 skipped.
   - Saved to `workflow/stages/02_build/output/logs/T787-red.log`.

2. Linter and type check:
   - `npm run lint`: clean (exit 0).
   - Node-globals: 132 files checked, no Node globals.
   - Safe-ids: 132 files checked, no id from time alone.
   - TypeScript: 0 errors across main project and api.

3. Targeted unit tests:
   - `npx vitest run unit/ledger-guards.test.tsx unit/authenticated-ledger.test.tsx`: 2 passed (181 passed) in 39.30s.

4. Full unit test suite:
   - `npm run test:unit`: 63 passed (1460 passed) in 71.99s.
   - Saved to `workflow/stages/02_build/output/logs/T787-unit.log`.

5. Affected Playwright specs on Chromium:
   - `npx playwright test tests/transaction.spec.ts tests/debt-repayment.spec.ts tests/soft-delete.spec.ts --project=chromium`: 23 passed in 29.3s.
   - Saved to `workflow/stages/02_build/output/logs/T787-e2e-chr.log`.

6. Affected Playwright specs on all 3 browsers:
   - `npx playwright test tests/transaction.spec.ts tests/debt-repayment.spec.ts tests/soft-delete.spec.ts`: 69 passed in 1.9m.
   - Saved to `workflow/stages/02_build/output/logs/T787-e2e.log`.

7. Line endings verification:
   - `git ls-files --eol src/context/FinanceContext.tsx unit/ledger-guards.test.tsx docs/audit/task-ledger.md`: all files `i/lf w/crlf`.

8. Em dash check:
   - Node diff check returned `0` em dashes in git diff.

## Deliberately not done

- Commit cell in `docs/audit/task-ledger.md` left empty.
- Did not edit `src/utils/csvExchange.ts` (companion Backlog item row 99).
- Did not edit `src/utils/zodSchemas.ts` or `src/utils/money.ts`.
- Did not edit `supabase/` files.
