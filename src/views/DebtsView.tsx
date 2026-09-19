import React, { useState, useCallback } from 'react';
import {
  Plus,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { useDebts } from '../hooks/useDebts';
import { useSubmitHandler } from '../hooks/useSubmitHandler';
import { APP_CURRENCY_SYMBOL, formatCurrencyAmount } from '../utils/currency';
import { Debt } from '../types';
import { DebtCardItem } from '../components/DebtCardItem';
import { InlineMathInput } from '../components/InlineMathInput';
import { Modal } from '../components/Modal';

export const DebtsView: React.FC = () => {
  const { debts, wallets, addDebt, repayDebt, settleDebt, deleteDebt } = useDebts();

  const [isAddDebtOpen, setIsAddDebtOpen] = useState<boolean>(false);
  const [repayDebtTarget, setRepayDebtTarget] = useState<Debt | null>(null);

  // New Debt Form State
  const [debtName, setDebtName] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<number>(5000);
  const [remainingAmount, setRemainingAmount] = useState<number>(5000);
  const [interestRate, setInterestRate] = useState<number>(4.5);
  const [minimumPayment, setMinimumPayment] = useState<number>(200);
  const [dueDate, setDueDate] = useState<string>('2026-12-31');

  // Repayment Form State
  const [selectedWalletId, setSelectedWalletId] = useState<string>(wallets[0]?.id || '');
  const [repayAmount, setRepayAmount] = useState<number | null>(null);
  const [repayRaw, setRepayRaw] = useState<string>('');
  const [repayValid, setRepayValid] = useState<boolean>(false);
  const [repayNote, setRepayNote] = useState<string>('Monthly principal payment');

  const handleSettle = useCallback((id: string) => {
    settleDebt(id);
  }, [settleDebt]);

  const handleDelete = useCallback((id: string) => {
    deleteDebt(id);
  }, [deleteDebt]);

  const handleOpenRepay = useCallback((debt: Debt) => {
    setRepayDebtTarget(debt);
    const minPmt = debt.minimumPayment || 200;
    setRepayAmount(minPmt);
    setRepayRaw(minPmt.toString());
    setRepayValid(true);
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

  const { error: repayError, handleSubmit: submitRepay } = useSubmitHandler({
    defaultErrorMessage: 'Failed to process debt repayment',
    onSuccess: () => {
      setRepayDebtTarget(null);
      setRepayAmount(null);
      setRepayRaw('');
    },
  });

  const handleExecuteRepay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayDebtTarget || !repayValid || repayAmount === null || !selectedWalletId) return;
    return submitRepay(e, () => repayDebt(repayDebtTarget.id, selectedWalletId, repayAmount, repayNote));
  };

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
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
              Debt Title *
            </label>
            <input
              id="new-debt-name"
              type="text"
              required
              value={debtName}
              onChange={(e) => setDebtName(e.target.value)}
              placeholder="e.g. Student Loan, Car Loan"
              className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
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
                className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
                Remaining ({APP_CURRENCY_SYMBOL})
              </label>
              <input
                id="new-debt-remaining"
                type="number"
                step="0.01"
                min="0"
                value={remainingAmount}
                onChange={(e) => setRemainingAmount(parseFloat(e.target.value) || 0)}
                className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
                Interest Rate (% APR)
              </label>
              <input
                id="new-debt-interest"
                type="number"
                step="0.1"
                min="0"
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
                className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
                Min Monthly ({APP_CURRENCY_SYMBOL})
              </label>
              <input
                id="new-debt-min-payment"
                type="number"
                step="1"
                min="0"
                value={minimumPayment}
                onChange={(e) => setMinimumPayment(parseFloat(e.target.value) || 0)}
                className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
              Target Payoff Date
            </label>
            <input
              id="new-debt-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
            />
          </div>

          <div className="pt-2">
            {createDebtError && (
              <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 p-3 rounded-xl text-xs font-medium">
                {createDebtError}
              </div>
            )}

            <button
              id="save-new-debt-btn"
              type="submit"
              className="w-full py-2.5 sm:py-3 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 rounded-xl font-semibold text-xs transition-all shadow-xs cursor-pointer"
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
        <form onSubmit={handleExecuteRepay} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
              Pay From Wallet *
            </label>
            <select
              id="repay-wallet-select"
              value={selectedWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2.5 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id} className="dark:bg-stone-800 dark:text-stone-100">
                  {w.name} ({formatCurrencyAmount(w.balance)})
                </option>
              ))}
            </select>
          </div>

          {/* Inline Math Input */}
          <InlineMathInput
            id="repay-amount-math"
            label={`Repayment Amount (${APP_CURRENCY_SYMBOL})`}
            defaultValue={repayRaw}
            required
            onAmountEvaluated={(val, raw, valid) => {
              setRepayAmount(val);
              setRepayRaw(raw);
              setRepayValid(valid);
            }}
          />

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
              Note
            </label>
            <input
              id="repay-note"
              type="text"
              value={repayNote}
              onChange={(e) => setRepayNote(e.target.value)}
              placeholder="e.g. Monthly payment"
              className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
            />
          </div>

          {repayError && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
              <ShieldAlert className="w-4 h-4" /> {repayError}
            </p>
          )}

          <div className="pt-2">
            <button
              id="confirm-repay-btn"
              type="submit"
              disabled={!repayValid || repayAmount === null}
              className={`w-full py-2.5 sm:py-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                repayValid && repayAmount !== null
                  ? 'bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 shadow-xs'
                  : 'bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-600 cursor-not-allowed'
              }`}
            >
              <span>Pay {formatCurrencyAmount(repayAmount ?? 0)}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
