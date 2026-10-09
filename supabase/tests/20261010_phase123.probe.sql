-- =============================================================================
-- Phase 123 probe (ADR 0099): anon holds nothing on the six ledger tables, and
-- authenticated holds only SELECT, INSERT, UPDATE and DELETE on them. The app's
-- own paths (direct table reads and writes under RLS, the ledger functions)
-- still work for a signed-in caller.
--
-- Runs inside BEGIN ... ROLLBACK, so nothing it creates or writes survives.
-- Keep the `\ir` line to test the migration before it is applied; a runner
-- without psql pastes the file in its place. After it is applied, remove the
-- `\ir` line and run the rest against the live schema. The unit suite runs it
-- on a replayed database (unit/migration-replay.test.ts).
--
-- Success is the final row, `PHASE 123 PROBE OK`.
-- =============================================================================

begin;

\ir ../migrations/20261010_phase123_revoke_client_table_grants.sql

-- -----------------------------------------------------------------------------
-- 1. The grants: anon nothing, authenticated the four row privileges, the
--    service role untouched, and the two tables earlier phases closed as they
--    were.
-- -----------------------------------------------------------------------------
do $grants$
declare
  tbl text;
  priv text;
begin
  foreach tbl in array array['wallets', 'transactions', 'debts', 'categories', 'diary_entries', 'keyword_rules'] loop
    foreach priv in array array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'] loop
      assert not has_table_privilege('anon', 'public.' || tbl, priv),
        format('1 anon can %s on %s', priv, tbl);
      assert has_table_privilege('service_role', 'public.' || tbl, priv),
        format('1 service_role lost %s on %s', priv, tbl);
    end loop;
    foreach priv in array array['select', 'insert', 'update', 'delete'] loop
      assert has_table_privilege('authenticated', 'public.' || tbl, priv),
        format('1 authenticated lost %s on %s', priv, tbl);
    end loop;
    foreach priv in array array['truncate', 'references', 'trigger'] loop
      assert not has_table_privilege('authenticated', 'public.' || tbl, priv),
        format('1 authenticated can %s on %s', priv, tbl);
    end loop;
    assert (select relrowsecurity from pg_class where oid = ('public.' || tbl)::regclass),
      format('1 row-level security is off on %s', tbl);
  end loop;

  assert not has_table_privilege('anon', 'public.profiles', 'select'), '1 anon can read profiles';
  assert has_table_privilege('authenticated', 'public.profiles', 'select'), '1 authenticated lost select on profiles';
  assert not has_table_privilege('authenticated', 'public.profiles', 'update'), '1 authenticated can update profiles';
  assert not has_table_privilege('anon', 'public.ai_request_counts', 'select'), '1 anon can read ai_request_counts';
  assert not has_table_privilege('authenticated', 'public.ai_request_counts', 'select'), '1 authenticated can read ai_request_counts';

  -- What the advisor lists (ADR 0098) is unchanged: grants on tables are not
  -- function grants.
  assert (select count(*) from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prosecdef
             and has_function_privilege('authenticated', p.oid, 'execute')) = 10,
    '1 the advisor would not list exactly ten SECURITY DEFINER functions';
end;
$grants$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000123a01', 'phase123-probe-a@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe A"}'),
  ('00000000-0000-4000-8000-000000123b01', 'phase123-probe-b@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe B"}');

insert into public.wallets (id, user_id, name, type, balance) values
  ('00000000-0000-4000-8000-0000012aa001', '00000000-0000-4000-8000-000000123a01', 'A main', 'CASH', 100.00),
  ('00000000-0000-4000-8000-0000012aa002', '00000000-0000-4000-8000-000000123a01', 'A spare', 'CASH', 0.00),
  ('00000000-0000-4000-8000-0000012bb001', '00000000-0000-4000-8000-000000123b01', 'B main', 'CASH', 50.00);

-- -----------------------------------------------------------------------------
-- 2. As anon (a request with the anon key and no session): every table read
--    and write is refused, where before it was let through to RLS and saw
--    nothing.
-- -----------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $as_anon$
declare
  tbl text;
  code text;
begin
  foreach tbl in array array['wallets', 'transactions', 'debts', 'categories', 'diary_entries', 'keyword_rules'] loop
    code := null;
    begin execute format('select 1 from public.%I', tbl);
    exception when others then get stacked diagnostics code = returned_sqlstate; end;
    assert code = '42501', format('2 anon select on %s was not refused (%s)', tbl, coalesce(code, 'no error'));
  end loop;

  code := null;
  begin
    insert into public.wallets (user_id, name, type, balance)
    values ('00000000-0000-4000-8000-000000123a01', 'anon wallet', 'CASH', 0);
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '42501', '2 anon insert was not refused (' || coalesce(code, 'no error') || ')';
end;
$as_anon$;

reset role;

-- -----------------------------------------------------------------------------
-- 3. As A, signed in: the app's direct table paths still work under RLS, B's
--    rows stay out of reach, TRUNCATE is refused, and a ledger function still
--    moves A's money.
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000123a01","role":"authenticated"}', true);

do $as_a$
declare
  code text;
  r jsonb;
begin
  assert (select count(*) from public.wallets) = 2, '3 A does not see exactly its two wallets';

  update public.wallets set name = 'A renamed' where id = '00000000-0000-4000-8000-0000012aa001';
  assert (select name from public.wallets where id = '00000000-0000-4000-8000-0000012aa001') = 'A renamed',
    '3 A could not rename its wallet';

  insert into public.diary_entries (user_id, date, mood, food_quality)
  values ('00000000-0000-4000-8000-000000123a01', '2026-10-10', 4, 'AVERAGE');
  delete from public.diary_entries where user_id = '00000000-0000-4000-8000-000000123a01';

  update public.wallets set name = 'B renamed' where id = '00000000-0000-4000-8000-0000012bb001';

  code := null;
  begin truncate public.transactions;
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '42501', '3 truncate was not refused (' || coalesce(code, 'no error') || ')';

  r := public.transfer_funds(p_source_wallet_id => '00000000-0000-4000-8000-0000012aa001',
         p_dest_wallet_id => '00000000-0000-4000-8000-0000012aa002',
         p_amount => 10, p_idempotency_key => 'p123-1');
  assert (r ->> 'source_balance')::numeric = 90.00 and (r ->> 'dest_balance')::numeric = 10.00,
    '3 transfer_funds did not move A''s money';
end;
$as_a$;

reset role;

do $after$
begin
  assert (select name from public.wallets where id = '00000000-0000-4000-8000-0000012bb001') = 'B main',
    '3 A renamed B''s wallet';
  assert (select count(*) from public.transactions where idempotency_key = 'p123-1') = 1,
    '3 not exactly one transfer row';
end;
$after$;

select 'PHASE 123 PROBE OK' as result;

rollback;
