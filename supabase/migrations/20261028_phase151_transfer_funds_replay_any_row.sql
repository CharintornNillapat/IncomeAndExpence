-- =============================================================================
-- Phase 151 (ADR 0110): transfer_funds replays a retry whose transfer the user
-- has since deleted, instead of raising unique_violation (finding SL-01).
--
-- In Phase 93, transfer_funds kept an is_deleted filter in its replay lookup
-- and its unique_violation handler. When a user soft-deleted a transfer and
-- retried with the same idempotency key, the replay check missed, balance
-- updates occurred, the insert hit transactions_user_idempotency_uidx, the
-- handler found no live row and re-raised unique_violation (23505).
--
-- This migration re-creates transfer_funds starting from its deployed Phase 93
-- body (md5 03b469921a7c0d01909608cb8c6a53d7, carriage returns removed),
-- changing only the two lookups and their comments to match any row with the
-- key (order by is_deleted asc, created_at asc), matching record_transaction.
--
-- Signature, grants and return shape are unchanged, and no client changes. It
-- is safe to apply before or after the Phase 151 merge, since no client depends
-- on it.
--
-- Probe: supabase/tests/20261028_phase151.probe.sql.
-- =============================================================================

create or replace function public.transfer_funds(
  p_source_wallet_id  uuid,
  p_dest_wallet_id    uuid,
  p_amount            numeric,
  p_idempotency_key   text,
  p_notes             text    default null,
  p_date              date    default current_date,
  p_raw_input         text    default null,
  p_allow_negative    boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user           uuid := auth.uid();
  v_existing       public.transactions%rowtype;
  v_source         public.wallets%rowtype;
  v_dest           public.wallets%rowtype;
  v_tx             public.transactions%rowtype;
  v_amount         numeric(15,2);
  v_source_balance numeric(15,2);
  v_dest_balance   numeric(15,2);
begin
  -- The user is the session's, and only the session's. No session, no
  -- transfer: unlike the 20260909 signature, there is no trusted server path.
  if v_user is null then
    raise exception 'A signed-in session is required to transfer funds'
      using errcode = '42501';
  end if;

  if p_source_wallet_id is null or p_dest_wallet_id is null then
    raise exception 'Both a source and a destination wallet are required'
      using errcode = '22023';
  end if;

  if p_source_wallet_id = p_dest_wallet_id then
    raise exception 'Source and destination wallet must be different'
      using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Transfer amount must be greater than zero'
      using errcode = '22023';
  end if;

  v_amount := round(p_amount, 2);

  -- Idempotent replay (ADR 0023, ADR 0110): a key that already produced a
  -- transaction, live or soft-deleted, is a no-op that returns that row. A
  -- key names one intent, so a retry of a transfer the user has since
  -- deleted moves nothing. A live row wins if both exist.
  if p_idempotency_key is not null then
    select * into v_existing
      from public.transactions
     where user_id = v_user
       and idempotency_key = p_idempotency_key
     order by is_deleted asc, created_at asc
     limit 1;

    if found then
      select balance into v_source_balance
        from public.wallets where id = v_existing.wallet_id;
      select balance into v_dest_balance
        from public.wallets where id = v_existing.destination_wallet_id;

      return jsonb_build_object(
        'reused',         true,
        'transaction',    to_jsonb(v_existing),
        'source_balance', v_source_balance,
        'dest_balance',   v_dest_balance
      );
    end if;
  end if;

  -- Lock both wallet rows before reading balances, in id order, so two
  -- opposing transfers between the same pair queue instead of deadlocking.
  if p_source_wallet_id < p_dest_wallet_id then
    select * into v_source from public.wallets where id = p_source_wallet_id for update;
    select * into v_dest   from public.wallets where id = p_dest_wallet_id   for update;
  else
    select * into v_dest   from public.wallets where id = p_dest_wallet_id   for update;
    select * into v_source from public.wallets where id = p_source_wallet_id for update;
  end if;

  if v_source.id is null or v_source.user_id <> v_user or v_source.is_deleted then
    raise exception 'Source wallet not found or has been deleted'
      using errcode = 'P0002';
  end if;

  if v_dest.id is null or v_dest.user_id <> v_user or v_dest.is_deleted then
    raise exception 'Destination wallet not found or has been deleted'
      using errcode = 'P0002';
  end if;

  -- Balances move 1:1 in nominal units, which is only correct when both legs
  -- are denominated the same.
  if v_source.currency is distinct from v_dest.currency then
    raise exception 'Cannot transfer between % and % wallets. Both wallets must use the same currency.',
      v_source.currency, v_dest.currency
      using errcode = '22023';
  end if;

  -- Off by default: credit-card wallets legitimately carry a negative balance,
  -- and the app has never blocked overdrafts (ADR 0014).
  if not p_allow_negative and v_source.balance < v_amount then
    raise exception 'Insufficient funds in %', v_source.name
      using errcode = '22023';
  end if;

  -- Relative updates, so concurrent writers cannot clobber each other.
  update public.wallets
     set balance = balance - v_amount,
         updated_at = now()
   where id = v_source.id
   returning balance into v_source_balance;

  update public.wallets
     set balance = balance + v_amount,
         updated_at = now()
   where id = v_dest.id
   returning balance into v_dest_balance;

  insert into public.transactions (
    user_id, wallet_id, destination_wallet_id, amount, type,
    description, raw_input, transaction_date, idempotency_key,
    is_deleted, created_by
  ) values (
    v_user, v_source.id, v_dest.id, v_amount, 'TRANSFER',
    coalesce(nullif(btrim(p_notes), ''), 'Transfer between wallets'),
    nullif(btrim(coalesce(p_raw_input, '')), ''),
    p_date, p_idempotency_key,
    false, v_user
  )
  returning * into v_tx;

  return jsonb_build_object(
    'reused',         false,
    'transaction',    to_jsonb(v_tx),
    'source_balance', v_source_balance,
    'dest_balance',   v_dest_balance
  );

exception
  -- Two concurrent calls with the same key can both pass the check above. The
  -- loser hits the unique index; its balance updates roll back with this
  -- block, and it returns the winner's row instead of moving money twice.
  -- It matches any row with the key, as the replay check above does.
  when unique_violation then
    select * into v_existing
      from public.transactions
     where user_id = v_user
       and idempotency_key = p_idempotency_key
     order by is_deleted asc, created_at asc
     limit 1;

    if not found then
      raise;
    end if;

    select balance into v_source_balance
      from public.wallets where id = v_existing.wallet_id;
    select balance into v_dest_balance
      from public.wallets where id = v_existing.destination_wallet_id;

    return jsonb_build_object(
      'reused',         true,
      'transaction',    to_jsonb(v_existing),
      'source_balance', v_source_balance,
      'dest_balance',   v_dest_balance
    );
end;
$$;

-- Signed-in callers only. Supabase's default privileges grant every new
-- function to anon too; a transfer without a session is refused anyway, but
-- anon has no reason to reach it.
revoke all on function public.transfer_funds(uuid, uuid, numeric, text, text, date, text, boolean) from public, anon;
grant execute on function public.transfer_funds(uuid, uuid, numeric, text, text, date, text, boolean) to authenticated;
