# T760 spec: a transfer with an unknown outcome re-reads the cloud (SL-02)

Phase 132, branch `phase-132-transfer-unknown-outcome`. Order: the SL-02 Backlog row (`docs/audit/task-ledger.md:93`), audit finding SL-02 [high] (`docs/audit/audit-2026-10-16.md:102-112`). This task ships the phase.

## 1. Goal

When a signed-in transfer's `transfer_funds` call fails in a way that means it may have committed (an error with no SQLSTATE, or a success with no row), the client rolls back and then re-reads from the cloud, exactly as `record_transaction` already does. Today it only rolls back, so the screen says the transfer failed while the money moved, and a re-entry in a new form moves it twice.

## 2. Target files

```
unit/authenticated-ledger.test.tsx
src/context/FinanceContext.tsx
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

No ADR: the fix brings `addTransaction`'s transfer branch into line with an existing rule (ADR 0023, `docs/contexts/supabase-ledger.md:18`); it adds no new decision. Bookkeeping (`docs/audit/task-ledger.md`, the build report, logs) is allowed as usual.

## 3. Context to read

- `docs/contexts/supabase-ledger.md`, section "A signed-in ledger write is one database function or nothing" (`:14-24`): the unknown-outcome rule at `:18`.
- `docs/contexts/client-state.md`, "Every write" (`:21-33`) and "Unit tests for this layer" (`:123-132`): how the signed-in harness runs (no `act()`, macrotask settling, `waitFor` up to 3 s).

## 4. Current behaviour

- `isUnknownOutcomeError(err)` is `!!err && !err.code` (`src/context/FinanceContext.tsx:321-323`).
- `addTransaction` declares `let rpcOutcomeUnknown = false;` (`:1828`) before its `try`.
- The TRANSFER branch (`:1837-1882`) calls `transfer_funds` (`:1838-1846`), then:
  - `:1848` `if (rpcError) throw isMissingRpcError(rpcError) ? new MissingLedgerFunction() : rpcError;` never sets `rpcOutcomeUnknown`, so a lost response (`code: ''`) is treated as a plain rejection.
  - `:1850-1853` throws on `!payload?.transaction` without setting `rpcOutcomeUnknown`, though its own comment (`:1850`) says the RPC may already have moved the money.
- The `record_transaction` branch does set it: `:1907-1911` (unknown-outcome error) and `:1915-1918` (no row).
- In the `catch`, with no concurrent reload (`:1959`), the client restores `previousWallets`/`previousDebts`/`previousTransactions` (`:1969-1971`) and calls `refreshFromCloud()` only when `rpcOutcomeUnknown || serverOverpayment` (`:1977-1979`). For a transfer both are false, so the rollback stands until some later reload.

### The other ledger RPC call sites in `FinanceContext.tsx` (checked for the same gap)

| Call site | Unknown-outcome handling | Gap? |
|---|---|---|
| `record_transaction` (`:1895`) | flag set at `:1909` and `:1916`; refresh at `:1977-1979` | no |
| `set_transaction_deleted` (`:2166`) | flag set at `:2173` and `:2178`; refresh at `:2204-2206` | no |
| `update_transaction` (`:2315`) | `undo(isUnknownOutcomeError(error))` at `:2341`; `undo(true)` on no row at `:2347` | no |
| `import_transactions` (`:2513`) | refresh when `!rpcError \|\| isUnknownOutcomeError(rpcError)` at `:2527-2529` | no |
| `create_wallet` (`:1293`) | refresh on no row at `:1306-1309`, on unknown outcome at `:1324` | no |
| `delete_user_account` (`:1240`) | unknown outcome runs `verifySession()` at `:1245` (ADR 0072; the account may be gone, so a cloud re-read is the wrong tool) | no |
| `seed_starter_account` (`:868`) | not a ledger write; a failure is `'failed'`, which sets `syncError`, and the retry re-runs the server-decided seed | no |
| `transfer_funds` (`:1838`) | none | **yes, this task** |

So `transfer_funds` is the only site with the gap, and there is no further Backlog row to add.

## 5. Parity map

None changed. The first row (`addTransaction` arithmetic vs `_ledger_apply_effect`) is near: this task touches only error handling in the TRANSFER branch, never its arithmetic (`:1775-1797`, `:1855-1876`). The "Transfer preview" row is untouched for the same reason.

## 6. Tests to add

All three go in `unit/authenticated-ledger.test.tsx`, inside the existing `describe('a signed-in transfer through transfer_funds (Phase 93, ADR 0069)', ...)` block (`:1641-1692`), after the `'names no user: the server takes it from the session'` test, so they reuse its `beforeEach` stand-in (`:1647-1663`). Add once at the top of that `describe`, after the `beforeEach`, the same read counter the `update_transaction` block uses (`:1265`):

```ts
  const reads = () => writes('transactions', 'select').length;
  const transfer = (key: string) =>
    actions().addTransaction({
      amount: 250,
      type: 'TRANSFER',
      walletId: WALLET,
      destinationWalletId: CASH,
      description: 'Move to cash',
      transactionDate: TODAY,
      idempotencyKey: key,
    });
```

Leave the existing test's inline `addTransaction` call as it is (it pins the exact argument object).

**Test A (fails today):**

```ts
  it('re-reads after a lost response instead of showing a rollback the server never made (SL-02)', async () => {
    fake.state.lostResponses.add('transfer_funds');
    const readsBefore = reads();

    const result = await transfer('key-transfer-lost');
    expect(result.success).toBe(false);
    // The re-read is part of the call, not a later reload that happens to come.
    expect(reads()).toBeGreaterThan(readsBefore);

    // The transfer committed; the client shows what the server holds.
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING - 250);
    await waitFor(() => {
      expect(wallet()?.balance).toBe(WALLET_OPENING - 250);
      expect(wallet(CASH)?.balance).toBe(CASH_OPENING + 250);
      expect(state().transactions).toHaveLength(1);
    });
  });
```

Why it fails today: the fake answers `{ code: '' }` after the stand-in commits (`unit/authenticated-ledger.test.tsx:226-230`); `:1848` throws without setting the flag, the `catch` rolls back to ฿5,000 / ฿1,000 and never calls `refreshFromCloud()` (`:1977`), so `reads()` does not grow and the balances stay at the openings.

**Test B (fails today):**

```ts
  it('re-reads after a success with no row, since the money may have moved (SL-02)', async () => {
    const commit = fake.state.rpcs.get('transfer_funds')!;
    fake.state.rpcs.set('transfer_funds', (args) => {
      commit(args);
      return { data: null, error: null };
    });
    const readsBefore = reads();

    const result = await transfer('key-transfer-empty');
    expect(result.success).toBe(false);
    expect(result.error).toBe('transfer_funds returned an unexpected response');
    expect(reads()).toBeGreaterThan(readsBefore);

    await waitFor(() => {
      expect(wallet()?.balance).toBe(WALLET_OPENING - 250);
      expect(wallet(CASH)?.balance).toBe(CASH_OPENING + 250);
      expect(state().transactions).toHaveLength(1);
    });
  });
```

Why it fails today: `:1851-1853` throws without setting the flag, so the same rollback with no re-read.

**Test C (passes today and after; it stops an over-fix):**

```ts
  it('only rolls back, with no re-read, when the server refuses with a SQLSTATE', async () => {
    fake.state.failures.set('rpc:transfer_funds', { message: 'permission denied for function', code: '42501' });
    const readsBefore = reads();

    const result = await transfer('key-transfer-refused');
    expect(result.success).toBe(false);
    expect(result.error).toContain('permission denied');
    expect(reads()).toBe(readsBefore);
    await waitFor(() => {
      expect(wallet()?.balance).toBe(WALLET_OPENING);
      expect(wallet(CASH)?.balance).toBe(CASH_OPENING);
    });
  });
```

It catches a fix that sets `rpcOutcomeUnknown` for every error. Do not change the harness (`rpc()`, `lostResponses`, `failures`); the tests use what is there.

## 7. The code change

In `src/context/FinanceContext.tsx`, replace `:1848-1853` with the `record_transaction` branch's shape (`:1907-1918`), and nothing else:

```ts
          if (rpcError) {
            if (isMissingRpcError(rpcError)) throw new MissingLedgerFunction();
            if (isUnknownOutcomeError(rpcError)) rpcOutcomeUnknown = true;
            throw rpcError;
          }
          const payload = rpcData as TransferFundsResult | null;
          // The RPC may already have moved the money; restoring the snapshot
          // would hide a transfer that happened. Re-read instead, never retry.
          if (!payload?.transaction) {
            rpcOutcomeUnknown = true;
            throw new Error('transfer_funds returned an unexpected response');
          }
```

Keep the file's CRLF line endings and its indentation (10 spaces inside the TRANSFER `if`).

## 8. Gates

Run in this order; save each full-suite run to `workflow/stages/02_build/output/logs/`.

1. **Red first (money path):** with the three tests added and `src/context/FinanceContext.tsx` still unchanged, `npx vitest run unit/authenticated-ledger.test.tsx -t "transfer_funds" 2>&1 | tee workflow/stages/02_build/output/logs/T760-red.log`. Expected: Test A and Test B fail, Test C and the existing transfer test pass. Record the failing assertion of each in the build report.
2. Apply section 7, then `npm run lint`.
3. `npx vitest run unit/authenticated-ledger.test.tsx unit/ledger-guards.test.tsx`: all pass.
4. `npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T760-unit.log`: 62 files, 1378 tests (1375 + 3), all pass.
5. Check ports 3000 and 3100 for stale dev servers (`Get-NetTCPConnection -LocalPort 3000,3100 -State Listen`); stop any leftover before Playwright. Do not edit `src/` while Playwright runs.
6. `npx playwright test tests/transfer-preview.spec.ts tests/wallet-forms.spec.ts --project=chromium`, then `npx playwright test tests/transfer-preview.spec.ts tests/wallet-forms.spec.ts 2>&1 | tee workflow/stages/02_build/output/logs/T760-e2e.log` (all three browsers). These specs run the guest transfer path through the same `addTransaction`; the changed lines are signed-in only, which Test A to C cover.
7. Metrics for `baseline-metrics.md`: `npm run clean; npm run build` with the repo's `.env` present, then the gzip figures as the file's "How to measure" says.
8. Static checks:
   - `git diff --stat` shows only the four target files plus bookkeeping.
   - `src/context/FinanceContext.tsx` diff: only `:1848-1853` region changed; `rpcOutcomeUnknown = true` appears 4 times in `addTransaction` (was 2) and 6 times in the file (was 4): `(Select-String -Path src/context/FinanceContext.tsx -Pattern 'rpcOutcomeUnknown = true').Count`.
   - `git ls-files --eol src/context/FinanceContext.tsx unit/authenticated-ledger.test.tsx docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md`: every row still `w/crlf`.
   - No em dash (U+2014) in any added line: `git diff -U0 | Select-String -Pattern ([char]0x2014)` prints nothing.

## 9. Bookkeeping and phase paperwork

- `docs/audit/task-ledger.md`: add `## Phase 132 - Transfer unknown outcome re-reads the cloud (client error handling, no ADR)` above `## Backlog`, with the branch line (`Branch phase-132-transfer-unknown-outcome, cut from main at 67e6bef. No migration.`) and the T760 row (Files: `src/context/FinanceContext.tsx`, `unit/authenticated-ledger.test.tsx`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`; Commit empty). Set the SL-02 Backlog row's Status (`:93`) to `done in Phase 132 (T760)`.
- `docs/audit/task-ledger.md` (owner decision): append this row as the last row of the Backlog table, after the UI-05 row (`:98`), exactly:

  ```
  | setTransactionDeleted has no cloudRevisionAtStart check, so a failed delete or restore restores its pre-call snapshot even when a cloud reload landed mid-flight, unlike addTransaction and updateTransaction | Phase 132, T760's spec (owner decision); `src/context/FinanceContext.tsx:2190-2197`, compare `:1959` and `:2302` | todo |
  ```
- `docs/audit/refactor-log.md`: one Phase 132 entry at the top, in the Phase 127 entry's shape, with `Surprises` and `Deliberately not done` (the latter names the out-of-scope items in section 11).
- `docs/audit/baseline-metrics.md`: a `### Phase 132 - delta against Phase 129` section at the top of "Figures", in the Phase 129 section's shape (entry chunk, all app JS, CSS, Vitest with the T760 log, Playwright with the T760 log).

## 10. Production touch points

None. No migration and no SQL; `transfer_funds` itself is unchanged. The fix reaches production only when the owner merges the phase branch.

## 11. Out of scope

- The SL-01 row (`transfer_funds`'s replay on soft-deleted rows, SQL): its own task, a `supabase/` migration.
- SL-03 (guest `amount` rounding at `:1937`): dropped from the Backlog in T759's review; leave it.
- `markLocalWrite` order in the TRANSFER branch (`:1877-1879`, after success only, where `record_transaction` marks before its call at `:1893-1894`): a different concern; do not move it.
- `setTransactionDeleted` has no `cloudRevisionAtStart` check (`:2190-2197`), unlike `addTransaction` (`:1959`) and `updateTransaction` (`:2302`). A different gap from SL-02; not changed here. It goes to the Backlog as the row in section 9.
- The test harness's fake client, any other `describe` block, any spec under `tests/`, and every other branch of `addTransaction`.
