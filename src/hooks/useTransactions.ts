import { useMemo, useCallback } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Transaction, TransactionType } from '../types';

export interface UseTransactionsFilterOptions {
  includeDeleted?: boolean;
  walletId?: string;
  categoryId?: string;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

export const useTransactions = (options: UseTransactionsFilterOptions = {}) => {
  const {
    transactions,
    addTransaction,
    softDeleteTransaction,
    restoreTransaction,
    commitBulkImport,
    showSoftDeleted,
    setShowSoftDeleted,
    isSyncing,
  } = useFinance();

  const {
    includeDeleted = showSoftDeleted,
    walletId,
    categoryId,
    type,
    startDate,
    endDate,
    searchQuery,
  } = options;

  // Memoized filtered transactions list
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Soft-deletion check
      if (!includeDeleted && tx.isDeleted) return false;
      if (includeDeleted && !showSoftDeleted && tx.isDeleted) return false;

      // Wallet filter
      if (walletId && tx.walletId !== walletId && tx.destinationWalletId !== walletId) {
        return false;
      }

      // Category filter
      if (categoryId && tx.categoryId !== categoryId) {
        return false;
      }

      // Transaction Type filter
      if (type && tx.type !== type) {
        return false;
      }

      // Date range filter
      if (startDate && tx.transactionDate < startDate) {
        return false;
      }
      if (endDate && tx.transactionDate > endDate) {
        return false;
      }

      // Keyword / description search
      if (searchQuery && searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesDesc = tx.description.toLowerCase().includes(q);
        const matchesCategory = tx.categoryName?.toLowerCase().includes(q);
        const matchesWallet = tx.walletName?.toLowerCase().includes(q);
        if (!matchesDesc && !matchesCategory && !matchesWallet) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, includeDeleted, showSoftDeleted, walletId, categoryId, type, startDate, endDate, searchQuery]);

  // Aggregated Financial Metrics using useMemo
  const metrics = useMemo(() => {
    let totalExpense = 0;
    let totalIncome = 0;
    let totalTransfers = 0;
    let totalDebtRepayments = 0;

    const activeList = transactions.filter((tx) => !tx.isDeleted);

    for (const tx of activeList) {
      if (tx.type === 'EXPENSE') {
        totalExpense += tx.amount;
      } else if (tx.type === 'INCOME') {
        totalIncome += tx.amount;
      } else if (tx.type === 'TRANSFER') {
        totalTransfers += tx.amount;
      } else if (tx.type === 'DEBT_REPAYMENT') {
        totalDebtRepayments += tx.amount;
      }
    }

    const netCashflow = totalIncome - totalExpense;

    return {
      totalExpense,
      totalIncome,
      totalTransfers,
      totalDebtRepayments,
      netCashflow,
      count: activeList.length,
    };
  }, [transactions]);

  // Action handlers stabilized with useCallback
  const handleAdd = useCallback(
    async (params: {
      amount: number;
      rawInput?: string;
      description: string;
      walletId: string;
      destinationWalletId?: string;
      categoryId?: string;
      debtId?: string;
      type: TransactionType;
      transactionDate: string;
    }) => {
      return await addTransaction(params);
    },
    [addTransaction]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await softDeleteTransaction(id);
    },
    [softDeleteTransaction]
  );

  const handleRestore = useCallback(
    async (id: string) => {
      await restoreTransaction(id);
    },
    [restoreTransaction]
  );

  return {
    transactions: filteredTransactions,
    rawTransactions: transactions,
    metrics,
    isSyncing,
    showSoftDeleted,
    setShowSoftDeleted,
    addTransaction: handleAdd,
    deleteTransaction: handleDelete,
    restoreTransaction: handleRestore,
    commitBulkImport,
  };
};
