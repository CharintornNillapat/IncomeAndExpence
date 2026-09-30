-- =============================================================================
-- Probe for 20260930_phase58s_profiles_hardening.sql (ADR 0032). NOTHING PERSISTS.
--
-- Same shape as the Phase 51 and 52 probes: one transaction ending in
-- ROLLBACK. Keep the `\ir` line to test the migration before it is applied;
-- delete it to test the deployed objects afterwards. A runner without psql
-- meta-commands pastes the migration's text in place of the `\ir` line.
--
-- Success is the final row, `PHASE 58S PROBE OK`.
--
-- Not covered: the trigger firing *as supabase_auth_admin* (this session
-- cannot assume that role). The probe proves the trigger fires on the auth
-- table's owner-level updates and that the role holds EXECUTE explicitly, the
-- same limit the Phase 52 probe records for handle_new_user.
-- =============================================================================

begin;

\ir ../migrations/20260930_phase58s_profiles_hardening.sql

-- -----------------------------------------------------------------------------
-- Fixture, as the table owner. Inserting the users also runs handle_new_user.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000058a001', 'phase58s-probe-a@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe A"}'),
  ('00000000-0000-4000-8000-00000058b001', 'phase58s-probe-b@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe B"}');

do $owner$
declare
  a uuid := '00000000-0000-4000-8000-00000058a001';
  b uuid := '00000000-0000-4000-8000-00000058b001';
begin
  -- 0. handle_new_user still creates the profile, with the metadata name.
  assert (select name from public.profiles where id = a) = 'Probe A', '0 signup did not create profile A';
  assert (select name from public.profiles where id = b) = 'Probe B', '0 signup did not create profile B';

  -- 1. Grants and policies.
  assert not exists (select 1 from pg_policy where polrelid = 'public.profiles'::regclass
                     and polname = 'Users can update their own profile'), '1 update policy still there';
  assert exists (select 1 from pg_policy where polrelid = 'public.profiles'::regclass
                 and polname = 'Users can view their own profile'), '1 select policy lost';
  assert (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), '1 RLS off';
  assert has_table_privilege('authenticated', 'public.profiles', 'select'), '1 authenticated lost select';
  assert not has_table_privilege('authenticated', 'public.profiles', 'insert'), '1 authenticated can insert';
  assert not has_table_privilege('authenticated', 'public.profiles', 'update'), '1 authenticated can update';
  assert not has_table_privilege('authenticated', 'public.profiles', 'delete'), '1 authenticated can delete';
  assert not has_table_privilege('authenticated', 'public.profiles', 'truncate'), '1 authenticated can truncate';
  assert not has_column_privilege('authenticated', 'public.profiles', 'role', 'update'), '1 authenticated can update role';
  assert not has_table_privilege('anon', 'public.profiles', 'select'), '1 anon can select';
  assert not has_table_privilege('anon', 'public.profiles', 'insert'), '1 anon can insert';
  assert not has_table_privilege('anon', 'public.profiles', 'update'), '1 anon can update';
  assert not has_table_privilege('anon', 'public.profiles', 'delete'), '1 anon can delete';
  assert has_table_privilege('service_role', 'public.profiles', 'update'), '1 service role lost update';

  -- 2. handle_user_updated is hardened like handle_new_user.
  assert (select prosecdef from pg_proc where oid = 'public.handle_user_updated()'::regprocedure), '2 not security definer';
  assert (select array_to_string(proconfig, ',') from pg_proc where oid = 'public.handle_user_updated()'::regprocedure)
         like '%search_path=public, pg_temp%', '2 search_path not pinned';
  assert not has_function_privilege('anon', 'public.handle_user_updated()', 'execute'), '2 anon can execute';
  assert not has_function_privilege('authenticated', 'public.handle_user_updated()', 'execute'), '2 authenticated can execute';
  assert has_function_privilege('supabase_auth_admin', 'public.handle_user_updated()', 'execute'), '2 auth admin cannot execute';
  assert (select count(*) from pg_trigger where tgrelid = 'auth.users'::regclass
          and tgname = 'on_auth_user_updated' and tgfoid = 'public.handle_user_updated()'::regprocedure) = 1,
    '2 trigger missing';
  assert (select count(*) from pg_trigger where tgrelid = 'auth.users'::regclass
          and tgname = 'on_auth_user_created') = 1, '2 signup trigger lost';
end;
$owner$;

-- -----------------------------------------------------------------------------
-- 3. As signed-in user A: every write to profiles is refused, reads unchanged.
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000058a001","role":"authenticated"}', true);

do $as_a$
declare
  a    uuid := '00000000-0000-4000-8000-00000058a001';
  b    uuid := '00000000-0000-4000-8000-00000058b001';
  code text;
begin
  code := null;
  begin update public.profiles set role = 'ADMIN' where id = a;
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '42501', '3 self-promotion to ADMIN was not refused (' || coalesce(code, 'no error') || ')';

  code := null;
  begin update public.profiles set email = 'someone-else@example.invalid' where id = a;
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '42501', '3 email rewrite was not refused (' || coalesce(code, 'no error') || ')';

  code := null;
  begin update public.profiles set name = 'Direct' where id = a;
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '42501', '3 name write was not refused (' || coalesce(code, 'no error') || ')';

  code := null;
  begin insert into public.profiles (id, email) values (gen_random_uuid(), 'x@example.invalid');
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '42501', '3 insert was not refused (' || coalesce(code, 'no error') || ')';

  code := null;
  begin delete from public.profiles where id = a;
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '42501', '3 delete was not refused (' || coalesce(code, 'no error') || ')';

  assert (select count(*) from public.profiles where id = a) = 1, '3 A cannot read own profile';
  assert (select count(*) from public.profiles where id = b) = 0, '3 A can read B''s profile';
  assert (select count(*) from public.profiles) = 1, '3 A sees more than one profile';
end;
$as_a$;

-- -----------------------------------------------------------------------------
-- 4. As anon: nothing.
-- -----------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $as_anon$
declare
  code text;
begin
  code := null;
  begin perform 1 from public.profiles;
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '42501', '4 anon select was not refused (' || coalesce(code, 'no error') || ')';
end;
$as_anon$;

-- -----------------------------------------------------------------------------
-- 5. The sync, as the auth table's owner (the auth service's stand-in).
-- -----------------------------------------------------------------------------
reset role;

do $sync$
declare
  a uuid := '00000000-0000-4000-8000-00000058a001';
  b uuid := '00000000-0000-4000-8000-00000058b001';
begin
  -- A rename through user metadata reaches the profile.
  update auth.users set raw_user_meta_data = raw_user_meta_data || '{"name":"Renamed A"}' where id = a;
  assert (select name from public.profiles where id = a) = 'Renamed A', '5 rename did not sync';

  -- An email change reaches the profile.
  update auth.users set email = 'phase58s-probe-a2@example.invalid' where id = a;
  assert (select email from public.profiles where id = a) = 'phase58s-probe-a2@example.invalid', '5 email did not sync';

  -- A null email keeps the old one, and the auth write succeeds.
  update auth.users set email = null where id = a;
  assert (select email from public.profiles where id = a) = 'phase58s-probe-a2@example.invalid', '5 null email overwrote';

  -- A removed or blank name keeps the old one.
  update auth.users set raw_user_meta_data = raw_user_meta_data - 'name' where id = a;
  assert (select name from public.profiles where id = a) = 'Renamed A', '5 removed name overwrote';
  update auth.users set raw_user_meta_data = raw_user_meta_data || '{"name":"   "}' where id = a;
  assert (select name from public.profiles where id = a) = 'Renamed A', '5 blank name overwrote';

  -- An unrelated update (a sign-in) does not fire it. The sentinel would be
  -- replaced by the metadata name if the trigger ran.
  update auth.users set raw_user_meta_data = raw_user_meta_data || '{"name":"Metadata A"}' where id = a;
  update public.profiles set name = 'Sentinel' where id = a;
  update auth.users set last_sign_in_at = now() where id = a;
  assert (select name from public.profiles where id = a) = 'Sentinel', '5 fired on an unrelated update';

  -- Another metadata key changing, with the name unchanged, does not fire it.
  update auth.users set raw_user_meta_data = raw_user_meta_data || '{"theme":"dark"}' where id = a;
  assert (select name from public.profiles where id = a) = 'Sentinel', '5 fired on an unrelated metadata key';

  -- B was never touched.
  assert (select name from public.profiles where id = b) = 'Probe B', '5 B changed';
  assert (select email from public.profiles where id = b) = 'phase58s-probe-b@example.invalid', '5 B email changed';
end;
$sync$;

select 'PHASE 58S PROBE OK' as result;

rollback;
