import { Debt, Transaction } from '../types';
import { roundToCents } from '../utils/money';
import { CategoryLookup, sumIncome, sumSpending } from './ledger';
import { filterByRange } from './timeRange';
import { isActiveDebt } from './wallets';

/**
 * Spec L4 and L5 (ADR 0028): what each debt needs per month to be cleared by
 * its due date, and whether the plan fits in what the user has left over.
 * "Today" is an argument; dates are compared as ISO strings.
 */

/**
 * Full months left before the due month: `max(1, months between the two
 * calendar months - 1)`. The day of the month plays no part on either side,
 * and a debt due this month, next month or in the past has one month left -
 * so an overdue debt needs its whole remainder.
 */
export function monthsLeft(dueDate: string, today: string): number {
  const [dueYear, dueMonth] = dueDate.split('-').map(Number);
  const [year, month] = today.split('-').map(Number);
  return Math.max(1, (dueYear - year) * 12 + (dueMonth - month) - 1);
}

/** Past its due date and still owed. Not overdue on the due date itself. */
export function isOverdue(debt: Debt, today: string): boolean {
  return isActiveDebt(debt) && !!debt.dueDate && debt.dueDate < today;
}

/**
 * The payment per month that clears the debt by its due date, to the cent.
 * `null` when there is nothing to plan: no due date, or a settled or deleted
 * debt.
 */
export function requiredMonthly(debt: Debt, today: string): number | null {
  if (!isActiveDebt(debt) || !debt.dueDate) return null;
  return roundToCents(Math.max(0, debt.remainingAmount) / monthsLeft(debt.dueDate, today));
}

/**
 * The share of what was borrowed that is paid off, in percent, unclamped
 * (ADR 0079). With nothing borrowed there is no share, so it is
 * `ifNothingBorrowed`: the Debt payoff page reads such a debt as 100% and the
 * Dashboard as 0%, and each caller passes its own.
 */
export function payoffPercent(total: number, remaining: number, ifNothingBorrowed: number): number {
  return total > 0 ? ((total - remaining) / total) * 100 : ifNothingBorrowed;
}

/** Nearest due date first; debts with no due date last, in their given order. Returns a new array. */
export function sortByDueDate<T extends Pick<Debt, 'dueDate'>>(debts: T[]): T[] {
  return debts
    .map((debt, index) => ({ debt, index }))
    .sort((a, b) => {
      const x = a.debt.dueDate;
      const y = b.debt.dueDate;
      if (x && y && x !== y) return x < y ? -1 : 1;
      if (x && !y) return -1;
      if (!x && y) return 1;
      return a.index - b.index;
    })
    .map(({ debt }) => debt);
}

export interface DebtPlanItem {
  debt: Debt;
  monthsLeft: number | null;
  required: number | null;
  overdue: boolean;
  /** This one debt alone needs more per month than the surplus (spec L5: show its "Needed / month" as a warning). */
  exceedsSurplus: boolean;
}

export interface DebtPlan {
  /** Active debts, nearest due date first. */
  items: DebtPlanItem[];
  /** The sum of the rounded per-debt figures, so the total equals the rows a user sees. */
  totalRequired: number;
  surplus: number;
  /** How much the plan outruns the surplus; 0 when it fits. */
  shortfall: number;
  showWarning: boolean;
}

export function debtPlan(debts: Debt[], today: string, surplus: number): DebtPlan {
  const items = sortByDueDate(debts.filter(isActiveDebt)).map((debt): DebtPlanItem => {
    const required = requiredMonthly(debt, today);
    return {
      debt,
      monthsLeft: debt.dueDate ? monthsLeft(debt.dueDate, today) : null,
      required,
      overdue: isOverdue(debt, today),
      exceedsSurplus: required !== null && required > surplus,
    };
  });
  const totalRequired = roundToCents(items.reduce((sum, item) => sum + (item.required ?? 0), 0));
  return {
    items,
    totalRequired,
    surplus,
    shortfall: Math.max(0, roundToCents(totalRequired - surplus)),
    showWarning: totalRequired > 0 && totalRequired > surplus,
  };
}

/** Spec L5's surplus: income minus spending (L1) over the past-30-days range (L2). */
export function monthlySurplus(txs: Transaction[], today: string, categories?: CategoryLookup): number {
  const recent = filterByRange(txs, 'MONTH', today);
  return roundToCents(sumIncome(recent, categories) - sumSpending(recent, categories));
}
