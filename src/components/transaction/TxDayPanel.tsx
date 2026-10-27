import React from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Money } from '../ui/Money';
import { TransactionRow } from './TransactionRow';
import { formatDayLabel, formatWeekdayDate } from '../../utils/date';
import type { Category, Transaction, Wallet } from '../../types';

export interface TxDayPanelProps {
  day: string | null;
  today: string;
  totals: { income: number; spending: number; net: number } | undefined;
  rows: Transaction[];
  categories: ReadonlyMap<string, Category>;
  wallets: ReadonlyMap<string, Wallet>;
  selectedTxId: string | null;
  onSelect: (tx: Transaction) => void;
  onAdd: () => void;
  hasDiaryEntry: boolean;
  onOpenDiary?: () => void;
}

export const TxDayPanel: React.FC<TxDayPanelProps> = ({
  day,
  today,
  totals,
  rows,
  categories,
  wallets,
  selectedTxId,
  onSelect,
  onAdd,
  hasDiaryEntry,
  onOpenDiary,
}) => {
  const income = totals?.income ?? 0;
  const spending = totals?.spending ?? 0;
  const net = totals?.net ?? 0;

  return (
    <section id="tx-cal-panel" aria-labelledby="tx-cal-panel-title">
      <Card className="flex flex-col gap-5">
        {day === null ? (
          <>
            <h2 id="tx-cal-panel-title" className="text-base font-semibold text-fg">
              Pick a day
            </h2>
            <p className="text-sm text-fg-secondary">Choose a day in the calendar to see its transactions.</p>
          </>
        ) : (
          <>
            <h2 id="tx-cal-panel-title" className="text-base font-semibold text-fg">
              {formatDayLabel(day, today)}
            </h2>

            <div className="grid grid-cols-3 gap-2">
              <div id="tx-cal-panel-in" className="bg-surface-2 rounded-inner px-3 py-2">
                <span className="block text-xs text-fg-secondary">In</span>
                <Money value={income} showPlus className="text-sm font-semibold text-income" />
              </div>
              <div id="tx-cal-panel-out" className="bg-surface-2 rounded-inner px-3 py-2">
                <span className="block text-xs text-fg-secondary">Out</span>
                <Money value={-spending} className="text-sm font-semibold text-expense" />
              </div>
              <div id="tx-cal-panel-net" className="bg-surface-2 rounded-inner px-3 py-2">
                <span className="block text-xs text-fg-secondary">Net</span>
                <Money
                  value={net}
                  showPlus
                  className={`text-sm font-semibold ${net < 0 ? 'text-expense' : 'text-fg'}`}
                />
              </div>
            </div>

            {rows.length === 0 ? (
              <p id="tx-cal-panel-empty" className="text-sm text-fg-secondary">
                No transactions on this day
              </p>
            ) : (
              // ponytail: a single day's rows are bounded by what one person enters in a day, so no Load more ceiling here.
              <div className="flex flex-col gap-1 -mx-2">
                {rows.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    id={`tx-row-${tx.id}`}
                    tx={tx}
                    category={tx.categoryId ? categories.get(tx.categoryId) : undefined}
                    wallets={wallets}
                    onSelect={onSelect}
                    selected={tx.id === selectedTxId}
                    dateText={tx.transactionDate.slice(0, 10)}
                    className="rounded-control"
                  />
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                id="tx-cal-add-btn"
                variant="secondary"
                className="w-full"
                icon={<Plus className="w-4 h-4" />}
                onClick={onAdd}
              >
                Add transaction on {formatWeekdayDate(day)}
              </Button>
              {hasDiaryEntry && onOpenDiary && (
                <Button
                  id="tx-cal-diary-link"
                  variant="soft"
                  className="w-full"
                  icon={<BookOpen className="w-4 h-4" />}
                  onClick={onOpenDiary}
                >
                  Open this day in Daily diary
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </section>
  );
};
