-- =============================================================================
-- Phase 96 probe (ADR 0072): delete_user_account() erases the caller's whole
-- account, and nobody else's, and only when asked with the exact phrase.
--
-- Runs inside BEGIN ... ROLLBACK, so nothing it creates or deletes survives.
-- Keep the `\ir` line to test the migration before it is applied; a runner
-- without psql pastes the file in its place. After it is applied, remove the
-- `\ir` line and run the rest against the live schema. The unit suite runs it
-- on a replayed database (unit/migration-replay.test.ts).
--
-- Success is the final row, `PHASE 96 PROBE OK`.
-- =============================================================================

begin;

\ir ../migrations/20261006_phase96_delete_user_account.sql

-- Two accounts with a row in every table that holds a user's data. The
-- profiles rows come from handle_new_user, as on a real sign-up.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000096a001', 'phase96-probe-a@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe A"}'),
  ('00000000-0000-4000-8000-00000096b001', 'phase96-probe-b@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe B"}');

insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000009a5e01', '00000000-0000-4000-8000-00000096a001', now(), now()),
  ('00000000-0000-4000-8000-0000009a5e02', '00000000-0000-4000-8000-00000096a001', now(), now()),
  ('00000000-0000-4000-8000-0000009b5e01', '00000000-0000-4000-8000-00000096b001', now(), now());

insert into public.wallets (id, user_id, name, type, balance) values
  ('00000000-0000-4000-8000-0000096aa001', '00000000-0000-4000-8000-00000096a001', 'A main', 'CASH', 100.00),
  ('00000000-0000-4000-8000-0000096aa002', '00000000-0000-4000-8000-00000096a001', 'A old', 'CASH', 0.00),
  ('00000000-0000-4000-8000-0000096bb001', '00000000-0000-4000-8000-00000096b001', 'B main', 'CASH', 50.00);
update public.wallets set is_deleted = true where id = '00000000-0000-4000-8000-0000096aa002';

insert into public.categories (id, user_id, name, type) values
  ('00000000-0000-4000-8000-0000096ac001', '00000000-0000-4000-8000-00000096a001', 'Phase 96 A', 'EXPENSE'),
  ('00000000-0000-4000-8000-0000096bc001', '00000000-0000-4000-8000-00000096b001', 'Phase 96 B', 'EXPENSE');

insert into public.keyword_rules (user_id, keyword, category_id) values
  ('00000000-0000-4000-8000-00000096a001', 'phase96a', '00000000-0000-4000-8000-0000096ac001'),
  ('00000000-0000-4000-8000-00000096b001', 'phase96b', '00000000-0000-4000-8000-0000096bc001');

insert into public.debts (id, user_id, name, total_amount, remaining_amount) values
  ('00000000-0000-4000-8000-0000096ad001', '00000000-0000-4000-8000-00000096a001', 'A loan', 1000.00, 400.00),
  ('00000000-0000-4000-8000-0000096bd001', '00000000-0000-4000-8000-00000096b001', 'B loan', 500.00, 500.00);

-- A's rows include a soft-deleted one: erasure takes those too.
insert into public.transactions (id, user_id, wallet_id, amount, type, description, category_id, debt_id, is_deleted) values
  ('00000000-0000-4000-8000-0000096a7001', '00000000-0000-4000-8000-00000096a001', '00000000-0000-4000-8000-0000096aa001', 60.00, 'EXPENSE', 'A lunch', '00000000-0000-4000-8000-0000096ac001', null, false),
  ('00000000-0000-4000-8000-0000096a7002', '00000000-0000-4000-8000-00000096a001', '00000000-0000-4000-8000-0000096aa001', 600.00, 'DEBT_REPAYMENT', 'A repay', null, '00000000-0000-4000-8000-0000096ad001', false),
  ('00000000-0000-4000-8000-0000096a7003', '00000000-0000-4000-8000-00000096a001', '00000000-0000-4000-8000-0000096aa002', 5.00, 'EXPENSE', 'A deleted', null, null, true),
  ('00000000-0000-4000-8000-0000096b7001', '00000000-0000-4000-8000-00000096b001', '00000000-0000-4000-8000-0000096bb001', 20.00, 'EXPENSE', 'B lunch', '00000000-0000-4000-8000-0000096bc001', null, false);

insert into public.diary_entries (user_id, date, mood, food_quality) values
  ('00000000-0000-4000-8000-00000096a001', '2026-10-05', 4, 'HEALTHY'),
  ('00000000-0000-4000-8000-00000096b001', '2026-10-05', 3, 'AVERAGE');

insert into public.ai_request_counts (user_id, window_start, request_count) values
  ('00000000-0000-4000-8000-00000096a001', date_trunc('minute', now()), 3),
  ('00000000-0000-4000-8000-00000096b001', date_trunc('minute', now()), 1);

-- Every row of one account, across every table that holds an account's data.
create function pg_temp.rows_of(p_user uuid) returns jsonb
language sql
as $fn$
  select jsonb_build_object(
    'users',         (select count(*) from auth.users               where id = p_user),
    'sessions',      (select count(*) from auth.sessions            where user_id = p_user),
    'profiles',      (select count(*) from public.profiles          where id = p_user),
    'wallets',       (select count(*) from public.wallets           where user_id = p_user),
    'transactions',  (select count(*) from public.transactions      where user_id = p_user),
    'debts',         (select count(*) from public.debts             where user_id = p_user),
    'categories',    (select count(*) from public.categories        where user_id = p_user),
    'keyword_rules', (select count(*) from public.keyword_rules     where user_id = p_user),
    'diary_entries', (select count(*) from public.diary_entries     where user_id = p_user),
    'ai_requests',   (select count(*) from public.ai_request_counts where user_id = p_user)
  );
$fn$;

-- Calls the function as whoever the claims name, as authenticated, and returns
-- the SQLSTATE it raised, or its answer.
create function pg_temp.delete_as(p_claims text, p_confirm text) returns text
language plpgsql
as $fn$
begin
  perform set_config('request.jwt.claims', p_claims, true);
  return public.delete_user_account(p_confirm)::text;
exception when others then
  return sqlstate;
end;
$fn$;
grant execute on function pg_temp.delete_as(text, text) to authenticated;

do $before$
begin
  assert pg_temp.rows_of('00000000-0000-4000-8000-00000096a001')
         = '{"users":1,"sessions":2,"profiles":1,"wallets":2,"transactions":3,"debts":1,"categories":1,"keyword_rules":1,"diary_entries":1,"ai_requests":1}'::jsonb,
    '0 the probe did not set up account A';
end;
$before$;

-- -----------------------------------------------------------------------------
-- 1. Shape: SECURITY DEFINER, search_path pinned, authenticated only.
-- -----------------------------------------------------------------------------
do $shape$
declare
  fn regprocedure := 'public.delete_user_account(text)'::regprocedure;
begin
  assert (select prosecdef from pg_proc where oid = fn), '1 not security definer';
  assert (select proconfig from pg_proc where oid = fn) = array['search_path=public, pg_temp'], '1 search_path not pinned';
  assert has_function_privilege('authenticated', fn, 'execute'), '1 authenticated cannot execute';
  assert not has_function_privilege('anon', fn, 'execute'), '1 anon can execute';
  assert not exists (
    select 1 from information_schema.routine_privileges
    where specific_name like 'delete_user_account%' and grantee = 'PUBLIC'
  ), '1 PUBLIC can execute';
end;
$shape$;

-- -----------------------------------------------------------------------------
-- 2. Refusals change nothing.
-- -----------------------------------------------------------------------------
set local role authenticated;
do $refusals$
declare
  a constant text := '{"sub":"00000000-0000-4000-8000-00000096a001","role":"authenticated"}';
begin
  assert pg_temp.delete_as('', 'DELETE') = '42501', '2 a call with no session was not refused';
  assert pg_temp.delete_as(a, null) = '22023', '2 a call with no phrase was not refused';
  assert pg_temp.delete_as(a, 'delete') = '22023', '2 a lower-case phrase was accepted';
  assert pg_temp.delete_as(a, ' DELETE') = '22023', '2 a padded phrase was accepted';
end;
$refusals$;
reset role;

do $unchanged$
begin
  assert pg_temp.rows_of('00000000-0000-4000-8000-00000096a001')
         = '{"users":1,"sessions":2,"profiles":1,"wallets":2,"transactions":3,"debts":1,"categories":1,"keyword_rules":1,"diary_entries":1,"ai_requests":1}'::jsonb,
    '2 a refused call changed account A';
end;
$unchanged$;

-- -----------------------------------------------------------------------------
-- 3. A deletes A: every row of A goes, soft-deleted ones too; B keeps all of B.
-- -----------------------------------------------------------------------------
create temp table probe_result (answer text);
grant insert on probe_result to authenticated;
set local role authenticated;
insert into probe_result
  select pg_temp.delete_as('{"sub":"00000000-0000-4000-8000-00000096a001","role":"authenticated"}', 'DELETE');
reset role;

do $deleted$
declare
  b_before constant jsonb := '{"users":1,"sessions":1,"profiles":1,"wallets":1,"transactions":1,"debts":1,"categories":1,"keyword_rules":1,"diary_entries":1,"ai_requests":1}';
begin
  assert (select answer from probe_result)::jsonb
         = '{"deleted":true,"rows":{"wallets":2,"transactions":3,"debts":1,"categories":1,"keyword_rules":1,"diary_entries":1}}'::jsonb,
    '3 the answer is not the account''s row counts: ' || (select answer from probe_result);
  assert pg_temp.rows_of('00000000-0000-4000-8000-00000096a001')
         = '{"users":0,"sessions":0,"profiles":0,"wallets":0,"transactions":0,"debts":0,"categories":0,"keyword_rules":0,"diary_entries":0,"ai_requests":0}'::jsonb,
    '3 a row of account A survived: ' || pg_temp.rows_of('00000000-0000-4000-8000-00000096a001')::text;
  assert pg_temp.rows_of('00000000-0000-4000-8000-00000096b001') = b_before,
    '3 account B lost a row: ' || pg_temp.rows_of('00000000-0000-4000-8000-00000096b001')::text;
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000096bb001') = 50.00,
    '3 account B''s balance moved';
end;
$deleted$;

-- -----------------------------------------------------------------------------
-- 4. The deleted account's token, still valid until it expires, can neither
--    delete again nor write a row: every table's user_id references auth.users.
-- -----------------------------------------------------------------------------
set local role authenticated;
do $after$
declare
  a constant text := '{"sub":"00000000-0000-4000-8000-00000096a001","role":"authenticated"}';
begin
  assert pg_temp.delete_as(a, 'DELETE') = 'P0002', '4 a second delete did not say there is no account';
  perform set_config('request.jwt.claims', a, true);
  begin
    insert into public.wallets (name, type, balance) values ('ghost', 'CASH', 0);
    assert false, '4 the deleted account wrote a wallet';
  exception when foreign_key_violation then
    null;
  end;
end;
$after$;
reset role;

select 'PHASE 96 PROBE OK' as result;

rollback;
