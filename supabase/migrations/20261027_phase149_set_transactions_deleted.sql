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
