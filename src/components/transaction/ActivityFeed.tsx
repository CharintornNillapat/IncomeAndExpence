import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Category, Transaction, Wallet } from '../../types';
import { TransactionRow } from './TransactionRow';
import { DayGroupHeader } from './DayGroupHeader';
import { ActivityItem, describeAdjustmentPair } from '../../selectors/adjustments';

interface ActivityFeedProps {
  /** The activity to show, already folded by `foldAdjustmentPairs` (L8) and cut to length, newest first. */
  items: ActivityItem[];
  /** Each day's L11 net over all of that day's rows (`groupByDay`), not only the ones shown. */
  dayNets: ReadonlyMap<string, number>;
  wallets: ReadonlyMap<string, Wallet>;
  categories: ReadonlyMap<string, Category>;
  today: string;
  /**
   * The page's own id prefix: rows are `{idPrefix}-tx-{id}` and pair toggles
   * `{idPrefix}-adjustment-pair-{walletId}-{date}`. Never `tx-row`: specs
   * match `tx-row-` page-wide right after a tab switch (CLAUDE.md, Do NOT).
   */
  idPrefix: 'dashboard' | 'wallet';
  /** One wallet's own view (spec 4.8): a transfer is signed by its direction into or out of this wallet. */
  walletId?: string;
  /** Opens the row on the Transactions page with its edit panel (Phase 58b). Without it the rows are plain text. */
  onOpenTransaction?: (txId: string) => void;
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
 * Recent activity grouped by day (L11), with a balance adjustment that was
 * immediately undone folded into one row that expands (L8). The Dashboard's
 * Recent activity (spec 6.1 item 6) and a wallet's own activity on the
 * Wallets page (spec 6.3, Phase 59) both render through it. The Transactions
 * page still lists both rows of a pair.
 */
export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  items,
  dayNets,
  wallets,
  categories,
  today,
  idPrefix,
  walletId,
  onOpenTransaction,
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
      id={onOpenTransaction ? `${idPrefix}-tx-${tx.id}` : undefined}
      onSelect={onOpenTransaction ? (selected) => onOpenTransaction(selected.id) : undefined}
      tx={tx}
      category={tx.categoryId ? categories.get(tx.categoryId) : undefined}
      wallets={wallets}
      walletId={walletId}
      className="rounded-control"
    />
  );

  return (
    <div className="flex flex-col gap-1">
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
                  id={`${idPrefix}-adjustment-pair-${key}`}
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
  );
};
