-- =============================================================================
-- Probe for Phase 64 (ADR 0039). NOTHING PERSISTS.
--   - 20261002_phase64_seed_starter_account.sql: seed_starter_account()
--   - 20261002_phase64_dedupe_categories.sql: soft-delete duplicate categories
--
-- Same shape as the earlier probes: one transaction ending in ROLLBACK. Keep
-- the `\ir` lines to test the migrations before they are applied; a runner
-- without psql meta-commands pastes each migration's text in place of its
-- `\ir` line. The dedupe runs over every account inside this transaction, so
-- the assertions look at the fixture accounts only.
--
-- Success is the final row, `PHASE 64 PROBE OK`.
-- =============================================================================

begin;

\ir ../migrations/20261002_phase64_seed_starter_account.sql

-- -----------------------------------------------------------------------------
-- Fixture, as the table owner.
--   A: a brand-new account, nothing at all.
--   B: only a deleted wallet.          C: only a deleted category.
--   D: duplicates to collapse.          E: D's names in another account.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000064a001', 'phase64-probe-a@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe A"}'),
  ('00000000-0000-4000-8000-00000064b001', 'phase64-probe-b@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe B"}'),
  ('00000000-0000-4000-8000-00000064c001', 'phase64-probe-c@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe C"}'),
  ('00000000-0000-4000-8000-00000064d001', 'phase64-probe-d@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe D"}'),
  ('00000000-0000-4000-8000-00000064e001', 'phase64-probe-e@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe E"}');

insert into public.wallets (user_id, name, type, currency, color, is_deleted) values
  ('00000000-0000-4000-8000-00000064b001', 'Gone', 'CASH', 'THB', '#D9A066', true),
  ('00000000-0000-4000-8000-00000064d001', 'Main', 'CASH', 'THB', '#D9A066', false);
insert into public.categories (user_id, name, type, color, is_deleted) values
  ('00000000-0000-4000-8000-00000064c001', 'Gone', 'EXPENSE', '#D9A066', true);

-- D: Food & Dining three times live (the first is the winner), once deleted
-- (older, must stay deleted and untouched), and Pets once.
insert into public.categories (id, user_id, name, type, color, is_deleted, created_at) values
  ('00000000-0000-4000-8000-00000064d0f0', '00000000-0000-4000-8000-00000064d001', 'Food & Dining', 'EXPENSE', '#E879A6', true,  '2026-08-01'),
  ('00000000-0000-4000-8000-00000064d0f1', '00000000-0000-4000-8000-00000064d001', 'Food & Dining', 'EXPENSE', '#E879A6', false, '2026-08-31'),
  ('00000000-0000-4000-8000-00000064d0f2', '00000000-0000-4000-8000-00000064d001', ' food & dining', 'EXPENSE', '#E879A6', false, '2026-09-20'),
  ('00000000-0000-4000-8000-00000064d0f3', '00000000-0000-4000-8000-00000064d001', 'Food & Dining', 'EXPENSE', '#E879A6', false, '2026-09-22'),
  ('00000000-0000-4000-8000-00000064d0a1', '00000000-0000-4000-8000-00000064d001', 'Pets', 'EXPENSE', '#D9A066', false, '2026-09-01'),
  ('00000000-0000-4000-8000-00000064e0f1', '00000000-0000-4000-8000-00000064e001', 'Food & Dining', 'EXPENSE', '#E879A6', false, '2026-09-25');

insert into public.transactions (id, user_id, wallet_id, amount, type, description, category_id, is_deleted, updated_at)
select v.id::uuid, '00000000-0000-4000-8000-00000064d001', w.id, 10, 'EXPENSE', v.note, v.cat::uuid, v.del, '2026-09-01'
from (values
  ('00000000-0000-4000-8000-00000064d101', 'on winner', '00000000-0000-4000-8000-00000064d0f1', false),
  ('00000000-0000-4000-8000-00000064d102', 'on copy 2', '00000000-0000-4000-8000-00000064d0f2', false),
  ('00000000-0000-4000-8000-00000064d103', 'on copy 3', '00000000-0000-4000-8000-00000064d0f3', false),
  ('00000000-0000-4000-8000-00000064d104', 'deleted, on copy 3', '00000000-0000-4000-8000-00000064d0f3', true),
  ('00000000-0000-4000-8000-00000064d105', 'on pets', '00000000-0000-4000-8000-00000064d0a1', false)
) as v(id, note, cat, del)
cross join (select id from public.wallets where user_id = '00000000-0000-4000-8000-00000064d001') w;

insert into public.keyword_rules (id, user_id, keyword, category_id) values
  ('00000000-0000-4000-8000-00000064d201', '00000000-0000-4000-8000-00000064d001', 'lunch', '00000000-0000-4000-8000-00000064d0f3');

-- -----------------------------------------------------------------------------
-- 1. Grants: authenticated may call it, anon may not.
-- -----------------------------------------------------------------------------
do $grants$
begin
  assert has_function_privilege('authenticated', 'public.seed_starter_account()', 'execute'), '1 authenticated cannot execute';
  assert not has_function_privilege('anon', 'public.seed_starter_account()', 'execute'), '1 anon can execute';
  assert (select prosecdef from pg_proc where oid = 'public.seed_starter_account()'::regprocedure), '1 not security definer';
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
    perform public.seed_starter_account();
  exception when sqlstate '28000' then
    failed := true;
  end;
  assert failed, '2 seeded without a session';
end;
$nosession$;

-- A: seeds once, then never again.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000064a001","role":"authenticated"}', true);
do $a$
declare
  a uuid := '00000000-0000-4000-8000-00000064a001';
begin
  assert public.seed_starter_account() = '{"seeded": true}'::jsonb, '2 A first call did not seed';
  assert (select count(*) from public.wallets where user_id = a) = 3, '2 A wallets';
  assert (select count(*) from public.categories where user_id = a) = 9, '2 A categories';
  assert (select count(*) from public.categories where user_id = a and color in ('#E879A6', '#6B7385')) = 3, '2 A not on identity colours';
  assert (select bool_and(description is null) from public.categories where user_id = a), '2 A wrote a description';
  assert public.seed_starter_account() = '{"seeded": false}'::jsonb, '2 A second call seeded';
  assert (select count(*) from public.wallets where user_id = a) = 3, '2 A second call added wallets';
  assert (select count(*) from public.categories where user_id = a) = 9, '2 A second call added categories';
end;
$a$;

-- B and C: a deleted row is enough to count as seeded.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000064b001","role":"authenticated"}', true);
do $b$
begin
  assert public.seed_starter_account() = '{"seeded": false}'::jsonb, '2 B seeded over a deleted wallet';
  assert (select count(*) from public.wallets where user_id = '00000000-0000-4000-8000-00000064b001') = 1, '2 B rows added';
  assert (select count(*) from public.categories where user_id = '00000000-0000-4000-8000-00000064b001') = 0, '2 B categories added';
end;
$b$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000064c001","role":"authenticated"}', true);
do $c$
begin
  assert public.seed_starter_account() = '{"seeded": false}'::jsonb, '2 C seeded over a deleted category';
  assert (select count(*) from public.wallets where user_id = '00000000-0000-4000-8000-00000064c001') = 0, '2 C wallets added';
end;
$c$;

reset role;

-- -----------------------------------------------------------------------------
-- 3. The dedupe, run twice.
-- -----------------------------------------------------------------------------
\ir ../migrations/20261002_phase64_dedupe_categories.sql

do $dedupe$
declare
  d uuid := '00000000-0000-4000-8000-00000064d001';
  winner uuid := '00000000-0000-4000-8000-00000064d0f1';
begin
  -- One live Food & Dining (the earliest), the copies marked deleted, Pets untouched.
  assert (select array_agg(id order by id) from public.categories where user_id = d and not is_deleted and lower(btrim(name)) = 'food & dining')
         = array[winner], '3 not one live winner';
  assert (select count(*) from public.categories where user_id = d and is_deleted and id in ('00000000-0000-4000-8000-00000064d0f2', '00000000-0000-4000-8000-00000064d0f3')) = 2, '3 copies not deleted';
  assert not (select is_deleted from public.categories where id = '00000000-0000-4000-8000-00000064d0a1'), '3 pets deleted';
  assert (select count(*) from public.categories where user_id = d) = 5, '3 a row was removed';

  -- Every transaction on a copy, deleted ones included, now on the winner, with a new updated_at.
  assert (select count(*) from public.transactions where user_id = d and category_id = winner) = 4, '3 transactions not re-pointed';
  assert (select bool_and(updated_at > '2026-09-01') from public.transactions where id in (
    '00000000-0000-4000-8000-00000064d102', '00000000-0000-4000-8000-00000064d103', '00000000-0000-4000-8000-00000064d104')), '3 updated_at not moved';
  assert (select updated_at from public.transactions where id = '00000000-0000-4000-8000-00000064d101') = '2026-09-01', '3 a row on the winner was touched';
  assert (select category_id from public.transactions where id = '00000000-0000-4000-8000-00000064d105') = '00000000-0000-4000-8000-00000064d0a1', '3 pets row moved';
  assert (select count(*) from public.transactions where user_id = d) = 5, '3 a transaction was removed';
  assert (select sum(amount) from public.transactions where user_id = d) = 50, '3 money moved';

  -- The rule follows; the old deleted copy and the other account are untouched.
  assert (select category_id from public.keyword_rules where id = '00000000-0000-4000-8000-00000064d201') = winner, '3 rule not re-pointed';
  assert (select is_deleted from public.categories where id = '00000000-0000-4000-8000-00000064d0f0'), '3 old deleted copy revived';
  assert not (select is_deleted from public.categories where id = '00000000-0000-4000-8000-00000064e0f1'), '3 merged across accounts';
end;
$dedupe$;

create temporary table _phase64_before as
select 'c' as t, id, is_deleted::text as v from public.categories
union all select 't', id, category_id::text || updated_at::text from public.transactions
union all select 'r', id, category_id::text from public.keyword_rules;

\ir ../migrations/20261002_phase64_dedupe_categories.sql

do $again$
begin
  assert not exists (
    select 1 from _phase64_before b
    left join public.categories c on b.t = 'c' and c.id = b.id
    left join public.transactions t on b.t = 't' and t.id = b.id
    left join public.keyword_rules r on b.t = 'r' and r.id = b.id
    where coalesce(c.is_deleted::text, t.category_id::text || t.updated_at::text, r.category_id::text) is distinct from b.v
  ), '4 second run changed a row';
end;
$again$;

select 'PHASE 64 PROBE OK' as result;

rollback;
