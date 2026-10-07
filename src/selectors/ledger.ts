import { Category, Transaction } from '../types';
import { roundToCents } from '../utils/money';

/**
 * Spec L1 and L11 (ADR 0028): the one definition of spending and income.
 *
 * Every screen that shows a spending or income figure reads it from here.
 * Before Phase 55b the dashboard's Expense card, its category chart, the
 * monthly insights and the diary each filtered on their own, and two of them
 * counted debt repayments as spending while the card did not.
 */

export type CategoryLookup = ReadonlyMap<string, Category>;

/**
 * A category that records money moving rather than money earned or spent: the
 * system Debt Repayment and Balance Adjustment categories. Matched by type, not
 * id, because a signed-in account's rows carry uuids.
 */
export function isMovementCategory(category: Category | undefined): boolean {
  return category?.type === 'DEBT_REPAYMENT' || category?.type === 'ADJUSTMENT';
}

function categoryOf(tx: Transaction, categories?: CategoryLookup): Category | undefined {
  return tx.categoryId ? categories?.get(tx.categoryId) : undefined;
}

/**
 * A live EXPENSE, unless it was filed under a movement category - stored rows
 * do (the entry form's select was unfiltered before ADR 0084, and an edit or a
 * CSV import still is), so an EXPENSE can carry "Debt Repayment". A transfer,
 * a repayment and an adjustment are never spending, whatever their sign.
 */
export function isSpending(tx: Transaction, categories?: CategoryLookup): boolean {
  return !tx.isDeleted && tx.type === 'EXPENSE' && !isMovementCategory(categoryOf(tx, categories));
}

/** A live INCOME, on the same terms as `isSpending`. */
export function isIncome(tx: Transaction, categories?: CategoryLookup): boolean {
  return !tx.isDeleted && tx.type === 'INCOME' && !isMovementCategory(categoryOf(tx, categories));
}

function sumWhere(txs: Transaction[], keep: (tx: Transaction) => boolean): number {
  let total = 0;
  for (const tx of txs) if (keep(tx)) total += tx.amount;
  return roundToCents(total);
}

export function sumSpending(txs: Transaction[], categories?: CategoryLookup): number {
  return sumWhere(txs, (tx) => isSpending(tx, categories));
}

export function sumIncome(txs: Transaction[], categories?: CategoryLookup): number {
  return sumWhere(txs, (tx) => isIncome(tx, categories));
}

export interface CashFlow {
  income: number;
  spending: number;
  /** Income minus spending; negative when spending passed income. */
  leftOver: number;
  /** Spending as a share of income, or `null` when there was no income to share. Not clamped. */
  spentPercent: number | null;
}

/**
 * The Dashboard's Cash flow card (spec 6.1). The same two sums as every other
 * screen, so its Spending is the category chart's total to the cent.
 */
export function cashFlow(txs: Transaction[], categories?: CategoryLookup): CashFlow {
  const income = sumIncome(txs, categories);
  const spending = sumSpending(txs, categories);
  return {
    income,
    spending,
    leftOver: roundToCents(income - spending),
    spentPercent: income > 0 ? (spending / income) * 100 : null,
  };
}

export interface CategorySpend {
  /** `null` for spending with no category, or one that no longer exists. */
  categoryId: string | null;
  name: string;
  color: string;
  amount: number;
}

export const UNCATEGORIZED_NAME = 'Uncategorized';
/** The spec's system grey (section 1): system categories, and the row that has no category of its own. */
export const SYSTEM_CATEGORY_COLOR = '#6B7385';
export const UNCATEGORIZED_COLOR = SYSTEM_CATEGORY_COLOR;

/**
 * Spending per category, largest first. Grouped by category id, so two
 * categories that share a name stay apart, and every row is `isSpending`, so
 * the rows add up to exactly `sumSpending` - the chart and the total cannot
 * disagree.
 */
export function spendingByCategory(txs: Transaction[], categories: CategoryLookup): CategorySpend[] {
  const byKey = new Map<string, CategorySpend>();
  for (const tx of txs) {
    if (!isSpending(tx, categories)) continue;
    const category = categoryOf(tx, categories);
    const key = category ? category.id : '';
    const row =
      byKey.get(key) ??
      (category
        ? { categoryId: category.id, name: category.name, color: category.color, amount: 0 }
        : { categoryId: null, name: UNCATEGORIZED_NAME, color: UNCATEGORIZED_COLOR, amount: 0 });
    row.amount += tx.amount;
    byKey.set(key, row);
  }
  return Array.from(byKey.values())
    .map((row) => ({ ...row, amount: roundToCents(row.amount) }))
    .sort((a, b) => b.amount - a.amount);
}

export interface DayGroup {
  /** Local calendar day, `YYYY-MM-DD`. */
  date: string;
  transactions: Transaction[];
  /** Spec L11: income minus spending that day. A transfer, a repayment and an adjustment do not move it. */
  net: number;
}

/** Rows grouped by day, newest day first, each day in its given order and with its L11 net. */
export function groupByDay(txs: Transaction[], categories?: CategoryLookup): DayGroup[] {
  const byDate = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const date = tx.transactionDate.slice(0, 10);
    const bucket = byDate.get(date);
    if (bucket) bucket.push(tx);
    else byDate.set(date, [tx]);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, transactions]) => ({
      date,
      transactions,
      net: roundToCents(sumIncome(transactions, categories) - sumSpending(transactions, categories)),
    }));
}
