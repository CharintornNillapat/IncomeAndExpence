# Spec: T812

Phase 149 (branch `phase-149-transactions-views`), design spec `docs/design/transactions-2026-10/spec.md` section 9, task 4. Authority: ADR 0109 D7 and the design spec's O1 row; ADR 0023 and ADR 0091 for how a ledger write works. Already committed on this branch: T809 `a2634f1`, T810 `ec9fa58`, T811 `4e88626`.

## 1. Goal

Add `set_transactions_deleted`, one ledger function that soft-deletes or restores a whole selection of transactions together. Each wallet and debt moves exactly as one `set_transaction_deleted` call per row would move it, and any failure leaves every row and balance as it was. Also add its guest twin `setTransactionsDeleted` in `FinanceContext`, its probe, the PGlite replay coverage and the parity-map row, so task 5's bulk bar has one action to call. Applying it to the live project is the owner's step (section 8).

## 2. Target files

```
supabase/migrations/20261027_phase149_set_transactions_deleted.sql   (new)
supabase/tests/20261027_phase149.probe.sql                           (new)
unit/migration-replay.test.ts
unit/ledger-guards.test.tsx
unit/authenticated-ledger.test.tsx
src/utils/zodSchemas.ts
src/context/FinanceContext.tsx
AGENTS.md
docs/contexts/supabase-ledger.md
docs/contexts/client-state.md
```

No new ADR: ADR 0109 D7 already decides this function and says it extends ADR 0023 and ADR 0091. This task does not ship the phase, so it does not touch `refactor-log.md` or `baseline-metrics.md`. Bookkeeping: add the T812 row to the Phase 149 table in `docs/audit/task-ledger.md`, after T811, with Task text `Bulk soft delete and restore: set_transactions_deleted migration and probe, PGlite replay, the guest twin setTransactionsDeleted, the parity-map row (ADR 0109)` and section 2's files in the Files cell. Keep the row up to date as you work.

New files use CRLF in the working tree, like their neighbours (`git ls-files --eol` shows `w/crlf` on every existing file in this list).

## 3. Context to read

- `docs/contexts/supabase-ledger.md`: the ledger-function rules (one function or nothing, `isMissingRpcError`, unknown outcome, lock order, grants, probes, migration ordering).
- `docs/contexts/client-state.md`: the write rules (Zod first, `MutationResult`, optimistic write then RPC, compute from refs before any `setState` (ADR 0022), `markLocalWrite`, `roundToCents`) and the two unit harnesses.
- Read `src/context/FinanceContext.tsx:2077-2273` (`setTransactionDeleted`) before writing its twin. The twin copies its arithmetic term for term.

## 4. Current behaviour

- Every ledger function changes one row. `set_transaction_deleted(p_transaction_id uuid, p_deleted boolean)` is at `supabase/migrations/20260927_ledger_rpcs.sql:395-466`. It refuses no session with 28000 (`:409-411`) and a null argument with 22023 (`:412-414`). It locks the row (`:418-426`, P0002 when it is not the caller's), returns `changed: false` when the row already has the asked-for state (`:428-430`), locks wallets by id (`:435-440`) and the live debt (`:442-449`), runs `_ledger_apply_effect` with -1 to delete and +1 to restore (`:452-456`), then flips the flag (`:458-462`). The lock-order comment is at `:416-417`. No later migration re-creates it.
- `_ledger_apply_effect` (`20260927_ledger_rpcs.sql:95-162`) is the one SQL copy of the arithmetic. Source wallet `round(balance + sign * source_sign * amount, 2)`; destination (TRANSFER only) `round(balance + sign * amount, 2)`; debt (DEBT_REPAYMENT, live debt only) `greatest(0, round(remaining - sign * amount, 2))` with `is_settled` from the same value. It is revoked from every client role (`:662`). The RPC grants pattern is at `:667` and `:671`.
- No function takes a list of ids: `git grep -n set_transactions_deleted -- supabase src unit` finds nothing.
- Client: `setTransactionDeleted` (`src/context/FinanceContext.tsx:2081-2263`) reads the row from `transactionsRef` ("Transaction not found" at `:2083`, a no-op success at `:2084`). It computes the source balance (`:2112-2119`), the destination (`:2121-2124`) and the live debt's remainder (`:2139-2153`) from the refs before any `setState`. Then it writes optimistically (`:2156-2187`) and returns success for a guest (`:2189-2191`). Signed in, it calls `set_transaction_deleted` once (`:2206-2209`). It throws `MissingLedgerFunction` on a missing function (`:2212`) and flags an unknown outcome (`:2213`, `:2217-2220`). In the catch it re-fetches when a reload landed mid-flight (T69, `:2233-2237`); otherwise it rolls back and re-reads on an unknown outcome (`:2239-2251`). It returns `databaseUpdateNeeded()` for a missing function (`:2253`).
- `softDeleteTransaction` / `restoreTransaction` wrap it (`:2265-2273`). They are declared at `:200-201` and listed in `actionsValue` at `:2902-2903` and `:2928-2929`. The helpers it uses are `isUnknownOutcomeError` (`:328`), `isMissingRpcError` (`:358`), `MissingLedgerFunction` (`:372`) and `databaseUpdateNeeded` (`:376`). `updateTransaction` adopts a `balances` array at `:2400-2407`.
- There is no bulk action. `useTransactions` (`src/hooks/useTransactions.ts:24-25`, `:146-155`) exposes only the one-row pair.
- Zod: `src/utils/zodSchemas.ts` has no schema for a list of ids. `formatZodIssues` is at `:18`. `FinanceContext.tsx:27-35` imports the schemas.
- Replay: `unit/migration-replay.test.ts:50` expects 21 migration files and `:66` expects 16 functions. Three probes assert that exactly ten `SECURITY DEFINER` functions are executable by `authenticated`: `supabase/tests/20261006_phase102.probe.sql:83-87`, `20261008_phase114.probe.sql:80-83` and `20261010_phase123.probe.sql:57-60`. The replay test runs them against these file lists: Phase 102 before and after on `upTo101()` and `upTo113()` (`:280-299`); Phase 114 before on `upTo113()` (`:313-317`) and after on `migrationFiles()` (`:319-323`); Phase 123 before on `upTo122()` (`:337-343`) and after on `migrationFiles()` (`:345-349`). `upTo113` and `upTo122` filter from `migrationFiles()` (`:280`, `:337`), so a new function the advisor counts would fail all of them.
- `unit/drift-runner.test.ts` and `unit/migration-history.test.ts` read `migrationFiles().length`, so a new file needs no edit there.
- Docs: `AGENTS.md:63` is the parity row for `addTransaction` / `setTransactionDeleted`. `docs/contexts/supabase-ledger.md:16` lists the ledger functions, `:22` says `_ledger_apply_effect` mirrors `addTransaction`/`setTransactionDeleted`, and `:69` says "The ten `SECURITY DEFINER` functions". `docs/contexts/client-state.md:72` describes delete and restore.

### 4.1 The edits (written after the red run in section 6.5)

#### Edit 1: `supabase/migrations/20261027_phase149_set_transactions_deleted.sql` (new, verbatim)

```sql
-- =============================================================================
-- Phase 149 (ADR 0109, D7): set_transactions_deleted, the bulk soft delete and
-- restore behind the Transactions page's selection.
--
-- Until now every ledger function changed one row: a selection of N rows
-- deleted by N set_transaction_deleted calls could fail part-way, which ADR
-- 0091 rules out for a signed-in write. This function takes the whole
-- selection in one call and one transaction:
--
--   - every listed row must be the caller's, or the call raises P0002 and
--     changes nothing;
--   - a row already in the asked-for state is left alone (idempotent by state,
--     as set_transaction_deleted is), and a repeated id counts once;
--   - each row that changes runs _ledger_apply_effect with -1 to delete or +1
--     to restore, in id order, so every wallet and debt moves exactly as one
--     set_transaction_deleted call per row would move it;
--   - any error after that (a balance past numeric(15,2), say) rolls back
--     every row with it.
--
-- Lock order, as in 20260927_ledger_rpcs.sql: transactions, then wallets,
-- then debts, each set in id order, so it cannot deadlock with
-- set_transaction_deleted, update_transaction or another bulk call.
--
-- Returns jsonb:
--   { changed_ids, transactions, balances: [{ id, balance }],
--     debts: [{ id, remaining_amount, is_settled }] }
-- `transactions` is every listed row as it stands after the call, `balances`
-- every wallet those rows name, `debts` every live debt their repayments name.
--
-- Additive: no existing function changes, and re-running this file is
-- harmless. APPLY IT BEFORE DEPLOYING A CLIENT THAT CALLS IT: without it the
-- client gets PGRST202 and reports DATABASE_UPDATE_NEEDED, changing nothing.
--
-- Probe: supabase/tests/20261027_phase149.probe.sql.
-- =============================================================================

create or replace function public.set_transactions_deleted(
  p_transaction_ids uuid[],
  p_deleted         boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_ids     uuid[];
  v_tx      public.transactions%rowtype;
  v_changed uuid[] := '{}';
begin
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if p_transaction_ids is null or p_deleted is null
     or cardinality(p_transaction_ids) = 0
     or array_position(p_transaction_ids, null) is not null then
    raise exception 'Transaction ids and a target state are required' using errcode = '22023';
  end if;

  select array_agg(distinct t.id order by t.id) into v_ids
    from unnest(p_transaction_ids) as t(id);

  perform 1
     from public.transactions
    where user_id = v_uid
      and id = any(v_ids)
    order by id
      for update;

  if (select count(*) from public.transactions
       where user_id = v_uid and id = any(v_ids)) <> cardinality(v_ids) then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;

  -- Wallets are locked regardless of their own is_deleted, as in
  -- set_transaction_deleted: a row on a since-deleted wallet still moves it.
  perform 1
     from public.wallets
    where user_id = v_uid
      and id in (select t.wallet_id from public.transactions t
                  where t.user_id = v_uid and t.id = any(v_ids) and t.is_deleted <> p_deleted
                 union
                 select t.destination_wallet_id from public.transactions t
                  where t.user_id = v_uid and t.id = any(v_ids) and t.is_deleted <> p_deleted)
    order by id
      for update;

  perform 1
     from public.debts
    where user_id = v_uid
      and is_deleted = false
      and id in (select t.debt_id from public.transactions t
                  where t.user_id = v_uid and t.id = any(v_ids) and t.is_deleted <> p_deleted
                    and t.type = 'DEBT_REPAYMENT')
    order by id
      for update;

  -- Deleting reverses each row's effect (-1); restoring reapplies it (+1).
  for v_tx in
    select * from public.transactions
     where user_id = v_uid and id = any(v_ids) and is_deleted <> p_deleted
     order by id
  loop
    perform public._ledger_apply_effect(
      v_uid, v_tx.wallet_id, v_tx.destination_wallet_id, v_tx.debt_id,
      v_tx.type, v_tx.amount,
      case when p_deleted then -1 else 1 end
    );
    v_changed := v_changed || v_tx.id;
  end loop;

  update public.transactions
     set is_deleted = p_deleted,
         updated_at = now()
   where user_id = v_uid
     and id = any(v_changed);

  return jsonb_build_object(
    'changed_ids',  to_jsonb(v_changed),
    'transactions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb)
                       from public.transactions t
                      where t.user_id = v_uid and t.id = any(v_ids)),
    'balances',     (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'balance', w.balance) order by w.id), '[]'::jsonb)
                       from public.wallets w
                      where w.user_id = v_uid
                        and w.id in (select t.wallet_id from public.transactions t
                                      where t.user_id = v_uid and t.id = any(v_ids)
                                     union
                                     select t.destination_wallet_id from public.transactions t
                                      where t.user_id = v_uid and t.id = any(v_ids))),
    'debts',        (select coalesce(jsonb_agg(jsonb_build_object(
                               'id', d.id, 'remaining_amount', d.remaining_amount, 'is_settled', d.is_settled)
                             order by d.id), '[]'::jsonb)
                       from public.debts d
                      where d.user_id = v_uid
                        and d.is_deleted = false
                        and d.id in (select t.debt_id from public.transactions t
                                      where t.user_id = v_uid and t.id = any(v_ids)
                                        and t.type = 'DEBT_REPAYMENT'))
  );
end;
$$;

-- Supabase's default privileges grant EXECUTE on a new public function to anon
-- and authenticated, so the revoke is explicit. Signed-in callers only.
revoke all on function public.set_transactions_deleted(uuid[], boolean) from public, anon;
grant execute on function public.set_transactions_deleted(uuid[], boolean) to authenticated, service_role;
```

ADR 0109 writes the signature as `(ids uuid[], deleted boolean)`. The parameters take the `p_` prefix every ledger function uses (`set_transaction_deleted(p_transaction_id, p_deleted)`); the types and the behaviour are the ADR's. No size cap on the array: the caller can only list its own rows, and a selection is at most the loaded rows.

#### Edit 2: `src/utils/zodSchemas.ts`

After `PresetSchema` (ends `:175`), add:

```ts
// ADR 0109: a bulk delete or restore names at least one row and a target state.
export const TransactionIdsSchema = z.object({
  ids: z.array(z.string().min(1, 'A transaction id is required')).min(1, 'Select at least one transaction'),
  deleted: z.boolean(),
});
```

#### Edit 3: `src/context/FinanceContext.tsx`, the import and the result shape

- Add `TransactionIdsSchema,` to the `../utils/zodSchemas` import (`:27-35`), after `CategorySchema,`.
- After `interface LedgerWriteResult { ... }` (ends `:277`), add:

```ts
// Shape returned by `set_transactions_deleted` (ADR 0109): every listed row as
// it stands after the call, the committed balance of every wallet those rows
// name, and the remainder of every live debt their repayments name.
interface SetTransactionsDeletedResult {
  changed_ids: string[];
  transactions: any[];
  balances: { id: string; balance: number | string }[];
  debts: { id: string; remaining_amount: number | string; is_settled: boolean }[];
}
```

#### Edit 4: `src/context/FinanceContext.tsx`, the action type

In `FinanceActionsContextType`, after `restoreTransaction: ...` (`:201`), add:

```ts
  /**
   * Soft-deletes (`deleted: true`) or restores every listed transaction in one
   * write (ADR 0109). All rows or none: an id that does not resolve fails the
   * whole call and moves nothing. A row already in the asked-for state is left
   * as it is, and a repeated id counts once. Signed in, it is one
   * `set_transactions_deleted` RPC, with no fallback when it is missing.
   */
  setTransactionsDeleted: (ids: string[], deleted: boolean) => Promise<MutationResult>;
```

#### Edit 5: `src/context/FinanceContext.tsx`, the action

Directly after `restoreTransaction` (ends `:2273`), before the `updateTransaction` comment, add this function verbatim. Adjust only formatting `tsc` or the line length needs. `setTransactionDeleted`, `softDeleteTransaction` and `restoreTransaction` stay byte for byte as they are.

```ts
  // ADR 0109 (O1): soft-deletes or restores every listed row in one write. Row
  // by row it is `setTransactionDeleted`'s arithmetic, run over one running
  // copy of the balances and remainders computed from the refs before any
  // setState (ADR 0022), then committed in one update. All rows or none: an id
  // that does not resolve moves nothing. Signed in, it is one
  // `set_transactions_deleted` call and nothing else (ADR 0091); that function
  // runs `_ledger_apply_effect` per row, the same arithmetic.
  const setTransactionsDeleted = useCallback(async (ids: string[], deleted: boolean): Promise<MutationResult> => {
    const validation = TransactionIdsSchema.safeParse({ ids, deleted });
    if (!validation.success) return { success: false, error: formatZodIssues(validation.error) };

    const listedIds = [...new Set(validation.data.ids)];
    const listed = listedIds
      .map((id) => transactionsRef.current.find((t) => t.id === id))
      .filter((t): t is Transaction => t !== undefined);
    if (listed.length !== listedIds.length) return { success: false, error: 'Transaction not found' };
    const changing = listed.filter((t) => t.isDeleted !== deleted);
    if (changing.length === 0) return { success: true };

    // +1 takes a row out of the ledger and -1 puts it back, as in `setTransactionDeleted`.
    const sign = deleted ? 1 : -1;

    const previousTransactions = transactionsRef.current;
    const previousWallets = walletsRef.current;
    const previousDebts = debtsRef.current;
    // T69: see `cloudRevisionRef`.
    const cloudRevisionAtStart = cloudRevisionRef.current;

    const newBalances = new Map<string, number>();
    const newRemainders = new Map<string, number>();
    for (const tx of changing) {
      const source = walletsRef.current.find((w) => w.id === tx.walletId);
      if (source) {
        const balance = newBalances.get(source.id) ?? source.balance;
        if (tx.type === 'EXPENSE' || tx.type === 'DEBT_REPAYMENT' || tx.type === 'TRANSFER') {
          newBalances.set(source.id, roundToCents(balance + sign * tx.amount));
        } else if (tx.type === 'INCOME' || tx.type === 'ADJUSTMENT') {
          newBalances.set(source.id, roundToCents(balance - sign * tx.amount));
        }
      }
      const dest =
        tx.type === 'TRANSFER' && tx.destinationWalletId
          ? walletsRef.current.find((w) => w.id === tx.destinationWalletId)
          : undefined;
      if (dest) {
        newBalances.set(dest.id, roundToCents((newBalances.get(dest.id) ?? dest.balance) - sign * tx.amount));
      }
      const debt =
        tx.type === 'DEBT_REPAYMENT' && tx.debtId
          ? debtsRef.current.find((d) => d.id === tx.debtId && !d.isDeleted)
          : undefined;
      if (debt) {
        const remaining = newRemainders.get(debt.id) ?? debt.remainingAmount;
        newRemainders.set(debt.id, Math.max(0, roundToCents(remaining + sign * tx.amount)));
      }
    }

    const changingIds = new Set(changing.map((t) => t.id));
    const now = new Date().toISOString();
    setTransactions((prev) =>
      prev.map((t) => (changingIds.has(t.id) ? { ...t, isDeleted: deleted, updatedAt: now } : t))
    );
    setWallets((prev) => prev.map((w) => (newBalances.has(w.id) ? { ...w, balance: newBalances.get(w.id)! } : w)));
    if (newRemainders.size > 0) {
      setDebts((prev) =>
        prev.map((d) => {
          const remaining = newRemainders.get(d.id);
          return remaining === undefined
            ? d
            : { ...d, remainingAmount: remaining, isSettled: remaining === 0, updatedAt: now };
        })
      );
    }

    if (!isAuthenticated) return { success: true };

    // ADR 0023: set when the RPC may have committed without telling us.
    let rpcOutcomeUnknown = false;

    try {
      for (const id of changingIds) markLocalWrite(id);
      for (const id of newBalances.keys()) markLocalWrite(id);
      for (const id of newRemainders.keys()) markLocalWrite(id);
      const { data: rpcData, error: rpcError } = await supabase.rpc('set_transactions_deleted', {
        p_transaction_ids: listedIds,
        p_deleted: deleted,
      });

      if (rpcError) {
        if (isMissingRpcError(rpcError)) throw new MissingLedgerFunction();
        if (isUnknownOutcomeError(rpcError)) rpcOutcomeUnknown = true;
        throw rpcError;
      }
      const payload = rpcData as SetTransactionsDeletedResult | null;
      if (!payload || !Array.isArray(payload.transactions)) {
        rpcOutcomeUnknown = true;
        throw new Error('set_transactions_deleted returned an unexpected response');
      }

      // What the database committed replaces the optimistic values.
      const committedRows = new Map(payload.transactions.map((row) => {
        const mapped = mapTransactionRow(row);
        return [mapped.id, mapped] as const;
      }));
      setTransactions((prev) => prev.map((t) => committedRows.get(t.id) ?? t));

      const committedBalances = new Map<string, number>();
      for (const row of payload.balances ?? []) {
        const balance = Number(row.balance);
        if (Number.isFinite(balance)) committedBalances.set(row.id, balance);
      }
      if (committedBalances.size > 0) {
        setWallets((prev) =>
          prev.map((w) => (committedBalances.has(w.id) ? { ...w, balance: committedBalances.get(w.id)! } : w))
        );
      }

      const committedDebts = new Map<string, { remaining: number; settled: boolean }>();
      for (const row of payload.debts ?? []) {
        const remaining = Number(row.remaining_amount);
        if (Number.isFinite(remaining)) committedDebts.set(row.id, { remaining, settled: row.is_settled === true });
      }
      if (committedDebts.size > 0) {
        const updatedAt = new Date().toISOString();
        setDebts((prev) =>
          prev.map((d) => {
            const committed = committedDebts.get(d.id);
            return committed
              ? { ...d, remainingAmount: committed.remaining, isSettled: committed.settled, updatedAt }
              : d;
          })
        );
      }
      return { success: true };

    } catch (err: unknown) {
      console.error('[Set Transactions Deleted Failed]', err);

      if (cloudRevisionRef.current !== cloudRevisionAtStart) {
        // T69: a reload landed mid-flight, so the snapshot is stale. Re-fetch.
        await refreshFromCloud();
      } else {
        setTransactions(previousTransactions);
        setWallets(previousWallets);
        setDebts(previousDebts);
        // ADR 0023: the rollback is a guess when the RPC may have committed.
        if (rpcOutcomeUnknown) await refreshFromCloud();
      }

      if (err instanceof MissingLedgerFunction) return databaseUpdateNeeded();

      const postgrestErr = err as { message?: string; details?: string; hint?: string };
      const detailedError =
        postgrestErr?.message ||
        postgrestErr?.details ||
        postgrestErr?.hint ||
        (err instanceof Error ? err.message : 'Database error');
      return { success: false, error: detailedError };
    }
  }, [isAuthenticated, markLocalWrite, refreshFromCloud]);
```

Then add `setTransactionsDeleted,` after `restoreTransaction,` in both the object and the dependency list of `actionsValue` (`:2903` and `:2929`).

#### Edit 6: `AGENTS.md`

Insert one row directly after `:63` in the parity map:

```
| `setTransactionsDeleted` arithmetic (`FinanceContext.tsx`) | `set_transactions_deleted` (`supabase/migrations/20261027_phase149_set_transactions_deleted.sql`), which runs `_ledger_apply_effect` once per changed row as `set_transaction_deleted` does | `unit/ledger-guards.test.tsx`, `unit/authenticated-ledger.test.tsx`, `supabase/tests/20261027_phase149.probe.sql` (run by `unit/migration-replay.test.ts`) |
```

Nothing else in `AGENTS.md` changes. The test counts in its Project section are the phase's closing task.

#### Edit 7: `docs/contexts/supabase-ledger.md`

- `:16`: after `` `set_transaction_deleted` (idempotent by state), `` insert `` `set_transactions_deleted` (every listed row or none, each changed row through `_ledger_apply_effect` [0109]), ``.
- `:22`: `` mirrors `addTransaction`/`setTransactionDeleted` term for term `` becomes `` mirrors `addTransaction`/`setTransactionDeleted`/`setTransactionsDeleted` term for term ``.
- `:69`: `The ten` becomes `The eleven`.

#### Edit 8: `docs/contexts/client-state.md`

After `:72` (the soft delete bullet), add one bullet:

```
- **Bulk soft delete and restore** [0109]: `setTransactionsDeleted(ids, deleted)` runs `setTransactionDeleted`'s arithmetic row by row over one running copy of the balances and remainders, computed from the refs, then commits in one update. All rows or none: an id that does not resolve moves nothing. A row already in the asked-for state is skipped and a repeated id counts once. Signed in it is one `set_transactions_deleted` call, never a loop of one-row calls.
```

## 5. Parity map

- `AGENTS.md:63`: `addTransaction` / `setTransactionDeleted` arithmetic matches `_ledger_apply_effect` and the ledger RPCs. Neither side changes: the new function calls `_ledger_apply_effect` unchanged, and `setTransactionDeleted` is not edited.
- New row (section 4.1, edit 6): `setTransactionsDeleted` arithmetic matches `set_transactions_deleted`. Its guards are `unit/ledger-guards.test.tsx`, `unit/authenticated-ledger.test.tsx`, and the new probe run by `unit/migration-replay.test.ts`.

## 6. Tests to add

Write all of these first. Then run them against the code without the migration, the `zodSchemas.ts` edit and the `FinanceContext.tsx` edits (section 6.5). The probe file is part of the tests.

### 6.1 `supabase/tests/20261027_phase149.probe.sql` (new, verbatim)

The SQL below is the file. Keep the uuids, amounts and messages exactly; the replay test matches the first message.

```sql
-- =============================================================================
-- Phase 149 probe (ADR 0109): set_transactions_deleted soft-deletes or restores
-- every listed row in one call, moving each wallet and debt exactly as one
-- set_transaction_deleted call per row would, and moves nothing when any part
-- of the call fails.
--
-- Runs inside BEGIN ... ROLLBACK, so nothing it creates or writes survives.
-- Keep the `\ir` line to test the migration before it is applied; a runner
-- without psql pastes the file in its place. After it is applied, remove the
-- `\ir` line and run the rest against the live schema. The unit suite runs it
-- on a replayed database (unit/migration-replay.test.ts).
--
-- Success is the final row, `PHASE 149 PROBE OK`.
-- =============================================================================

begin;

\ir ../migrations/20261027_phase149_set_transactions_deleted.sql

-- -----------------------------------------------------------------------------
-- 1. The function: security definer with a pinned search_path, signed-in
--    callers only, and one more entry on the advisor's list (ADR 0067).
-- -----------------------------------------------------------------------------
do $shape$
declare
  fn regprocedure := to_regprocedure('public.set_transactions_deleted(uuid[], boolean)');
begin
  assert fn is not null, '1 set_transactions_deleted is missing';
  assert (select prosecdef from pg_proc where oid = fn), '1 not security definer';
  assert (select proconfig from pg_proc where oid = fn) = array['search_path=public, pg_temp'],
    '1 search_path is not pinned';
  assert not has_function_privilege('anon', fn, 'execute'), '1 anon can execute';
  assert has_function_privilege('authenticated', fn, 'execute'), '1 authenticated cannot execute';
  assert has_function_privilege('service_role', fn, 'execute'), '1 service_role cannot execute';
  assert (select count(*) from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prosecdef
             and has_function_privilege('authenticated', p.oid, 'execute')) = 11,
    '1 the advisor would not list exactly eleven SECURITY DEFINER functions';
end;
$shape$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000149a01', 'phase149-probe-a@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe A"}'),
  ('00000000-0000-4000-8000-000000149b01', 'phase149-probe-b@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe B"}');

insert into public.wallets (id, user_id, name, type, balance) values
  ('00000000-0000-4000-8000-0000014aa001', '00000000-0000-4000-8000-000000149a01', 'A main',  'CASH',        1000.00),
  ('00000000-0000-4000-8000-0000014aa002', '00000000-0000-4000-8000-000000149a01', 'A card',  'CREDIT_CARD', 0.00),
  ('00000000-0000-4000-8000-0000014aa003', '00000000-0000-4000-8000-000000149a01', 'A spare', 'CASH',        0.00),
  ('00000000-0000-4000-8000-0000014aa004', '00000000-0000-4000-8000-000000149a01', 'A full',  'CASH',        9999999999999.00),
  ('00000000-0000-4000-8000-0000014bb001', '00000000-0000-4000-8000-000000149b01', 'B main',  'CASH',        50.00);

insert into public.debts (id, user_id, name, total_amount, remaining_amount) values
  ('00000000-0000-4000-8000-0000014ad001', '00000000-0000-4000-8000-000000149a01', 'A loan', 1000.00, 500.00);

-- Two rows already deleted, so their effect is not in any balance. z1 can be
-- restored; z2 cannot, since A full would pass numeric(15,2). z1 sorts first,
-- so a call restoring both has moved A card before it fails.
insert into public.transactions (id, user_id, wallet_id, amount, type, description, is_deleted) values
  ('00000000-0000-4000-8000-0000014af001', '00000000-0000-4000-8000-000000149a01', '00000000-0000-4000-8000-0000014aa002', 5.00,   'EXPENSE', 'p149 z1', true),
  ('00000000-0000-4000-8000-0000014af002', '00000000-0000-4000-8000-000000149a01', '00000000-0000-4000-8000-0000014aa004', 100.00, 'INCOME',  'p149 z2', true);

-- Calls set_transactions_deleted as whoever the claims name, and returns its
-- result, or {"error": SQLSTATE} when it raised. A raise rolls back everything
-- the call did, as it does for a request.
create function pg_temp.bulk_as(p_claims text, p_ids uuid[], p_deleted boolean)
returns jsonb
language plpgsql
as $fn$
begin
  perform set_config('request.jwt.claims', p_claims, true);
  return public.set_transactions_deleted(p_ids, p_deleted);
exception when others then
  return jsonb_build_object('error', sqlstate);
end;
$fn$;
grant execute on function pg_temp.bulk_as(text, uuid[], boolean) to authenticated;

-- A's three wallets in id order, then the loan's remainder and settled flag,
-- as the caller sees them.
create function pg_temp.ledger()
returns text
language sql
as $fn$
  select (select string_agg(w.balance::text, ' ' order by w.id) from public.wallets w
           where w.id in ('00000000-0000-4000-8000-0000014aa001',
                          '00000000-0000-4000-8000-0000014aa002',
                          '00000000-0000-4000-8000-0000014aa003'))
         || ' ' ||
         (select d.remaining_amount::text || ' ' || d.is_settled::text from public.debts d
           where d.id = '00000000-0000-4000-8000-0000014ad001');
$fn$;
grant execute on function pg_temp.ledger() to authenticated;

set local role authenticated;
do $calls$
declare
  a    text := '{"sub":"00000000-0000-4000-8000-000000149a01","role":"authenticated"}';
  b    text := '{"sub":"00000000-0000-4000-8000-000000149b01","role":"authenticated"}';
  a1   uuid := '00000000-0000-4000-8000-0000014aa001';
  a2   uuid := '00000000-0000-4000-8000-0000014aa002';
  a3   uuid := '00000000-0000-4000-8000-0000014aa003';
  b1   uuid := '00000000-0000-4000-8000-0000014bb001';
  d1   uuid := '00000000-0000-4000-8000-0000014ad001';
  z1   uuid := '00000000-0000-4000-8000-0000014af001';
  z2   uuid := '00000000-0000-4000-8000-0000014af002';
  day  date := '2026-10-27';
  start text := '629.90 50.25 44.95 300.00 false';
  e1 uuid; i1 uuid; r1 uuid; j1 uuid; t1 uuid; bx uuid;
  five uuid[];
  x    uuid;
  r    jsonb;
begin
  -- 2. One row of each type, written by the existing functions. B has one too.
  perform set_config('request.jwt.claims', b, true);
  bx := (public.record_transaction(b1, 10.00, 'EXPENSE', 'p149 B', day, 'p149-bx') -> 'transaction' ->> 'id')::uuid;
  perform set_config('request.jwt.claims', a, true);
  e1 := (public.record_transaction(a1, 100.10, 'EXPENSE', 'p149 expense', day, 'p149-e1') -> 'transaction' ->> 'id')::uuid;
  i1 := (public.record_transaction(a2, 50.25, 'INCOME', 'p149 income', day, 'p149-i1') -> 'transaction' ->> 'id')::uuid;
  r1 := (public.record_transaction(a1, 200.00, 'DEBT_REPAYMENT', 'p149 repayment', day, 'p149-r1', p_debt_id => d1) -> 'transaction' ->> 'id')::uuid;
  j1 := (public.record_transaction(a3, -25.05, 'ADJUSTMENT', 'p149 adjustment', day, 'p149-j1') -> 'transaction' ->> 'id')::uuid;
  t1 := (public.transfer_funds(p_source_wallet_id => a1, p_dest_wallet_id => a3, p_amount => 70.00,
           p_idempotency_key => 'p149-t1') -> 'transaction' ->> 'id')::uuid;
  five := array[e1, i1, r1, j1, t1];
  assert pg_temp.ledger() = start, format('2 setup: %s', pg_temp.ledger());

  -- 3. Delete all five in one call: every wallet and the loan back where they
  --    started, and the result names every row, wallet and debt.
  r := pg_temp.bulk_as(a, five, true);
  assert r ->> 'error' is null, format('3 delete: %s', r);
  assert jsonb_array_length(r -> 'changed_ids') = 5, format('3 changed: %s', r);
  assert jsonb_array_length(r -> 'transactions') = 5, format('3 rows: %s', r);
  assert (select bool_and((t ->> 'is_deleted')::boolean) from jsonb_array_elements(r -> 'transactions') t),
    format('3 a row is live: %s', r);
  assert jsonb_array_length(r -> 'balances') = 3, format('3 balances: %s', r);
  assert (r -> 'debts' -> 0 ->> 'id')::uuid = d1, format('3 debts: %s', r);
  assert (r -> 'debts' -> 0 ->> 'remaining_amount')::numeric = 500, format('3 debt remaining: %s', r);
  assert pg_temp.ledger() = '1000.00 0.00 0.00 500.00 false', format('3 ledger: %s', pg_temp.ledger());

  -- 4. The same call again changes nothing.
  r := pg_temp.bulk_as(a, five, true);
  assert jsonb_array_length(r -> 'changed_ids') = 0, format('4 changed: %s', r);
  assert pg_temp.ledger() = '1000.00 0.00 0.00 500.00 false', format('4 ledger: %s', pg_temp.ledger());

  -- 5. Restore all five, one id twice: it counts once.
  r := pg_temp.bulk_as(a, five || e1, false);
  assert jsonb_array_length(r -> 'changed_ids') = 5, format('5 changed: %s', r);
  assert pg_temp.ledger() = start, format('5 ledger: %s', pg_temp.ledger());

  -- 6. Parity: five set_transaction_deleted calls land where one bulk delete
  --    did, and one bulk restore undoes them.
  foreach x in array five loop
    perform public.set_transaction_deleted(x, true);
  end loop;
  assert pg_temp.ledger() = '1000.00 0.00 0.00 500.00 false', format('6 one by one: %s', pg_temp.ledger());
  r := pg_temp.bulk_as(a, five, false);
  assert pg_temp.ledger() = start, format('6 bulk restore: %s', pg_temp.ledger());

  -- 7. A row already deleted is left alone; only the live one moves.
  perform public.set_transaction_deleted(e1, true);
  r := pg_temp.bulk_as(a, array[e1, i1], true);
  assert r -> 'changed_ids' = to_jsonb(array[i1]), format('7 changed: %s', r);
  assert pg_temp.ledger() = '730.00 0.00 44.95 300.00 false', format('7 ledger: %s', pg_temp.ledger());
  r := pg_temp.bulk_as(a, array[e1, i1], false);
  assert pg_temp.ledger() = start, format('7 restore: %s', pg_temp.ledger());

  -- 8. All rows or none: B's row, a row that does not exist, and a failure
  --    after one row has already moved each leave everything as it was.
  r := pg_temp.bulk_as(a, array[e1, bx], true);
  assert r ->> 'error' = 'P0002', format('8 B''s row: %s', r);
  r := pg_temp.bulk_as(a, array[e1, '00000000-0000-4000-8000-0000014ffff1'::uuid], true);
  assert r ->> 'error' = 'P0002', format('8 no such row: %s', r);
  r := pg_temp.bulk_as(a, array[z1, z2], false);
  assert r ->> 'error' = '22003', format('8 overflow: %s', r);
  assert pg_temp.ledger() = start, format('8 ledger: %s', pg_temp.ledger());
  assert (select is_deleted from public.transactions where id = z1), '8 z1 was restored';
  assert not (select is_deleted from public.transactions where id = e1), '8 e1 was deleted';

  -- 9. Refusals: no session, no ids, a null id, no target state.
  r := pg_temp.bulk_as('{}', array[e1], true);
  assert r ->> 'error' = '28000', format('9 no session: %s', r);
  r := pg_temp.bulk_as(a, '{}'::uuid[], true);
  assert r ->> 'error' = '22023', format('9 no ids: %s', r);
  r := pg_temp.bulk_as(a, array[e1, null]::uuid[], true);
  assert r ->> 'error' = '22023', format('9 a null id: %s', r);
  r := pg_temp.bulk_as(a, array[e1], null);
  assert r ->> 'error' = '22023', format('9 no state: %s', r);
  assert pg_temp.ledger() = start, format('9 ledger: %s', pg_temp.ledger());

  -- 10. A restore floors the loan at zero and settles it, as
  --     set_transaction_deleted does (ADR 0016).
  r := pg_temp.bulk_as(a, array[r1], true);
  assert pg_temp.ledger() = '829.90 50.25 44.95 500.00 false', format('10 delete: %s', pg_temp.ledger());
  perform public.record_transaction(a1, 450.00, 'DEBT_REPAYMENT', 'p149 repayment 2', day, 'p149-r2', p_debt_id => d1);
  assert pg_temp.ledger() = '379.90 50.25 44.95 50.00 false', format('10 repay: %s', pg_temp.ledger());
  r := pg_temp.bulk_as(a, array[r1], false);
  assert pg_temp.ledger() = '179.90 50.25 44.95 0.00 true', format('10 restore: %s', pg_temp.ledger());
end;
$calls$;
reset role;

-- -----------------------------------------------------------------------------
-- 11. Nothing outside A's call moved: B's wallet and row, A full.
-- -----------------------------------------------------------------------------
do $ledger$
begin
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000014bb001') = 40.00, '11 B main moved';
  assert not (select is_deleted from public.transactions where description = 'p149 B'), '11 B''s row was deleted';
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000014aa004') = 9999999999999.00, '11 A full moved';
end;
$ledger$;

select 'PHASE 149 PROBE OK' as result;

rollback;
```

The amounts in the comments: after section 2, A main is 1000.00 - 100.10 - 200.00 - 70.00 = 629.90, A card is 50.25, A spare is -25.05 + 70.00 = 44.95, and the loan is 300.00. If an assertion fails on a figure, the probe or the function is wrong. Do not change a figure to make it pass; stop and report.

### 6.2 `unit/migration-replay.test.ts`

1. `:50`: `toHaveLength(21)` becomes `toHaveLength(22)`.
2. `:58-61` comment: end the sentence with `..., less the 20260909 transfer_funds signature Phase 114 drops (ADR 0090), plus Phase 149's set_transactions_deleted (ADR 0109).` `:66`: `toBe(16)` becomes `toBe(17)`.
3. After the Phase 123 test (`:89-97`), add:

```ts
  it('ends with set_transactions_deleted callable by signed-in callers only (Phase 149)', () => {
    const fn = 'set_transactions_deleted(p_transaction_ids uuid[], p_deleted boolean)';
    const grant = (role: string) => catalog.find(r => r.kind === 'function grant' && r.name === `${fn} to ${role}`)?.detail;
    expect(catalog.find(r => r.kind === 'function' && r.name === fn)?.detail).toContain('security definer set search_path=public, pg_temp');
    expect(grant('anon')).toBe('none');
    expect(grant('authenticated')).toBe('execute');
    expect(grant('service_role')).toBe('execute');
  });
```

4. In `describe('the probes against the schema the migrations build')`, replace the comment and two lines at `:277-281` with:

```ts
  // Its section 4 checks that the 20260909 signature still moves money, which
  // Phase 102 ends on purpose; the Phase 102 probe checks the refusal instead.
  // Phase 114 drops that signature, so both stop before it. Phase 149 adds an
  // eleventh SECURITY DEFINER function the advisor lists, so the probes that
  // count ten (Phases 102, 114 and 123) stop before it.
  const upTo148 = () => migrationFiles().filter(file => !file.includes('_phase149_'));
  const upTo113 = () => upTo148().filter(file => !file.includes('_phase114_'));
  const upTo101 = () => upTo113().filter(file => !file.includes('_phase102_'));
```

5. `'Phase 114, after its migration: passes against every file'` becomes `'Phase 114, after its migration: passes against every file up to Phase 149'`, and its `migrationFiles()` becomes `upTo148()`.
6. `:337`: `const upTo122 = () => migrationFiles().filter(...)` becomes `const upTo122 = () => upTo148().filter(file => !file.includes('_phase123_'));`. `'Phase 123, after its migration: passes against every file'` becomes `'... every file up to Phase 149'`, and its `migrationFiles()` becomes `upTo148()`.
7. After the Phase 96 "after" test, before the Phase 73 test, add:

```ts
  it('Phase 149, before its migration: applies it, passes and rolls back', async () => {
    const { rows, before, after } = await runProbe('20261027_phase149.probe.sql', upTo148(), false);
    expect(rows).toContainEqual({ result: 'PHASE 149 PROBE OK' });
    expect(after).toEqual(before);
  }, 60_000);

  it('Phase 149, after its migration: passes against every file', async () => {
    const { rows, before, after } = await runProbe('20261027_phase149.probe.sql', migrationFiles(), true);
    expect(rows).toContainEqual({ result: 'PHASE 149 PROBE OK' });
    expect(after).toEqual(before);
  }, 60_000);

  it('Phase 149: the probe fails on the schema before it, with the migration left out', async () => {
    const probeDb = await createDatabase();
    try {
      await applyMigrations(probeDb, upTo148());
      await expect(probeDb.exec(inlineProbe('20261027_phase149.probe.sql', { applied: true }))).rejects.toThrow(
        /set_transactions_deleted is missing/
      );
    } finally {
      await probeDb.close();
    }
  }, 60_000);
```

Why these fail today: no migration file means 21 files (item 1), 16 functions (item 2) and no catalog row (item 3). The "before" run reads an `\ir` path that does not exist (ENOENT). The "after" run stops at `1 set_transactions_deleted is missing`. The "fails before" test passes on the unfixed code by design. Items 4 to 6 pass either way; they keep the ten-count probes green once the migration exists.

### 6.3 `unit/ledger-guards.test.tsx` (guest), new describe after `'ledger arithmetic stays cent-precise'`

`describe('bulk soft-delete and restore (ADR 0109)', ...)`. Use `call(...)` around every action and `tick()` between adds, as the file already does. The fixture is: main ฿2,500.00, savings ฿5,000.00, the loan ฿4,500.00 owed.

1. `deletes an expense, an income, a transfer, a repayment and a downward adjustment in one call, and restores them in another`. Add EXPENSE 300 on main, INCOME 120.40 on savings, TRANSFER 250 main to savings, `repay({ amount: 1000 })` (from savings), and ADJUSTMENT -45.55 on main. Expect main 1904.45, savings 4370.40, loan 3500. `setTransactionsDeleted([all five], true)` returns `{ success: true }`. Main is 2500, savings 5000, the loan 4500 and not settled, and all five rows have `isDeleted` true. `setTransactionsDeleted([all five], false)` returns `{ success: true }`, and main, savings and the loan are back at 1904.45, 4370.40 and 3500, with all five live.
2. `matches the same rows deleted one at a time`. Use the same five rows. Bulk delete, then record main, savings and the loan. Bulk restore. Then `softDeleteTransaction` each of the five in turn: main, savings and the loan equal the recorded values.
3. `un-settles and re-settles a debt with the payment that settled it`. `repay({ amount: DEBT_REMAINING })` plus an EXPENSE 300 on main. A bulk delete of both leaves the loan at 4500, not settled, and main at 2500. A bulk restore of both leaves the loan at 0, settled, and main at 2200.
4. `stays cent-precise across several repayments`. `repay({ amount: 0.1 })`, `tick()`, `repay({ amount: 0.2 })`. A bulk delete of both leaves the loan at exactly 4500 and savings at exactly 5000 (`toBe`).
5. `moves nothing when one id does not resolve`. After an EXPENSE 300 on main, `setTransactionsDeleted([spent, 'tx-never-existed'], true)` equals `{ success: false, error: 'Transaction not found' }`. Main is still 2200 and the row is live.
6. `leaves a row already deleted alone and counts a repeated id once`. EXPENSE 300 on main plus `repay({ amount: 1000 })`. `softDeleteTransaction(spent)` first (main 2500). Then `setTransactionsDeleted([spent, spent, paid], true)` succeeds: main 2500 (not 2800), savings 5000, the loan 4500.
7. `is a no-op when every row is already in the asked-for state`. With a live EXPENSE 300, `setTransactionsDeleted([spent], false)` returns `{ success: true }` and main stays 2200.
8. `refuses an empty list at the schema layer`. `setTransactionsDeleted([], true)` equals `{ success: false, error: 'Select at least one transaction' }`.

Why they fail today: `actions().setTransactionsDeleted` is undefined, so every test throws `TypeError: ... is not a function`.

### 6.4 `unit/authenticated-ledger.test.tsx` (signed in)

A. Inside `installLedgerRpcs()` (`:557-779`), directly after the `set_transaction_deleted` handler (`:598-607`), add the JS stand-in:

```ts
  // ADR 0109: every listed row or none; a row already in the asked-for state
  // is left alone and a repeated id counts once; each changed row moves its
  // wallets and debt as one set_transaction_deleted call would.
  fake.state.rpcs.set('set_transactions_deleted', (a) => {
    const ids = [...new Set(a.p_transaction_ids as string[])];
    const listed = ids.map((id) => rows('transactions').find((t) => t.id === id));
    if (listed.some((t) => !t)) return rpcError('P0002', 'Transaction not found');
    const found = listed as Row[];
    const changed = found.filter((t) => t.is_deleted !== a.p_deleted);
    for (const tx of changed) {
      applyEffect(tx, a.p_deleted ? -1 : 1);
      tx.is_deleted = a.p_deleted;
      tx.updated_at = new Date().toISOString();
      fake.emit('transactions', tx);
    }
    const walletIds = new Set(found.flatMap((t) => [t.wallet_id, t.destination_wallet_id]).filter(Boolean));
    const debtIds = new Set(found.filter((t) => t.type === 'DEBT_REPAYMENT').map((t) => t.debt_id).filter(Boolean));
    return {
      data: {
        changed_ids: changed.map((t) => t.id),
        transactions: found.map((t) => ({ ...t })),
        balances: rows('wallets').filter((w) => walletIds.has(w.id)).map((w) => ({ id: w.id, balance: w.balance })),
        debts: rows('debts')
          .filter((d) => debtIds.has(d.id) && !d.is_deleted)
          .map((d) => ({ id: d.id, remaining_amount: d.remaining_amount, is_settled: d.is_settled })),
      },
      error: null,
    };
  });
```

Adjust only the casts `tsc` asks for; the behaviour stays as written.

B. In `describe('a project missing a ledger function (Phase 115, ADR 0091)')`, after `'a delete and a restore'`, add `'a bulk delete, with no fallback to the one-row function'`. Call `installLedgerRpcs()` and add `expense(200)`, then `landed`. `fake.state.rpcs.delete('set_transactions_deleted')` and clear the calls. `setTransactionsDeleted([added.txId!], true)` equals `UPDATE_NEEDED`. `writes('rpc:set_transactions_deleted', 'rpc')` has length 1, and `writes('rpc:set_transaction_deleted', 'rpc')` has length 0. `nothingWritten()` holds. Locally the row is live again and the wallet is `WALLET_OPENING - 200`.

C. A new `describe('a signed-in bulk delete and restore through set_transactions_deleted (ADR 0109)')` right after the `set_transaction_deleted` describe (ends `:1398`), with `beforeEach(() => installLedgerRpcs())`:

1. `deletes an expense and a repayment in one RPC, and restores both in another`. Do `expense(200)` and `repay(1000)`, each `landed`, then clear the calls. Bulk delete `[spent, paid]` returns `{ success: true }`. Exactly one `rpc:set_transactions_deleted` call is made, with payload `{ p_transaction_ids: [spent.txId, paid.txId], p_deleted: true }`. There are zero `rpc:set_transaction_deleted` calls and zero `update` writes to `wallets`, `debts` and `transactions`. The server wallet is `WALLET_OPENING` and the server debt is `DEBT_REMAINING`. Locally (`waitFor`), the wallet is `WALLET_OPENING`, the debt `DEBT_REMAINING`, and both rows are deleted. After a `setTimeout(0)`, a bulk restore `[spent, paid]` succeeds with one more RPC call. The server wallet is `WALLET_OPENING - 1200`, and locally the wallet is `WALLET_OPENING - 1200`, the debt `DEBT_REMAINING - 1000`, and both rows are live.
2. `F3: reverses relative to the balance the server holds`. After `expense(200)` lands, set `fake.state.tables.wallets[0].balance = 9000`. A bulk delete `[spent]` leaves the server wallet at 9200, and locally it becomes 9200.
3. `rolls back every row, and asks no one-row function, when the RPC rejects`. Do `expense(200)` and `repay(1000)`, each landed. Set the failure `rpc:set_transactions_deleted` to `{ message: 'permission denied for function', code: '42501' }` and clear the calls. The bulk delete returns `success: false`. There is one bulk call, zero one-row calls, and zero `update` writes to `wallets` and `transactions`. Locally: the wallet is `WALLET_OPENING - 1200`, the debt `DEBT_REMAINING - 1000`, and both rows are live.
4. `sends each id once and leaves a row already deleted alone`. Do `expense(200)` and `repay(1000)`, each landed. `softDeleteTransaction(spent)` succeeds; wait for it locally, then `setTimeout(0)` and clear the calls. Bulk delete `[spent, spent, paid]` succeeds. The payload is `{ p_transaction_ids: [spent.txId, paid.txId], p_deleted: true }`, and the server wallet is `WALLET_OPENING` (the 200 is not refunded twice).
5. `refuses an id it does not hold, before any request`. After `expense(200)` lands, clear the calls. Bulk delete `[spent, 'tx-never-existed']` equals `{ success: false, error: 'Transaction not found' }`. No `rpc:set_transactions_deleted` call is made, and the wallet is still `WALLET_OPENING - 200`.
6. `re-fetches instead of restoring a stale snapshot when a reload landed mid-flight (T69)`. This is the pattern of `:1257-1285` with a gate on `rpc:set_transactions_deleted` and the bulk delete of `[spent]`. The result is `success: false`, with at least one `wallets` select, and the wallet ends at 7777 with the row live.
7. `re-reads after an unknown outcome`. After `expense(200)` lands, `fake.state.lostResponses.add('set_transactions_deleted')`. The bulk delete `[spent]` returns `success: false`. The server wallet is `WALLET_OPENING`, and locally (`waitFor`) the wallet is `WALLET_OPENING` with the row deleted.

Why they fail today: `actions().setTransactionsDeleted` is undefined (TypeError) in B and in C1 to C7.

### 6.5 The red run

With section 6's test and probe edits in place and nothing else changed, run:

```
npx vitest run unit/migration-replay.test.ts unit/ledger-guards.test.tsx unit/authenticated-ledger.test.tsx 2>&1 | tee workflow/stages/02_build/output/logs/T812-red.log
```

Expected failures: 5 in `migration-replay` (items 1, 2 and 3, the Phase 149 before run and the Phase 149 after run), all 8 new tests in `ledger-guards` and all 8 new tests in `authenticated-ledger`, so 21 failed. Every existing test passes. Quote the command and the failure lines in the build report. If the count differs, say why before going on.

## 7. Gates

Changed paths and their tiers: `supabase/` (supabase tier); `src/context/` (context tier: the utils row plus specs); `src/utils/` (utils tier); `unit/` (unit tier); `AGENTS.md` and `docs/contexts/` (docs, with names and paths to check); money path (red run first, section 6.5). In order:

```
npm run lint
npx vitest run unit/migration-replay.test.ts unit/drift-runner.test.ts unit/migration-history.test.ts
npm run schema:drift
npx vitest run unit/ledger-guards.test.tsx unit/authenticated-ledger.test.tsx unit/auth-password.test.tsx unit/debts-page.test.tsx unit/security-headers.test.ts
npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T812-unit.log
npx playwright test tests/soft-delete.spec.ts tests/transaction.spec.ts tests/transaction-edit.spec.ts tests/debt-repayment.spec.ts --project=chromium 2>&1 | tee workflow/stages/02_build/output/logs/T812-e2e-chromium.log
npx playwright test tests/soft-delete.spec.ts tests/transaction.spec.ts tests/transaction-edit.spec.ts tests/debt-repayment.spec.ts 2>&1 | tee workflow/stages/02_build/output/logs/T812-e2e-all.log
```

- Before Playwright, check ports 3000 and 3100 for a stale dev server and stop any you started. Never edit `src/` while Playwright runs.
- `npm run schema:drift` replays offline and prints the read-only drift query. Exit 0 is the gate. Do not run the query anywhere, and do not use `--live`.
- Full unit: today 1560 tests in 71 files (T811). This task adds 4 in `migration-replay`, 8 in `ledger-guards` and 8 in `authenticated-ledger` and no new file, so about 1580 in 71. Report the real figures.
- The four specs exercise delete, restore, edit and repayment through `FinanceContext`. Nothing in the UI calls the new action yet; they show the file still behaves.
- Text landed: the migration and the probe match section 4.1 edit 1 and section 6.1 byte for byte apart from CRLF (compare with a script, not by eye). `git diff src/context/FinanceContext.tsx` shows only edits 3 to 5, with `setTransactionDeleted` (`:2081-2263`) unchanged. `git diff src/utils/zodSchemas.ts` shows only edit 2. `AGENTS.md` gains exactly one line. `supabase-ledger.md` changes three lines and `client-state.md` gains one.
- Docs check: every path the new `AGENTS.md` row names exists (`ls` the four). The "eleven" in `supabase-ledger.md:69` is the count the probe asserts in section 1.
- Owner files unchanged: `git hash-object docs/audit/decisions/0109-transactions-table-and-calendar-views.md docs/design/transactions-2026-10/spec.md` gives the same hashes before and after. Record them in the build report.
- Line endings: `git ls-files --eol` on every changed tracked file still shows `w/crlf`. For the two new files, a Node count of `\r\n` and of bare `\n` shows no bare `\n`.
- Em dashes: 0 in the added lines, checked with `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"`. Also 0 in the new files and the build report: `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" supabase/migrations/20261027_phase149_set_transactions_deleted.sql supabase/tests/20261027_phase149.probe.sql workflow/stages/02_build/output/task-T812-build.md`.
- Scope: `git status --porcelain` lists only section 2's files, the ledger and the build report.

## 8. Production touch points

The live Supabase project. The owner does this, by hand, after T812 is approved and committed and before the phase 149 branch merges to `main`. The function is additive and changes no existing one, but task 5's bulk bar calls it, and `supabase-ledger.md` "Ordering" says a function a client depends on is applied before that client deploys. No agent runs any of these steps.

1. **Apply.** Open the project's SQL editor. Paste the whole of `supabase/migrations/20261027_phase149_set_transactions_deleted.sql` from the phase branch and run it. Expect success with no rows.
2. **Record it**, in the same tab. Print the statement with `npm run migration:print-history -- supabase/migrations/20261027_phase149_set_transactions_deleted.sql` at the moment you apply, not ahead of time. Paste it and run. Expect one row back: the version, `phase149_set_transactions_deleted`, `owner, SQL editor`. It is idempotent: no row back means it was already recorded.
3. **Verify, read-only.** Run `npm run schema:drift` locally, paste the query it prints into the SQL editor and run it. Expect zero rows: the function's body hash, its grants and the history row all match the repo. For a spot check, this read-only query should return `true | {"search_path=public, pg_temp"} | false | true`:

   ```sql
   select p.prosecdef,
          p.proconfig,
          has_function_privilege('anon', p.oid, 'execute') as anon_can,
          has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can
     from pg_proc p
    where p.oid = 'public.set_transactions_deleted(uuid[], boolean)'::regprocedure;
   ```

4. **Advisor.** The security advisor will list one more "authenticated can execute a SECURITY DEFINER function" entry, eleven in all. It is accepted like the other ten (`supabase-ledger.md` Advisors). Nothing to fix.

Not part of these steps: running `supabase/tests/20261027_phase149.probe.sql` on live. It writes inside `BEGIN ... ROLLBACK`, and this task allows read-only live checks only; the unit suite runs it on the PGlite replay before and after the migration. Also not part of them: `npm run schema:drift -- --live` and the `schema-drift` workflow dispatch, which stay the owner's choice. If the function must ever be undone, the owner runs `drop function if exists public.set_transactions_deleted(uuid[], boolean);` and deletes its history row. No client depends on it until task 5 ships.

No `/api/*` request, no Vercel or GitHub change, no sign-in from a dev server.

## 9. Out of scope

- The selection UI, checkboxes, `Select` mode and the bulk bar, and exposing the action through `useTransactions` (task 5, which calls `setTransactionsDeleted`). The new Playwright spec and `DESIGN.md` (task 6).
- `set_transaction_deleted`, `_ledger_apply_effect`, `setTransactionDeleted`, `softDeleteTransaction`, `restoreTransaction`, `adoptLedgerState` and every other existing function, SQL or TypeScript. Do not make the one-row actions call the bulk one, and do not extract a shared helper from `setTransactionDeleted`: its single-row RPC and the tests pinning it stay as they are.
- The three older probes that count ten functions (`20261006_phase102`, `20261008_phase114`, `20261010_phase123`). They describe their own phase; the replay test runs them on the files before Phase 149 instead.
- `supabase/catalog.sql`, `supabase/replay/prelude.sql`, `scripts/`, `unit/drift-runner.test.ts`, `unit/migration-history.test.ts`.
- Bulk recategorize and bulk move-wallet (ADR 0109 D7: out). A size cap on the id list.
- ADR 0109 and the design spec (no content or line-ending edit), `refactor-log.md`, `baseline-metrics.md`, `README.md`, the test counts in `AGENTS.md`, the test-selector contract.
- The Backlog's `transfer_funds` replay finding (SL-01).
- Any live SQL, the `--live` drift check, a probe on live, any MCP or CLI write tool.
