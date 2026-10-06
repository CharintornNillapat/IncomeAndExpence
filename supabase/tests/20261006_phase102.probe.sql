-- =============================================================================
-- Phase 102 probe (ADR 0078): the 20260909 transfer_funds signature refuses
-- every call with OUTDATED_CLIENT and is no longer SECURITY DEFINER; the
-- session signature is unchanged and still moves money.
--
-- Runs inside BEGIN ... ROLLBACK, so nothing it creates or writes survives.
-- Keep the `\ir` line to test the migration before it is applied; a runner
-- without psql pastes the file in its place. After it is applied, remove the
-- `\ir` line and run the rest against the live schema. The unit suite runs it
-- on a replayed database (unit/migration-replay.test.ts).
--
-- Success is the final row, `PHASE 102 PROBE OK`.
-- =============================================================================

begin;

\ir ../migrations/20261006_phase102_deprecate_legacy_transfer_funds.sql

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000102a01', 'phase102-probe-a@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe A"}'),
  ('00000000-0000-4000-8000-000000102b01', 'phase102-probe-b@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe B"}');

insert into public.wallets (id, user_id, name, type, balance) values
  ('00000000-0000-4000-8000-0000010aa001', '00000000-0000-4000-8000-000000102a01', 'A main', 'CASH', 100.00),
  ('00000000-0000-4000-8000-0000010aa002', '00000000-0000-4000-8000-000000102a01', 'A spare', 'CASH', 0.00),
  ('00000000-0000-4000-8000-0000010bb001', '00000000-0000-4000-8000-000000102b01', 'B main', 'CASH', 50.00);

-- Calls a transfer as whoever the claims name, as authenticated, and returns
-- what it did, or its SQLSTATE and message. `p_as_old` uses the 20260909
-- signature with `p_user` as its p_user_id.
create function pg_temp.transfer_as(
  p_claims text, p_source uuid, p_dest uuid, p_amount numeric, p_key text,
  p_as_old boolean default false, p_user uuid default null
) returns text
language plpgsql
as $fn$
declare
  r jsonb;
begin
  perform set_config('request.jwt.claims', p_claims, true);
  if p_as_old then
    r := public.transfer_funds(p_user_id => p_user, p_source_wallet_id => p_source,
           p_dest_wallet_id => p_dest, p_amount => p_amount, p_idempotency_key => p_key);
  else
    r := public.transfer_funds(p_source_wallet_id => p_source, p_dest_wallet_id => p_dest,
           p_amount => p_amount, p_idempotency_key => p_key);
  end if;
  return (case when (r ->> 'reused')::boolean then 'reused ' else 'moved ' end)
         || (r ->> 'source_balance') || ' ' || (r ->> 'dest_balance');
exception when others then
  return sqlstate || ' ' || sqlerrm;
end;
$fn$;
grant execute on function pg_temp.transfer_as(text, uuid, uuid, numeric, text, boolean, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 1. The two signatures' shape and grants, and the advisor's count.
-- -----------------------------------------------------------------------------
do $shape$
declare
  v_new text := 'public.transfer_funds(uuid, uuid, numeric, text, text, date, text, boolean)';
  v_old text := 'public.transfer_funds(uuid, uuid, uuid, numeric, text, text, date, text, boolean)';
begin
  assert to_regprocedure(v_old) is not null, '1 the 20260909 signature is gone: an old build would get PGRST202 and the legacy path';
  assert not (select prosecdef from pg_proc where oid = v_old::regprocedure), '1 the old signature is still security definer';
  assert (select proconfig from pg_proc where oid = v_old::regprocedure) = array['search_path=""'], '1 the old signature has no empty search_path';
  assert (select pg_get_function_result(oid) from pg_proc where oid = v_old::regprocedure) = 'jsonb', '1 the old signature changed its return type';
  assert has_function_privilege('authenticated', v_old, 'execute'), '1 authenticated cannot call the old signature: an old build would get 42501, not the reload message';
  assert not has_function_privilege('anon', v_old, 'execute'), '1 anon can execute the old signature';

  assert to_regprocedure(v_new) is not null, '1 the session signature is missing';
  assert (select prosecdef from pg_proc where oid = v_new::regprocedure), '1 the session signature is not security definer';
  assert (select proconfig from pg_proc where oid = v_new::regprocedure) = array['search_path=public, pg_temp'],
    '1 the session signature lost its pinned search_path';
  assert (select md5(prosrc) from pg_proc where oid = v_new::regprocedure) = '0f4ef8407ef5eea1a1224f740d7daef3',
    '1 the session signature''s body changed';
  assert has_function_privilege('authenticated', v_new, 'execute'), '1 authenticated cannot execute the session signature';
  assert not has_function_privilege('anon', v_new, 'execute'), '1 anon can execute the session signature';

  -- What the advisor lists (ADR 0067): SECURITY DEFINER functions in public
  -- that authenticated may execute. Ten, one signature each, since this phase.
  assert (select count(*) from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prosecdef
             and has_function_privilege('authenticated', p.oid, 'execute')) = 10,
    '1 the advisor would not list exactly ten SECURITY DEFINER functions';
end;
$shape$;

-- -----------------------------------------------------------------------------
-- 2. The old signature refuses, as authenticated, whatever it is given, and
--    moves nothing.
-- -----------------------------------------------------------------------------
set local role authenticated;
do $old$
declare
  a      text := '{"sub":"00000000-0000-4000-8000-000000102a01","role":"authenticated"}';
  ua     uuid := '00000000-0000-4000-8000-000000102a01';
  ub     uuid := '00000000-0000-4000-8000-000000102b01';
  a1     uuid := '00000000-0000-4000-8000-0000010aa001';
  a2     uuid := '00000000-0000-4000-8000-0000010aa002';
  b1     uuid := '00000000-0000-4000-8000-0000010bb001';
  reload text := 'P0001 OUTDATED_CLIENT: Please reload the app to continue.';
begin
  assert pg_temp.transfer_as(a, a1, a2, 10, 'p102-old-1', true, ua) = reload, '2 the old signature did not refuse A''s own transfer';
  assert pg_temp.transfer_as(a, b1, a1, 10, 'p102-old-2', true, ub) = reload, '2 the old signature did not refuse a call naming B';
  assert pg_temp.transfer_as('{}', a1, a2, 10, 'p102-old-3', true, ua) = reload, '2 the old signature did not refuse a call with no session';
end;
$old$;
reset role;

do $nothing$
begin
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000010aa001') = 100.00, '2 A main moved';
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000010aa002') = 0.00, '2 A spare moved';
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000010bb001') = 50.00, '2 B main moved';
  assert not exists (select 1 from public.transactions where idempotency_key like 'p102-%'), '2 the old signature wrote a row';
end;
$nothing$;

-- -----------------------------------------------------------------------------
-- 3. The session signature, as authenticated: it moves A's money, replays a
--    retry, and refuses what it refused before.
-- -----------------------------------------------------------------------------
set local role authenticated;
do $new$
declare
  a  text := '{"sub":"00000000-0000-4000-8000-000000102a01","role":"authenticated"}';
  a1 uuid := '00000000-0000-4000-8000-0000010aa001';
  a2 uuid := '00000000-0000-4000-8000-0000010aa002';
  b1 uuid := '00000000-0000-4000-8000-0000010bb001';
begin
  assert pg_temp.transfer_as(a, a1, a2, 10.004, 'p102-1') = 'moved 90.00 10.00', '3 A could not move its own money';
  assert pg_temp.transfer_as(a, a1, a2, 10, 'p102-1') = 'reused 90.00 10.00', '3 a retry did not replay';
  assert pg_temp.transfer_as('{}', a1, a2, 5, 'p102-2') like '42501 %', '3 a call with no session was not refused';
  assert pg_temp.transfer_as(a, a1, b1, 5, 'p102-3') like 'P0002 %', '3 A paid into B''s wallet';
  assert pg_temp.transfer_as(a, a1, a1, 5, 'p102-4') like '22023 %', '3 a transfer to the same wallet passed';
end;
$new$;
reset role;

do $ledger$
begin
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000010aa001') = 90.00, '3 A main is not 90.00';
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000010aa002') = 10.00, '3 A spare is not 10.00';
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000010bb001') = 50.00, '3 B main moved';
  assert (select count(*) from public.transactions where idempotency_key like 'p102-%') = 1, '3 not exactly one transfer row';
end;
$ledger$;

select 'PHASE 102 PROBE OK' as result;

rollback;
