import React, { useState } from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import type { Category, Transaction, Wallet } from '../../types';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { TransactionRow } from '../transaction/TransactionRow';
import { DayGroupHeader } from '../transaction/DayGroupHeader';
import { ActivityItem, describeAdjustmentPair } from '../../selectors/adjustments';
import { DashboardLink } from './DashboardLink';

interface RecentActivityCardProps {
  /** The newest activity, already folded by `foldAdjustmentPairs` (L8) and cut to length, newest first. */
  items: ActivityItem[];
  /** Each day's L11 net over all of that day's rows (`groupByDay`), not only the ones shown. */
  dayNets: ReadonlyMap<string, number>;
  wallets: ReadonlyMap<string, Wallet>;
  categories: ReadonlyMap<string, Category>;
  today: string;
  onViewAll: () => void;
}

function itemDate(item: ActivityItem): string {
  return item.kind === 'tx' ? item.tx.transactionDate.slice(0, 10) : item.date;
}

/** Consecutive items that share a day, in order. The items arrive newest first, so each day appears once. */
function byDay(items: ActivityItem[]): { date: string; items: ActivityItem[] }[] {
  const days: { date: string; items: ActivityItem[] }[] = [];
  for (const item of items) {
    const date = itemDate(item);
    const last = days[days.length - 1];
    if (last && last.date === date) last.items.push(item);
    else days.push({ date, items: [item] });
  }
  return days;
}

/**
 * Spec 6.1 item 6: the newest activity grouped by day (L11), with a balance
 * adjustment that was immediately undone folded into one row that expands
 * (L8). The Transactions page still lists both rows of a pair.
 *
 * Rows are `TransactionRow`s without `onSelect`, so they are not buttons yet:
 * editing a row arrives with the Transactions page's editor. Each shows its
 * description exactly once, which `transaction.spec.ts` and
 * `storage-persistence.spec.ts` rely on.
 */
export const RecentActivityCard: React.FC<RecentActivityCardProps> = ({
  items,
  dayNets,
  wallets,
  categories,
  today,
  onViewAll,
}) => {
  const [openPairs, setOpenPairs] = useState<ReadonlySet<string>>(() => new Set());

  const togglePair = (key: string) =>
    setOpenPairs((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const row = (tx: Transaction) => (
    <TransactionRow
      key={tx.id}
      tx={tx}
      category={tx.categoryId ? categories.get(tx.categoryId) : undefined}
      wallets={wallets}
      className="rounded-control"
    />
  );

  return (
    <Card padding="none" className="h-full flex flex-col">
      <div className="flex items-baseline justify-between gap-4 px-6 pt-6 pb-3">
        <h2 className="text-base font-semibold text-fg">Recent activity</h2>
        <DashboardLink id="dashboard-view-all-transactions-btn" onClick={onViewAll}>
          View all
        </DashboardLink>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={History} title="No transactions recorded yet" subtitle="Your latest activity will show here." />
      ) : (
        <div className="flex flex-col gap-1 px-2 pb-3">
          {byDay(items).map((day) => (
            <div key={day.date} className="flex flex-col">
              <DayGroupHeader date={day.date} today={today} net={dayNets.get(day.date) ?? 0} className="rounded-control" />
              {day.items.map((item) => {
                if (item.kind === 'tx') return row(item.tx);
                const key = `${item.walletId}-${item.date}`;
                const isOpen = openPairs.has(key);
                const walletName = wallets.get(item.walletId)?.name ?? 'a wallet';
                return (
                  <div key={`pair-${key}`} className="flex flex-col">
                    <button
                      id={`dashboard-adjustment-pair-${key}`}
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => togglePair(key)}
                      className="mx-2 my-1.5 min-h-[44px] flex items-center gap-3 px-3 py-2 rounded-control border border-dashed border-line-strong text-left text-sm text-fg-muted hover:text-fg transition-control duration-150 cursor-pointer"
                    >
                      {isOpen ? (
                        <ChevronUp aria-hidden="true" className="w-4 h-4 shrink-0" />
                      ) : (
                        <ChevronDown aria-hidden="true" className="w-4 h-4 shrink-0" />
                      )}
                      <span className="flex-1 min-w-0">{describeAdjustmentPair(walletName)}</span>
                    </button>
                    {isOpen && item.transactions.map(row)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
