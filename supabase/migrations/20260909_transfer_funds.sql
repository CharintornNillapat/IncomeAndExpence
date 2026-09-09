-- =============================================================================
-- Atomic wallet transfers + transaction idempotency
--
-- Before this migration a transfer was three independent round-trips from the
-- browser (insert transaction -> debit source -> credit destination). A failure
-- between them left the source debited with nothing credited, and balances were
-- written as client-computed absolute values, so two devices transferring at the
-- same time silently lost one leg.
--
-- This migration moves the whole operation into one database transaction using
-- relative updates, and makes retries safe via an idempotency key.
--
-- Assumed existing schema (this repo has no schema file; these are the columns
-- the client already reads and writes):
--   wallets(id uuid pk, user_id uuid, name text, type text, currency text,
--           balance numeric, color text, icon text, is_archived bool,
--           is_deleted bool, created_at timestamptz, updated_at timestamptz)
--   transactions(id uuid pk, user_id uuid, wallet_id uuid,
--           destination_wallet_id uuid, category_id uuid, debt_id uuid,
--           amount numeric, type text, description text, raw_input text,
--           transaction_date date, idempotency_key text, is_deleted bool,
--           created_by uuid, created_at timestamptz, updated_at timestamptz)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Idempotency guard
--
-- Partial unique index: only live rows participate. A transfer that failed and
-- was compensated (is_deleted = true) therefore does not block a genuine retry
-- with the same key.
--
-- If this fails with a duplicate key error, find the offending rows first:
--   select user_id, idempotency_key, count(*)
--     from public.transactions
--    where idempotency_key is not null and is_deleted = false
--    group by 1, 2 having count(*) > 1;
--
-- On a large live table, run the CONCURRENTLY form instead, outside any
-- transaction block:
--   create unique index concurrently transactions_user_idempotency_key_uniq ...
-- -----------------------------------------------------------------------------
create unique index if not exists transactions_user_idempotency_key_uniq
  on public.transactions (user_id, idempotency_key)
  where idempotency_key is not null and is_deleted = false;


-- -----------------------------------------------------------------------------
-- 2. transfer_funds
--
-- Returns jsonb:
--   { "reused": bool, "transaction": {...}, "source_balance": n, "dest_balance": n }
--
-- `reused` is true when the idempotency key already produced a live transaction,
-- in which case nothing is written and the original row is returned.
-- -----------------------------------------------------------------------------
create or replace function public.transfer_funds(
  p_user_id           uuid,
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
  v_caller         uuid := auth.uid();
  v_existing       public.transactions%rowtype;
  v_source         public.wallets%rowtype;
  v_dest           public.wallets%rowtype;
  v_tx             public.transactions%rowtype;
  v_amount         numeric(15,2);
  v_source_balance numeric(15,2);
  v_dest_balance   numeric(15,2);
begin
  -- Authorisation. The function is SECURITY DEFINER so it can lock and update
  -- rows regardless of RLS policy shape; that makes an explicit ownership check
  -- mandatory. A signed-in caller may only move their own money. auth.uid() is
  -- null for service-role / server-side calls, which are trusted.
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'Not authorised to transfer funds for another user'
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
     where user_id = p_user_id
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

  -- Lock both wallet rows before reading balances. Locking in a deterministic
  -- order (by id) means two opposing transfers between the same pair of wallets
  -- queue instead of deadlocking.
  if p_source_wallet_id < p_dest_wallet_id then
    select * into v_source from public.wallets where id = p_source_wallet_id for update;
    select * into v_dest   from public.wallets where id = p_dest_wallet_id   for update;
  else
    select * into v_dest   from public.wallets where id = p_dest_wallet_id   for update;
    select * into v_source from public.wallets where id = p_source_wallet_id for update;
  end if;

  if v_source.id is null or v_source.user_id <> p_user_id or v_source.is_deleted then
    raise exception 'Source wallet not found or has been deleted'
      using errcode = 'P0002';
  end if;

  if v_dest.id is null or v_dest.user_id <> p_user_id or v_dest.is_deleted then
    raise exception 'Destination wallet not found or has been deleted'
      using errcode = 'P0002';
  end if;

  -- Balances move 1:1 in nominal units, which is only correct when both legs are
  -- denominated the same.
  if v_source.currency is distinct from v_dest.currency then
    raise exception 'Cannot transfer between % and % wallets. Both wallets must use the same currency.',
      v_source.currency, v_dest.currency
      using errcode = '22023';
  end if;

  -- Off by default: credit-card wallets legitimately carry a negative balance,
  -- and the app has never blocked overdrafts. Pass false to enforce.
  if not p_allow_negative and v_source.balance < v_amount then
    raise exception 'Insufficient funds in %', v_source.name
      using errcode = '22023';
  end if;

  -- Relative updates, so concurrent writers cannot clobber each other the way
  -- client-computed absolute balances did.
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
    p_user_id, v_source.id, v_dest.id, v_amount, 'TRANSFER',
    coalesce(nullif(btrim(p_notes), ''), 'Transfer between wallets'),
    nullif(btrim(coalesce(p_raw_input, '')), ''),
    p_date, p_idempotency_key,
    false, p_user_id
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
  -- loser hits the unique index; its balance updates are rolled back with this
  -- subtransaction, and it returns the winner's row instead of double-spending.
  when unique_violation then
    select * into v_existing
      from public.transactions
     where user_id = p_user_id
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


-- -----------------------------------------------------------------------------
-- 3. Grants. Anonymous callers must not be able to move money.
-- -----------------------------------------------------------------------------
revoke all on function public.transfer_funds(uuid, uuid, uuid, numeric, text, text, date, text, boolean) from public;
revoke all on function public.transfer_funds(uuid, uuid, uuid, numeric, text, text, date, text, boolean) from anon;
grant execute on function public.transfer_funds(uuid, uuid, uuid, numeric, text, text, date, text, boolean) to authenticated;
grant execute on function public.transfer_funds(uuid, uuid, uuid, numeric, text, text, date, text, boolean) to service_role;
