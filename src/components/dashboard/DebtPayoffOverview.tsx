import React from 'react';
import { TrendingDown } from 'lucide-react';

interface DebtPayoffOverviewProps {
  activeDebtCount: number;
  debtProgressPercent: number;
  remainingDebtTarget: number;
  paidDebtTarget: number;
  primarySymbol: string;
}

export const DebtPayoffOverview: React.FC<DebtPayoffOverviewProps> = React.memo(({
  activeDebtCount,
  debtProgressPercent,
  remainingDebtTarget,
  paidDebtTarget,
  primarySymbol,
}) => {
  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-xs flex flex-col justify-between transition-colors">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">Total Debt Payoff Target</h3>
          </div>
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-100 dark:border-rose-800">
            {activeDebtCount} Active
          </span>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-stone-500 dark:text-stone-400">Payoff Progress:</span>
              <span className="font-mono font-bold text-stone-900 dark:text-white">{debtProgressPercent.toFixed(1)}%</span>
            </div>
            <div className="w-full h-3 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, debtProgressPercent)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-100 dark:border-stone-800">
              <span className="text-[11px] text-stone-500 dark:text-stone-400 block">Remaining Balance</span>
              <span className="text-base font-bold font-mono text-rose-600 dark:text-rose-400">
                {primarySymbol}{remainingDebtTarget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-100 dark:border-stone-800">
              <span className="text-[11px] text-stone-500 dark:text-stone-400 block">Total Principal Paid</span>
              <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {primarySymbol}{paidDebtTarget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-6 pt-4 border-t border-stone-100 dark:border-stone-800">
        Payments automatically update your wallet balance and reduce what you owe.
      </p>
    </div>
  );
});

DebtPayoffOverview.displayName = 'DebtPayoffOverview';
