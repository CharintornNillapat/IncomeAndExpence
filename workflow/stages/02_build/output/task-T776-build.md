# Build report: T776

Phase 139: useTransactions honours an explicit includeDeleted: true (finding CS-01, low; no ADR).

## Files changed (2 target files + task-ledger.md)

1. `src/hooks/useTransactions.ts`:
   - Removed line 68 (`if (includeDeleted && !showSoftDeleted && tx.isDeleted) return false;`), which erroneously dropped soft-deleted rows when `includeDeleted: true` was passed while `showSoftDeleted` was `false`.
   - Removed `showSoftDeleted` from the `baseFilteredTransactions` `useMemo` dependency array on line 95, as the memo body no longer references it.

2. `unit/use-transactions.test.tsx` (new):
   - Created unit test suite verifying `useTransactions`'s `includeDeleted` option with `FinanceProvider`.
   - Test 1: `includeDeleted: true returns soft-deleted rows while showSoftDeleted is off` (verifies both `tx-live` and `tx-gone` are returned while `showSoftDeleted` is `false`).
   - Test 2: `with no option the toggle decides` (verifies default behaviour follows `showSoftDeleted`).

3. `docs/audit/task-ledger.md` (bookkeeping):
   - Added `## Phase 139 - Subagent trial: useTransactions honours an explicit includeDeleted: true (CS-01, no ADR)` section above `## Backlog`.
   - Branch line: `Branch `phase-139-subagent-trial`, cut from `main` at `2e81e2c`.`
   - Added T776 row with Status `done`, empty `Commit` cell, and full gate result summary.
   - Added Backlog row for CS-01 with Status `done in Phase 139 (T776)`.

## Tests added and fail-then-pass evidence

- 2 new unit tests added in `unit/use-transactions.test.tsx`:
  1. `includeDeleted: true returns soft-deleted rows while showSoftDeleted is off`
  2. `with no option the toggle decides`

- **Red run evidence**:
  - Command: `npx vitest run unit/use-transactions.test.tsx`
  - Output log: `workflow/stages/02_build/output/logs/T776-red.log`
  - Result: 1 failed, 1 passed (2 tests)
  - Failure snippet:
    ```
    FAIL  unit/use-transactions.test.tsx > useTransactions includeDeleted option (CS-01) > includeDeleted: true returns soft-deleted rows while showSoftDeleted is off
    AssertionError: expected [ 'tx-live' ] to include 'tx-gone'
     ❯ unit/use-transactions.test.tsx:58:17
         56|     const ids = result.current.transactions.map((tx) => tx.id);
         57|     expect(ids).toContain('tx-live');
         58|     expect(ids).toContain('tx-gone');
           |                 ^
         59|   });
    ```

- **Green run evidence**:
  - Command: `npx vitest run unit/use-transactions.test.tsx`
  - Result: 1 passed, 2 passed (2 tests) in 1.38s.

## Gate commands and results

1. Red gate:
   - `npx vitest run unit/use-transactions.test.tsx`: test 1 failed on missing `tx-gone`, test 2 passed. Saved to `workflow/stages/02_build/output/logs/T776-red.log`.

2. Lint:
   - `npm run lint`: passed clean (check:node-globals 132 files clean, check:safe-ids 132 files clean, tsc --noEmit clean, tsc -p api/tsconfig.json clean).

3. Targeted unit tests:
   - `npx vitest run unit/use-transactions.test.tsx unit/transactions-page.test.tsx`: 2 test files passed, 26 passed in 3.91s.

4. Full unit suite:
   - `npm run test:unit`: 63 test files passed, 1440 passed in 43.94s.
   - Log path: `workflow/stages/02_build/output/logs/T776-unit.log`.

5. Targeted Playwright on Chromium (2 specs):
   - Ports 3000 and 3100 confirmed clear before run.
   - `npx playwright test tests/soft-delete.spec.ts tests/transaction.spec.ts --project=chromium`: 12 passed in 36.4s.

6. Targeted Playwright on all 3 browsers (2 specs across Chromium, Firefox, WebKit):
   - Ports 3000 and 3100 confirmed clear before run.
   - `npx playwright test tests/soft-delete.spec.ts tests/transaction.spec.ts`: 36 passed in 1.0m.

7. Line endings check:
   - `git ls-files --eol -o -c src/hooks/useTransactions.ts unit/use-transactions.test.tsx docs/audit/task-ledger.md`: confirmed `w/crlf` for all three files.

8. No em dash check:
   - Git diff check: 0 em dashes added.
   - Whole file check: 0 em dashes in `unit/use-transactions.test.tsx`.
   - Build report: 0 em dashes.

9. Diff precision check:
   - `git diff HEAD -- src/hooks/useTransactions.ts`: shows only line 68 removed and `showSoftDeleted` removed from the dependency array, exactly as required.

## Deliberately not done

- Any other change in `src/hooks/useTransactions.ts` (search stages, action handlers, return shape).
- `src/views/TransactionsView.tsx` and the `showSoftDeleted` toggle itself; callers are not modified to pass `includeDeleted`.
- Other audit 2026-10-16 findings (CS-02, SL-01, etc.).
- Changing `includeDeleted` type or default behaviour.
- `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md` (T776 does not ship the phase).
