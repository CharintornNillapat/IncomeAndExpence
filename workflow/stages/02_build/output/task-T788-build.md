# Build report: T788

Phase 141, branch `phase-141-fix-money-rounding`. Source: Backlog row 99 from blind Opus review of T781.

## Files changed (3)

1. `src/utils/csvExchange.ts` (target file: import `roundToCents`, round amount before non-zero checks, normalize -0 to 0, accumulate `totalAmount` with `roundToCents`, assign `amount: roundedAmount`, and round summary `totalAmount` with `roundToCents`)
2. `unit/csv-exchange.test.ts` (target file: add three unit tests inside `parseAndValidateTransactionCsv - amounts` verifying sub-cent expense and adjustment zero rejection, and whole-cent rounding)
3. `docs/audit/task-ledger.md` (bookkeeping: add T788 row marked done under Phase 141, mark Backlog row 99 done in Phase 141)

## Tests added

In `unit/csv-exchange.test.ts` inside `describe('parseAndValidateTransactionCsv - amounts', ...)`:
1. `rejects an expense whose sub-cent amount rounds to zero (T788)`: validates `0.004` expense is marked `isValid: false` with `'Amount must be a positive number'`, `validRowsCount: 0`, `invalidRowsCount: 1`, `totalAmount: 0`.
2. `rejects an adjustment whose sub-cent amount rounds to zero (T788)`: validates both positive (`+0.004`) and negative (`-0.004`) adjustments that round to zero cents are marked `isValid: false` with `'An adjustment must not be zero'`, `validRowsCount: 0`, `invalidRowsCount: 1`.
3. `rounds valid sub-cent amounts to whole cents with roundToCents (T788)`: validates `10.004` expense rounds to `10.00` and `20.006` income rounds to `20.01`, producing `validRowsCount: 2`, `invalidRowsCount: 0`, and `totalAmount: 30.01`.

## Fail-then-pass evidence

Red run: before updating `src/utils/csvExchange.ts`, ran `npx vitest run unit/csv-exchange.test.ts -t "T788"`.
Output saved to `workflow/stages/02_build/output/logs/T788-red.log`.

Command and failure:
```
npx vitest run unit/csv-exchange.test.ts -t "T788"

 FAIL  unit/csv-exchange.test.ts > parseAndValidateTransactionCsv - amounts > rejects an expense whose sub-cent amount rounds to zero (T788)
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ unit/csv-exchange.test.ts:35:37
     33|   it('rejects an expense whose sub-cent amount rounds to zero (T788)',...
     34|     const preview = await parseAndValidateTransactionCsv(csv('2026-09-28,Cash,EXPENSE,0.004,Sub-cent zero expense'), WALLETS);
     35|     expect(preview.rows[0].isValid).toBe(false);
       |                                     ^
     36|     expect(preview.rows[0].errorMessage).toContain('Amount must be a positive number');
     37|     expect(preview.validRowsCount).toBe(0);

 FAIL  unit/csv-exchange.test.ts > parseAndValidateTransactionCsv - amounts > rejects an adjustment whose sub-cent amount rounds to zero (T788)
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ unit/csv-exchange.test.ts:44:33
     42|   it('rejects an adjustment whose sub-cent amount rounds to zero (T788)...
     43|     const pos = await parseAndValidateTransactionCsv(csv('2026-09-28,Cash,ADJUSTMENT,0.004,Sub-cent zero adjustment'), WALLETS);
     44|     expect(pos.rows[0].isValid).toBe(false);
       |                                 ^
     45|     expect(pos.rows[0].errorMessage).toContain('An adjustment must not be zero');
     46|     expect(pos.validRowsCount).toBe(0);

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed | 16 skipped (19)
```

After updating `src/utils/csvExchange.ts`:
Targeted tests pass: `npx vitest run unit/csv-exchange.test.ts unit/csv-import-categories.test.tsx unit/csv-import-announcer.test.tsx`: 3 test files, 38 passed.

## Gate commands and results

1. Red run on unfixed code:
   - `npx vitest run unit/csv-exchange.test.ts -t "T788"`: 2 failed, 1 passed, 16 skipped.
   - Saved to `workflow/stages/02_build/output/logs/T788-red.log`.

2. Linter and type check:
   - `npm run lint`: clean (exit 0).
   - Node-globals: 132 files checked, no Node globals.
   - Safe-ids: 132 files checked, no id from time alone.
   - TypeScript: 0 errors across main project and api.

3. Targeted unit tests:
   - `npx vitest run unit/csv-exchange.test.ts unit/csv-import-categories.test.tsx unit/csv-import-announcer.test.tsx`: 3 passed (38 passed) in 52.43s.

4. Full unit test suite:
   - `npm run test:unit`: 63 passed (1463 passed) in 68.49s.
   - Saved to `workflow/stages/02_build/output/logs/T788-unit.log`.

5. Affected Playwright specs on Chromium:
   - `npx playwright test tests/csv.spec.ts tests/csv-classify.spec.ts --project=chromium`: 13 passed in 1.1m.
   - Saved to `workflow/stages/02_build/output/logs/T788-e2e-chr.log`.

6. Affected Playwright specs on all 3 browsers:
   - `npx playwright test tests/csv.spec.ts tests/csv-classify.spec.ts`: 39 passed in 1.1m.
   - Saved to `workflow/stages/02_build/output/logs/T788-e2e.log`.

7. Line endings verification:
   - `git ls-files --eol src/utils/csvExchange.ts unit/csv-exchange.test.ts docs/audit/task-ledger.md`: all files `i/lf w/crlf`.

8. Em dash check:
   - Node diff check returned `0` em dashes in git diff.

## Deliberately not done

- Commit cell in `docs/audit/task-ledger.md` left empty.
- Did not edit `src/context/FinanceContext.tsx` (handled in T787).
- Did not edit `src/utils/money.ts` or `src/utils/mathEvaluator.ts`.
- Did not edit `supabase/` files.
- Did not write `refactor-log.md` or `baseline-metrics.md` (task does not ship phase).
