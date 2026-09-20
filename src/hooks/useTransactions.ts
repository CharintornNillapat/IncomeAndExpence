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
    showSoftDeleted,
  } = useFinanceState();
  const {
    addTransaction,
    softDeleteTransaction,
    restoreTransaction,
    commitBulkImport,
    setShowSoftDeleted,
  } = useFinanceActions();

  const {
    includeDeleted = showSoftDeleted,
    walletId,
    categoryId,
    type,
    startDate,
    endDate,
    searchQuery,
  } = options;

  const trimmedQuery = (searchQuery ?? '').trim().toLowerCase();
  const hasSearchQuery = trimmedQuery.length > 0;

  // Name lookups: Transaction only stores ids, so resolve display names from the
  // wallet / category collections for keyword search. Built only while a search
  // is active, and rebuilt only when the underlying collection changes or a
  // search starts/stops - not on every keystroke. Before this split these were
  // unconditional and keyed on the whole `wallets`/`categories` arrays, so any
  // wallet BALANCE change (which allocates a new `wallets` array) invalidated
  // them and forced a full re-filter of the ledger below even when nobody was
  // searching.
  const walletNameMap = useMemo(() => {
    if (!hasSearchQuery) return null;
    return new Map(wallets.map((w) => [w.id, w.name.toLowerCase()]));
  }, [wallets, hasSearchQuery]);

  const categoryNameMap = useMemo(() => {
    if (!hasSearchQuery) return null;
    return new Map(categories.map((c) => [c.id, c.name.toLowerCase()]));
  }, [categories, hasSearchQuery]);

  // Stage 1: every non-search predicate. No dependency on `wallets` or
  // `categories`, so a wallet balance change no longer invalidates this memo.
  const baseFilteredTransactions = useMemo(() => {
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

      return true;
    });
  }, [transactions, includeDeleted, showSoftDeleted, walletId, categoryId, type, startDate, endDate]);

  // Stage 2: keyword search over Stage 1's result. Matches across all five
  // user-visible fields: the description, the raw amount, the original
  // calculation input, and the resolved category / wallet names. Returns
  // Stage 1 BY REFERENCE when no search is active - the default in every
  // view - so a wallet balance change costs an O(1) identity return instead
  // of a second pass over the ledger.
  const filteredTransactions = useMemo(() => {
    if (!hasSearchQuery || !walletNameMap || !categoryNameMap) {
      return baseFilteredTransactions;
    }

    return baseFilteredTransactions.filter((tx) => {
      const categoryName = tx.categoryId ? categoryNameMap.get(tx.categoryId) : undefined;
      const sourceWalletName = walletNameMap.get(tx.walletId);
      const destWalletName = tx.destinationWalletId
        ? walletNameMap.get(tx.destinationWalletId)
        : undefined;

      const matchesDesc = tx.description.toLowerCase().includes(trimmedQuery);
      const matchesAmount = tx.amount.toString().includes(trimmedQuery);
      const matchesRaw = tx.rawInput?.toLowerCase().includes(trimmedQuery) ?? false;
      const matchesCategory = categoryName?.includes(trimmedQuery) ?? false;
      const matchesWallet =
        (sourceWalletName?.includes(trimmedQuery) ?? false) || (destWalletName?.includes(trimmedQuery) ?? false);

      return matchesDesc || matchesAmount || matchesRaw || matchesCategory || matchesWallet;
    });
  }, [baseFilteredTransactions, hasSearchQuery, trimmedQuery, walletNameMap, categoryNameMap]);

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
      return await softDeleteTransaction(id);
    },
    [softDeleteTransaction]
  );

  const handleRestore = useCallback(
    async (id: string) => {
      return await restoreTransaction(id);
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
