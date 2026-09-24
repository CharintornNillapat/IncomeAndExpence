// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import {
  FinanceProvider,
  useFinanceState,
  useFinanceActions,
  type FinanceActionsContextType,
  type FinanceStateContextType,
} from '../src/context/FinanceContext';

/**
 * Phase 44's coverage gap (ADR 0021).
 *
 * ADR 0016 made a debt repayment impossible to overpay at two layers, and made
 * soft-delete and restore move the debt with the wallet. The form half is
 * covered by `tests/debt-repayment.spec.ts`; the ledger half is not, because
 * the form disables submit before an overpayment is ever sent. So the guard
 * that actually protects the ledger has never run in a test.
 *
 * Worse, the properties that matter most here are properties of ORDERING, and
 * ordering has no UI symptom at all:
 *
 *   - the guard sits BEFORE `inFlightIdempotencyKeys.add`, or a rejection
 *     leaks the key forever — and `useIdempotencyKey` reuses it on retry, so
 *     the user corrects the amount and is told "Duplicate transaction
 *     submission in progress" for the rest of the form's life;
 *   - the guard sits AFTER the `existingTx` replay check, or retrying a
 *     payment that already settled its debt is rejected for exceeding a
 *     remainder its own success drove to zero.
 *
 * This mounts the real provider and calls the real actions — literally
 * "without UI gates", because there is no form. Nothing in `src/` changed.
 *
 * The provider is inert under test: its auth effect returns early on
 * `!isSupabaseConfigured` and its realtime channel on `!isAuthenticated`, so
 * with no `VITE_SUPABASE_*` variables there is no network call and no
 * WebSocket.
 */

/** The seeded fixture the provider falls back to with an empty localStorage. */
const WALLET_MAIN = 'wal-main-checking'; // ฿2,500.00
const WALLET_SAVINGS = 'wal-savings'; // ฿5,000.00
const DEBT = 'debt-starter-01'; // Student Loan, ฿4,500.00 of ฿10,000.00
const DEBT_REMAINING = 4500;
const SAVINGS_OPENING = 5000;

const TODAY = '2026-09-15';

let latest: { state: FinanceStateContextType; actions: FinanceActionsContextType } | null = null;

function Probe() {
  latest = { state: useFinanceState(), actions: useFinanceActions() };
  return null;
}

const state = () => latest!.state;
const actions = () => latest!.actions;
const wallet = (id: string) => state().wallets.find((w) => w.id === id)!;
const debt = () => state().debts.find((d) => d.id === DEBT)!;

/** Awaits an action with its resulting React state updates flushed. */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  let out!: T;
  await act(async () => {
    out = await fn();
  });
  return out;
}

/** Transaction ids are `tx-${Date.now()}`, so two in one millisecond collide. */
async function tick() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3));
  });
}

type RepayOverrides = Partial<Parameters<FinanceActionsContextType['addTransaction']>[0]>;

function repay(overrides: RepayOverrides = {}) {
  return actions().addTransaction({
    amount: 1000,
    type: 'DEBT_REPAYMENT',
    debtId: DEBT,
    walletId: WALLET_SAVINGS,
    description: 'Student Loan payment',
    transactionDate: TODAY,
    ...overrides,
  });
}

beforeEach(() => {
  latest = null;
  localStorage.clear();
  render(
    <FinanceProvider>
      <Probe />
    </FinanceProvider>
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the fixture', () => {
  it('seeds the starter wallets and the starter debt', () => {
    expect(wallet(WALLET_MAIN).balance).toBe(2500);
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING);
    expect(debt()).toMatchObject({
      name: 'Student Loan',
      totalAmount: 10000,
      remainingAmount: DEBT_REMAINING,
      isSettled: false,
    });
    expect(state().transactions).toHaveLength(0);
  });
});

describe('the repayment guard (ADR 0016)', () => {
  it('rejects a payment larger than what is owed, naming the maximum', async () => {
    const result = await call(() => repay({ amount: DEBT_REMAINING + 0.01 }));

    expect(result.success).toBe(false);
    expect(result.error).toContain('Payment exceeds');
    expect(result.error).toContain('฿4,500.00');
    expect(result.error).toContain('Student Loan');
  });

  it('moves absolutely nothing when it rejects', async () => {
    await call(() => repay({ amount: 9999 }));

    // No wallet debit, no debt decrement, no orphan ledger row. The guard
    // sits before every optimistic write, which is what makes this true.
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING);
    expect(debt().remainingAmount).toBe(DEBT_REMAINING);
    expect(debt().isSettled).toBe(false);
    expect(state().transactions).toHaveLength(0);
  });

  it('accepts a payment of exactly the remaining balance', async () => {
    // The boundary, from the other side. Rejecting this would make a debt
    // impossible to clear through the app at all.
    const result = await call(() => repay({ amount: DEBT_REMAINING }));

    expect(result.success).toBe(true);
    expect(debt().remainingAmount).toBe(0);
    expect(debt().isSettled).toBe(true);
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING - DEBT_REMAINING);
  });

  it('rejects a repayment against a debt that does not resolve', async () => {
    // Zod proves `debtId` is present; it cannot prove the debt still exists.
    const result = await call(() => repay({ debtId: 'debt-deleted-since' }));

    expect(result.success).toBe(false);
    expect(result.error).toBe('Debt goal not found or has been deleted');
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING);
  });

  it('rejects a repayment with no debt target at all, at the schema layer', async () => {
    const result = await call(() => repay({ debtId: undefined }));

    expect(result.success).toBe(false);
    expect(result.error).toContain('active debt goal');
  });

  it('leaves a plain EXPENSE completely alone', async () => {
    /*
     * The `repayTargetDebt !== null` regression, at the ledger layer. On a
     * non-debt write there is no remaining balance to compare against; if the
     * guard were reached anyway it would measure the amount against zero and
     * reject EVERY expense and income in the app.
     */
    const result = await call(() =>
      actions().addTransaction({
        amount: 99999,
        type: 'EXPENSE',
        walletId: WALLET_MAIN,
        description: 'Something enormous',
        transactionDate: TODAY,
      })
    );

    expect(result.success).toBe(true);
    // Overdraft warns elsewhere; it never blocks. A credit card legitimately
    // carries a negative balance.
    expect(wallet(WALLET_MAIN).balance).toBe(2500 - 99999);
  });
});

describe('the guard\'s position in the sequence', () => {
  /*
   * Neither of these has a UI symptom, and neither is testable by extracting
   * the arithmetic into a pure function: both are about what the guard sits
   * between.
   */

  it('does NOT leak the idempotency key when it rejects', async () => {
    const key = 'idemp-phase49-no-leak';

    const rejected = await call(() => repay({ amount: 9999, idempotencyKey: key }));
    expect(rejected.success).toBe(false);

    // The user corrects the amount. `useIdempotencyKey` reuses the same key on
    // retry, so if the rejection had leaked it into `inFlightIdempotencyKeys`
    // this comes back "Duplicate transaction submission in progress" and the
    // form is bricked for the rest of its life.
    const corrected = await call(() => repay({ amount: 100, idempotencyKey: key }));

    expect(corrected.success).toBe(true);
    expect(corrected.error).toBeUndefined();
    expect(debt().remainingAmount).toBe(DEBT_REMAINING - 100);
  });

  it('replays a settled repayment instead of rejecting it for exceeding zero', async () => {
    const key = 'idemp-phase49-replay';

    const first = await call(() => repay({ amount: DEBT_REMAINING, idempotencyKey: key }));
    expect(first.success).toBe(true);
    expect(debt().remainingAmount).toBe(0);

    // Same key again — a retry of a payment whose own success drove the
    // remainder to zero. If the guard sat ABOVE the replay check, this would
    // be rejected as "Payment exceeds ฿0.00 remaining".
    const replay = await call(() => repay({ amount: DEBT_REMAINING, idempotencyKey: key }));

    expect(replay.success).toBe(true);
    expect(replay.txId).toBe(first.txId);
    // ...and the replay must not charge twice.
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING - DEBT_REMAINING);
    expect(debt().remainingAmount).toBe(0);
    expect(state().transactions).toHaveLength(1);
  });
});

describe('soft-delete and restore move the debt with the wallet (ADR 0016)', () => {
  /*
   * Before ADR 0016, soft-deleting a DEBT_REPAYMENT refunded the wallet and
   * left `remainingAmount` decremented — free money, repeatable — while
   * restoring debited the wallet again with no debt movement, charging twice
   * for one reduction. No spec covered it, and none can easily:
   * `soft-delete.spec.ts`'s balance-invariant test uses an EXPENSE, so nothing
   * had ever driven a repayment through delete and restore.
   */

  it('gives the debt back when the repayment is soft-deleted', async () => {
    const paid = await call(() => repay({ amount: 1000 }));
    expect(wallet(WALLET_SAVINGS).balance).toBe(4000);
    expect(debt().remainingAmount).toBe(3500);

    await call(() => actions().softDeleteTransaction(paid.txId!));

    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING); // refunded
    expect(debt().remainingAmount).toBe(DEBT_REMAINING); // AND given back
  });

  it('takes both back when the repayment is restored', async () => {
    const paid = await call(() => repay({ amount: 1000 }));
    await call(() => actions().softDeleteTransaction(paid.txId!));
    await call(() => actions().restoreTransaction(paid.txId!));

    expect(wallet(WALLET_SAVINGS).balance).toBe(4000);
    expect(debt().remainingAmount).toBe(3500);
  });

  it('un-settles a debt when the payment that settled it is removed', async () => {
    const paid = await call(() => repay({ amount: DEBT_REMAINING }));
    expect(debt().isSettled).toBe(true);

    await call(() => actions().softDeleteTransaction(paid.txId!));

    // `isSettled` is recomputed in both directions, so the debt's card becomes
    // actionable again rather than sitting settled with money owed.
    expect(debt().isSettled).toBe(false);
    expect(debt().remainingAmount).toBe(DEBT_REMAINING);
  });

  it('re-settles the debt when that payment is restored', async () => {
    const paid = await call(() => repay({ amount: DEBT_REMAINING }));
    await call(() => actions().softDeleteTransaction(paid.txId!));
    await call(() => actions().restoreTransaction(paid.txId!));

    expect(debt().isSettled).toBe(true);
    expect(debt().remainingAmount).toBe(0);
  });

  it('survives a full delete/restore cycle with the ledger exactly where it started', async () => {
    const paid = await call(() => repay({ amount: 1234.56 }));
    const afterPayment = {
      balance: wallet(WALLET_SAVINGS).balance,
      remaining: debt().remainingAmount,
    };

    for (let i = 0; i < 3; i += 1) {
      await call(() => actions().softDeleteTransaction(paid.txId!));
      await call(() => actions().restoreTransaction(paid.txId!));
    }

    // Repeating the cycle is exactly how the pre-0016 bug printed money.
    expect(wallet(WALLET_SAVINGS).balance).toBe(afterPayment.balance);
    expect(debt().remainingAmount).toBe(afterPayment.remaining);
  });

  it('is a no-op when the transaction is already in the requested state', async () => {
    const paid = await call(() => repay({ amount: 1000 }));
    await call(() => actions().softDeleteTransaction(paid.txId!));

    const again = await call(() => actions().softDeleteTransaction(paid.txId!));

    expect(again.success).toBe(true);
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING);
    expect(debt().remainingAmount).toBe(DEBT_REMAINING);
  });

  it('reports a missing transaction rather than moving anything', async () => {
    const result = await call(() => actions().softDeleteTransaction('tx-never-existed'));

    expect(result).toEqual({ success: false, error: 'Transaction not found' });
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING);
  });

  it('moves only the wallet for a non-debt transaction', async () => {
    // The debt branch is conditional on the type and a resolvable `debtId`;
    // an EXPENSE must leave every debt untouched in both directions.
    const spent = await call(() =>
      actions().addTransaction({
        amount: 300,
        type: 'EXPENSE',
        walletId: WALLET_MAIN,
        description: 'Groceries',
        transactionDate: TODAY,
      })
    );
    expect(wallet(WALLET_MAIN).balance).toBe(2200);

    await call(() => actions().softDeleteTransaction(spent.txId!));

    expect(wallet(WALLET_MAIN).balance).toBe(2500);
    expect(debt().remainingAmount).toBe(DEBT_REMAINING);
    expect(debt().isSettled).toBe(false);
  });
});

describe('ledger arithmetic stays cent-precise', () => {
  it('rounds a repayment to whole cents on the way down and back up', async () => {
    const paid = await call(() => repay({ amount: 0.1 }));
    await tick();
    const second = await call(() => repay({ amount: 0.2 }));

    // 4500 - 0.1 - 0.2 in raw floats is 4499.699999999999.
    expect(debt().remainingAmount).toBe(4499.7);
    expect(wallet(WALLET_SAVINGS).balance).toBe(4999.7);

    await call(() => actions().softDeleteTransaction(second.txId!));
    await call(() => actions().softDeleteTransaction(paid.txId!));

    expect(debt().remainingAmount).toBe(DEBT_REMAINING);
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING);
  });
});
