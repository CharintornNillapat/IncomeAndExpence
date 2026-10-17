import React from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Card } from '../ui/Card';
import { Money } from '../ui/Money';

interface CashFlowCardProps {
  kind: 'income' | 'spending';
  /** Positive total for the period from leftOverFor. */
  amount: number;
}

/**
 * Income or Spending for the period, from leftOverFor's totals (owner spec 4.2).
 * `metric-card-expense` holds the Spending figure that date-boundary.spec.ts reads.
 */
export const CashFlowCard: React.FC<CashFlowCardProps> = ({ kind, amount }) => {
  const isIncome = kind === 'income';

  return (
    <section
      aria-labelledby={`dashboard-${kind}-title`}
      data-testid={isIncome ? 'metric-card-income' : 'metric-card-expense'}
      className="min-w-0"
    >
      <Card className="h-full flex flex-col gap-3">
        <h2 id={`dashboard-${kind}-title`} className="flex items-center gap-2.5 text-base font-semibold text-fg">
          <span
            aria-hidden="true"
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              isIncome ? 'bg-income-tint text-income' : 'bg-expense-tint text-expense'
            }`}
          >
            {isIncome ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
          </span>
          {isIncome ? 'Income' : 'Spending'}
        </h2>
        {isIncome ? (
          <Money value={amount} showPlus className="text-2xl font-semibold text-income" />
        ) : (
          <Money value={-amount} className="text-2xl font-semibold text-expense" />
        )}
      </Card>
    </section>
  );
};
