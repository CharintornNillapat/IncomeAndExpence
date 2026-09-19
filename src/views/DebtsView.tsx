import React, { useState, useCallback } from 'react';
import {
  Plus,
} from 'lucide-react';
import { useDebts } from '../hooks/useDebts';
import { useSubmitHandler } from '../hooks/useSubmitHandler';
import { useFinanceState, useFinanceActions } from '../context/FinanceContext';
import { APP_CURRENCY_SYMBOL } from '../utils/currency';
import { Debt } from '../types';
import { DebtCardItem } from '../components/DebtCardItem';
import { TransactionForm } from '../components/TransactionForm';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LABEL_CLASS, inputClass, ERROR_BANNER_CLASS, PRIMARY_BUTTON_CLASS } from '../utils/formStyles';

export const DebtsView: React.FC = () => {
  const { debts, wallets, addDebt, settleDebt, deleteDebt } = useDebts();
  const { categories } = useFinanceState();
  const { addTransaction } = useFinanceActions();

  const [isAddDebtOpen, setIsAddDebtOpen] = useState<boolean>(false);
  const [repayDebtTarget, setRepayDebtTarget] = useState<Debt | null>(null);
  // T42: debt deletion had no confirmation - gate it behind `ConfirmDialog`.
  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null);
  const [isDeletingDebt, setIsDeletingDebt] = useState<boolean>(false);

  // New Debt Form State
  const [debtName, setDebtName] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<number>(5000);
  const [remainingAmount, setRemainingAmount] = useState<number>(5000);
  const [interestRate, setInterestRate] = useState<number>(4.5);
  const [minimumPayment, setMinimumPayment] = useState<number>(200);
  const [dueDate, setDueDate] = useState<string>('2026-12-31');

  const handleSettle = useCallback((id: string) => {
    settleDebt(id);
  }, [settleDebt]);

  const handleDelete = useCallback(
    (id: string) => {
      const target = debts.find((d) => d.id === id) || null;
      setDebtToDelete(target);
    },
    [debts]
  );

  const handleConfirmDeleteDebt = useCallback(async () => {
    if (!debtToDelete) return;
    setIsDeletingDebt(true);
    await deleteDebt(debtToDelete.id);
    setIsDeletingDebt(false);
    setDebtToDelete(null);
  }, [debtToDelete, deleteDebt]);

  const handleOpenRepay = useCallback((debt: Debt) => {
    setRepayDebtTarget(debt);
  }, []);

  // Keeps the form open so a rejected debt goal can be corrected.
  const { error: createDebtError, handleSubmit: submitCreateDebt } = useSubmitHandler({
    defaultErrorMessage: 'Failed to create debt goal',
    onSuccess: () => {
      setIsAddDebtOpen(false);
      setDebtName('');
    },
  });

  const handleCreateDebt = (e: React.FormEvent) =>
    submitCreateDebt(e, () =>
      addDebt({
        name: debtName.trim(),
        totalAmount,
        remainingAmount: remainingAmount > 0 ? remainingAmount : totalAmount,
        interestRate,
        minimumPayment,
        dueDate,
      })
    );

  // T38: routes through the same generic addTransaction path every other
  // TransactionForm consumer uses, rather than the useDebts().repayDebt /
  // repayDebtAtomic wrapper the hand-rolled form used to call. addTransaction
  // itself decrements the target debt's remainingAmount (and auto-settles it
  // at zero) whenever type is DEBT_REPAYMENT and a debtId is present -
  // repayDebtAtomic was only ever a thin pre-fill of category/description
  // around that same call, so nothing is lost by calling it directly.
  const handleRepaySubmit = useCallback(
    async (data: Parameters<React.ComponentProps<typeof TransactionForm>['onSubmitTransaction']>[0]) => {
      const res = await addTransaction({
        ...data,
        transactionDate: data.date,
      });
      if (res && res.success) {
        setRepayDebtTarget(null);
      }
      return res;
    },
    [addTransaction]
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-stone-900 dark:text-white">Debts & Loans</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Track payoff goals and make repayments from your wallets
          </p>
        </div>

        <button
          id="open-add-debt-btn"
          type="button"
          onClick={() => setIsAddDebtOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white dark:text-stone-900 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>Add Debt</span>
        </button>
      </div>

      {/* Debt Targets Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {debts.map((debt) => (
          <DebtCardItem
            key={debt.id}
            debt={debt}
            onSettle={handleSettle}
            onDelete={handleDelete}
            onOpenRepay={handleOpenRepay}
          />
        ))}
      </div>

      {/* Add Debt Modal / Responsive Mobile Bottom Sheet */}
      <Modal
        isOpen={isAddDebtOpen}
        onClose={() => setIsAddDebtOpen(false)}
        title="Add Debt"
        bodyClassName="space-y-4 sm:space-y-5"
      >
        <form onSubmit={handleCreateDebt} className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>
              Debt Title *
            </label>
            <input
              id="new-debt-name"
              type="text"
              required
              value={debtName}
              onChange={(e) => setDebtName(e.target.value)}
              placeholder="e.g. Student Loan, Car Loan"
              className={inputClass('subtle')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className={LABEL_CLASS}>
                Total Amount ({APP_CURRENCY_SYMBOL}) *
              </label>
              <input
                id="new-debt-total"
                type="number"
                step="0.01"
                min="1"
                required
                value={totalAmount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setTotalAmount(val);
                  setRemainingAmount(val);
                }}
                className={`${inputClass('subtle')} font-mono`}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>
                Remaining ({APP_CURRENCY_SYMBOL})
              </label>
              <input
                id="new-debt-remaining"
                type="number"
                step="0.01"
                min="0"
                value={remainingAmount}
                onChange={(e) => setRemainingAmount(parseFloat(e.target.value) || 0)}
                className={`${inputClass('subtle')} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className={LABEL_CLASS}>
                Interest Rate (% APR)
              </label>
              <input
                id="new-debt-interest"
                type="number"
                step="0.1"
                min="0"
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
                className={`${inputClass('subtle')} font-mono`}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>
                Min Monthly ({APP_CURRENCY_SYMBOL})
              </label>
              <input
                id="new-debt-min-payment"
                type="number"
                step="1"
                min="0"
                value={minimumPayment}
                onChange={(e) => setMinimumPayment(parseFloat(e.target.value) || 0)}
                className={`${inputClass('subtle')} font-mono`}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>
              Target Payoff Date
            </label>
            <input
              id="new-debt-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass('subtle')}
            />
          </div>

          <div className="pt-2">
            {createDebtError && (
              <div className={ERROR_BANNER_CLASS}>
                {createDebtError}
              </div>
            )}

            <button
              id="save-new-debt-btn"
              type="submit"
              className={PRIMARY_BUTTON_CLASS}
            >
              Add Debt
            </button>
          </div>
        </form>
      </Modal>

      {/* Repay Debt Modal / Responsive Mobile Bottom Sheet */}
      <Modal
        isOpen={!!repayDebtTarget}
        onClose={() => setRepayDebtTarget(null)}
        title={repayDebtTarget ? `Repay: ${repayDebtTarget.name}` : 'Repay'}
        subtitle="Deducts directly from your selected wallet"
        bodyClassName="space-y-4 sm:space-y-5"
      >
        {repayDebtTarget && (
          <TransactionForm
            key={repayDebtTarget.id}
            wallets={wallets}
            categories={categories.filter((c) => !c.isDeleted)}
            idPrefix="repay"
            presetType="DEBT_REPAYMENT"
            lockType
            presetDebtId={repayDebtTarget.id}
            onSubmitTransaction={handleRepaySubmit}
          />
        )}
      </Modal>

      {/* Delete Debt Confirmation (T42) */}
      <ConfirmDialog
        isOpen={!!debtToDelete}
        onClose={() => setDebtToDelete(null)}
        onConfirm={handleConfirmDeleteDebt}
        isLoading={isDeletingDebt}
        title="Delete Debt"
        description={
          debtToDelete
            ? `Delete "${debtToDelete.name}"? This removes it from your payoff goals; its repayment transactions are kept.`
            : ''
        }
      />
    </div>
  );
};
