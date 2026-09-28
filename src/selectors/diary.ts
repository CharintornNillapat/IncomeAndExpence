import { DiaryEntry, Transaction } from '../types';
import { CategoryLookup, sumSpending } from './ledger';
import { TimeRange, inRange, rangeBounds } from './timeRange';

export interface MoodDay {
  /** Local calendar day, `YYYY-MM-DD`. */
  date: string;
  /** 1 to 5. */
  mood: number;
  /** That day's spending on the L1 definition. */
  spending: number;
}

export interface MoodSpending {
  /** The newest days, at most `MOOD_DAYS_SHOWN`. */
  days: MoodDay[];
  /** Every live entry in the range, so the card can say how few days are logged. */
  loggedCount: number;
}

/** How many days the Dashboard's Mood & spending card lists. */
export const MOOD_DAYS_SHOWN = 5;

/**
 * The Dashboard's Mood & spending card (spec 6.1): the diary days logged in
 * the page's range, newest first, each with what was spent that day. Spending
 * comes from `sumSpending`, so a repayment or a transfer on a diary day does
 * not read as a bad day.
 */
export function moodSpendingDays(
  entries: DiaryEntry[],
  txs: Transaction[],
  categories: CategoryLookup,
  range: TimeRange,
  today: string
): MoodSpending {
  const bounds = rangeBounds(range, today);
  const logged = entries
    .filter((entry) => !entry.isDeleted && inRange(entry.date, bounds))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const days = logged.slice(0, MOOD_DAYS_SHOWN).map((entry) => ({
    date: entry.date,
    mood: entry.mood,
    spending: sumSpending(
      txs.filter((tx) => tx.transactionDate.slice(0, 10) === entry.date),
      categories
    ),
  }));

  return { days, loggedCount: logged.length };
}
