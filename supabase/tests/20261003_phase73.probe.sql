-- =============================================================================
-- Phase 73 probe (ADR 0049): consume_ai_quota() and its table.
--
-- Runs inside BEGIN ... ROLLBACK, so nothing it creates or writes survives.
-- Keep the `\ir` line to test the migration before it is applied; a runner
-- without psql pastes the migration in its place. After it is applied, remove
-- the `\ir` line and run the rest against the live schema.
--
-- Success is the final row, `PHASE 73 PROBE OK`.
-- =============================================================================

begin;

\ir ../migrations/20261003_phase73_ai_request_quota.sql

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000073a001', 'phase73-probe-a@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe A"}'),
  ('00000000-0000-4000-8000-00000073b001', 'phase73-probe-b@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe B"}');

-- -----------------------------------------------------------------------------
-- 1. Grants: the function is authenticated-only; the table has no client grant.
-- -----------------------------------------------------------------------------
do $grants$
begin
  assert not has_function_privilege('anon', 'public.consume_ai_quota()', 'execute'), '1 anon can execute';
  assert has_function_privilege('authenticated', 'public.consume_ai_quota()', 'execute'), '1 authenticated cannot execute';
  assert not has_table_privilege('authenticated', 'public.ai_request_counts', 'select'), '1 authenticated can read the table';
  assert not has_table_privilege('authenticated', 'public.ai_request_counts', 'insert'), '1 authenticated can write the table';
  assert not has_table_privilege('anon', 'public.ai_request_counts', 'select'), '1 anon can read the table';
  assert (select relrowsecurity from pg_class where oid = 'public.ai_request_counts'::regclass), '1 RLS is off';
  assert (select prosecdef from pg_proc where oid = 'public.consume_ai_quota()'::regprocedure), '1 not security definer';
end;
$grants$;

-- -----------------------------------------------------------------------------
-- 2. As each user.
-- -----------------------------------------------------------------------------
set local role authenticated;

-- No session: it refuses, loudly.
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $nosession$
declare
  failed boolean := false;
begin
  begin
    perform public.consume_ai_quota();
  exception when sqlstate '28000' then
    failed := true;
  end;
  assert failed, '2 counted without a session';
end;
$nosession$;

-- A: counts 1, 2, ... 121, with a retry_after inside the minute.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000073a001","role":"authenticated"}', true);
do $a$
declare
  r jsonb;
begin
  r := public.consume_ai_quota();
  assert (r->>'count')::int = 1, '2 A first count is ' || (r->>'count');
  assert (r->>'retry_after')::int between 1 and 60, '2 A retry_after is ' || (r->>'retry_after');
  for i in 2..121 loop
    r := public.consume_ai_quota();
  end loop;
  assert (r->>'count')::int = 121, '2 A 121st count is ' || (r->>'count');
end;
$a$;

-- The table is closed to the caller, even for its own row.
do $direct$
declare
  failed boolean := false;
begin
  begin
    perform 1 from public.ai_request_counts;
  exception when insufficient_privilege then
    failed := true;
  end;
  assert failed, '2 authenticated read the table directly';
end;
$direct$;

-- B: its own count, untouched by A's.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000073b001","role":"authenticated"}', true);
do $b$
begin
  assert (public.consume_ai_quota()->>'count')::int = 1, '2 B shares A''s count';
end;
$b$;

reset role;

-- -----------------------------------------------------------------------------
-- 3. The window turns over. now() is fixed inside a transaction, so move A's
--    row back a minute as the table owner and count again.
-- -----------------------------------------------------------------------------
update public.ai_request_counts
   set window_start = window_start - interval '1 minute'
 where user_id = '00000000-0000-4000-8000-00000073a001';
insert into public.ai_request_counts (user_id, window_start, request_count)
values ('00000000-0000-4000-8000-00000073a001', date_trunc('minute', now()) - interval '5 minutes', 7);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000073a001","role":"authenticated"}', true);
do $rollover$
begin
  assert (public.consume_ai_quota()->>'count')::int = 1, '3 A did not start a new window';
end;
$rollover$;
reset role;

do $cleanup$
begin
  assert (select count(*) from public.ai_request_counts
           where user_id = '00000000-0000-4000-8000-00000073a001') = 1,
         '3 earlier windows were not deleted';
  assert (select count(*) from public.ai_request_counts) >= 2, '3 B''s row went with A''s';
end;
$cleanup$;

-- -----------------------------------------------------------------------------
-- 4. Deleting an account removes its count.
-- -----------------------------------------------------------------------------
delete from auth.users where id = '00000000-0000-4000-8000-00000073b001';
do $cascade$
begin
  assert not exists (select 1 from public.ai_request_counts
                      where user_id = '00000000-0000-4000-8000-00000073b001'), '4 count outlived its account';
end;
$cascade$;

select 'PHASE 73 PROBE OK' as result;

rollback;
