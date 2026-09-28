import React from 'react';
import { WarningBanner } from '../ui/WarningBanner';
import { Money } from '../ui/Money';
import type { DebtPlan } from '../../selectors/debts';
import { formatShortDate } from '../../utils/date';

interface DebtWarningBannerProps {
  plan: DebtPlan;
  onReviewPlan: () => void;
}

const Strong: React.FC<{ value: number }> = ({ value }) => <Money value={value} className="font-semibold text-fg" />;

/**
 * Spec L5 on the Dashboard: shown only when the debts' monthly needs outrun
 * the surplus of the past 30 days (`debtPlan().showWarning`). When exactly
 * one debt needs more than the surplus by itself, it is named with its due
 * date, as in the mockup; otherwise the banner states the combined figure.
 */
export const DebtWarningBanner: React.FC<DebtWarningBannerProps> = ({ plan, onReviewPlan }) => {
  if (!plan.showWarning) return null;

  const culprits = plan.items.filter((item) => item.exceedsSurplus);
  const single = culprits.length === 1 ? culprits[0] : null;
  const surplusText =
    plan.surplus > 0 ? (
      <>
        more than the past 30 days&apos; surplus of <Strong value={plan.surplus} />
      </>
    ) : (
      <>
        while the past 30 days left no surplus (<Strong value={plan.surplus} />)
      </>
    );

  return (
    <WarningBanner
      data-testid="dashboard-debt-warning"
      className="text-sm"
      action={{ label: 'Review plan', onClick: onReviewPlan }}
    >
      {single && single.required !== null ? (
        <>
          {single.debt.name} needs <Strong value={single.required} /> a month
          {single.debt.dueDate ? ` to be cleared by ${formatShortDate(single.debt.dueDate)}` : ''}, {surplusText}.
        </>
      ) : (
        <>
          Your debts need <Strong value={plan.totalRequired} /> a month together, {surplusText}.
        </>
      )}
    </WarningBanner>
  );
};
