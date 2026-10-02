-- =============================================================================
-- Probe for Phase 54 (ADR 0040). NOTHING PERSISTS.
--   - 20261003_phase54_zero_starter_seed.sql: seed_starter_account() at 0.00
--
-- Same shape as the earlier probes: one transaction ending in ROLLBACK. Keep
-- the `\ir` line to test the migration before it is applied; a runner without
-- psql meta-commands pastes the migration's text in place of it. This
-- re-creates a deployed function, so re-run 20261002_phase64.probe.sql after
-- it (with its own `\ir` lines removed once Phase 64 is applied) to prove
-- nothing Phase 64 shipped was lost.
--
-- Success is the final row, `PHASE 54 PROBE OK`.
-- =============================================================================

begin;

\ir ../migrations/20261003_phase54_zero_starter_seed.sql

-- -----------------------------------------------------------------------------
-- Fixture, as the table owner.
--   A: a brand-new account, nothing at all.
--   B: an account seeded before, holding money (must not move).
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000054a001', 'phase54-probe-a@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe A"}'),
  ('00000000-0000-4000-8000-00000054b001', 'phase54-probe-b@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe B"}');

insert into public.wallets (user_id, name, type, currency, balance, color) values
  ('00000000-0000-4000-8000-00000054b001', 'Checking Account', 'BANK_ACCOUNT', 'THB', 2500.00, '#6C8EEF');

-- -----------------------------------------------------------------------------
-- 1. Grants survive the re-create: authenticated may call it, anon may not.
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

-- A: three wallets at 0, no debt, nine categories; a second call seeds nothing.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000054a001","role":"authenticated"}', true);
do $a$
declare
  a uuid := '00000000-0000-4000-8000-00000054a001';
begin
  assert public.seed_starter_account() = '{"seeded": true}'::jsonb, '2 A first call did not seed';
  assert (select count(*) from public.wallets where user_id = a) = 3, '2 A wallets';
  assert (select sum(balance) from public.wallets where user_id = a) = 0, '2 A wallets hold money';
  assert (select bool_and(balance = 0) from public.wallets where user_id = a), '2 A a wallet is not at 0';
  assert (select array_agg(name order by name) from public.wallets where user_id = a)
         = array['Cash Wallet', 'Checking Account', 'Savings Reserve'], '2 A wallet names changed';
  assert (select count(*) from public.debts where user_id = a) = 0, '2 A debts';
  assert (select count(*) from public.transactions where user_id = a) = 0, '2 A ledger rows';
  assert (select count(*) from public.categories where user_id = a) = 9, '2 A categories';
  assert public.seed_starter_account() = '{"seeded": false}'::jsonb, '2 A second call seeded';
  assert (select count(*) from public.wallets where user_id = a) = 3, '2 A second call added wallets';
  assert (select count(*) from public.categories where user_id = a) = 9, '2 A second call added categories';
end;
$a$;

-- B: seeded before; nothing added and its balance untouched.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000054b001","role":"authenticated"}', true);
do $b$
declare
  b uuid := '00000000-0000-4000-8000-00000054b001';
begin
  assert public.seed_starter_account() = '{"seeded": false}'::jsonb, '2 B seeded again';
  assert (select count(*) from public.wallets where user_id = b) = 1, '2 B wallets added';
  assert (select balance from public.wallets where user_id = b) = 2500.00, '2 B balance moved';
end;
$b$;

reset role;

select 'PHASE 54 PROBE OK' as result;

rollback;
