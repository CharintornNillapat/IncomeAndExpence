import React from 'react';
import { PieChart } from 'lucide-react';

interface CategoryBreakdownItem {
  name: string;
  amount: number;
  color: string;
}

interface CategoryExpenseDistributionProps {
  categoryBreakdown: CategoryBreakdownItem[];
  totalExpenseAmount: number;
  primarySymbol: string;
}

export const CategoryExpenseDistribution: React.FC<CategoryExpenseDistributionProps> = React.memo(({
  categoryBreakdown,
  totalExpenseAmount,
  primarySymbol,
}) => {
  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-xs transition-colors">
      <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-stone-600 dark:text-stone-400" />
          <h3 className="text-sm font-bold text-stone-900 dark:text-white">Expense Category Distribution</h3>
        </div>
        <span className="text-xs text-stone-400 dark:text-stone-500 font-mono">
          Total: {primarySymbol}{totalExpenseAmount.toFixed(2)}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {categoryBreakdown.length === 0 ? (
          <p className="text-xs text-stone-400 dark:text-stone-500 text-center py-8">No expense records in this timeframe.</p>
        ) : (
          categoryBreakdown.map((item) => {
            const percent = totalExpenseAmount > 0 ? (item.amount / totalExpenseAmount) * 100 : 0;
            return (
              <div key={item.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-800 dark:text-stone-200">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-stone-500 dark:text-stone-400">{percent.toFixed(1)}%</span>
                    <span className="font-mono font-bold text-stone-900 dark:text-white">
                      {primarySymbol}{item.amount.toFixed(2)}
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${percent}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

CategoryExpenseDistribution.displayName = 'CategoryExpenseDistribution';
