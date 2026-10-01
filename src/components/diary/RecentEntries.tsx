import React, { useState } from 'react';
import { DiaryEntry } from '../../types';
import type { DaySpending } from '../../selectors/diary';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { DiaryEntryRow } from './DiaryEntryRow';

/** How many recent entries show at first, and how many more each press adds. */
export const RECENT_STEP = 10;

interface RecentEntriesProps {
  /** Live entries, newest first. */
  entries: DiaryEntry[];
  spendingByDate: Map<string, DaySpending>;
  today: string;
  onEdit: (date: string) => void;
  onDelete: (id: string) => void;
  onOpenDayTransactions: (date: string) => void;
}

const NO_SPENDING: DaySpending = { spending: 0, count: 0 };

/** Spec 6.5: the newest diary entries, ten at a time. */
export const RecentEntries: React.FC<RecentEntriesProps> = ({ entries, spendingByDate, today, onEdit, onDelete, onOpenDayTransactions }) => {
  const [shown, setShown] = useState(RECENT_STEP);
  const visible = entries.slice(0, shown);

  return (
    <Card padding="none" className="p-4 sm:p-6 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="diary-recent-heading" tabIndex={-1} className="text-base font-semibold text-fg">
          Recent entries
        </h2>
        <span className="text-xs text-fg-muted">
          {entries.length} logged {entries.length === 1 ? 'day' : 'days'}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-fg-muted py-6 text-center">No entries yet. Pick a mood and save to log your first day.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {visible.map((entry) => (
            <DiaryEntryRow
              key={entry.id}
              entry={entry}
              spending={spendingByDate.get(entry.date) ?? NO_SPENDING}
              today={today}
              onEdit={onEdit}
              onDelete={onDelete}
              onOpenDayTransactions={onOpenDayTransactions}
            />
          ))}
        </ul>
      )}

      {entries.length > shown && (
        <Button id="diary-show-more-btn" variant="secondary" block onClick={() => setShown((n) => n + RECENT_STEP)}>
          Show {Math.min(RECENT_STEP, entries.length - shown)} more
        </Button>
      )}
    </Card>
  );
};
