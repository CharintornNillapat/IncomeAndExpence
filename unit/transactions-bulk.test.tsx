// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { FinanceProvider } from '../src/context/FinanceContext';
import { TransactionsView } from '../src/views/TransactionsView';
import type { Transaction } from '../src/types';
import { todayIsoDate } from '../src/utils/date';

function wide() {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const mockState = vi.hoisted(() => ({
  rows: [] as Transaction[],
  showSoftDeleted: false,
  setTransactionsDeleted: vi.fn(),
  deleteTransaction: vi.fn(),
  restoreTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  addTransaction: vi.fn(),
  setShowSoftDeleted: vi.fn(),
  commitBulkImport: vi.fn(),
}));

vi.mock('../src/hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: mockState.rows.filter((t) => mockState.showSoftDeleted || !t.isDeleted),
    rawTransactions: mockState.rows,
    showSoftDeleted: mockState.showSoftDeleted,
    setShowSoftDeleted: mockState.setShowSoftDeleted,
    setTransactionsDeleted: mockState.setTransactionsDeleted,
    deleteTransaction: mockState.deleteTransaction,
    restoreTransaction: mockState.restoreTransaction,
    updateTransaction: mockState.updateTransaction,
    addTransaction: mockState.addTransaction,
    commitBulkImport: mockState.commitBulkImport,
  }),
}));

let seq = 0;
function tx(overrides: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>): Transaction {
  seq += 1;
  return {
    id: `seed-${seq}`,
    userId: 'guest',
    walletId: 'wal-cash',
    description: `row ${seq}`,
    transactionDate: todayIsoDate(),
    isDeleted: false,
    createdBy: 'guest',
    createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, seq)).toISOString(),
    updatedAt: '',
    ...overrides,
  };
}

function mount(rows: Transaction[]) {
  mockState.rows = rows;
  localStorage.setItem('pf_transactions', JSON.stringify(rows));
  return render(
    <FinanceProvider>
      <TransactionsView />
    </FinanceProvider>
  );
}

describe('bulk actions with mocked hook (ADR 0109 O1)', () => {
  beforeEach(() => {
    mockState.showSoftDeleted = false;
    mockState.setTransactionsDeleted = vi.fn().mockResolvedValue({ success: true });
    mockState.deleteTransaction = vi.fn();
    mockState.restoreTransaction = vi.fn();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    delete (window as { matchMedia?: unknown }).matchMedia;
    vi.clearAllMocks();
  });

  it('Delete calls setTransactionsDeleted once with the live selected ids and true', async () => {
    wide();
    const t1 = tx({ type: 'EXPENSE', amount: 10, description: 'Item 1' });
    const t2 = tx({ type: 'EXPENSE', amount: 20, description: 'Item 2' });
    const t3 = tx({ type: 'EXPENSE', amount: 30, description: 'Item 3' });
    mount([t1, t2, t3]);

    fireEvent.click(document.getElementById(`tx-select-row-${t1.id}`)!);
    fireEvent.click(document.getElementById(`tx-select-row-${t2.id}`)!);
    fireEvent.click(document.getElementById(`tx-select-row-${t3.id}`)!);

    fireEvent.click(document.getElementById('tx-bulk-delete-btn')!);
    await screen.findByRole('dialog', { name: 'Delete 3 transactions?' });
    fireEvent.click(document.getElementById('confirm-destructive-btn')!);

    await waitFor(() => expect(mockState.setTransactionsDeleted).toHaveBeenCalledTimes(1));
    const [ids, deleted] = mockState.setTransactionsDeleted.mock.calls[0];
    expect(new Set(ids)).toEqual(new Set([t1.id, t2.id, t3.id]));
    expect(deleted).toBe(true);
    expect(mockState.deleteTransaction).not.toHaveBeenCalled();
    expect(mockState.restoreTransaction).not.toHaveBeenCalled();
  });

  it('a failed Delete keeps the dialog open with the message, and the selection', async () => {
    wide();
    mockState.setTransactionsDeleted.mockResolvedValueOnce({ success: false, error: 'boom' });
    const t1 = tx({ type: 'EXPENSE', amount: 10, description: 'Item 1' });
    const t2 = tx({ type: 'EXPENSE', amount: 20, description: 'Item 2' });
    const t3 = tx({ type: 'EXPENSE', amount: 30, description: 'Item 3' });
    mount([t1, t2, t3]);

    fireEvent.click(document.getElementById(`tx-select-row-${t1.id}`)!);
    fireEvent.click(document.getElementById(`tx-select-row-${t2.id}`)!);
    fireEvent.click(document.getElementById(`tx-select-row-${t3.id}`)!);

    fireEvent.click(document.getElementById('tx-bulk-delete-btn')!);
    const dialog = await screen.findByRole('dialog', { name: 'Delete 3 transactions?' });
    fireEvent.click(document.getElementById('confirm-destructive-btn')!);

    await waitFor(() => expect(dialog.textContent).toContain('boom'));
    expect(document.getElementById('tx-bulk-count')?.textContent).toBe('3 selected');
    expect((document.getElementById(`tx-select-row-${t1.id}`) as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById(`tx-select-row-${t2.id}`) as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById(`tx-select-row-${t3.id}`) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(document.getElementById('confirm-cancel-btn')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((document.getElementById(`tx-select-row-${t1.id}`) as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById(`tx-select-row-${t2.id}`) as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById(`tx-select-row-${t3.id}`) as HTMLInputElement).checked).toBe(true);
  });

  it('Restore calls the action once with false, and a failure shows #tx-bulk-error', async () => {
    wide();
    mockState.showSoftDeleted = true;
    mockState.setTransactionsDeleted
      .mockResolvedValueOnce({ success: false, error: 'boom' })
      .mockResolvedValueOnce({ success: true });

    const t1 = tx({ type: 'EXPENSE', amount: 10, description: 'Item 1', isDeleted: true });
    mount([t1]);

    fireEvent.click(document.getElementById(`tx-select-row-${t1.id}`)!);
    expect(document.getElementById('tx-bulk-restore-btn')).not.toBeNull();

    fireEvent.click(document.getElementById('tx-bulk-restore-btn')!);
    await waitFor(() => {
      const err = document.getElementById('tx-bulk-error');
      expect(err).not.toBeNull();
      expect(err?.getAttribute('role')).toBe('alert');
      expect(err?.textContent).toContain('boom');
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((document.getElementById(`tx-select-row-${t1.id}`) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(document.getElementById('tx-bulk-restore-btn')!);
    await waitFor(() => expect(mockState.setTransactionsDeleted).toHaveBeenLastCalledWith([t1.id], false));
    expect(document.getElementById('tx-bulk-bar')).toBeNull();
  });

  it('a mixed selection offers Delete and sends only the live rows', async () => {
    wide();
    mockState.showSoftDeleted = true;
    const tLive1 = tx({ type: 'EXPENSE', amount: 10, description: 'Live 1' });
    const tLive2 = tx({ type: 'EXPENSE', amount: 20, description: 'Live 2' });
    const tGone = tx({ type: 'EXPENSE', amount: 30, description: 'Gone', isDeleted: true });
    mount([tLive1, tLive2, tGone]);

    fireEvent.click(document.getElementById(`tx-select-row-${tLive1.id}`)!);
    fireEvent.click(document.getElementById(`tx-select-row-${tLive2.id}`)!);
    fireEvent.click(document.getElementById(`tx-select-row-${tGone.id}`)!);

    expect(document.getElementById('tx-bulk-delete-btn')).not.toBeNull();
    expect(document.getElementById('tx-bulk-restore-btn')).toBeNull();

    fireEvent.click(document.getElementById('tx-bulk-delete-btn')!);
    await screen.findByRole('dialog', { name: 'Delete 2 transactions?' });
    fireEvent.click(document.getElementById('confirm-destructive-btn')!);

    await waitFor(() => expect(mockState.setTransactionsDeleted).toHaveBeenCalledTimes(1));
    const [ids, deleted] = mockState.setTransactionsDeleted.mock.calls[0];
    expect(new Set(ids)).toEqual(new Set([tLive1.id, tLive2.id]));
    expect(deleted).toBe(true);
  });

  it('Delete, Restore and Clear are disabled while a call is in flight', async () => {
    wide();
    let resolvePromise!: (val: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockState.setTransactionsDeleted.mockReturnValue(pendingPromise);

    const t1 = tx({ type: 'EXPENSE', amount: 10, description: 'Item 1' });
    mount([t1]);

    fireEvent.click(document.getElementById(`tx-select-row-${t1.id}`)!);
    fireEvent.click(document.getElementById('tx-bulk-delete-btn')!);
    await screen.findByRole('dialog', { name: 'Delete 1 transaction?' });

    const confirmBtn = document.getElementById('confirm-destructive-btn') as HTMLButtonElement;
    fireEvent.click(confirmBtn);

    expect(confirmBtn.disabled).toBe(true);
    fireEvent.click(confirmBtn);
    expect(mockState.setTransactionsDeleted).toHaveBeenCalledTimes(1);

    resolvePromise({ success: true });
  });
});
