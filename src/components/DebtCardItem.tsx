import React from 'react';
import { TrendingDown, CheckCircle2, Check, Trash2, CreditCard } from 'lucide-react';
import { Debt } from '../types';

interface DebtCardItemProps {
  debt: Debt;
  onSettle: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenRepay: (debt: Debt) => void;
}

export const DebtCardItem: React.FC<DebtCardItemProps> = React.memo(({
  debt,
  onSettle,
  onDelete,
  onOpenRepay,
}) => {
  const paidAmount = debt.totalAmount - (debt.isSettled ? 0 : debt.remainingAmount);
  const progressPercent = debt.totalAmount > 0 ? (paidAmount / debt.totalAmount) * 100 : 100;

  return (
    <div
      id={`debt-card-${debt.id}`}
      className={`bg-white dark:bg-stone-900 rounded-2xl border p-6 shadow-xs flex flex-col justify-between transition-all ${
        debt.isSettled 
          ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/20' 
          : 'border-stone-200 dark:border-stone-800'
      }`}
    >
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                debt.isSettled 
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' 
                  : 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
              }`}
            >
              {debt.isSettled ? <CheckCircle2 className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">{debt.name}</h3>
              {debt.isSettled ? (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">100% Fully Settled!</span>
              ) : (
                <span className="text-[11px] text-stone-400 dark:text-stone-500">
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
                onClick={() => onSettle(debt.id)}
                title="Mark fully settled"
                className="p-1.5 text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
              </button>
            )}
            <button
              id={`delete-debt-${debt.id}`}
              type="button"
              onClick={() => onDelete(debt.id)}
              title="Delete debt"
              className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar & Balances */}
        <div className="mt-5 space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-stone-500 dark:text-stone-400">Repayment Progress:</span>
              <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{progressPercent.toFixed(1)}%</span>
            </div>
            <div className="w-full h-3 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-stone-50 dark:bg-stone-800/80 p-3 rounded-xl border border-stone-100 dark:border-stone-700/60">
              <span className="text-[11px] text-stone-500 dark:text-stone-400 block">Remaining Balance</span>
              <span className="text-base font-bold font-mono text-rose-600 dark:text-rose-400">
                ${debt.remainingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-stone-50 dark:bg-stone-800/80 p-3 rounded-xl border border-stone-100 dark:border-stone-700/60">
              <span className="text-[11px] text-stone-500 dark:text-stone-400 block">Total Principal Target</span>
              <span className="text-base font-bold font-mono text-stone-900 dark:text-stone-100">
                ฿{debt.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 pt-1">
            {debt.minimumPayment && (
              <span>Min Monthly: <strong className="text-stone-700 dark:text-stone-300">${debt.minimumPayment.toFixed(2)}</strong></span>
            )}
            {debt.dueDate && <span>Target Payoff Date: {debt.dueDate}</span>}
          </div>
        </div>
      </div>

      {/* Action Button: Atomic Repay */}
      <div className="pt-5 mt-4 border-t border-stone-100 dark:border-stone-800">
        {!debt.isSettled ? (
          <button
            id={`open-repay-modal-${debt.id}`}
            type="button"
            onClick={() => onOpenRepay(debt)}
            className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 rounded-xl font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <CreditCard className="w-4 h-4 text-stone-300 dark:text-stone-700" />
            <span>Make Repayment</span>
          </button>
        ) : (
          <div className="text-center py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900/60">
            ✓ Debt Fully Settled
          </div>
        )}
      </div>
    </div>
  );
});

DebtCardItem.displayName = 'DebtCardItem';
