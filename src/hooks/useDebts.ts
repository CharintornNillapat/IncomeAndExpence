import { useMemo, useCallback } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Debt } from '../types';

export const useDebts = () => {
  const {
    debts,
    wallets,
    addDebt,
    repayDebtAtomic,
    settleDebt,
    deleteDebt,
    isSyncing,
  } = useFinance();

  // Active (non-deleted) debts
  const activeDebts = useMemo(() => {
    return debts.filter((d) => !d.isDeleted);
  }, [debts]);

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
    const progressPercent = totalTarget > 0 ? (paidTarget / totalTarget) * 100 : 100;
    const totalMinimumMonthly = unsettledDebts.reduce((sum, d) => sum + (d.minimumPayment || 0), 0);

    return {
      totalTarget,
      remainingTarget,
      paidTarget,
      progressPercent,
      totalMinimumMonthly,
      activeCount: unsettledDebts.length,
      settledCount: settledDebts.length,
    };
  }, [activeDebts, unsettledDebts, settledDebts]);

  // Stable action callbacks
  const handleAddDebt = useCallback(
    (debt: Omit<Debt, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isSettled' | 'isDeleted'>) => {
      addDebt(debt);
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
    allDebts: debts,
    unsettledDebts,
    settledDebts,
    wallets,
    metrics: debtMetrics,
    isSyncing,
    addDebt: handleAddDebt,
    repayDebt: handleRepayDebt,
    settleDebt: handleSettleDebt,
    deleteDebt: handleDeleteDebt,
  };
};
