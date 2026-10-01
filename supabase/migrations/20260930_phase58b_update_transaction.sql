-- =============================================================================
-- Phase 58b: editing a transaction (ADR 0033)
--
--   update_transaction - takes the full desired row, locks the row and every
--                        wallet it touches before and after, reverses the old
--                        effect and applies the new one with
--                        _ledger_apply_effect, and writes the row, in one
--                        database transaction.
--
-- The rules it enforces, the same ones the client checks first:
--   - INCOME, EXPENSE and TRANSFER can change type among themselves and edit
--     amount, wallet(s), category, note and date.
--   - A DEBT_REPAYMENT or an ADJUSTMENT edits only its note and date. Its type,
--     amount, wallet and category must come back unchanged, and no row can
--     become one.
--   - A deleted row is not editable; restore it first.
--
-- Idempotent by state, like set_transaction_deleted: a request equal to the row
-- returns `changed: false` and moves nothing, so a retry after a lost response
-- is safe. That check runs BEFORE the stale guard, or the retry would be
-- refused as stale by its own first attempt.
--
-- Stale guard: `p_expected_updated_at` is the row's `updated_at` as the client
-- last saw it. If the row has changed since, the edit is refused with
-- TRANSACTION_CHANGED instead of overwriting another device's edit. Balances are
-- right either way - the effect reversed is always the row's real one - so this
-- protects intent, not money.
--
-- No overdraft check (ADR 0014). No debt is locked or moved: a repayment's
-- money fields cannot change, so an edit never touches a debt.
--
-- The client has NO fallback for a missing function: an edit is shown as
-- needing the database update, never written as absolute balances.
--
-- Verify with supabase/tests/20260930_phase58b.probe.sql (BEGIN ... ROLLBACK).
-- =============================================================================

create or replace function public.update_transaction(
  p_transaction_id        uuid,
  p_expected_updated_at   timestamptz,
  p_type                  text,
  p_amount                numeric,
  p_wallet_id             uuid,
  p_destination_wallet_id uuid,
  p_category_id           uuid,
  p_description           text,
  p_transaction_date      date,
  p_raw_input             text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid          uuid := auth.uid();
  v_tx           public.transactions%rowtype;
  v_amount       numeric;
  v_raw_input    text;
  v_money_change boolean;
  v_wallet_ids   uuid[];
  v_balances     jsonb;
begin
  -- The user comes from the JWT and nowhere else. SECURITY DEFINER bypasses
  -- RLS, so every lookup below is filtered by owner explicitly.
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if p_transaction_id is null then
    raise exception 'A transaction id is required' using errcode = '22023';
  end if;

  -- Lock order everywhere in the ledger: transaction, then wallets by id, then
  -- debt. This function never takes a debt.
  select * into v_tx
    from public.transactions
   where id = p_transaction_id
     and user_id = v_uid
     for update;

  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;
  if v_tx.is_deleted then
    raise exception 'Restore this transaction before editing it' using errcode = '22023';
  end if;

  v_amount    := round(p_amount, 2);
  v_raw_input := nullif(btrim(coalesce(p_raw_input, '')), '');

  -- Type rules.
  if v_tx.type in ('DEBT_REPAYMENT', 'ADJUSTMENT') then
    if p_type is distinct from v_tx.type
       or v_amount is distinct from v_tx.amount
       or p_wallet_id is distinct from v_tx.wallet_id
       or p_destination_wallet_id is distinct from v_tx.destination_wallet_id
       or p_category_id is distinct from v_tx.category_id then
      raise exception 'Only the note and date of a debt repayment or an adjustment can change'
        using errcode = '22023';
    end if;
    -- Its formula goes with its amount, which cannot change.
    v_raw_input := v_tx.raw_input;
  elsif p_type is null or p_type not in ('INCOME', 'EXPENSE', 'TRANSFER') then
    raise exception 'A transaction can only become income, an expense or a transfer'
      using errcode = '22023';
  end if;

  -- Replay: a request equal to the row changes nothing. Before the stale guard,
  -- so a retry after a lost response is not refused by its own first attempt.
  if p_type = v_tx.type
     and v_amount is not distinct from v_tx.amount
     and p_wallet_id is not distinct from v_tx.wallet_id
     and p_destination_wallet_id is not distinct from v_tx.destination_wallet_id
     and p_category_id is not distinct from v_tx.category_id
     and p_description is not distinct from v_tx.description
     and p_transaction_date is not distinct from v_tx.transaction_date
     and v_raw_input is not distinct from v_tx.raw_input then
    select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'balance', w.balance) order by w.id), '[]'::jsonb)
      into v_balances
      from public.wallets w
     where w.user_id = v_uid
       and w.id in (v_tx.wallet_id, v_tx.destination_wallet_id);
    return jsonb_build_object('changed', false, 'transaction', to_jsonb(v_tx), 'balances', v_balances);
  end if;

  -- Stale guard (ADR 0033): the client names the version it edited.
  if p_expected_updated_at is not null and v_tx.updated_at is distinct from p_expected_updated_at then
    raise exception 'TRANSACTION_CHANGED' using errcode = 'P0001';
  end if;

  -- Validate the new row. The money checks are for the three types whose money
  -- can change: a repayment's or an adjustment's money fields were proved equal
  -- to the row above, and an adjustment's amount is signed (ADR 0024), so a
  -- "greater than zero" check would refuse a note edit of a downward one.
  if v_tx.type not in ('DEBT_REPAYMENT', 'ADJUSTMENT') then
    if v_amount is null or v_amount <= 0 then
      raise exception 'Amount must be greater than zero' using errcode = '22023';
    end if;
    if p_wallet_id is null then
      raise exception 'A wallet is required' using errcode = '22023';
    end if;
    if p_type = 'TRANSFER' then
      if p_destination_wallet_id is null or p_destination_wallet_id = p_wallet_id then
        raise exception 'A transfer needs two different wallets' using errcode = '22023';
      end if;
      -- transfer_funds writes a transfer with no category; an edit keeps it so.
      if p_category_id is not null then
        raise exception 'A transfer has no category' using errcode = '22023';
      end if;
    elsif p_destination_wallet_id is not null then
      raise exception 'Only a transfer has a destination wallet' using errcode = '22023';
    end if;
  end if;
  if p_transaction_date is null then
    raise exception 'A transaction date is required' using errcode = '22023';
  end if;
  if p_description is null or btrim(p_description) = '' or length(p_description) > 255 then
    raise exception 'A note of 1 to 255 characters is required' using errcode = '22023';
  end if;

  -- The foreign key alone would accept another user's category. A system row
  -- (null user_id) is fine; a deleted category is accepted, as the client does.
  if p_category_id is not null and not exists (
    select 1 from public.categories c
     where c.id = p_category_id
       and (c.user_id = v_uid or c.user_id is null)
  ) then
    raise exception 'Category not found' using errcode = 'P0002';
  end if;

  v_money_change := p_type <> v_tx.type
    or v_amount <> v_tx.amount
    or p_wallet_id <> v_tx.wallet_id
    or p_destination_wallet_id is distinct from v_tx.destination_wallet_id;

  -- Every wallet on either side, locked in id order. A wallet the row already
  -- uses may be deleted (its reversal still has to land, as in
  -- set_transaction_deleted); a newly chosen one must be live and the caller's.
  select coalesce(array_agg(distinct id order by id), '{}')
    into v_wallet_ids
    from unnest(array[v_tx.wallet_id, v_tx.destination_wallet_id, p_wallet_id, p_destination_wallet_id]) as id
   where id is not null;

  perform 1
     from public.wallets
    where user_id = v_uid
      and id = any(v_wallet_ids)
    order by id
      for update;

  if exists (
    select 1
      from unnest(array[p_wallet_id, p_destination_wallet_id]) as chosen(id)
     where chosen.id is not null
       and chosen.id <> v_tx.wallet_id
       and chosen.id is distinct from v_tx.destination_wallet_id
       and not exists (
         select 1 from public.wallets w
          where w.id = chosen.id
            and w.user_id = v_uid
            and w.is_deleted = false
       )
  ) then
    raise exception 'Wallet not found or has been deleted' using errcode = 'P0002';
  end if;

  -- Reverse what the row really did, then apply what it now says. The debt leg
  -- is always null: only INCOME, EXPENSE and TRANSFER ever get here with a
  -- money change, and _ledger_apply_effect moves a debt only for a repayment.
  if v_money_change then
    perform public._ledger_apply_effect(
      v_uid, v_tx.wallet_id, v_tx.destination_wallet_id, null, v_tx.type, v_tx.amount, -1
    );
    perform public._ledger_apply_effect(
      v_uid, p_wallet_id, p_destination_wallet_id, null, p_type, v_amount, 1
    );
  end if;

  update public.transactions
     set type                  = p_type,
         amount                = v_amount,
         wallet_id             = p_wallet_id,
         destination_wallet_id = p_destination_wallet_id,
         category_id           = p_category_id,
         description           = p_description,
         transaction_date      = p_transaction_date,
         raw_input             = v_raw_input,
         updated_at            = now()
   where id = v_tx.id
  returning * into v_tx;

  select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'balance', w.balance) order by w.id), '[]'::jsonb)
    into v_balances
    from public.wallets w
   where w.user_id = v_uid
     and w.id = any(v_wallet_ids);

  return jsonb_build_object('changed', true, 'transaction', to_jsonb(v_tx), 'balances', v_balances);
end;
$$;

revoke all on function public.update_transaction(uuid, timestamptz, text, numeric, uuid, uuid, uuid, text, date, text)
  from public, anon;
grant execute on function public.update_transaction(uuid, timestamptz, text, numeric, uuid, uuid, uuid, text, date, text)
  to authenticated;
