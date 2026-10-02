-- =============================================================================
-- Phase 54 (ADR 0040): a new account starts with no money nobody entered.
--
-- `seed_starter_account()` (Phase 64, ADR 0039) gave every new sign-up three
-- wallets holding 10,650 baht in all (2,500 + 150 + 8,000) with no ledger row
-- behind any of it. This re-creates the function with the three balances at
-- 0.00 and changes nothing else: the same names (the server keeps "Checking
-- Account" on purpose), types, colours, icons and order, the same nine
-- categories, the same once-only check, advisory lock and grants.
--
-- New accounts only. Accounts already seeded keep their wallets and balances:
-- real transactions may already sit on them, so moving them would rewrite a
-- user's ledger. A seeded account never reaches the inserts again (Phase 64's
-- once-only rule), so this changes no existing row.
--
-- Body: the Phase 64 file's, which the deployed function matched md5 for md5
-- (06b826c0448ee752dbfbf9f7548813d8, read-only check on 2026-10-02), with the
-- three balances changed. The filename sorts after 20261002_phase64_*, so a
-- fresh replay ends on this body.
--
-- The starter set also lives in `FinanceContext.tsx`'s guest defaults; change
-- both together.
--
-- Probe: supabase/tests/20261003_phase54.probe.sql.
-- =============================================================================

create or replace function public.seed_starter_account()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('seed_starter_account:' || v_uid::text, 0));

  if exists (select 1 from public.wallets where user_id = v_uid)
     or exists (select 1 from public.categories where user_id = v_uid) then
    return jsonb_build_object('seeded', false);
  end if;

  insert into public.wallets (user_id, name, type, currency, balance, color, icon) values
    (v_uid, 'Checking Account', 'BANK_ACCOUNT', 'THB', 0.00, '#6C8EEF', 'landmark'),
    (v_uid, 'Cash Wallet',      'CASH',         'THB', 0.00, '#D9A066', 'banknote'),
    (v_uid, 'Savings Reserve',  'SAVINGS',      'THB', 0.00, '#4FB7A8', 'piggy-bank');

  insert into public.categories (user_id, name, type, icon, color, is_system) values
    (v_uid, 'Food & Dining',        'EXPENSE',        'utensils',      '#E879A6', true),
    (v_uid, 'Groceries',            'EXPENSE',        'shopping-cart', '#F59E6B', true),
    (v_uid, 'Transport & Fuel',     'EXPENSE',        'car',           '#5CC8B8', true),
    (v_uid, 'Shopping & Apparel',   'EXPENSE',        'shopping-bag',  '#B69CF5', true),
    (v_uid, 'Housing & Utilities',  'EXPENSE',        'home',          '#7DA2F0', true),
    (v_uid, 'Primary Salary',       'INCOME',         'briefcase',     '#8FA8C8', true),
    (v_uid, 'Freelance & Side Gig', 'INCOME',         'laptop',        '#D98FD0', true),
    (v_uid, 'Debt Repayment',       'DEBT_REPAYMENT', 'credit-card',   '#6B7385', true),
    (v_uid, 'Balance Adjustment',   'ADJUSTMENT',     'sliders',       '#6B7385', true);

  return jsonb_build_object('seeded', true);
end;
$$;

-- `create or replace` keeps the existing grants, but a fresh replay of this
-- file alone would not, so they are stated again (ADR 0039).
revoke all on function public.seed_starter_account() from public, anon;
grant execute on function public.seed_starter_account() to authenticated, service_role;
