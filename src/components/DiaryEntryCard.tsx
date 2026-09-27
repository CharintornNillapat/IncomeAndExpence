import React from 'react';
import { Dumbbell, Utensils, Trash2, Receipt, ChevronDown, ChevronUp } from 'lucide-react';
import { Category, DiaryEntry, Transaction, Wallet } from '../types';
import { formatCurrencyAmount } from '../utils/currency';
import { DayInfo } from '../utils/date';
import { Badge } from './ui/Badge';
import { TxAmount } from './transaction/TxCells';

interface MoodInfo {
  label: string;
  emoji: string;
  color: string;
}

interface DayData {
  totalOutflow: number;
  totalIncome: number;
  transactions: Transaction[];
}

interface DiaryEntryCardProps {
  entry: DiaryEntry;
  dayInfo: DayInfo;
  dayData: DayData;
  outflowTxs: Transaction[];
  moodInfo: MoodInfo;
  isExpanded: boolean;
  onToggleExpand: (entryId: string) => void;
  onDelete: (entryId: string) => void;
  categoryMap: Map<string, Category>;
  walletMap: Map<string, Wallet>;
}

/**
 * One row in DiaryView's "Recent Diary Entries" list (T8, Phase 4).
 *
 * `dayInfo`/`dayData`/`outflowTxs`/`moodInfo` are precomputed once by the
 * parent's memoized `enrichedEntries` (not recomputed per render here), and
 * `onToggleExpand`/`onDelete` are stable `useCallback`s that take the entry
 * id as an argument rather than being created fresh per row - both are what
 * let `React.memo` actually skip re-rendering unaffected rows when the user
 * types into the diary form's notes/workout fields (state local to
 * DiaryView, unrelated to any individual entry in this list).
 */
export const DiaryEntryCard: React.FC<DiaryEntryCardProps> = React.memo(({
  entry,
  dayInfo,
  dayData,
  outflowTxs,
  moodInfo,
  isExpanded,
  onToggleExpand,
  onDelete,
  categoryMap,
  walletMap,
}) => {
  return (
    <div
      id={`diary-card-${entry.id}`}
      className="p-4 rounded-lg border border-line bg-surface-2 hover:bg-surface-3 transition-all space-y-3"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2.5">
          <span className="text-2xl mt-0.5">{moodInfo.emoji}</span>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-fg">
                {dayInfo.dayName}, {dayInfo.fullDate}
              </p>
              {dayInfo.badge && <Badge>{dayInfo.badge}</Badge>}
            </div>
            <span className="text-[11px] text-fg-secondary font-medium">
              Mood: {entry.mood}/5 ★ ({moodInfo.label})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Day spending correlation badge */}
          <div className="text-right">
            <span className="text-[10px] text-fg-muted block font-semibold uppercase tracking-wider">
              Day Outflow
            </span>
            <span className={`text-xs font-mono font-bold ${dayData.totalOutflow > 0 ? 'text-expense' : 'text-fg-secondary'}`}>
              {formatCurrencyAmount(dayData.totalOutflow)}
            </span>
          </div>

          <button
            type="button"
            title="Delete entry"
            onClick={() => onDelete(entry.id)}
            className="p-1 text-fg-muted hover:text-expense rounded-sm cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Workout & Food Badges */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {entry.workout ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-brand-tint text-brand border border-brand-line font-medium">
            <Dumbbell className="w-3 h-3" />
            {entry.workoutNote || 'Workout Done'}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-sm bg-surface-3 text-fg-secondary font-medium">
            Rest Day
          </span>
        )}

        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border font-medium ${
            entry.foodQuality === 'HEALTHY'
              ? 'bg-income-tint text-income border-income-line'
              : entry.foodQuality === 'AVERAGE'
              ? 'bg-pending-tint text-pending border-pending-line'
              : 'bg-expense-tint text-expense border-expense-line'
          }`}
        >
          <Utensils className="w-3 h-3" />
          {entry.foodQuality === 'HEALTHY' ? 'Clean Food' : entry.foodQuality === 'AVERAGE' ? 'Avg Food' : 'Junk Food'}
        </span>

        {/* Toggle day transactions breakdown button */}
        {outflowTxs.length > 0 && (
          <button
            type="button"
            onClick={() => onToggleExpand(entry.id)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-surface-1 hover:bg-surface-3 text-fg-secondary hover:text-fg font-medium text-[11px] cursor-pointer ml-auto"
          >
            <Receipt className="w-3 h-3 text-fg-muted" />
            <span>{outflowTxs.length} item(s)</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Expandable breakdown of transactions for that day */}
      {isExpanded && outflowTxs.length > 0 && (
        <div className="bg-surface-1 p-3 rounded-lg border border-line space-y-2 text-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-fg-secondary uppercase tracking-wider border-b border-line pb-1">
            <span>{dayInfo.dayName}'s Outflows</span>
            <span>Amount</span>
          </div>
          {outflowTxs.map((tx) => {
            const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
            const wal = walletMap.get(tx.walletId);
            return (
              <div key={tx.id} className="flex items-center justify-between text-fg py-1 border-b border-line last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color || '#94a3b8' }} />
                  <div>
                    <span className="font-semibold block">{tx.description}</span>
                    <span className="text-[10px] text-fg-muted">
                      {cat?.name || 'Uncategorized'} • {wal?.name || 'Wallet'}
                    </span>
                  </div>
                </div>
                <TxAmount amount={tx.amount} type={tx.type} colorClassName="text-expense" />
              </div>
            );
          })}
        </div>
      )}

      {entry.notes && (
        <p
          data-testid="diary-entry-notes"
          className="text-xs text-fg-secondary bg-surface-1 p-2.5 rounded-lg border border-line italic"
        >
          "{entry.notes}"
        </p>
      )}
    </div>
  );
});

DiaryEntryCard.displayName = 'DiaryEntryCard';
