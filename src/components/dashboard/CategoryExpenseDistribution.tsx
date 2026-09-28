import React from 'react';
import { PieChart } from 'lucide-react';
import { formatCurrencyAmount } from '../../utils/currency';
import { ProgressMeter } from '../ui/ProgressMeter';

interface CategoryBreakdownItem {
  name: string;
  amount: number;
  color: string;
}

interface CategoryExpenseDistributionProps {
  categoryBreakdown: CategoryBreakdownItem[];
  totalExpenseAmount: number;
}

export const CategoryExpenseDistribution: React.FC<CategoryExpenseDistributionProps> = React.memo(({
  categoryBreakdown,
  totalExpenseAmount,
}) => {
  return (
    <div className="bg-surface-1 rounded-xl border border-line p-6 transition-colors">
      <div className="flex items-center justify-between pb-4 border-b border-line">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-fg-secondary" />
          <h3 className="text-sm font-bold text-fg">Expense Category Distribution</h3>
        </div>
        <span className="text-xs text-fg-muted">
          Total: {formatCurrencyAmount(totalExpenseAmount)}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {categoryBreakdown.length === 0 ? (
          <p className="text-xs text-fg-muted text-center py-8">No expense records in this timeframe.</p>
        ) : (
          categoryBreakdown.map((item) => {
            const percent = totalExpenseAmount > 0 ? (item.amount / totalExpenseAmount) * 100 : 0;
            return (
              <div key={item.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-fg">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-fg-secondary">{percent.toFixed(1)}%</span>
                    <span className="font-bold text-fg">
                      {formatCurrencyAmount(item.amount)}
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <ProgressMeter percent={percent} color={item.color} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

CategoryExpenseDistribution.displayName = 'CategoryExpenseDistribution';
