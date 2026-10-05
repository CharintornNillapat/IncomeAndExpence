-- =============================================================================
-- Phase 93 probe (ADR 0069): the redundant SELECT policies are gone, and
-- transfer_funds takes the user from the session alone, beside the 20260909
-- signature that older clients still call.
--
-- Runs inside BEGIN ... ROLLBACK, so nothing it creates or writes survives.
-- Keep the `\ir` lines to test the migrations before they are applied; a
-- runner without psql pastes each file in its place. After they are applied,
-- remove the `\ir` lines and run the rest against the live schema. The unit
-- suite runs it on a replayed database (unit/migration-replay.test.ts).
--
-- Success is the final row, `PHASE 93 PROBE OK`.
-- =============================================================================

begin;

\ir ../migrations/20261006_phase93_drop_redundant_select_policies.sql
\ir ../migrations/20261006_phase93_transfer_funds_from_session.sql

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000093a001', 'phase93-probe-a@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe A"}'),
  ('00000000-0000-4000-8000-00000093b001', 'phase93-probe-b@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe B"}');

-- A has two wallets, B has one.
insert into public.wallets (id, user_id, name, type, balance) values
  ('00000000-0000-4000-8000-0000009aa001', '00000000-0000-4000-8000-00000093a001', 'A main', 'CASH', 100.00),
  ('00000000-0000-4000-8000-0000009aa002', '00000000-0000-4000-8000-00000093a001', 'A spare', 'CASH', 0.00),
  ('00000000-0000-4000-8000-0000009bb001', '00000000-0000-4000-8000-00000093b001', 'B main', 'CASH', 50.00);

-- A category and a keyword rule of A's, and one category with no owner (none
-- exists on live; this one shows what the dropped policy used to add).
insert into public.categories (id, user_id, name, type) values
  ('00000000-0000-4000-8000-0000009ac001', '00000000-0000-4000-8000-00000093a001', 'Phase 93 A', 'EXPENSE'),
  ('00000000-0000-4000-8000-0000009c0001', null, 'Phase 93 ownerless', 'EXPENSE');
insert into public.keyword_rules (user_id, keyword, category_id) values
  ('00000000-0000-4000-8000-00000093a001', 'phase93kw', '00000000-0000-4000-8000-0000009ac001');

-- Calls a transfer as whoever the claims name, as authenticated, and returns
-- the SQLSTATE it raised, or what it did. `p_as_old` uses the 20260909
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
  return sqlstate;
end;
$fn$;
grant execute on function pg_temp.transfer_as(text, uuid, uuid, numeric, text, boolean, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 1. The policies: each table keeps "manage their own" and nothing else, and
--    no row is ownerless but the probe's own.
-- -----------------------------------------------------------------------------
do $policies$
begin
  assert (select array_agg(polname order by polname) from pg_policy where polrelid = 'public.categories'::regclass)
         = array['Users can manage their own categories']::name[],
    '1 categories has another policy';
  assert (select array_agg(polname order by polname) from pg_policy where polrelid = 'public.keyword_rules'::regclass)
         = array['Users can manage their own keyword rules']::name[],
    '1 keyword_rules has another policy';
  assert not exists (select 1 from public.categories where user_id is null and id <> '00000000-0000-4000-8000-0000009c0001'),
    '1 a category has no owner';
  assert not exists (select 1 from public.keyword_rules where user_id is null),
    '1 a keyword rule has no owner';
end;
$policies$;

-- As A: A's own rows, and not the ownerless one.
set local role authenticated;
do $reads$
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000093a001","role":"authenticated"}', true);
  assert (select count(*) from public.categories where name like 'Phase 93%') = 1, '1 A does not read exactly its own category';
  assert exists (select 1 from public.categories where id = '00000000-0000-4000-8000-0000009ac001'), '1 A cannot read its own category';
  assert (select count(*) from public.keyword_rules where keyword = 'phase93kw') = 1, '1 A cannot read its own keyword rule';
end;
$reads$;
reset role;

-- -----------------------------------------------------------------------------
-- 2. Both signatures, their grants and their shape.
-- -----------------------------------------------------------------------------
do $grants$
declare
  v_new text := 'public.transfer_funds(uuid, uuid, numeric, text, text, date, text, boolean)';
  v_old text := 'public.transfer_funds(uuid, uuid, uuid, numeric, text, text, date, text, boolean)';
begin
  assert to_regprocedure(v_new) is not null, '2 the new signature is missing';
  assert to_regprocedure(v_old) is not null, '2 the 20260909 signature is gone';
  assert not has_function_privilege('anon', v_new, 'execute'), '2 anon can execute the new one';
  assert has_function_privilege('authenticated', v_new, 'execute'), '2 authenticated cannot execute the new one';
  assert not has_function_privilege('anon', v_old, 'execute'), '2 anon can execute the old one';
  assert (select prosecdef from pg_proc where oid = v_new::regprocedure), '2 the new one is not security definer';
  assert (select proconfig from pg_proc where oid = v_new::regprocedure) = array['search_path=public, pg_temp'],
    '2 the new one has no pinned search_path';
end;
$grants$;

-- -----------------------------------------------------------------------------
-- 3. The new signature, as authenticated.
-- -----------------------------------------------------------------------------
set local role authenticated;
do $transfers$
declare
  a     text := '{"sub":"00000000-0000-4000-8000-00000093a001","role":"authenticated"}';
  a1    uuid := '00000000-0000-4000-8000-0000009aa001';
  a2    uuid := '00000000-0000-4000-8000-0000009aa002';
  b1    uuid := '00000000-0000-4000-8000-0000009bb001';
begin
  -- No session: refused.
  assert pg_temp.transfer_as('{}', a1, a2, 10, 'p93-none') = '42501', '3 a call with no session was not refused';

  -- A moves its own money, and a retry with the same key replays.
  assert pg_temp.transfer_as(a, a1, a2, 10.004, 'p93-1') = 'moved 90.00 10.00', '3 A could not move its own money';
  assert pg_temp.transfer_as(a, a1, a2, 10, 'p93-1') = 'reused 90.00 10.00', '3 a retry did not replay';

  -- Another account's wallet, on either side: not found, and nothing moved.
  assert pg_temp.transfer_as(a, a1, b1, 5, 'p93-2') = 'P0002', '3 A paid into B''s wallet';
  assert pg_temp.transfer_as(a, b1, a1, 5, 'p93-3') = 'P0002', '3 A took from B''s wallet';

  -- The usual refusals.
  assert pg_temp.transfer_as(a, a1, a1, 5, 'p93-4') = '22023', '3 a transfer to the same wallet passed';
  assert pg_temp.transfer_as(a, a1, a2, 0, 'p93-5') = '22023', '3 a zero transfer passed';
end;
$transfers$;
reset role;

do $ledger$
begin
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000009aa001') = 90.00, '3 A main is not 90.00';
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000009aa002') = 10.00, '3 A spare is not 10.00';
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000009bb001') = 50.00, '3 B main moved';
  assert (select count(*) from public.transactions where idempotency_key like 'p93-%') = 1, '3 not exactly one transfer row';
  assert (select created_by = user_id::text and user_id = '00000000-0000-4000-8000-00000093a001'
            from public.transactions where idempotency_key = 'p93-1'), '3 the row is not A''s';
end;
$ledger$;

-- -----------------------------------------------------------------------------
-- 4. The 20260909 signature still works for an older client, and still
--    refuses another account's id.
-- -----------------------------------------------------------------------------
set local role authenticated;
do $old$
declare
  a  text := '{"sub":"00000000-0000-4000-8000-00000093a001","role":"authenticated"}';
  ua uuid := '00000000-0000-4000-8000-00000093a001';
  ub uuid := '00000000-0000-4000-8000-00000093b001';
  a1 uuid := '00000000-0000-4000-8000-0000009aa001';
  a2 uuid := '00000000-0000-4000-8000-0000009aa002';
  b1 uuid := '00000000-0000-4000-8000-0000009bb001';
begin
  assert pg_temp.transfer_as(a, a2, a1, 4, 'p93-old-1', true, ua) = 'moved 6.00 94.00', '4 the old signature no longer moves A''s money';
  assert pg_temp.transfer_as(a, b1, a1, 4, 'p93-old-2', true, ub) = '42501', '4 the old signature let A act as B';
end;
$old$;
reset role;

select 'PHASE 93 PROBE OK' as result;

rollback;
