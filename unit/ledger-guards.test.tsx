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
import type { TransactionEdit } from '../src/types';
import { seedGuestLedger, SAMPLE_WALLETS, SAMPLE_STUDENT_LOAN } from './fixtures/guestLedger';

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

/**
 * The sample rows seeded before each mount (`unit/fixtures/guestLedger.ts`).
 * They were the provider's own guest defaults until ADR 0040 opened the
 * starters at ฿0.00 with no debt.
 */
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
  seedGuestLedger({ wallets: SAMPLE_WALLETS, debts: [SAMPLE_STUDENT_LOAN] });
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
  it('hydrates the sample wallets and the sample debt', () => {
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

  it('an unseeded fresh provider has three wallets at 0 and no debt (ADR 0040)', () => {
    cleanup();
    latest = null;
    localStorage.clear();
    render(
      <FinanceProvider>
        <Probe />
      </FinanceProvider>
    );

    expect(state().wallets.map((w) => w.id)).toEqual(['wal-main-checking', 'wal-cash', 'wal-savings']);
    expect(state().wallets.every((w) => w.balance === 0)).toBe(true);
    expect(state().debts).toEqual([]);
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

describe('a signed ADJUSTMENT (ADR 0024)', () => {
  /*
   * WalletPopupModal's balance editor used to write `Math.abs(diff)` as an
   * ADJUSTMENT, and every ledger path treats ADJUSTMENT as a credit - so
   * lowering a wallet raised it. An ADJUSTMENT's amount is now the signed
   * correction; every other type stays strictly positive.
   */
  const adjust = (amount: number, overrides: RepayOverrides = {}) =>
    actions().addTransaction({
      amount,
      type: 'ADJUSTMENT',
      walletId: WALLET_SAVINGS,
      description: 'Manual balance adjustment',
      transactionDate: TODAY,
      ...overrides,
    });

  it('lowers the balance for a negative amount', async () => {
    const result = await call(() => adjust(-1000));
    expect(result.success).toBe(true);
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING - 1000);
    expect(state().transactions[0]).toMatchObject({ type: 'ADJUSTMENT', amount: -1000 });
  });

  it('still raises it for a positive amount', async () => {
    expect((await call(() => adjust(250))).success).toBe(true);
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING + 250);
  });

  it('gives a downward adjustment back on delete, and takes it again on restore', async () => {
    const result = await call(() => adjust(-1000));
    await call(() => actions().softDeleteTransaction(result.txId!));
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING);
    await call(() => actions().restoreTransaction(result.txId!));
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING - 1000);
  });

  it('rejects a zero adjustment, moving nothing', async () => {
    const result = await call(() => adjust(0));
    expect(result.success).toBe(false);
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING);
    expect(state().transactions).toHaveLength(0);
  });

  it('keeps every other type strictly positive', async () => {
    const result = await call(() => adjust(-50, { type: 'EXPENSE' }));
    expect(result.success).toBe(false);
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING);
  });
});

describe('a guest edit (ADR 0033)', () => {
  /*
   * The same arithmetic as `update_transaction`, done locally: the new row's
   * wallet effects minus the old row's. Each case starts from the fixture's
   * Main ฿2,500 and Savings ฿5,000.
   */
  const MAIN_OPENING = 2500;

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

  const add = (overrides: RepayOverrides) =>
    call(() =>
      actions().addTransaction({
        amount: 200,
        type: 'EXPENSE',
        walletId: WALLET_MAIN,
        description: 'Groceries',
        transactionDate: TODAY,
        ...overrides,
      })
    );

  const edit = (txId: string, changes: Partial<TransactionEdit>) =>
    call(() => actions().updateTransaction(txId, editOf(txId, changes)));

  const row = (txId: string) => state().transactions.find((t) => t.id === txId)!;

  it("moves only the difference when an expense's amount changes", async () => {
    const { txId } = await add({});
    expect((await edit(txId!, { amount: 350, rawInput: '200+150' })).success).toBe(true);
    expect(wallet(WALLET_MAIN).balance).toBe(MAIN_OPENING - 350);
    expect(row(txId!)).toMatchObject({ amount: 350, rawInput: '200+150' });
  });

  it('gives the old wallet its money back and charges the new one', async () => {
    const { txId } = await add({});
    expect((await edit(txId!, { walletId: WALLET_SAVINGS })).success).toBe(true);
    expect(wallet(WALLET_MAIN).balance).toBe(MAIN_OPENING);
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING - 200);
  });

  it('turns an expense into a transfer', async () => {
    const { txId } = await add({});
    const result = await edit(txId!, { type: 'TRANSFER', destinationWalletId: WALLET_SAVINGS, categoryId: undefined });
    expect(result.success).toBe(true);
    expect(wallet(WALLET_MAIN).balance).toBe(MAIN_OPENING - 200);
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING + 200);
    expect(row(txId!)).toMatchObject({ type: 'TRANSFER', destinationWalletId: WALLET_SAVINGS });
  });

  it('turns a transfer into income, dropping its destination', async () => {
    const { txId } = await add({ type: 'TRANSFER', amount: 300, destinationWalletId: WALLET_SAVINGS, description: 'Move' });
    expect(wallet(WALLET_MAIN).balance).toBe(MAIN_OPENING - 300);
    await tick();

    const result = await edit(txId!, { type: 'INCOME', walletId: WALLET_SAVINGS, destinationWalletId: undefined });
    expect(result.success).toBe(true);
    expect(wallet(WALLET_MAIN).balance).toBe(MAIN_OPENING);
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING + 300);
    expect(row(txId!).destinationWalletId).toBeUndefined();
  });

  it("swaps a transfer's From and To", async () => {
    const { txId } = await add({ type: 'TRANSFER', amount: 300, destinationWalletId: WALLET_SAVINGS, description: 'Move' });
    await tick();

    const result = await edit(txId!, { walletId: WALLET_SAVINGS, destinationWalletId: WALLET_MAIN });
    expect(result.success).toBe(true);
    expect(wallet(WALLET_MAIN).balance).toBe(MAIN_OPENING + 300);
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING - 300);
  });

  it("edits a downward adjustment's note without refusing its negative amount", async () => {
    const { txId } = await add({ type: 'ADJUSTMENT', amount: -1000, walletId: WALLET_SAVINGS, description: 'Manual balance adjustment' });
    const result = await edit(txId!, { description: 'Counted the cash' });
    expect(result).toEqual({ success: true });
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING - 1000);
    expect(row(txId!)).toMatchObject({ description: 'Counted the cash', amount: -1000 });
  });

  it("edits a repayment's note and date, and never its money", async () => {
    const { txId } = await call(() => repay());
    await tick();

    expect((await edit(txId!, { description: 'September payment', transactionDate: '2026-09-14' })).success).toBe(true);
    expect(row(txId!)).toMatchObject({ description: 'September payment', transactionDate: '2026-09-14' });

    const refused = await edit(txId!, { amount: 1200 });
    expect(refused).toEqual({ success: false, error: 'Only the note and date of a debt repayment or an adjustment can change' });
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING - 1000);
    expect(debt().remainingAmount).toBe(DEBT_REMAINING - 1000);
  });

  it('refuses a deleted row, a row turned into an adjustment, and a wallet that does not exist', async () => {
    const { txId } = await add({});
    await tick();

    expect((await edit(txId!, { type: 'ADJUSTMENT' })).error).toBe('A transaction can only become income, an expense or a transfer');
    expect((await edit(txId!, { walletId: 'wal-nowhere' })).error).toBe('Wallet not found or has been deleted');
    await call(() => actions().softDeleteTransaction(txId!));
    expect((await edit(txId!, { amount: 999 })).error).toBe('Restore this transaction before editing it');
    expect(wallet(WALLET_MAIN).balance).toBe(MAIN_OPENING);
  });

  it('changes nothing for an edit that changes nothing', async () => {
    const { txId } = await add({});
    const before = row(txId!);
    expect(await edit(txId!, {})).toEqual({ success: true });
    expect(row(txId!)).toBe(before);
  });
});

describe('opening balances are ledger rows (F7, ADR 0024)', () => {
  /*
   * A guest wallet used to appear with its balance and no row, so the ledger
   * could not explain the money. Every user-created wallet now opens with an
   * ADJUSTMENT "Opening balance" of the signed opening amount. The starter
   * wallets are exempt by decision - see the fixture test above.
   */
  const create = (name: string, type: 'SAVINGS' | 'CREDIT_CARD' | 'CASH', opening: number) =>
    actions().addWallet({ name, type, currency: 'THB', color: '#0284c7', icon: type.toLowerCase() }, opening);
  const walletNamed = (name: string) => state().wallets.find((w) => w.name === name)!;
  const rowsFor = (walletId: string) => state().transactions.filter((t) => t.walletId === walletId && !t.isDeleted);

  it('records the opening balance as one ADJUSTMENT that explains the balance', async () => {
    expect((await call(() => create('Rainy Day', 'SAVINGS', 1234.5))).success).toBe(true);
    const created = walletNamed('Rainy Day');
    expect(created.balance).toBe(1234.5);
    const rows = rowsFor(created.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'ADJUSTMENT', amount: 1234.5, description: 'Opening balance' });
    expect(rows.reduce((sum, t) => sum + t.amount, 0)).toBe(created.balance);
  });

  it('lets a credit card open owing money, with a negative row', async () => {
    expect((await call(() => create('Visa', 'CREDIT_CARD', -5000))).success).toBe(true);
    const card = walletNamed('Visa');
    expect(card.balance).toBe(-5000);
    expect(rowsFor(card.id)).toEqual([expect.objectContaining({ type: 'ADJUSTMENT', amount: -5000 })]);
  });

  it('writes no row for a zero opening', async () => {
    await call(() => create('Empty Jar', 'CASH', 0));
    expect(rowsFor(walletNamed('Empty Jar').id)).toHaveLength(0);
  });

  it('still refuses a negative opening on anything but a credit card', async () => {
    const result = await call(() => create('Overdrawn', 'SAVINGS', -10));
    expect(result.success).toBe(false);
    expect(state().wallets.some((w) => w.name === 'Overdrawn')).toBe(false);
  });

  it('keeps the opening row reversible like any other adjustment', async () => {
    await call(() => create('Rainy Day', 'SAVINGS', 1000));
    const created = walletNamed('Rainy Day');
    await call(() => actions().softDeleteTransaction(rowsFor(created.id)[0].id));
    expect(walletNamed('Rainy Day').balance).toBe(0);
  });
});

describe('a guest CSV repayment names its debt (F8, ADR 0024)', () => {
  const repayRow = (rowIndex: number, amount: number) => ({
    rowIndex,
    date: TODAY,
    walletName: 'Savings Reserve',
    amount,
    type: 'DEBT_REPAYMENT' as const,
    description: 'Loan payment',
    debtName: 'Student Loan',
    debtId: DEBT,
    isValid: true,
  });

  it('decrements the debt it names, once per row', async () => {
    const result = await call(() => actions().commitBulkImport([repayRow(1, 1000), repayRow(2, 500)]));
    expect(result).toMatchObject({ success: true, insertedCount: 2 });
    expect(debt().remainingAmount).toBe(DEBT_REMAINING - 1500);
    expect(state().transactions.every((t) => t.debtId === DEBT)).toBe(true);
  });

  it('refuses a batch whose repayments together overpay the debt, moving nothing', async () => {
    const result = await call(() => actions().commitBulkImport([repayRow(1, 3000), repayRow(2, 3000)]));
    expect(result.success).toBe(false);
    expect(debt().remainingAmount).toBe(DEBT_REMAINING);
    expect(wallet(WALLET_SAVINGS).balance).toBe(SAVINGS_OPENING);
    expect(state().transactions).toHaveLength(0);
  });
});

// Phase 109 (ADR 0085, audit finding 3): an expense or an income is filed
// under a category of its own type, so it counts where it should (L1).
describe('a category of another type is refused (ADR 0085)', () => {
  const add = (type: 'EXPENSE' | 'INCOME', categoryId: string, idempotencyKey?: string) =>
    actions().addTransaction({
      amount: 60, type, categoryId, walletId: WALLET_MAIN, description: 'Lunch', transactionDate: TODAY, idempotencyKey,
    });

  it.each([
    ['EXPENSE', 'cat-adjust', "An expense can't be filed under Balance Adjustment"],
    ['EXPENSE', 'cat-debt', "An expense can't be filed under Debt Repayment"],
    ['EXPENSE', 'cat-salary', "An expense can't be filed under Primary Salary"],
    ['INCOME', 'cat-adjust', "Income can't be filed under Balance Adjustment"],
    ['INCOME', 'cat-food', "Income can't be filed under Food & Dining"],
  ] as const)('%s under %s moves nothing and says why', async (type, categoryId, error) => {
    const result = await call(() => add(type, categoryId));
    expect(result).toEqual({ success: false, error });
    expect(state().transactions).toHaveLength(0);
    expect(wallet(WALLET_MAIN).balance).toBe(2500);
  });

  it('accepts a category of its own type, and a refusal leaks no key', async () => {
    expect((await call(() => add('EXPENSE', 'cat-adjust', 'key-1'))).success).toBe(false);
    const result = await call(() => add('EXPENSE', 'cat-food', 'key-1'));
    expect(result.success).toBe(true);
    expect(wallet(WALLET_MAIN).balance).toBe(2440);
    await tick();
    expect((await call(() => add('INCOME', 'cat-salary'))).success).toBe(true);
  });

  it('leaves a balance adjustment and a repayment on their own categories alone', async () => {
    const adjust = await call(() =>
      actions().addTransaction({ amount: -40, type: 'ADJUSTMENT', categoryId: 'cat-adjust', walletId: WALLET_MAIN, description: 'Fix', transactionDate: TODAY }),
    );
    expect(adjust.success).toBe(true);
    await tick();
    expect((await call(() => repay({ categoryId: 'cat-debt' }))).success).toBe(true);
  });
});

describe('a CSV row keeps only a category of its own type (ADR 0085)', () => {
  const row = (rowIndex: number, type: 'EXPENSE' | 'INCOME', category: { categoryName?: string; categoryId?: string }) => ({
    rowIndex, date: TODAY, walletName: 'Main Checking', amount: 10, type, description: `row ${rowIndex}`, isValid: true, ...category,
  });

  it('imports a row named or picked under another type uncategorized, and keeps a matching one', async () => {
    const result = await call(() =>
      actions().commitBulkImport([
        row(1, 'EXPENSE', { categoryName: 'Balance Adjustment' }),
        row(2, 'EXPENSE', { categoryId: 'cat-salary' }),
        row(3, 'INCOME', { categoryName: 'Groceries' }),
        row(4, 'EXPENSE', { categoryName: 'food & dining' }),
        row(5, 'INCOME', { categoryId: 'cat-freelance' }),
      ]),
    );
    expect(result).toMatchObject({ success: true, insertedCount: 5 });
    const byNote = (n: number) => state().transactions.find((t) => t.description === `row ${n}`)!;
    expect([1, 2, 3].map((n) => byNote(n).categoryId)).toEqual([undefined, undefined, undefined]);
    expect(byNote(4).categoryId).toBe('cat-food');
    expect(byNote(5).categoryId).toBe('cat-freelance');
  });
});
