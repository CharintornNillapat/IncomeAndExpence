# Build report: T781

Phase 140, branch `phase-140-gemini-trial`. Source: `docs/audit/audit-2026-10-16.md` finding SL-03 (low).

## Files changed (3)

1. `src/context/FinanceContext.tsx` (target file: wrap `data.amount` in `roundToCents(data.amount)` on guest `newTx`)
2. `unit/ledger-guards.test.tsx` (target file: import `roundToCents` and add SL-03 describe block)
3. `docs/audit/task-ledger.md` (bookkeeping: add T781 row marked done under Phase 140, add SL-03 finding marked done in Backlog)

## Tests added

In `unit/ledger-guards.test.tsx`:
1. Imported `roundToCents` from `../src/utils/money`.
2. Added `describe('guest addTransaction rounds the stored transaction amount to cents (SL-03)')` with test:
   `stores roundToCents(amount) on positive and negative entries so the row matches the wallet delta and reverses cleanly`.
   - Tests positive sub-cent amount `10.124` on `EXPENSE`, verifies `expRow.amount === 10.12`, wallet balance `2489.88`, and `roundToCents(2500 - balance) === expRow.amount`.
   - Tests soft-delete and restore cycles to verify wallet balance reverts to `2500` and back to `2489.88`.
   - Tests negative sub-cent amount `-10.124` on `ADJUSTMENT`, verifies `adjRow.amount === -10.12` and wallet balance `2479.76`.

## Fail-then-pass evidence

Red run: before changing `src/context/FinanceContext.tsx`, ran `npx vitest run unit/ledger-guards.test.tsx -t "SL-03"`.
Output saved to `workflow/stages/02_build/output/logs/T781-red.log`.

Failure log:
```
 FAIL  unit/ledger-guards.test.tsx > guest addTransaction rounds the stored transaction amount to cents (SL-03) > stores roundToCents(amount) on positive and negative entries so the row matches the wallet delta and reverses cleanly
AssertionError: expected 10.124 to be 10.12 // Object.is equality

- Expected
+ Received

- 10.12
+ 10.124

 ❯ unit/ledger-guards.test.tsx:746:27
```

After updating `src/context/FinanceContext.tsx`:
- `npx vitest run unit/ledger-guards.test.tsx unit/authenticated-ledger.test.tsx`: 2 test files, 177 tests passed.

## Gate commands and results

1. `npm run lint`: clean
   - Node-globals: 132 files checked, no Node globals.
   - Safe-ids: 132 files checked, no id from time alone.
   - `tsc --noEmit` and `tsc -p api/tsconfig.json`: 0 errors.

2. `npx vitest run unit/ledger-guards.test.tsx unit/authenticated-ledger.test.tsx`:
   - 2 test files passed, 177 passed in 38.59s.

3. `npm run test:unit`:
   - 63 test files passed, 1445 tests passed in 90.21s.
   - Full suite output saved to `workflow/stages/02_build/output/logs/T781-unit.log`.

4. Port check:
   - Port 3000 and 3100 clean (no stale dev servers).

5. `npx playwright test tests/transaction.spec.ts tests/soft-delete.spec.ts --project=chromium`:
   - 12 passed in 28.1s.

6. `npx playwright test tests/transaction.spec.ts tests/soft-delete.spec.ts`:
   - 36 passed across Chromium, Firefox, WebKit in 1.6m.

7. Formatting and scope checks:
   - `git ls-files --eol`: `w/crlf` on all three touched files (`FinanceContext.tsx`, `ledger-guards.test.tsx`, `task-ledger.md`).
   - `git diff -U0 HEAD -- src/context/FinanceContext.tsx`: exactly 1 insertion, 1 deletion at line 1943.
   - Em dash check via Node: `0` em dashes added.
   - `git status --porcelain`: only modified target files, ledger, and workflow output.

## Deliberately not done

- Commit cell in `docs/audit/task-ledger.md` left empty.
- No changes to `updateTransaction` or `commitBulkImport`.
