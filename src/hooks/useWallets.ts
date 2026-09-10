import { useMemo, useCallback } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Wallet, WalletType } from '../types';

export const useWallets = () => {
  const {
    wallets,
    totalNetWorth,
    addWallet,
    updateWallet,
    deleteWallet,
    isSyncing,
  } = useFinance();

  // Filter active wallets
  const activeWallets = useMemo(() => {
    return wallets.filter((w) => !w.isDeleted);
  }, [wallets]);

  // Grouped by type
  const walletsByType = useMemo(() => {
    const grouped: Record<WalletType, Wallet[]> = {
      BANK_ACCOUNT: [],
      CASH: [],
      SAVINGS: [],
      CREDIT_CARD: [],
      INVESTMENT: [],
      E_WALLET: [],
    };

    for (const w of activeWallets) {
      if (grouped[w.type]) {
        grouped[w.type].push(w);
      }
    }

    return grouped;
  }, [activeWallets]);

  const handleAddWallet = useCallback(
    async (
      wallet: Omit<Wallet, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isArchived' | 'isDeleted' | 'balance'>,
      initialBalance: number
    ) => {
      return await addWallet(wallet, initialBalance);
    },
    [addWallet]
  );

  const handleUpdateWallet = useCallback(
    async (id: string, updates: Partial<Wallet>) => {
      await updateWallet(id, updates);
    },
    [updateWallet]
  );

  const handleDeleteWallet = useCallback(
    async (id: string) => {
      await deleteWallet(id);
    },
    [deleteWallet]
  );

  return {
    wallets: activeWallets,
    allWallets: wallets,
    totalNetWorth,
    walletsByType,
    isSyncing,
    addWallet: handleAddWallet,
    updateWallet: handleUpdateWallet,
    deleteWallet: handleDeleteWallet,
  };
};
