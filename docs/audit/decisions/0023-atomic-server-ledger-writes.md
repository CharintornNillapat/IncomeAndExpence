# 0023 — Signed-in ledger writes run as atomic, relative, idempotent RPCs

**Status:** Accepted. **Extends** the `transfer_funds` pattern (`20260909_transfer_funds.sql`) to every other signed-in ledger write, **closes** the post-Phase-49 review's F3 and F4 (deferred by ADR `0022`), and **drops** a server function that was never in the repo.
**Date:** 2026-09-27

## Context

Only transfers are atomic today. Every other signed-in ledger write is a sequence of independent round-trips from the browser, with hand-written compensation for a failure part-way through:

| Write | Round-trips | What the server receives |
|---|---|---|
| `addTransaction` (EXPENSE / INCOME / ADJUSTMENT / DEBT_REPAYMENT) | insert → wallet update → debt update | `balance: walletsRef + delta` — an **absolute** value |
| `setTransactionDeleted` | wallet update(s) → debt update → flag update | absolute balances again |
| `commitBulkImport` | batch insert → one update per wallet | absolute balances again (ADR `0022` left this explicitly) |

Two defects follow, and the review named both:

- **F3 — absolute balance writes lose updates.** Two devices each read ฿5,000, each spend ฿200, and each writes ฿4,800. One expense vanishes from the balance while both ledger rows exist. The realtime reload does not help: it reloads the wrong number faithfully. The only cure is for the database to apply the *delta*, under a row lock, the way `transfer_funds` already does.
- **F4 — the insert is retry-unsafe.** The client arms an idempotency key per form and reuses it on retry, but the legacy insert does not look the key up. If the response is lost after the insert committed, the retry either hits a unique index (and the user sees a database error for a write that succeeded) or, on a project with only the partial index and a compensated row, writes the transaction twice.

A third problem is not a defect in any one write: **nothing reloads on wake or reconnect.** A phone that slept, or whose realtime socket dropped, shows stale balances until some unrelated change happens to fire a realtime event. Relative server writes make the server right; the client still has to go and look.

### What the live database actually contains

Before designing, the live project (`Income-Expense-db`) was inspected read-only. It does not match the repo:

1. **An untracked RPC, `public.create_ledger_transaction`.** It is in no migration, and `grep` finds no caller anywhere in the repo. It is granted to `authenticated`, so any signed-in user can call it. It contradicts two accepted ADRs:
   - it raises `INSUFFICIENT_FUNDS` when *any* debit would take a wallet below zero — ADR `0014` says an overdraft warns and never blocks, because a `CREDIT_CARD` wallet legitimately carries a negative balance;
   - it floors a debt overpayment with `greatest(0, …)` instead of rejecting it — ADR `0016` says a repayment may not exceed what is owed, at any layer;
   - its replay lookup and its `unique_violation` handler ignore `is_deleted`, unlike `transfer_funds`.
2. **Two idempotency indexes.** The repo's partial `transactions_user_idempotency_key_uniq (user_id, idempotency_key) where idempotency_key is not null and is_deleted = false`, **and** an untracked non-partial `transactions_user_idempotency_uidx (user_id, idempotency_key) where idempotency_key is not null`. In production a key on a soft-deleted row therefore still blocks reuse — `transfer_funds`' own comment ("a compensated transfer does not block a genuine retry") is false there.
3. `transactions.created_by` is `text` (default `'USER'`), not `uuid`.
4. `transfer_funds` matches the repo exactly (md5 of the function body, CRs stripped, identical on both sides).

## Decision: three RPCs and one private helper

Migration `supabase/migrations/20260927_ledger_rpcs.sql`. Every function is `language plpgsql`, `set search_path = public, pg_temp`, and takes its user from **`auth.uid()` alone** — there is no `p_user_id` parameter to spoof, and a null `auth.uid()` raises `28000`. The three RPCs are `security definer` (they must lock and update rows regardless of the RLS policy's shape), so each checks ownership explicitly: every wallet, debt, category and transaction lookup is filtered by `user_id = auth.uid()`. Grants: `revoke all … from public, anon`; `grant execute … to authenticated, service_role`.

### `_ledger_apply_effect(...)` — the one SQL implementation of the arithmetic

A private helper, revoked from every client role, called only by the three RPCs. It applies a transaction's effect with a sign `s` (`+1` apply, `-1` reverse) as **relative** updates, mirroring `addTransaction`/`setTransactionDeleted` term for term:

| Leg | Effect |
|---|---|
| source, EXPENSE / DEBT_REPAYMENT / TRANSFER | `balance = round(balance - s*amount, 2)` |
| source, INCOME / ADJUSTMENT | `balance = round(balance + s*amount, 2)` |
| destination, TRANSFER | `balance = round(balance + s*amount, 2)` |
| debt, DEBT_REPAYMENT with a live debt | `remaining = greatest(0, round(remaining - s*amount, 2))`, `is_settled = (remaining = 0)` |

There is **no upper cap** on a reversal (ADR `0016`), and **no overdraft check** at all (ADR `0014`). Callers lock every row the helper touches before calling it, in `id` order, so two opposing writes queue instead of deadlocking — the same rule `transfer_funds` follows.

### `record_transaction` — one non-transfer write

`record_transaction(p_wallet_id, p_amount, p_type, p_description, p_transaction_date, p_idempotency_key, p_category_id default null, p_debt_id default null, p_raw_input default null)` returns `{ reused, transaction, source_balance, dest_balance, debt_remaining, debt_settled }`.

**The order of its steps is load-bearing and mirrors ADR `0016`'s client ordering:**

1. **Validate.** Type is INCOME / EXPENSE / ADJUSTMENT / DEBT_REPAYMENT — a TRANSFER is rejected with a pointer to `transfer_funds`, so there is one transfer implementation, not two. Amount > 0, key present, a DEBT_REPAYMENT names a debt.
2. **Replay.** A row carrying this `(user_id, idempotency_key)` — **live or soft-deleted** — is returned as-is with `reused: true`, and nothing moves. This sits **before** the overpayment guard for the same reason the client's `existingTx` check sits before its guard: a retry of the payment that settled a debt must replay, not be rejected for exceeding a remainder its own first attempt drove to zero.
3. **Lock and resolve.** The source wallet `for update` (owned, live); the category must belong to the caller or be a system row (`user_id is null`) — the FK alone would accept another user's category.
4. **Overpayment guard (ADR `0016`).** For a DEBT_REPAYMENT, the debt is locked `for update` and `p_amount > remaining_amount` raises `DEBT_OVERPAYMENT` with the remaining balance in `detail`. The lock is what makes this authoritative: the client's guard runs against `debtsRef`, which can be stale against another device's payment; this one cannot.
5. **Apply** via the helper (`s = +1`), then **insert** the row.
6. **Race on the key.** A concurrent call with the same key that loses on the unique index returns the winner's row (`reused: true`) instead of an error — `transfer_funds`' handler, unchanged in intent.

**Replay matches any row, live or deleted, deliberately.** An idempotency key names one intent. If that intent committed and the user later deleted it, a retry carrying the same key must not resurrect it as a new row. This is also the only rule that behaves the same under both index sets found above: with the non-partial index a deleted row's key blocks a new insert anyway, and with only the partial index the lookup is what stops the duplicate.

### `set_transaction_deleted` — delete and restore, idempotent by state

`set_transaction_deleted(p_transaction_id, p_deleted)` returns `{ changed, transaction, source_balance, dest_balance, debt_remaining, debt_settled }`.

It locks the transaction row (owned). If `is_deleted` already equals `p_deleted` it returns `changed: false` and moves nothing — a retried delete is a no-op, so no key is needed. Otherwise it locks the wallets **regardless of their own `is_deleted`** (the client's reversal finds a wallet by id without an `!isDeleted` filter, and a soft-deleted wallet's balance still has to reverse) and skips a leg whose wallet no longer exists (`destination_wallet_id` is `ON DELETE SET NULL`). The debt moves only if it is live, as on the client. It applies the helper with `s = -1` to delete and `s = +1` to restore, then flips the flag.

### `import_transactions` — one atomic batch

`import_transactions(p_import_key, p_rows)` takes the rows the client has already resolved to ids — `[{ row_index, wallet_id, destination_wallet_id, category_id, amount, type, description, transaction_date }]` — and returns `{ reused, inserted_ids, balances: [{ id, balance }] }`.

Each row's key is `p_import_key || ':' || row_index`. Because the batch is all-or-nothing, the first row's key existing means the whole batch committed, and the call replays. Every row is validated and the distinct wallet set is locked in `id` order before anything is written; one bad row aborts the whole batch with its `row_index` in the message. Rows are inserted, deltas are aggregated per wallet in SQL, and **one relative update per wallet** is applied. A DEBT_REPAYMENT row carries no `debt_id`, exactly as today — it moves the wallet only.

**This is not deduplication** (ADR `0019`). The client arms one import key per *preview*: a retry of the same preview after a lost response replays; importing the same file again builds a new preview with a new key and produces a second set of rows, which is what `csv.spec.ts` asserts.

### `create_ledger_transaction` is dropped

The migration runs `drop function if exists public.create_ledger_transaction(uuid, numeric, text, text, date, text, uuid, uuid, uuid, text)`. Leaving it would keep a second server-side ledger writer, callable by any signed-in user, that enforces rules two accepted ADRs reject. Its full definition is preserved below, so the drop can be reversed by pasting it back. **Neither idempotency index is touched**: dropping the untracked non-partial one would weaken production's guarantee, and adding it to a repo-only project would fail on any key a compensated transfer left on a deleted row.

## Decision: the client applies server truth, and keeps the legacy fallback

`FinanceContext.tsx` keeps every client-side guard, in its current order, and keeps the optimistic update — the form still responds instantly. After it:

- **`addTransaction`** (non-TRANSFER, signed in) calls `record_transaction`. On success it replaces the row by id and sets the wallet balance and the debt's `remainingAmount`/`isSettled` **from the response** — the server's committed values, not the client's absolute arithmetic. A `DEBT_OVERPAYMENT` means the local debt was stale: roll back, reload, and return the client's own message built with `formatCurrencyAmount` from the `detail`. A success payload without a `transaction` is an unknown outcome — the RPC may already have committed — so it reloads rather than restoring a snapshot. Any other error rolls back as today; there is nothing remote to compensate.
- **`setTransactionDeleted`** calls `set_transaction_deleted` and applies the returned balances and debt the same way.
- **`commitBulkImport(rows, importKey?)`** calls `import_transactions`. `TransactionsView` arms the key when it builds a preview.
- **The legacy path stays, behind `isMissingRpcError()`**, exactly as it does for `transfer_funds`. It is what runs on a project without this migration, and Phase 50's F1/F2/F6 harness tests remain its regression guard, unedited. Any error other than a missing function must surface and roll back — never fall through to the legacy path, which would write a second time.

## Decision: reload on wake and on reconnect

Folded into the existing realtime effect, so one debounced reload serves every trigger, and gated on being signed in (guest mode and all 22 Playwright specs never reach it):

- `window` `online` → reload.
- `visibilitychange` to `visible` → reload only if the last clean load is older than 30 s. A phone toggles visibility constantly; a reload per unlock would be noise.
- The realtime channel reporting `SUBSCRIBED` after `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED` → reload. Postgres changes emitted while the socket was down are not replayed, so the only way to see them is to read.

ADR `0022`'s rule holds: a reload that reads nothing does not advance `cloudRevisionRef`. There is no offline write queue — a write attempted offline still fails and rolls back — and this ADR does not add one.

## Migration strategy

1. **Probe first, against the real schema, with nothing persisted.** `supabase/tests/20260927_ledger_rpcs.probe.sql` wraps the migration and an assertion block in `begin … rollback`: a throwaway user, wallets and a debt; each RPC's happy path; a relative update landing on a balance another writer moved; replay moving nothing; replay-before-guard on a settling payment; overpayment rejected; a deleted or foreign wallet rejected; delete → restore round-trip; an import aborted whole by one bad row; import replay. Postgres DDL is transactional, so the functions exist only inside the probe's transaction.
2. **Apply the migration**, as its own step and with explicit confirmation, then re-run the probe.
3. **Deploy the frontend.** CLAUDE.md's rule — apply a migration before the code that depends on it — still stands. The fallback makes the wrong order non-fatal (signed-in writes keep working, non-atomically), not correct.

Rollback: re-create `create_ledger_transaction` from the definition below and `drop function` the four new ones. The client falls back to the legacy path on its own as soon as the RPCs are missing.

## Consequences

- F3 and F4 are closed for every signed-in ledger write on a migrated project. `commitBulkImport`'s absolute balance writes, which ADR `0022` left, go with them.
- The ledger arithmetic now has two implementations, client and SQL, which must agree term for term. The client's is what the optimistic update shows; the server's is what commits, and the client adopts the server's numbers on every success. A divergence therefore shows as a balance that corrects itself after a write, not as silent drift — and the probe pins the SQL side.
- The unit harness proves the client's contract with a simulated RPC. It proves nothing about the SQL; the probe does, against the live schema.
- The fallback keeps the non-atomic path alive on an unmigrated project. That is a deliberate trade for safe deploy ordering, not an oversight.
- Deferred, by name: F7 (opening-balance ledger rows) and F8 (DEBT_REPAYMENT rows in CSV) to Phase 52 — both change what a ledger visibly contains, and `tests/helpers.ts` relies on a fresh context having no transactions. An offline write queue and a sync-status UI are not planned.

## Appendix: the dropped `create_ledger_transaction`, as it was in the live database

Captured with `pg_get_functiondef` on 2026-09-27, CRs stripped (the body was stored with CRLF line endings). `md5` of this text is `dbe22dc35e008951d7ea2cdf192bf347`, matching `md5(replace(pg_get_functiondef(oid), E'\r', ''))` on the live function. Its grants were `authenticated` and `service_role`.

```sql
CREATE OR REPLACE FUNCTION public.create_ledger_transaction(p_wallet_id uuid, p_amount numeric, p_type text, p_description text, p_transaction_date date, p_idempotency_key text DEFAULT NULL::text, p_destination_wallet_id uuid DEFAULT NULL::uuid, p_category_id uuid DEFAULT NULL::uuid, p_debt_id uuid DEFAULT NULL::uuid, p_raw_input text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id         uuid := auth.uid();
  v_existing        public.transactions%rowtype;
  v_tx              public.transactions%rowtype;
  v_delta           numeric;
  v_source_before   numeric;
  v_source_found    boolean := false;
  v_dest_found      boolean := false;
  v_locked          record;
  v_projected       numeric;
  v_source_balance  numeric;
  v_dest_balance    numeric := null;
  v_debt_remaining  numeric := null;
  v_debt_settled    boolean := null;
begin
  ---------------------------------------------------------------------------
  -- Guards. These mirror TransactionSchema in src/utils/zodSchemas.ts so the
  -- database rejects anything the client-side validation would have rejected,
  -- rather than relying on it.
  ---------------------------------------------------------------------------
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: no authenticated user' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT: amount must be greater than zero'
      using errcode = '22023';
  end if;

  if p_type is null or p_type not in
     ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'DEBT_REPAYMENT') then
    raise exception 'INVALID_TYPE: %', coalesce(p_type, 'null')
      using errcode = '22023';
  end if;

  if p_type = 'TRANSFER' then
    if p_destination_wallet_id is null then
      raise exception 'DESTINATION_REQUIRED: transfers need a destination wallet'
        using errcode = '22023';
    end if;
    if p_destination_wallet_id = p_wallet_id then
      raise exception 'DESTINATION_INVALID: source and destination must differ'
        using errcode = '22023';
    end if;
  end if;

  ---------------------------------------------------------------------------
  -- Idempotent replay: if this key already committed, return that result
  -- instead of applying the balance change a second time.
  ---------------------------------------------------------------------------
  if p_idempotency_key is not null then
    select * into v_existing
      from public.transactions
     where user_id = v_user_id
       and idempotency_key = p_idempotency_key;

    if found then
      select balance into v_source_balance
        from public.wallets where id = v_existing.wallet_id;

      if v_existing.destination_wallet_id is not null then
        select balance into v_dest_balance
          from public.wallets where id = v_existing.destination_wallet_id;
      end if;

      if v_existing.debt_id is not null then
        select remaining_amount, is_settled into v_debt_remaining, v_debt_settled
          from public.debts where id = v_existing.debt_id;
      end if;

      return jsonb_build_object(
        'transaction',     to_jsonb(v_existing),
        'source_balance',  v_source_balance,
        'dest_balance',    v_dest_balance,
        'debt_remaining',  v_debt_remaining,
        'debt_settled',    v_debt_settled,
        'replayed',        true
      );
    end if;
  end if;

  ---------------------------------------------------------------------------
  -- Lock the affected wallets, ordered by id so two concurrent transfers in
  -- opposite directions cannot deadlock. The lock is what makes the relative
  -- balance update below safe against the lost-update race, and it is also what
  -- makes the overdraft check below authoritative: no concurrent write can move
  -- the balance between the check and the debit.
  --
  -- The pre-read is deliberate. Both legs of a transfer are decided here, before
  -- anything is written, so a rejected transfer cannot leave the destination
  -- credited while the source is untouched.
  ---------------------------------------------------------------------------
  for v_locked in
    select id, balance
      from public.wallets
     where user_id = v_user_id
       and coalesce(is_deleted, false) = false
       and id in (p_wallet_id, coalesce(p_destination_wallet_id, p_wallet_id))
     order by id
       for update
  loop
    if v_locked.id = p_wallet_id then
      v_source_found  := true;
      v_source_before := coalesce(v_locked.balance, 0);
    end if;
    if v_locked.id = p_destination_wallet_id then
      v_dest_found := true;
    end if;
  end loop;

  if not v_source_found then
    raise exception 'WALLET_NOT_FOUND: source wallet % is missing, deleted, or not yours',
      p_wallet_id using errcode = '23503';
  end if;

  if p_type = 'TRANSFER' and not v_dest_found then
    raise exception 'WALLET_NOT_FOUND: destination wallet % is missing, deleted, or not yours',
      p_destination_wallet_id using errcode = '23503';
  end if;

  ---------------------------------------------------------------------------
  -- Signed effect on the source wallet. Signs match the client's optimistic
  -- arithmetic in FinanceContext.addTransaction. A TRANSFER debits the source
  -- here and credits the destination further down -- both legs always move.
  ---------------------------------------------------------------------------
  v_delta := case
    when p_type in ('EXPENSE', 'DEBT_REPAYMENT', 'TRANSFER') then -p_amount
    when p_type in ('INCOME', 'ADJUSTMENT')                  then  p_amount
    else 0
  end;

  ---------------------------------------------------------------------------
  -- Overdraft guard. Wallet balances in this app are plain positive holdings --
  -- totalNetWorth sums them directly -- so no transaction type may drive one
  -- below zero. Raised before any write, so the whole operation is refused
  -- rather than half-applied.
  ---------------------------------------------------------------------------
  if v_delta < 0 then
    v_projected := round((v_source_before + v_delta)::numeric, 2);

    if v_projected < 0 then
      raise exception 'INSUFFICIENT_FUNDS: wallet % cannot cover this %',
        p_wallet_id, lower(p_type)
        using errcode = 'P0001',
              detail  = format('available %s, required %s, short by %s',
                               to_char(v_source_before, 'FM999999999990.00'),
                               to_char(p_amount,        'FM999999999990.00'),
                               to_char(-v_projected,    'FM999999999990.00')),
              hint    = format('Available balance is %s but this %s needs %s.',
                               to_char(v_source_before, 'FM999999999990.00'),
                               replace(lower(p_type), '_', ' '),
                               to_char(p_amount,        'FM999999999990.00'));
    end if;
  end if;

  ---------------------------------------------------------------------------
  -- Source wallet: debit for EXPENSE / DEBT_REPAYMENT / TRANSFER, credit for
  -- INCOME / ADJUSTMENT.
  ---------------------------------------------------------------------------
  update public.wallets
     set balance    = round((balance + v_delta)::numeric, 2),
         updated_at = now()
   where id = p_wallet_id
     and user_id = v_user_id
     and coalesce(is_deleted, false) = false
   returning balance into v_source_balance;

  if not found then
    raise exception 'WALLET_NOT_FOUND: source wallet % is missing, deleted, or not yours',
      p_wallet_id using errcode = '23503';
  end if;

  ---------------------------------------------------------------------------
  -- Destination wallet: the credit leg of a transfer. Guarded by the same
  -- statement-level transaction as the debit above, so the pair is atomic.
  ---------------------------------------------------------------------------
  if p_type = 'TRANSFER' then
    update public.wallets
       set balance    = round((balance + p_amount)::numeric, 2),
           updated_at = now()
     where id = p_destination_wallet_id
       and user_id = v_user_id
       and coalesce(is_deleted, false) = false
     returning balance into v_dest_balance;

    if not found then
      raise exception 'WALLET_NOT_FOUND: destination wallet % is missing, deleted, or not yours',
        p_destination_wallet_id using errcode = '23503';
    end if;

    -- Defence in depth: the debit and the credit must be equal and opposite.
    -- If this ever trips, the arithmetic above drifted and the whole write is
    -- rolled back rather than committing a transfer that created or destroyed
    -- money.
    if v_source_balance <> round((v_source_before - p_amount)::numeric, 2) then
      raise exception 'LEDGER_IMBALANCE: source wallet % was not debited by %',
        p_wallet_id, p_amount using errcode = 'P0001';
    end if;
  end if;

  ---------------------------------------------------------------------------
  -- Debt paydown (repayments only).
  ---------------------------------------------------------------------------
  if p_type = 'DEBT_REPAYMENT' and p_debt_id is not null then
    update public.debts
       set remaining_amount = greatest(0, round((remaining_amount - p_amount)::numeric, 2)),
           is_settled       = greatest(0, round((remaining_amount - p_amount)::numeric, 2)) = 0,
           updated_at       = now()
     where id = p_debt_id
       and user_id = v_user_id
       and coalesce(is_deleted, false) = false
     returning remaining_amount, is_settled into v_debt_remaining, v_debt_settled;

    if not found then
      raise exception 'DEBT_NOT_FOUND: debt % is missing, deleted, or not yours',
        p_debt_id using errcode = '23503';
    end if;
  end if;

  ---------------------------------------------------------------------------
  -- The transaction row itself. Written last so that if any balance update
  -- above raised, no ledger row exists -- the failure mode the client-side
  -- rollback could not previously guarantee.
  ---------------------------------------------------------------------------
  insert into public.transactions (
    user_id, wallet_id, destination_wallet_id, category_id, debt_id,
    amount, type, description, raw_input, transaction_date,
    idempotency_key, is_deleted, created_by
  ) values (
    v_user_id, p_wallet_id, p_destination_wallet_id, p_category_id, p_debt_id,
    round(p_amount::numeric, 2), p_type, p_description, p_raw_input, p_transaction_date,
    p_idempotency_key, false, v_user_id
  )
  returning * into v_tx;

  return jsonb_build_object(
    'transaction',     to_jsonb(v_tx),
    'source_balance',  v_source_balance,
    'dest_balance',    v_dest_balance,
    'debt_remaining',  v_debt_remaining,
    'debt_settled',    v_debt_settled,
    'replayed',        false
  );

exception
  -- Two devices racing on the same idempotency key: the loser reads the winner's
  -- committed row and reports success rather than surfacing a constraint error.
  when unique_violation then
    select * into v_existing
      from public.transactions
     where user_id = v_user_id
       and idempotency_key = p_idempotency_key;

    if found then
      return jsonb_build_object(
        'transaction', to_jsonb(v_existing),
        'replayed',    true
      );
    end if;
    raise;
end;
$function$
```
