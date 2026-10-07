// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act, screen } from '@testing-library/react';
import { TransactionForm } from '../src/components/TransactionForm';
import { FinanceProvider } from '../src/context/FinanceContext';
import type { Category, TransactionType, Wallet } from '../src/types';

/**
 * Phase 108 (ADR 0084, audit finding 1 and 3): the Category select offers only
 * the categories of the entry's own type, and starts on the first of them.
 *
 * A signed-in account loads its categories ordered by name, so the list began
 * with "Balance Adjustment". The form defaulted to `categories[0]`, and an
 * expense saved without touching the field was filed under it, which leaves
 * it out of every spending figure (L1) and the monthly insights.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const cat = (id: string, name: string, type: TransactionType): Category => ({
  id, name, type, icon: 'x', color: '#888888', isSystem: true, isDeleted: false,
});

// The signed-in order: `.order('name')`.
const BY_NAME: Category[] = [
  cat('adjust', 'Balance Adjustment', 'ADJUSTMENT'),
  cat('debt', 'Debt Repayment', 'DEBT_REPAYMENT'),
  cat('food', 'Food & Dining', 'EXPENSE'),
  cat('freelance', 'Freelance & Side Gig', 'INCOME'),
  cat('groceries', 'Groceries', 'EXPENSE'),
  cat('salary', 'Primary Salary', 'INCOME'),
];

const CASH: Wallet = {
  id: 'wal-cash', userId: 'guest', name: 'Cash', type: 'CASH', balance: 500, currency: 'THB',
  color: '#5CC8B8', icon: 'x', isArchived: false, isDeleted: false, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
};

function mountForm() {
  const onSubmit = vi.fn(async () => ({ success: true }));
  render(
    <FinanceProvider>
      <TransactionForm idPrefix="t" wallets={[CASH]} categories={BY_NAME} onSubmitTransaction={onSubmit} />
    </FinanceProvider>,
  );
  const select = document.querySelector<HTMLSelectElement>('select[id$="-category"]')!;
  const options = () => Array.from(select.options).map((o) => o.textContent);
  const save = async (note: string) => {
    fireEvent.change(document.querySelector('[id$="-desc"]')!, { target: { value: note } });
    await act(async () => {
      fireEvent.click(document.getElementById('confirm-t-btn')!);
    });
  };
  const toggle = (name: 'Expense' | 'Income') => fireEvent.click(screen.getByRole('button', { name }));
  return { select, options, save, toggle, onSubmit };
}

describe('the Category select follows the entry type', () => {
  it('an expense lists expense categories only and starts on the first, never a system one', async () => {
    const { select, options, save, onSubmit } = mountForm();
    expect(options()).toEqual(['Food & Dining', 'Groceries']);
    expect(select.value).toBe('food');

    await save('something new 60');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: 'EXPENSE', categoryId: 'food' }));
  });

  it('switching to Income lists income categories and moves to the first of them', async () => {
    const { select, options, save, toggle, onSubmit } = mountForm();
    toggle('Income');
    expect(options()).toEqual(['Freelance & Side Gig', 'Primary Salary']);
    expect(select.value).toBe('freelance');

    await save('paid 900');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: 'INCOME', categoryId: 'freelance' }));
  });

  it('switching back to Expense returns to the expense category picked before', () => {
    const { select, toggle } = mountForm();
    fireEvent.change(select, { target: { value: 'groceries' } });
    toggle('Income');
    expect(select.value).toBe('freelance');
    toggle('Expense');
    expect(select.value).toBe('groceries');
  });
});
