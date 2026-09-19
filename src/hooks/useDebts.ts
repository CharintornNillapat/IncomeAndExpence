import { useMemo, useCallback } from 'react';
import { useFinanceState, useFinanceActions } from '../context/FinanceContext';
import { Debt } from '../types';

export const useDebts = () => {
  const {
    debts,
    wallets,
  } = useFinanceState();
  const {
    addDebt,
    settleDebt,
    deleteDebt,
    repayDebtAtomic,
  } = useFinanceActions();

  // Active (non-deleted) debts
  const activeDebts = useMemo(() => {
    return debts.filter((d) => !d.isDeleted);
  }, [debts]);

  // Active (non-deleted) wallets, matching `useWallets`' convention - a
  // soft-deleted wallet must never be selectable as a debt-repayment source.
  const activeWallets = useMemo(() => {
    return wallets.filter((w) => !w.isDeleted);
  }, [wallets]);

  // Settled vs Unsettled debts
  const unsettledDebts = useMemo(() => {
    return activeDebts.filter((d) => !d.isSettled);
  }, [activeDebts]);

  const settledDebts = useMemo(() => {
    return activeDebts.filter((d) => d.isSettled);
  }, [activeDebts]);

  // Aggregated Debt Metrics
  const debtMetrics = useMemo(() => {
    const totalTarget = activeDebts.reduce((sum, d) => sum + d.totalAmount, 0);
    const remainingTarget = activeDebts.reduce((sum, d) => sum + (d.isSettled ? 0 : d.remainingAmount), 0);
    const paidTarget = totalTarget - remainingTarget;
    // No debts tracked reads as 0% paid off, not 100%.
    const progressPercent = totalTarget > 0 ? (paidTarget / totalTarget) * 100 : 0;

    return {
      totalTarget,
      remainingTarget,
      paidTarget,
      progressPercent,
      activeCount: unsettledDebts.length,
    };
  }, [activeDebts, unsettledDebts]);

  // Stable action callbacks
  const handleAddDebt = useCallback(
    (debt: Omit<Debt, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isSettled' | 'isDeleted'>) => {
      return addDebt(debt);
    },
    [addDebt]
  );

  const handleRepayDebt = useCallback(
    (debtId: string, walletId: string, amount: number, note?: string) => {
      return repayDebtAtomic(debtId, walletId, amount, note);
    },
    [repayDebtAtomic]
  );

  const handleSettleDebt = useCallback(
    (debtId: string) => {
      settleDebt(debtId);
    },
    [settleDebt]
  );

  const handleDeleteDebt = useCallback(
    (debtId: string) => {
      deleteDebt(debtId);
    },
    [deleteDebt]
  );

  return {
    debts: activeDebts,
    unsettledDebts,
    settledDebts,
    wallets: activeWallets,
    allWallets: wallets,
    metrics: debtMetrics,
    addDebt: handleAddDebt,
    repayDebt: handleRepayDebt,
    settleDebt: handleSettleDebt,
    deleteDebt: handleDeleteDebt,
  };
};
