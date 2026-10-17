import React from 'react';
import { Card, Inset } from '../ui/Card';
import { Button } from '../ui/Button';
import { Money } from '../ui/Money';
import { ProgressBar } from '../ui/ProgressBar';
import { DebtWarningBanner } from './DebtWarningBanner';
import { DashboardLink } from './DashboardLink';
import { payoffPercent, type DebtPlan } from '../../selectors/debts';
import { formatCurrencyAmount } from '../../utils/currency';
import { formatShortDate } from '../../utils/date';

interface DebtPayoffCardProps {
  plan: DebtPlan;
  /** `useDebts().metrics`: principal paid and owed across every debt that is not deleted. */
  paid: number;
  total: number;
  progressPercent: number;
  onOpenDebts: () => void;
}

/**
 * Dashboard redesign row 2 (owner spec 4.3): overall progress, Needed this month,
 * the surplus warning when it applies, and each active debt with what it needs
 * a month to be cleared by its due date (L4).
 *
 * Ids use the `dashboard-debt-` prefix. The Debt Payoff page's `debt-card-`,
 * `open-repay-modal-` and `settle-debt-` prefixes are its own: specs filter on
 * them right after a tab switch, while this view may still be leaving.
 */
export const DebtPayoffCard: React.FC<DebtPayoffCardProps> = ({ plan, paid, total, progressPercent, onOpenDebts }) => (
  <section aria-labelledby="dashboard-debts-title" className="min-w-0 h-full">
    <Card className="h-full flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="dashboard-debts-title" className="text-base font-semibold text-fg">
          Debt payoff
        </h2>
        <DashboardLink id="dashboard-all-debts-btn" onClick={onOpenDebts}>
          All debts
        </DashboardLink>
      </div>

      {plan.items.length === 0 ? (
        <p className="text-sm text-fg-muted py-6 text-center">No active debts.</p>
      ) : (
        <>
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-2xl font-semibold text-income">
                {progressPercent.toFixed(1)}%<span className="text-sm font-normal text-fg-secondary"> paid off</span>
              </p>
              <p className="text-xs text-fg-muted">
                <Money value={paid} /> of <Money value={total} />
              </p>
            </div>
            <ProgressBar percent={progressPercent} tone="income" size="md" label="Overall payoff progress" />
          </div>

          <Inset className="px-4 py-3 flex items-center justify-between gap-4">
            <span className="text-sm text-fg-secondary">Needed this month</span>
            <Money value={plan.totalRequired} className="text-base font-semibold text-expense" />
          </Inset>

          <DebtWarningBanner plan={plan} onReviewPlan={onOpenDebts} />

          <ul className="flex flex-col gap-3">
            {plan.items.map((item) => {
              const { debt } = item;
              // Nothing borrowed is paid off, as on the Debt payoff page (ADR 0080).
              const percent = payoffPercent(debt.totalAmount, debt.remainingAmount, 100);
              return (
                <li key={debt.id}>
                  <Inset className="px-4 py-3.5 border border-line flex flex-col gap-2.5">
                    <div id={`dashboard-debt-${debt.id}`} className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold text-fg truncate">{debt.name}</span>
                      <Money value={-debt.remainingAmount} className="shrink-0 text-sm font-semibold text-expense" />
                    </div>
                    <ProgressBar percent={percent} tone="income" size="sm" label={`${debt.name} payoff progress`} />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
                      <span className={item.overdue ? 'font-semibold text-expense' : 'text-fg-muted'}>
                        {item.overdue ? 'Overdue' : `${percent.toFixed(1)}%`}
                        {debt.dueDate ? ` · due ${formatShortDate(debt.dueDate)}` : ' · no due date'}
                      </span>
                      {item.required !== null && (
                        <span className={item.exceedsSurplus ? 'font-medium text-pending' : 'text-fg-secondary'}>
                          {formatCurrencyAmount(item.required)} / month needed
                        </span>
                      )}
                    </div>
                  </Inset>
                </li>
              );
            })}
          </ul>

          <Button id="dashboard-repay-btn" variant="soft" block onClick={onOpenDebts} className="mt-auto">
            Make a repayment
          </Button>
        </>
      )}
    </Card>
  </section>
);
