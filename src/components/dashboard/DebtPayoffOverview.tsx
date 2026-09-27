import React from 'react';
import { TrendingDown } from 'lucide-react';
import { formatCurrencyAmount } from '../../utils/currency';
import { ProgressMeter } from '../ui/ProgressMeter';

interface DebtPayoffOverviewProps {
  activeDebtCount: number;
  debtProgressPercent: number;
  remainingDebtTarget: number;
  paidDebtTarget: number;
}

export const DebtPayoffOverview: React.FC<DebtPayoffOverviewProps> = React.memo(({
  activeDebtCount,
  debtProgressPercent,
  remainingDebtTarget,
  paidDebtTarget,
}) => {
  return (
    <div className="bg-surface-1 rounded-xl border border-line p-6 flex flex-col justify-between transition-colors">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-expense" />
            <h3 className="text-sm font-bold text-fg">Total Debt Payoff Target</h3>
          </div>
          <span className="text-xs font-semibold text-expense bg-expense-tint px-2 py-0.5 rounded-full border border-expense-line">
            {activeDebtCount} Active
          </span>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-fg-secondary">Payoff Progress:</span>
              <span className="font-mono font-bold text-fg">{debtProgressPercent.toFixed(1)}%</span>
            </div>
            <ProgressMeter percent={debtProgressPercent} heightClassName="h-3" />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-surface-2 p-3 rounded-lg border border-line">
              <span className="text-[11px] text-fg-secondary block">Remaining Balance</span>
              <span className="text-base font-bold font-mono text-expense">
                {formatCurrencyAmount(remainingDebtTarget)}
              </span>
            </div>
            <div className="bg-surface-2 p-3 rounded-lg border border-line">
              <span className="text-[11px] text-fg-secondary block">Total Principal Paid</span>
              <span className="text-base font-bold font-mono text-income">
                {formatCurrencyAmount(paidDebtTarget)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-fg-muted mt-6 pt-4 border-t border-line">
        Payments automatically update your wallet balance and reduce what you owe.
      </p>
    </div>
  );
});

DebtPayoffOverview.displayName = 'DebtPayoffOverview';
