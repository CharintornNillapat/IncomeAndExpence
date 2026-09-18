import { useMemo, useCallback } from 'react';
import { useFinanceState, useFinanceActions } from '../context/FinanceContext';
import { TransactionType } from '../types';

interface UseTransactionsFilterOptions {
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
    wallets,
    categories,
    addTransaction,
    softDeleteTransaction,
    restoreTransaction,
    commitBulkImport,
    showSoftDeleted,
  } = useFinanceState();
  const { setShowSoftDeleted } = useFinanceActions();

  const {
    includeDeleted = showSoftDeleted,
    walletId,
    categoryId,
    type,
    startDate,
    endDate,
    searchQuery,
  } = options;

  // Name lookups: Transaction only stores ids, so resolve display names from the
  // wallet / category collections for keyword search.
  const walletNameMap = useMemo(
    () => new Map(wallets.map((w) => [w.id, w.name.toLowerCase()])),
    [wallets]
  );

  const categoryNameMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name.toLowerCase()])),
    [categories]
  );

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

      // Keyword search. Matches across all five user-visible fields: the
      // description, the raw amount, the original calculation input, and the
      // resolved category / wallet names.
      if (searchQuery && searchQuery.trim().length > 0) {
        const q = searchQuery.trim().toLowerCase();
        const categoryName = tx.categoryId ? categoryNameMap.get(tx.categoryId) : undefined;
        const sourceWalletName = walletNameMap.get(tx.walletId);
        const destWalletName = tx.destinationWalletId
          ? walletNameMap.get(tx.destinationWalletId)
          : undefined;

        const matchesDesc = tx.description.toLowerCase().includes(q);
        const matchesAmount = tx.amount.toString().includes(q);
        const matchesRaw = tx.rawInput?.toLowerCase().includes(q) ?? false;
        const matchesCategory = categoryName?.includes(q) ?? false;
        const matchesWallet =
          (sourceWalletName?.includes(q) ?? false) || (destWalletName?.includes(q) ?? false);

        if (!matchesDesc && !matchesAmount && !matchesRaw && !matchesCategory && !matchesWallet) {
          return false;
        }
      }

      return true;
    });
  }, [
    transactions,
    includeDeleted,
    showSoftDeleted,
    walletId,
    categoryId,
    type,
    startDate,
    endDate,
    searchQuery,
    walletNameMap,
    categoryNameMap,
  ]);

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
      idempotencyKey?: string;
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
    showSoftDeleted,
    setShowSoftDeleted,
    addTransaction: handleAdd,
    deleteTransaction: handleDelete,
    restoreTransaction: handleRestore,
    commitBulkImport,
  };
};
