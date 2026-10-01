import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { DiaryEntry } from '../../types';
import type { DaySpending } from '../../selectors/diary';
import { formatDayLabel } from '../../utils/date';
import { Inset } from '../ui/Card';
import { Money } from '../ui/Money';
import { OverflowMenu } from '../ui/OverflowMenu';
import { MoodMeter } from './MoodMeter';
import { entrySummaryParts, transactionCountLabel } from './diaryLabels';

interface DiaryEntryRowProps {
  entry: DiaryEntry;
  /** The day's spending on L1, computed once by the page. */
  spending: DaySpending;
  today: string;
  onEdit: (date: string) => void;
  onDelete: (id: string) => void;
  onOpenDayTransactions: (date: string) => void;
}

/**
 * Spec 6.5: one recent diary entry. The date, that day's spending in red, a
 * five-bar mood, "Neutral · Rest day · Average meals · N transactions", and
 * the note in an inset. "N transactions" opens the Transactions page on that
 * day; Edit and Delete sit in the ⋯ menu. No emoji, and no colour by meal.
 */
export const DiaryEntryRow: React.FC<DiaryEntryRowProps> = React.memo(
  ({ entry, spending, today, onEdit, onDelete, onOpenDayTransactions }) => {
    const label = formatDayLabel(entry.date, today);
    return (
      <li id={`diary-card-${entry.id}`} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold text-fg">{label}</h3>
            <MoodMeter mood={entry.mood} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Money
              value={-spending.spending}
              className={`text-sm font-semibold ${spending.spending > 0 ? 'text-expense' : 'text-fg-muted'}`}
            />
            <OverflowMenu
              label={`More actions for ${label}`}
              triggerId={`diary-menu-btn-${entry.id}`}
              className="-mr-2 -my-2"
              items={[
                { id: `edit-diary-${entry.id}`, label: 'Edit entry', icon: <Pencil aria-hidden="true" className="w-4 h-4" />, onSelect: () => onEdit(entry.date) },
                {
                  id: `delete-diary-${entry.id}`,
                  label: 'Delete entry…',
                  tone: 'danger',
                  icon: <Trash2 aria-hidden="true" className="w-4 h-4" />,
                  onSelect: () => onDelete(entry.id),
                },
              ]}
            />
          </div>
        </div>

        <p className="text-xs text-fg-secondary flex flex-wrap items-center gap-x-1">
          <span>{entrySummaryParts(entry).join(' · ')} · </span>
          {spending.count > 0 ? (
            <button
              id={`diary-day-tx-link-${entry.date}`}
              type="button"
              onClick={() => onOpenDayTransactions(entry.date)}
              className="inline-flex items-center min-h-[44px] -my-3 font-semibold text-brand underline underline-offset-2 cursor-pointer"
            >
              {transactionCountLabel(spending.count)}
            </button>
          ) : (
            <span>{transactionCountLabel(0)}</span>
          )}
        </p>

        {entry.workout && entry.workoutNote && <p className="text-xs text-fg-secondary">Workout: {entry.workoutNote}</p>}

        {entry.notes && (
          <Inset className="px-3.5 py-2.5">
            <p data-testid="diary-entry-notes" className="text-xs text-fg-secondary leading-relaxed whitespace-pre-line">
              {entry.notes}
            </p>
          </Inset>
        )}
      </li>
    );
  }
);

DiaryEntryRow.displayName = 'DiaryEntryRow';
