# Build report: T777

Phase 139: setTransactionDeleted re-fetches instead of restoring a stale snapshot (T69, owner decision; no ADR).

## Files changed (2 target files + task-ledger.md)

1. `src/context/FinanceContext.tsx`:
   - Added `cloudRevisionAtStart` snapshot (`const cloudRevisionAtStart = cloudRevisionRef.current;`) after `previousDebts` in `setTransactionDeleted`.
   - Updated the catch block in `setTransactionDeleted` to check `if (cloudRevisionRef.current !== cloudRevisionAtStart)`: calls `await refreshFromCloud()` when revision moved mid-flight; restores optimistic local state in the `else` branch (and re-reads when `rpcOutcomeUnknown`), followed by the `MissingLedgerFunction` check.

2. `unit/authenticated-ledger.test.tsx`:
   - Added 4 unit tests inside `describe('a signed-in delete and restore through set_transaction_deleted (ADR 0023)', ...)` after the RPC rejects test:
     1. `delete: re-fetches instead of restoring a stale snapshot when a reload landed mid-flight (T69)`
     2. `restore: re-fetches instead of restoring a stale snapshot when a reload landed mid-flight (T69)`
     3. `delete: still restores the pre-call snapshot when no reload landed mid-flight (T69)`
     4. `restore: still restores the pre-call snapshot when no reload landed mid-flight (T69)`

3. `docs/audit/task-ledger.md` (bookkeeping):
   - Widened Phase 139 title to `## Phase 139 - Subagent trial: useTransactions includeDeleted (CS-01) and setTransactionDeleted's T69 reload check (no ADR)`.
   - Added T777 row with Status `done`, empty `Commit` cell, and full gate result summary.
   - Updated Backlog row for `setTransactionDeleted` reload check to Status `done in Phase 139 (T777)`.

## Tests added and fail-then-pass evidence

- 4 new unit tests added in `unit/authenticated-ledger.test.tsx`:
  1. `delete: re-fetches instead of restoring a stale snapshot when a reload landed mid-flight (T69)`
  2. `restore: re-fetches instead of restoring a stale snapshot when a reload landed mid-flight (T69)`
  3. `delete: still restores the pre-call snapshot when no reload landed mid-flight (T69)`
  4. `restore: still restores the pre-call snapshot when no reload landed mid-flight (T69)`

- **Red run evidence**:
  - Command: `npx vitest run unit/authenticated-ledger.test.tsx -t "mid-flight"`
  - Output log: `workflow/stages/02_build/output/logs/T777-red.log`
  - Result: 2 failed, 2 passed (4 tests matched, 123 skipped)
  - Failure snippet:
    ```
    FAIL  unit/authenticated-ledger.test.tsx > a signed-in delete and restore through set_transaction_deleted (ADR 0023) > delete: re-fetches instead of restoring a stale snapshot when a reload landed mid-flight (T69)
    AssertionError: expected 0 to be greater than 0
     ❯ unit/authenticated-ledger.test.tsx:1251:48
        1249|
        1250|     expect((await pending).success).toBe(false);
        1251|     expect(writes('wallets', 'select').length).toBeGreaterThan(0);
           |                                                ^
        1252|     // Server truth, not the pre-call snapshot of 4,800.
        1253|     await waitFor(() => {

    FAIL  unit/authenticated-ledger.test.tsx > a signed-in delete and restore through set_transaction_deleted (ADR 0023) > restore: re-fetches instead of restoring a stale snapshot when a reload landed mid-flight (T69)
    AssertionError: expected 0 to be greater than 0
     ❯ unit/authenticated-ledger.test.tsx:1289:48
        1287|
        1288|     expect((await pending).success).toBe(false);
        1289|     expect(writes('wallets', 'select').length).toBeGreaterThan(0);
           |                                                ^
        1290|     // Server truth, not the pre-call snapshot of 5,000.
        1291|     await waitFor(() => {
    ```

- **Green run evidence**:
  - Command: `npx vitest run unit/authenticated-ledger.test.tsx -t "mid-flight"`
  - Result: 4 passed, 0 failed (123 skipped) in 3.84s.

## Gate commands and results

1. Red gate:
   - `npx vitest run unit/authenticated-ledger.test.tsx -t "mid-flight"`: 2 failed (Tests A & B on wallet-read assertion), 2 passed (Tests C & D). Saved to `workflow/stages/02_build/output/logs/T777-red.log`.

2. Lint:
   - `npm run lint`: passed clean (check:node-globals 132 files clean, check:safe-ids 132 files clean, tsc --noEmit clean, tsc -p api/tsconfig.json clean).

3. Targeted unit tests:
   - `npx vitest run unit/authenticated-ledger.test.tsx unit/ledger-guards.test.tsx`: 2 test files passed, 176 passed in 39.11s.

4. Full unit suite:
   - `npm run test:unit`: 63 test files passed, 1444 passed in 60.60s.
   - Log path: `workflow/stages/02_build/output/logs/T777-unit.log`.

5. Targeted Playwright on Chromium (1 spec):
   - Ports 3000 and 3100 confirmed clear before run.
   - `npx playwright test tests/soft-delete.spec.ts --project=chromium`: 6 passed in 21.3s.

6. Targeted Playwright on all 3 browsers (1 spec across Chromium, Firefox, WebKit):
   - Ports 3000 and 3100 confirmed clear before run.
   - `npx playwright test tests/soft-delete.spec.ts`: 18 passed in 52.6s.

7. Line endings check:
   - `git ls-files --eol src/context/FinanceContext.tsx unit/authenticated-ledger.test.tsx docs/audit/task-ledger.md`: confirmed `w/crlf` for all three files.

8. No em dash check:
   - Git diff check: 0 em dashes added.
   - Build report check: 0 em dashes.

9. Diff precision check:
   - `git diff HEAD -- src/context/FinanceContext.tsx`: shows changes only inside `setTransactionDeleted` (the two added snapshot lines and the reshaped catch block), nothing else.

## Deliberately not done

- `addTransaction`, `updateTransaction`, `commitBulkImport` and every other write in `FinanceContext.tsx`.
- The `cloudRevisionRef` comment at `:771-782`.
- Any extraction of a shared rollback helper.
- `supabase/` (the `set_transaction_deleted` RPC) and the fake RPC in the test harness.
- Existing tests in the `set_transaction_deleted` describe block.
- Other Backlog rows.
- `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md` (T777 does not ship the phase).
