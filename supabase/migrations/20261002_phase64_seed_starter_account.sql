-- =============================================================================
-- Phase 64 (ADR 0039): the server decides whether an account is new.
--
-- Before this, `loadSupabaseData` seeded the starter wallets and categories
-- from the client whenever its wallet read came back empty. Row-level security
-- answers a read made without a valid session (role `anon`) with zero rows and
-- no error, so a page load that read before its session was restored looked
-- exactly like a brand-new account. One account was seeded five extra times
-- that way (2026-09-19 to 2026-09-22), which is where its duplicate categories
-- came from.
--
-- `seed_starter_account()` replaces the client's two inserts:
--   - no session, no seed: `auth.uid()` null raises 28000, so an anonymous
--     call fails loudly instead of looking empty;
--   - once only: it seeds only an account that has never had a wallet or a
--     category row, deleted rows included, so a seeded account is never
--     seeded again whatever it deletes;
--   - one at a time: a per-account transaction-scoped advisory lock serialises
--     concurrent calls (two tabs, StrictMode's double effect), and the second
--     finds the first one's rows;
--   - all or nothing: the wallets and categories land in one transaction.
--
-- It returns {"seeded": true|false}. The starter set mirrors the client's
-- guest defaults (`DEFAULT_STARTER_WALLETS` balances aside, which differ as
-- they always have, and `DEFAULT_SYSTEM_CATEGORIES`) on spec 5.1's identity
-- colours (ADR 0038). `description` is left NULL on purpose (ADR 0012).
--
-- Probe: supabase/tests/20261002_phase64.probe.sql.
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
    (v_uid, 'Checking Account', 'BANK_ACCOUNT', 'THB', 2500.00, '#6C8EEF', 'landmark'),
    (v_uid, 'Cash Wallet',      'CASH',         'THB',  150.00, '#D9A066', 'banknote'),
    (v_uid, 'Savings Reserve',  'SAVINGS',      'THB', 8000.00, '#4FB7A8', 'piggy-bank');

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

-- Supabase's default privileges grant EXECUTE on new public functions to anon
-- and authenticated, so the revoke is explicit.
revoke all on function public.seed_starter_account() from public, anon;
grant execute on function public.seed_starter_account() to authenticated, service_role;
