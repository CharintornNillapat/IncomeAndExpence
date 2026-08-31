import React, { useState } from 'react';
import { 
  Plus, 
  TrendingDown, 
  CheckCircle2, 
  Calendar, 
  Percent, 
  CreditCard, 
  Trash2, 
  Check, 
  X,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { Debt } from '../types';
import { InlineMathInput } from '../components/InlineMathInput';

export const DebtsView: React.FC = () => {
  const { debts, wallets, addDebt, repayDebtAtomic, settleDebt, deleteDebt } = useFinance();

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
  const [repayError, setRepayError] = useState<string | null>(null);

  const activeDebts = debts.filter((d) => !d.isDeleted);

  const handleCreateDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtName.trim() || totalAmount <= 0) return;

    addDebt({
      name: debtName.trim(),
      totalAmount,
      remainingAmount: remainingAmount > 0 ? remainingAmount : totalAmount,
      interestRate,
      minimumPayment,
      dueDate,
    });

    setIsAddDebtOpen(false);
    setDebtName('');
  };

  const handleExecuteRepay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayDebtTarget || !repayValid || repayAmount === null || !selectedWalletId) return;

    const result = repayDebtAtomic(repayDebtTarget.id, selectedWalletId, repayAmount, repayNote);
    if (!result.success) {
      setRepayError(result.error || 'Failed to process debt repayment');
      return;
    }

    setRepayDebtTarget(null);
    setRepayAmount(null);
    setRepayRaw('');
    setRepayError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-stone-900">Debt Freedom & Repayment Management</h2>
          <p className="text-xs text-stone-500">
            Target payoff tracking and atomic single-transaction wallet balance deduction
          </p>
        </div>

        <button
          id="open-add-debt-btn"
          type="button"
          onClick={() => setIsAddDebtOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Debt Target</span>
        </button>
      </div>

      {/* Debt Targets Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {activeDebts.map((debt) => {
          const paidAmount = debt.totalAmount - debt.remainingAmount;
          const progressPercent = debt.totalAmount > 0 ? (paidAmount / debt.totalAmount) * 100 : 100;

          return (
            <div
              key={debt.id}
              id={`debt-card-${debt.id}`}
              className={`bg-white rounded-2xl border p-6 shadow-xs flex flex-col justify-between transition-all ${
                debt.isSettled ? 'border-emerald-200 bg-emerald-50/20' : 'border-stone-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        debt.isSettled ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {debt.isSettled ? <CheckCircle2 className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-stone-900">{debt.name}</h3>
                      {debt.isSettled ? (
                        <span className="text-[11px] font-semibold text-emerald-600">100% Fully Settled!</span>
                      ) : (
                        <span className="text-[11px] text-stone-400">
                          {debt.interestRate ? `${debt.interestRate}% APR` : 'Interest-Free'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!debt.isSettled && (
                      <button
                        id={`settle-debt-${debt.id}`}
                        type="button"
                        onClick={() => settleDebt(debt.id)}
                        title="Mark fully settled"
                        className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      id={`delete-debt-${debt.id}`}
                      type="button"
                      onClick={() => deleteDebt(debt.id)}
                      title="Delete debt"
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar & Balances */}
                <div className="mt-5 space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-stone-500">Repayment Progress:</span>
                      <span className="font-mono font-bold text-stone-900">{progressPercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, progressPercent)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <span className="text-[11px] text-stone-500 block">Remaining Balance</span>
                      <span className="text-base font-bold font-mono text-rose-600">
                        ${debt.remainingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <span className="text-[11px] text-stone-500 block">Total Principal Target</span>
                      <span className="text-base font-bold font-mono text-stone-900">
                        ${debt.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
                    {debt.minimumPayment && (
                      <span>Min Monthly: <strong>${debt.minimumPayment.toFixed(2)}</strong></span>
                    )}
                    {debt.dueDate && <span>Target Payoff Date: {debt.dueDate}</span>}
                  </div>
                </div>
              </div>

              {/* Action Button: Atomic Repay */}
              <div className="pt-5 mt-4 border-t border-stone-100">
                {!debt.isSettled ? (
                  <button
                    id={`open-repay-modal-${debt.id}`}
                    type="button"
                    onClick={() => {
                      setRepayDebtTarget(debt);
                      setRepayAmount(debt.minimumPayment || 200);
                      setRepayRaw((debt.minimumPayment || 200).toString());
                      setRepayValid(true);
                    }}
                    className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4 text-stone-300" />
                    <span>Make Atomic Repayment</span>
                  </button>
                ) : (
                  <div className="text-center py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                    ✓ Debt Obligation Complete
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Debt Modal / Responsive Mobile Bottom Sheet */}
      {isAddDebtOpen && (
        <div 
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddDebtOpen(false);
          }}
        >
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200 p-5 sm:p-6 space-y-5 animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 duration-200">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden -mt-1 pb-1 flex justify-center cursor-pointer" onClick={() => setIsAddDebtOpen(false)}>
              <div className="w-12 h-1.5 rounded-full bg-stone-300" />
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-900">Add New Debt Goal</h3>
              <button
                type="button"
                onClick={() => setIsAddDebtOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 active:bg-stone-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDebt} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                  Debt Title *
                </label>
                <input
                  id="new-debt-name"
                  type="text"
                  required
                  value={debtName}
                  onChange={(e) => setDebtName(e.target.value)}
                  placeholder="e.g. Credit Card Consolidation, Student Loan"
                  className="w-full text-xs rounded-xl border border-stone-200 px-3.5 py-2.5 text-stone-900 focus:outline-none focus:border-stone-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                    Total Amount ($) *
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
                    className="w-full text-xs rounded-xl border border-stone-200 px-3.5 py-2.5 text-stone-900 font-mono focus:outline-none focus:border-stone-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                    Remaining ($)
                  </label>
                  <input
                    id="new-debt-remaining"
                    type="number"
                    step="0.01"
                    min="0"
                    value={remainingAmount}
                    onChange={(e) => setRemainingAmount(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs rounded-xl border border-stone-200 px-3.5 py-2.5 text-stone-900 font-mono focus:outline-none focus:border-stone-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                    Interest Rate (% APR)
                  </label>
                  <input
                    id="new-debt-interest"
                    type="number"
                    step="0.1"
                    min="0"
                    value={interestRate}
                    onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs rounded-xl border border-stone-200 px-3.5 py-2.5 text-stone-900 font-mono focus:outline-none focus:border-stone-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                    Minimum Monthly ($)
                  </label>
                  <input
                    id="new-debt-min-payment"
                    type="number"
                    step="1"
                    min="0"
                    value={minimumPayment}
                    onChange={(e) => setMinimumPayment(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs rounded-xl border border-stone-200 px-3.5 py-2.5 text-stone-900 font-mono focus:outline-none focus:border-stone-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                  Target Due Date
                </label>
                <input
                  id="new-debt-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-xs rounded-xl border border-stone-200 px-3.5 py-2.5 bg-white text-stone-900 focus:outline-none focus:border-stone-800"
                />
              </div>

              <div className="pt-2">
                <button
                  id="save-new-debt-btn"
                  type="submit"
                  className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-semibold text-xs transition-all shadow-xs cursor-pointer"
                >
                  Create Debt Payoff Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repay Debt Modal / Responsive Mobile Bottom Sheet */}
      {repayDebtTarget && (
        <div 
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRepayDebtTarget(null);
          }}
        >
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200 p-5 sm:p-6 space-y-5 animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 duration-200">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden -mt-1 pb-1 flex justify-center cursor-pointer" onClick={() => setRepayDebtTarget(null)}>
              <div className="w-12 h-1.5 rounded-full bg-stone-300" />
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">Repay Debt: {repayDebtTarget.name}</h3>
                <p className="text-xs text-stone-500">Atomic deduction from wallet & debt target reduction</p>
              </div>
              <button
                type="button"
                onClick={() => setRepayDebtTarget(null)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 active:bg-stone-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteRepay} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                  Deduct Funds From Wallet *
                </label>
                <select
                  id="repay-wallet-select"
                  value={selectedWalletId}
                  onChange={(e) => setSelectedWalletId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-stone-200 px-3 py-2.5 bg-white text-stone-900 focus:outline-none focus:border-stone-800"
                >
                  {wallets
                    .filter((w) => !w.isDeleted)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} (${w.balance.toFixed(2)})
                      </option>
                    ))}
                </select>
              </div>

              {/* Inline Math Input */}
              <InlineMathInput
                id="repay-amount-math"
                label="Repayment Amount"
                defaultValue={repayRaw}
                required
                onAmountEvaluated={(val, raw, valid) => {
                  setRepayAmount(val);
                  setRepayRaw(raw);
                  setRepayValid(valid);
                }}
              />

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                  Payment Memo / Note
                </label>
                <input
                  id="repay-note"
                  type="text"
                  value={repayNote}
                  onChange={(e) => setRepayNote(e.target.value)}
                  className="w-full text-xs rounded-xl border border-stone-200 px-3.5 py-2.5 text-stone-900 focus:outline-none focus:border-stone-800"
                />
              </div>

              {repayError && (
                <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
                  <ShieldAlert className="w-4 h-4" /> {repayError}
                </p>
              )}

              <div className="pt-2">
                <button
                  id="confirm-repay-btn"
                  type="submit"
                  disabled={!repayValid || repayAmount === null}
                  className={`w-full py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    repayValid && repayAmount !== null
                      ? 'bg-stone-900 hover:bg-stone-800 text-white shadow-xs'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  <span>Execute Atomic Payment of ${repayAmount !== null ? repayAmount.toFixed(2) : '0.00'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
