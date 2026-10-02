-- =============================================================================
-- Probe for 20261002_phase63_identity_colors.sql (ADR 0038). NOTHING PERSISTS.
--
-- Same shape as the earlier probes: one transaction ending in ROLLBACK. Keep
-- the `\ir` lines to test the migration before it is applied; a runner without
-- psql meta-commands pastes the migration's text in place of each `\ir` line.
-- The migration runs over every account inside this transaction, so the
-- assertions look at the three fixture accounts only.
--
-- Success is the final row, `PHASE 63 PROBE OK`.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Fixture, as the table owner.
--   A: the shipped nine twice (one copy upper-case, one name padded), a custom
--      "Pets" already on Rose, so Food & Dining collides; spec 5.1's camel and
--      กิจนิมนต์; a deleted Primary Salary; Cash, Main and Sub; a deleted
--      Cash Wallet.
--   B: the starter set, with Groceries recoloured by hand to Iris.
--   C: twelve custom categories on all twelve colours, and Food & Dining old.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000063a001', 'phase63-probe-a@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe A"}'),
  ('00000000-0000-4000-8000-00000063b001', 'phase63-probe-b@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe B"}'),
  ('00000000-0000-4000-8000-00000063c001', 'phase63-probe-c@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe C"}');

create temporary table _shipped (name text, type text, color text);
insert into _shipped values
  ('Food & Dining', 'EXPENSE', '#f87171'),
  ('Groceries', 'EXPENSE', '#fb923c'),
  ('Housing & Utilities', 'EXPENSE', '#38bdf8'),
  ('Shopping & Apparel', 'EXPENSE', '#a78bfa'),
  ('Transport & Fuel', 'EXPENSE', '#facc15'),
  ('Primary Salary', 'INCOME', '#4ade80'),
  ('Freelance & Side Gig', 'INCOME', '#34d399'),
  ('Debt Repayment', 'DEBT_REPAYMENT', '#f43f5e'),
  ('Balance Adjustment', 'ADJUSTMENT', '#94a3b8');

insert into public.categories (user_id, name, type, color, is_system)
select '00000000-0000-4000-8000-00000063a001'::uuid, name, type, color, true from _shipped
union all
select '00000000-0000-4000-8000-00000063a001'::uuid,
       case when name = 'Groceries' then '  Groceries ' else name end, type, upper(color), true from _shipped
union all
select '00000000-0000-4000-8000-00000063b001'::uuid, name, type,
       case when name = 'Groceries' then '#9C8CD9' else color end, true from _shipped;

insert into public.categories (user_id, name, type, color, is_deleted) values
  ('00000000-0000-4000-8000-00000063a001', 'Pets', 'EXPENSE', '#E879A6', false),
  ('00000000-0000-4000-8000-00000063a001', 'camel', 'EXPENSE', '#facc15', false),
  ('00000000-0000-4000-8000-00000063a001', 'กิจนิมนต์', 'INCOME', '#34d399', false),
  ('00000000-0000-4000-8000-00000063a001', 'Primary Salary', 'INCOME', '#4ade80', true),
  ('00000000-0000-4000-8000-00000063c001', 'Food & Dining', 'EXPENSE', '#f87171', false);

insert into public.categories (user_id, name, type, color)
select '00000000-0000-4000-8000-00000063c001'::uuid, 'Custom ' || i, 'EXPENSE', p
from unnest(array['#D9A066', '#6C8EEF', '#4FB7A8', '#F59E6B', '#E879A6', '#7DA2F0',
                  '#B69CF5', '#5CC8B8', '#C7B38A', '#8FA8C8', '#D98FD0', '#9C8CD9']) with ordinality as u(p, i);

insert into public.wallets (user_id, name, type, currency, color, is_deleted) values
  ('00000000-0000-4000-8000-00000063a001', 'Cash', 'CASH', 'THB', '#ef4444', false),
  ('00000000-0000-4000-8000-00000063a001', 'Main', 'BANK_ACCOUNT', 'THB', '#16a34a', false),
  ('00000000-0000-4000-8000-00000063a001', 'Sub', 'BANK_ACCOUNT', 'THB', '#0284c7', false),
  ('00000000-0000-4000-8000-00000063a001', 'Cash Wallet', 'CASH', 'THB', '#16a34a', true),
  ('00000000-0000-4000-8000-00000063b001', 'Checking Account', 'BANK_ACCOUNT', 'THB', '#0284c7', false),
  ('00000000-0000-4000-8000-00000063b001', 'Cash Wallet', 'CASH', 'THB', '#16a34a', false),
  ('00000000-0000-4000-8000-00000063b001', 'Savings Reserve', 'SAVINGS', 'THB', '#7c3aed', false);

-- -----------------------------------------------------------------------------
-- First run.
-- -----------------------------------------------------------------------------
\ir ../migrations/20261002_phase63_identity_colors.sql

do $first$
declare
  a uuid := '00000000-0000-4000-8000-00000063a001';
  b uuid := '00000000-0000-4000-8000-00000063b001';
  c uuid := '00000000-0000-4000-8000-00000063c001';
begin
  -- 1. Every live copy of a shipped name moves, whatever its case or padding.
  --    Food & Dining collides with Pets on Rose and takes Tan, the first free.
  assert (select bool_and(color = '#D9A066') from public.categories where user_id = a and name = 'Food & Dining'), '1 A food not on tan';
  assert (select count(*) from public.categories where user_id = a and btrim(name) = 'Groceries' and color = '#F59E6B') = 2, '1 A groceries copies';
  assert (select bool_and(color = '#7DA2F0') from public.categories where user_id = a and name = 'Housing & Utilities'), '1 A housing';
  assert (select bool_and(color = '#B69CF5') from public.categories where user_id = a and name = 'Shopping & Apparel'), '1 A shopping';
  assert (select bool_and(color = '#5CC8B8') from public.categories where user_id = a and name = 'Transport & Fuel'), '1 A transport';
  assert (select bool_and(color = '#D98FD0') from public.categories where user_id = a and name = 'Freelance & Side Gig'), '1 A freelance';
  assert (select count(*) from public.categories where user_id = a and name = 'Primary Salary' and not is_deleted and color = '#8FA8C8') = 2, '1 A salary';
  assert (select bool_and(color = '#6B7385') from public.categories where user_id = a and type in ('DEBT_REPAYMENT', 'ADJUSTMENT')), '1 A system pair';

  -- 2. Spec 5.1's own rows.
  assert (select color from public.categories where user_id = a and name = 'camel') = '#C7B38A', '2 camel';
  assert (select color from public.categories where user_id = a and name = 'กิจนิมนต์') = '#9C8CD9', '2 kitnimon';
  assert (select color from public.wallets where user_id = a and name = 'Cash' and not is_deleted) = '#D9A066', '2 cash';
  assert (select color from public.wallets where user_id = a and name = 'Main') = '#6C8EEF', '2 main';
  assert (select color from public.wallets where user_id = a and name = 'Sub') = '#4FB7A8', '2 sub';

  -- 3. What must not move: a custom colour, a hand-picked colour, deleted rows.
  assert (select color from public.categories where user_id = a and name = 'Pets') = '#E879A6', '3 pets moved';
  assert (select color from public.categories where user_id = a and name = 'Primary Salary' and is_deleted) = '#4ade80', '3 deleted category moved';
  assert (select color from public.wallets where user_id = a and name = 'Cash Wallet' and is_deleted) = '#16a34a', '3 deleted wallet moved';
  assert (select color from public.categories where user_id = b and name = 'Groceries') = '#9C8CD9', '3 hand-picked moved';

  -- 4. B, a starter account: the table's colours, and the starter wallets.
  assert (select color from public.categories where user_id = b and name = 'Food & Dining') = '#E879A6', '4 B food';
  assert (select color from public.categories where user_id = b and name = 'Freelance & Side Gig') = '#D98FD0', '4 B freelance';
  assert (select color from public.wallets where user_id = b and name = 'Checking Account') = '#6C8EEF', '4 B checking';
  assert (select color from public.wallets where user_id = b and name = 'Cash Wallet') = '#D9A066', '4 B cash';
  assert (select color from public.wallets where user_id = b and name = 'Savings Reserve') = '#4FB7A8', '4 B savings';

  -- 5. C: all twelve taken, so Food & Dining keeps its old colour.
  assert (select color from public.categories where user_id = c and name = 'Food & Dining') = '#f87171', '5 C food moved with none free';

  -- 6. L9 in every fixture account: no two live Expense or Income categories
  --    of different names share a colour.
  assert not exists (
    select 1 from public.categories x
    join public.categories y on y.user_id = x.user_id and lower(y.color) = lower(x.color)
      and lower(btrim(y.name)) <> lower(btrim(x.name))
    where x.user_id in (a, b, c)
      and not x.is_deleted and not y.is_deleted
      and x.type in ('EXPENSE', 'INCOME') and y.type in ('EXPENSE', 'INCOME')
  ), '6 L9 broken';
end;
$first$;

-- -----------------------------------------------------------------------------
-- Second run: idempotent.
-- -----------------------------------------------------------------------------
create temporary table _before as
select 'c' as t, id, color from public.categories
union all
select 'w', id, color from public.wallets;

\ir ../migrations/20261002_phase63_identity_colors.sql

do $second$
begin
  assert not exists (
    select 1 from _before b
    left join public.categories c on b.t = 'c' and c.id = b.id
    left join public.wallets w on b.t = 'w' and w.id = b.id
    where coalesce(c.color, w.color) is distinct from b.color
  ), '7 second run changed a row';
end;
$second$;

select 'PHASE 63 PROBE OK' as result;

rollback;
