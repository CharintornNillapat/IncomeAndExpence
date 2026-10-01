-- =============================================================================
-- Probe for 20260930_phase58b_update_transaction.sql (ADR 0033). NOTHING PERSISTS.
--
-- Same shape as the Phase 51, 52 and 58s probes: one transaction ending in
-- ROLLBACK. Keep the `\ir` line to test the migration before it is applied;
-- delete it to test the deployed function afterwards. A runner without psql
-- meta-commands pastes the migration's text in place of the `\ir` line.
--
-- Balances in the fixture are not the sum of its rows; every check is a delta
-- from a known balance, which is all update_transaction can change.
--
-- The fixture's rows carry an old `updated_at`. Inside one transaction now()
-- does not move, so a row written by the fixture and then edited would keep the
-- same timestamp and the stale guard could not be seen.
--
-- Success is the final row, `PHASE 58B PROBE OK`.
-- =============================================================================

begin;

\ir ../migrations/20260930_phase58b_update_transaction.sql

-- -----------------------------------------------------------------------------
-- Fixture, as the table owner.
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00058b00a001', 'phase58b-probe-a@example.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00058b00b001', 'phase58b-probe-b@example.invalid', 'authenticated', 'authenticated');

insert into public.wallets (id, user_id, name, type, currency, balance, is_deleted) values
  ('00000000-0000-4000-8000-00058b00a101', '00000000-0000-4000-8000-00058b00a001', 'Probe Cash', 'CASH',         'THB', 5000, false),
  ('00000000-0000-4000-8000-00058b00a102', '00000000-0000-4000-8000-00058b00a001', 'Probe Bank', 'BANK_ACCOUNT', 'THB', 1000, false),
  ('00000000-0000-4000-8000-00058b00a103', '00000000-0000-4000-8000-00058b00a001', 'Probe Gone', 'CASH',         'THB',    0, true),
  ('00000000-0000-4000-8000-00058b00b101', '00000000-0000-4000-8000-00058b00b001', 'Probe B',    'CASH',         'THB',  500, false);

insert into public.categories (id, user_id, name, type) values
  ('00000000-0000-4000-8000-00058b00a301', '00000000-0000-4000-8000-00058b00a001', 'Probe Food',   'EXPENSE'),
  ('00000000-0000-4000-8000-00058b00b301', '00000000-0000-4000-8000-00058b00b001', 'Probe B Food', 'EXPENSE');

insert into public.debts (id, user_id, name, total_amount, remaining_amount) values
  ('00000000-0000-4000-8000-00058b00a201', '00000000-0000-4000-8000-00058b00a001', 'Probe Loan', 5000, 1000);

insert into public.transactions
  (id, user_id, wallet_id, destination_wallet_id, category_id, debt_id, amount, type, description, raw_input, transaction_date, is_deleted, updated_at)
values
  -- t1: an expense, edited through several shapes below.
  ('00000000-0000-4000-8000-00058b00a401', '00000000-0000-4000-8000-00058b00a001', '00000000-0000-4000-8000-00058b00a101', null,
   '00000000-0000-4000-8000-00058b00a301', null, 100, 'EXPENSE', 'Lunch', '60+40', '2026-09-28', false, '2026-09-01 00:00+00'),
  -- t2: a transfer, Cash to Bank.
  ('00000000-0000-4000-8000-00058b00a402', '00000000-0000-4000-8000-00058b00a001', '00000000-0000-4000-8000-00058b00a101',
   '00000000-0000-4000-8000-00058b00a102', null, null, 200, 'TRANSFER', 'Move', null, '2026-09-28', false, '2026-09-01 00:00+00'),
  -- t3: a debt repayment.
  ('00000000-0000-4000-8000-00058b00a403', '00000000-0000-4000-8000-00058b00a001', '00000000-0000-4000-8000-00058b00a101', null,
   null, '00000000-0000-4000-8000-00058b00a201', 300, 'DEBT_REPAYMENT', 'Loan pay', null, '2026-09-28', false, '2026-09-01 00:00+00'),
  -- t4: a downward adjustment.
  ('00000000-0000-4000-8000-00058b00a404', '00000000-0000-4000-8000-00058b00a001', '00000000-0000-4000-8000-00058b00a101', null,
   null, null, -50, 'ADJUSTMENT', 'Manual balance adjustment (-50)', null, '2026-09-28', false, '2026-09-01 00:00+00'),
  -- t5: a deleted expense.
  ('00000000-0000-4000-8000-00058b00a405', '00000000-0000-4000-8000-00058b00a001', '00000000-0000-4000-8000-00058b00a101', null,
   null, null, 10, 'EXPENSE', 'Deleted', null, '2026-09-28', true, '2026-09-01 00:00+00'),
  -- t6: an expense on a wallet since deleted.
  ('00000000-0000-4000-8000-00058b00a406', '00000000-0000-4000-8000-00058b00a001', '00000000-0000-4000-8000-00058b00a103', null,
   null, null, 40, 'EXPENSE', 'Old wallet', null, '2026-09-28', false, '2026-09-01 00:00+00'),
  -- tb: B's expense.
  ('00000000-0000-4000-8000-00058b00b401', '00000000-0000-4000-8000-00058b00b001', '00000000-0000-4000-8000-00058b00b101', null,
   null, null, 20, 'EXPENSE', 'B lunch', null, '2026-09-28', false, '2026-09-01 00:00+00');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00058b00a001","role":"authenticated"}', true);

do $probe$
declare
  cash   uuid := '00000000-0000-4000-8000-00058b00a101';
  bank   uuid := '00000000-0000-4000-8000-00058b00a102';
  gone   uuid := '00000000-0000-4000-8000-00058b00a103';
  b_wal  uuid := '00000000-0000-4000-8000-00058b00b101';
  food   uuid := '00000000-0000-4000-8000-00058b00a301';
  b_food uuid := '00000000-0000-4000-8000-00058b00b301';
  loan   uuid := '00000000-0000-4000-8000-00058b00a201';
  t1     uuid := '00000000-0000-4000-8000-00058b00a401';
  t2     uuid := '00000000-0000-4000-8000-00058b00a402';
  t3     uuid := '00000000-0000-4000-8000-00058b00a403';
  t4     uuid := '00000000-0000-4000-8000-00058b00a404';
  t5     uuid := '00000000-0000-4000-8000-00058b00a405';
  t6     uuid := '00000000-0000-4000-8000-00058b00a406';
  tb     uuid := '00000000-0000-4000-8000-00058b00b401';
  old_ts timestamptz := '2026-09-01 00:00+00';
  d      date := '2026-09-28';
  r      jsonb;
  ts     timestamptz;
  bal    numeric;
  bal2   numeric;
  code   text;
  msg    text;
begin
  -- 1. An expense's amount: its wallet moves by the difference only.
  r := public.update_transaction(t1, old_ts, 'EXPENSE', 150, cash, null, food, 'Lunch', d, '100+50');
  assert (r ->> 'changed')::boolean, format('1 changed: %s', r);
  select balance into bal from public.wallets where id = cash;
  assert bal = 4950, format('1 cash (5000 + 100 - 150): %s', bal);
  assert (r -> 'transaction' ->> 'raw_input') = '100+50', format('1 raw input: %s', r);
  assert jsonb_array_length(r -> 'balances') = 1, format('1 balances: %s', r);
  ts := (r -> 'transaction' ->> 'updated_at')::timestamptz;
  assert ts <> old_ts, '1 updated_at did not move';

  -- 2. Replay: the same request again changes nothing - even when it names the
  --    version before its own first attempt, which is what a retry after a
  --    lost response does.
  r := public.update_transaction(t1, old_ts, 'EXPENSE', 150, cash, null, food, 'Lunch', d, '100+50');
  assert not (r ->> 'changed')::boolean, format('2 stale replay: %s', r);
  r := public.update_transaction(t1, ts, 'EXPENSE', 150, cash, null, food, 'Lunch', d, '100+50');
  assert not (r ->> 'changed')::boolean, format('2 replay: %s', r);
  select balance into bal from public.wallets where id = cash;
  assert bal = 4950, format('2 a replay moved money: %s', bal);

  -- 3. A stale edit is refused, and moves nothing.
  code := null; msg := null;
  begin
    perform public.update_transaction(t1, old_ts, 'EXPENSE', 999, cash, null, food, 'Lunch', d, null);
    raise exception 'PROBE: stale edit accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate, msg = message_text; end;
  assert code = 'P0001' and msg = 'TRANSACTION_CHANGED', format('3 stale: %s %s', code, msg);
  select balance into bal from public.wallets where id = cash;
  assert bal = 4950, format('3 a stale edit moved money: %s', bal);

  -- 4. A wallet switch: the old wallet gets the money back, the new one pays.
  r := public.update_transaction(t1, ts, 'EXPENSE', 150, bank, null, food, 'Lunch', d, '100+50');
  select balance into bal from public.wallets where id = cash;
  select balance into bal2 from public.wallets where id = bank;
  assert bal = 5100 and bal2 = 850, format('4 switch cash/bank: %s / %s', bal, bal2);
  assert jsonb_array_length(r -> 'balances') = 2, format('4 balances: %s', r);
  ts := (r -> 'transaction' ->> 'updated_at')::timestamptz;

  -- 5. Expense to transfer, Bank to Cash: the expense is reversed on Bank, then
  --    the transfer takes 150 from Bank and gives it to Cash.
  r := public.update_transaction(t1, ts, 'TRANSFER', 150, bank, cash, null, 'Lunch', d, '100+50');
  select balance into bal from public.wallets where id = cash;
  select balance into bal2 from public.wallets where id = bank;
  assert bal = 5250 and bal2 = 850, format('5 expense to transfer cash/bank: %s / %s', bal, bal2);
  assert (r -> 'transaction' ->> 'type') = 'TRANSFER', format('5 type: %s', r);
  ts := (r -> 'transaction' ->> 'updated_at')::timestamptz;

  -- 6. The transfer's From and To swapped: both wallets move twice the amount.
  r := public.update_transaction(t1, ts, 'TRANSFER', 150, cash, bank, null, 'Lunch', d, '100+50');
  select balance into bal from public.wallets where id = cash;
  select balance into bal2 from public.wallets where id = bank;
  assert bal = 4950 and bal2 = 1150, format('6 swap cash/bank: %s / %s', bal, bal2);

  -- 7. Transfer to income: the transfer is reversed, and Bank receives 200.
  r := public.update_transaction(t2, old_ts, 'INCOME', 200, bank, null, food, 'Move', d, null);
  select balance into bal from public.wallets where id = cash;
  select balance into bal2 from public.wallets where id = bank;
  assert bal = 5150 and bal2 = 1150, format('7 transfer to income cash/bank: %s / %s', bal, bal2);
  assert (r -> 'transaction' ->> 'destination_wallet_id') is null, format('7 destination kept: %s', r);

  -- 8. A debt repayment: note and date change; nothing moves.
  r := public.update_transaction(t3, old_ts, 'DEBT_REPAYMENT', 300, cash, null, null, 'Loan pay (Sept)', '2026-09-27', 'ignored');
  assert (r ->> 'changed')::boolean, format('8 changed: %s', r);
  assert (r -> 'transaction' ->> 'description') = 'Loan pay (Sept)', format('8 note: %s', r);
  assert (r -> 'transaction' ->> 'transaction_date') = '2026-09-27', format('8 date: %s', r);
  assert (r -> 'transaction' ->> 'raw_input') is null, format('8 raw input changed: %s', r);
  assert (r -> 'transaction' ->> 'debt_id')::uuid = loan, format('8 debt link lost: %s', r);
  select balance into bal from public.wallets where id = cash;
  assert bal = 5150, format('8 cash moved: %s', bal);
  select remaining_amount into bal from public.debts where id = loan;
  assert bal = 1000, format('8 debt moved: %s', bal);

  -- 9. Its money fields cannot change, and neither can its type.
  code := null;
  begin
    perform public.update_transaction(t3, null, 'DEBT_REPAYMENT', 400, cash, null, null, 'Loan pay', d, null);
    raise exception 'PROBE: repayment amount accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('9 repayment amount: %s', code);

  code := null;
  begin
    perform public.update_transaction(t3, null, 'EXPENSE', 300, cash, null, null, 'Loan pay', d, null);
    raise exception 'PROBE: repayment type change accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('9 repayment type: %s', code);

  code := null;
  begin
    perform public.update_transaction(t3, null, 'DEBT_REPAYMENT', 300, bank, null, null, 'Loan pay', d, null);
    raise exception 'PROBE: repayment wallet change accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('9 repayment wallet: %s', code);

  -- 10. An adjustment: its note changes; its amount cannot.
  r := public.update_transaction(t4, old_ts, 'ADJUSTMENT', -50, cash, null, null, 'Counted the cash', d, null);
  assert (r ->> 'changed')::boolean, format('10 adjustment note: %s', r);
  code := null;
  begin
    perform public.update_transaction(t4, null, 'ADJUSTMENT', -80, cash, null, null, 'Counted the cash', d, null);
    raise exception 'PROBE: adjustment amount accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('10 adjustment amount: %s', code);

  -- 11. No row can become a repayment or an adjustment.
  code := null;
  begin
    perform public.update_transaction(t1, null, 'ADJUSTMENT', 150, cash, null, null, 'Lunch', d, null);
    raise exception 'PROBE: became an adjustment';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('11 into adjustment: %s', code);
  code := null;
  begin
    perform public.update_transaction(t1, null, 'DEBT_REPAYMENT', 150, cash, null, null, 'Lunch', d, null);
    raise exception 'PROBE: became a repayment';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('11 into repayment: %s', code);

  -- 12. A deleted row is not editable.
  code := null;
  begin
    perform public.update_transaction(t5, null, 'EXPENSE', 20, cash, null, null, 'Deleted', d, null);
    raise exception 'PROBE: deleted row edited';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('12 deleted row: %s', code);

  -- 13. Ownership: B's row, B's wallet, B's category; and a newly chosen
  --     wallet that is deleted.
  code := null;
  begin
    perform public.update_transaction(tb, null, 'EXPENSE', 25, b_wal, null, null, 'B lunch', d, null);
    raise exception 'PROBE: another user''s row edited';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = 'P0002', format('13 foreign row: %s', code);

  code := null;
  begin
    perform public.update_transaction(t2, null, 'INCOME', 200, b_wal, null, null, 'Move', d, null);
    raise exception 'PROBE: another user''s wallet accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = 'P0002', format('13 foreign wallet: %s', code);

  code := null;
  begin
    perform public.update_transaction(t2, null, 'INCOME', 200, bank, null, b_food, 'Move', d, null);
    raise exception 'PROBE: another user''s category accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = 'P0002', format('13 foreign category: %s', code);

  code := null;
  begin
    perform public.update_transaction(t2, null, 'INCOME', 200, gone, null, null, 'Move', d, null);
    raise exception 'PROBE: a deleted wallet was chosen';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = 'P0002', format('13 newly chosen deleted wallet: %s', code);

  -- 14. A row already on a deleted wallet can still be edited there.
  r := public.update_transaction(t6, old_ts, 'EXPENSE', 60, gone, null, null, 'Old wallet', d, null);
  select balance into bal from public.wallets where id = gone;
  assert bal = -20, format('14 kept deleted wallet (0 + 40 - 60): %s', bal);

  -- 15. Shape rules.
  code := null;
  begin
    perform public.update_transaction(t2, null, 'TRANSFER', 200, bank, bank, null, 'Move', d, null);
    raise exception 'PROBE: transfer to itself accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('15 same wallets: %s', code);

  code := null;
  begin
    perform public.update_transaction(t2, null, 'TRANSFER', 200, bank, cash, food, 'Move', d, null);
    raise exception 'PROBE: transfer with a category accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('15 transfer category: %s', code);

  code := null;
  begin
    perform public.update_transaction(t2, null, 'INCOME', 200, bank, cash, null, 'Move', d, null);
    raise exception 'PROBE: income with a destination accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('15 destination on income: %s', code);

  code := null;
  begin
    perform public.update_transaction(t2, null, 'INCOME', 0, bank, null, null, 'Move', d, null);
    raise exception 'PROBE: zero amount accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('15 zero: %s', code);

  code := null;
  begin
    perform public.update_transaction(t2, null, 'INCOME', 200, bank, null, null, '   ', d, null);
    raise exception 'PROBE: blank note accepted';
  exception when others then get stacked diagnostics code = returned_sqlstate; end;
  assert code = '22023', format('15 blank note: %s', code);

  -- Every rejection above left the balances where step 14 put them.
  select balance into bal from public.wallets where id = cash;
  select balance into bal2 from public.wallets where id = bank;
  assert bal = 5150 and bal2 = 1150, format('15 rejections moved money cash/bank: %s / %s', bal, bal2);
end;
$probe$;

-- -----------------------------------------------------------------------------
-- 16. Grants, and B untouched.
-- -----------------------------------------------------------------------------
reset role;

do $owner_after$
declare
  sig text := 'public.update_transaction(uuid,timestamptz,text,numeric,uuid,uuid,uuid,text,date,text)';
  bal numeric;
begin
  assert not has_function_privilege('anon', sig, 'execute'), '16 anon can execute';
  assert has_function_privilege('authenticated', sig, 'execute'), '16 authenticated cannot execute';
  assert (select prosecdef from pg_proc where oid = sig::regprocedure), '16 not security definer';
  assert (select array_to_string(proconfig, ',') from pg_proc where oid = sig::regprocedure)
         like '%search_path=public, pg_temp%', '16 search_path not pinned';
  select balance into bal from public.wallets where id = '00000000-0000-4000-8000-00058b00b101';
  assert bal = 500, format('16 B wallet moved: %s', bal);
  assert (select amount from public.transactions where id = '00000000-0000-4000-8000-00058b00b401') = 20, '16 B row changed';
end;
$owner_after$;

select 'PHASE 58B PROBE OK' as result;

rollback;
