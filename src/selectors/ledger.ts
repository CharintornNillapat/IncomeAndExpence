import { Category, Transaction } from '../types';
import { roundToCents } from '../utils/money';
import { monthKeyOf, shiftIsoDate } from '../utils/date';
import { filterByRange, inRange, TimeRange } from './timeRange';

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

export interface LeftOver extends CashFlow {
  /** Left over as a share of income, or `null` with no income. Not clamped: negative when spending passed income. */
  keptPercent: number | null;
  /** The bar's spent part, 0 to 100: 100 when spending reached or passed income, 0 with neither income nor spending. */
  spentShare: number;
  /** The bar's kept part, `100 - spentShare` when there is income, else 0. */
  keptShare: number;
  /** Left over minus what the debts need this month; MONTH only, else `null`. */
  afterDebtDue: number | null;
}

/**
 * The Dashboard's Left over card (owner spec 5.1, ADR 0102) for one period.
 * `neededThisMonth` is `debtPlan(...).totalRequired`, passed in so the plan is
 * computed once in `DashboardView` (D5).
 */
export function leftOverFor(
  txs: Transaction[],
  range: TimeRange,
  today: string,
  neededThisMonth: number,
  categories?: CategoryLookup
): LeftOver {
  const flow = cashFlow(filterByRange(txs, range, today), categories);
  const spentShare = flow.leftOver <= 0 && flow.spending > 0 ? 100 : flow.income > 0 ? (flow.spending / flow.income) * 100 : 0;
  return {
    ...flow,
    keptPercent: flow.income > 0 ? (flow.leftOver / flow.income) * 100 : null,
    spentShare,
    keptShare: flow.income > 0 ? 100 - spentShare : 0,
    afterDebtDue: range === 'MONTH' ? roundToCents(flow.leftOver - neededThisMonth) : null,
  };
}

export interface MonthToDateSide {
  /** First and last local day counted, `YYYY-MM-DD`, both inclusive. */
  start: string;
  end: string;
  spending: number;
  leftOver: number;
}

export interface MonthToDate {
  /** N: today's day of the month, clamped to last month's length. Both months count days 1 to N. */
  days: number;
  thisMonth: MonthToDateSide;
  lastMonth: MonthToDateSide;
  /** Spending's change on last month, in percent; `null` when last month spent nothing. */
  spendingChange: number | null;
  /** Left over's change, in percent of the size of last month's, so up means better even from a negative base; `null` when last month's was 0. */
  leftOverChange: number | null;
}

function percentChange(now: number, before: number): number | null {
  return before === 0 ? null : ((now - before) / Math.abs(before)) * 100;
}

/**
 * The Dashboard's month comparison line (owner spec 5.3, ADR 0102 D4): day 1
 * to N of this month against day 1 to N of last month, N being today's day
 * clamped to last month's length. It ignores the page's period.
 */
export function monthToDate(txs: Transaction[], today: string, categories?: CategoryLookup): MonthToDate {
  const lastMonthEnd = shiftIsoDate(`${monthKeyOf(today)}-01`, -1);
  const days = Math.min(Number(today.slice(8, 10)), Number(lastMonthEnd.slice(8, 10)));
  const side = (monthKey: string): MonthToDateSide => {
    const start = `${monthKey}-01`;
    const end = `${monthKey}-${String(days).padStart(2, '0')}`;
    const flow = cashFlow(txs.filter((tx) => inRange(tx.transactionDate, { start, end })), categories);
    return { start, end, spending: flow.spending, leftOver: flow.leftOver };
  };
  const thisMonth = side(monthKeyOf(today));
  const lastMonth = side(monthKeyOf(lastMonthEnd));
  return {
    days,
    thisMonth,
    lastMonth,
    spendingChange: percentChange(thisMonth.spending, lastMonth.spending),
    leftOverChange: percentChange(thisMonth.leftOver, lastMonth.leftOver),
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

export interface DayTotals {
  income: number;
  spending: number;
  /** Spec L11, the same figure as `groupByDay`'s `net`. */
  net: number;
  /** Every row given for the day: a transfer, a repayment, an adjustment and a deleted row count here. */
  count: number;
}

/**
 * The Transactions Calendar's figures per local day (spec 6, ADR 0109): L1
 * income and spending, the L11 net and the row count. Built on `groupByDay`,
 * so a calendar cell's net is the Table's day row net to the cent.
 */
export function dailyTotals(txs: Transaction[], categories?: CategoryLookup): Map<string, DayTotals> {
  const totals = new Map<string, DayTotals>();
  for (const day of groupByDay(txs, categories)) {
    totals.set(day.date, {
      income: sumIncome(day.transactions, categories),
      spending: sumSpending(day.transactions, categories),
      net: day.net,
      count: day.transactions.length,
    });
  }
  return totals;
}

/**
 * The Calendar's heat shades (spec O3, ADR 0109 D5): a spending day takes
 * 1 to `HEAT_LEVELS`, relative to the month's highest spending day, so no baht
 * threshold is fixed in code. One `heat-N` colour token per level.
 */
export const HEAT_LEVELS = 3;

/**
 * A day's heat, 0 to `HEAT_LEVELS`: `ceil(HEAT_LEVELS * spending / monthMax)`,
 * and 0 when the day or the month spent nothing. Worked in whole cents: in
 * floating point 3 * 0.1 / 0.3 is 1.0000000000000002, which would lift a day
 * at exactly a third to level 2. Comparison only, not ledger rounding.
 */
export function heatLevel(spending: number, monthMax: number): number {
  const day = Math.round(spending * 100);
  const max = Math.round(monthMax * 100);
  if (!(day > 0) || !(max > 0)) return 0;
  return Math.min(HEAT_LEVELS, Math.ceil((HEAT_LEVELS * day) / max));
}

export interface SelectionSummary {
  /** Selected rows found in `rows`; an id with no row there is not counted. */
  count: number;
  /** L1 income minus spending of the selected rows, to the cent. */
  net: number;
  /** A selected row is neither income nor spending (a transfer, a repayment, an adjustment, a movement-category row or a deleted row), so `net` leaves it out. */
  hasUncounted: boolean;
}

/** The Table's bulk bar (spec 4.1 and 6, ADR 0109 D7): what the selection holds and its L1 net. */
export function selectionSummary(
  rows: Transaction[],
  ids: ReadonlySet<string>,
  categories?: CategoryLookup
): SelectionSummary {
  const selected = rows.filter((tx) => ids.has(tx.id));
  return {
    count: selected.length,
    net: roundToCents(sumIncome(selected, categories) - sumSpending(selected, categories)),
    hasUncounted: selected.some((tx) => !isIncome(tx, categories) && !isSpending(tx, categories)),
  };
}
