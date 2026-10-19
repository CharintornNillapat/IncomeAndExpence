# T781 spec: guest addTransaction rounds newTx.amount with roundToCents (SL-03)

Phase 140 (branch `phase-140-gemini-trial`). Source: `docs/audit/audit-2026-10-16.md` finding SL-03 (low, lines 114-119).

## 1. Goal

Wrap `data.amount` in `roundToCents(data.amount)` when constructing the guest `Transaction` record in `addTransaction` (`src/context/FinanceContext.tsx:1943`), so the stored transaction row's `amount` is cent-rounded like the optimistic wallet and debt balance updates, `updateTransaction`, and the SQL ledger RPCs.

## 2. Target files

- `src/context/FinanceContext.tsx`
- `unit/ledger-guards.test.tsx`
- `docs/audit/task-ledger.md` (bookkeeping)

No ADR: this closes a low audit finding by applying the existing `roundToCents` non-negotiable (`src/utils/money.ts:22`) to the guest `newTx` record; no new rule or architecture decision. No `refactor-log.md` or `baseline-metrics.md` entry unless the owner closes Phase 140 in a later task.

## 3. Context to read

`docs/contexts/client-state.md`: covers `src/context/FinanceContext.tsx`, the `roundToCents` rule under "Money and dates" (`line 49`), "Ledger behaviour (`addTransaction` and friends)" (`lines 66-75`), and the guest unit harness rules for `unit/ledger-guards.test.tsx` under "Unit tests for this layer" (`lines 125-132`). Nothing else.

## 4. Current behaviour

- `src/context/FinanceContext.tsx:1775-1785`: in `addTransaction`, the optimistic wallet balance updates round to cents through `roundToCents(sourceWallet.balance - data.amount)`, `roundToCents(sourceWallet.balance + data.amount)`, and `roundToCents(destWallet.balance + data.amount)`.
- `src/context/FinanceContext.tsx:1812-1814`: the optimistic debt repayment update rounds through `Math.max(0, roundToCents(targetDebt.remainingAmount - data.amount))`.
- `src/context/FinanceContext.tsx:1838-1846` and `:1901-1911`: signed in, `transfer_funds` (`supabase/migrations/20261006_phase93_transfer_funds_from_session.sql:76`) and `record_transaction` (`supabase/migrations/20260928_phase52_security_ledger.sql:221`) both compute `v_amount := round(p_amount, 2)` and store `v_amount` on the inserted `public.transactions` row.
- `src/context/FinanceContext.tsx:2256`: `updateTransaction` stores `amount: roundToCents(edit.amount)` on the updated transaction record.
- `src/context/FinanceContext.tsx:1936-1953`: in the guest branch of `addTransaction` (`else` at `:1933`), `newTx` is built with `amount: data.amount` at `:1943` without calling `roundToCents(data.amount)`. If a caller supplies a sub-cent fractional `data.amount` (e.g. `10.124`), the wallet balance moves by `10.12` while `newTx.amount` stores `10.124`, leaving the stored row out of sync with the wallet balance and with `setTransactionDeleted`'s reversal (`:2080-2092`).

### Money invariants this change must keep

1. **Single cent-rounding primitive (`AGENTS.md` Non-negotiables, `src/utils/money.ts:22`):** Every ledger write rounds amounts only through `roundToCents`. Proved by `unit/ledger-guards.test.tsx` (new SL-03 test below) and `unit/authenticated-ledger.test.tsx`.
2. **Wallet-balance and transaction-amount agreement:** In guest mode, the wallet delta (`sourceWallet.balance` before minus `sourceWallet.balance` after for an `EXPENSE`, or plus `data.amount` for a signed `ADJUSTMENT`) equals the stored `newTx.amount`. Proved by the new SL-03 test in `unit/ledger-guards.test.tsx`.
3. **Soft-delete and restore exact reversal:** Soft-deleting and restoring the guest transaction via `softDeleteTransaction` and `restoreTransaction` (`src/context/FinanceContext.tsx:2080-2158`) returns the wallet balance to its exact pre-transaction cent figure and back. Proved by the new SL-03 test in `unit/ledger-guards.test.tsx` and existing reversal suites in `unit/ledger-guards.test.tsx` and `tests/soft-delete.spec.ts`.

## 5. Parity map

Row 1 (`addTransaction` / `setTransactionDeleted` arithmetic in `FinanceContext.tsx` vs `_ledger_apply_effect` and the ledger RPCs in `supabase/migrations/20260927_ledger_rpcs.sql` and later re-creations): brings guest `addTransaction`'s stored `newTx.amount` (`roundToCents(data.amount)`) into parity with `record_transaction` (`supabase/migrations/20260928_phase52_security_ledger.sql:221`, `v_amount := round(p_amount, 2)`) and `transfer_funds` (`supabase/migrations/20261006_phase93_transfer_funds_from_session.sql:76`, `v_amount := round(p_amount, 2)`). Guarded by `unit/ledger-guards.test.tsx` and `unit/authenticated-ledger.test.tsx`.

## 6. Tests to add

In `unit/ledger-guards.test.tsx`, import `roundToCents` at the top of the file (after line 13):

```ts
import { roundToCents } from '../src/utils/money';
```

Then append one `describe` block at the end of `unit/ledger-guards.test.tsx` (after line 729):

```ts
describe('guest addTransaction rounds the stored transaction amount to cents (SL-03)', () => {
  it('stores roundToCents(amount) on positive and negative entries so the row matches the wallet delta and reverses cleanly', async () => {
    const exp = await call(() =>
      actions().addTransaction({
        amount: 10.124,
        type: 'EXPENSE',
        categoryId: 'cat-food',
        walletId: WALLET_MAIN,
        description: 'Sub-cent coffee',
        transactionDate: TODAY,
      }),
    );
    expect(exp.success).toBe(true);
    const expRow = state().transactions.find((t) => t.id === exp.txId)!;
    expect(expRow.amount).toBe(10.12);
    expect(wallet(WALLET_MAIN).balance).toBe(2489.88);
    expect(roundToCents(2500 - wallet(WALLET_MAIN).balance)).toBe(expRow.amount);

    await call(() => actions().softDeleteTransaction(exp.txId!));
    expect(wallet(WALLET_MAIN).balance).toBe(2500);
    await call(() => actions().restoreTransaction(exp.txId!));
    expect(wallet(WALLET_MAIN).balance).toBe(2489.88);

    await tick();
    const adj = await call(() =>
      actions().addTransaction({
        amount: -10.124,
        type: 'ADJUSTMENT',
        categoryId: 'cat-adjust',
        walletId: WALLET_MAIN,
        description: 'Sub-cent downward adjustment',
        transactionDate: TODAY,
      }),
    );
    expect(adj.success).toBe(true);
    const adjRow = state().transactions.find((t) => t.id === adj.txId)!;
    expect(adjRow.amount).toBe(-10.12);
    expect(wallet(WALLET_MAIN).balance).toBe(2479.76);
  });
});
```

**Why it fails today (red run):**
Before editing `src/context/FinanceContext.tsx`, run `npx vitest run unit/ledger-guards.test.tsx -t "SL-03"` and save the output to `workflow/stages/02_build/output/logs/T781-red.log`. It must fail on `expect(expRow.amount).toBe(10.12)` because `src/context/FinanceContext.tsx:1943` assigns `amount: data.amount` (`10.124`).

**Source change after the red run (`src/context/FinanceContext.tsx:1943`):**
Change line 1943 inside `addTransaction`'s guest `newTx` object literal from:

```ts
          amount: data.amount,
```

to:

```ts
          amount: roundToCents(data.amount),
```

Change nothing else in `src/context/FinanceContext.tsx`.

**Ledger (`docs/audit/task-ledger.md`):**
- Add row `T781` under `## Phase 140 - Gemini trial (no ADR)` with Task `guest addTransaction rounds newTx.amount with roundToCents (SL-03)`, Files `` `src/context/FinanceContext.tsx`, `unit/ledger-guards.test.tsx` ``, Status `done`, empty Commit, and Gate result.
- Add a Backlog row at the end of `## Backlog` (after the CS-02 row at line 88):
  `| addTransaction assigns unrounded amount on guest transaction record | Audit 2026-10-16 (T759), finding SL-03, low; \`src/context/FinanceContext.tsx:1943\` | done in Phase 140 (T781) |`

## 7. Gates

Changed paths: `src/context/FinanceContext.tsx`, `unit/ledger-guards.test.tsx`, `docs/audit/task-ledger.md`, and a money path. Union of tiers (`src/context/` tier + `unit/` tier + money-path red-first rule):

```
npm run lint
npx vitest run unit/ledger-guards.test.tsx unit/authenticated-ledger.test.tsx
npm run test:unit
npx playwright test tests/transaction.spec.ts tests/soft-delete.spec.ts --project=chromium
npx playwright test tests/transaction.spec.ts tests/soft-delete.spec.ts
```

Check ports 3000 and 3100 for stale dev servers before Playwright. Save the full `npm run test:unit` output to `workflow/stages/02_build/output/logs/`. Also check line endings and em dashes:

```
git ls-files --eol src/context/FinanceContext.tsx unit/ledger-guards.test.tsx docs/audit/task-ledger.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
```

Expect `w/crlf` on all three files and `0` em dashes in added lines. `git diff HEAD -- src/context/FinanceContext.tsx` must show a 1-insertion, 1-deletion change at line 1943 only.

## 8. Production touch points

none.

## 9. Out of scope

- Any other line of `addTransaction`, `setTransactionDeleted`, `updateTransaction`, or `commitBulkImport` in `src/context/FinanceContext.tsx`.
- `src/utils/zodSchemas.ts` (`TransactionSchema`) and `src/utils/money.ts` (`roundToCents`).
- Any SQL migration or RPC under `supabase/` (including `SL-01`).
- Any other audit finding in `docs/audit/audit-2026-10-16.md`.
