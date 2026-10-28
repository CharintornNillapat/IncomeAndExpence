-- =============================================================================
-- Phase 151 probe (ADR 0110): transfer_funds replays a retry whose transfer
-- the user has since deleted, instead of raising unique_violation; it still
-- replays a live transfer, moves money for a new key, and keeps one account's
-- key apart from another's.
--
-- Runs inside BEGIN ... ROLLBACK, so nothing it creates or writes survives.
-- Keep the `\ir` line to test the migration before it is applied; a runner
-- without psql pastes the file in its place. After it is applied, remove the
-- `\ir` line and run the rest against the live schema. The unit suite runs it
-- on a replayed database (unit/migration-replay.test.ts).
--
-- Success is the final row, `PHASE 151 PROBE OK`.
-- =============================================================================

begin;

\ir ../migrations/20261028_phase151_transfer_funds_replay_any_row.sql

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000151a01', 'phase151-probe-a@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe A"}'),
  ('00000000-0000-4000-8000-000000151b01', 'phase151-probe-b@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe B"}');

insert into public.wallets (id, user_id, name, type, balance) values
  ('00000000-0000-4000-8000-0000015aa001', '00000000-0000-4000-8000-000000151a01', 'A main',  'CASH', 100.00),
  ('00000000-0000-4000-8000-0000015aa002', '00000000-0000-4000-8000-000000151a01', 'A spare', 'CASH', 0.00),
  ('00000000-0000-4000-8000-0000015bb001', '00000000-0000-4000-8000-000000151b01', 'B main',  'CASH', 50.00),
  ('00000000-0000-4000-8000-0000015bb002', '00000000-0000-4000-8000-000000151b01', 'B spare', 'CASH', 0.00);

-- Calls a transfer as whoever the claims name, as authenticated, and returns
-- what it did: `moved` or `reused`, the two balances it returned, and
-- ` deleted` when the row it returned is soft-deleted; or the SQLSTATE it
-- raised.
create function pg_temp.transfer_as(p_claims text, p_source uuid, p_dest uuid, p_amount numeric, p_key text)
returns text
language plpgsql
as $fn$
declare
  r jsonb;
begin
  perform set_config('request.jwt.claims', p_claims, true);
  r := public.transfer_funds(p_source_wallet_id => p_source, p_dest_wallet_id => p_dest,
         p_amount => p_amount, p_idempotency_key => p_key);
  return (case when (r ->> 'reused')::boolean then 'reused ' else 'moved ' end)
         || (r ->> 'source_balance') || ' ' || (r ->> 'dest_balance')
         || (case when (r -> 'transaction' ->> 'is_deleted')::boolean then ' deleted' else '' end);
exception when others then
  return sqlstate;
end;
$fn$;
grant execute on function pg_temp.transfer_as(text, uuid, uuid, numeric, text) to authenticated;

-- Soft-deletes the caller's row with this key through set_transaction_deleted,
-- and returns `deleted`, or the SQLSTATE it raised.
create function pg_temp.delete_as(p_claims text, p_key text)
returns text
language plpgsql
as $fn$
begin
  perform set_config('request.jwt.claims', p_claims, true);
  perform public.set_transaction_deleted(
    (select id from public.transactions where idempotency_key = p_key and user_id = auth.uid()), true);
  return 'deleted';
exception when others then
  return sqlstate;
end;
$fn$;
grant execute on function pg_temp.delete_as(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 1. A retry of a deleted transfer replays it and moves nothing; a retry of a
--    live one still replays; a key is one account's alone.
-- -----------------------------------------------------------------------------
set local role authenticated;
do $replay$
declare
  a  text := '{"sub":"00000000-0000-4000-8000-000000151a01","role":"authenticated"}';
  b  text := '{"sub":"00000000-0000-4000-8000-000000151b01","role":"authenticated"}';
  a1 uuid := '00000000-0000-4000-8000-0000015aa001';
  a2 uuid := '00000000-0000-4000-8000-0000015aa002';
  b1 uuid := '00000000-0000-4000-8000-0000015bb001';
  b2 uuid := '00000000-0000-4000-8000-0000015bb002';
  v  text;
begin
  -- B moves 7 under the key A uses next, then deletes it: B is back at 50.00.
  assert pg_temp.transfer_as(b, b1, b2, 7, 'p151-1') = 'moved 43.00 7.00', '1 B could not move its own money';
  assert pg_temp.delete_as(b, 'p151-1') = 'deleted', '1 B could not delete its transfer';

  -- A's first call under that key is A's own new transfer, not B's row.
  v := pg_temp.transfer_as(a, a1, a2, 10, 'p151-1');
  assert v = 'moved 90.00 10.00', '1 A''s new key did not move A''s money: ' || coalesce(v, 'null');

  -- A deletes it, then retries with the same key: the retry replays the
  -- deleted row with the balances as they stand, and moves nothing.
  assert pg_temp.delete_as(a, 'p151-1') = 'deleted', '1 A could not delete its transfer';
  v := pg_temp.transfer_as(a, a1, a2, 10, 'p151-1');
  assert v = 'reused 100.00 0.00 deleted', '1 a retry of a deleted transfer did not replay it: ' || coalesce(v, 'null');

  -- A live transfer still replays.
  assert pg_temp.transfer_as(a, a1, a2, 5, 'p151-2') = 'moved 95.00 5.00', '1 A could not move a second transfer';
  v := pg_temp.transfer_as(a, a1, a2, 5, 'p151-2');
  assert v = 'reused 95.00 5.00', '1 a retry of a live transfer did not replay it: ' || coalesce(v, 'null');
end;
$replay$;
reset role;

-- -----------------------------------------------------------------------------
-- 2. The ledger: one row per key and account, the deleted one still deleted.
-- -----------------------------------------------------------------------------
do $ledger$
begin
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000015aa001') = 95.00, '2 A main is not 95.00';
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000015aa002') = 5.00, '2 A spare is not 5.00';
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000015bb001') = 50.00, '2 B main is not 50.00';
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000015bb002') = 0.00, '2 B spare is not 0.00';
  assert (select count(*) from public.transactions
           where user_id = '00000000-0000-4000-8000-000000151a01' and idempotency_key = 'p151-1') = 1,
    '2 A does not have exactly one row under p151-1';
  assert (select is_deleted from public.transactions
           where user_id = '00000000-0000-4000-8000-000000151a01' and idempotency_key = 'p151-1'),
    '2 the replay brought A''s deleted transfer back';
  assert (select count(*) from public.transactions where idempotency_key like 'p151-%') = 3,
    '2 not exactly three transfer rows';
end;
$ledger$;

-- -----------------------------------------------------------------------------
-- 3. One signature, its grants unchanged, neither lookup skipping a deleted
--    row, the Phase 151 body, and the advisor's count unchanged (ADR 0067).
-- -----------------------------------------------------------------------------
do $shape$
declare
  fn regprocedure := to_regprocedure('public.transfer_funds(uuid, uuid, numeric, text, text, date, text, boolean)');
begin
  assert fn is not null, '3 the session signature is missing';
  assert (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'transfer_funds') = 1,
    '3 not exactly one transfer_funds';
  assert (select prosecdef from pg_proc where oid = fn), '3 not security definer';
  assert (select proconfig from pg_proc where oid = fn) = array['search_path=public, pg_temp'], '3 search_path is not pinned';
  assert has_function_privilege('authenticated', fn, 'execute'), '3 authenticated cannot execute';
  assert not has_function_privilege('anon', fn, 'execute'), '3 anon can execute';
  assert (select position('and is_deleted = false' in prosrc) from pg_proc where oid = fn) = 0,
    '3 a lookup still skips soft-deleted rows';
  -- Carriage returns removed, as supabase/catalog.sql does: live's body has
  -- them (applied from a Windows checkout), a Linux replay does not.
  assert (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = fn) = '9923588c3826c0b5f6f4439236c552d6',
    '3 the body is not the Phase 151 one';
  assert (select count(*) from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prosecdef
             and has_function_privilege('authenticated', p.oid, 'execute')) = 11,
    '3 the advisor would not list exactly eleven SECURITY DEFINER functions';
end;
$shape$;

select 'PHASE 151 PROBE OK' as result;

rollback;
