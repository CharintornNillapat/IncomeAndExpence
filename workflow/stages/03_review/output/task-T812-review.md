# Review: T812

## Round 1

### 1. Metadata

- Task: T812, Phase 149 task 4 (ADR 0109 D7): `set_transactions_deleted` bulk soft delete and restore, its probe, PGlite replay, the guest twin `setTransactionsDeleted`, the parity-map row.
- Date: 2026-10-27. Round 1. Branch `phase-149-transactions-views` (HEAD `4e88626`).
- Verdict: **APPROVED**
- Target files: `supabase/migrations/20261027_phase149_set_transactions_deleted.sql` (new), `supabase/tests/20261027_phase149.probe.sql` (new), `unit/migration-replay.test.ts`, `unit/ledger-guards.test.tsx`, `unit/authenticated-ledger.test.tsx`, `src/utils/zodSchemas.ts`, `src/context/FinanceContext.tsx`, `AGENTS.md`, `docs/contexts/supabase-ledger.md`, `docs/contexts/client-state.md`; bookkeeping `docs/audit/task-ledger.md`. `git check-ignore -v` on all ten: none ignored (exit 1).

### 2. Summary

Adds the SQL function `set_transactions_deleted(uuid[], boolean)`. It soft-deletes or restores a whole selection in one transaction: every listed id must belong to the caller, or the call fails with P0002 and nothing changes. It locks transactions, then wallets, then debts in id order, and runs `_ledger_apply_effect` once per changed row. Adds the client twin `setTransactionsDeleted`, which validates with Zod, writes optimistically from the refs and, signed in, makes exactly one RPC with no one-row fallback. Also adds the probe, 4 replay tests, 8 guest tests and 8 signed-in tests, the parity row, and three doc notes.

Because the builder's run was interrupted, I checked by script that every spec edit landed. The migration and the probe match the spec's blocks byte for byte (LF-normalised: 6483 and 12381 chars, equal), with 148 and 215 CRLF lines and 0 bare LF. Edits 2 to 5 appear verbatim in `zodSchemas.ts` and `FinanceContext.tsx`. `git diff -U0 FinanceContext.tsx` has 0 removed lines, so `setTransactionDeleted`, `softDeleteTransaction` and `restoreTransaction` are untouched. The doc edits match edits 6 to 8: AGENTS.md +1 line, supabase-ledger.md 3 lines changed, client-state.md +1.

### 3. Invariants and parity

- **Parity row `addTransaction`/`setTransactionDeleted` and `_ledger_apply_effect`:** neither side changed. `_ledger_apply_effect` and `set_transaction_deleted` are only defined in `20260927_ledger_rpcs.sql`, and no later migration re-creates them (grep).
- **New parity row `setTransactionsDeleted` and `set_transactions_deleted`:** checked by hand, term for term:
  - **Source wallet:** client EXPENSE/DEBT_REPAYMENT/TRANSFER `balance + sign*amount`, INCOME/ADJUSTMENT `balance - sign*amount`, with sign +1 to delete. SQL `balance + p_sign*source_sign*amount`, with p_sign -1 to delete and source_sign -1 for EXPENSE/DEBT_REPAYMENT/TRANSFER and +1 for INCOME/ADJUSTMENT. Identical.
  - **Destination (TRANSFER only):** client `- sign*amount`, SQL `+ p_sign*amount`. Identical.
  - **Debt (DEBT_REPAYMENT, live debt only):** client `Math.max(0, roundToCents(remaining + sign*amount))`, SQL `greatest(0, round(remaining - p_sign*amount, 2))`; `isSettled`/`is_settled` come from the same value. Identical.
  - **Rounding:** both round at each step over one running value per wallet and debt (client `newBalances`/`newRemainders` maps; SQL relative updates in id order). That is what N one-row calls produce.
  - One divergence exists only on a self-transfer (source = destination): the running map nets to 0 like SQL, where the one-row client does not. It is unreachable: `FinanceContext.tsx:1742` and `transfer_funds` both refuse a self-transfer.
- **All or nothing:**
  - SQL: P0002 is raised after the lock if the count of the caller's rows differs from the distinct ids. Any later raise rolls back the whole function. Probe section 8 covers B's row, a missing row and a numeric(15,2) overflow (22003) after z1 has already moved, then asserts the ledger, z1 and e1 are unchanged.
  - Client: an unresolved id returns before any setState. On an RPC error, all three slices roll back from the snapshot.
- **Grants:** `revoke all ... from public, anon`, then `grant execute ... to authenticated, service_role`; `security definer` with `search_path = public, pg_temp`. Checked three ways: probe section 1 (`not has_function_privilege('anon', ...)`, the eleven count), the replay catalog test (anon `none`, authenticated and service_role `execute`), and schema:drift (68 function grants).
- **Signed-in path is the RPC only:** one `supabase.rpc('set_transactions_deleted', ...)`. `isMissingRpcError` throws `MissingLedgerFunction`, which leads to rollback and `databaseUpdateNeeded()`. There is no table write and no one-row call. Test B (missing function) asserts 1 bulk call, 0 `set_transaction_deleted` calls and `nothingWritten()`. C1 and C3 assert 0 `update` writes to wallets, debts and transactions.
- **ADR 0022 (compute from refs before setState):** all balances and remainders are computed in the loop before the first `setTransactions`.
- **ADR 0023 unknown outcome:** set on an unknown-outcome error and on a payload with no `transactions` array; followed by `refreshFromCloud()`. Test C7 covers it.
- **T69 mid-flight reload:** re-fetches instead of restoring the snapshot. Test C6 covers it.
- **Zod first and `MutationResult`:** `TransactionIdsSchema.safeParse` runs first, and every return is a `MutationResult`.
- **Doc counts and paths:** all six paths named in the new AGENTS.md row exist (`ls`). "The eleven" in `supabase-ledger.md` matches probe section 1's `= 11` assertion.
- **Owner files:** `git hash-object` of ADR 0109 = `4b233a30...` and of `docs/design/transactions-2026-10/spec.md` = `2711cad4...`, both equal to HEAD (`git diff --quiet HEAD` clean).
- **Line endings:** `git ls-files --eol` shows `i/lf w/crlf` for all nine changed tracked files.
- **Em dashes:** 0 in the added lines (`git diff -U0 HEAD`), 0 in both new SQL files, 0 in the build report.
- **Scope:** `git diff --stat` and `git status --porcelain` list the ten targets, the ledger, the spec and the build report, and nothing else.

### 4. Gates run

All run by me. Logs are in `workflow/stages/03_review/output/logs/`.

| Command | Result | Log |
|---|---|---|
| Red run with the fix stashed: `npx vitest run unit/migration-replay.test.ts unit/ledger-guards.test.tsx unit/authenticated-ledger.test.tsx` | 3 files failed (3); **21 failed, 227 passed (248)**. Failures: 16 TypeError `setTransactionsDeleted is not a function`, plus 21-vs-22 files, 16-vs-17 functions, the missing catalog row, ENOENT in the before probe and `1 set_transactions_deleted is missing` in the after probe | `T812-red.log` |
| `npm run lint` | exit 0 (node-globals 137 files, safe-ids 137 files, both `tsc` passes clean) | `T812-lint.log` |
| `npx vitest run unit/migration-replay.test.ts unit/drift-runner.test.ts unit/migration-history.test.ts` | 3 passed (3) files; 78 passed (78) | `T812-supabase.log` |
| `npm run schema:drift` (offline) | exit 0; 22 migrations; 17 function, 68 function grant, 22 migration rows | `T812-drift.log` |
| `npx vitest run unit/ledger-guards.test.tsx unit/authenticated-ledger.test.tsx unit/auth-password.test.tsx unit/debts-page.test.tsx unit/security-headers.test.ts` | 5 passed (5) files; 259 passed (259) | `T812-related.log` |
| `npm run test:unit` | **71 passed (71) files; 1580 passed (1580)**, 0 failed, 0 skipped; 55.87s | `T812-unit.log` |
| `npx playwright test tests/soft-delete.spec.ts tests/transaction.spec.ts tests/transaction-edit.spec.ts tests/debt-repayment.spec.ts --project=chromium` | 26 passed (1.1m) | `T812-e2e-chromium.log` |
| The same 4 specs, all three browsers | 78 passed (2.6m) | `T812-e2e-all.log` |

How I ran the red check (step 6):

- Before: recorded `git status --porcelain`, plus the sha1 of `git diff` (`493f8f4f...`) and of the migration (`745dfc46...`).
- Stash: `git stash push -u -- src/context/FinanceContext.tsx src/utils/zodSchemas.ts supabase/migrations/20261027_phase149_set_transactions_deleted.sql`. The `-u` is for the untracked migration. All three are `w/crlf` or new, so no `w/lf` file was involved.
- Restore: `git stash pop --index`.
- After: `git status --porcelain` is identical to the record (`diff` empty), and both sha1s are unchanged.

Ports 3000 and 3100 had no listener before or after Playwright.

### 5. Not verified

- The probe on the live project, and the live apply in spec section 8. Both are the owner's steps (live SQL is stop-and-ask). The probe runs only on PGlite, before and after the migration.
- Real Postgres lock contention and deadlock freedom under concurrency. The lock order (transactions, wallets, debts, each in id order) matches `set_transaction_deleted`, checked by reading the code. PGlite is single-connection, so nothing exercised it.

### 6. Blocking

None.

### 7. Non-blocking

- `workflow/stages/02_build/output/task-T812-build.md:12` says "Added 7 unit tests in `unit/authenticated-ledger.test.tsx`". There are 8: B, the missing-function bulk test, plus C1 to C7. The red-gate line in the same report correctly says 8, and the 1580 total is right. This is report text only.

### 8. Rule candidates

- None new. The new parity row is already in `AGENTS.md` and the code complies.
