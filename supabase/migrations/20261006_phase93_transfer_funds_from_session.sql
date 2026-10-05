-- =============================================================================
-- Phase 93 (ADR 0069): transfer_funds without p_user_id, taking the user from
-- the session alone.
--
-- The 20260909 function takes the user as its first argument and checks it
-- against auth.uid(), skipping the check when there is no session (a
-- service-role call). Every other ledger RPC takes the user from auth.uid()
-- only (ADR 0023), and Supabase's security advisor lists this one (ADR 0067,
-- finding S2a). The old check holds: a signed-in caller cannot move another
-- account's money. This file removes the argument rather than fixes a hole.
--
-- A new overload, so nothing breaks while clients update:
--   - transfer_funds(p_source_wallet_id, p_dest_wallet_id, p_amount,
--     p_idempotency_key, p_notes, p_date, p_raw_input, p_allow_negative):
--     the 20260909 body with p_user_id replaced by auth.uid(), refused with
--     42501 when there is no session. The Phase 93 client calls this one.
--   - The 20260909 signature stays, unchanged, for a client still running an
--     older build (a cached PWA). A later migration drops it.
-- PostgREST picks the overload by argument names: a call naming p_user_id
-- reaches only the old one, and a call without it only the new one, since
-- the old one has no default for p_user_id.
--
-- Apply BEFORE deploying the Phase 93 client. Without this function the
-- client sees PGRST202 and takes the legacy non-atomic transfer path.
--
-- Probe: supabase/tests/20261006_phase93.probe.sql.
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

  -- Idempotent replay: an identical key that already produced a live
  -- transaction is a no-op that returns the original row.
  if p_idempotency_key is not null then
    select * into v_existing
      from public.transactions
     where user_id = v_user
       and idempotency_key = p_idempotency_key
       and is_deleted = false
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
  when unique_violation then
    select * into v_existing
      from public.transactions
     where user_id = v_user
       and idempotency_key = p_idempotency_key
       and is_deleted = false
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
