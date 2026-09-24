import type {
  Category,
  InsightPattern,
  InsightsResponse,
  SpendingCategorySummary,
  SpendingSummary,
  Transaction,
} from '../types';
import { formatCurrencyAmount } from './currency';
import { roundToCents } from './money';

/*
 * Monthly spending aggregation and the sentence renderer (ADR 0020).
 *
 * Pure. No React, no fetch, no storage. Two responsibilities:
 *
 *   1. Turn the ledger into a privacy-safe aggregate - the ONLY thing that is
 *      ever sent anywhere. See `SpendingSummary` in `types.ts` for what is
 *      deliberately absent.
 *   2. Turn a verdict (whoever chose it - Jev or the local rule below) plus
 *      the app's own numbers into sentences.
 *
 * The split matters: the model picks *which pattern*, never *how much*. Every
 * currency figure below comes from `formatCurrencyAmount` over ledger data, so
 * the card can never contradict `CategoryExpenseDistribution` sitting beside it.
 */

/** A category must move by at least this much to be called a spike. */
const SPIKE_THRESHOLD_PERCENT = 40;

/** Below this, month-over-month movement is noise rather than a trend. */
const MEANINGFUL_CHANGE_PERCENT = 10;

/** At or above this many transactions, a category reads as recurring rather than one-off. */
const RECURRING_TX_COUNT = 3;

/** `YYYY-MM` for a local calendar month. Never `toISOString` - see CLAUDE.md on UTC+7. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** The `YYYY-MM` immediately before `key`. */
function previousMonthKey(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}

/**
 * A transaction's calendar month, read straight off the stored ISO date.
 *
 * `transactionDate` is already a local `YYYY-MM-DD` string (ADR: see
 * `src/utils/date.ts`), so slicing it is correct and constructing a `Date`
 * from it would not be - that parses as UTC midnight and shifts the month
 * boundary at UTC+7.
 */
function txMonth(tx: Transaction): string {
  return tx.transactionDate.slice(0, 7);
}

/**
 * Aggregates two calendar months of spending into the payload.
 *
 * Only EXPENSE and DEBT_REPAYMENT count toward category spending, matching
 * what `DashboardView` already shows. TRANSFER is excluded on purpose: it
 * moves money between the user's own wallets and spends nothing.
 */
export function buildSpendingSummary(
  transactions: Transaction[],
  categories: Category[],
  now: Date = new Date()
): SpendingSummary {
  const current = monthKey(now);
  const previous = previousMonthKey(current);

  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  const currentByCategory = new Map<string, { total: number; count: number }>();
  const previousByCategory = new Map<string, number>();

  let income = 0;
  let expense = 0;
  let previousExpense = 0;

  for (const tx of transactions) {
    if (tx.isDeleted) continue;
    const month = txMonth(tx);
    if (month !== current && month !== previous) continue;

    const isSpend = tx.type === 'EXPENSE' || tx.type === 'DEBT_REPAYMENT';

    if (month === current) {
      if (tx.type === 'INCOME') income += tx.amount;
      if (isSpend) expense += tx.amount;
    } else if (isSpend) {
      previousExpense += tx.amount;
    }

    if (!isSpend) continue;

    // An uncategorized row still counts toward the totals; it just cannot be
    // the focus of a verdict, so it is bucketed under a name the model can
    // reason about as little as the user can.
    const name = (tx.categoryId && nameById.get(tx.categoryId)) || 'Uncategorized';

    if (month === current) {
      const entry = currentByCategory.get(name) ?? { total: 0, count: 0 };
      entry.total += tx.amount;
      entry.count += 1;
      currentByCategory.set(name, entry);
    } else {
      previousByCategory.set(name, (previousByCategory.get(name) ?? 0) + tx.amount);
    }
  }

  const hasPreviousMonth = previousByCategory.size > 0 || previousExpense > 0;

  const summaryCategories: SpendingCategorySummary[] = Array.from(currentByCategory.entries())
    .map(([name, entry]) => {
      const prior = roundToCents(previousByCategory.get(name) ?? 0);
      const curr = roundToCents(entry.total);
      return {
        name,
        current: curr,
        previous: prior,
        // `null` rather than a fabricated 100%: a first-ever month has nothing
        // to compare against, and saying "up 100%" would be an invention.
        changePercent: !hasPreviousMonth || prior === 0 ? null : roundToCents(((curr - prior) / prior) * 100),
        txCount: entry.count,
      };
    })
    .sort((a, b) => b.current - a.current);

  return {
    month: current,
    categories: summaryCategories,
    totals: {
      income: roundToCents(income),
      expense: roundToCents(expense),
      net: roundToCents(income - expense),
      previousExpense: roundToCents(previousExpense),
    },
  };
}

/**
 * The deterministic pattern selector - the offline half of ADR 0020.
 *
 * Drives the exact same renderer the model's verdict does, which is what
 * makes "the card never shows an error state" true by construction: there is
 * no failure path, only a path where the verdict came from here instead.
 */
export function selectLocalPattern(summary: SpendingSummary): InsightsResponse {
  const { categories, totals } = summary;

  const biggestRise = categories
    .filter((c) => c.changePercent !== null && c.changePercent >= SPIKE_THRESHOLD_PERCENT)
    .sort((a, b) => b.current - a.current)[0];
  if (biggestRise) {
    return { pattern: 'CATEGORY_SPIKE', focus: biggestRise.name, confidence: 1 };
  }

  // A category with no prior spend at all, appearing often enough to look like
  // a habit rather than a one-off purchase.
  const newRecurring = categories.find((c) => c.previous === 0 && c.txCount >= RECURRING_TX_COUNT);
  if (newRecurring) {
    return { pattern: 'NEW_RECURRING', focus: newRecurring.name, confidence: 1 };
  }

  if (
    totals.previousExpense > 0 &&
    totals.expense < totals.previousExpense &&
    ((totals.previousExpense - totals.expense) / totals.previousExpense) * 100 >= MEANINGFUL_CHANGE_PERCENT
  ) {
    return { pattern: 'IMPROVED_SAVING', focus: null, confidence: 1 };
  }

  return { pattern: 'STEADY', focus: categories[0]?.name ?? null, confidence: 1 };
}

function percentLabel(value: number): string {
  return `${Math.abs(Math.round(value))}%`;
}

/**
 * Renders the verdict into two or three sentences.
 *
 * Every figure here is computed from `summary`, never taken from the model.
 * A verdict naming a category that is not in the summary falls back to the
 * whole-month phrasing rather than printing a name the ledger cannot support.
 */
export function renderInsight(summary: SpendingSummary, verdict: InsightsResponse): string[] {
  const { categories, totals } = summary;
  const focus = verdict.focus ? categories.find((c) => c.name === verdict.focus) ?? null : null;

  const spendLine = `You spent ${formatCurrencyAmount(totals.expense)} this month across ${categories.length} ${
    categories.length === 1 ? 'category' : 'categories'
  }.`;

  const netLine =
    totals.net >= 0
      ? `Income covered it with ${formatCurrencyAmount(totals.net)} left over.`
      : `That is ${formatCurrencyAmount(Math.abs(totals.net))} more than came in.`;

  switch (verdict.pattern) {
    case 'CATEGORY_SPIKE': {
      if (!focus || focus.changePercent === null) break;
      return [
        spendLine,
        `${focus.name} stands out: ${formatCurrencyAmount(focus.current)}, up ${percentLabel(
          focus.changePercent
        )} from ${formatCurrencyAmount(focus.previous)} last month.`,
        netLine,
      ];
    }

    case 'NEW_RECURRING': {
      if (!focus) break;
      return [
        spendLine,
        `${focus.name} is new this month and already appears ${focus.txCount} times, totalling ${formatCurrencyAmount(
          focus.current
        )} — worth checking whether it is becoming a regular cost.`,
        netLine,
      ];
    }

    case 'IMPROVED_SAVING': {
      const saved = roundToCents(totals.previousExpense - totals.expense);
      if (saved <= 0) break;
      return [
        spendLine,
        `That is ${formatCurrencyAmount(saved)} less than last month's ${formatCurrencyAmount(
          totals.previousExpense
        )} — a real improvement.`,
        netLine,
      ];
    }

    case 'STEADY':
    default:
      break;
  }

  // The STEADY phrasing, and the safety net for a verdict the numbers cannot
  // support. Never an error, never an empty card.
  const top = focus ?? categories[0] ?? null;
  return [
    spendLine,
    top
      ? `${top.name} led at ${formatCurrencyAmount(top.current)}, with no unusual movement anywhere else.`
      : 'There is no spending recorded this month yet.',
    netLine,
  ];
}

/** Whether there is enough ledger to say anything at all. */
export function hasEnoughData(summary: SpendingSummary): boolean {
  return summary.categories.length > 0 || summary.totals.income > 0;
}

/** Convenience for the card: verdict in, sentences out. */
export function renderLocalInsight(summary: SpendingSummary): string[] {
  return renderInsight(summary, selectLocalPattern(summary));
}

export type { InsightPattern };
