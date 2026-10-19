# Build report: T783

Phase 140, branch `phase-140-gemini-trial`. Source: `docs/audit/audit-2026-10-16.md` finding CS-03 (low).

## Files changed (3)

1. `src/hooks/useDebts.ts` (target file: wrap `totalTarget`, `remainingTarget`, and `paidTarget` in `roundToCents`)
2. `unit/debts-page.test.tsx` (target file: import `renderHook`, `useDebts`, `debtRemaining`, add CS-03 test)
3. `docs/audit/task-ledger.md` (bookkeeping: add T783 row marked done under Phase 140, add CS-03 finding marked done in Backlog)

## Tests added

In `unit/debts-page.test.tsx`:
1. Updated imports to include `renderHook` from `@testing-library/react`.
2. Imported `useDebts` from `../src/hooks/useDebts` and `debtRemaining` from `../src/selectors/wallets`.
3. In `describe('the summary')`: added test `'rounds totalTarget, remainingTarget and paidTarget to cents in useDebts().metrics (CS-03)'`:
   - Seeds debts with floating point fractional totals: `10.1` and `20.2` (summing to `30.299999999999997` without rounding), remaining amounts `0.1` and `0.2`.
   - Asserts `metrics.totalTarget === 30.3`.
   - Asserts `metrics.remainingTarget === 0.3` and matches `debtRemaining(seeded)`.
   - Asserts `metrics.paidTarget === 30`.
   - Tests subtraction drift with `0.3 - 0.1` yielding exact `0.2` on single debt.

## Fail-then-pass evidence

Red run: before changing `src/hooks/useDebts.ts`, ran `npx vitest run unit/debts-page.test.tsx -t "CS-03"`.
Output saved to `workflow/stages/02_build/output/logs/T783-red.log`.

Failure log:
```
 FAIL  unit/debts-page.test.tsx > the summary > rounds totalTarget, remainingTarget and paidTarget to cents in useDebts().metrics (CS-03)
AssertionError: expected 30.299999999999997 to be 30.3 // Object.is equality

- Expected
+ Received

- 30.3
+ 30.299999999999997

 ❯ unit/debts-page.test.tsx:230:48
```

After updating `src/hooks/useDebts.ts`:
- `npx vitest run unit/debts-page.test.tsx unit/selectors-debts.test.ts unit/dashboard.test.tsx`: 3 test files, 98 tests passed.

## Gate commands and results

1. `npm run lint`: clean
   - Node-globals: 132 files checked, no Node globals.
   - Safe-ids: 132 files checked, no id from time alone.
   - `tsc --noEmit` and `tsc -p api/tsconfig.json`: 0 errors.

2. `npx vitest run unit/debts-page.test.tsx unit/selectors-debts.test.ts unit/dashboard.test.tsx`:
   - 3 test files passed, 98 tests passed in 3.68s.

3. `npm run test:unit`:
   - 63 test files passed, 1446 tests passed in 77.12s.
   - Full suite output saved to `workflow/stages/02_build/output/logs/T783-unit.log`.

4. Port check:
   - Port 3000 and 3100 clean (no stale dev servers).

5. `npx playwright test tests/debts.spec.ts tests/debts-page.spec.ts --project=chromium`:
   - 4 passed in 49.9s.

6. `npx playwright test tests/debts.spec.ts tests/debts-page.spec.ts`:
   - 12 passed across Chromium, Firefox, WebKit in 1.0m.

7. Formatting and scope checks:
   - `git ls-files --eol`: `w/crlf` on all three touched files (`useDebts.ts`, `debts-page.test.tsx`, `task-ledger.md`).
   - `git diff -U0 HEAD -- src/hooks/useDebts.ts`: 1 import added, 3 lines replaced (totalTarget, remainingTarget, paidTarget).
   - Em dash check via Node: `0` em dashes added in git diff; `0` em dashes in spec.
   - `git status --porcelain`: only modified target files, ledger, and workflow output.

## Deliberately not done

- Commit cell in `docs/audit/task-ledger.md` left empty.
- Did not move debt metric sums to `src/selectors/` (per ADR 0079:32).
