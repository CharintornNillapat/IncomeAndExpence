import { useMemo } from 'react';
import { useFinanceState } from '../context/FinanceContext';
import { activeWallets as selectActiveWallets } from '../selectors/wallets';

export const useWallets = () => {
  const { wallets, totalNetWorth } = useFinanceState();

  // Active means not deleted and not archived - the same predicate
  // `totalNetWorth` sums (ADR 0028). This list used to keep archived wallets,
  // so the hero's wallet count and the grid disagreed with the total.
  const activeWallets = useMemo(() => selectActiveWallets(wallets), [wallets]);

  return {
    wallets: activeWallets,
    allWallets: wallets,
    totalNetWorth,
  };
};
