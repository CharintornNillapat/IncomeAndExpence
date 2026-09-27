-- =============================================================================
-- Phase 52: security hardening, real sessions, signed adjustments, opening
-- balances, and debt-aware CSV imports (ADR 0024)
--
--   1. handle_new_user   - pinned search_path; EXECUTE revoked from PUBLIC,
--                          anon and authenticated; granted to the auth service.
--   2. wallets.idempotency_key + create_wallet
--                        - a wallet and its signed "Opening balance" row in one
--                          transaction, replayable (F7).
--   3. record_transaction / import_transactions
--                        - an ADJUSTMENT amount may be negative (the balance
--                          editor could only ever raise a balance); every other
--                          type stays > 0. import_transactions also takes a
--                          per-row debt_id, guarded and decremented (F8).
--   4. list_my_sessions  - the caller's real sessions from auth.sessions.
--
-- record_transaction and import_transactions are re-created from the bodies
-- deployed by 20260927_ledger_rpcs.sql (md5-verified against the live database
-- before editing). Their only changes are marked "Phase 52" below.
--
-- APPLY BEFORE DEPLOYING THE FRONTEND THAT CALLS create_wallet /
-- list_my_sessions / a row debt_id. Every one of those has a missing-function
-- fallback in the client, so the wrong order degrades rather than breaks.
--
-- Verify with supabase/tests/20260928_phase52.probe.sql (BEGIN ... ROLLBACK).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. handle_new_user
--
-- The on_auth_user_created trigger's function was SECURITY DEFINER with no
-- search_path, and callable by anyone as /rest/v1/rpc/handle_new_user.
-- supabase_auth_admin - the role that inserts into auth.users - held EXECUTE
-- only through PUBLIC, so the explicit grant below is what keeps the revoke
-- from reaching it. (PostgreSQL checks EXECUTE on a trigger function when the
-- trigger is created, not when it fires; the grant is belt and braces.)
-- -----------------------------------------------------------------------------
alter function public.handle_new_user() set search_path = public, pg_temp;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;


-- -----------------------------------------------------------------------------
-- 2. Wallet creation with an opening-balance row (F7)
--
-- A wallet created with no opening balance writes no ledger row, so a replay
-- needs somewhere else to find "this key already made a wallet": a nullable
-- key on the wallet itself, unique per user where set. Existing rows stay null.
-- -----------------------------------------------------------------------------
alter table public.wallets add column if not exists idempotency_key text;

create unique index if not exists wallets_user_idempotency_key_uniq
  on public.wallets (user_id, idempotency_key)
  where idempotency_key is not null;


-- Returns jsonb: { reused, wallet, transaction }  (transaction is null when the
-- opening balance is zero).
--
-- The wallet is inserted at 0 and the opening balance arrives through
-- `_ledger_apply_effect` as a signed ADJUSTMENT, so the balance is explained by
-- a ledger row from the first moment it exists - the same path every later
-- change takes. A credit card that opens owing money gets a negative row.
create or replace function public.create_wallet(
  p_name             text,
  p_type             text,
  p_currency         text,
  p_color            text,
  p_icon             text,
  p_opening_balance  numeric,
  p_opening_date     date,
  p_idempotency_key  text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_wallet  public.wallets%rowtype;
  v_tx      public.transactions%rowtype;
  v_opening numeric := round(coalesce(p_opening_balance, 0), 2);
begin
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'A wallet name is required' using errcode = '22023';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'An idempotency key is required' using errcode = '22023';
  end if;
  -- A calendar day comes from the client, never current_date: the server runs
  -- in UTC and the app's days are local (UTC+7).
  if v_opening <> 0 and p_opening_date is null then
    raise exception 'An opening balance needs a date' using errcode = '22023';
  end if;

  -- Replay.
  select * into v_wallet
    from public.wallets
   where user_id = v_uid
     and idempotency_key = p_idempotency_key;

  if found then
    select * into v_tx
      from public.transactions
     where user_id = v_uid
       and idempotency_key = 'opening:' || p_idempotency_key;
    return jsonb_build_object(
      'reused',      true,
      'wallet',      to_jsonb(v_wallet),
      'transaction', case when v_tx.id is null then null else to_jsonb(v_tx) end
    );
  end if;

  insert into public.wallets (
    user_id, name, type, currency, balance, color, icon,
    is_archived, is_deleted, idempotency_key
  ) values (
    v_uid, btrim(p_name), p_type, coalesce(p_currency, 'THB'), 0,
    coalesce(p_color, 'stone'), coalesce(p_icon, 'wallet'),
    false, false, p_idempotency_key
  )
  returning * into v_wallet;

  if v_opening <> 0 then
    insert into public.transactions (
      user_id, wallet_id, amount, type, description, transaction_date,
      idempotency_key, is_deleted, created_by
    ) values (
      v_uid, v_wallet.id, v_opening, 'ADJUSTMENT', 'Opening balance', p_opening_date,
      'opening:' || p_idempotency_key, false, v_uid::text
    )
    returning * into v_tx;

    perform public._ledger_apply_effect(v_uid, v_wallet.id, null, null, 'ADJUSTMENT', v_opening, 1);

    select * into v_wallet from public.wallets where id = v_wallet.id;
  end if;

  return jsonb_build_object(
    'reused',      false,
    'wallet',      to_jsonb(v_wallet),
    'transaction', case when v_tx.id is null then null else to_jsonb(v_tx) end
  );

exception
  -- A concurrent retry with the same key: return the winner's wallet.
  when unique_violation then
    select * into v_wallet
      from public.wallets
     where user_id = v_uid
       and idempotency_key = p_idempotency_key;
    if not found then
      raise;
    end if;
    select * into v_tx
      from public.transactions
     where user_id = v_uid
       and idempotency_key = 'opening:' || p_idempotency_key;
    return jsonb_build_object(
      'reused',      true,
      'wallet',      to_jsonb(v_wallet),
      'transaction', case when v_tx.id is null then null else to_jsonb(v_tx) end
    );
end;
$$;


-- -----------------------------------------------------------------------------
-- 3a. record_transaction - Phase 52: a signed ADJUSTMENT.
--     Otherwise identical to 20260927_ledger_rpcs.sql.
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

  -- Phase 52 (ADR 0024): an ADJUSTMENT's amount is the signed correction -
  -- negative lowers the balance. Every other type stays strictly positive.
  v_amount := round(p_amount, 2);
  if v_amount is null
     or (p_type = 'ADJUSTMENT' and v_amount = 0)
     or (p_type <> 'ADJUSTMENT' and v_amount <= 0) then
    raise exception '%', case when p_type = 'ADJUSTMENT'
                              then 'An adjustment must not be zero'
                              else 'Amount must be greater than zero' end
      using errcode = '22023';
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
-- 3b. import_transactions - Phase 52: a signed ADJUSTMENT, and an optional
--     per-row debt_id (F8), locked, guarded in aggregate and decremented.
--     Otherwise identical to 20260927_ledger_rpcs.sql.
--
-- A DEBT_REPAYMENT row with a null debt_id is still accepted (wallet only), so
-- a cached older PWA bundle keeps importing until it updates. The current
-- client never sends one: its CSV preview marks such a row invalid.
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
  v_debt_id    uuid;
  v_wallet_ids uuid[] := '{}';
  v_debt_ids   uuid[] := '{}';
  v_first_key  text;
  v_over       record;
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
    v_debt_id   := nullif(v_row ->> 'debt_id', '')::uuid;

    if v_index is null then
      raise exception 'Import row is missing its row_index' using errcode = '22023';
    end if;
    if public._ledger_source_sign(v_type) is null then
      raise exception 'Row %: unknown transaction type %', v_index, coalesce(v_type, 'null')
        using errcode = '22023';
    end if;
    -- Phase 52: a signed ADJUSTMENT; every other type stays > 0.
    if v_amount is null
       or (v_type = 'ADJUSTMENT' and v_amount = 0)
       or (v_type <> 'ADJUSTMENT' and v_amount <= 0) then
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
    -- Phase 52 (F8): only a repayment can name a debt.
    if v_debt_id is not null and v_type <> 'DEBT_REPAYMENT' then
      raise exception 'Row %: only a debt repayment can name a debt', v_index using errcode = '22023';
    end if;

    v_wallet_ids := v_wallet_ids || v_wallet_id;
    if v_dest_id is not null then
      v_wallet_ids := v_wallet_ids || v_dest_id;
    end if;
    if v_debt_id is not null then
      v_debt_ids := v_debt_ids || v_debt_id;
    end if;
  end loop;

  -- Lock every wallet the batch touches, in id order, before any write.
  perform 1
     from public.wallets
    where user_id = v_uid
      and id = any(v_wallet_ids)
    order by id
      for update;

  -- Phase 52 (F8): then every debt, in id order - wallets before debts, the
  -- order every writer in 20260927_ledger_rpcs.sql takes.
  perform 1
     from public.debts
    where user_id = v_uid
      and id = any(v_debt_ids)
    order by id
      for update;

  -- Phase 52 (F8): ADR 0016's guard, in aggregate. Two rows that each fit a
  -- debt's remainder can still overpay it together.
  select d.id, d.name, d.remaining_amount, s.total
    into v_over
    from (
      select (r ->> 'debt_id')::uuid as debt_id,
             sum(round((r ->> 'amount')::numeric, 2)) as total
        from jsonb_array_elements(p_rows) r
       where nullif(r ->> 'debt_id', '') is not null
       group by 1
    ) s
    join public.debts d on d.id = s.debt_id
   where d.user_id = v_uid
     and d.is_deleted = false
     and s.total > d.remaining_amount
   limit 1;

  if found then
    -- Same contract as record_transaction: the client formats the money.
    raise exception 'DEBT_OVERPAYMENT'
      using errcode = 'P0001',
            detail  = v_over.remaining_amount::text,
            hint    = v_over.name;
  end if;

  -- Insert, checking ownership per row so a failure names the row.
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_index     := (v_row ->> 'row_index')::integer;
    v_wallet_id := (v_row ->> 'wallet_id')::uuid;
    v_dest_id   := nullif(v_row ->> 'destination_wallet_id', '')::uuid;
    v_cat_id    := nullif(v_row ->> 'category_id', '')::uuid;
    v_debt_id   := nullif(v_row ->> 'debt_id', '')::uuid;

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

    if v_debt_id is not null and not exists (
      select 1 from public.debts
       where id = v_debt_id and user_id = v_uid and is_deleted = false
    ) then
      raise exception 'Row %: debt not found or has been deleted', v_index using errcode = 'P0002';
    end if;

    insert into public.transactions (
      user_id, wallet_id, destination_wallet_id, category_id, debt_id,
      amount, type, description, transaction_date,
      idempotency_key, is_deleted, created_by
    ) values (
      v_uid, v_wallet_id, v_dest_id, v_cat_id, v_debt_id,
      round((v_row ->> 'amount')::numeric, 2),
      v_row ->> 'type',
      coalesce(v_row ->> 'description', ''),
      (v_row ->> 'transaction_date')::date,
      p_import_key || ':' || v_index,
      false, v_uid::text
    );
  end loop;

  -- One relative update per wallet, from the same sign table the per-row helper
  -- uses. A signed ADJUSTMENT needs no special case: its sign is +1 and its
  -- amount carries the direction.
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

  -- Phase 52 (F8): one decrement per debt, with `_ledger_apply_effect`'s floor
  -- and settle rule. The guard above means the floor never engages here.
  with per_debt as (
    select (r ->> 'debt_id')::uuid as debt_id,
           sum(round((r ->> 'amount')::numeric, 2)) as total
      from jsonb_array_elements(p_rows) r
     where nullif(r ->> 'debt_id', '') is not null
     group by 1
  )
  update public.debts d
     set remaining_amount = greatest(0, round(d.remaining_amount - pd.total, 2)),
         is_settled       = greatest(0, round(d.remaining_amount - pd.total, 2)) = 0,
         updated_at       = now()
    from per_debt pd
   where d.id = pd.debt_id
     and d.user_id = v_uid
     and d.is_deleted = false;

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
-- 4. list_my_sessions
--
-- supabase-js cannot list a user's sessions; the database can. Read-only: the
-- app revokes through supabase.auth.signOut({ scope: 'others' | 'global' }),
-- never by writing to the auth schema. `is_current` compares each row with the
-- `session_id` claim of the caller's own access token.
-- -----------------------------------------------------------------------------
create or replace function public.list_my_sessions()
returns table (
  id           uuid,
  created_at   timestamptz,
  last_active  timestamptz,
  not_after    timestamptz,
  user_agent   text,
  ip           text,
  is_current   boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id,
         s.created_at,
         coalesce(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at) as last_active,
         s.not_after,
         s.user_agent,
         host(s.ip),
         s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    from auth.sessions s
   where s.user_id = auth.uid()
   order by coalesce(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at) desc;
$$;


-- -----------------------------------------------------------------------------
-- 5. Grants. Supabase's default privileges grant EXECUTE on new public
--    functions to anon and authenticated, so every revoke is explicit.
--    Re-created functions keep their existing ACLs; the grants are repeated
--    so this file stands alone.
-- -----------------------------------------------------------------------------
revoke all on function public.create_wallet(text, text, text, text, text, numeric, date, text) from public, anon;
grant execute on function public.create_wallet(text, text, text, text, text, numeric, date, text) to authenticated, service_role;

revoke all on function public.record_transaction(uuid, numeric, text, text, date, text, uuid, uuid, text) from public, anon;
grant execute on function public.record_transaction(uuid, numeric, text, text, date, text, uuid, uuid, text) to authenticated, service_role;

revoke all on function public.import_transactions(text, jsonb) from public, anon;
grant execute on function public.import_transactions(text, jsonb) to authenticated, service_role;

revoke all on function public.list_my_sessions() from public, anon, service_role;
grant execute on function public.list_my_sessions() to authenticated;
