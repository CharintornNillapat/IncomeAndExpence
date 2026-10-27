# Build Report - T812

## 1. Summary of Changes

Built bulk soft delete and restore for transactions (task 4 of `docs/design/transactions-2026-10/spec.md` section 9, ADR 0109):

- **Database migration (`supabase/migrations/20261027_phase149_set_transactions_deleted.sql`):** Created `set_transactions_deleted(p_transaction_ids uuid[], p_deleted boolean)` returning `jsonb` with `{ changed_ids, transactions, balances, debts }`. Verifies authentication (`28000`), validates non-empty arguments (`22023`), locks listed rows by id (`for update`, raising `P0002` if any row is missing or unowned), deduplicates ids, skips rows already in the requested state, acquires locks on distinct wallets and debts in id order, applies effects term-for-term via `_ledger_apply_effect` (`-1` for delete, `+1` for restore), updates the `is_deleted` flag, and grants `execute` to `authenticated` and `service_role` with execution revoked from `anon`.
- **Database probe (`supabase/tests/20261027_phase149.probe.sql`):** Added a self-contained SQL probe asserting error conditions (`28000` without session, `22023` on null/empty ids, `P0002` on foreign/missing ids), bulk soft delete and restore across expense, income, transfer, debt repayment, and adjustment rows, wallet and debt balance tracking, idempotence on already-deleted rows, and single execution across duplicate ids, rolling back cleanly with `PHASE 149 PROBE OK`.
- **PGlite replay and drift tests (`unit/migration-replay.test.ts`):** Updated migration count to 22, function count to 17, bounded probes counting ten functions (Phases 102, 114, 123) with `upTo148()`, added role execution grant tests, and added before-migration, after-migration, and failure-without-migration probe tests.
- **Zod validation schema (`src/utils/zodSchemas.ts`):** Added `TransactionIdsSchema` asserting non-empty array of non-empty string ids and boolean `deleted` flag.
- **Client and guest twin (`src/context/FinanceContext.tsx`):** Added `setTransactionsDeleted` to `FinanceActionsContextType`, `SetTransactionsDeletedResult` interface, and implementation in `FinanceProvider`. Validates arguments via `TransactionIdsSchema`, verifies all rows exist in `transactionsRef`, performs optimistic state updates across transactions, wallets, and debts using `setTransactionDeleted` arithmetic term-for-term. For signed-in users, calls `set_transactions_deleted` RPC, updates state from committed balances and debts, handles `MissingLedgerFunction` via `databaseUpdateNeeded()`, and rolls back or re-fetches on failure or unknown outcome (T69, ADR 0023). Exposed in `actionsValue` and actions context. Existing `setTransactionDeleted`, `softDeleteTransaction`, and `restoreTransaction` functions were preserved byte-for-byte.
- **Tests (`unit/ledger-guards.test.tsx`, `unit/authenticated-ledger.test.tsx`):** Added 8 unit tests in `unit/ledger-guards.test.tsx` covering guest bulk soft delete and restore across transaction types, matching one-at-a-time deletion, debt un-settling/re-settling, cent precision, missing id rejection, duplicate id handling, and empty list rejection. Added 7 unit tests in `unit/authenticated-ledger.test.tsx` covering signed-in bulk RPC calls, balance reversal relative to server state, rollback without fallback on failure, duplicate id handling, and mid-flight reload handling (T69).
- **Documentation and parity map (`AGENTS.md`, `docs/contexts/supabase-ledger.md`, `docs/contexts/client-state.md`, `docs/audit/task-ledger.md`):** Added `setTransactionsDeleted` parity map row in `AGENTS.md`, documented `set_transactions_deleted` and updated function count to 11 in `docs/contexts/supabase-ledger.md`, documented `setTransactionsDeleted` client behavior in `docs/contexts/client-state.md`, and updated `docs/audit/task-ledger.md`.

## 2. Files Changed

1. `supabase/migrations/20261027_phase149_set_transactions_deleted.sql` (created)
2. `supabase/tests/20261027_phase149.probe.sql` (created)
3. `unit/migration-replay.test.ts` (modified)
4. `unit/ledger-guards.test.tsx` (modified)
5. `unit/authenticated-ledger.test.tsx` (modified)
6. `src/utils/zodSchemas.ts` (modified)
7. `src/context/FinanceContext.tsx` (modified)
8. `AGENTS.md` (modified)
9. `docs/contexts/supabase-ledger.md` (modified)
10. `docs/contexts/client-state.md` (modified)
11. `docs/audit/task-ledger.md` (modified)
12. `workflow/stages/02_build/output/task-T812-build.md` (created)

## 3. Verification Gates Run

### Red Gate (failing tests before editing implementation files)
- Command: `npx vitest run unit/migration-replay.test.ts unit/ledger-guards.test.tsx unit/authenticated-ledger.test.tsx`
- Log: `workflow/stages/02_build/output/logs/T812-red.log`
- Result: `Test Files 3 failed (3) | Tests 21 failed | 227 passed (248)` in 54.79s
- Failure details:
  - `unit/ledger-guards.test.tsx`: 8 tests failed with `TypeError: actions(...).setTransactionsDeleted is not a function`.
  - `unit/authenticated-ledger.test.tsx`: 8 tests failed with `TypeError: actions(...).setTransactionsDeleted is not a function`.
  - `unit/migration-replay.test.ts`: 5 tests failed (migration count expectation 22 vs 21, function count expectation 17 vs 16, missing `set_transactions_deleted` grant check, ENOENT on `20261027_phase149_set_transactions_deleted.sql` in probe-before test, and missing function error in probe-after test; "Phase 149: the probe fails on the schema before it, with the migration left out" passed as expected).

### Gate 1: `npm run lint`
- Command: `npm run lint`
- Result: Passed (exit 0)
  - `check:node-globals`: 137 files in `src`, no Node globals.
  - `check:safe-ids`: 137 files in `src`, no id from the time alone.
  - `tsc --noEmit`: 0 errors.
  - `tsc -p api/tsconfig.json`: 0 errors.

### Gate 2: `npm run schema:drift`
- Command: `npm run schema:drift`
- Result: Passed (exit 0)
  - `schema-drift: 22 migrations replayed from empty; expected rows: 75 column, 28 constraint, 1 extension, 17 function, 68 function grant, 17 index, 7 policy, 5 publication, 8 table, 24 table grant, 2 trigger, 22 migration`.

### Gate 3: Targeted Vitest files
- Command 1: `npx vitest run unit/migration-replay.test.ts unit/drift-runner.test.ts unit/migration-history.test.ts`
  - Result: Passed (`3 passed (3)`, `78 passed (78)`, 25.73s).
- Command 2: `npx vitest run unit/ledger-guards.test.tsx unit/authenticated-ledger.test.tsx unit/auth-password.test.tsx unit/debts-page.test.tsx unit/security-headers.test.ts`
  - Result: Passed (`5 passed (5)`, `259 passed (259)`, 53.91s).

### Gate 4: Full Unit Test Suite
- Command: `npm run test:unit`
- Log: `workflow/stages/02_build/output/logs/T812-unit.log`
- Result: Passed (`71 passed (71)`, `1580 passed (1580)`, 55.59s).

### Gate 5: Affected Playwright Specs on Chromium
- Command: `npx playwright test tests/soft-delete.spec.ts tests/transaction.spec.ts tests/transaction-edit.spec.ts tests/debt-repayment.spec.ts --project=chromium`
- Log: `workflow/stages/02_build/output/logs/T812-e2e-chromium.log`
- Result: Passed (`26 passed (27.7s)`).

### Gate 6: Affected Playwright Specs on All 3 Browsers
- Command: `npx playwright test tests/soft-delete.spec.ts tests/transaction.spec.ts tests/transaction-edit.spec.ts tests/debt-repayment.spec.ts`
- Log: `workflow/stages/02_build/output/logs/T812-e2e-all.log`
- Result: Passed (`78 passed (2.2m)` across Chromium, Firefox, WebKit).

### Additional Verification Checks (Section 7)
- **FinanceContext diff check:** Confirmed `git diff -U0 src/context/FinanceContext.tsx` adds only `TransactionIdsSchema` import, `setTransactionsDeleted` type signature, `SetTransactionsDeletedResult` interface, `setTransactionsDeleted` implementation, and its exposure in `actionsValue` / actions context. `setTransactionDeleted`, `softDeleteTransaction`, and `restoreTransaction` are byte-for-byte untouched (0 deletions, 182 insertions).
- **Zod schemas diff check:** Confirmed `git diff -U0 src/utils/zodSchemas.ts` adds only `TransactionIdsSchema` (6 insertions, 0 deletions).
- **Text landed check:** Migration and probe files match spec verbatim blocks byte-for-byte.
- **Owner files unchanged:** `git hash-object docs/audit/decisions/0109-transactions-table-and-calendar-views.md docs/design/transactions-2026-10/spec.md` returns `4b233a3025b6b3a725867f88475aa5b3ed81dd5a` and `2711cad4aeefe0fb084b27583c1e9245db29704d` unchanged.
- **Referenced paths check:** Confirmed all paths referenced in documentation updates exist on disk.
- **Line endings check:** Every touched and created file uses CRLF (`\r\n`) line endings.
- **Em-dash check:** Zero em dashes (`\u2014`) in added lines or created files.
- **Scope check (`git status --porcelain`):** Lists only the 10 target files, `docs/audit/task-ledger.md`, and stage output files.

## 4. Anything Not Done

None. All items specified in `workflow/stages/01_spec/output/task-T812-spec.md` are implemented and verified.
