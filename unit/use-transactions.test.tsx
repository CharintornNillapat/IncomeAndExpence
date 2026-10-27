// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { FinanceProvider } from '../src/context/FinanceContext';
import { useTransactions } from '../src/hooks/useTransactions';
import type { Transaction } from '../src/types';

const ROWS: Transaction[] = [
  {
    id: 'tx-live',
    userId: 'guest',
    walletId: 'wal-main-checking',
    amount: 100,
    type: 'EXPENSE',
    description: 'Live transaction',
    transactionDate: '2026-09-15',
    isDeleted: false,
    createdBy: 'guest',
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '',
  },
  {
    id: 'tx-gone',
    userId: 'guest',
    walletId: 'wal-main-checking',
    amount: 50,
    type: 'EXPENSE',
    description: 'Deleted transaction',
    transactionDate: '2026-09-15',
    isDeleted: true,
    createdBy: 'guest',
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '',
  },
];

describe('useTransactions includeDeleted option (CS-01)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('pf_transactions', JSON.stringify(ROWS));
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <FinanceProvider>{children}</FinanceProvider>
  );

  it('includeDeleted: true returns soft-deleted rows while showSoftDeleted is off', () => {
    const { result } = renderHook(() => useTransactions({ includeDeleted: true }), { wrapper });
    expect(result.current.showSoftDeleted).toBe(false);
    const ids = result.current.transactions.map((tx) => tx.id);
    expect(ids).toContain('tx-live');
    expect(ids).toContain('tx-gone');
  });

  it('with no option the toggle decides', () => {
    const { result } = renderHook(() => useTransactions(), { wrapper });
    const idsBefore = result.current.transactions.map((tx) => tx.id);
    expect(idsBefore).toEqual(['tx-live']);

    act(() => {
      result.current.setShowSoftDeleted(true);
    });

    const idsAfter = result.current.transactions.map((tx) => tx.id);
    expect(idsAfter).toContain('tx-live');
    expect(idsAfter).toContain('tx-gone');
  });

  it('exposes setTransactionsDeleted and deletes several rows in one call', async () => {
    const secondLive: Transaction = {
      ...ROWS[0],
      id: 'tx-live-2',
      description: 'Second live',
    };
    localStorage.setItem('pf_transactions', JSON.stringify([ROWS[0], secondLive]));

    const { result } = renderHook(() => useTransactions(), { wrapper });
    expect(result.current.transactions.map((t) => t.id)).toEqual(['tx-live', 'tx-live-2']);

    let callResult: any;
    await act(async () => {
      callResult = await result.current.setTransactionsDeleted(['tx-live', 'tx-live-2'], true);
    });

    expect(callResult).toEqual({ success: true });
    expect(result.current.transactions).toHaveLength(0);
  });
});
