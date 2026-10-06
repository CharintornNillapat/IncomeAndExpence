import React from 'react';
import { Check, CreditCard, Pencil, Trash2 } from 'lucide-react';
import { Debt } from '../../types';
import { payoffPercent, type DebtPlanItem } from '../../selectors/debts';
import { formatShortDate } from '../../utils/date';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Inset } from '../ui/Card';
import { Money } from '../ui/Money';
import { OverflowMenu } from '../ui/OverflowMenu';
import { ProgressBar } from '../ui/ProgressBar';

interface DebtCardProps {
  debt: Debt;
  /** The debt's L4/L5 figures; absent for a paid-off debt, which `debtPlan` leaves out. */
  planItem?: DebtPlanItem;
  onOpenRepay: (debt: Debt) => void;
  onSettle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const TAG = 'inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-sm';

function dueTag(debt: Debt, planItem?: DebtPlanItem): { text: string; className: string } | null {
  if (debt.isSettled) return null;
  if (!debt.dueDate) return { text: 'No due date', className: 'bg-surface-3 text-fg-secondary' };
  const date = formatShortDate(debt.dueDate);
  if (planItem?.overdue) return { text: `Overdue · due ${date}`, className: 'bg-expense-tint text-expense' };
  const months = planItem?.monthsLeft;
  const left = months ? ` · ~${months} ${months === 1 ? 'month' : 'months'}` : '';
  // L5: a debt that alone needs more a month than the surplus is a problem to fix.
  return {
    text: `Due ${date}${left}`,
    className: planItem?.exceedsSurplus ? 'bg-pending-tint text-pending-body' : 'bg-surface-3 text-fg',
  };
}

/**
 * Spec 6.4: one debt. Its tags, what is still owed at 28px in red, the share
 * of the borrowed total paid off, then Borrowed, Repaid and Needed / month.
 * Make repayment records a payment from a wallet; Mark as paid off writes the
 * debt off after a confirmation in `DebtsView`. Edit and Delete sit in the ⋯
 * menu (spec 4.14).
 *
 * A paid-off card keeps "100% Fully Settled!" and "✓ Debt Fully Settled",
 * which `debts.spec.ts` and `soft-delete.spec.ts` read, and has no actions
 * but the menu.
 */
export const DebtCard: React.FC<DebtCardProps> = React.memo(({ debt, planItem, onOpenRepay, onSettle, onEdit, onDelete }) => {
  // A paid-off debt is 100% whatever its stored remainder, and so is one with nothing borrowed (ADR 0079).
  const remaining = debt.isSettled ? 0 : debt.remainingAmount;
  const repaid = debt.totalAmount - remaining;
  const percent = payoffPercent(debt.totalAmount, remaining, 100);
  const tag = dueTag(debt, planItem);

  return (
    <div id={`debt-card-${debt.id}`} className="@container bg-surface-1 rounded-card border border-line p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-2">
          <h3 className="text-base font-semibold text-fg break-words">{debt.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge size="md">{debt.interestRate ? `${debt.interestRate}% APR` : 'Interest-free'}</Badge>
            {tag && <span className={`${TAG} ${tag.className}`}>{tag.text}</span>}
            {debt.isSettled && <span className="text-[11px] font-semibold text-income">100% Fully Settled!</span>}
          </div>
        </div>
        <OverflowMenu
          label={`More actions for ${debt.name}`}
          triggerId={`debt-menu-btn-${debt.id}`}
          className="-mr-2 -mt-2 shrink-0"
          items={[
            { id: `edit-debt-${debt.id}`, label: 'Edit debt', icon: <Pencil aria-hidden="true" className="w-4 h-4" />, onSelect: () => onEdit(debt.id) },
            {
              id: `delete-debt-${debt.id}`,
              label: 'Delete debt…',
              tone: 'danger',
              icon: <Trash2 aria-hidden="true" className="w-4 h-4" />,
              onSelect: () => onDelete(debt.id),
            },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-fg-muted">Still owed</span>
        <Money value={remaining} className={`text-[28px] leading-none font-semibold tracking-tight ${remaining > 0 ? 'text-expense' : 'text-fg'}`} />
        <div className="flex items-center gap-3 mt-1">
          <ProgressBar percent={percent} tone="income" size="md" label={`${debt.name} payoff progress`} className="flex-1" />
          <span className="text-xs font-semibold text-fg shrink-0">{percent.toFixed(1)}% paid</span>
        </div>
      </div>

      <dl className="grid grid-cols-1 @sm:grid-cols-3 gap-2">
        <Inset className="px-3.5 py-2.5 flex @sm:flex-col items-baseline @sm:items-start justify-between gap-x-3 gap-y-0.5 min-w-0">
          <dt className="text-xs text-fg-muted">Borrowed</dt>
          <dd><Money value={debt.totalAmount} className="text-sm font-semibold text-fg" /></dd>
        </Inset>
        <Inset className="px-3.5 py-2.5 flex @sm:flex-col items-baseline @sm:items-start justify-between gap-x-3 gap-y-0.5 min-w-0">
          <dt className="text-xs text-fg-muted">Repaid</dt>
          <dd><Money value={repaid} className="text-sm font-semibold text-income" /></dd>
        </Inset>
        <Inset className="px-3.5 py-2.5 flex @sm:flex-col items-baseline @sm:items-start justify-between gap-x-3 gap-y-0.5 min-w-0">
          <dt className="text-xs text-fg-muted">Needed / month</dt>
          <dd className="text-sm font-semibold">
            {debt.isSettled ? (
              <span className="text-fg-secondary">Paid off</span>
            ) : planItem?.required != null ? (
              <Money value={planItem.required} className={planItem.exceedsSurplus ? 'text-pending' : 'text-fg'} />
            ) : (
              <span className="text-fg-secondary">No due date</span>
            )}
          </dd>
        </Inset>
      </dl>

      {debt.isSettled ? (
        <div className="text-center py-2 text-xs font-semibold text-income bg-income-tint rounded-inner">
          ✓ Debt Fully Settled
        </div>
      ) : (
        <div className="flex flex-col @sm:flex-row gap-2 mt-auto">
          <Button
            id={`open-repay-modal-${debt.id}`}
            className="flex-1"
            onClick={() => onOpenRepay(debt)}
            icon={<CreditCard aria-hidden="true" className="w-4 h-4" />}
          >
            Make repayment
          </Button>
          <Button
            id={`settle-debt-${debt.id}`}
            variant="secondary"
            className="flex-1"
            onClick={() => onSettle(debt.id)}
            icon={<Check aria-hidden="true" className="w-4 h-4" />}
          >
            Mark as paid off
          </Button>
        </div>
      )}
    </div>
  );
});

DebtCard.displayName = 'DebtCard';
