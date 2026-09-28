import React from 'react';
import { Card, Inset } from '../ui/Card';
import { Button } from '../ui/Button';
import { Money } from '../ui/Money';
import { ProgressBar } from '../ui/ProgressBar';
import type { DebtPlan, DebtPlanItem } from '../../selectors/debts';
import { formatCurrencyAmount } from '../../utils/currency';
import { formatShortDate } from '../../utils/date';
import { DashboardLink } from './DashboardLink';

interface DebtPayoffCardProps {
  plan: DebtPlan;
  /** `useDebts().metrics`: principal paid and owed across every debt that is not deleted. */
  paid: number;
  total: number;
  progressPercent: number;
  onOpenDebts: () => void;
}

function debtProgress(item: DebtPlanItem): number {
  const { totalAmount, remainingAmount } = item.debt;
  return totalAmount > 0 ? ((totalAmount - remainingAmount) / totalAmount) * 100 : 0;
}

/**
 * Spec 6.1 item 5: overall progress, then each active debt with what it needs
 * a month to be cleared by its due date (L4). A debt that needs more than the
 * surplus of the past 30 days shows that figure in the warning colour (L5).
 *
 * Ids use the `dashboard-debt-` prefix. The Debt Payoff page's `debt-card-`,
 * `open-repay-modal-` and `settle-debt-` prefixes are its own: specs filter on
 * them right after a tab switch, while this view may still be leaving.
 */
export const DebtPayoffCard: React.FC<DebtPayoffCardProps> = ({ plan, paid, total, progressPercent, onOpenDebts }) => (
  <Card className="h-full flex flex-col gap-5">
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="text-base font-semibold text-fg">Debt payoff</h2>
      <DashboardLink id="dashboard-all-debts-btn" onClick={onOpenDebts}>
        All debts
      </DashboardLink>
    </div>

    {plan.items.length === 0 ? (
      <p className="text-sm text-fg-muted py-6 text-center">No active debts.</p>
    ) : (
      <>
        <div className="flex flex-col gap-2">
          <p className="flex items-baseline justify-between gap-3 text-sm text-fg-secondary">
            <span>
              <Money value={paid} /> paid of <Money value={total} />
            </span>
            <span className="font-semibold text-fg">{progressPercent.toFixed(1)}%</span>
          </p>
          <ProgressBar percent={progressPercent} tone="income" size="md" label="Overall payoff progress" />
        </div>

        <ul className="flex flex-col gap-3">
          {plan.items.map((item) => {
            const percent = debtProgress(item);
            const { debt } = item;
            return (
              <li key={debt.id}>
                <Inset className="px-4 py-3.5 border border-line flex flex-col gap-2.5">
                  <div id={`dashboard-debt-${debt.id}`} className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-fg truncate">{debt.name}</span>
                    <Money value={-debt.remainingAmount} className="shrink-0 text-sm font-semibold text-expense" />
                  </div>
                  <ProgressBar percent={percent} tone="income" size="sm" label={`${debt.name} payoff progress`} />
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className={item.overdue ? 'font-semibold text-expense' : 'text-fg-muted'}>
                      {item.overdue ? 'Overdue' : `${percent.toFixed(1)}%`}
                      {debt.dueDate ? ` · due ${formatShortDate(debt.dueDate)}` : ' · no due date'}
                    </span>
                    {item.required !== null && (
                      <span className={item.exceedsSurplus ? 'shrink-0 font-medium text-pending' : 'shrink-0 text-fg-secondary'}>
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
);
