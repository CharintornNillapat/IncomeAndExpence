import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, Inset } from '../ui/Card';
import { Money } from '../ui/Money';
import { ProgressBar } from '../ui/ProgressBar';
import type { DebtPlan } from '../../selectors/debts';

interface DebtSummaryCardProps {
  /** `useDebts().metrics`: across every debt that is not deleted, the same figures as the Dashboard's Debt payoff card. */
  remaining: number;
  total: number;
  paid: number;
  progressPercent: number;
  /** Spec L4 and L5 over the past 30 days' surplus, computed once in `DebtsView`. */
  plan: DebtPlan;
}

const LABEL = 'text-xs font-semibold uppercase tracking-wider text-fg-secondary';

/**
 * Spec 6.4: the Debt payoff page's three figures. What is still owed, how
 * much of the borrowed total is paid off, and what the debts need a month to
 * meet every due date (L4). That last figure turns amber, with the gap, when
 * it is more than the past 30 days left over (L5); otherwise it reads "On
 * track". The card lays figures out; it computes none (ADR 0028).
 */
export const DebtSummaryCard: React.FC<DebtSummaryCardProps> = ({ remaining, total, paid, progressPercent, plan }) => (
  <Card padding="lg" className="@container">
    <div className="grid grid-cols-1 @2xl:grid-cols-3 gap-6">
      <div data-testid="debt-summary-owed" className="flex flex-col gap-1.5 min-w-0">
        <h2 className={LABEL}>Still owed</h2>
        <Money value={remaining} className="text-3xl font-semibold tracking-tight text-expense" />
        <p className="text-sm text-fg-muted">
          of <Money value={total} /> borrowed
        </p>
      </div>

      <div data-testid="debt-summary-paid" className="flex flex-col gap-1.5 min-w-0">
        <h2 className={LABEL}>Paid off</h2>
        <span className="text-3xl font-semibold tracking-tight text-fg">{progressPercent.toFixed(1)}%</span>
        <ProgressBar percent={progressPercent} tone="income" size="md" label="Overall payoff progress" className="mt-1" />
        <p className="text-sm text-fg-muted">
          <Money value={paid} className="font-semibold text-income" /> repaid
        </p>
      </div>

      {plan.showWarning ? (
        <div
          data-testid="debt-summary-plan"
          role="note"
          className="flex flex-col gap-1.5 min-w-0 p-4 rounded-inner border bg-pending-tint border-pending-line text-pending-body"
        >
          <h2 className="flex items-center gap-1.5 text-xs font-semibold text-pending">
            <AlertTriangle aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
            Needed per month to hit every due date
          </h2>
          <Money value={plan.totalRequired} className="text-2xl font-semibold tracking-tight" />
          {/* Audit 009 finding 1: worded as the Dashboard's banner. A gap
              against no surplus would only repeat the total. */}
          <p className="text-sm">
            {plan.surplus > 0 ? (
              <>
                <Money value={plan.shortfall} className="font-semibold" /> more than the past 30 days&apos; surplus of{' '}
                <Money value={plan.surplus} className="font-semibold" />
              </>
            ) : (
              <>
                The past 30 days left no surplus (<Money value={plan.surplus} className="font-semibold" />)
              </>
            )}
          </p>
        </div>
      ) : (
        <Inset className="p-4 flex flex-col gap-1.5 min-w-0">
          <div data-testid="debt-summary-plan" className="contents">
            <h2 className="text-xs font-semibold text-income">On track</h2>
            {plan.totalRequired > 0 ? (
              <>
                <Money value={plan.totalRequired} className="text-2xl font-semibold tracking-tight text-fg" />
                <p className="text-sm text-fg-muted">a month meets every due date, within what you have left over</p>
              </>
            ) : (
              <p className="text-sm text-fg-muted">No due dates to plan for.</p>
            )}
          </div>
        </Inset>
      )}
    </div>
  </Card>
);
