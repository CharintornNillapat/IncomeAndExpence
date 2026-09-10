import React, { useState, useMemo } from 'react';
import { 
  BookHeart, 
  Dumbbell, 
  Utensils, 
  Calendar, 
  Download, 
  Check, 
  Trash2, 
  ArrowUpRight, 
  ChevronDown, 
  ChevronUp,
  Receipt,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { FoodQuality } from '../types';
import { exportDiaryToJson } from '../utils/csvExchange';

export const DiaryView: React.FC = () => {
  const { diaryEntries, transactions, wallets, categories, upsertDiaryEntry, deleteDiaryEntry } = useFinance();

  const todayIso = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [expandedDateId, setExpandedDateId] = useState<string | null>(null);

  // Form State
  const [mood, setMood] = useState<number>(5);
  const [workout, setWorkout] = useState<boolean>(true);
  const [workoutNote, setWorkoutNote] = useState<string>('Morning cardio & bodyweight exercises');
  const [foodQuality, setFoodQuality] = useState<FoodQuality>('HEALTHY');
  const [notes, setNotes] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Map category and wallet helpers
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const walletMap = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);

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

  // Date formatting helper for explicit day names (e.g. Sunday, Aug 30, 2026)
  const formatDayInfo = (dateStr: string) => {
    if (!dateStr) return { dayName: '', fullDate: '', badge: '' };
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yestStr = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const fullDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    let badge = '';
    if (dateStr === todayStr) badge = 'Today';
    else if (dateStr === yestStr) badge = 'Yesterday';

    return { dayName, fullDate, badge };
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();

    upsertDiaryEntry({
      date: selectedDate,
      mood,
      workout,
      workoutNote: workout ? workoutNote : undefined,
      foodQuality,
      notes: notes.trim() || undefined,
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

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

  const moodLabels: Record<number, { label: string; emoji: string; color: string }> = {
    1: { label: 'Exhausted / Stressed', emoji: '😫', color: 'text-rose-600 bg-rose-50 border-rose-200' },
    2: { label: 'Low Energy', emoji: '😕', color: 'text-orange-600 bg-orange-50 border-orange-200' },
    3: { label: 'Neutral / Balanced', emoji: '😐', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    4: { label: 'Good & Focused', emoji: '😊', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    5: { label: 'Peak Flow / Great', emoji: '🤩', color: 'text-green-600 bg-green-50 border-green-200' },
  };

  const activeEntries = diaryEntries
    .filter((e) => !e.isDeleted)
    .sort((a, b) => b.date.localeCompare(a.date));

  const selectedDateData = dailyTransactionsMap[selectedDate] || { totalOutflow: 0, totalIncome: 0, transactions: [] };
  const selectedDayInfo = formatDayInfo(selectedDate);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-stone-900 dark:text-white">Holistic Mini Diary</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Track daily mood, physical workouts, food quality, and correlate with daily spending behavior
          </p>
        </div>

        <button
          id="export-diary-btn"
          type="button"
          onClick={() => exportDiaryToJson(diaryEntries)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Diary (JSON)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Daily Logger Form (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-xs space-y-6">
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
                  {selectedDateData.transactions.filter((t) => t.type === 'EXPENSE' || t.type === 'DEBT_REPAYMENT').length} outflow transaction(s)
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-base font-black font-mono ${selectedDateData.totalOutflow > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-700 dark:text-stone-300'}`}>
                ฿{selectedDateData.totalOutflow.toFixed(2)}
              </span>
              {selectedDateData.totalIncome > 0 && (
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 block font-semibold">
                  +฿{selectedDateData.totalIncome.toFixed(2)} in
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
                  const info = moodLabels[level];
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
                Current Mood: <strong className="text-stone-900 dark:text-stone-100">{moodLabels[mood].label}</strong>
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
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
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
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 rounded-xl font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save Diary Log for {selectedDayInfo.dayName} ({selectedDate})</span>
              </button>
              {saveSuccess && (
                <p className="text-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-2 animate-fade-in">
                  ✓ Diary entry logged for {selectedDayInfo.dayName}!
                </p>
              )}
            </div>
          </form>
        </div>

        {/* Right Column: Historical Diary Logs & Spending Correlation (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-stone-600 dark:text-stone-400" />
              <h3 className="text-sm font-bold text-stone-900 dark:text-white">Recent Diary Entries</h3>
            </div>
            <span className="text-xs text-stone-400 dark:text-stone-500">{activeEntries.length} logged days</span>
          </div>

          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {activeEntries.length === 0 ? (
              <p className="text-xs text-stone-400 dark:text-stone-500 text-center py-10">No diary entries logged yet.</p>
            ) : (
              activeEntries.map((entry) => {
                const dayInfo = formatDayInfo(entry.date);
                const dayData = dailyTransactionsMap[entry.date] || { totalOutflow: 0, totalIncome: 0, transactions: [] };
                const moodInfo = moodLabels[entry.mood];
                const isExpanded = expandedDateId === entry.id;
                const outflowTxs = dayData.transactions.filter((t) => t.type === 'EXPENSE' || t.type === 'DEBT_REPAYMENT');

                return (
                  <div
                    key={entry.id}
                    id={`diary-card-${entry.id}`}
                    className="p-4 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/80 hover:bg-stone-100/70 dark:hover:bg-stone-800 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2.5">
                        <span className="text-2xl mt-0.5">{moodInfo.emoji}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-stone-900 dark:text-white">
                              {dayInfo.dayName}, {dayInfo.fullDate}
                            </p>
                            {dayInfo.badge && (
                              <span className="text-[10px] font-bold bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 px-1.5 py-0.2 rounded">
                                {dayInfo.badge}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                            Mood: {entry.mood}/5 ★ ({moodInfo.label})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Day spending correlation badge */}
                        <div className="text-right">
                          <span className="text-[10px] text-stone-400 dark:text-stone-500 block font-semibold uppercase tracking-wider">
                            Day Outflow
                          </span>
                          <span className={`text-xs font-mono font-bold ${dayData.totalOutflow > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-500 dark:text-stone-400'}`}>
                            ฿{dayData.totalOutflow.toFixed(2)}
                          </span>
                        </div>

                        <button
                          type="button"
                          title="Delete entry"
                          onClick={() => deleteDiaryEntry(entry.id)}
                          className="p-1 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Workout & Food Badges */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {entry.workout ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-medium">
                          <Dumbbell className="w-3 h-3" />
                          {entry.workoutNote || 'Workout Done'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 font-medium">
                          Rest Day
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-medium ${
                          entry.foodQuality === 'HEALTHY'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : entry.foodQuality === 'AVERAGE'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        <Utensils className="w-3 h-3" />
                        {entry.foodQuality === 'HEALTHY' ? 'Clean Food' : entry.foodQuality === 'AVERAGE' ? 'Avg Food' : 'Junk Food'}
                      </span>

                      {/* Toggle day transactions breakdown button */}
                      {outflowTxs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedDateId(isExpanded ? null : entry.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 font-medium text-[11px] cursor-pointer ml-auto"
                        >
                          <Receipt className="w-3 h-3 text-stone-500 dark:text-stone-400" />
                          <span>{outflowTxs.length} item(s)</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>

                    {/* Expandable breakdown of transactions for that day */}
                    {isExpanded && outflowTxs.length > 0 && (
                      <div className="bg-white dark:bg-stone-900 p-3 rounded-lg border border-stone-200 dark:border-stone-800 space-y-2 animate-fade-in text-xs">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider border-b border-stone-100 dark:border-stone-800 pb-1">
                          <span>{dayInfo.dayName}'s Outflows</span>
                          <span>Amount</span>
                        </div>
                        {outflowTxs.map((tx) => {
                          const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
                          const wal = walletMap.get(tx.walletId);
                          return (
                            <div key={tx.id} className="flex items-center justify-between text-stone-800 dark:text-stone-200 py-1 border-b border-stone-50 dark:border-stone-800/60 last:border-0">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color || '#94a3b8' }} />
                                <div>
                                  <span className="font-semibold block">{tx.description}</span>
                                  <span className="text-[10px] text-stone-400 dark:text-stone-500">
                                    {cat?.name || 'Uncategorized'} • {wal?.name || 'Wallet'}
                                  </span>
                                </div>
                              </div>
                              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-฿{tx.amount.toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {entry.notes && (
                      <p className="text-xs text-stone-600 dark:text-stone-400 bg-white dark:bg-stone-900 p-2.5 rounded-lg border border-stone-100 dark:border-stone-800 italic">
                        "{entry.notes}"
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
