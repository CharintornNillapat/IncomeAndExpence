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
