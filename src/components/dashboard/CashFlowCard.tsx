import React from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Card } from '../ui/Card';
import { Money } from '../ui/Money';
import { ProgressBar } from '../ui/ProgressBar';
import type { CashFlow } from '../../selectors/ledger';

interface CashFlowCardProps {
  flow: CashFlow;
  /** The period in words, lower case, for the title: "past 30 days". */
  periodName: string;
  /** The period as dates: "Aug 29 – Sep 28". */
  periodDates: string;
}

function caption(flow: CashFlow): string {
  if (flow.spentPercent === null) {
    return flow.spending > 0 ? 'No income in this period' : 'Nothing earned or spent in this period';
  }
  return `${Math.round(flow.spentPercent)}% of income spent · debt payments are shown under Debt payoff`;
}

/**
 * Spec 6.1 item 2: Income, Spending and Left over in one card with a neutral
 * edge - the colour is on the numbers only (spec section 3). It replaces the
 * three bordered metric cards. Every figure is `cashFlow`'s, so Spending here
 * is the category card's total to the cent (acceptance check 1).
 *
 * `metric-card-expense` sits on the Spending cell and holds that one figure:
 * `date-boundary.spec.ts` reads it after switching the period.
 */
export const CashFlowCard: React.FC<CashFlowCardProps> = ({ flow, periodName, periodDates }) => (
  <Card padding="lg" className="h-full flex flex-col gap-5 @container">
    <div className="flex items-baseline justify-between gap-3 flex-wrap">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">Cash flow · {periodName}</h2>
      <span className="text-xs text-fg-muted">{periodDates}</span>
    </div>

    <div className="grid grid-cols-1 @md:grid-cols-3 gap-4 @md:gap-6">
      <div data-testid="metric-card-income" className="flex flex-col gap-1.5 min-w-0">
        <span className="flex items-center gap-1.5 text-sm text-fg-secondary">
          <ArrowDownLeft aria-hidden="true" className="w-3.5 h-3.5 text-income" />
          Income
        </span>
        <Money value={flow.income} showPlus className="text-2xl font-semibold text-income truncate" />
      </div>
      <div data-testid="metric-card-expense" className="flex flex-col gap-1.5 min-w-0">
        <span className="flex items-center gap-1.5 text-sm text-fg-secondary">
          <ArrowUpRight aria-hidden="true" className="w-3.5 h-3.5 text-expense" />
          Spending
        </span>
        <Money value={-flow.spending} className="text-2xl font-semibold text-expense truncate" />
      </div>
      <div data-testid="metric-card-net" className="flex flex-col gap-1.5 min-w-0">
        <span className="text-sm text-fg-secondary">Left over</span>
        {/* Spec section 3: a net figure is the primary text colour, red only when negative. */}
        <Money
          value={flow.leftOver}
          showPlus
          className={`text-2xl font-semibold truncate ${flow.leftOver < 0 ? 'text-expense' : 'text-fg'}`}
        />
      </div>
    </div>

    <div className="flex flex-col gap-2 mt-auto">
      <ProgressBar percent={flow.spentPercent ?? 0} tone="expense" size="lg" label="Share of income spent" />
      <p className="text-xs text-fg-muted">{caption(flow)}</p>
    </div>
  </Card>
);
