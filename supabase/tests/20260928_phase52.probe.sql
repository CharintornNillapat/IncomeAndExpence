-- =============================================================================
-- Probe for 20260928_phase52_security_ledger.sql (ADR 0024). NOTHING PERSISTS.
--
-- Same shape as 20260927_ledger_rpcs.probe.sql: one transaction ending in
-- ROLLBACK. Keep the `\ir` line to test the migration before it is applied;
-- delete it to test the deployed functions afterwards. A runner without psql
-- meta-commands pastes the migration's text in place of the `\ir` line.
--
-- Run the Phase 51 probe as well: this migration re-creates two of its
-- functions, and that probe is what proves nothing it pinned was lost.
--
-- Success is the final row, `PHASE 52 PROBE OK`.
--
-- Not covered: the trigger firing *as supabase_auth_admin* (this session
-- cannot assume that role). The probe proves the trigger still fires and that
-- the role holds EXECUTE explicitly.
-- =============================================================================

begin;

\ir ../migrations/20260928_phase52_security_ledger.sql

-- -----------------------------------------------------------------------------
-- Fixture, as the table owner. Inserting the users also exercises
-- handle_new_user through its trigger.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000a001', 'phase52-probe-a@example.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000b001', 'phase52-probe-b@example.invalid', 'authenticated', 'authenticated');

insert into public.wallets (id, user_id, name, type, currency, balance, is_deleted) values
  ('00000000-0000-4000-8000-00000000a101', '00000000-0000-4000-8000-00000000a001', 'Probe Cash',   'CASH',        'THB', 5000, false),
  ('00000000-0000-4000-8000-00000000b101', '00000000-0000-4000-8000-00000000b001', 'Probe B Cash', 'CASH',        'THB',  500, false);

insert into public.debts (id, user_id, name, total_amount, remaining_amount, is_deleted) values
  ('00000000-0000-4000-8000-00000000a201', '00000000-0000-4000-8000-00000000a001', 'Probe Loan',     10000, 1000, false),
  ('00000000-0000-4000-8000-00000000a202', '00000000-0000-4000-8000-00000000a001', 'Probe Gone Loan',  500,  500, true),
  ('00000000-0000-4000-8000-00000000b201', '00000000-0000-4000-8000-00000000b001', 'Probe B Loan',     500,  500, false);

-- Three sessions: two of A's (one is "this" session), one of B's.
insert into auth.sessions (id, user_id, created_at, updated_at, user_agent, ip) values
  ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000a001', now() - interval '2 days', now() - interval '1 hour', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', '203.0.113.7'),
  ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000a001', now() - interval '1 day',  now(),                     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140', '198.51.100.4'),
  ('00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000b001', now(),                     now(),                     'curl/8',                                          '192.0.2.1');

do $owner$
begin
  -- 1. handle_new_user: still fires, hardened, and callable only by the auth service.
  assert (select count(*) from public.profiles where email like 'phase52-probe-%') = 2,
    '1 the signup trigger did not create both profiles';
  assert (select array_to_string(proconfig, ',') from pg_proc where oid = 'public.handle_new_user()'::regprocedure)
         like '%search_path=public, pg_temp%', '1 search_path not pinned';
  assert not has_function_privilege('anon', 'public.handle_new_user()', 'execute'), '1 anon can execute';
  assert not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'), '1 authenticated can execute';
  assert has_function_privilege('supabase_auth_admin', 'public.handle_new_user()', 'execute'), '1 auth admin lost execute';
end;
$owner$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000c002"}', true);

do $probe$
declare
  a_user uuid := '00000000-0000-4000-8000-00000000a001';
  cash   uuid := '00000000-0000-4000-8000-00000000a101';
  b_cash uuid := '00000000-0000-4000-8000-00000000b101';
  loan   uuid := '00000000-0000-4000-8000-00000000a201';
  gone   uuid := '00000000-0000-4000-8000-00000000a202';
  b_loan uuid := '00000000-0000-4000-8000-00000000b201';
  d      date := '2026-09-28';
  r      jsonb;
  n      integer;
  bal    numeric;
  msg    text;
  det    text;
  hnt    text;
  code   text;
  adj_id uuid;
  imp_id uuid;
  w_id   uuid;
begin
  -- 2. Signed ADJUSTMENT: a downward correction lowers the balance.
  r := public.record_transaction(cash, -1000, 'ADJUSTMENT', 'Manual balance adjustment (-1000)', d, 'p52-adj-down');
  assert (r ->> 'source_balance')::numeric = 4000, format('2 downward: %s', r);
  assert (r -> 'transaction' ->> 'amount')::numeric = -1000, format('2 stored amount: %s', r);
  adj_id := (r -> 'transaction' ->> 'id')::uuid;

  r := public.record_transaction(cash, 250, 'ADJUSTMENT', 'Manual balance adjustment (+250)', d, 'p52-adj-up');
  assert (r ->> 'source_balance')::numeric = 4250, format('2 upward: %s', r);

  -- Deleting the downward one gives the 1,000 back; restoring takes it again.
  r := public.set_transaction_deleted(adj_id, true);
  assert (r ->> 'source_balance')::numeric = 5250, format('2 delete reverses: %s', r);
  r := public.set_transaction_deleted(adj_id, false);
  assert (r ->> 'source_balance')::numeric = 4250, format('2 restore reapplies: %s', r);

  code := null;
  begin
    perform public.record_transaction(cash, 0, 'ADJUSTMENT', 'x', d, 'p52-adj-zero');
    raise exception 'PROBE: zero adjustment accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate, msg = message_text; end;
  assert code = '22023' and msg = 'An adjustment must not be zero', format('2 zero: %s %s', code, msg);

  code := null;
  begin
    perform public.record_transaction(cash, -10, 'EXPENSE', 'x', d, 'p52-neg-expense');
    raise exception 'PROBE: negative expense accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('2 negative expense: %s', code);

  select balance into bal from public.wallets where id = cash;
  assert bal = 4250, format('2 rejections moved money: %s', bal);

  -- 3. create_wallet: the opening balance arrives as a ledger row.
  r := public.create_wallet('Probe Card', 'CREDIT_CARD', 'THB', 'rose', 'credit-card', -5000, d, 'p52-wallet-card');
  assert (r ->> 'reused')::boolean = false, format('3 reused: %s', r);
  assert (r -> 'wallet' ->> 'balance')::numeric = -5000, format('3 card balance: %s', r);
  assert (r -> 'transaction' ->> 'amount')::numeric = -5000, format('3 card row: %s', r);
  assert (r -> 'transaction' ->> 'type') = 'ADJUSTMENT', format('3 card row type: %s', r);
  assert (r -> 'transaction' ->> 'transaction_date') = '2026-09-28', format('3 card row date: %s', r);
  w_id := (r -> 'wallet' ->> 'id')::uuid;

  -- The ledger explains the balance: sum of live rows = balance.
  select coalesce(sum(amount), 0) into bal from public.transactions where wallet_id = w_id and not is_deleted;
  assert bal = -5000, format('3 ledger sum: %s', bal);

  -- Replay returns the same wallet and writes nothing.
  r := public.create_wallet('Probe Card', 'CREDIT_CARD', 'THB', 'rose', 'credit-card', -5000, d, 'p52-wallet-card');
  assert (r ->> 'reused')::boolean = true, format('3 replay: %s', r);
  assert (r -> 'wallet' ->> 'id')::uuid = w_id, format('3 replay id: %s', r);
  select count(*) into n from public.wallets where idempotency_key = 'p52-wallet-card';
  assert n = 1, format('3 replay wallets: %s', n);
  select count(*) into n from public.transactions where idempotency_key = 'opening:p52-wallet-card';
  assert n = 1, format('3 replay rows: %s', n);

  r := public.create_wallet('Probe Savings', 'SAVINGS', 'THB', 'emerald', 'piggy-bank', 1234.5, d, 'p52-wallet-savings');
  assert (r -> 'wallet' ->> 'balance')::numeric = 1234.5, format('3 positive: %s', r);

  -- A zero opening: a wallet, no row - and still replayable.
  r := public.create_wallet('Probe Empty', 'CASH', 'THB', 'stone', 'wallet', 0, null, 'p52-wallet-empty');
  assert (r -> 'wallet' ->> 'balance')::numeric = 0, format('3 zero balance: %s', r);
  assert (r -> 'transaction') = 'null'::jsonb, format('3 zero row: %s', r);
  r := public.create_wallet('Probe Empty', 'CASH', 'THB', 'stone', 'wallet', 0, null, 'p52-wallet-empty');
  assert (r ->> 'reused')::boolean = true, format('3 zero replay: %s', r);

  code := null;
  begin
    perform public.create_wallet('Probe Undated', 'CASH', 'THB', 'stone', 'wallet', 10, null, 'p52-wallet-undated');
    raise exception 'PROBE: undated opening accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('3 undated opening: %s', code);

  -- 4. Import with debts (F8).
  r := public.import_transactions('p52-imp1', jsonb_build_array(
    jsonb_build_object('row_index', 1, 'wallet_id', cash, 'amount', 300, 'type', 'DEBT_REPAYMENT', 'description', 'Loan 1', 'transaction_date', d, 'debt_id', loan),
    jsonb_build_object('row_index', 2, 'wallet_id', cash, 'amount', 200, 'type', 'DEBT_REPAYMENT', 'description', 'Loan 2', 'transaction_date', d, 'debt_id', loan),
    jsonb_build_object('row_index', 3, 'wallet_id', cash, 'amount', -50, 'type', 'ADJUSTMENT', 'description', 'Fix', 'transaction_date', d)
  ));
  assert (r ->> 'reused')::boolean = false, format('4 reused: %s', r);
  select remaining_amount into bal from public.debts where id = loan;
  assert bal = 500, format('4 debt decremented once per row: %s', bal);
  select balance into bal from public.wallets where id = cash;
  assert bal = 3700, format('4 wallet (4250 - 300 - 200 - 50): %s', bal);
  select count(*) into n from public.transactions where idempotency_key like 'p52-imp1:%' and debt_id = loan;
  assert n = 2, format('4 rows carry the debt: %s', n);
  select id into imp_id from public.transactions where idempotency_key = 'p52-imp1:1';

  -- An imported repayment now reverses its debt on delete.
  r := public.set_transaction_deleted(imp_id, true);
  assert (r ->> 'debt_remaining')::numeric = 800, format('4 delete moves the debt: %s', r);
  r := public.set_transaction_deleted(imp_id, false);
  assert (r ->> 'debt_remaining')::numeric = 500, format('4 restore moves it back: %s', r);

  -- The aggregate guard: 300 + 300 overpays the 500 left, though each fits.
  msg := null;
  begin
    perform public.import_transactions('p52-imp2', jsonb_build_array(
      jsonb_build_object('row_index', 1, 'wallet_id', cash, 'amount', 300, 'type', 'DEBT_REPAYMENT', 'description', 'x', 'transaction_date', d, 'debt_id', loan),
      jsonb_build_object('row_index', 2, 'wallet_id', cash, 'amount', 300, 'type', 'DEBT_REPAYMENT', 'description', 'y', 'transaction_date', d, 'debt_id', loan)
    ));
    raise exception 'PROBE: aggregate overpayment accepted';
  exception when others then get stacked diagnostics msg = message_text, det = pg_exception_detail, hnt = pg_exception_hint; end;
  assert msg = 'DEBT_OVERPAYMENT', format('4 aggregate guard: %s', msg);
  assert det::numeric = 500 and hnt = 'Probe Loan', format('4 guard detail/hint: %s / %s', det, hnt);
  select count(*) into n from public.transactions where idempotency_key like 'p52-imp2:%';
  assert n = 0, '4 a guarded import wrote rows';
  select balance into bal from public.wallets where id = cash;
  assert bal = 3700, format('4 a guarded import moved money: %s', bal);

  code := null;
  begin
    perform public.import_transactions('p52-imp3', jsonb_build_array(
      jsonb_build_object('row_index', 1, 'wallet_id', cash, 'amount', 10, 'type', 'DEBT_REPAYMENT', 'description', 'x', 'transaction_date', d, 'debt_id', b_loan)
    ));
    raise exception 'PROBE: foreign debt accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = 'P0002', format('4 foreign debt: %s', code);

  code := null;
  begin
    perform public.import_transactions('p52-imp4', jsonb_build_array(
      jsonb_build_object('row_index', 1, 'wallet_id', cash, 'amount', 10, 'type', 'DEBT_REPAYMENT', 'description', 'x', 'transaction_date', d, 'debt_id', gone)
    ));
    raise exception 'PROBE: deleted debt accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = 'P0002', format('4 deleted debt: %s', code);

  code := null;
  begin
    perform public.import_transactions('p52-imp5', jsonb_build_array(
      jsonb_build_object('row_index', 1, 'wallet_id', cash, 'amount', 10, 'type', 'EXPENSE', 'description', 'x', 'transaction_date', d, 'debt_id', loan)
    ));
    raise exception 'PROBE: a debt on an expense accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('4 debt on a non-repayment: %s', code);

  -- Backward compatibility: a repayment row with no debt still imports
  -- (wallet only), for a cached older client.
  r := public.import_transactions('p52-imp6', jsonb_build_array(
    jsonb_build_object('row_index', 1, 'wallet_id', cash, 'amount', 5, 'type', 'DEBT_REPAYMENT', 'description', 'old client', 'transaction_date', d)
  ));
  select remaining_amount into bal from public.debts where id = loan;
  assert bal = 500, format('4 a debtless repayment moved a debt: %s', bal);

  -- 5. list_my_sessions: only the caller's, with the current one marked.
  select count(*) into n from public.list_my_sessions();
  assert n = 2, format('5 session count: %s', n);
  assert (select count(*) from public.list_my_sessions() where is_current) = 1, '5 exactly one current';
  assert (select id from public.list_my_sessions() where is_current) = '00000000-0000-4000-8000-00000000c002',
    '5 the wrong session is current';
  assert (select ip from public.list_my_sessions() where not is_current) = '203.0.113.7', '5 ip not rendered';
  assert not exists (select 1 from public.list_my_sessions() where id = '00000000-0000-4000-8000-00000000c003'),
    '5 another user''s session leaked';

  -- 6. Grants.
  assert not has_function_privilege('anon', 'public.create_wallet(text,text,text,text,text,numeric,date,text)', 'execute'), '6 anon create_wallet';
  assert has_function_privilege('authenticated', 'public.create_wallet(text,text,text,text,text,numeric,date,text)', 'execute'), '6 auth create_wallet';
  assert not has_function_privilege('anon', 'public.list_my_sessions()', 'execute'), '6 anon sessions';
  assert has_function_privilege('authenticated', 'public.list_my_sessions()', 'execute'), '6 auth sessions';
  assert not has_function_privilege('anon', 'public.record_transaction(uuid,numeric,text,text,date,text,uuid,uuid,text)', 'execute'), '6 anon record';
  assert not has_function_privilege('anon', 'public.import_transactions(text,jsonb)', 'execute'), '6 anon import';
end;
$probe$;

-- An anonymous caller sees no sessions at all.
select set_config('request.jwt.claims', '{}', true);
do $anon$
begin
  assert (select count(*) from public.list_my_sessions()) = 0, '5 no-user call listed sessions';
end;
$anon$;

reset role;

do $owner_after$
declare
  bal numeric;
begin
  select balance into bal from public.wallets where id = '00000000-0000-4000-8000-00000000b101';
  assert bal = 500, format('B wallet moved: %s', bal);
  select remaining_amount into bal from public.debts where id = '00000000-0000-4000-8000-00000000b201';
  assert bal = 500, format('B debt moved: %s', bal);
end;
$owner_after$;

select 'PHASE 52 PROBE OK' as result;

rollback;
