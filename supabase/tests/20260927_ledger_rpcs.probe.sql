-- =============================================================================
-- Probe for 20260927_ledger_rpcs.sql (ADR 0023). NOTHING PERSISTS.
--
-- The whole file is one transaction that ends in ROLLBACK: the throwaway users,
-- wallets, debt, categories and transactions below never commit. Run it as a
-- single script:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/20260927_ledger_rpcs.probe.sql
--
-- Two modes:
--   * BEFORE the migration is applied - keep the `\ir` line. Postgres DDL is
--     transactional, so the functions exist only inside this transaction.
--   * AFTER it is applied - delete the `\ir` line, so the probe exercises the
--     functions actually deployed rather than a fresh copy of them.
-- (A runner without psql meta-commands, such as the Supabase MCP `execute_sql`,
-- pastes the migration's text in place of the `\ir` line.)
--
-- Success is the final row, `PHASE 51 PROBE OK`. Any failed assertion raises and
-- aborts the transaction, which is itself a rollback.
--
-- Not covered, because one session cannot race itself: the `unique_violation`
-- handlers that resolve two concurrent calls with the same key.
-- =============================================================================

begin;

\ir ../migrations/20260927_ledger_rpcs.sql

-- -----------------------------------------------------------------------------
-- Fixture, written as the table owner. User A is the caller; user B owns rows A
-- must not be able to touch.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000a001', 'phase51-probe-a@example.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000b001', 'phase51-probe-b@example.invalid', 'authenticated', 'authenticated');

insert into public.wallets (id, user_id, name, type, currency, balance, is_deleted) values
  ('00000000-0000-4000-8000-00000000a101', '00000000-0000-4000-8000-00000000a001', 'Probe Cash',    'CASH',        'THB', 1000, false),
  ('00000000-0000-4000-8000-00000000a102', '00000000-0000-4000-8000-00000000a001', 'Probe Card',    'CREDIT_CARD', 'THB',    0, false),
  ('00000000-0000-4000-8000-00000000a103', '00000000-0000-4000-8000-00000000a001', 'Probe Gone',    'CASH',        'THB',   50, true),
  ('00000000-0000-4000-8000-00000000b101', '00000000-0000-4000-8000-00000000b001', 'Probe B Cash',  'CASH',        'THB',  500, false);

insert into public.debts (id, user_id, name, total_amount, remaining_amount) values
  ('00000000-0000-4000-8000-00000000a201', '00000000-0000-4000-8000-00000000a001', 'Probe Loan', 10000, 4500);

insert into public.categories (id, user_id, name, type) values
  ('00000000-0000-4000-8000-00000000a301', '00000000-0000-4000-8000-00000000a001', 'Probe Food',   'EXPENSE'),
  ('00000000-0000-4000-8000-00000000b301', '00000000-0000-4000-8000-00000000b001', 'Probe B Food', 'EXPENSE');

insert into public.transactions (id, user_id, wallet_id, amount, type, description, transaction_date, idempotency_key, is_deleted, created_by) values
  ('00000000-0000-4000-8000-00000000b401', '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000b101',
   10, 'EXPENSE', 'Probe B row', '2026-09-27', 'probe-b-1', false, '00000000-0000-4000-8000-00000000b001');

-- -----------------------------------------------------------------------------
-- From here on, act as user A exactly as PostgREST would: the `authenticated`
-- role, with A's id in the JWT claims `auth.uid()` reads.
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);

do $probe$
declare
  a_user uuid := '00000000-0000-4000-8000-00000000a001';
  cash   uuid := '00000000-0000-4000-8000-00000000a101';
  card   uuid := '00000000-0000-4000-8000-00000000a102';
  gone   uuid := '00000000-0000-4000-8000-00000000a103';
  b_cash uuid := '00000000-0000-4000-8000-00000000b101';
  debt   uuid := '00000000-0000-4000-8000-00000000a201';
  a_cat  uuid := '00000000-0000-4000-8000-00000000a301';
  b_cat  uuid := '00000000-0000-4000-8000-00000000b301';
  b_tx   uuid := '00000000-0000-4000-8000-00000000b401';
  d      date := '2026-09-27';
  r      jsonb;
  n      integer;
  bal    numeric;
  msg    text;
  det    text;
  code   text;
  k1_id  uuid;
  pay_id uuid;
begin
  -- 1. A plain expense: debited, row written, created_by is the caller.
  r := public.record_transaction(cash, 200, 'EXPENSE', 'Probe groceries', d, 'probe-k1');
  assert (r ->> 'reused')::boolean = false, format('1 reused: %s', r);
  assert (r ->> 'source_balance')::numeric = 800, format('1 balance: %s', r);
  assert (r -> 'transaction' ->> 'amount')::numeric = 200, format('1 amount: %s', r);
  assert (r -> 'transaction' ->> 'created_by') = a_user::text, format('1 created_by: %s', r);
  k1_id := (r -> 'transaction' ->> 'id')::uuid;

  -- 2. F4: the same key again replays the same row and moves nothing.
  r := public.record_transaction(cash, 200, 'EXPENSE', 'Probe groceries', d, 'probe-k1');
  assert (r ->> 'reused')::boolean = true, format('2 reused: %s', r);
  assert (r -> 'transaction' ->> 'id')::uuid = k1_id, format('2 id: %s', r);
  assert (r ->> 'source_balance')::numeric = 800, format('2 balance: %s', r);
  select count(*) into n from public.transactions where idempotency_key = 'probe-k1';
  assert n = 1, format('2 rows with probe-k1: %s', n);

  -- 3. F3: another writer moved the wallet; the update is relative to THAT.
  update public.wallets set balance = 7777 where id = cash;
  r := public.record_transaction(cash, 200, 'EXPENSE', 'Probe second', d, 'probe-k2');
  assert (r ->> 'source_balance')::numeric = 7577, format('3 relative: %s', r);

  -- 4. ADR 0014: an overdraft is allowed. A credit card goes negative.
  r := public.record_transaction(card, 100, 'EXPENSE', 'Probe card', d, 'probe-k3');
  assert (r ->> 'source_balance')::numeric = -100, format('4 overdraft: %s', r);

  -- 5. A partial repayment moves wallet and debt once each (F1's shape).
  r := public.record_transaction(cash, 1000, 'DEBT_REPAYMENT', 'Probe loan', d, 'probe-k4', null, debt);
  assert (r ->> 'source_balance')::numeric = 6577, format('5 wallet: %s', r);
  assert (r ->> 'debt_remaining')::numeric = 3500, format('5 debt: %s', r);
  assert (r ->> 'debt_settled')::boolean = false, format('5 settled: %s', r);
  pay_id := (r -> 'transaction' ->> 'id')::uuid;

  -- 6. ADR 0016: an overpayment is rejected, with the remainder in `detail`,
  --    and nothing is written.
  msg := null;
  begin
    perform public.record_transaction(cash, 3500.01, 'DEBT_REPAYMENT', 'Probe over', d, 'probe-k5', null, debt);
    raise exception 'PROBE: overpayment was accepted';
  exception when others then
    get stacked diagnostics msg = message_text, det = pg_exception_detail;
  end;
  assert msg = 'DEBT_OVERPAYMENT', format('6 message: %s', msg);
  assert det::numeric = 3500, format('6 detail: %s', det);
  select count(*) into n from public.transactions where idempotency_key = 'probe-k5';
  assert n = 0, '6 an overpayment wrote a row';
  select balance into bal from public.wallets where id = cash;
  assert bal = 6577, format('6 wallet moved: %s', bal);

  -- 7. Replay BEFORE the guard: the payment that settles the debt, retried,
  --    replays instead of being rejected against the zero it produced.
  r := public.record_transaction(cash, 3500, 'DEBT_REPAYMENT', 'Probe payoff', d, 'probe-k6', null, debt);
  assert (r ->> 'debt_remaining')::numeric = 0, format('7 remaining: %s', r);
  assert (r ->> 'debt_settled')::boolean = true, format('7 settled: %s', r);
  assert (r ->> 'source_balance')::numeric = 3077, format('7 wallet: %s', r);
  r := public.record_transaction(cash, 3500, 'DEBT_REPAYMENT', 'Probe payoff', d, 'probe-k6', null, debt);
  assert (r ->> 'reused')::boolean = true, format('7 replay rejected or rewrote: %s', r);
  assert (r ->> 'source_balance')::numeric = 3077, format('7 replay moved money: %s', r);

  -- 8. Rejections, each with its SQLSTATE.
  code := null;
  begin
    perform public.record_transaction(gone, 10, 'EXPENSE', 'x', d, 'probe-r1');
    raise exception 'PROBE: deleted wallet accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = 'P0002', format('8 deleted wallet: %s', code);

  code := null;
  begin
    perform public.record_transaction(b_cash, 10, 'EXPENSE', 'x', d, 'probe-r2');
    raise exception 'PROBE: foreign wallet accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = 'P0002', format('8 foreign wallet: %s', code);

  code := null;
  begin
    perform public.record_transaction(cash, 10, 'EXPENSE', 'x', d, 'probe-r3', b_cat);
    raise exception 'PROBE: foreign category accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = 'P0002', format('8 foreign category: %s', code);

  r := public.record_transaction(cash, 1, 'EXPENSE', 'Probe own category', d, 'probe-r4', a_cat);
  assert (r -> 'transaction' ->> 'category_id')::uuid = a_cat, format('8 own category: %s', r);

  code := null;
  begin
    perform public.record_transaction(cash, 10, 'TRANSFER', 'x', d, 'probe-r5');
    raise exception 'PROBE: transfer accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('8 transfer: %s', code);

  code := null;
  begin
    perform public.record_transaction(cash, 10, 'EXPENSE', 'x', d, null);
    raise exception 'PROBE: missing key accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('8 missing key: %s', code);

  code := null;
  begin
    perform public.record_transaction(cash, 10, 'DEBT_REPAYMENT', 'x', d, 'probe-r6');
    raise exception 'PROBE: repayment without a debt accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('8 repayment without debt: %s', code);

  -- No user in the JWT. The subtransaction's abort also reverts this setting.
  code := null;
  begin
    perform set_config('request.jwt.claims', '{}', true);
    perform public.record_transaction(cash, 10, 'EXPENSE', 'x', d, 'probe-r7');
    raise exception 'PROBE: anonymous call accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '28000', format('8 no auth: %s', code);
  assert auth.uid() = a_user, '8 the claims were not restored';

  -- Nothing above wrote. The own-category row moved cash by 1.
  select balance into bal from public.wallets where id = cash;
  assert bal = 3076, format('8 rejections moved money: %s', bal);

  -- 9. Delete reverses wallet AND debt (un-settling it); a second delete is a
  --    no-op; restore reapplies both.
  r := public.set_transaction_deleted(pay_id, true);
  assert (r ->> 'changed')::boolean = true, format('9 delete: %s', r);
  assert (r ->> 'source_balance')::numeric = 4076, format('9 delete wallet: %s', r);
  assert (r ->> 'debt_remaining')::numeric = 1000, format('9 delete debt: %s', r);
  assert (r ->> 'debt_settled')::boolean = false, format('9 delete settled: %s', r);
  assert (r -> 'transaction' ->> 'is_deleted')::boolean = true, format('9 delete flag: %s', r);

  r := public.set_transaction_deleted(pay_id, true);
  assert (r ->> 'changed')::boolean = false, format('9 second delete: %s', r);
  assert (r ->> 'source_balance')::numeric = 4076, format('9 second delete moved money: %s', r);

  r := public.set_transaction_deleted(pay_id, false);
  assert (r ->> 'changed')::boolean = true, format('9 restore: %s', r);
  assert (r ->> 'source_balance')::numeric = 3076, format('9 restore wallet: %s', r);
  assert (r ->> 'debt_remaining')::numeric = 0, format('9 restore debt: %s', r);
  assert (r ->> 'debt_settled')::boolean = true, format('9 restore settled: %s', r);

  code := null;
  begin
    perform public.set_transaction_deleted(b_tx, true);
    raise exception 'PROBE: foreign delete accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = 'P0002', format('9 foreign delete: %s', code);

  -- 10. A key whose row the user deleted replays the DELETED row; it does not
  --     resurrect the intent as a new row.
  r := public.set_transaction_deleted(k1_id, true);
  assert (r ->> 'source_balance')::numeric = 3276, format('10 delete k1: %s', r);
  r := public.record_transaction(cash, 200, 'EXPENSE', 'Probe groceries', d, 'probe-k1');
  assert (r ->> 'reused')::boolean = true, format('10 reused: %s', r);
  assert (r -> 'transaction' ->> 'is_deleted')::boolean = true, format('10 resurrected: %s', r);
  assert (r ->> 'source_balance')::numeric = 3276, format('10 moved money: %s', r);
  select count(*) into n from public.transactions where idempotency_key = 'probe-k1';
  assert n = 1, format('10 rows with probe-k1: %s', n);

  -- 11. Import: one relative update per wallet, a transfer's two legs, and a
  --     DEBT_REPAYMENT row that moves the wallet only.
  --     cash: -35.5 -64.5 +1000 -250 -20 = +630 ; card: +250
  r := public.import_transactions('probe-imp1', jsonb_build_array(
    jsonb_build_object('row_index', 1, 'wallet_id', cash, 'amount', 35.5, 'type', 'EXPENSE', 'description', 'Imp 1', 'transaction_date', d, 'category_id', a_cat),
    jsonb_build_object('row_index', 2, 'wallet_id', cash, 'amount', 64.5, 'type', 'EXPENSE', 'description', 'Imp 2', 'transaction_date', d),
    jsonb_build_object('row_index', 3, 'wallet_id', cash, 'amount', 1000, 'type', 'INCOME', 'description', 'Imp 3', 'transaction_date', d),
    jsonb_build_object('row_index', 4, 'wallet_id', cash, 'destination_wallet_id', card, 'amount', 250, 'type', 'TRANSFER', 'description', 'Imp 4', 'transaction_date', d),
    jsonb_build_object('row_index', 5, 'wallet_id', cash, 'amount', 20, 'type', 'DEBT_REPAYMENT', 'description', 'Imp 5', 'transaction_date', d)
  ));
  assert (r ->> 'reused')::boolean = false, format('11 reused: %s', r);
  assert jsonb_array_length(r -> 'inserted_ids') = 5, format('11 inserted: %s', r);
  select balance into bal from public.wallets where id = cash;
  assert bal = 3906, format('11 cash: %s', bal);
  select balance into bal from public.wallets where id = card;
  assert bal = 150, format('11 card: %s', bal);
  select remaining_amount into bal from public.debts where id = debt;
  assert bal = 0, format('11 a repayment row moved the debt: %s', bal);
  select count(*) into n from public.transactions where idempotency_key like 'probe-imp1:%';
  assert n = 5, format('11 keyed rows: %s', n);

  -- 12. The same import key replays: same rows, no new money.
  r := public.import_transactions('probe-imp1', jsonb_build_array(
    jsonb_build_object('row_index', 1, 'wallet_id', cash, 'amount', 35.5, 'type', 'EXPENSE', 'description', 'Imp 1', 'transaction_date', d)
  ));
  assert (r ->> 'reused')::boolean = true, format('12 reused: %s', r);
  assert jsonb_array_length(r -> 'inserted_ids') = 5, format('12 inserted: %s', r);
  select balance into bal from public.wallets where id = cash;
  assert bal = 3906, format('12 replay moved money: %s', bal);

  -- 13. All or nothing: one bad row aborts the batch, naming the row.
  msg := null; code := null;
  begin
    perform public.import_transactions('probe-imp2', jsonb_build_array(
      jsonb_build_object('row_index', 1, 'wallet_id', cash,   'amount', 10, 'type', 'EXPENSE', 'description', 'ok',  'transaction_date', d),
      jsonb_build_object('row_index', 2, 'wallet_id', b_cash, 'amount', 10, 'type', 'EXPENSE', 'description', 'bad', 'transaction_date', d)
    ));
    raise exception 'PROBE: foreign wallet in an import accepted';
  exception when others then get stacked diagnostics msg = message_text, code = returned_sqlstate; end;
  assert code = 'P0002', format('13 foreign wallet: %s %s', code, msg);
  assert msg like 'Row 2:%', format('13 message: %s', msg);
  select count(*) into n from public.transactions where idempotency_key like 'probe-imp2:%';
  assert n = 0, format('13 partial import: %s rows', n);
  select balance into bal from public.wallets where id = cash;
  assert bal = 3906, format('13 partial import moved money: %s', bal);

  code := null;
  begin
    perform public.import_transactions('probe-imp3', jsonb_build_array(
      jsonb_build_object('row_index', 1, 'wallet_id', gone, 'amount', 10, 'type', 'EXPENSE', 'description', 'x', 'transaction_date', d)
    ));
    raise exception 'PROBE: deleted wallet in an import accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = 'P0002', format('13 deleted wallet: %s', code);

  code := null;
  begin
    perform public.import_transactions('probe-imp4', jsonb_build_array(
      jsonb_build_object('row_index', 1, 'wallet_id', cash, 'amount', 10, 'type', 'EXPENSE', 'description', 'x', 'transaction_date', d),
      jsonb_build_object('row_index', 1, 'wallet_id', cash, 'amount', 10, 'type', 'EXPENSE', 'description', 'y', 'transaction_date', d)
    ));
    raise exception 'PROBE: duplicate row_index accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('13 duplicate row_index: %s', code);

  code := null;
  begin
    perform public.import_transactions('probe-imp5', jsonb_build_array(
      jsonb_build_object('row_index', 1, 'wallet_id', cash, 'destination_wallet_id', cash, 'amount', 10, 'type', 'TRANSFER', 'description', 'x', 'transaction_date', d)
    ));
    raise exception 'PROBE: self-transfer accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('13 self-transfer: %s', code);

  -- 14. The private helpers are not callable by a signed-in client.
  code := null;
  begin
    perform public._ledger_apply_effect(a_user, cash, null, null, 'INCOME', 1000000, 1);
    raise exception 'PROBE: helper callable';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '42501', format('14 helper: %s', code);

  -- 15. Grants, and the untracked twin is gone.
  assert not has_function_privilege('anon', 'public.record_transaction(uuid,numeric,text,text,date,text,uuid,uuid,text)', 'execute'), '15 anon record';
  assert not has_function_privilege('anon', 'public.set_transaction_deleted(uuid,boolean)', 'execute'), '15 anon delete';
  assert not has_function_privilege('anon', 'public.import_transactions(text,jsonb)', 'execute'), '15 anon import';
  assert has_function_privilege('authenticated', 'public.record_transaction(uuid,numeric,text,text,date,text,uuid,uuid,text)', 'execute'), '15 auth record';
  assert has_function_privilege('authenticated', 'public.set_transaction_deleted(uuid,boolean)', 'execute'), '15 auth delete';
  assert has_function_privilege('authenticated', 'public.import_transactions(text,jsonb)', 'execute'), '15 auth import';
  assert not has_function_privilege('authenticated', 'public._ledger_apply_effect(uuid,uuid,uuid,uuid,text,numeric,integer)', 'execute'), '15 auth helper';
  assert to_regprocedure('public.create_ledger_transaction(uuid,numeric,text,text,date,text,uuid,uuid,uuid,text)') is null,
    '15 create_ledger_transaction still exists';
end;
$probe$;

-- -----------------------------------------------------------------------------
-- Back to the owner: nothing of user B's moved.
-- -----------------------------------------------------------------------------
reset role;

do $owner$
declare
  bal numeric;
  del boolean;
begin
  select balance into bal from public.wallets where id = '00000000-0000-4000-8000-00000000b101';
  assert bal = 500, format('B wallet moved: %s', bal);
  select is_deleted into del from public.transactions where id = '00000000-0000-4000-8000-00000000b401';
  assert del = false, 'B transaction was deleted';
end;
$owner$;

select 'PHASE 51 PROBE OK' as result;

rollback;
