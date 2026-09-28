import React from 'react';
import { Card } from '../ui/Card';
import { Money } from '../ui/Money';
import { ProgressBar } from '../ui/ProgressBar';
import type { CategorySpend } from '../../selectors/ledger';

interface CategorySpendingCardProps {
  /** `spendingByCategory` over the page's period, largest first. */
  rows: CategorySpend[];
  /** `cashFlow().spending`: the same figure as the Cash flow card, and the rows' sum. */
  total: number;
}

/**
 * Spec 6.1 item 5: where the period's spending went, on the L1 definition.
 * The caption says what is left out, so the total reads as a definition and
 * not as a figure that disagrees with the ledger. Each category's colour is
 * on its swatch and bar only, never on text (spec 4.7).
 */
export const CategorySpendingCard: React.FC<CategorySpendingCardProps> = ({ rows, total }) => (
  <Card className="h-full flex flex-col gap-5">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-fg">Spending by category</h2>
        <p className="text-sm text-fg-muted mt-0.5">Excludes debt payments, transfers and balance adjustments</p>
      </div>
      <Money value={total} className="shrink-0 text-sm font-semibold text-fg" />
    </div>

    {rows.length === 0 ? (
      <p className="text-sm text-fg-muted py-6 text-center">No spending in this period.</p>
    ) : (
      <ul className="flex flex-col gap-4">
        {rows.map((row) => {
          const percent = total > 0 ? (row.amount / total) * 100 : 0;
          return (
            <li key={row.categoryId ?? 'uncategorized'} className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5 text-sm">
                <span aria-hidden="true" className="w-2.5 h-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: row.color }} />
                <span className="flex-1 min-w-0 truncate text-fg">{row.name}</span>
                <span className="w-14 shrink-0 text-right text-fg-muted">{percent.toFixed(1)}%</span>
                <Money value={row.amount} className="w-24 shrink-0 text-right font-semibold text-fg" />
              </div>
              <ProgressBar percent={percent} color={row.color} size="sm" label={`${row.name}: ${percent.toFixed(1)}% of spending`} />
            </li>
          );
        })}
      </ul>
    )}
  </Card>
);
