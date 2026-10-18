# T777 spec: setTransactionDeleted re-fetches instead of restoring a stale snapshot

Phase 139 (branch `phase-139-subagent-trial`), second task. Source: the Backlog row "setTransactionDeleted has no cloudRevisionAtStart check" (`docs/audit/task-ledger.md:75`; Phase 132, T760's spec, owner decision).

## 1. Goal

When a signed-in delete or restore fails after a cloud reload landed mid-flight, `setTransactionDeleted` must re-fetch from the cloud instead of restoring its pre-call snapshot, exactly as `addTransaction` and `updateTransaction` already do (T69). Reuse the existing `cloudRevisionAtStart` pattern; add nothing new.

## 2. Target files

- `src/context/FinanceContext.tsx` (only inside `setTransactionDeleted`)
- `unit/authenticated-ledger.test.tsx` (four new tests)
- `docs/audit/task-ledger.md` (bookkeeping, see the last paragraph of section 6)

No ADR: this applies the T69 rule already in force for the two sibling writes; no new rule. No `refactor-log.md` or `baseline-metrics.md` entry: this task does not ship the phase.

## 3. Context to read

`docs/contexts/client-state.md`: it covers `FinanceContext.tsx`, the `cloudRevisionRef` rule ("`loadSupabaseData` bumps `cloudRevisionRef` only when every read succeeded", section "Every write") and the signed-in harness rules for `authenticated-ledger.test.tsx` (no `act()`, `landed(txId)`, macrotask fakes). Nothing else.

## 4. Current behaviour

- `src/context/FinanceContext.tsx:771-782`: `cloudRevisionRef` is bumped once per clean `loadSupabaseData` commit (`:919-922`), so a write that snapshots it can tell whether a reload landed while it was in flight.
- `addTransaction` snapshots it at `:1771` (`const cloudRevisionAtStart = cloudRevisionRef.current;`, with the T69 comment at `:1769-1770`), and its catch at `:1965-1986` re-fetches with `await refreshFromCloud()` when the revision moved, else restores the snapshot and re-fetches only on `rpcOutcomeUnknown || serverOverpayment`.
- `updateTransaction` does the same: snapshot at `:2290-2291`, check in `undo` at `:2307-2316`.
- `setTransactionDeleted` (`:2049-2222`) snapshots `previousTransactions`, `previousWallets`, `previousDebts` at `:2056-2060` but never reads `cloudRevisionRef`. Its catch (`:2196-2221`) always restores the snapshot (`:2201-2203`), then returns `databaseUpdateNeeded()` on `MissingLedgerFunction` (`:2205`), then re-fetches only when `rpcOutcomeUnknown` (`:2210-2212`). So when a clean reload lands between the optimistic write and a refused RPC, the rollback overwrites the reload's server truth (another device's balance) with the pre-call snapshot.
- `refreshFromCloud` (`:1184-1188`) is already in the `useCallback` dependency array at `:2222`; `cloudRevisionRef` is a ref, so the array does not change.
- The catch is only reached signed in (`:2155-2157` returns before the `try` for a guest).

## 5. Parity map

Row 1, `addTransaction` / `setTransactionDeleted` arithmetic vs the ledger RPCs: touched in name only. This task changes the failure path's rollback choice, not any arithmetic, and no SQL. Guarded by `unit/authenticated-ledger.test.tsx` and `unit/ledger-guards.test.tsx`, both in the gates.

## 6. Tests to add

Four tests in `unit/authenticated-ledger.test.tsx`, inside `describe('a signed-in delete and restore through set_transaction_deleted (ADR 0023)', ...)` (starts `:1158`, its `beforeEach` already calls `installLedgerRpcs()`), placed in the order below after `'rolls back, and writes nothing through the legacy path, when the RPC rejects'` (`:1210-1227`). They cover both directions (delete, `isDeleted` true; restore, `isDeleted` false) for both cases (a clean reload landed while the RPC was paused; no reload landed). All four pause the RPC with the existing pause hook, `fake.state.gates` (`:66`, awaited in the fake `rpc` at `:209-210`, cleared in the top-level `beforeEach` at `:761`), as `'does not treat a clean reload as a failure'` (`:861-887`) does; model them on that test. No new harness helper, no change to the fake RPC.

Shared fragments, written out in each test (no helper):

- **Gate:** `let release!: () => void; fake.state.gates.set('rpc:set_transaction_deleted', new Promise<void>((resolve) => (release = resolve)));`
- **Reload:** another device moves the wallet and a clean reload lands: `serverWallet(WALLET).balance = 7777; await fake.state.authCallback!('SIGNED_IN', fake.session);` then `await waitFor(() => { expect(wallet()?.balance).toBe(7777); expect(state().isSyncing).toBe(false); });`, so the reload has committed (and bumped `cloudRevisionRef` at `src/context/FinanceContext.tsx:920`) before the RPC answers.
- **Refuse:** `fake.state.calls = []; fake.state.failures.set('rpc:set_transaction_deleted', { message: 'permission denied for function', code: '42501' }); release();`
- **Deleted first** (restore tests only, the state a restore starts from): `const removed = await actions().softDeleteTransaction(spent.txId!); expect(removed.success).toBe(true); await waitFor(() => { expect(wallet()?.balance).toBe(WALLET_OPENING); expect(state().transactions.find((t) => t.id === spent.txId)?.isDeleted).toBe(true); }); await new Promise<void>((resolve) => setTimeout(resolve, 0));` (the trailing macrotask as at `:1184`, so `transactionsRef` holds the deleted row before the restore reads it).

Every test starts with `const spent = await expense(200); await landed(spent.txId);` (wallet 4,800 local and on the server).

**Test A** `'delete: re-fetches instead of restoring a stale snapshot when a reload landed mid-flight (T69)'`
1. Gate. 2. `const pending = actions().softDeleteTransaction(spent.txId!);` then `await waitFor(() => expect(wallet()?.balance).toBe(WALLET_OPENING));` (the optimistic refund). 3. Reload. 4. Refuse. 5. `expect((await pending).success).toBe(false);` 6. `expect(writes('wallets', 'select').length).toBeGreaterThan(0);` (the re-fetch ran inside the catch, before the action returned). 7. `await waitFor(() => { expect(wallet()?.balance).toBe(7777); expect(state().transactions.find((t) => t.id === spent.txId)?.isDeleted).toBe(false); });` with a short comment: server truth, not the pre-call snapshot of 4,800.

**Test B** `'restore: re-fetches instead of restoring a stale snapshot when a reload landed mid-flight (T69)'`
1. Deleted first. 2. Gate. 3. `const pending = actions().restoreTransaction(spent.txId!);` then `await waitFor(() => expect(wallet()?.balance).toBe(WALLET_OPENING - 200));` (the optimistic re-debit). 4. Reload (the server row is still `is_deleted` true). 5. Refuse. 6. `expect((await pending).success).toBe(false);` 7. `expect(writes('wallets', 'select').length).toBeGreaterThan(0);` 8. `await waitFor(() => { expect(wallet()?.balance).toBe(7777); expect(state().transactions.find((t) => t.id === spent.txId)?.isDeleted).toBe(true); });` with a short comment: server truth, not the pre-call snapshot of 5,000.

**Test C** `'delete: still restores the pre-call snapshot when no reload landed mid-flight (T69)'`
1. Gate. 2. `const pending = actions().softDeleteTransaction(spent.txId!);` then `await waitFor(() => { expect(wallet()?.balance).toBe(WALLET_OPENING); expect(state().transactions.find((t) => t.id === spent.txId)?.isDeleted).toBe(true); });` (optimistic). 3. Refuse (no reload). 4. `expect((await pending).success).toBe(false);` 5. `expect(writes('wallets', 'select')).toHaveLength(0);` (no re-fetch: the revision did not move). 6. `await waitFor(() => { expect(wallet()?.balance).toBe(WALLET_OPENING - 200); expect(state().transactions.find((t) => t.id === spent.txId)?.isDeleted).toBe(false); });` (the snapshot).

**Test D** `'restore: still restores the pre-call snapshot when no reload landed mid-flight (T69)'`
1. Deleted first. 2. Gate. 3. `const pending = actions().restoreTransaction(spent.txId!);` then `await waitFor(() => { expect(wallet()?.balance).toBe(WALLET_OPENING - 200); expect(state().transactions.find((t) => t.id === spent.txId)?.isDeleted).toBe(false); });` (optimistic). 4. Refuse (no reload). 5. `expect((await pending).success).toBe(false);` 6. `expect(writes('wallets', 'select')).toHaveLength(0);` 7. `await waitFor(() => { expect(wallet()?.balance).toBe(WALLET_OPENING); expect(state().transactions.find((t) => t.id === spent.txId)?.isDeleted).toBe(true); });` (the snapshot).

**Red and green, per test:**

| Test | Unfixed code | After the fix |
|---|---|---|
| A (delete, reload landed) | **Fails** at step 6: the catch restores `previousWallets` (4,800) at `:2202` and never calls `refreshFromCloud` for a `42501` refusal, so 0 wallet reads (deterministic); step 7 would see 4,800 | Passes |
| B (restore, reload landed) | **Fails** at step 7, same cause: 0 wallet reads; step 8 would see the snapshot's 5,000 | Passes |
| C (delete, no reload) | Passes (today's rollback) | Passes: the revision is unchanged, so the fix takes the `else` branch and restores the snapshot |
| D (restore, no reload) | Passes | Passes, same reason |

C and D pin that the fix does not turn every failure into a re-fetch; they must stay green on both sides. If C or D fails on the unfixed code, stop and report it in the build report rather than adjusting the test.

Red run (money path, failing test first): write all four tests, then, before editing `src/context/FinanceContext.tsx`, run `npx vitest run unit/authenticated-ledger.test.tsx -t "mid-flight"` (the four names are the only test titles in the file with `mid-flight`) and save the output to `workflow/stages/02_build/output/logs/T777-red.log`. It must show exactly 2 failed (A and B, on their wallet-read assertion) and 2 passed (C and D). Then make the source edit and re-run the same command: 4 passed.

**Source edit** (inside `setTransactionDeleted` only):

a. After `const previousDebts = debtsRef.current;` (`:2060`) add, copied from `updateTransaction`'s `:2290-2291`:

```ts
    // T69: see `cloudRevisionRef`.
    const cloudRevisionAtStart = cloudRevisionRef.current;
```

b. Replace the catch's restore, the `MissingLedgerFunction` return and the `rpcOutcomeUnknown` re-read (`:2199-2212`) with `addTransaction`'s layout (`:1965-1988`): the revision check first, the restore and the unknown-outcome re-read in its `else`, then the `MissingLedgerFunction` return:

```ts
      if (cloudRevisionRef.current !== cloudRevisionAtStart) {
        // T69: a realtime reload landed while this write was in flight, so the
        // snapshot is stale; restoring it would discard what another device
        // just committed. Re-fetch instead.
        await refreshFromCloud();
      } else {
        // Roll back the optimistic local state. Wallets and the transaction flag
        // are restored together so the ledger and the balances can never disagree.
        setTransactions(previousTransactions);
        setWallets(previousWallets);
        setDebts(previousDebts);

        // ADR 0023: the rollback above is a guess when the RPC may have
        // committed. Re-read; if that fails too (offline), the rollback stands
        // until the reconnect reload corrects it.
        if (rpcOutcomeUnknown) {
          await refreshFromCloud();
        }
      }

      if (err instanceof MissingLedgerFunction) return databaseUpdateNeeded();
```

Moving the `MissingLedgerFunction` return below the re-read changes nothing on that path: `MissingLedgerFunction` is thrown at `:2178` before `rpcOutcomeUnknown` can be set, so the `else` branch only restores, as today. Leave the `console.error` line, the error-message block (`:2214-2220`) and the dependency array unchanged.

**Ledger:** set the Backlog row at `docs/audit/task-ledger.md:75` Status to `done in Phase 139 (T777)`, and add a T777 row under T776 in the Phase 139 table (Task, Files `src/context/FinanceContext.tsx`, `unit/authenticated-ledger.test.tsx`; Status `done`; empty Commit; Gate result). Also widen the Phase 139 heading so it covers both tasks, e.g. `## Phase 139 - Subagent trial: useTransactions includeDeleted (CS-01) and setTransactionDeleted's T69 reload check (no ADR)`. Keep the file's CRLF line endings.

## 7. Gates

Changed paths: `src/context/`, `unit/`, `docs/audit/task-ledger.md`, and a money path. Union of tiers:

```
npm run lint
npx vitest run unit/authenticated-ledger.test.tsx unit/ledger-guards.test.tsx
npm run test:unit
npx playwright test tests/soft-delete.spec.ts --project=chromium
npx playwright test tests/soft-delete.spec.ts
```

Check ports 3000 and 3100 for stale dev servers before Playwright. Save the full `npm run test:unit` output to `workflow/stages/02_build/output/logs/`. Also:

```
git ls-files --eol src/context/FinanceContext.tsx unit/authenticated-ledger.test.tsx docs/audit/task-ledger.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
```

Expect `w/crlf` for all three files and 0 em dashes in added lines. `git diff HEAD -- src/context/FinanceContext.tsx` must show changes only inside `setTransactionDeleted`: the two added snapshot lines and the reshaped catch block above, nothing else.

## 8. Production touch points

none. The fix is client-only; no SQL, no RPC change, no request to production.

## 9. Out of scope

- `addTransaction`, `updateTransaction`, `commitBulkImport` and every other write in `FinanceContext.tsx`, including their catch blocks and comments.
- The `cloudRevisionRef` comment at `:771-782` (it names `addTransaction`; do not rewrite it).
- Any extraction of a shared rollback helper: the task is to reuse the pattern inline, not to refactor it.
- `supabase/` (the `set_transaction_deleted` RPC) and the fake RPC in the test harness (`:575-583`).
- A "reload that read nothing" test for delete or restore: F6 is enforced in `loadSupabaseData` and already pinned at `:833-859`. (Both directions, delete and restore, are in scope for the reload-landed and no-reload cases in section 6, per the owner's amendment.)
- The existing tests in the `set_transaction_deleted` describe (`:1161-1243`): leave them as they are; the four new tests are additions.
- The other Backlog rows.
