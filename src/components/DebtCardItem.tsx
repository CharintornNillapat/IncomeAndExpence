import React from 'react';
import { TrendingDown, CheckCircle2, Check, Trash2, CreditCard } from 'lucide-react';
import { Debt } from '../types';
import { formatCurrencyAmount } from '../utils/currency';
import { PRIMARY_BUTTON_COMPACT_CLASS } from '../utils/formStyles';
import { ProgressMeter } from './ui/ProgressMeter';

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
      className={`bg-surface-1 rounded-xl border p-6 flex flex-col justify-between transition-all ${
        debt.isSettled
          ? 'border-income-line'
          : 'border-line'
      }`}
    >
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                debt.isSettled
                  ? 'bg-income-tint text-income'
                  : 'bg-expense-tint text-expense'
              }`}
            >
              {debt.isSettled ? <CheckCircle2 className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-fg">{debt.name}</h3>
              {debt.isSettled ? (
                <span className="text-[11px] font-semibold text-income">100% Fully Settled!</span>
              ) : (
                <span className="text-[11px] text-fg-muted">
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
                className="p-1.5 text-fg-muted hover:text-income hover:bg-income-tint rounded-lg transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
              </button>
            )}
            <button
              id={`delete-debt-${debt.id}`}
              type="button"
              onClick={() => onDelete(debt.id)}
              title="Delete debt"
              className="p-1.5 text-fg-muted hover:text-expense hover:bg-expense-tint rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar & Balances */}
        <div className="mt-5 space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-fg-secondary">Repayment Progress:</span>
              <span className="font-mono font-bold text-fg">{progressPercent.toFixed(1)}%</span>
            </div>
            <ProgressMeter percent={progressPercent} heightClassName="h-3" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-2 p-3 rounded-lg border border-line">
              <span className="text-[11px] text-fg-secondary block">Remaining Balance</span>
              <span className="text-base font-bold font-mono text-expense">
                {formatCurrencyAmount(debt.remainingAmount)}
              </span>
            </div>
            <div className="bg-surface-2 p-3 rounded-lg border border-line">
              <span className="text-[11px] text-fg-secondary block">Total Principal Target</span>
              <span className="text-base font-bold font-mono text-fg">
                {formatCurrencyAmount(debt.totalAmount)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-fg-secondary pt-1">
            {debt.minimumPayment && (
              <span>Min Monthly: <strong className="text-fg">{formatCurrencyAmount(debt.minimumPayment)}</strong></span>
            )}
            {debt.dueDate && <span>Target Payoff Date: {debt.dueDate}</span>}
          </div>
        </div>
      </div>

      {/* Action Button: Atomic Repay */}
      <div className="pt-5 mt-4 border-t border-line">
        {!debt.isSettled ? (
          <button
            id={`open-repay-modal-${debt.id}`}
            type="button"
            onClick={() => onOpenRepay(debt)}
            className={`${PRIMARY_BUTTON_COMPACT_CLASS} flex items-center justify-center gap-2`}
          >
            <CreditCard className="w-4 h-4 text-white/80" />
            <span>Make Repayment</span>
          </button>
        ) : (
          <div className="text-center py-1.5 text-xs font-semibold text-income bg-income-tint rounded-lg border border-income-line">
            ✓ Debt Fully Settled
          </div>
        )}
      </div>
    </div>
  );
});

DebtCardItem.displayName = 'DebtCardItem';
