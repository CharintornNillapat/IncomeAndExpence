-- =============================================================================
-- Phase 88 probe (ADR 0064): consume_ai_quota() refuses an ended session, and
-- a wallet's currency defaults to THB.
--
-- Runs inside BEGIN ... ROLLBACK, so nothing it creates or writes survives.
-- Keep the `\ir` lines to test the migrations before they are applied; a
-- runner without psql pastes each file in its place. After they are applied,
-- remove the `\ir` lines and run the rest against the live schema. The unit
-- suite runs it on a replayed database (unit/migration-replay.test.ts).
--
-- Success is the final row, `PHASE 88 PROBE OK`.
-- =============================================================================

begin;

\ir ../migrations/20261005_phase88_quota_checks_session.sql
\ir ../migrations/20261005_wallet_default_thb.sql

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000088a001', 'phase88-probe-a@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe A"}'),
  ('00000000-0000-4000-8000-00000088b001', 'phase88-probe-b@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe B"}');

-- A has a live session and one whose time box has passed; B has a live one.
insert into auth.sessions (id, user_id, created_at, updated_at, not_after) values
  ('00000000-0000-4000-8000-0000008a5e01', '00000000-0000-4000-8000-00000088a001', now(), now(), null),
  ('00000000-0000-4000-8000-0000008a5e02', '00000000-0000-4000-8000-00000088a001', now(), now(), now() - interval '1 minute'),
  ('00000000-0000-4000-8000-0000008b5e01', '00000000-0000-4000-8000-00000088b001', now(), now(), null);

-- Calls consume_ai_quota() with these claims, as authenticated, and returns
-- the SQLSTATE it raised, or 'counted n'.
create function pg_temp.quota_as(p_claims text) returns text
language plpgsql
as $fn$
declare
  r jsonb;
begin
  perform set_config('request.jwt.claims', p_claims, true);
  r := public.consume_ai_quota();
  return 'counted ' || (r ->> 'count');
exception when others then
  return sqlstate;
end;
$fn$;
grant execute on function pg_temp.quota_as(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 1. Grants, unchanged from Phase 73.
-- -----------------------------------------------------------------------------
do $grants$
begin
  assert not has_function_privilege('anon', 'public.consume_ai_quota()', 'execute'), '1 anon can execute';
  assert has_function_privilege('authenticated', 'public.consume_ai_quota()', 'execute'), '1 authenticated cannot execute';
  assert (select prosecdef from pg_proc where oid = 'public.consume_ai_quota()'::regprocedure), '1 not security definer';
end;
$grants$;

-- -----------------------------------------------------------------------------
-- 2. Sessions, as authenticated.
-- -----------------------------------------------------------------------------
set local role authenticated;

do $sessions$
declare
  a text := '00000000-0000-4000-8000-00000088a001';
begin
  -- A live session of one's own account is counted.
  assert pg_temp.quota_as(format('{"sub":"%s","role":"authenticated","session_id":"00000000-0000-4000-8000-0000008a5e01"}', a)) = 'counted 1',
    '2 a live session was not counted';

  -- Every other session is refused, with 28000, before anything is counted.
  assert pg_temp.quota_as(format('{"sub":"%s","role":"authenticated"}', a)) = '28000',
    '2 a token with no session_id was counted';
  assert pg_temp.quota_as(format('{"sub":"%s","role":"authenticated","session_id":""}', a)) = '28000',
    '2 an empty session_id was counted';
  assert pg_temp.quota_as(format('{"sub":"%s","role":"authenticated","session_id":"00000000-0000-4000-8000-0000008a5e02"}', a)) = '28000',
    '2 a session past its not_after was counted';
  assert pg_temp.quota_as(format('{"sub":"%s","role":"authenticated","session_id":"00000000-0000-4000-8000-0000008b5e01"}', a)) = '28000',
    '2 another account''s session was counted';
  assert pg_temp.quota_as(format('{"sub":"%s","role":"authenticated","session_id":"00000000-0000-4000-8000-000000000000"}', a)) = '28000',
    '2 an unknown session was counted';
  -- Not a uuid: the cast fails, so the call fails; the proxies check the
  -- claim's shape before they get here.
  assert pg_temp.quota_as(format('{"sub":"%s","role":"authenticated","session_id":"not-a-uuid"}', a)) <> 'counted 2',
    '2 a malformed session_id was counted';

  -- None of the refusals counted.
  assert pg_temp.quota_as(format('{"sub":"%s","role":"authenticated","session_id":"00000000-0000-4000-8000-0000008a5e01"}', a)) = 'counted 2',
    '2 a refused call was counted';
end;
$sessions$;

reset role;

-- Signing out deletes the session row; the next call is refused.
delete from auth.sessions where id = '00000000-0000-4000-8000-0000008a5e01';

set local role authenticated;
do $revoked$
begin
  assert pg_temp.quota_as('{"sub":"00000000-0000-4000-8000-00000088a001","role":"authenticated","session_id":"00000000-0000-4000-8000-0000008a5e01"}') = '28000',
    '2 a signed-out session was counted';
end;
$revoked$;
reset role;

-- -----------------------------------------------------------------------------
-- 3. A wallet's currency defaults to THB, and no wallet in use holds another
--    (four soft-deleted ones on live still say USD; see the migration).
-- -----------------------------------------------------------------------------
do $currency$
declare
  v_currency text;
begin
  assert (select pg_get_expr(d.adbin, d.adrelid)
            from pg_attrdef d
            join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
           where d.adrelid = 'public.wallets'::regclass and a.attname = 'currency') = '''THB''::text',
    '3 the default is not THB';

  insert into public.wallets (user_id, name, type)
  values ('00000000-0000-4000-8000-00000088a001', 'Phase 88 probe', 'CASH')
  returning currency into v_currency;
  assert v_currency = 'THB', '3 a wallet without a currency got ' || v_currency;

  assert not exists (select 1 from public.wallets where currency <> 'THB' and not is_deleted),
    '3 a wallet in use holds a currency other than THB';
end;
$currency$;

select 'PHASE 88 PROBE OK' as result;

rollback;
