import { useMemo, useCallback } from 'react';
import { useFinanceState, useFinanceActions } from '../context/FinanceContext';
import { Debt, DebtEdit } from '../types';
import { activeWallets as selectActiveWallets } from '../selectors/wallets';
import { payoffPercent, sortByDueDate } from '../selectors/debts';

export const useDebts = () => {
  const {
    debts,
    wallets,
  } = useFinanceState();
  const {
    addDebt,
    editDebt,
    settleDebt,
    deleteDebt,
  } = useFinanceActions();

  // Live (non-deleted) debts, settled or not, in store order.
  const liveDebts = useMemo(() => {
    return debts.filter((d) => !d.isDeleted);
  }, [debts]);

  // Active wallets, `useWallets`' own predicate - a soft-deleted or archived
  // wallet must never be selectable as a debt-repayment source (Phase 59).
  const activeWallets = useMemo(() => selectActiveWallets(wallets), [wallets]);

  // Spec 6.4 (Phase 60): the Debt payoff page lists the debts still owed,
  // nearest due date first, then the paid-off ones in the same order.
  const unsettledDebts = useMemo(() => {
    return sortByDueDate(liveDebts.filter((d) => !d.isSettled));
  }, [liveDebts]);

  const settledDebts = useMemo(() => {
    return sortByDueDate(liveDebts.filter((d) => d.isSettled));
  }, [liveDebts]);

  // Aggregated Debt Metrics
  const debtMetrics = useMemo(() => {
    const totalTarget = liveDebts.reduce((sum, d) => sum + d.totalAmount, 0);
    const remainingTarget = liveDebts.reduce((sum, d) => sum + (d.isSettled ? 0 : d.remainingAmount), 0);
    const paidTarget = totalTarget - remainingTarget;
    // No debts tracked reads as 0% paid off, not 100% (ADR 0079).
    const progressPercent = payoffPercent(totalTarget, remainingTarget, 0);

    return {
      totalTarget,
      remainingTarget,
      paidTarget,
      progressPercent,
      activeCount: unsettledDebts.length,
    };
  }, [liveDebts, unsettledDebts]);

  // Stable action callbacks
  const handleAddDebt = useCallback(
    (debt: Omit<Debt, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isSettled' | 'isDeleted'>) => {
      return addDebt(debt);
    },
    [addDebt]
  );

  const handleEditDebt = useCallback(
    (debtId: string, details: DebtEdit) => {
      return editDebt(debtId, details);
    },
    [editDebt]
  );

  const handleSettleDebt = useCallback(
    (debtId: string) => {
      return settleDebt(debtId);
    },
    [settleDebt]
  );

  const handleDeleteDebt = useCallback(
    (debtId: string) => {
      return deleteDebt(debtId);
    },
    [deleteDebt]
  );

  return {
    /** Every debt that is not deleted, settled or not, in store order. */
    debts: liveDebts,
    /** Still owed, nearest due date first (undated last). */
    activeDebts: unsettledDebts,
    /** Paid off, in the same order. */
    settledDebts,
    wallets: activeWallets,
    metrics: debtMetrics,
    addDebt: handleAddDebt,
    editDebt: handleEditDebt,
    settleDebt: handleSettleDebt,
    deleteDebt: handleDeleteDebt,
  };
};
