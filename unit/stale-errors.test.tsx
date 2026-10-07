// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react';
import { TransactionForm } from '../src/components/TransactionForm';
import { WalletTransferForm } from '../src/components/wallet/WalletTransferForm';
import { FinanceProvider } from '../src/context/FinanceContext';
import type { Category, Wallet } from '../src/types';

/**
 * Phase 110 (ADR 0086, audit finding 10): a refused save's message is about
 * the amount that was sent. Once the person edits the amount it no longer
 * describes anything on screen, so it goes.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const wallet = (id: string, name: string, balance: number): Wallet => ({
  id, userId: 'guest', name, type: 'CASH', balance, currency: 'THB', color: '#5CC8B8', icon: 'x',
  isArchived: false, isDeleted: false, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '',
});
const FOOD: Category = { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'x', color: '#E879A6', isSystem: true, isDeleted: false };
const REFUSED = "Amount can't be over ฿999,999,999.99";

describe('the entry form', () => {
  it("drops a refused save's message when the amount is edited, and keeps it until then", async () => {
    const onSubmit = vi.fn(async () => ({ success: false, error: REFUSED }));
    render(
      <FinanceProvider>
        <TransactionForm idPrefix="t" wallets={[wallet('wal-cash', 'Cash', 500)]} categories={[FOOD]} onSubmitTransaction={onSubmit} />
      </FinanceProvider>,
    );
    const amount = document.getElementById('t-amount-math')!;
    fireEvent.change(amount, { target: { value: '60' } });
    await act(async () => {
      fireEvent.click(document.getElementById('confirm-t-btn')!);
    });
    expect(screen.getByText(REFUSED)).toBeTruthy();

    // Editing the note leaves it: the note did not cause it.
    fireEvent.change(document.querySelector('[id$="-desc"]')!, { target: { value: 'lunch' } });
    expect(screen.getByText(REFUSED)).toBeTruthy();

    fireEvent.change(amount, { target: { value: '65' } });
    expect(screen.queryByText(REFUSED)).toBeNull();
  });
});

describe('the transfer form', () => {
  it("drops a refused transfer's message when the amount is edited", async () => {
    // Wallets the provider does not hold, so `addTransaction` refuses the transfer.
    render(
      <FinanceProvider>
        <WalletTransferForm
          wallets={[wallet('wal-a', 'A', 500), wallet('wal-b', 'B', 0)]}
          ids={{ source: 'src', dest: 'dst', amount: 'xfer-amt', note: 'note', submit: 'xfer-submit', swap: 'swap', transferAll: 'xfer-all' }}
          tone="plain"
          onTransferred={() => {}}
        />
      </FinanceProvider>,
    );
    fireEvent.change(document.getElementById('xfer-amt')!, { target: { value: '100' } });
    await act(async () => {
      fireEvent.click(document.getElementById('xfer-submit')!);
    });
    const refusal = 'Source wallet not found or has been deleted';
    expect(screen.getByText(refusal)).toBeTruthy();

    fireEvent.change(document.getElementById('xfer-amt')!, { target: { value: '90' } });
    expect(screen.queryByText(refusal)).toBeNull();
  });
});
