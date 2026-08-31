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
    <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-600" />
            <h3 className="text-sm font-bold text-stone-900">Total Debt Payoff Target</h3>
          </div>
          <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
            {activeDebtCount} Active
          </span>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-stone-500">Payoff Progress:</span>
              <span className="font-mono font-bold text-stone-900">{debtProgressPercent.toFixed(1)}%</span>
            </div>
            <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, debtProgressPercent)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
              <span className="text-[11px] text-stone-500 block">Remaining Balance</span>
              <span className="text-base font-bold font-mono text-rose-600">
                {primarySymbol}{remainingDebtTarget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
              <span className="text-[11px] text-stone-500 block">Total Principal Paid</span>
              <span className="text-base font-bold font-mono text-emerald-600">
                {primarySymbol}{paidDebtTarget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-stone-400 mt-6 pt-4 border-t border-stone-100">
        Payments automatically update your wallet balance and reduce what you owe.
      </p>
    </div>
  );
});

DebtPayoffOverview.displayName = 'DebtPayoffOverview';
