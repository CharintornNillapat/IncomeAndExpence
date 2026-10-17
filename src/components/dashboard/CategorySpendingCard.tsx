import React from 'react';
import { Card, Inset } from '../ui/Card';
import { Money } from '../ui/Money';
import { DashboardLink } from './DashboardLink';
import { SYSTEM_CATEGORY_COLOR, type CategorySpend, type MonthToDate } from '../../selectors/ledger';
import { formatMonthName, monthKeyOf } from '../../utils/date';
import { MINUS } from '../../utils/currency';

interface CategorySpendingCardProps {
  /** `spendingByCategory` over the page's period, largest first. */
  rows: CategorySpend[];
  /** `cashFlow().spending`: the same figure as the Spending card, and the rows' sum. */
  total: number;
  /** Always month-to-date, whatever the page's period (owner spec 4.3). */
  monthToDate: MonthToDate;
  /** Opens the Transactions page. */
  onOpenDetails: () => void;
}

interface DonutProps {
  rows: CategorySpend[];
  total: number;
}

const Donut: React.FC<DonutProps> = ({ rows, total }) => {
  const shown = rows.slice(0, 5);
  const rest = rows.slice(5);

  const percentOf = (amount: number) => (total > 0 ? (amount / total) * 100 : 0);

  const shownSegments = shown.map((row) => ({
    name: row.name,
    color: row.color,
    percent: percentOf(row.amount),
  }));

  const restPercent = rest.reduce((sum, r) => sum + percentOf(r.amount), 0);
  const moreLabel = `${rest.length} more ${rest.length === 1 ? 'category' : 'categories'}`;

  const allSegments = [...shownSegments];
  if (rest.length > 0) {
    allSegments.push({
      name: moreLabel,
      color: SYSTEM_CATEGORY_COLOR,
      percent: restPercent,
    });
  }

  const label =
    'Spending by category: ' +
    allSegments.map((s) => `${s.name} ${s.percent.toFixed(1)}%`).join(', ');

  let accumulated = 0;
  const renderedSegments = allSegments.map((s) => {
    const p = Number(s.percent.toFixed(2));
    const before = Number(accumulated.toFixed(2));
    accumulated += s.percent;
    const strokeDasharray = allSegments.length === 1 ? '100 0' : `${p} ${Number((100 - p).toFixed(2))}`;
    return {
      color: s.color,
      strokeDasharray,
      strokeDashoffset: 25 - before,
    };
  });

  return (
    <div className="relative w-42 h-42 shrink-0 mx-auto">
      <svg role="img" aria-label={label} viewBox="0 0 42 42" className="w-42 h-42 block">
        <circle cx="21" cy="21" r="15.9155" fill="none" strokeWidth={5} className="stroke-surface-2" />
        {renderedSegments.map((s, i) => (
          <circle
            key={i}
            cx="21"
            cy="21"
            r="15.9155"
            fill="none"
            strokeWidth={5}
            stroke={s.color}
            strokeDasharray={s.strokeDasharray}
            strokeDashoffset={s.strokeDashoffset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <Money value={total} className="text-xl font-semibold text-fg" />
        <span className="text-xs text-fg-muted">total spent</span>
      </div>
    </div>
  );
};

/**
 * Dashboard redesign row 2 (owner spec 4.3): where the period's spending went.
 * A donut and the top five categories (name, percent, amount) with a Details link.
 * At the foot of the card is the month-to-date comparison line, shown in every period.
 */
export const CategorySpendingCard: React.FC<CategorySpendingCardProps> = ({
  rows,
  total,
  monthToDate: m,
  onOpenDetails,
}) => {
  const shown = rows.slice(0, 5);
  const rest = rows.slice(5);

  const percentOf = (amount: number) => (total > 0 ? (amount / total) * 100 : 0);
  const restPercent = rest.reduce((sum, r) => sum + percentOf(r.amount), 0);
  const moreLabel = `${rest.length} more ${rest.length === 1 ? 'category' : 'categories'}`;

  const thisName = formatMonthName(monthKeyOf(m.thisMonth.start));
  const lastName = formatMonthName(monthKeyOf(m.lastMonth.start));
  const span = (name: string) => (m.days === 1 ? `${name} 1` : `${name} 1 to ${m.days}`);
  const short = lastName.slice(0, 3);
  const roundedChange = m.spendingChange !== null ? Math.round(m.spendingChange) : null;

  return (
    <section aria-labelledby="dashboard-category-title" className="min-w-0 h-full">
      <Card className="h-full flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="dashboard-category-title" className="text-base font-semibold text-fg">
              Spending by category
            </h2>
            <p className="text-sm text-fg-muted mt-0.5">Excludes debt payments, transfers and balance adjustments</p>
          </div>
          <DashboardLink id="dashboard-category-details-btn" onClick={onOpenDetails}>
            Details
          </DashboardLink>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-fg-muted py-6 text-center">No spending in this period.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-6">
            <Donut rows={rows} total={total} />
            <ul className="flex-1 basis-70 min-w-0 flex flex-col gap-1">
              {shown.map((row) => {
                const p = percentOf(row.amount);
                return (
                  <li key={row.categoryId ?? 'uncategorized'} className="flex items-center gap-3 py-1.5 text-sm">
                    <span
                      aria-hidden="true"
                      className="w-8 h-8 shrink-0 rounded-control bg-surface-2 flex items-center justify-center"
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                    </span>
                    <span className="flex-1 min-w-0 truncate text-fg">{row.name}</span>
                    <span className="w-14 shrink-0 text-right text-xs text-fg-muted">{p.toFixed(1)}%</span>
                    <Money value={row.amount} className="w-24 shrink-0 text-right font-semibold text-fg" />
                  </li>
                );
              })}
              {rest.length > 0 && (
                <li key="more" className="flex items-center gap-3 py-1.5 text-sm">
                  <span
                    aria-hidden="true"
                    className="w-8 h-8 shrink-0 rounded-control bg-surface-2 flex items-center justify-center"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: SYSTEM_CATEGORY_COLOR }}
                    />
                  </span>
                  <span className="flex-1 min-w-0 truncate text-fg">{moreLabel}</span>
                  <span className="w-14 shrink-0 text-right text-xs text-fg-muted">{restPercent.toFixed(1)}%</span>
                  <span className="w-24 shrink-0" />
                </li>
              )}
            </ul>
          </div>
        )}

        <Inset className="mt-auto px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="flex-1 basis-80 min-w-0 text-sm text-fg-secondary">
            <span className="font-semibold text-fg">{span(thisName)}:</span>
            {' '}
            <Money value={m.thisMonth.spending} className="font-medium text-fg" />
            {' spent, against '}
            <Money value={m.lastMonth.spending} className="font-medium text-fg" />
            {` in ${span(lastName)}. `}
            <Money
              value={m.thisMonth.leftOver}
              showPlus
              className={'font-medium ' + (m.thisMonth.leftOver < 0 ? 'text-expense' : 'text-fg')}
            />
            {' left over.'}
          </p>
          {roundedChange !== null && (
            <span
              className={
                'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
                (roundedChange > 0 ? 'bg-expense-tint text-expense' : 'bg-adjust-tint text-chip-text')
              }
            >
              {`${roundedChange < 0 ? MINUS : roundedChange > 0 ? '+' : ''}${Math.abs(roundedChange)}% vs ${short}`}
            </span>
          )}
        </Inset>
      </Card>
    </section>
  );
};
