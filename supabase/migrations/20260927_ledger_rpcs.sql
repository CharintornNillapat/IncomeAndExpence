-- =============================================================================
-- Atomic, relative, idempotent ledger writes (ADR 0023)
--
-- Before this migration only transfers were atomic (`transfer_funds`). Every
-- other signed-in ledger write was a sequence of round-trips from the browser -
-- insert, then wallet update, then debt update - and every balance it sent was
-- an ABSOLUTE value the client computed from its own copy of the wallet. Two
-- devices spending from the same wallet at once each wrote their own total and
-- one expense vanished from the balance (the review's F3). The insert also never
-- looked its idempotency key up, so a retry after a lost response could fail on
-- the unique index or write twice (F4).
--
-- This migration moves those writes into three RPCs that lock the rows they
-- touch, apply RELATIVE updates, and replay on the idempotency key:
--
--   record_transaction      one INCOME / EXPENSE / ADJUSTMENT / DEBT_REPAYMENT
--   set_transaction_deleted soft-delete or restore, reversing / reapplying it
--   import_transactions     one CSV import, all rows or none
--
-- Transfers stay on `transfer_funds` (20260909), unchanged.
--
-- It also DROPS `create_ledger_transaction`, a function that existed in the live
-- database but in no migration, with no caller in the app. It blocked every
-- overdraft (ADR 0014 says an overdraft warns and never blocks) and floored a
-- debt overpayment instead of rejecting it (ADR 0016). Its full definition is
-- preserved verbatim in docs/audit/decisions/0023-atomic-server-ledger-writes.md.
--
-- APPLY THIS BEFORE DEPLOYING THE FRONTEND THAT CALLS IT. The client falls back
-- to its legacy non-atomic path when these functions are missing (the same
-- `isMissingRpcError` check `transfer_funds` uses), so the wrong order is not
-- fatal - but it is not atomic either.
--
-- Verify with supabase/tests/20260927_ledger_rpcs.probe.sql, which runs this
-- file and its assertions inside BEGIN ... ROLLBACK.
--
-- Assumed existing schema (this repo has no schema file; confirmed read-only
-- against the live project on 2026-09-27):
--   wallets(id uuid pk, user_id uuid, balance numeric, is_deleted bool, ...)
--   debts(id uuid pk, user_id uuid, remaining_amount numeric, is_settled bool,
--         is_deleted bool, updated_at timestamptz, ...)
--   categories(id uuid pk, user_id uuid null, ...)   -- null user_id = system row
--   transactions(id uuid pk, user_id uuid, wallet_id uuid, destination_wallet_id
--         uuid, category_id uuid, debt_id uuid, amount numeric, type text,
--         description text not null, raw_input text, transaction_date date,
--         idempotency_key text, is_deleted bool, created_by TEXT, ...)
--   `created_by` is text, not uuid - every insert below casts.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. The untracked twin goes first, so there is never a moment with two
--    server-side ledger writers that disagree about overdrafts.
-- -----------------------------------------------------------------------------
drop function if exists public.create_ledger_transaction(uuid, numeric, text, text, date, text, uuid, uuid, uuid, text);


-- -----------------------------------------------------------------------------
-- 1. Private helpers. None of these is callable by a client role (grants at the
--    bottom). They run with the privileges of the SECURITY DEFINER RPC that
--    calls them.
-- -----------------------------------------------------------------------------

-- The sign a transaction type applies to its SOURCE wallet. One table, used by
-- both the per-row helper and the import's per-wallet aggregation, so the two
-- cannot drift. Mirrors `addTransaction`'s optimistic arithmetic.
create or replace function public._ledger_source_sign(p_type text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_type in ('EXPENSE', 'DEBT_REPAYMENT', 'TRANSFER') then -1
    when p_type in ('INCOME', 'ADJUSTMENT')                  then  1
  end;
$$;


-- Applies one transaction's effect, as RELATIVE updates, with p_sign = +1 to
-- apply and -1 to reverse. The single SQL implementation of the ledger
-- arithmetic; it mirrors `addTransaction` / `setTransactionDeleted` term for
-- term (ADR 0023):
--   source       balance +/- amount by `_ledger_source_sign`
--   destination  balance + amount, TRANSFER only
--   debt         remaining - amount, floored at 0, DEBT_REPAYMENT with a LIVE
--                debt only. No upper cap on a reversal (ADR 0016).
-- There is deliberately NO overdraft check: a CREDIT_CARD wallet carries a
-- negative balance (ADR 0014).
--
-- The caller must already hold row locks on everything this touches. Wallets are
-- matched by id and owner only - NOT by `is_deleted` - because reversing a
-- transaction on a since-deleted wallet must still reverse its balance, exactly
-- as the client's reversal does. A missing leg (a null id, or no matching row)
-- is skipped and reported as null.
create or replace function public._ledger_apply_effect(
  p_user_id        uuid,
  p_wallet_id      uuid,
  p_dest_wallet_id uuid,
  p_debt_id        uuid,
  p_type           text,
  p_amount         numeric,
  p_sign           integer
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_source_sign    integer := public._ledger_source_sign(p_type);
  v_source_balance numeric;
  v_dest_balance   numeric;
  v_debt_remaining numeric;
  v_debt_settled   boolean;
begin
  if v_source_sign is null then
    raise exception 'Unknown transaction type %', coalesce(p_type, 'null')
      using errcode = '22023';
  end if;

  if p_sign not in (1, -1) then
    raise exception 'Ledger effect sign must be 1 or -1' using errcode = '22023';
  end if;

  if p_wallet_id is not null then
    update public.wallets
       set balance    = round(balance + p_sign * v_source_sign * p_amount, 2),
           updated_at = now()
     where id = p_wallet_id
       and user_id = p_user_id
     returning balance into v_source_balance;
  end if;

  if p_type = 'TRANSFER' and p_dest_wallet_id is not null then
    update public.wallets
       set balance    = round(balance + p_sign * p_amount, 2),
           updated_at = now()
     where id = p_dest_wallet_id
       and user_id = p_user_id
     returning balance into v_dest_balance;
  end if;

  if p_type = 'DEBT_REPAYMENT' and p_debt_id is not null then
    -- Both SET expressions read the pre-update row, so `is_settled` is computed
    -- from the same new remainder that is written.
    update public.debts
       set remaining_amount = greatest(0, round(remaining_amount - p_sign * p_amount, 2)),
           is_settled       = greatest(0, round(remaining_amount - p_sign * p_amount, 2)) = 0,
           updated_at       = now()
     where id = p_debt_id
       and user_id = p_user_id
       and is_deleted = false
     returning remaining_amount, is_settled into v_debt_remaining, v_debt_settled;
  end if;

  return jsonb_build_object(
    'source_balance', v_source_balance,
    'dest_balance',   v_dest_balance,
    'debt_remaining', v_debt_remaining,
    'debt_settled',   v_debt_settled
  );
end;
$$;


-- A transaction row plus the CURRENT state of everything it touches. What a
-- replay or a no-op returns: the caller gets the same shape as a fresh write,
-- with the balances as they stand now rather than as they stood when the
-- original write committed.
create or replace function public._ledger_row_state(p_tx public.transactions)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'transaction',    to_jsonb(p_tx),
    'source_balance', (select w.balance from public.wallets w
                        where w.id = p_tx.wallet_id and w.user_id = p_tx.user_id),
    'dest_balance',   (select w.balance from public.wallets w
                        where w.id = p_tx.destination_wallet_id and w.user_id = p_tx.user_id),
    'debt_remaining', (select d.remaining_amount from public.debts d
                        where d.id = p_tx.debt_id and d.user_id = p_tx.user_id),
    'debt_settled',   (select d.is_settled from public.debts d
                        where d.id = p_tx.debt_id and d.user_id = p_tx.user_id)
  );
$$;


-- What an import replay returns: every row the import key produced, and the
-- current balance of every wallet those rows touch.
create or replace function public._ledger_import_state(p_user_id uuid, p_import_key text)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with rows as (
    select t.id, t.wallet_id, t.destination_wallet_id
      from public.transactions t
     where t.user_id = p_user_id
       and left(t.idempotency_key, length(p_import_key) + 1) = p_import_key || ':'
  ),
  wallet_ids as (
    select wallet_id as id from rows
    union
    select destination_wallet_id from rows where destination_wallet_id is not null
  )
  select jsonb_build_object(
    'inserted_ids', coalesce((select jsonb_agg(r.id) from rows r), '[]'::jsonb),
    'balances',     coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'balance', w.balance))
                                from public.wallets w
                               where w.user_id = p_user_id
                                 and w.id in (select id from wallet_ids)), '[]'::jsonb)
  );
$$;


-- -----------------------------------------------------------------------------
-- 2. record_transaction
--
-- Returns jsonb:
--   { reused, transaction, source_balance, dest_balance, debt_remaining, debt_settled }
--
-- THE ORDER OF THESE STEPS IS LOAD-BEARING, and mirrors `addTransaction`'s own
-- ordering (ADR 0016): replay BEFORE the overpayment guard, so retrying the
-- payment that settled a debt returns the original row instead of being
-- rejected for exceeding the zero remainder its own first attempt produced.
-- -----------------------------------------------------------------------------
create or replace function public.record_transaction(
  p_wallet_id        uuid,
  p_amount           numeric,
  p_type             text,
  p_description      text,
  p_transaction_date date,
  p_idempotency_key  text,
  p_category_id      uuid default null,
  p_debt_id          uuid default null,
  p_raw_input        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_existing public.transactions%rowtype;
  v_wallet   public.wallets%rowtype;
  v_debt     public.debts%rowtype;
  v_tx       public.transactions%rowtype;
  v_amount   numeric;
  v_effect   jsonb;
begin
  -- Authorisation. The user comes from the JWT and nowhere else: there is no
  -- user-id parameter to spoof. SECURITY DEFINER bypasses RLS, so every lookup
  -- below is filtered by owner explicitly.
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;

  -- 1. Validate.
  if p_type = 'TRANSFER' then
    raise exception 'Transfers are recorded by transfer_funds, not record_transaction'
      using errcode = '22023';
  end if;
  if p_type is null or p_type not in ('INCOME', 'EXPENSE', 'ADJUSTMENT', 'DEBT_REPAYMENT') then
    raise exception 'Unknown transaction type %', coalesce(p_type, 'null')
      using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'An idempotency key is required' using errcode = '22023';
  end if;
  if p_transaction_date is null then
    raise exception 'A transaction date is required' using errcode = '22023';
  end if;
  if p_type = 'DEBT_REPAYMENT' and p_debt_id is null then
    raise exception 'A debt repayment must name a debt' using errcode = '22023';
  end if;

  v_amount := round(p_amount, 2);

  -- 2. Replay. Matches ANY row carrying the key, live or soft-deleted: a key
  --    names one intent, and a retry of an intent the user has since deleted
  --    must not resurrect it as a new row. A live row wins if both exist.
  select * into v_existing
    from public.transactions
   where user_id = v_uid
     and idempotency_key = p_idempotency_key
   order by is_deleted asc, created_at asc
   limit 1;

  if found then
    return jsonb_build_object('reused', true) || public._ledger_row_state(v_existing);
  end if;

  -- 3. Lock and resolve.
  select * into v_wallet
    from public.wallets
   where id = p_wallet_id
     and user_id = v_uid
     and is_deleted = false
     for update;

  if not found then
    raise exception 'Source wallet not found or has been deleted' using errcode = 'P0002';
  end if;

  -- The foreign key alone would accept another user's category. A system row
  -- (null user_id) is fine. Deleted categories are accepted, as the client does.
  if p_category_id is not null and not exists (
    select 1 from public.categories c
     where c.id = p_category_id
       and (c.user_id = v_uid or c.user_id is null)
  ) then
    raise exception 'Category not found' using errcode = 'P0002';
  end if;

  -- 4. Overpayment guard (ADR 0016). The lock is what makes this authoritative:
  --    the client's guard runs against its own copy of the debt, which can be
  --    stale against another device's payment; this one cannot.
  if p_debt_id is not null then
    select * into v_debt
      from public.debts
     where id = p_debt_id
       and user_id = v_uid
       and is_deleted = false
       for update;

    if not found then
      raise exception 'Debt goal not found or has been deleted' using errcode = 'P0002';
    end if;

    if p_type = 'DEBT_REPAYMENT' and v_amount > v_debt.remaining_amount then
      -- The client matches on this exact message and formats its own text from
      -- `detail` with formatCurrencyAmount - money is never formatted in SQL.
      raise exception 'DEBT_OVERPAYMENT'
        using errcode = 'P0001',
              detail  = v_debt.remaining_amount::text;
    end if;
  end if;

  -- 5. Apply, then insert.
  v_effect := public._ledger_apply_effect(
    v_uid, v_wallet.id, null,
    case when p_type = 'DEBT_REPAYMENT' then v_debt.id end,
    p_type, v_amount, 1
  );

  insert into public.transactions (
    user_id, wallet_id, destination_wallet_id, category_id, debt_id,
    amount, type, description, raw_input, transaction_date,
    idempotency_key, is_deleted, created_by
  ) values (
    v_uid, v_wallet.id, null, p_category_id, p_debt_id,
    v_amount, p_type, p_description, nullif(btrim(coalesce(p_raw_input, '')), ''), p_transaction_date,
    p_idempotency_key, false, v_uid::text
  )
  returning * into v_tx;

  return jsonb_build_object('reused', false, 'transaction', to_jsonb(v_tx)) || v_effect;

exception
  -- 6. Two concurrent calls with the same key can both pass step 2. The loser
  --    hits the unique index; this block's balance updates roll back with it,
  --    and it returns the winner's row instead of an error.
  when unique_violation then
    select * into v_existing
      from public.transactions
     where user_id = v_uid
       and idempotency_key = p_idempotency_key
     order by is_deleted asc, created_at asc
     limit 1;

    if not found then
      raise;
    end if;

    return jsonb_build_object('reused', true) || public._ledger_row_state(v_existing);
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. set_transaction_deleted
--
-- Returns jsonb:
--   { changed, transaction, source_balance, dest_balance, debt_remaining, debt_settled }
--
-- Idempotent by state, so it needs no key: asking for the state the row is
-- already in returns `changed: false` and moves nothing.
-- -----------------------------------------------------------------------------
create or replace function public.set_transaction_deleted(
  p_transaction_id uuid,
  p_deleted        boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_tx     public.transactions%rowtype;
  v_effect jsonb;
begin
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if p_transaction_id is null or p_deleted is null then
    raise exception 'A transaction id and a target state are required' using errcode = '22023';
  end if;

  -- Lock order everywhere in this file: transaction, then wallets by id, then
  -- debt. Every writer takes them in that order, so none can deadlock another.
  select * into v_tx
    from public.transactions
   where id = p_transaction_id
     and user_id = v_uid
     for update;

  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;

  if v_tx.is_deleted = p_deleted then
    return jsonb_build_object('changed', false) || public._ledger_row_state(v_tx);
  end if;

  -- Wallets are locked regardless of their own `is_deleted`: a transaction on a
  -- since-deleted wallet still reverses that wallet's balance. PERFORM runs the
  -- query to completion, so every matching row is locked.
  perform 1
     from public.wallets
    where user_id = v_uid
      and id in (v_tx.wallet_id, v_tx.destination_wallet_id)
    order by id
      for update;

  if v_tx.type = 'DEBT_REPAYMENT' and v_tx.debt_id is not null then
    perform 1
       from public.debts
      where id = v_tx.debt_id
        and user_id = v_uid
        and is_deleted = false
        for update;
  end if;

  -- Deleting reverses the effect (-1); restoring reapplies it (+1).
  v_effect := public._ledger_apply_effect(
    v_uid, v_tx.wallet_id, v_tx.destination_wallet_id, v_tx.debt_id,
    v_tx.type, v_tx.amount,
    case when p_deleted then -1 else 1 end
  );

  update public.transactions
     set is_deleted = p_deleted,
         updated_at = now()
   where id = v_tx.id
  returning * into v_tx;

  return jsonb_build_object('changed', true, 'transaction', to_jsonb(v_tx)) || v_effect;
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. import_transactions
--
-- p_rows: [{ row_index, wallet_id, destination_wallet_id, category_id, amount,
--            type, description, transaction_date }]  - ids already resolved by
--            the client from wallet and category names.
--
-- Returns jsonb:
--   { reused, inserted_ids, balances: [{ id, balance }] }
--
-- All rows or none. Each row's key is `p_import_key || ':' || row_index`, so the
-- first row's key existing means the whole batch already committed.
--
-- This is NOT deduplication (ADR 0019): the client arms one key per import
-- PREVIEW. A retry of the same preview replays; importing the same file again
-- builds a new preview with a new key and writes a second set of rows.
-- -----------------------------------------------------------------------------
create or replace function public.import_transactions(
  p_import_key text,
  p_rows       jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_row        jsonb;
  v_index      integer;
  v_type       text;
  v_amount     numeric;
  v_wallet_id  uuid;
  v_dest_id    uuid;
  v_cat_id     uuid;
  v_wallet_ids uuid[] := '{}';
  v_first_key  text;
begin
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if p_import_key is null or btrim(p_import_key) = '' then
    raise exception 'An import key is required' using errcode = '22023';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'An import needs at least one row' using errcode = '22023';
  end if;

  -- Replay.
  v_first_key := p_import_key || ':' || (p_rows -> 0 ->> 'row_index');
  if exists (
    select 1 from public.transactions
     where user_id = v_uid
       and idempotency_key = v_first_key
  ) then
    return jsonb_build_object('reused', true) || public._ledger_import_state(v_uid, p_import_key);
  end if;

  -- Validate every row's shape before touching anything.
  if (select count(distinct r ->> 'row_index') from jsonb_array_elements(p_rows) r)
     <> jsonb_array_length(p_rows) then
    raise exception 'Import rows must have distinct row_index values' using errcode = '22023';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_index     := (v_row ->> 'row_index')::integer;
    v_type      := v_row ->> 'type';
    v_amount    := round((v_row ->> 'amount')::numeric, 2);
    v_wallet_id := (v_row ->> 'wallet_id')::uuid;
    v_dest_id   := nullif(v_row ->> 'destination_wallet_id', '')::uuid;

    if v_index is null then
      raise exception 'Import row is missing its row_index' using errcode = '22023';
    end if;
    if public._ledger_source_sign(v_type) is null then
      raise exception 'Row %: unknown transaction type %', v_index, coalesce(v_type, 'null')
        using errcode = '22023';
    end if;
    if v_amount is null or v_amount <= 0 then
      raise exception 'Row %: amount must be greater than zero', v_index using errcode = '22023';
    end if;
    if v_wallet_id is null then
      raise exception 'Row %: a wallet is required', v_index using errcode = '22023';
    end if;
    if v_type = 'TRANSFER' and (v_dest_id is null or v_dest_id = v_wallet_id) then
      raise exception 'Row %: a transfer needs a distinct destination wallet', v_index
        using errcode = '22023';
    end if;
    if (v_row ->> 'transaction_date') is null then
      raise exception 'Row %: a transaction date is required', v_index using errcode = '22023';
    end if;

    v_wallet_ids := v_wallet_ids || v_wallet_id;
    if v_dest_id is not null then
      v_wallet_ids := v_wallet_ids || v_dest_id;
    end if;
  end loop;

  -- Lock every wallet the batch touches, in id order, before any write.
  perform 1
     from public.wallets
    where user_id = v_uid
      and id = any(v_wallet_ids)
    order by id
      for update;

  -- Insert, checking ownership per row so a failure names the row.
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_index     := (v_row ->> 'row_index')::integer;
    v_wallet_id := (v_row ->> 'wallet_id')::uuid;
    v_dest_id   := nullif(v_row ->> 'destination_wallet_id', '')::uuid;
    v_cat_id    := nullif(v_row ->> 'category_id', '')::uuid;

    if not exists (
      select 1 from public.wallets
       where id = v_wallet_id and user_id = v_uid and is_deleted = false
    ) or (v_dest_id is not null and not exists (
      select 1 from public.wallets
       where id = v_dest_id and user_id = v_uid and is_deleted = false
    )) then
      raise exception 'Row %: wallet not found or has been deleted', v_index using errcode = 'P0002';
    end if;

    if v_cat_id is not null and not exists (
      select 1 from public.categories c
       where c.id = v_cat_id
         and (c.user_id = v_uid or c.user_id is null)
    ) then
      raise exception 'Row %: category not found', v_index using errcode = 'P0002';
    end if;

    insert into public.transactions (
      user_id, wallet_id, destination_wallet_id, category_id,
      amount, type, description, transaction_date,
      idempotency_key, is_deleted, created_by
    ) values (
      v_uid, v_wallet_id, v_dest_id, v_cat_id,
      round((v_row ->> 'amount')::numeric, 2),
      v_row ->> 'type',
      coalesce(v_row ->> 'description', ''),
      (v_row ->> 'transaction_date')::date,
      p_import_key || ':' || v_index,
      false, v_uid::text
    );
  end loop;

  -- One relative update per wallet, from the same sign table the per-row helper
  -- uses. A DEBT_REPAYMENT row carries no debt, as before: it moves the wallet
  -- only.
  with deltas as (
    select (r ->> 'wallet_id')::uuid as wallet_id,
           public._ledger_source_sign(r ->> 'type') * round((r ->> 'amount')::numeric, 2) as delta
      from jsonb_array_elements(p_rows) r
    union all
    select (r ->> 'destination_wallet_id')::uuid,
           round((r ->> 'amount')::numeric, 2)
      from jsonb_array_elements(p_rows) r
     where r ->> 'type' = 'TRANSFER'
  ),
  per_wallet as (
    select wallet_id, sum(delta) as delta from deltas group by wallet_id
  )
  update public.wallets w
     set balance    = round(w.balance + pw.delta, 2),
         updated_at = now()
    from per_wallet pw
   where w.id = pw.wallet_id
     and w.user_id = v_uid;

  return jsonb_build_object('reused', false) || public._ledger_import_state(v_uid, p_import_key);

exception
  -- A concurrent retry of the same import that loses on the unique index
  -- returns the winner's result; anything else surfaces.
  when unique_violation then
    if exists (
      select 1 from public.transactions
       where user_id = v_uid
         and idempotency_key = v_first_key
    ) then
      return jsonb_build_object('reused', true) || public._ledger_import_state(v_uid, p_import_key);
    end if;
    raise;
end;
$$;


-- -----------------------------------------------------------------------------
-- 5. Grants. Supabase's default privileges grant EXECUTE on new public functions
--    to anon and authenticated, so every revoke here is explicit.
--    Helpers: no client role at all. RPCs: signed-in callers only.
-- -----------------------------------------------------------------------------
revoke all on function public._ledger_source_sign(text) from public, anon, authenticated, service_role;
revoke all on function public._ledger_apply_effect(uuid, uuid, uuid, uuid, text, numeric, integer) from public, anon, authenticated, service_role;
revoke all on function public._ledger_row_state(public.transactions) from public, anon, authenticated, service_role;
revoke all on function public._ledger_import_state(uuid, text) from public, anon, authenticated, service_role;

revoke all on function public.record_transaction(uuid, numeric, text, text, date, text, uuid, uuid, text) from public, anon;
revoke all on function public.set_transaction_deleted(uuid, boolean) from public, anon;
revoke all on function public.import_transactions(text, jsonb) from public, anon;

grant execute on function public.record_transaction(uuid, numeric, text, text, date, text, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.set_transaction_deleted(uuid, boolean) to authenticated, service_role;
grant execute on function public.import_transactions(text, jsonb) to authenticated, service_role;
