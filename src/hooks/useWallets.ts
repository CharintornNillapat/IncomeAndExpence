import { useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';

export const useWallets = () => {
  const { wallets, totalNetWorth } = useFinance();

  // Filter active wallets
  const activeWallets = useMemo(() => {
    return wallets.filter((w) => !w.isDeleted);
  }, [wallets]);

  return {
    wallets: activeWallets,
    allWallets: wallets,
    totalNetWorth,
  };
};
