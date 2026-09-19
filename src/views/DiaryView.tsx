import React, { useState, useMemo, useCallback } from 'react';
import {
  BookHeart,
  Dumbbell,
  Utensils,
  Calendar,
  Download,
  Check,
  ArrowUpRight,
} from 'lucide-react';
import { useFinanceState, useFinanceActions } from '../context/FinanceContext';
import { useSubmitHandler } from '../hooks/useSubmitHandler';
import { useTransientFlash } from '../hooks/useTransientFlash';
import { DiaryEntryCard } from '../components/DiaryEntryCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Card } from '../components/ui/Card';
import { FoodQuality, Transaction } from '../types';
import { formatCurrencyAmount } from '../utils/currency';
import { todayIsoDate, daysAgoIsoDate, formatDayInfo } from '../utils/date';
import { LABEL_CLASS, PRIMARY_BUTTON_COMPACT_CLASS } from '../utils/formStyles';
import { exportDiaryToJson } from '../utils/csvExchange';
import { buildLookupMap } from '../utils/mapUtils';

// Static (never depends on component state), so it lives outside the
// component instead of being recreated - or even re-useMemo'd - every render.
const MOOD_LABELS: Record<number, { label: string; emoji: string; color: string }> = {
  1: { label: 'Exhausted / Stressed', emoji: '😫', color: 'text-rose-600 bg-rose-50 border-rose-200' },
  2: { label: 'Low Energy', emoji: '😕', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  3: { label: 'Neutral / Balanced', emoji: '😐', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  4: { label: 'Good & Focused', emoji: '😊', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  5: { label: 'Peak Flow / Great', emoji: '🤩', color: 'text-green-600 bg-green-50 border-green-200' },
};

// Stable fallback for a day with no transactions, so days that fall back to
// this identical object don't defeat memoization / DiaryEntryCard's React.memo.
const EMPTY_DAY_DATA: { totalOutflow: number; totalIncome: number; transactions: Transaction[] } = {
  totalOutflow: 0,
  totalIncome: 0,
  transactions: [],
};

export const DiaryView: React.FC = () => {
  const { diaryEntries, transactions, wallets, categories } = useFinanceState();
  const { upsertDiaryEntry, deleteDiaryEntry } = useFinanceActions();

  const todayIso = todayIsoDate();
  const yesterdayIso = daysAgoIsoDate(1);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [expandedDateId, setExpandedDateId] = useState<string | null>(null);

  // Form State
  const [mood, setMood] = useState<number>(5);
  const [workout, setWorkout] = useState<boolean>(true);
  const [workoutNote, setWorkoutNote] = useState<string>('Morning cardio & bodyweight exercises');
  const [foodQuality, setFoodQuality] = useState<FoodQuality>('HEALTHY');
  const [notes, setNotes] = useState<string>('');
  const { value: saveSuccess, flash: flashSaveSuccess } = useTransientFlash(false, 2500);
  const { error: saveError, handleSubmit: submitDiaryEntry } = useSubmitHandler({
    defaultErrorMessage: 'Failed to save diary entry',
    onSuccess: () => flashSaveSuccess(true),
  });

  // Map category and wallet helpers
  const categoryMap = useMemo(() => buildLookupMap(categories), [categories]);
  const walletMap = useMemo(() => buildLookupMap(wallets), [wallets]);

  // Aggregated daily transaction data by ISO date string (YYYY-MM-DD)
  const dailyTransactionsMap = useMemo(() => {
    const map: Record<string, { totalOutflow: number; totalIncome: number; transactions: typeof transactions }> = {};

    transactions
      .filter((t) => !t.isDeleted)
      .forEach((t) => {
        const dateKey = (t.transactionDate || '').slice(0, 10);
        if (!dateKey) return;

        if (!map[dateKey]) {
          map[dateKey] = { totalOutflow: 0, totalIncome: 0, transactions: [] };
        }

        if (t.type === 'EXPENSE' || t.type === 'DEBT_REPAYMENT') {
          map[dateKey].totalOutflow += t.amount;
        } else if (t.type === 'INCOME') {
          map[dateKey].totalIncome += t.amount;
        }

        map[dateKey].transactions.push(t);
      });

    return map;
  }, [transactions]);

  // Only confirms once the entry is actually persisted (onSuccess fires after
  // upsertDiaryEntry resolves with success: true).
  const handleSaveEntry = (e: React.FormEvent) =>
    submitDiaryEntry(e, () =>
      upsertDiaryEntry({
        date: selectedDate,
        mood,
        workout,
        workoutNote: workout ? workoutNote : undefined,
        foodQuality,
        notes: notes.trim() || undefined,
      })
    );

  const loadEntryForDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    const existing = diaryEntries.find((e) => e.date === dateStr && !e.isDeleted);
    if (existing) {
      setMood(existing.mood);
      setWorkout(existing.workout);
      setWorkoutNote(existing.workoutNote || '');
      setFoodQuality(existing.foodQuality);
      setNotes(existing.notes || '');
    } else {
      setMood(4);
      setWorkout(false);
      setWorkoutNote('');
      setFoodQuality('AVERAGE');
      setNotes('');
    }
  };

  // Memoized so this filter+sort only re-runs when diaryEntries actually
  // changes, not on every keystroke into the form's mood/workout/notes state.
  const activeEntries = useMemo(
    () => diaryEntries.filter((e) => !e.isDeleted).sort((a, b) => b.date.localeCompare(a.date)),
    [diaryEntries]
  );

  const selectedDateData = dailyTransactionsMap[selectedDate] || EMPTY_DAY_DATA;
  const selectedDayInfo = useMemo(
    () => formatDayInfo(selectedDate, todayIso, yesterdayIso),
    [selectedDate, todayIso, yesterdayIso]
  );
  const selectedDateOutflowCount = useMemo(
    () => selectedDateData.transactions.filter((t) => t.type === 'EXPENSE' || t.type === 'DEBT_REPAYMENT').length,
    [selectedDateData]
  );

  // Precomputes everything each entry card needs - the day's formatted
  // display info and its bucket of outflow transactions - once per
  // diaryEntries/transactions change, not once per render. Previously
  // `formatDayInfo` and an outflow `.filter()` ran fresh for every entry on
  // every render, including on every keystroke in the notes/workout fields.
  const enrichedEntries = useMemo(() => {
    return activeEntries.map((entry) => {
      const dayData = dailyTransactionsMap[entry.date] || EMPTY_DAY_DATA;
      return {
        entry,
        dayInfo: formatDayInfo(entry.date, todayIso, yesterdayIso),
        dayData,
        outflowTxs: dayData.transactions.filter((t) => t.type === 'EXPENSE' || t.type === 'DEBT_REPAYMENT'),
        moodInfo: MOOD_LABELS[entry.mood],
      };
    });
  }, [activeEntries, dailyTransactionsMap, todayIso, yesterdayIso]);

  // Stable across renders (module-scope setter + context action only) so
  // DiaryEntryCard's React.memo isn't defeated by a fresh closure per row.
  const handleToggleExpand = useCallback((entryId: string) => {
    setExpandedDateId((prev) => (prev === entryId ? null : entryId));
  }, []);

  const handleDeleteEntry = useCallback(
    (entryId: string) => {
      deleteDiaryEntry(entryId);
    },
    [deleteDiaryEntry]
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Holistic Mini Diary"
        subtitle="Track daily mood, physical workouts, food quality, and correlate with daily spending behavior"
        action={
          <button
            id="export-diary-btn"
            type="button"
            onClick={() => exportDiaryToJson(diaryEntries)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Diary (JSON)</span>
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Daily Logger Form (6 cols) */}
        <Card padding="lg" className="lg:col-span-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <BookHeart className="w-5 h-5 text-stone-800 dark:text-stone-200" />
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-white">Daily Wellbeing Entry</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">{selectedDayInfo.dayName}, {selectedDayInfo.fullDate}</span>
                  {selectedDayInfo.badge && (
                    <span className="text-[10px] font-bold bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 px-1.5 py-0.2 rounded">
                      {selectedDayInfo.badge}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <input
              id="diary-date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => loadEntryForDate(e.target.value)}
              className="text-xs border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-1.5 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 cursor-pointer"
            />
          </div>

          {/* Real-time Day Outflow & Inflow summary for selected date */}
          <div className="bg-stone-50 dark:bg-stone-800/80 rounded-xl p-3.5 border border-stone-200/80 dark:border-stone-700/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 block">
                  {selectedDayInfo.dayName} Outflow
                </span>
                <span className="text-xs text-stone-600 dark:text-stone-300 font-medium">
                  {selectedDateOutflowCount} outflow transaction(s)
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-base font-black font-mono ${selectedDateData.totalOutflow > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-700 dark:text-stone-300'}`}>
                {formatCurrencyAmount(selectedDateData.totalOutflow)}
              </span>
              {selectedDateData.totalIncome > 0 && (
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 block font-semibold">
                  +{formatCurrencyAmount(selectedDateData.totalIncome)} in
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveEntry} className="space-y-5">
            {/* 1. Mood Selector (1 to 5) */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-2">
                1. Daily Mood Rating (1 - 5)
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((level) => {
                  const info = MOOD_LABELS[level];
                  const isSelected = mood === level;
                  return (
                    <button
                      key={level}
                      id={`mood-btn-${level}`}
                      type="button"
                      onClick={() => setMood(level)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-stone-900 dark:border-stone-100 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-xs scale-105'
                          : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <span className="text-xl">{info.emoji}</span>
                      <span className="text-[11px] font-bold mt-1">{level}★</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs font-medium text-stone-600 dark:text-stone-400 mt-2 text-center">
                Current Mood: <strong className="text-stone-900 dark:text-stone-100">{MOOD_LABELS[mood].label}</strong>
              </p>
            </div>

            {/* 2. Workout Toggle & Note */}
            <div className="bg-stone-50 dark:bg-stone-800/80 p-4 rounded-xl border border-stone-100 dark:border-stone-700 space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="diary-workout-checkbox" className="text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-2 cursor-pointer">
                  <Dumbbell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Physical Workout / Exercise Completed?</span>
                </label>
                <input
                  id="diary-workout-checkbox"
                  type="checkbox"
                  checked={workout}
                  onChange={(e) => setWorkout(e.target.checked)}
                  className="w-4 h-4 rounded text-stone-900 focus:ring-stone-800 cursor-pointer"
                />
              </div>

              {workout && (
                <input
                  id="diary-workout-note"
                  type="text"
                  value={workoutNote}
                  onChange={(e) => setWorkoutNote(e.target.value)}
                  placeholder="e.g. 5km run, Pilates, Heavy leg day..."
                  className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400"
                />
              )}
            </div>

            {/* 3. Food Quality (Healthy, Average, Junk) */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-2">
                3. Nutrition & Food Quality
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['HEALTHY', 'AVERAGE', 'JUNK'] as FoodQuality[]).map((fq) => (
                  <button
                    key={fq}
                    id={`food-btn-${fq.toLowerCase()}`}
                    type="button"
                    onClick={() => setFoodQuality(fq)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      foodQuality === fq
                        ? fq === 'HEALTHY'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : fq === 'AVERAGE'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700'
                    }`}
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>{fq === 'HEALTHY' ? 'Clean / Home' : fq === 'AVERAGE' ? 'Average' : 'Fast Food / Junk'}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Journal / Mindful Reflection */}
            <div>
              <label className={LABEL_CLASS}>
                4. Daily Reflection Notes (Optional)
              </label>
              <textarea
                id="diary-notes-textarea"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What went well today? Any financial triggers or stress points?"
                className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-3 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400"
              />
            </div>

            {/* Submit */}
            <div>
              <button
                id="save-diary-entry-btn"
                type="submit"
                className={`${PRIMARY_BUTTON_COMPACT_CLASS} flex items-center justify-center gap-2`}
              >
                <Check className="w-4 h-4" />
                <span>Save Diary Log for {selectedDayInfo.dayName} ({selectedDate})</span>
              </button>
              {saveSuccess && (
                <p className="text-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-2 animate-fade-in">
                  ✓ Diary entry logged for {selectedDayInfo.dayName}!
                </p>
              )}
              {saveError && (
                <p className="text-center text-xs text-rose-600 dark:text-rose-400 font-semibold mt-2">
                  {saveError}
                </p>
              )}
            </div>
          </form>
        </Card>

        {/* Right Column: Historical Diary Logs & Spending Correlation (6 cols) */}
        <Card padding="lg" className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-stone-600 dark:text-stone-400" />
              <h3 className="text-sm font-bold text-stone-900 dark:text-white">Recent Diary Entries</h3>
            </div>
            <span className="text-xs text-stone-400 dark:text-stone-500">{activeEntries.length} logged days</span>
          </div>

          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {enrichedEntries.length === 0 ? (
              <p className="text-xs text-stone-400 dark:text-stone-500 text-center py-10">No diary entries logged yet.</p>
            ) : (
              enrichedEntries.map(({ entry, dayInfo, dayData, outflowTxs, moodInfo }) => (
                <DiaryEntryCard
                  key={entry.id}
                  entry={entry}
                  dayInfo={dayInfo}
                  dayData={dayData}
                  outflowTxs={outflowTxs}
                  moodInfo={moodInfo}
                  isExpanded={expandedDateId === entry.id}
                  onToggleExpand={handleToggleExpand}
                  onDelete={handleDeleteEntry}
                  categoryMap={categoryMap}
                  walletMap={walletMap}
                />
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
