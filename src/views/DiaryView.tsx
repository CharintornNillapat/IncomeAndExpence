import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { useFinanceState } from '../context/FinanceContext';
import { useDiaryActions, useDiaryState } from '../context/DiaryContext';
import { useTransientFlash } from '../hooks/useTransientFlash';
import { DiaryEntryForm, DiaryEntryDraft } from '../components/diary/DiaryEntryForm';
import { DiaryCalendar } from '../components/diary/DiaryCalendar';
import { RecentEntries } from '../components/diary/RecentEntries';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { daysAgoIsoDate, formatDiaryHeading, formatWeekdayDate, monthKeyOf, todayIsoDate } from '../utils/date';
import { exportDiaryToJson } from '../utils/diaryExport';
import { buildLookupMap } from '../utils/mapUtils';
import { DaySpending, daySpending, diaryMonth } from '../selectors/diary';

interface DiaryViewProps {
  /** Opens the Transactions page filtered to one day (a recent entry's "N transactions", ADR 0036). */
  onOpenDayTransactions?: (date: string) => void;
}

/**
 * Spec 6.5 (Phase 61, ADR 0036): the Daily diary. The entry form on the left
 * (7/12), the month calendar and the recent entries on the right (5/12),
 * stacked below `lg`. The form always starts from the selected day's saved
 * entry; spending figures are L1's (`daySpending`), computed here once.
 */
export const DiaryView: React.FC<DiaryViewProps> = ({ onOpenDayTransactions }) => {
  const { transactions, categories } = useFinanceState();
  const { diaryEntries } = useDiaryState();
  const { upsertDiaryEntry, deleteDiaryEntry } = useDiaryActions();

  const today = todayIsoDate();
  const yesterday = daysAgoIsoDate(1);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [calendarMonth, setCalendarMonth] = useState<string>(monthKeyOf(today));

  const categoryMap = useMemo(() => buildLookupMap(categories), [categories]);

  // Live entries, newest first.
  const entries = useMemo(
    () => diaryEntries.filter((e) => !e.isDeleted).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [diaryEntries]
  );
  const selectedEntry = useMemo(() => entries.find((e) => e.date === selectedDate), [entries, selectedDate]);

  // Each logged day's spending, plus the selected day's, on L1.
  const spendingByDate = useMemo(() => {
    const map = new Map<string, DaySpending>();
    for (const entry of entries) map.set(entry.date, daySpending(transactions, entry.date, categoryMap));
    return map;
  }, [entries, transactions, categoryMap]);
  const selectedSpending = useMemo(
    () => spendingByDate.get(selectedDate) ?? daySpending(transactions, selectedDate, categoryMap),
    [spendingByDate, selectedDate, transactions, categoryMap]
  );
  const loggedDates = useMemo(() => diaryMonth(entries, calendarMonth), [entries, calendarMonth]);

  const { value: savedMessage, flash: flashSaved, clear: clearSaved } = useTransientFlash<string | null>(null, 2500);

  const changeDate = useCallback(
    (date: string) => {
      if (date > today) return;
      if (date !== selectedDate) clearSaved();
      setSelectedDate(date);
      setCalendarMonth(monthKeyOf(date));
    },
    [today, selectedDate, clearSaved]
  );

  const handleSave = useCallback((draft: DiaryEntryDraft) => upsertDiaryEntry(draft), [upsertDiaryEntry]);
  const handleSaved = useCallback(
    () => flashSaved(`Diary entry logged for ${formatDiaryHeading(selectedDate, today)}.`),
    [flashSaved, selectedDate, today]
  );

  const handleEdit = useCallback(
    (date: string) => {
      changeDate(date);
      // The form's heading takes focus once it shows the day (focusAfterRef below).
      focusAfterRef.current = 'diary-form-heading';
      setFocusTick((tick) => tick + 1);
    },
    [changeDate]
  );

  // Delete confirms first (owner's decision, ADR 0036). The dialog stores the
  // id and resolves the entry at render.
  const [entryToDeleteId, setEntryToDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const entryToDelete = entryToDeleteId ? entries.find((e) => e.id === entryToDeleteId) ?? null : null;

  // `Modal` returns focus to its opener, but a deleted entry takes its menu
  // with it. Focus then goes to the next entry's menu, or the list's heading.
  const focusAfterRef = useRef<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  useEffect(() => {
    const id = focusAfterRef.current;
    if (!id || entryToDeleteId) return;
    focusAfterRef.current = null;
    document.getElementById(id)?.focus({ preventScroll: id === 'diary-form-heading' ? false : true });
  }, [entryToDeleteId, entries, selectedDate, focusTick]);

  const handleDelete = useCallback((id: string) => {
    setDeleteError(null);
    setEntryToDeleteId(id);
  }, []);

  const handleCloseDelete = useCallback(() => {
    setEntryToDeleteId(null);
    setDeleteError(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!entryToDeleteId) return;
    const index = entries.findIndex((e) => e.id === entryToDeleteId);
    const next = entries[index + 1] ?? entries[index - 1];
    setIsDeleting(true);
    setDeleteError(null);
    const result = await deleteDiaryEntry(entryToDeleteId);
    setIsDeleting(false);
    if (!result.success) {
      setDeleteError(result.error || 'Failed to delete the entry');
      return;
    }
    focusAfterRef.current = next ? `diary-menu-btn-${next.id}` : 'diary-recent-heading';
    setEntryToDeleteId(null);
  }, [entryToDeleteId, entries, deleteDiaryEntry]);

  const handleOpenDayTransactions = useCallback((date: string) => onOpenDayTransactions?.(date), [onOpenDayTransactions]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily diary"
        description="Your mood, activity and meals, beside what each day cost"
        actions={
          <Button
            id="export-diary-btn"
            variant="secondary"
            onClick={() => exportDiaryToJson(diaryEntries)}
            icon={<Download aria-hidden="true" className="w-4 h-4" />}
          >
            Export JSON
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7">
          <DiaryEntryForm
            key={`${selectedDate}:${selectedEntry?.id ?? 'new'}`}
            date={selectedDate}
            today={today}
            yesterday={yesterday}
            entry={selectedEntry}
            spending={selectedSpending}
            onChangeDate={changeDate}
            onSave={handleSave}
            savedMessage={savedMessage}
            onSaved={handleSaved}
          />
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6">
          <DiaryCalendar
            monthKey={calendarMonth}
            onChangeMonth={setCalendarMonth}
            today={today}
            selectedDate={selectedDate}
            loggedDates={loggedDates}
            onSelectDay={changeDate}
          />
          <RecentEntries
            entries={entries}
            spendingByDate={spendingByDate}
            today={today}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onOpenDayTransactions={handleOpenDayTransactions}
          />
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!entryToDeleteId}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        error={deleteError}
        title="Delete diary entry"
        description={
          entryToDelete
            ? `Delete the entry for ${formatWeekdayDate(entryToDelete.date)}? Its mood, activity, meals and notes are removed. That day's transactions are not touched.`
            : ''
        }
      />
    </div>
  );
};
