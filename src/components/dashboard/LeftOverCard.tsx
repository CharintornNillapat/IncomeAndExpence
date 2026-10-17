import React from 'react';
import { PiggyBank } from 'lucide-react';
import { Money } from '../ui/Money';
import { formatCurrencyAmount } from '../../utils/currency';
import { formatWeekdayDate } from '../../utils/date';
import type { LeftOver } from '../../selectors/ledger';
import type { SpendingPoint } from '../../selectors/diary';

interface LeftOverCardProps {
  data: LeftOver;
  series: SpendingPoint[] | null;
  periodName: string;
  periodDates: string;
}

interface SparklineProps {
  points: SpendingPoint[];
  periodName: string;
}

const Sparkline: React.FC<SparklineProps> = ({ points, periodName }) => {
  let max = 0;
  let maxDate = points[0]?.date ?? '';
  for (const pt of points) {
    if (pt.spending > max) {
      max = pt.spending;
      maxDate = pt.date;
    }
  }

  const label =
    max === 0
      ? `Daily spending, ${periodName}: nothing spent`
      : `Daily spending, ${periodName}: highest ${formatCurrencyAmount(max)} on ${formatWeekdayDate(maxDate)}`;

  const n = points.length;
  const pointPairs = points.map((p, i) => {
    const x = Number(((i * 300) / (n - 1)).toFixed(2));
    const y = Number((max > 0 ? 54 - (p.spending / max) * 50 : 54).toFixed(2));
    return `${x},${y}`;
  });

  const pointsAttr = pointPairs.join(' ');
  const polygonPoints = `0,56 ${pointsAttr} 300,56`;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 300 56"
      preserveAspectRatio="none"
      className="flex-1 basis-44 max-w-xs h-14 block"
    >
      <polygon points={polygonPoints} className="fill-brand" fillOpacity={0.15} />
      <polyline
        points={pointsAttr}
        fill="none"
        className="stroke-brand"
        strokeWidth={2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

/**
 * Owner spec 4.2 (ADR 0102): Left over card for the chosen period.
 * Figures come from `leftOverFor` and `dailySpendingSeries`, computed in `DashboardView`.
 * The brand tint is the page's one brand emphasis; the edge stays the neutral `line`.
 * Text on the tint passes 4.5:1 in both themes (measured in spec section 4).
 */
export const LeftOverCard: React.FC<LeftOverCardProps> = ({ data, series, periodName, periodDates }) => {
  const hasRows = data.income !== 0 || data.spending !== 0;

  let keptLine = '';
  if (hasRows) {
    if (data.keptPercent === null) {
      keptLine = 'No income this period';
    } else if (data.keptPercent >= 0) {
      keptLine = `${Math.round(data.keptPercent)}% of income kept`;
    } else {
      keptLine = `Spent ${Math.round(-data.keptPercent)}% more than earned`;
    }
  }

  const showAfterDebt = hasRows && data.afterDebtDue !== null;

  return (
    <section
      aria-labelledby="dashboard-left-over-title"
      data-testid="metric-card-net"
      className="h-full bg-brand-tint border border-line rounded-card p-6 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="dashboard-left-over-title" className="flex items-center gap-2.5 text-base font-semibold text-fg">
          <span
            aria-hidden="true"
            className="w-8 h-8 rounded-full bg-brand-soft text-brand-soft-text flex items-center justify-center shrink-0"
          >
            <PiggyBank className="w-4 h-4" />
          </span>
          Left over
        </h2>
        <span className="text-xs text-fg-muted">{periodDates}</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <Money
            value={data.leftOver}
            showPlus
            className={`text-4xl font-semibold tracking-tight ${data.leftOver < 0 ? 'text-expense' : 'text-fg'}`}
          />
          {hasRows && (
            <p className="text-sm text-fg-secondary mt-1">
              {keptLine}
              {showAfterDebt && (
                <>
                  {' · '}
                  <Money
                    value={data.afterDebtDue!}
                    className={`font-medium ${data.afterDebtDue! < 0 ? 'text-expense' : 'text-fg'}`}
                  />
                  {' after debt due'}
                </>
              )}
            </p>
          )}
        </div>
        {series && <Sparkline points={series} periodName={periodName} />}
      </div>

      <div className="flex flex-col gap-1.5">
        <div aria-hidden="true" className="flex gap-[3px] h-2 w-full rounded-full overflow-hidden bg-line">
          {data.spentShare > 0 && <div className="bg-expense-fill" style={{ flexGrow: data.spentShare, flexBasis: 0 }} />}
          {data.keptShare > 0 && <div className="bg-brand-fill" style={{ flexGrow: data.keptShare, flexBasis: 0 }} />}
        </div>
        <div className="flex justify-between text-xs text-fg-muted">
          <span>Spent {Math.round(data.spentShare)}%</span>
          <span>Kept {Math.round(data.keptShare)}%</span>
        </div>
      </div>
    </section>
  );
};
