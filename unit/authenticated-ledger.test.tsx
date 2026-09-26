// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import {
  FinanceProvider,
  useFinanceState,
  useFinanceActions,
  type FinanceActionsContextType,
  type FinanceStateContextType,
} from '../src/context/FinanceContext';
import type { ImportRowValidation } from '../src/types';

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

type Op = 'select' | 'insert' | 'update' | 'delete';

const fake = vi.hoisted(() => {
  const USER_ID = 'user-test-1';
  const state = {
    tables: {} as Record<string, Record<string, unknown>[]>,
    calls: [] as {
      table: string;
      op: 'select' | 'insert' | 'update' | 'delete';
      payload?: unknown;
      filters: ['eq' | 'in', string, unknown][];
    }[],
    /**
     * `${table}:${op}` → the error that call returns, until cleared. `onlyId`
     * narrows it to a call filtered by `eq('id', onlyId)`, so one of several
     * wallet writes can fail while the others land.
     */
    failures: new Map<string, { message: string; onlyId?: string }>(),
    /** `${table}:${op}` → a promise the call waits on before settling. */
    gates: new Map<string, Promise<void>>(),
    authCallback: null as null | ((event: string, session: unknown) => Promise<void> | void),
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
      if (failure && targetsThisCall) return { data: null, error: { message: failure.message } };

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

  const channel = {
    on() {
      return channel;
    },
    subscribe() {
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
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => builder(table),
    rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'not under test' } }),
    channel: () => channel,
    removeChannel: () => {},
  };

  return { USER_ID, session, state, client };
});

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: fake.client,
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

function Probe() {
  latest = { state: useFinanceState(), actions: useFinanceActions() };
  return null;
}

const state = () => latest!.state;
const actions = () => latest!.actions;
const wallet = (id: string = WALLET) => state().wallets.find((w) => w.id === id);
const serverWallet = (id: string) => fake.state.tables.wallets.find((w) => w.id === id)!;
const debt = () => state().debts.find((d) => d.id === DEBT);

/** Every recorded write to one table, in order. */
const writes = (table: string, op: Op) => fake.state.calls.filter((c) => c.table === table && c.op === op);

function repay(amount: number) {
  return actions().addTransaction({
    amount,
    type: 'DEBT_REPAYMENT',
    debtId: DEBT,
    walletId: WALLET,
    description: 'Student Loan payment',
    transactionDate: TODAY,
  });
}

beforeEach(async () => {
  latest = null;
  localStorage.clear();
  seed();
  fake.state.calls = [];
  fake.state.failures.clear();
  fake.state.gates.clear();
  fake.state.authCallback = null;

  render(
    <FinanceProvider>
      <Probe />
    </FinanceProvider>
  );

  // Signed in, and the seeded cloud rows have replaced the local fixture.
  await waitFor(() => {
    expect(state().isAuthenticated).toBe(true);
    expect(wallet()?.balance).toBe(WALLET_OPENING);
    expect(debt()?.remainingAmount).toBe(DEBT_REMAINING);
  });
  fake.state.calls = [];
});

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
