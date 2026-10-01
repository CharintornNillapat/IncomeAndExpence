// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, cleanup, waitFor, screen, fireEvent } from '@testing-library/react';
import { AccountModal } from '../src/components/account/AccountModal';
import {
  FinanceProvider,
  useFinanceState,
  useFinanceActions,
  type FinanceActionsContextType,
  type FinanceStateContextType,
} from '../src/context/FinanceContext';
import type { ImportRowValidation, TransactionEdit } from '../src/types';
import { formatCurrencyAmount } from '../src/utils/currency';
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js';

/**
 * The signed-in write path (ADR 0022).
 *
 * Every other test in the repo — all 22 Playwright specs and
 * `ledger-guards.test.tsx` — runs the local-storage branch, because the
 * provider's auth effect returns early on `!isSupabaseConfigured`. The two
 * defects the post-Phase-49 review found live only in the authenticated
 * branch, so this file swaps `src/lib/supabase` for a fake that reports itself
 * configured and signed in. Nothing in `src/` is exported for it (ADR 0021).
 *
 * Two properties of this file are the reason it exists, not style:
 *
 *   - **No `act()`.** `act()` flushes React's work before the awaited code
 *     resumes, so the ref-mirror effect lands in an idealized order and a
 *     ref-after-`await` read comes out correct. F1's double debt write is
 *     invisible under `act()` and visible without it.
 *   - **Every fake call settles on a macrotask** (`setTimeout(0)`), not a
 *     resolved promise. That gives React the window to commit and run effects
 *     between awaits that a real network round-trip gives it.
 *
 * A test added here for an ordering or ref-mirror property must keep both.
 */

// Actions are awaited directly and state is read through `waitFor`.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;

type Op = 'select' | 'insert' | 'update' | 'delete' | 'rpc';

const fake = vi.hoisted(() => {
  const USER_ID = 'user-test-1';
  const state = {
    tables: {} as Record<string, Record<string, unknown>[]>,
    calls: [] as {
      table: string;
      op: 'select' | 'insert' | 'update' | 'delete' | 'rpc';
      payload?: unknown;
      filters: ['eq' | 'in', string, unknown][];
    }[],
    /**
     * `${table}:${op}` → the error that call returns, until cleared. `onlyId`
     * narrows it to a call filtered by `eq('id', onlyId)`, so one of several
     * wallet writes can fail while the others land. An RPC's key is
     * `rpc:<name>`.
     */
    failures: new Map<string, { message: string; onlyId?: string; code?: string; status?: number }>(),
    /** `${table}:${op}` (or `rpc:<name>`) → a promise the call waits on before settling. */
    gates: new Map<string, Promise<void>>(),
    /**
     * RPC name → the server-side handler. An RPC with no handler answers as a
     * missing function (`PGRST202`), which is what a project without the
     * Phase 51 migration returns - so every test that installs nothing runs
     * the legacy fallback, exactly as it did before the RPCs existed.
     */
    rpcs: new Map<string, (args: Record<string, unknown>) => { data: unknown; error: { message: string; code?: string; details?: string } | null }>(),
    /**
     * RPC names whose next call COMMITS and then loses its response: the
     * handler runs, and the client sees a transport error. The request-sent,
     * response-lost case an idempotency key exists for (F4).
     */
    lostResponses: new Set<string>(),
    /** Every `auth.signOut` call's scope, in order (`'local'` when none given). */
    signOuts: [] as string[],
    authCallback: null as null | ((event: string, session: unknown) => Promise<void> | void),
    /** The status callback the provider passed to `channel.subscribe`. */
    channelStatus: null as null | ((status: string) => void),
    /** How many times `auth.getUser()` asked the auth server about this session. */
    getUserCalls: 0,
    /** What `auth.getUser()` answers with; `null` means the session is valid. */
    userError: null as unknown,
    /**
     * The listeners `onDataApiUnauthorized` registered. A failure injected with
     * `status: 401` notifies them before the call settles, as the fetch wrapper
     * in `src/lib/supabase.ts` does for a real 401 from PostgREST.
     */
    unauthorized: new Set<() => void>(),
    seq: 0,
  };

  const session = {
    user: {
      id: USER_ID,
      email: 'harness@example.com',
      user_metadata: { name: 'Harness' },
      email_confirmed_at: '2026-09-01T00:00:00.000Z',
      created_at: '2026-09-01T00:00:00.000Z',
    },
  };

  const macrotask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  function matches(row: Record<string, unknown>, filters: ['eq' | 'in', string, unknown][]) {
    return filters.every(([kind, col, value]) =>
      kind === 'eq' ? row[col] === value : (value as unknown[]).includes(row[col])
    );
  }

  function builder(table: string) {
    const call: (typeof state.calls)[number] = { table, op: 'select', filters: [] };
    let single = false;
    let returning = false;

    async function execute() {
      state.calls.push(call);
      const key = `${table}:${call.op}`;
      const gate = state.gates.get(key);
      if (gate) await gate;
      await macrotask();

      const failure = state.failures.get(key);
      const targetsThisCall =
        failure && (failure.onlyId === undefined || call.filters.some(([k, c, v]) => k === 'eq' && c === 'id' && v === failure.onlyId));
      if (failure && targetsThisCall) {
        if (failure.status === 401) state.unauthorized.forEach((listener) => listener());
        return { data: null, error: { message: failure.message, code: failure.code } };
      }

      const rows = (state.tables[table] ??= []);
      const now = new Date().toISOString();

      if (call.op === 'select') {
        return { data: rows.filter((r) => matches(r, call.filters)), error: null };
      }
      if (call.op === 'insert') {
        const payloads = (Array.isArray(call.payload) ? call.payload : [call.payload]) as Record<string, unknown>[];
        const inserted = payloads.map((p) => {
          state.seq += 1;
          return { id: `${table}-srv-${state.seq}`, created_at: now, updated_at: now, ...p };
        });
        rows.push(...inserted);
        const data = single ? inserted[0] : returning ? inserted : null;
        return { data, error: null };
      }
      if (call.op === 'update') {
        for (const row of rows) {
          if (matches(row, call.filters)) Object.assign(row, call.payload as object);
        }
        return { data: null, error: null };
      }
      state.tables[table] = rows.filter((r) => !matches(r, call.filters));
      return { data: null, error: null };
    }

    const b = {
      select() {
        if (call.op !== 'select') returning = true;
        return b;
      },
      order() {
        return b;
      },
      insert(payload: unknown) {
        call.op = 'insert';
        call.payload = payload;
        return b;
      },
      update(payload: unknown) {
        call.op = 'update';
        call.payload = payload;
        return b;
      },
      delete() {
        call.op = 'delete';
        return b;
      },
      eq(col: string, value: unknown) {
        call.filters.push(['eq', col, value]);
        return b;
      },
      in(col: string, values: unknown[]) {
        call.filters.push(['in', col, values]);
        return b;
      },
      single() {
        single = true;
        return b;
      },
      then<T1, T2>(
        onFulfilled?: (value: { data: unknown; error: { message: string } | null }) => T1 | PromiseLike<T1>,
        onRejected?: (reason: unknown) => T2 | PromiseLike<T2>
      ) {
        return execute().then(onFulfilled, onRejected);
      },
    };
    return b;
  }

  async function rpc(name: string, args: Record<string, unknown> = {}) {
    const key = `rpc:${name}`;
    state.calls.push({ table: key, op: 'rpc', payload: args, filters: [] });
    const gate = state.gates.get(key);
    if (gate) await gate;
    await macrotask();

    const failure = state.failures.get(key);
    if (failure) {
      if (failure.status === 401) state.unauthorized.forEach((listener) => listener());
      return { data: null, error: { message: failure.message, code: failure.code ?? 'P0001' } };
    }

    const handler = state.rpcs.get(name);
    if (!handler) {
      return {
        data: null,
        error: { code: 'PGRST202', message: `Could not find the function public.${name} in the schema cache` },
      };
    }
    const result = handler(args);
    if (state.lostResponses.delete(name)) {
      // What supabase-js reports for a fetch that never came back.
      return { data: null, error: { message: 'TypeError: Failed to fetch', code: '' } };
    }
    return result;
  }

  const channel = {
    on() {
      return channel;
    },
    subscribe(cb?: (status: string) => void) {
      state.channelStatus = cb ?? null;
      return channel;
    },
  };

  const client = {
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (cb: (event: string, session: unknown) => Promise<void> | void) => {
        state.authCallback = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getUser: async () => {
        state.getUserCalls += 1;
        await macrotask();
        const error = state.userError as { name?: string } | null;
        if (!error) return { data: { user: session.user }, error: null };
        // supabase-js drops a session the server says no longer exists, and
        // emits SIGNED_OUT itself (auth-js `_getUser` -> `_removeSession`).
        if (error.name === 'AuthSessionMissingError') await state.authCallback?.('SIGNED_OUT', null);
        return { data: { user: null }, error };
      },
      signOut: async (options?: { scope?: string }) => {
        state.signOuts.push(options?.scope ?? 'local');
        await macrotask();
        return { error: null };
      },
    },
    from: (table: string) => builder(table),
    rpc,
    channel: () => channel,
    removeChannel: () => {},
  };

  return { USER_ID, session, state, client };
});

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: fake.client,
  onDataApiUnauthorized: (listener: () => void) => {
    fake.state.unauthorized.add(listener);
    return () => {
      fake.state.unauthorized.delete(listener);
    };
  },
}));

const WALLET = 'wallet-srv-savings';
const WALLET_OPENING = 5000;
const CASH = 'wallet-srv-cash';
const CASH_OPENING = 1000;
const DEBT = 'debt-srv-student-loan';
const DEBT_REMAINING = 4500;
const TODAY = '2026-09-26';

function seed() {
  const created = '2026-09-01T00:00:00.000Z';
  fake.state.tables = {
    wallets: [
      {
        id: WALLET,
        user_id: fake.USER_ID,
        name: 'Savings',
        type: 'SAVINGS',
        balance: WALLET_OPENING,
        is_archived: false,
        is_deleted: false,
        created_at: created,
        updated_at: created,
      },
      {
        id: CASH,
        user_id: fake.USER_ID,
        name: 'Cash',
        type: 'CASH',
        balance: CASH_OPENING,
        is_archived: false,
        is_deleted: false,
        created_at: created,
        updated_at: created,
      },
    ],
    debts: [
      {
        id: DEBT,
        user_id: fake.USER_ID,
        name: 'Student Loan',
        total_amount: 10000,
        remaining_amount: DEBT_REMAINING,
        is_settled: false,
        is_deleted: false,
        created_at: created,
        updated_at: created,
      },
    ],
    // Empty categories keep the shipped defaults, which is what a fresh
    // account sees; nothing here depends on a category.
    categories: [],
    keyword_rules: [],
    transactions: [],
    diary_entries: [],
  };
}

let latest: { state: FinanceStateContextType; actions: FinanceActionsContextType } | null = null;

/** Renders extra UI inside the one provider, for component tests (ADR 0024). */
let showUi: ((node: React.ReactNode) => void) | null = null;

function Probe() {
  latest = { state: useFinanceState(), actions: useFinanceActions() };
  const [ui, setUi] = useState<React.ReactNode>(null);
  showUi = setUi;
  return <>{ui}</>;
}

const state = () => latest!.state;
const actions = () => latest!.actions;
const wallet = (id: string = WALLET) => state().wallets.find((w) => w.id === id);
const serverWallet = (id: string) => fake.state.tables.wallets.find((w) => w.id === id)!;
const debt = () => state().debts.find((d) => d.id === DEBT);

/** Every recorded write to one table, in order. */
const writes = (table: string, op: Op) => fake.state.calls.filter((c) => c.table === table && c.op === op);

function repay(amount: number, idempotencyKey?: string) {
  return actions().addTransaction({
    amount,
    type: 'DEBT_REPAYMENT',
    debtId: DEBT,
    walletId: WALLET,
    description: 'Student Loan payment',
    transactionDate: TODAY,
    idempotencyKey,
  });
}

function expense(amount: number, idempotencyKey?: string) {
  return actions().addTransaction({
    amount,
    type: 'EXPENSE',
    walletId: WALLET,
    description: 'Groceries',
    transactionDate: TODAY,
    idempotencyKey,
  });
}

/*
 * A JS stand-in for ADR 0023's three RPCs, over the fake's in-memory tables.
 * It mirrors the SQL's contract - relative updates, replay on the key (live or
 * deleted), replay before the overpayment guard, state-based delete - so the
 * tests below can assert what the CLIENT does with it. It proves nothing about
 * the SQL itself; `supabase/tests/20260927_ledger_rpcs.probe.sql` does that.
 *
 * ADR 0024 extends it the way the Phase 52 migration extends the SQL: a signed
 * ADJUSTMENT (every other type > 0), `create_wallet`, a per-row `debt_id` on
 * the import with the aggregate guard, and `list_my_sessions`
 * (`supabase/tests/20260928_phase52.probe.sql` pins the SQL side).
 */
type Row = Record<string, unknown>;

const round2 = (n: number) => Math.round(n * 100) / 100;
const SOURCE_SIGN: Record<string, number> = { EXPENSE: -1, DEBT_REPAYMENT: -1, TRANSFER: -1, INCOME: 1, ADJUSTMENT: 1 };
const rows = (table: string) => (fake.state.tables[table] ??= []);
const rpcError = (code: string, message: string, details?: string, hint?: string) => ({
  data: null,
  error: { code, message, details, hint },
});

/** ADR 0024: an ADJUSTMENT is signed and non-zero; every other type is > 0. */
const amountIsValid = (type: unknown, amount: number) =>
  type === 'ADJUSTMENT' ? amount !== 0 : amount > 0;

/** The sessions `list_my_sessions` serves; a test replaces them as needed. */
const SESSIONS = [
  {
    id: 'session-this',
    created_at: '2026-09-27T01:00:00.000Z',
    last_active: '2026-09-28T01:00:00.000Z',
    not_after: null,
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
    ip: '198.51.100.4',
    is_current: true,
  },
  {
    id: 'session-phone',
    created_at: '2026-09-20T01:00:00.000Z',
    last_active: '2026-09-26T01:00:00.000Z',
    not_after: null,
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    ip: '203.0.113.7',
    is_current: false,
  },
];

function applyEffect(tx: Row, sign: 1 | -1) {
  const now = new Date().toISOString();
  const amount = Number(tx.amount);
  let source_balance: number | null = null;
  let dest_balance: number | null = null;
  let debt_remaining: number | null = null;
  let debt_settled: boolean | null = null;

  const source = rows('wallets').find((w) => w.id === tx.wallet_id);
  if (source) {
    source.balance = round2(Number(source.balance) + sign * SOURCE_SIGN[tx.type as string] * amount);
    source.updated_at = now;
    source_balance = source.balance as number;
  }
  const dest = tx.type === 'TRANSFER' ? rows('wallets').find((w) => w.id === tx.destination_wallet_id) : undefined;
  if (dest) {
    dest.balance = round2(Number(dest.balance) + sign * amount);
    dest.updated_at = now;
    dest_balance = dest.balance as number;
  }
  const debtRow =
    tx.type === 'DEBT_REPAYMENT' && tx.debt_id
      ? rows('debts').find((d) => d.id === tx.debt_id && !d.is_deleted)
      : undefined;
  if (debtRow) {
    debtRow.remaining_amount = Math.max(0, round2(Number(debtRow.remaining_amount) - sign * amount));
    debtRow.is_settled = debtRow.remaining_amount === 0;
    debtRow.updated_at = now;
    debt_remaining = debtRow.remaining_amount as number;
    debt_settled = debtRow.is_settled as boolean;
  }
  return { source_balance, dest_balance, debt_remaining, debt_settled };
}

function rowState(tx: Row) {
  const debtRow = tx.debt_id ? rows('debts').find((d) => d.id === tx.debt_id) : undefined;
  return {
    transaction: { ...tx },
    source_balance: (rows('wallets').find((w) => w.id === tx.wallet_id)?.balance as number) ?? null,
    dest_balance: (rows('wallets').find((w) => w.id === tx.destination_wallet_id)?.balance as number) ?? null,
    debt_remaining: (debtRow?.remaining_amount as number) ?? null,
    debt_settled: (debtRow?.is_settled as boolean) ?? null,
  };
}

function insertTransaction(fields: Row): Row {
  const now = new Date().toISOString();
  fake.state.seq += 1;
  const row = {
    id: `transactions-srv-${fake.state.seq}`,
    user_id: fake.USER_ID,
    destination_wallet_id: null,
    category_id: null,
    debt_id: null,
    raw_input: null,
    is_deleted: false,
    created_by: fake.USER_ID,
    created_at: now,
    updated_at: now,
    ...fields,
  };
  rows('transactions').push(row);
  return row;
}

function installLedgerRpcs() {
  fake.state.rpcs.set('record_transaction', (a) => {
    const existing = rows('transactions')
      .filter((t) => t.idempotency_key === a.p_idempotency_key)
      .sort((x, y) => Number(x.is_deleted) - Number(y.is_deleted))[0];
    if (existing) return { data: { reused: true, ...rowState(existing) }, error: null };

    const amount = round2(Number(a.p_amount));
    if (!amountIsValid(a.p_type, amount)) {
      return rpcError('22023', a.p_type === 'ADJUSTMENT' ? 'An adjustment must not be zero' : 'Amount must be greater than zero');
    }

    const walletRow = rows('wallets').find((w) => w.id === a.p_wallet_id && !w.is_deleted);
    if (!walletRow) return rpcError('P0002', 'Source wallet not found or has been deleted');

    if (a.p_debt_id) {
      const debtRow = rows('debts').find((d) => d.id === a.p_debt_id && !d.is_deleted);
      if (!debtRow) return rpcError('P0002', 'Debt goal not found or has been deleted');
      if (a.p_type === 'DEBT_REPAYMENT' && amount > Number(debtRow.remaining_amount)) {
        return rpcError('P0001', 'DEBT_OVERPAYMENT', String(debtRow.remaining_amount));
      }
    }

    const effect = applyEffect(
      { wallet_id: walletRow.id, type: a.p_type, amount, debt_id: a.p_type === 'DEBT_REPAYMENT' ? a.p_debt_id : null },
      1
    );
    const tx = insertTransaction({
      wallet_id: walletRow.id,
      category_id: a.p_category_id ?? null,
      debt_id: a.p_debt_id ?? null,
      amount,
      type: a.p_type,
      description: a.p_description,
      raw_input: a.p_raw_input ?? null,
      transaction_date: a.p_transaction_date,
      idempotency_key: a.p_idempotency_key,
    });
    return { data: { reused: false, transaction: { ...tx }, ...effect }, error: null };
  });

  fake.state.rpcs.set('set_transaction_deleted', (a) => {
    const tx = rows('transactions').find((t) => t.id === a.p_transaction_id);
    if (!tx) return rpcError('P0002', 'Transaction not found');
    if (tx.is_deleted === a.p_deleted) return { data: { changed: false, ...rowState(tx) }, error: null };
    const effect = applyEffect(tx, a.p_deleted ? -1 : 1);
    tx.is_deleted = a.p_deleted;
    tx.updated_at = new Date().toISOString();
    return { data: { changed: true, transaction: { ...tx }, ...effect }, error: null };
  });

  // ADR 0033. Replay before the stale guard, the money of a repayment or an
  // adjustment fixed, the old effect reversed and the new one applied, and the
  // balance of every wallet on either side returned.
  fake.state.rpcs.set('update_transaction', (a) => {
    const tx = rows('transactions').find((t) => t.id === a.p_transaction_id);
    if (!tx) return rpcError('P0002', 'Transaction not found');
    if (tx.is_deleted) return rpcError('22023', 'Restore this transaction before editing it');

    const amount = round2(Number(a.p_amount));
    const fixedMoney = tx.type === 'DEBT_REPAYMENT' || tx.type === 'ADJUSTMENT';
    if (
      fixedMoney &&
      (a.p_type !== tx.type ||
        amount !== Number(tx.amount) ||
        a.p_wallet_id !== tx.wallet_id ||
        (a.p_destination_wallet_id ?? null) !== (tx.destination_wallet_id ?? null) ||
        (a.p_category_id ?? null) !== (tx.category_id ?? null))
    ) {
      return rpcError('22023', 'Only the note and date of a debt repayment or an adjustment can change');
    }
    const rawInput = fixedMoney ? tx.raw_input : ((a.p_raw_input as string | null)?.trim() || null);

    const walletIds = [tx.wallet_id, tx.destination_wallet_id, a.p_wallet_id, a.p_destination_wallet_id].filter(Boolean);
    const balances = () =>
      rows('wallets')
        .filter((w) => walletIds.includes(w.id))
        .map((w) => ({ id: w.id, balance: w.balance }));

    const unchanged =
      a.p_type === tx.type &&
      amount === Number(tx.amount) &&
      a.p_wallet_id === tx.wallet_id &&
      (a.p_destination_wallet_id ?? null) === (tx.destination_wallet_id ?? null) &&
      (a.p_category_id ?? null) === (tx.category_id ?? null) &&
      a.p_description === tx.description &&
      a.p_transaction_date === tx.transaction_date &&
      (rawInput ?? null) === (tx.raw_input ?? null);
    if (unchanged) return { data: { changed: false, transaction: { ...tx }, balances: balances() }, error: null };

    if (a.p_expected_updated_at && a.p_expected_updated_at !== tx.updated_at) {
      return rpcError('P0001', 'TRANSACTION_CHANGED');
    }

    const next = {
      type: a.p_type,
      amount,
      wallet_id: a.p_wallet_id,
      destination_wallet_id: a.p_destination_wallet_id ?? null,
    };
    const moneyChanged =
      next.type !== tx.type ||
      next.amount !== Number(tx.amount) ||
      next.wallet_id !== tx.wallet_id ||
      next.destination_wallet_id !== (tx.destination_wallet_id ?? null);
    if (moneyChanged) {
      applyEffect({ ...tx, debt_id: null }, -1);
      applyEffect({ ...next, debt_id: null }, 1);
    }
    Object.assign(tx, next, {
      category_id: a.p_category_id ?? null,
      description: a.p_description,
      transaction_date: a.p_transaction_date,
      raw_input: rawInput,
      updated_at: new Date(Date.parse(String(tx.updated_at)) + 1000).toISOString(),
    });
    return { data: { changed: true, transaction: { ...tx }, balances: balances() }, error: null };
  });

  fake.state.rpcs.set('import_transactions', (a) => {
    const key = a.p_import_key as string;
    const input = a.p_rows as Row[];
    const state = () => {
      const produced = rows('transactions').filter((t) => String(t.idempotency_key).startsWith(`${key}:`));
      const walletIds = new Set(produced.flatMap((t) => [t.wallet_id, t.destination_wallet_id]).filter(Boolean));
      return {
        inserted_ids: produced.map((t) => t.id),
        balances: rows('wallets').filter((w) => walletIds.has(w.id)).map((w) => ({ id: w.id, balance: w.balance })),
      };
    };
    if (rows('transactions').some((t) => t.idempotency_key === `${key}:${input[0].row_index}`)) {
      return { data: { reused: true, ...state() }, error: null };
    }
    for (const r of input) {
      if (!amountIsValid(r.type, round2(Number(r.amount)))) {
        return rpcError('22023', `Row ${r.row_index}: amount must be greater than zero`);
      }
      if (r.debt_id && r.type !== 'DEBT_REPAYMENT') {
        return rpcError('22023', `Row ${r.row_index}: only a debt repayment can name a debt`);
      }
      const ids = [r.wallet_id, r.destination_wallet_id].filter(Boolean);
      if (!ids.every((id) => rows('wallets').some((w) => w.id === id && !w.is_deleted))) {
        return rpcError('P0002', `Row ${r.row_index}: wallet not found or has been deleted`);
      }
      if (r.debt_id && !rows('debts').some((d) => d.id === r.debt_id && !d.is_deleted)) {
        return rpcError('P0002', `Row ${r.row_index}: debt not found or has been deleted`);
      }
    }
    // ADR 0016's guard, in aggregate across the batch.
    const perDebt = new Map<unknown, number>();
    for (const r of input) {
      if (r.debt_id) perDebt.set(r.debt_id, round2((perDebt.get(r.debt_id) ?? 0) + round2(Number(r.amount))));
    }
    for (const [debtId, total] of perDebt) {
      const debtRow = rows('debts').find((d) => d.id === debtId)!;
      if (total > Number(debtRow.remaining_amount)) {
        return rpcError('P0001', 'DEBT_OVERPAYMENT', String(debtRow.remaining_amount), String(debtRow.name));
      }
    }
    for (const r of input) {
      const amount = round2(Number(r.amount));
      insertTransaction({
        wallet_id: r.wallet_id,
        destination_wallet_id: r.destination_wallet_id ?? null,
        category_id: r.category_id ?? null,
        debt_id: r.debt_id ?? null,
        amount,
        type: r.type,
        description: r.description,
        transaction_date: r.transaction_date,
        idempotency_key: `${key}:${r.row_index}`,
      });
      applyEffect({ ...r, amount, debt_id: r.debt_id ?? null }, 1);
    }
    return { data: { reused: false, ...state() }, error: null };
  });

  fake.state.rpcs.set('create_wallet', (a) => {
    const key = a.p_idempotency_key as string;
    const opening = round2(Number(a.p_opening_balance ?? 0));
    const existing = rows('wallets').find((w) => w.idempotency_key === key);
    const openingRow = () => rows('transactions').find((t) => t.idempotency_key === `opening:${key}`) ?? null;
    if (existing) return { data: { reused: true, wallet: { ...existing }, transaction: openingRow() }, error: null };
    if (opening !== 0 && !a.p_opening_date) return rpcError('22023', 'An opening balance needs a date');

    const now = new Date().toISOString();
    fake.state.seq += 1;
    const walletRow: Row = {
      id: `wallets-srv-${fake.state.seq}`,
      user_id: fake.USER_ID,
      name: a.p_name,
      type: a.p_type,
      currency: a.p_currency,
      balance: 0,
      color: a.p_color,
      icon: a.p_icon,
      is_archived: false,
      is_deleted: false,
      idempotency_key: key,
      created_at: now,
      updated_at: now,
    };
    rows('wallets').push(walletRow);
    let tx: Row | null = null;
    if (opening !== 0) {
      tx = insertTransaction({
        wallet_id: walletRow.id,
        amount: opening,
        type: 'ADJUSTMENT',
        description: 'Opening balance',
        transaction_date: a.p_opening_date,
        idempotency_key: `opening:${key}`,
      });
      applyEffect(tx, 1);
    }
    return { data: { reused: false, wallet: { ...walletRow }, transaction: tx && { ...tx } }, error: null };
  });

  fake.state.rpcs.set('list_my_sessions', () => ({ data: SESSIONS.map((s) => ({ ...s })), error: null }));
}

beforeEach(async () => {
  latest = null;
  localStorage.clear();
  seed();
  fake.state.calls = [];
  fake.state.failures.clear();
  fake.state.gates.clear();
  fake.state.rpcs.clear();
  fake.state.lostResponses.clear();
  fake.state.signOuts = [];
  fake.state.authCallback = null;
  fake.state.channelStatus = null;
  fake.state.getUserCalls = 0;
  fake.state.userError = null;
  fake.state.unauthorized.clear();
  await mountSignedIn();
});

/** Mounts the provider and waits until the seeded account has fully loaded. */
async function mountSignedIn() {
  render(
    <FinanceProvider>
      <Probe />
    </FinanceProvider>
  );

  // Signed in, the seeded cloud rows have replaced the local fixture, AND the
  // load has finished. Wallets and debts are set part-way through
  // `loadSupabaseData`; the transactions and diary reads are still in flight
  // at that point, so without `isSyncing` this raced (1 run in ~12) and a late
  // read could also land after `calls` is reset below.
  await waitFor(() => {
    expect(state().isAuthenticated).toBe(true);
    expect(wallet()?.balance).toBe(WALLET_OPENING);
    expect(debt()?.remainingAmount).toBe(DEBT_REMAINING);
    expect(state().isSyncing).toBe(false);
  });
  fake.state.calls = [];
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the harness', () => {
  it('signs in and loads the cloud rows, with no transactions yet', () => {
    expect(state().isAuthenticated).toBe(true);
    expect(state().transactions).toHaveLength(0);
    expect(state().isSyncing).toBe(false);
  });
});

describe('a signed-in debt repayment (F1)', () => {
  /*
   * The optimistic `setDebts` runs before the insert's `await`. By the time
   * the remote debt write is built, the ref-mirror effect has moved
   * `debtsRef.current` to the optimistic value — so re-reading it there and
   * subtracting the payment again takes it off twice. Local state shows the
   * right number and the realtime echo is suppressed, so it surfaces only on
   * the next reload.
   */

  it('sends Supabase the remainder the user sees, not a second subtraction', async () => {
    const result = await repay(1000);
    expect(result.success).toBe(true);

    const debtWrites = writes('debts', 'update');
    expect(debtWrites).toHaveLength(1);
    expect(debtWrites[0].payload).toMatchObject({ remaining_amount: 3500, is_settled: false });

    // Local and remote agree — the whole point.
    expect(debt()?.remainingAmount).toBe(3500);
    expect(fake.state.tables.debts[0].remaining_amount).toBe(3500);

    // The wallet side was already right; pin it so a fix cannot regress it.
    expect(writes('wallets', 'update')[0].payload).toEqual({ balance: WALLET_OPENING - 1000 });
  });

  it('settles the debt remotely when the payment clears it exactly', async () => {
    const result = await repay(DEBT_REMAINING);
    expect(result.success).toBe(true);

    expect(writes('debts', 'update')[0].payload).toMatchObject({ remaining_amount: 0, is_settled: true });
    expect(debt()?.isSettled).toBe(true);
  });
});

function importRow(overrides: Partial<ImportRowValidation> = {}): ImportRowValidation {
  return {
    rowIndex: 1,
    date: TODAY,
    walletName: 'Savings',
    amount: 100,
    type: 'EXPENSE',
    description: 'Imported row',
    isValid: true,
    ...overrides,
  };
}

describe('a signed-in CSV import (F2)', () => {
  /*
   * The batch insert's `error` used to be discarded: the wallet deltas were
   * written anyway and `insertedCount` reported every row. A rejected import
   * still moved money, with no ledger rows to explain it.
   */

  it('moves no money when the batch insert is rejected', async () => {
    fake.state.failures.set('transactions:insert', { message: 'insert rejected by RLS' });

    const result = await actions().commitBulkImport([importRow({ amount: 300 })]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('insert rejected by RLS');
    expect(result.insertedCount).toBe(0);
    // Not one balance write was attempted.
    expect(writes('wallets', 'update')).toHaveLength(0);
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING);
    expect(wallet()?.balance).toBe(WALLET_OPENING);
  });

  it('undoes a half-applied import when a balance write fails after the insert', async () => {
    // A transfer touches two wallets. Savings is written first and lands;
    // Cash is rejected. Savings must be put back and the rows soft-deleted.
    fake.state.failures.set('wallets:update', { message: 'wallet write rejected', onlyId: CASH });

    const result = await actions().commitBulkImport([
      importRow({ type: 'TRANSFER', amount: 250, destinationWalletName: 'Cash' }),
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('wallet write rejected');
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING);
    expect(serverWallet(CASH).balance).toBe(CASH_OPENING);

    // Soft-deleted, never hard-deleted: the row is still there.
    const rows = fake.state.tables.transactions;
    expect(rows).toHaveLength(1);
    expect(rows[0].is_deleted).toBe(true);
    expect(writes('transactions', 'delete')).toHaveLength(0);

    // Local state is reloaded from the (restored) server.
    await waitFor(() => expect(wallet()?.balance).toBe(WALLET_OPENING));
  });

  it('reports the rows it actually inserted and applies each delta once', async () => {
    const result = await actions().commitBulkImport([
      importRow({ rowIndex: 1, amount: 35.5 }),
      importRow({ rowIndex: 2, amount: 64.5 }),
      importRow({ rowIndex: 3, type: 'INCOME', amount: 1000 }),
    ]);

    expect(result).toMatchObject({ success: true, insertedCount: 3, totalAmount: 1100, skippedCount: 0 });
    const walletWrites = writes('wallets', 'update');
    expect(walletWrites).toHaveLength(1);
    expect(walletWrites[0].payload).toEqual({ balance: WALLET_OPENING - 35.5 - 64.5 + 1000 });
    await waitFor(() => expect(state().transactions).toHaveLength(3));
  });
});

describe('a cloud reload that fails (F6)', () => {
  /*
   * `cloudRevisionRef` is how an in-flight write learns that a reload landed
   * underneath it (T69): if the revision moved, the write's rollback snapshot
   * is stale, so it re-fetches instead of restoring. `loadSupabaseData` used
   * to bump the revision even when its reads failed - so a reload that
   * fetched nothing still disarmed the rollback, the re-fetch failed the same
   * way, and the optimistic debit stayed on screen for money that never moved.
   */

  it('still rolls an in-flight write back when the reload under it read nothing', async () => {
    let releaseInsert!: () => void;
    fake.state.gates.set('transactions:insert', new Promise<void>((resolve) => (releaseInsert = resolve)));

    const pending = actions().addTransaction({
      amount: 200,
      type: 'EXPENSE',
      walletId: WALLET,
      description: 'Groceries',
      transactionDate: TODAY,
    });
    await waitFor(() => expect(wallet()?.balance).toBe(WALLET_OPENING - 200)); // optimistic

    // A reload lands mid-flight and cannot read wallets (offline, say).
    fake.state.failures.set('wallets:select', { message: 'network down' });
    await fake.state.authCallback!('SIGNED_IN', fake.session);

    // Then the insert itself fails.
    fake.state.failures.set('transactions:insert', { message: 'network down' });
    releaseInsert();
    const result = await pending;

    expect(result.success).toBe(false);
    // Nothing reached the server, so nothing may stay debited locally.
    await waitFor(() => expect(wallet()?.balance).toBe(WALLET_OPENING));
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING);
  });

  it('does not treat a clean reload as a failure', async () => {
    // The other side of the boundary: a reload that read everything still
    // counts, so a write under it re-fetches rather than restoring a stale
    // snapshot (T69's original purpose).
    let releaseInsert!: () => void;
    fake.state.gates.set('transactions:insert', new Promise<void>((resolve) => (releaseInsert = resolve)));

    const pending = actions().addTransaction({
      amount: 200,
      type: 'EXPENSE',
      walletId: WALLET,
      description: 'Groceries',
      transactionDate: TODAY,
    });
    await waitFor(() => expect(wallet()?.balance).toBe(WALLET_OPENING - 200));

    // Another device moved this wallet; the reload picks that up.
    fake.state.tables.wallets[0].balance = 7777;
    await fake.state.authCallback!('SIGNED_IN', fake.session);

    fake.state.failures.set('transactions:insert', { message: 'rejected' });
    releaseInsert();
    expect((await pending).success).toBe(false);

    // Re-fetched server truth, not the pre-write snapshot of 5,000.
    await waitFor(() => expect(wallet()?.balance).toBe(7777));
  });
});

describe('a failed cloud load is never silent (Phase 53b, T193)', () => {
  /*
   * `loadSupabaseData` used to log a failed read to the console and nothing
   * else, so the navbar kept saying "Synced" over data it could not refresh.
   * `syncError` is what the badge's "Sync failed" state reads.
   */

  it('reports the tables it could not read, and still applies the ones it did', async () => {
    fake.state.tables.wallets[0].balance = 7777;
    fake.state.failures.set('debts:select', { message: 'network down' });
    await actions().refreshFromCloud();

    await waitFor(() => expect(state().syncError).toContain('debts'));
    expect(wallet()?.balance).toBe(7777);
    expect(state().isSyncing).toBe(false);
  });

  it('reports a load that threw', async () => {
    const boom = Promise.reject(new Error('socket closed'));
    boom.catch(() => {});
    fake.state.gates.set('wallets:select', boom);
    await actions().refreshFromCloud();

    // A string, not merely "not null": `undefined` would pass that too.
    await waitFor(() => expect(state().syncError).toEqual(expect.any(String)));
  });

  it('clears once a retry reads everything', async () => {
    fake.state.failures.set('transactions:select', { message: 'network down' });
    await actions().refreshFromCloud();
    await waitFor(() => expect(state().syncError).toContain('transactions'));

    fake.state.failures.clear();
    await actions().refreshFromCloud();
    await waitFor(() => expect(state().syncError).toBeNull());
  });

  it('starts clear after a clean sign-in', () => {
    expect(state().syncError).toBeNull();
  });

  it('clears on sign-out, so a guest never sees the account\'s failure', async () => {
    fake.state.failures.set('debts:select', { message: 'network down' });
    await actions().refreshFromCloud();
    await waitFor(() => expect(state().syncError).toContain('debts'));

    await fake.state.authCallback!('SIGNED_OUT', null);
    await waitFor(() => {
      expect(state().isAuthenticated).toBe(false);
      expect(state().syncError).toBeNull();
    });
  });
});

describe('a signed-in write through record_transaction (ADR 0023: F3, F4)', () => {
  /*
   * With the migration applied, a non-transfer write is one RPC that locks the
   * wallet (and debt), applies a RELATIVE update and replays on the key. The
   * client keeps its guards and its optimistic update, then adopts the numbers
   * the server committed.
   */
  beforeEach(() => installLedgerRpcs());

  it('sends one RPC with the amount and key, and writes no table directly', async () => {
    const result = await expense(200, 'key-expense-1');
    expect(result.success).toBe(true);

    const calls = writes('rpc:record_transaction', 'rpc');
    expect(calls).toHaveLength(1);
    expect(calls[0].payload).toMatchObject({
      p_wallet_id: WALLET,
      p_amount: 200,
      p_type: 'EXPENSE',
      p_idempotency_key: 'key-expense-1',
      p_transaction_date: TODAY,
    });
    // No absolute balance, no separate insert: nothing for a second device to clobber.
    expect(writes('transactions', 'insert')).toHaveLength(0);
    expect(writes('wallets', 'update')).toHaveLength(0);
    expect(writes('debts', 'update')).toHaveLength(0);

    expect(result.txId).toBe(fake.state.tables.transactions[0].id);
    await waitFor(() => expect(state().transactions.map((t) => t.id)).toEqual([result.txId]));
  });

  it('F3: applies the delta to the balance the server holds, not the client copy', async () => {
    // Another device spent ฿2,777 less than nothing - it moved the wallet to
    // 7,777 - and no realtime reload has reached this one yet.
    fake.state.tables.wallets[0].balance = 7777;

    const result = await expense(200);
    expect(result.success).toBe(true);

    // The legacy path wrote its own absolute 5,000 - 200 = 4,800 over it.
    expect(serverWallet(WALLET).balance).toBe(7577);
    await waitFor(() => expect(wallet()?.balance).toBe(7577));
  });

  it('repays a debt partially in one RPC and adopts the remainder the server committed', async () => {
    const result = await repay(1000);
    expect(result.success).toBe(true);

    expect(writes('rpc:record_transaction', 'rpc')[0].payload).toMatchObject({
      p_type: 'DEBT_REPAYMENT',
      p_debt_id: DEBT,
      p_amount: 1000,
    });
    expect(writes('debts', 'update')).toHaveLength(0);
    expect(fake.state.tables.debts[0].remaining_amount).toBe(3500);
    await waitFor(() => {
      expect(debt()?.remainingAmount).toBe(3500);
      expect(debt()?.isSettled).toBe(false);
      expect(wallet()?.balance).toBe(WALLET_OPENING - 1000);
    });
  });

  it('rejects an overpayment the server sees and the stale client does not (ADR 0016)', async () => {
    // Another device paid ฿4,000; this client still believes ฿4,500 is owed,
    // so its own guard lets a ฿1,000 payment through.
    fake.state.tables.debts[0].remaining_amount = 500;

    const result = await repay(1000);

    expect(result.success).toBe(false);
    expect(result.error).toBe(`Payment exceeds the ${formatCurrencyAmount(500)} remaining on Student Loan`);
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING);
    // Rolled back, then re-read: the debt the server holds is now on screen.
    await waitFor(() => {
      expect(debt()?.remainingAmount).toBe(500);
      expect(wallet()?.balance).toBe(WALLET_OPENING);
    });
  });

  it('F4: a retry after a lost response replays instead of writing twice', async () => {
    fake.state.lostResponses.add('record_transaction');

    const first = await expense(200, 'key-lost-response');
    expect(first.success).toBe(false);
    // The request landed; only the answer was lost.
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING - 200);

    const retry = await expense(200, 'key-lost-response');
    expect(retry.success).toBe(true);

    expect(fake.state.tables.transactions).toHaveLength(1);
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING - 200);
    await waitFor(() => {
      expect(wallet()?.balance).toBe(WALLET_OPENING - 200);
      expect(state().transactions).toHaveLength(1);
    });
  });

  it('re-reads after an unknown outcome instead of showing a rollback the server never made', async () => {
    fake.state.lostResponses.add('record_transaction');

    const result = await expense(200);
    expect(result.success).toBe(false);

    // The write committed. A bare rollback would show 5,000 until some later
    // event; the client re-reads and shows what the server holds.
    await waitFor(() => {
      expect(wallet()?.balance).toBe(WALLET_OPENING - 200);
      expect(state().transactions).toHaveLength(1);
    });
  });

  it('rolls back, and writes nothing through the legacy path, when the RPC rejects', async () => {
    fake.state.failures.set('rpc:record_transaction', { message: 'permission denied for function', code: '42501' });

    const result = await expense(200);

    expect(result.success).toBe(false);
    expect(result.error).toContain('permission denied');
    expect(writes('transactions', 'insert')).toHaveLength(0);
    expect(writes('wallets', 'update')).toHaveLength(0);
    await waitFor(() => expect(wallet()?.balance).toBe(WALLET_OPENING));
  });
});

describe('a project without the Phase 51 migration', () => {
  it('asks for record_transaction, then falls back to the legacy writes', async () => {
    // No handler installed: the RPC answers PGRST202, as an unmigrated project does.
    const result = await expense(200);
    expect(result.success).toBe(true);

    expect(writes('rpc:record_transaction', 'rpc')).toHaveLength(1);
    expect(writes('transactions', 'insert')).toHaveLength(1);
    expect(writes('wallets', 'update')[0].payload).toEqual({ balance: WALLET_OPENING - 200 });
  });
});

/**
 * Resolves once a write's row is on screen AND the ref-mirror effects have run
 * - the point a user's next tap happens at. Without it, a delete fired in the
 * same tick as the add that created its row finds nothing in `transactionsRef`.
 */
async function landed(txId: string | undefined) {
  await waitFor(() => expect(state().transactions.some((t) => t.id === txId)).toBe(true));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('a signed-in delete and restore through set_transaction_deleted (ADR 0023)', () => {
  beforeEach(() => installLedgerRpcs());

  it('reverses a repayment on wallet and debt in one RPC, and reapplies it on restore', async () => {
    const paid = await repay(1000);
    expect(paid.success).toBe(true);
    await landed(paid.txId);
    fake.state.calls = [];

    const removed = await actions().softDeleteTransaction(paid.txId!);
    expect(removed.success).toBe(true);
    const calls = writes('rpc:set_transaction_deleted', 'rpc');
    expect(calls).toHaveLength(1);
    expect(calls[0].payload).toEqual({ p_transaction_id: paid.txId, p_deleted: true });
    expect(writes('wallets', 'update')).toHaveLength(0);
    expect(writes('debts', 'update')).toHaveLength(0);
    expect(writes('transactions', 'update')).toHaveLength(0);

    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING);
    expect(fake.state.tables.debts[0].remaining_amount).toBe(DEBT_REMAINING);
    await waitFor(() => {
      expect(wallet()?.balance).toBe(WALLET_OPENING);
      expect(debt()?.remainingAmount).toBe(DEBT_REMAINING);
      expect(state().transactions.find((t) => t.id === paid.txId)?.isDeleted).toBe(true);
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const restored = await actions().restoreTransaction(paid.txId!);
    expect(restored.success).toBe(true);
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING - 1000);
    await waitFor(() => {
      expect(wallet()?.balance).toBe(WALLET_OPENING - 1000);
      expect(debt()?.remainingAmount).toBe(DEBT_REMAINING - 1000);
      expect(state().transactions.find((t) => t.id === paid.txId)?.isDeleted).toBe(false);
    });
  });

  it('F3: reverses relative to the balance the server holds', async () => {
    const spent = await expense(200);
    expect(spent.success).toBe(true);
    await landed(spent.txId);
    // Another device moved the wallet after this one's expense landed.
    fake.state.tables.wallets[0].balance = 9000;

    const removed = await actions().softDeleteTransaction(spent.txId!);
    expect(removed.success).toBe(true);

    // The legacy path wrote its own absolute 4,800 + 200 = 5,000 over 9,000.
    expect(serverWallet(WALLET).balance).toBe(9200);
    await waitFor(() => expect(wallet()?.balance).toBe(9200));
  });

  it('rolls back, and writes nothing through the legacy path, when the RPC rejects', async () => {
    const spent = await expense(200);
    await landed(spent.txId);
    fake.state.failures.set('rpc:set_transaction_deleted', { message: 'permission denied for function', code: '42501' });
    fake.state.calls = [];

    const removed = await actions().softDeleteTransaction(spent.txId!);

    expect(removed.success).toBe(false);
    // Asked, and was refused - not a failure to find the row.
    expect(writes('rpc:set_transaction_deleted', 'rpc')).toHaveLength(1);
    expect(writes('wallets', 'update')).toHaveLength(0);
    expect(writes('transactions', 'update')).toHaveLength(0);
    await waitFor(() => {
      expect(wallet()?.balance).toBe(WALLET_OPENING - 200);
      expect(state().transactions.find((t) => t.id === spent.txId)?.isDeleted).toBe(false);
    });
  });

  it('re-reads after an unknown outcome', async () => {
    const spent = await expense(200);
    await landed(spent.txId);
    fake.state.lostResponses.add('set_transaction_deleted');

    const removed = await actions().softDeleteTransaction(spent.txId!);
    expect(removed.success).toBe(false);

    // It committed; the client shows that rather than its rollback.
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING);
    await waitFor(() => {
      expect(wallet()?.balance).toBe(WALLET_OPENING);
      expect(state().transactions.find((t) => t.id === spent.txId)?.isDeleted).toBe(true);
    });
  });
});

describe('a signed-in edit through update_transaction (ADR 0033)', () => {
  beforeEach(() => installLedgerRpcs());

  /** The row as the client holds it, and the edit that keeps everything but `changes`. */
  function editOf(txId: string, changes: Partial<TransactionEdit>): TransactionEdit {
    const tx = state().transactions.find((t) => t.id === txId)!;
    return {
      type: tx.type,
      amount: tx.amount,
      rawInput: tx.rawInput,
      walletId: tx.walletId,
      destinationWalletId: tx.destinationWalletId,
      categoryId: tx.categoryId,
      description: tx.description,
      transactionDate: tx.transactionDate,
      ...changes,
    };
  }

  const reads = () => writes('transactions', 'select').length;

  it('moves only the difference on an amount edit, in one RPC naming the version it edited', async () => {
    const spent = await expense(200);
    await landed(spent.txId);
    const editedVersion = state().transactions.find((t) => t.id === spent.txId)!.updatedAt;
    fake.state.calls = [];

    const result = await actions().updateTransaction(spent.txId!, editOf(spent.txId!, { amount: 250, rawInput: '200+50' }));

    expect(result).toEqual({ success: true });
    const calls = writes('rpc:update_transaction', 'rpc');
    expect(calls).toHaveLength(1);
    expect(calls[0].payload).toMatchObject({
      p_transaction_id: spent.txId,
      p_expected_updated_at: editedVersion,
      p_type: 'EXPENSE',
      p_amount: 250,
      p_wallet_id: WALLET,
      p_destination_wallet_id: null,
      p_raw_input: '200+50',
    });
    expect(writes('wallets', 'update')).toHaveLength(0);
    expect(writes('transactions', 'update')).toHaveLength(0);
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING - 250);
    await waitFor(() => {
      expect(wallet()?.balance).toBe(WALLET_OPENING - 250);
      expect(state().transactions.find((t) => t.id === spent.txId)?.amount).toBe(250);
    });
  });

  it('adopts the balances the server committed, not its own guess', async () => {
    const spent = await expense(200);
    await landed(spent.txId);
    // Another device moved the wallet after this one's expense landed.
    fake.state.tables.wallets[0].balance = 9000;

    const result = await actions().updateTransaction(spent.txId!, editOf(spent.txId!, { amount: 250 }));

    expect(result.success).toBe(true);
    // Reversed and reapplied relative to the 9,000 the server holds.
    expect(serverWallet(WALLET).balance).toBe(8950);
    await waitFor(() => expect(wallet()?.balance).toBe(8950));
  });

  it('gives the old wallet its money back and charges the new one', async () => {
    const spent = await expense(200);
    await landed(spent.txId);

    const result = await actions().updateTransaction(spent.txId!, editOf(spent.txId!, { walletId: CASH }));

    expect(result.success).toBe(true);
    await waitFor(() => {
      expect(wallet(WALLET)?.balance).toBe(WALLET_OPENING);
      expect(wallet(CASH)?.balance).toBe(CASH_OPENING - 200);
    });
  });

  it('turns an expense into a transfer: the expense is undone and the transfer moves the money', async () => {
    const spent = await expense(200);
    await landed(spent.txId);

    const result = await actions().updateTransaction(
      spent.txId!,
      editOf(spent.txId!, { type: 'TRANSFER', destinationWalletId: CASH, categoryId: undefined })
    );

    expect(result.success).toBe(true);
    expect(writes('rpc:update_transaction', 'rpc').at(-1)?.payload).toMatchObject({
      p_type: 'TRANSFER',
      p_destination_wallet_id: CASH,
      p_category_id: null,
    });
    await waitFor(() => {
      expect(wallet(WALLET)?.balance).toBe(WALLET_OPENING - 200);
      expect(wallet(CASH)?.balance).toBe(CASH_OPENING + 200);
    });
  });

  it("edits a repayment's note and date without moving its wallet or its debt", async () => {
    const paid = await repay(1000);
    await landed(paid.txId);

    const result = await actions().updateTransaction(
      paid.txId!,
      editOf(paid.txId!, { description: 'September payment', transactionDate: '2026-09-25' })
    );

    expect(result.success).toBe(true);
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING - 1000);
    expect(fake.state.tables.debts[0].remaining_amount).toBe(DEBT_REMAINING - 1000);
    await waitFor(() => {
      const row = state().transactions.find((t) => t.id === paid.txId);
      expect(row?.description).toBe('September payment');
      expect(row?.transactionDate).toBe('2026-09-25');
      expect(wallet()?.balance).toBe(WALLET_OPENING - 1000);
      expect(debt()?.remainingAmount).toBe(DEBT_REMAINING - 1000);
    });
  });

  it("refuses a repayment's amount before asking the server", async () => {
    const paid = await repay(1000);
    await landed(paid.txId);
    fake.state.calls = [];

    const result = await actions().updateTransaction(paid.txId!, editOf(paid.txId!, { amount: 1200 }));

    expect(result).toEqual({
      success: false,
      error: 'Only the note and date of a debt repayment or an adjustment can change',
    });
    expect(writes('rpc:update_transaction', 'rpc')).toHaveLength(0);
  });

  it('sends nothing for an edit that changes nothing', async () => {
    const spent = await expense(200);
    await landed(spent.txId);
    fake.state.calls = [];

    const result = await actions().updateTransaction(spent.txId!, editOf(spent.txId!, {}));

    expect(result).toEqual({ success: true });
    expect(writes('rpc:update_transaction', 'rpc')).toHaveLength(0);
  });

  it('has no fallback when the function is missing: it rolls back and says why', async () => {
    const spent = await expense(200);
    await landed(spent.txId);
    // An unmigrated project: the RPC answers PGRST202.
    fake.state.rpcs.delete('update_transaction');
    fake.state.calls = [];

    const result = await actions().updateTransaction(spent.txId!, editOf(spent.txId!, { amount: 250 }));

    expect(result.success).toBe(false);
    expect(result.error).toContain('latest database update');
    expect(writes('wallets', 'update')).toHaveLength(0);
    expect(writes('transactions', 'update')).toHaveLength(0);
    await waitFor(() => {
      expect(wallet()?.balance).toBe(WALLET_OPENING - 200);
      expect(state().transactions.find((t) => t.id === spent.txId)?.amount).toBe(200);
    });
  });

  it('rolls back and re-reads when another device changed the row first', async () => {
    const spent = await expense(200);
    await landed(spent.txId);
    // Another device edited the row; this client still holds the old version.
    const serverRow = fake.state.tables.transactions.find((t) => t.id === spent.txId)!;
    serverRow.description = 'Groceries and milk';
    serverRow.updated_at = '2026-09-26T12:00:00.000Z';
    const readsBefore = reads();

    const result = await actions().updateTransaction(spent.txId!, editOf(spent.txId!, { amount: 250 }));

    expect(result).toEqual({
      success: false,
      error: 'This transaction changed on another device. Check it and try again.',
    });
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING - 200);
    expect(reads()).toBeGreaterThan(readsBefore);
    await waitFor(() => {
      expect(wallet()?.balance).toBe(WALLET_OPENING - 200);
      expect(state().transactions.find((t) => t.id === spent.txId)?.description).toBe('Groceries and milk');
    });
  });

  it('re-reads after an unknown outcome, and shows what committed', async () => {
    const spent = await expense(200);
    await landed(spent.txId);
    fake.state.lostResponses.add('update_transaction');
    const readsBefore = reads();

    const result = await actions().updateTransaction(spent.txId!, editOf(spent.txId!, { amount: 250 }));
    expect(result.success).toBe(false);
    // The re-read is part of the call, not a later reload that happens to come.
    expect(reads()).toBeGreaterThan(readsBefore);

    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING - 250);
    await waitFor(() => {
      expect(wallet()?.balance).toBe(WALLET_OPENING - 250);
      expect(state().transactions.find((t) => t.id === spent.txId)?.amount).toBe(250);
    });
  });
});

describe('a signed-in CSV import through import_transactions (ADR 0023)', () => {
  beforeEach(() => installLedgerRpcs());

  it('sends one RPC with every resolved row and the import key, and writes no table directly', async () => {
    const result = await actions().commitBulkImport(
      [
        importRow({ rowIndex: 1, amount: 35.5 }),
        importRow({ rowIndex: 2, amount: 64.5 }),
        importRow({ rowIndex: 3, type: 'INCOME', amount: 1000 }),
        importRow({ rowIndex: 4, type: 'TRANSFER', amount: 250, destinationWalletName: 'Cash' }),
      ],
      'import-key-1'
    );

    expect(result).toMatchObject({ success: true, insertedCount: 4, totalAmount: 1350, skippedCount: 0 });
    const calls = writes('rpc:import_transactions', 'rpc');
    expect(calls).toHaveLength(1);
    const payload = calls[0].payload as { p_import_key: string; p_rows: Record<string, unknown>[] };
    expect(payload.p_import_key).toBe('import-key-1');
    expect(payload.p_rows).toHaveLength(4);
    expect(payload.p_rows[3]).toMatchObject({
      row_index: 4,
      wallet_id: WALLET,
      destination_wallet_id: CASH,
      amount: 250,
      type: 'TRANSFER',
      transaction_date: TODAY,
    });
    expect(writes('transactions', 'insert')).toHaveLength(0);
    expect(writes('wallets', 'update')).toHaveLength(0);

    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING - 35.5 - 64.5 + 1000 - 250);
    expect(serverWallet(CASH).balance).toBe(CASH_OPENING + 250);
    await waitFor(() => {
      expect(wallet()?.balance).toBe(WALLET_OPENING - 35.5 - 64.5 + 1000 - 250);
      expect(state().transactions).toHaveLength(4);
    });
  });

  it('F3: applies the import to the balance the server holds', async () => {
    fake.state.tables.wallets[0].balance = 7777;

    const result = await actions().commitBulkImport([importRow({ amount: 100 })], 'import-key-f3');
    expect(result.success).toBe(true);

    // The legacy path wrote walletsRef + delta = 4,900 over it.
    expect(serverWallet(WALLET).balance).toBe(7677);
  });

  it('moves nothing when the RPC rejects the batch', async () => {
    fake.state.failures.set('rpc:import_transactions', {
      message: 'Row 2: wallet not found or has been deleted',
      code: 'P0002',
    });

    const result = await actions().commitBulkImport([importRow({ rowIndex: 1 }), importRow({ rowIndex: 2 })], 'k');

    expect(result).toMatchObject({ success: false, insertedCount: 0, totalAmount: 0 });
    expect(result.error).toContain('Row 2');
    expect(writes('rpc:import_transactions', 'rpc')).toHaveLength(1);
    expect(writes('transactions', 'insert')).toHaveLength(0);
    expect(writes('wallets', 'update')).toHaveLength(0);
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING);
  });

  it('F4: a retry of the same preview replays instead of importing twice', async () => {
    fake.state.lostResponses.add('import_transactions');

    const first = await actions().commitBulkImport([importRow({ amount: 100 })], 'import-key-lost');
    expect(first.success).toBe(false);
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING - 100); // it landed

    const retry = await actions().commitBulkImport([importRow({ amount: 100 })], 'import-key-lost');
    expect(retry).toMatchObject({ success: true, insertedCount: 1 });
    expect(fake.state.tables.transactions).toHaveLength(1);
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING - 100);
    await waitFor(() => expect(wallet()?.balance).toBe(WALLET_OPENING - 100));
  });

  it('is not deduplication: a new preview with a new key imports the same rows again (ADR 0019)', async () => {
    await actions().commitBulkImport([importRow({ amount: 100 })], 'preview-a');
    await actions().commitBulkImport([importRow({ amount: 100 })], 'preview-b');

    expect(fake.state.tables.transactions).toHaveLength(2);
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING - 200);
  });
});

describe('reconnection reconciliation (ADR 0023)', () => {
  /*
   * Relative server writes make the server right; a client that slept, went
   * offline or lost its realtime socket still shows what it last read. These
   * triggers make it go and look. Each one reloads through the same debounced
   * path the realtime handler uses.
   *
   * The negative checks need a bounded wait: "no reload happened" can only be
   * observed after the 400 ms debounce window has passed. `quietPeriod` is
   * that window plus margin, and is used only to prove an absence.
   */
  const quietPeriod = () => new Promise<void>((resolve) => setTimeout(resolve, 600));
  const walletReads = () => writes('wallets', 'select');
  const reloadWith = (balance: number) =>
    waitFor(() => expect(wallet()?.balance).toBe(balance), { timeout: 3000 });

  let restoreVisibility: (() => void) | null = null;
  function setVisibility(value: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
    restoreVisibility = () => {
      delete (document as unknown as Record<string, unknown>).visibilityState;
    };
  }
  afterEach(() => {
    restoreVisibility?.();
    restoreVisibility = null;
    vi.restoreAllMocks();
  });

  it('reloads when the browser comes back online', async () => {
    fake.state.tables.wallets[0].balance = 7777; // written while this device was offline
    window.dispatchEvent(new Event('online'));
    await reloadWith(7777);
  });

  it('reloads on becoming visible once the last clean load is stale', async () => {
    fake.state.tables.wallets[0].balance = 7777;
    const realNow = Date.now.bind(Date);
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 31_000);

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await reloadWith(7777);
  });

  it('does not reload on becoming visible right after a load', async () => {
    fake.state.tables.wallets[0].balance = 7777;
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    await quietPeriod();
    expect(walletReads()).toHaveLength(0);
    expect(wallet()?.balance).toBe(WALLET_OPENING);
  });

  it('reloads when the realtime channel resubscribes after dropping', async () => {
    // Postgres changes emitted while the socket was down are not replayed.
    fake.state.tables.wallets[0].balance = 7777;
    fake.state.channelStatus!('CHANNEL_ERROR');
    fake.state.channelStatus!('SUBSCRIBED');
    await reloadWith(7777);
  });

  it('does not reload on the first subscription, only on a re-subscription', async () => {
    fake.state.channelStatus!('SUBSCRIBED');
    await quietPeriod();
    expect(walletReads()).toHaveLength(0);
  });

  it('does nothing once signed out', async () => {
    await actions().signOut();
    await waitFor(() => expect(state().isAuthenticated).toBe(false));
    fake.state.calls = [];

    window.dispatchEvent(new Event('online'));
    await quietPeriod();
    expect(walletReads()).toHaveLength(0);
  });
});

describe('a signed ADJUSTMENT, signed in (ADR 0024)', () => {
  beforeEach(() => installLedgerRpcs());

  it('sends the negative amount to record_transaction, and the balance goes down', async () => {
    const result = await actions().addTransaction({
      amount: -1000,
      type: 'ADJUSTMENT',
      walletId: WALLET,
      description: 'Manual balance adjustment (-฿1,000.00)',
      transactionDate: TODAY,
    });
    expect(result.success).toBe(true);
    expect(writes('rpc:record_transaction', 'rpc')[0].payload).toMatchObject({ p_type: 'ADJUSTMENT', p_amount: -1000 });
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING - 1000);
    await waitFor(() => expect(wallet()?.balance).toBe(WALLET_OPENING - 1000));
  });
});

describe('a signed-in wallet through create_wallet (F7, ADR 0024)', () => {
  beforeEach(() => installLedgerRpcs());

  const create = (opening: number, idempotencyKey?: string) =>
    actions().addWallet(
      { name: 'Visa', type: 'CREDIT_CARD', currency: 'THB', color: '#e11d48', icon: 'credit_card' },
      opening,
      idempotencyKey
    );

  it('creates the wallet and its opening row in one RPC, and adopts both', async () => {
    const result = await create(-5000, 'wallet-key-1');
    expect(result.success).toBe(true);

    const calls = writes('rpc:create_wallet', 'rpc');
    expect(calls).toHaveLength(1);
    expect(calls[0].payload).toMatchObject({
      p_name: 'Visa',
      p_type: 'CREDIT_CARD',
      p_opening_balance: -5000,
      p_idempotency_key: 'wallet-key-1',
    });
    expect((calls[0].payload as { p_opening_date: string }).p_opening_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(writes('wallets', 'insert')).toHaveLength(0);
    expect(writes('transactions', 'insert')).toHaveLength(0);

    await waitFor(() => {
      const card = state().wallets.find((w) => w.name === 'Visa');
      expect(card?.balance).toBe(-5000);
      expect(state().transactions).toEqual([expect.objectContaining({ walletId: card!.id, type: 'ADJUSTMENT', amount: -5000 })]);
    });
  });

  it('replays on the key instead of creating a second wallet', async () => {
    fake.state.lostResponses.add('create_wallet');
    expect((await create(300, 'wallet-key-lost')).success).toBe(false);
    expect((await create(300, 'wallet-key-lost')).success).toBe(true);

    expect(fake.state.tables.wallets.filter((w) => w.name === 'Visa')).toHaveLength(1);
    expect(fake.state.tables.transactions).toHaveLength(1);
    await waitFor(() => expect(state().wallets.filter((w) => w.name === 'Visa')).toHaveLength(1));
  });

  it('falls back to a checked insert when the function is missing', async () => {
    fake.state.rpcs.delete('create_wallet');
    expect((await create(-5000)).success).toBe(true);

    expect(writes('wallets', 'insert')).toHaveLength(1);
    const openingRow = writes('transactions', 'insert')[0];
    expect(openingRow.payload).toMatchObject({ type: 'ADJUSTMENT', amount: -5000, description: 'Opening balance' });
  });

  it('undoes the fallback wallet when its opening row is rejected', async () => {
    fake.state.rpcs.delete('create_wallet');
    fake.state.failures.set('transactions:insert', { message: 'row rejected' });

    const result = await create(250);
    expect(result.success).toBe(false);
    // Soft-deleted, never hard-deleted, and gone from the screen.
    expect(fake.state.tables.wallets.find((w) => w.name === 'Visa')?.is_deleted).toBe(true);
    await waitFor(() => expect(state().wallets.some((w) => w.name === 'Visa' && !w.isDeleted)).toBe(false));
  });
});

describe('a signed-in wallet edit and archive (Phase 59, ADR 0034)', () => {
  it('an edit sends the name, type, colour and icon, and no balance column at all', async () => {
    const result = await actions().editWallet(CASH, { name: 'Pocket', type: 'SAVINGS', color: '#16a34a' });
    expect(result.success).toBe(true);

    const calls = writes('wallets', 'update');
    expect(calls).toHaveLength(1);
    expect(calls[0].filters).toContainEqual(['eq', 'id', CASH]);
    expect(calls[0].payload).toMatchObject({ name: 'Pocket', type: 'SAVINGS', color: '#16a34a', icon: 'savings' });
    // A balance moves only through the ledger (ADR 0023): not even `balance: undefined` is sent.
    expect(calls[0].payload).not.toHaveProperty('balance');
    expect(calls[0].payload).not.toHaveProperty('is_deleted');
    await waitFor(() => expect(wallet(CASH)?.name).toBe('Pocket'));
    expect(wallet(CASH)?.balance).toBe(CASH_OPENING);
  });

  it('archiving sends is_archived alone, and a rejected write puts the wallet back', async () => {
    expect((await actions().setWalletArchived(CASH, true)).success).toBe(true);
    const archive = writes('wallets', 'update')[0];
    expect(archive.payload).toMatchObject({ is_archived: true });
    expect(archive.payload).not.toHaveProperty('balance');
    await waitFor(() => expect(wallet(CASH)?.isArchived).toBe(true));

    fake.state.failures.set('wallets:update', { message: 'permission denied' });
    const result = await actions().setWalletArchived(CASH, false);
    expect(result).toEqual({ success: false, error: 'permission denied' });
    await waitFor(() => expect(wallet(CASH)?.isArchived).toBe(true));
  });

  it('a rejected edit rolls the name back', async () => {
    fake.state.failures.set('wallets:update', { message: 'permission denied' });
    const result = await actions().editWallet(CASH, { name: 'Pocket', type: 'CASH', color: '#16a34a' });
    expect(result.success).toBe(false);
    await waitFor(() => expect(wallet(CASH)?.name).toBe('Cash'));
  });
});

describe('a signed-in debt edit (Phase 60, ADR 0035)', () => {
  const details = { name: 'Car Loan', totalAmount: 12000, interestRate: 3, minimumPayment: 300, dueDate: '2027-06-30' };

  it('sends the edited columns only, never what is still owed or whether it is settled', async () => {
    const result = await actions().editDebt(DEBT, details);
    expect(result.success).toBe(true);

    const calls = writes('debts', 'update');
    expect(calls).toHaveLength(1);
    expect(calls[0].filters).toContainEqual(['eq', 'id', DEBT]);
    expect(calls[0].payload).toMatchObject({
      name: 'Car Loan',
      total_amount: 12000,
      interest_rate: 3,
      minimum_payment: 300,
      due_date: '2027-06-30',
    });
    // A repayment that lands after this device loaded must survive the edit.
    expect(calls[0].payload).not.toHaveProperty('remaining_amount');
    expect(calls[0].payload).not.toHaveProperty('is_settled');
    expect(calls[0].payload).not.toHaveProperty('is_deleted');
    await waitFor(() => expect(debt()?.name).toBe('Car Loan'));
    expect(debt()?.remainingAmount).toBe(DEBT_REMAINING);
  });

  it('clears an emptied rate, minimum and due date', async () => {
    expect((await actions().editDebt(DEBT, { name: 'Student Loan', totalAmount: 10000 })).success).toBe(true);
    expect(writes('debts', 'update')[0].payload).toMatchObject({ interest_rate: 0, minimum_payment: 0, due_date: null });
    await waitFor(() => expect(debt()?.dueDate).toBeUndefined());
  });

  it('refuses a borrowed total below what is still owed, before any write', async () => {
    const result = await actions().editDebt(DEBT, { ...details, totalAmount: DEBT_REMAINING - 1 });
    expect(result).toEqual({ success: false, error: "Borrowed can't be less than what is still owed (฿4,500.00)" });
    expect(writes('debts', 'update')).toHaveLength(0);
  });

  it('a rejected edit puts the debt back', async () => {
    fake.state.failures.set('debts:update', { message: 'permission denied' });
    const result = await actions().editDebt(DEBT, details);
    expect(result).toEqual({ success: false, error: 'permission denied' });
    await waitFor(() => expect(debt()?.name).toBe('Student Loan'));
    expect(debt()?.totalAmount).toBe(10000);
  });
});

describe('a signed-in category edit (Phase 62, ADR 0037)', () => {
  const byName = (name: string) => state().categories.find((c) => c.name === name)!;
  const byType = (type: string) => state().categories.find((c) => c.type === type)!;

  it('refuses a new category on a colour another one uses (L9), before any write', async () => {
    const food = byName('Food & Dining');
    const result = await actions().addCategory({ name: 'Pets', type: 'EXPENSE', color: food.color.toUpperCase() });
    expect(result).toEqual({ success: false, error: 'That colour is used by Food & Dining' });
    expect(writes('categories', 'insert')).toHaveLength(0);
  });

  it('refuses a recolour onto a used colour, but saves a rename that keeps its own', async () => {
    const food = byName('Food & Dining');
    const groceries = byName('Groceries');
    const refused = await actions().updateCategory(groceries.id, { name: 'Groceries', color: food.color });
    expect(refused).toEqual({ success: false, error: 'That colour is used by Food & Dining' });
    expect(writes('categories', 'update')).toHaveLength(0);

    const renamed = await actions().updateCategory(food.id, { name: 'Food', color: food.color });
    expect(renamed.success).toBe(true);
    expect(writes('categories', 'update')).toHaveLength(1);
    await waitFor(() => expect(state().categories.find((c) => c.id === food.id)?.name).toBe('Food'));
  });

  it('refuses any edit to a System category (L10), matched by type, before any write', async () => {
    for (const type of ['DEBT_REPAYMENT', 'ADJUSTMENT']) {
      const system = byType(type);
      const result = await actions().updateCategory(system.id, { name: 'Renamed' });
      expect(result).toEqual({ success: false, error: "System categories can't be edited" });
    }
    expect(writes('categories', 'update')).toHaveLength(0);
  });
});

describe('a signed-in CSV repayment names its debt (F8, ADR 0024)', () => {
  beforeEach(() => installLedgerRpcs());

  const repayRow = (rowIndex: number, amount: number) =>
    importRow({ rowIndex, type: 'DEBT_REPAYMENT', amount, debtName: 'Student Loan', debtId: DEBT });

  it('sends each repayment\'s debt_id, and the debt comes down', async () => {
    const result = await actions().commitBulkImport([repayRow(1, 1000), repayRow(2, 500)], 'import-debt-1');
    expect(result).toMatchObject({ success: true, insertedCount: 2 });

    const payload = writes('rpc:import_transactions', 'rpc')[0].payload as { p_rows: Record<string, unknown>[] };
    expect(payload.p_rows.map((r) => r.debt_id)).toEqual([DEBT, DEBT]);
    expect(fake.state.tables.debts[0].remaining_amount).toBe(DEBT_REMAINING - 1500);
    await waitFor(() => expect(debt()?.remainingAmount).toBe(DEBT_REMAINING - 1500));
  });

  it('reports an aggregate overpayment in the app\'s own words, and moves nothing', async () => {
    const result = await actions().commitBulkImport([repayRow(1, 3000), repayRow(2, 3000)], 'import-debt-2');

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      `These repayments to Student Loan add up to more than the ${formatCurrencyAmount(DEBT_REMAINING)} remaining`
    );
    expect(fake.state.tables.transactions).toHaveLength(0);
    expect(serverWallet(WALLET).balance).toBe(WALLET_OPENING);
    expect(fake.state.tables.debts[0].remaining_amount).toBe(DEBT_REMAINING);
  });
});

describe('the server\'s aggregate guard on a CSV import (F8, ADR 0024)', () => {
  beforeEach(() => installLedgerRpcs());

  it('surfaces the server\'s remainder when this client\'s debt is stale, and re-reads', async () => {
    // Another device paid the loan down to 1,000; this client still sees 4,500,
    // so its own guard lets 2 x 600 through and the server refuses.
    fake.state.tables.debts[0].remaining_amount = 1000;
    const rows = [1, 2].map((rowIndex) =>
      importRow({ rowIndex, type: 'DEBT_REPAYMENT', amount: 600, debtName: 'Student Loan', debtId: DEBT })
    );

    const result = await actions().commitBulkImport(rows, 'import-debt-stale');

    expect(result.success).toBe(false);
    expect(result.error).toBe(`These repayments to Student Loan add up to more than the ${formatCurrencyAmount(1000)} remaining`);
    expect(fake.state.tables.transactions).toHaveLength(0);
    await waitFor(() => expect(debt()?.remainingAmount).toBe(1000));
  });
});

describe('sign-out leaves nothing behind (F5, ADR 0024)', () => {
  /*
   * `signOut` used to reset the user and the auth flag and nothing else: the
   * account's wallets, transactions and templates stayed in memory and in
   * every `pf_*` key, for whoever used the device next as a guest.
   */
  const SENSITIVE = [fake.USER_ID, 'harness@example.com', WALLET, CASH, DEBT, 'Payday template'];
  const storageLeaks = () => {
    const leaks: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      const value = localStorage.getItem(key) ?? '';
      for (const needle of SENSITIVE) if (value.includes(needle)) leaks.push(`${key} holds ${needle}`);
    }
    return leaks;
  };
  /** Longer than the 250 ms batched writer, so anything still queued has landed. */
  const writerSettled = () => new Promise<void>((resolve) => setTimeout(resolve, 400));

  async function withAccountData() {
    installLedgerRpcs();
    expect((await expense(200)).success).toBe(true);
    expect((await actions().addPreset({ name: 'Payday template', type: 'INCOME', amount: 30000, description: 'Salary' })).success).toBe(true);
    await waitFor(() => expect(state().transactions).toHaveLength(1));
    await writerSettled();
    expect(storageLeaks().length).toBeGreaterThan(0); // the precondition: it really was stored
  }

  it('resets every slice to what a brand-new device shows', async () => {
    await withAccountData();
    await actions().signOut();

    await waitFor(() => {
      expect(state().isAuthenticated).toBe(false);
      expect(state().transactions).toHaveLength(0);
      expect(state().presets).toHaveLength(0);
      expect(state().wallets.map((w) => w.id)).not.toContain(WALLET);
      expect(state().debts.map((d) => d.id)).not.toContain(DEBT);
      expect(state().currentUser.id).not.toBe(fake.USER_ID);
    });
    expect(fake.state.signOuts).toEqual(['local']);
  });

  it('leaves no trace of the account in localStorage, templates included', async () => {
    await withAccountData();
    await actions().signOut();
    await writerSettled();
    expect(storageLeaks()).toEqual([]);
  });

  it('does not let a write still queued at sign-out land afterwards', async () => {
    installLedgerRpcs();
    // Queued, not yet flushed: the batched writer holds it for 250 ms.
    await actions().addPreset({ name: 'Payday template', type: 'INCOME', amount: 30000, description: 'Salary' });
    await actions().signOut();
    await writerSettled();
    expect(storageLeaks()).toEqual([]);
  });

  it('does the same when another device signs this one out', async () => {
    await withAccountData();
    // What supabase-js emits once "sign out other devices" revokes this session.
    await fake.state.authCallback!('SIGNED_OUT', null);
    await writerSettled();

    expect(state().isAuthenticated).toBe(false);
    expect(state().transactions).toHaveLength(0);
    expect(storageLeaks()).toEqual([]);
  });

  it('keeps the data through an auth event that is not a sign-out', async () => {
    await withAccountData();
    await fake.state.authCallback!('TOKEN_REFRESHED', fake.session);
    await writerSettled();
    expect(state().transactions).toHaveLength(1);
    expect(state().presets).toHaveLength(1);
  });

  it('signs out everywhere with the global scope, and still clears this device', async () => {
    await withAccountData();
    await actions().signOut({ everywhere: true });
    await writerSettled();
    expect(fake.state.signOuts).toEqual(['global']);
    expect(storageLeaks()).toEqual([]);
  });
});

describe('a cloud load still in flight at sign-out (F5, ADR 0024)', () => {
  it('stops instead of landing the account\'s rows in the guest\'s state', async () => {
    // A reload starts and stalls on its transactions read...
    let releaseRead!: () => void;
    fake.state.gates.set('transactions:select', new Promise<void>((resolve) => (releaseRead = resolve)));
    fake.state.tables.transactions.push({
      id: 'tx-server-1', user_id: fake.USER_ID, wallet_id: WALLET, amount: 99, type: 'EXPENSE',
      description: 'Server row', transaction_date: TODAY, is_deleted: false,
    });
    const reload = fake.state.authCallback!('TOKEN_REFRESHED', fake.session);

    // ...the user signs out while it waits...
    await actions().signOut();
    releaseRead();
    await reload;
    await new Promise<void>((resolve) => setTimeout(resolve, 400));

    // ...and the guest sees none of it.
    expect(state().isAuthenticated).toBe(false);
    expect(state().transactions).toHaveLength(0);
    expect(state().wallets.map((w) => w.id)).not.toContain(WALLET);
  });
});

describe('real sessions (ADR 0024)', () => {
  /*
   * The Security tab's device list was built in the browser, with a hardcoded
   * IP, and "Revoke" reached nothing. Sessions now come from auth.sessions via
   * list_my_sessions, and revocation is the supported signOut scope.
   */
  beforeEach(() => installLedgerRpcs());

  it('lists the account\'s sessions, the current one marked', async () => {
    const result = await actions().listMySessions();
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions!.find((s) => s.isCurrent)).toMatchObject({ id: 'session-this', ip: '198.51.100.4' });
  });

  it('reports the list as unavailable - not empty - without the migration', async () => {
    fake.state.rpcs.delete('list_my_sessions');
    expect(await actions().listMySessions()).toEqual({ sessions: null, error: undefined });
  });

  it('signs out the other devices with the "others" scope, and stays signed in here', async () => {
    expect((await actions().signOutOtherDevices()).success).toBe(true);
    expect(fake.state.signOuts).toEqual(['others']);
    expect(state().isAuthenticated).toBe(true);
    expect(wallet()?.balance).toBe(WALLET_OPENING);
  });
});

describe('the Account & Security modal (ADR 0024)', () => {
  beforeEach(() => installLedgerRpcs());

  const open = () => showUi!(<AccountModal isOpen onClose={() => showUi!(null)} onRequestSignIn={() => {}} />);

  it('shows each real session with a device label, and marks this one', async () => {
    open();
    expect(await screen.findByText('Chrome on Windows')).toBeTruthy();
    expect(screen.getByText('Safari on iPhone')).toBeTruthy();
    expect(screen.getByText('This device')).toBeTruthy();
    expect(screen.getByText(/203\.0\.113\.7/)).toBeTruthy();
    // The fabricated "127.0.0.1 (Current Client)" is gone for good.
    expect(screen.queryByText(/127\.0\.0\.1/)).toBeNull();
  });

  it('signs out the other devices only after a confirmation', async () => {
    open();
    fireEvent.click(await screen.findByText('Sign out other devices'));
    expect(fake.state.signOuts).toEqual([]);
    fireEvent.click(await screen.findByText('Sign out others'));
    await waitFor(() => expect(fake.state.signOuts).toEqual(['others']));
    expect(await screen.findByText('Your other devices have been signed out.')).toBeTruthy();
  });

  it('signs this device out behind a confirmation that warns about templates', async () => {
    open();
    fireEvent.click(await screen.findByText('Sign out'));
    expect(await screen.findByText(/templates saved on this device/)).toBeTruthy();
    expect(fake.state.signOuts).toEqual([]);

    const dialogs = screen.getAllByRole('dialog');
    const confirm = dialogs[dialogs.length - 1].querySelectorAll('button');
    fireEvent.click(Array.from(confirm).find((b) => b.textContent === 'Sign out')!);

    await waitFor(() => {
      expect(fake.state.signOuts).toEqual(['local']);
      expect(state().isAuthenticated).toBe(false);
    });
  });
});

describe('a device signed out from another device (ADR 0024, amended)', () => {
  /*
   * "Sign out other devices" revokes the other sessions' refresh tokens on the
   * server, but their access tokens are JWTs that PostgREST and Realtime keep
   * accepting until they expire - up to an hour. supabase-js only notices when
   * it next refreshes, so a revoked phone went on reading and writing the
   * account. The provider now asks the auth server (`auth.getUser()`, which
   * checks the session itself) whenever the app wakes, regains focus, comes
   * back online or resubscribes, once a minute while visible, and after any
   * 401 from the Data API.
   */
  const quietPeriod = () => new Promise<void>((resolve) => setTimeout(resolve, 600));
  const signedOutHere = () =>
    waitFor(() => {
      expect(state().isAuthenticated).toBe(false);
      expect(state().transactions).toHaveLength(0);
      expect(state().wallets.map((w) => w.id)).not.toContain(WALLET);
    });
  const stillSignedIn = () => {
    expect(state().isAuthenticated).toBe(true);
    expect(wallet()?.balance).toBe(WALLET_OPENING);
    expect(fake.state.signOuts).toEqual([]);
  };

  let restoreVisibility: (() => void) | null = null;
  function setVisibility(value: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
    restoreVisibility = () => {
      delete (document as unknown as Record<string, unknown>).visibilityState;
    };
  }
  /** Past the 10 s gap that stops focus and visibility from re-asking back to back. */
  function laterThanTheLastCheck() {
    const realNow = Date.now.bind(Date);
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 31_000);
  }
  afterEach(() => {
    restoreVisibility?.();
    restoreVisibility = null;
    vi.restoreAllMocks();
  });

  it('clears the device when it becomes visible after its session was revoked', async () => {
    fake.state.userError = new AuthSessionMissingError();
    laterThanTheLastCheck();
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await signedOutHere();
    // supabase-js signed the session out itself; the provider only cleared up.
    await quietPeriod();
    expect(fake.state.signOuts).toEqual([]);
  });

  it('clears the device when the window regains focus', async () => {
    fake.state.userError = new AuthSessionMissingError();
    laterThanTheLastCheck();
    window.dispatchEvent(new Event('focus'));
    await signedOutHere();
  });

  it('clears the device when it comes back online', async () => {
    fake.state.userError = new AuthSessionMissingError();
    window.dispatchEvent(new Event('online'));
    await signedOutHere();
  });

  it('clears the device when the realtime channel resubscribes', async () => {
    fake.state.userError = new AuthSessionMissingError();
    fake.state.channelStatus!('CHANNEL_ERROR');
    fake.state.channelStatus!('SUBSCRIBED');
    await signedOutHere();
  });

  it('checks once a minute while the app stays open and visible', async () => {
    // A phone left open on the desk fires no wake event at all.
    cleanup();
    const intervals = vi.spyOn(globalThis, 'setInterval');
    await mountSignedIn();
    const tick = intervals.mock.calls.find(([, ms]) => ms === 60_000)?.[0] as (() => void) | undefined;
    expect(tick).toBeTypeOf('function');

    setVisibility('hidden');
    const before = fake.state.getUserCalls;
    tick!();
    await quietPeriod();
    expect(fake.state.getUserCalls).toBe(before); // a hidden tab waits for its wake event

    fake.state.userError = new AuthSessionMissingError();
    setVisibility('visible');
    tick!();
    await signedOutHere();
  });

  it('clears a device reopened after its session was revoked', async () => {
    // A PWA cold start: the stored session still looks valid to getSession().
    cleanup();
    fake.state.userError = new AuthSessionMissingError();
    render(
      <FinanceProvider>
        <Probe />
      </FinanceProvider>
    );
    await waitFor(() => expect(fake.state.getUserCalls).toBeGreaterThan(0));
    await quietPeriod();
    expect(state().isAuthenticated).toBe(false);
    expect(state().wallets.map((w) => w.id)).not.toContain(WALLET);
  });

  it('signs out locally when the server no longer knows the user', async () => {
    // Not a missing session, so supabase-js keeps it: the provider must act.
    fake.state.userError = new AuthApiError('User from sub claim in JWT does not exist', 403, 'user_not_found');
    window.dispatchEvent(new Event('online'));
    await signedOutHere();
    expect(fake.state.signOuts).toEqual(['local']);
  });

  it('checks the session after a 401 from the Data API, and signs out if it is gone', async () => {
    fake.state.failures.set('wallets:select', { message: 'JWT expired', code: 'PGRST303', status: 401 });
    fake.state.userError = new AuthSessionMissingError();
    const before = fake.state.getUserCalls;
    await actions().refreshFromCloud();
    await signedOutHere();
    expect(fake.state.getUserCalls).toBe(before + 1);
  });

  it('stays signed in after a 401 when the auth server still honours the session', async () => {
    // A token that expired in transit: getUser() refreshes it and succeeds.
    // Signing out here would wipe the device on a race, not a revocation.
    fake.state.failures.set('rpc:list_my_sessions', { message: 'JWT expired', code: 'PGRST303', status: 401 });
    const before = fake.state.getUserCalls;
    await actions().listMySessions();
    await quietPeriod();
    expect(fake.state.getUserCalls).toBe(before + 1);
    stillSignedIn();
  });

  it.each([
    ['offline', () => new AuthRetryableFetchError('Failed to fetch', 0)],
    ['a 5xx from the auth server', () => new AuthRetryableFetchError('Service Unavailable', 503)],
    ['rate-limited', () => new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit')],
  ])('keeps the session when the check cannot get an answer (%s)', async (_label, makeError) => {
    fake.state.userError = makeError();
    const before = fake.state.getUserCalls;
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(fake.state.getUserCalls).toBe(before + 1));
    await quietPeriod();
    stillSignedIn();
  });

  it('asks once for wake events in quick succession', async () => {
    laterThanTheLastCheck();
    setVisibility('visible');
    const before = fake.state.getUserCalls;
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus')); // joins the check in flight
    await waitFor(() => expect(fake.state.getUserCalls).toBe(before + 1));
    await quietPeriod();

    // That check has finished; one this recent answers for the next focus too.
    window.dispatchEvent(new Event('focus'));
    await quietPeriod();
    expect(fake.state.getUserCalls).toBe(before + 1);
    stillSignedIn();
  });

  it('stops checking once signed out', async () => {
    await actions().signOut();
    await waitFor(() => expect(state().isAuthenticated).toBe(false));
    const before = fake.state.getUserCalls;
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('focus'));
    await quietPeriod();
    expect(fake.state.getUserCalls).toBe(before);
  });
});
