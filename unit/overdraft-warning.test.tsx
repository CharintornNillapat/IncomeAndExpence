// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { TransactionForm } from '../src/components/TransactionForm';
import { WalletTransferForm } from '../src/components/wallet/WalletTransferForm';
import { FinanceProvider } from '../src/context/FinanceContext';
import { overdraftBy } from '../src/selectors/wallets';
import type { Category, Wallet } from '../src/types';

/**
 * Phase 109 (ADR 0085, audit findings 4 and 11). Money leaving a wallet that
 * is not a credit card warns when it takes the wallet below zero, in the
 * entry form as the transfer form already did; it never blocks (ADR 0014).
 * A credit card owes by design, so it is never overdrawn. In Income mode the
 * wallet field is the one that receives the money.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const wallet = (id: string, name: string, type: Wallet['type'], balance: number): Wallet => ({
  id, userId: 'guest', name, type, balance, currency: 'THB', color: '#5CC8B8', icon: 'x',
  isArchived: false, isDeleted: false, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '',
});
const CASH = wallet('wal-cash', 'Cash', 'CASH', 500);
const CARD = wallet('wal-card', 'Card', 'CREDIT_CARD', -100);
const FOOD: Category = { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'x', color: '#E879A6', isSystem: true, isDeleted: false };
const PAY: Category = { id: 'cat-salary', name: 'Primary Salary', type: 'INCOME', icon: 'x', color: '#8FA8C8', isSystem: true, isDeleted: false };

describe('overdraftBy', () => {
  it('is how far below zero a wallet goes, and 0 for a credit card or at zero', () => {
    expect(overdraftBy(CASH, -50.25)).toBe(50.25);
    expect(overdraftBy(CASH, 0)).toBe(0);
    expect(overdraftBy(CASH, 10)).toBe(0);
    expect(overdraftBy(CARD, -900)).toBe(0);
  });
});

describe('the entry form', () => {
  function mountForm() {
    render(
      <FinanceProvider>
        <TransactionForm idPrefix="t" wallets={[CASH, CARD]} categories={[FOOD, PAY]} onSubmitTransaction={vi.fn(async () => ({ success: true }))} />
      </FinanceProvider>,
    );
    const note = (value: string) => fireEvent.change(document.querySelector('[id$="-desc"]')!, { target: { value } });
    const warning = () => screen.queryByTestId('t-overdraft-warning');
    const submit = document.getElementById('confirm-t-btn') as HTMLButtonElement;
    return { note, warning, submit };
  }

  it('warns when an expense takes the wallet below zero, and still lets it be saved', () => {
    const { note, warning, submit } = mountForm();
    note('lunch 500');
    expect(warning()).toBeNull();
    note('lunch 600.5');
    expect(warning()!.textContent).toBe('This overdraws Cash by ฿100.50.');
    expect(submit.disabled).toBe(false);
  });

  it('does not warn for a credit card, or for income', () => {
    const { note, warning } = mountForm();
    note('lunch 600');
    fireEvent.change(document.getElementById('t-wallet-select')!, { target: { value: 'wal-card' } });
    expect(warning()).toBeNull();

    fireEvent.change(document.getElementById('t-wallet-select')!, { target: { value: 'wal-cash' } });
    expect(warning()).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Income' }));
    expect(warning()).toBeNull();
  });

  it('names the wallet field for the way the money goes (finding 11)', () => {
    mountForm();
    expect(screen.getByLabelText('Paying Wallet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Income' }));
    expect(screen.getByLabelText('Receiving Wallet')).toBeTruthy();
    expect(screen.queryByLabelText('Paying Wallet')).toBeNull();
  });
});

describe('the transfer form', () => {
  const ids = { source: 'src', dest: 'dst', amount: 'xfer-amt', note: 'note', submit: 'xfer-submit', swap: 'swap', transferAll: 'xfer-all' };

  it('warns for a cash source going below zero, and not for a credit card', () => {
    render(
      <FinanceProvider>
        <WalletTransferForm wallets={[CASH, CARD]} ids={ids} tone="plain" onTransferred={() => {}} />
      </FinanceProvider>,
    );
    fireEvent.change(document.getElementById('src')!, { target: { value: 'wal-cash' } });
    fireEvent.change(document.getElementById('xfer-amt')!, { target: { value: '700' } });
    expect(screen.getByTestId('transfer-overdraft-warning').textContent).toBe('This overdraws Cash by ฿200.00.');

    fireEvent.change(document.getElementById('src')!, { target: { value: 'wal-card' } });
    expect((document.getElementById('src') as HTMLSelectElement).value).toBe('wal-card');
    expect(screen.queryByTestId('transfer-overdraft-warning')).toBeNull();
  });
});
