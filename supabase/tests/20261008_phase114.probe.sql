-- =============================================================================
-- Phase 114 probe (ADR 0090): the 20260909 transfer_funds signature is gone;
-- the session signature is unchanged and still moves money.
--
-- Runs inside BEGIN ... ROLLBACK, so nothing it creates or writes survives.
-- Keep the `\ir` line to test the migration before it is applied; a runner
-- without psql pastes the file in its place. After it is applied, remove the
-- `\ir` line and run the rest against the live schema. The unit suite runs it
-- on a replayed database (unit/migration-replay.test.ts).
--
-- Success is the final row, `PHASE 114 PROBE OK`.
-- =============================================================================

begin;

\ir ../migrations/20261008_phase114_drop_legacy_transfer_funds.sql

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000114a01', 'phase114-probe-a@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe A"}'),
  ('00000000-0000-4000-8000-000000114b01', 'phase114-probe-b@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe B"}');

insert into public.wallets (id, user_id, name, type, balance) values
  ('00000000-0000-4000-8000-0000011aa001', '00000000-0000-4000-8000-000000114a01', 'A main', 'CASH', 100.00),
  ('00000000-0000-4000-8000-0000011aa002', '00000000-0000-4000-8000-000000114a01', 'A spare', 'CASH', 0.00),
  ('00000000-0000-4000-8000-0000011bb001', '00000000-0000-4000-8000-000000114b01', 'B main', 'CASH', 50.00);

-- Calls a transfer as whoever the claims name, as authenticated, and returns
-- what it did, or its SQLSTATE and message. `p_as_old` names p_user_id, as a
-- build from before Phase 93 did.
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
    execute 'select public.transfer_funds(p_user_id => $1, p_source_wallet_id => $2, p_dest_wallet_id => $3, p_amount => $4, p_idempotency_key => $5)'
      into r using p_user, p_source, p_dest, p_amount, p_key;
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
-- 1. One signature left, unchanged, and the advisor's count unchanged.
-- -----------------------------------------------------------------------------
do $shape$
declare
  v_new text := 'public.transfer_funds(uuid, uuid, numeric, text, text, date, text, boolean)';
  v_old text := 'public.transfer_funds(uuid, uuid, uuid, numeric, text, text, date, text, boolean)';
begin
  assert to_regprocedure(v_old) is null, '1 the 20260909 signature is still there';
  assert (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'transfer_funds') = 1,
    '1 not exactly one transfer_funds';

  assert to_regprocedure(v_new) is not null, '1 the session signature is missing';
  assert (select prosecdef from pg_proc where oid = v_new::regprocedure), '1 the session signature is not security definer';
  assert (select proconfig from pg_proc where oid = v_new::regprocedure) = array['search_path=public, pg_temp'],
    '1 the session signature lost its pinned search_path';
  -- Carriage returns removed, as supabase/catalog.sql does: live's body has
  -- them (applied from a Windows checkout), a Linux replay does not.
  assert (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = v_new::regprocedure) = '03b469921a7c0d01909608cb8c6a53d7',
    '1 the session signature''s body changed';
  assert has_function_privilege('authenticated', v_new, 'execute'), '1 authenticated cannot execute the session signature';
  assert not has_function_privilege('anon', v_new, 'execute'), '1 anon can execute the session signature';

  -- What the advisor lists (ADR 0067): the old signature was SECURITY INVOKER
  -- since Phase 102, so dropping it leaves the ten.
  assert (select count(*) from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prosecdef
             and has_function_privilege('authenticated', p.oid, 'execute')) = 10,
    '1 the advisor would not list exactly ten SECURITY DEFINER functions';
end;
$shape$;

-- -----------------------------------------------------------------------------
-- 2. A call naming p_user_id finds no function (PGRST202 through PostgREST)
--    and moves nothing; the session signature moves A's money, replays a
--    retry, and refuses what it refused before.
-- -----------------------------------------------------------------------------
set local role authenticated;
do $calls$
declare
  a  text := '{"sub":"00000000-0000-4000-8000-000000114a01","role":"authenticated"}';
  ua uuid := '00000000-0000-4000-8000-000000114a01';
  a1 uuid := '00000000-0000-4000-8000-0000011aa001';
  a2 uuid := '00000000-0000-4000-8000-0000011aa002';
  b1 uuid := '00000000-0000-4000-8000-0000011bb001';
begin
  assert pg_temp.transfer_as(a, a1, a2, 10, 'p114-old', true, ua) like '42883 %', '2 a call naming p_user_id found a function';
  assert pg_temp.transfer_as(a, a1, a2, 10.004, 'p114-1') = 'moved 90.00 10.00', '2 A could not move its own money';
  assert pg_temp.transfer_as(a, a1, a2, 10, 'p114-1') = 'reused 90.00 10.00', '2 a retry did not replay';
  assert pg_temp.transfer_as('{}', a1, a2, 5, 'p114-2') like '42501 %', '2 a call with no session was not refused';
  assert pg_temp.transfer_as(a, a1, b1, 5, 'p114-3') like 'P0002 %', '2 A paid into B''s wallet';
end;
$calls$;
reset role;

do $ledger$
begin
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000011aa001') = 90.00, '2 A main is not 90.00';
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000011aa002') = 10.00, '2 A spare is not 10.00';
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000011bb001') = 50.00, '2 B main moved';
  assert (select count(*) from public.transactions where idempotency_key like 'p114-%') = 1, '2 not exactly one transfer row';
end;
$ledger$;

select 'PHASE 114 PROBE OK' as result;

rollback;
