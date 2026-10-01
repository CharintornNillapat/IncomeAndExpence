import React, { useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { DiaryEntry, FoodQuality } from '../../types';
import type { MutationResult } from '../../context/FinanceContext';
import type { DaySpending } from '../../selectors/diary';
import { useSubmitHandler } from '../../hooks/useSubmitHandler';
import { formatCurrencyAmount } from '../../utils/currency';
import { formatDiaryHeading, shiftIsoDate } from '../../utils/date';
import { ERROR_BANNER_CLASS, LABEL_TEXT_CLASS, inputClass } from '../../utils/formStyles';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { IconButton } from '../ui/IconButton';
import { ACTIVITY_LABELS, MEAL_OPTIONS, MOOD_LABELS, MOOD_LEVELS } from './diaryLabels';

export interface DiaryEntryDraft {
  date: string;
  mood: number;
  workout: boolean;
  workoutNote?: string;
  foodQuality: FoodQuality;
  notes?: string;
}

interface DiaryEntryFormProps {
  date: string;
  today: string;
  yesterday: string;
  /** The day's saved entry; the form starts from it. Absent for a day not logged yet. */
  entry?: DiaryEntry;
  spending: DaySpending;
  onChangeDate: (date: string) => void;
  onSave: (draft: DiaryEntryDraft) => Promise<MutationResult>;
  /** "Diary entry logged for …", kept by the page so it survives the remount a first save causes. */
  savedMessage: string | null;
  onSaved: () => void;
}

/**
 * Spec 6.5: one selected style for Mood, Activity and Meals - the `selected`
 * background, a `focus` border and `on-selected` text - never a colour by
 * meaning. Each option keeps a 44px box.
 */
const CHOICE_BASE =
  'min-h-[44px] rounded-control border px-2 py-2 text-xs transition-control duration-150 cursor-pointer flex flex-col items-center justify-center gap-0.5 text-center';
const choiceClass = (pressed: boolean) =>
  `${CHOICE_BASE} ${
    pressed ? 'bg-selected text-on-selected border-focus font-semibold' : 'bg-surface-2 border-line text-fg-secondary hover:bg-surface-3 hover:text-fg'
  }`;

function spendingLine(date: string, today: string, yesterday: string, { spending, count }: DaySpending): string {
  const prefix = date === today ? 'Today · ' : date === yesterday ? 'Yesterday · ' : '';
  const sofar = date === today ? ' so far' : '';
  if (count === 0) return `${prefix}${prefix ? 'no' : 'No'} spending${sofar}`;
  return `${prefix}${prefix ? 'spent' : 'Spent'} ${formatCurrencyAmount(spending)} in ${count} ${count === 1 ? 'transaction' : 'transactions'}${sofar}`;
}

/**
 * Spec 6.5 (Phase 61, ADR 0036): the diary's entry form. The page mounts it
 * with a key per day and entry, so its fields start from the day's saved
 * entry; a day with no entry starts with no mood picked, a rest day, average
 * meals and an empty note, and Save waits for a mood.
 */
export const DiaryEntryForm: React.FC<DiaryEntryFormProps> = ({
  date,
  today,
  yesterday,
  entry,
  spending,
  onChangeDate,
  onSave,
  savedMessage,
  onSaved,
}) => {
  const [mood, setMood] = useState<number | null>(entry?.mood ?? null);
  const [workout, setWorkout] = useState<boolean>(entry?.workout ?? false);
  const [workoutNote, setWorkoutNote] = useState<string>(entry?.workoutNote ?? '');
  const [foodQuality, setFoodQuality] = useState<FoodQuality>(entry?.foodQuality ?? 'AVERAGE');
  const [notes, setNotes] = useState<string>(entry?.notes ?? '');
  const pickerRef = useRef<HTMLInputElement>(null);

  const { error, isSubmitting, handleSubmit } = useSubmitHandler({
    defaultErrorMessage: 'Failed to save diary entry',
    onSuccess: onSaved,
  });

  const isToday = date === today;

  const openPicker = () => {
    const input = pickerRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };

  return (
    <Card padding="lg" className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="diary-form-heading" tabIndex={-1} className="text-lg font-semibold text-fg">
            {formatDiaryHeading(date, today)}
          </h2>
          <p id="diary-day-spending" className="text-sm text-fg-secondary mt-0.5">
            {spendingLine(date, today, yesterday, spending)}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0 -ml-2 sm:ml-0 sm:-mr-2">
          <IconButton id="diary-prev-day-btn" label="Previous day" onClick={() => onChangeDate(shiftIsoDate(date, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </IconButton>
          <Button id="diary-pick-date-btn" variant="secondary" onClick={openPicker} icon={<CalendarDays aria-hidden="true" className="w-4 h-4" />}>
            Pick date
          </Button>
          <input
            ref={pickerRef}
            id="diary-date-picker"
            type="date"
            aria-label="Pick a date"
            tabIndex={-1}
            max={today}
            value={date}
            onChange={(e) => {
              // A future day cannot be logged; an emptied picker keeps the day.
              if (e.target.value && e.target.value <= today) onChangeDate(e.target.value);
            }}
            className="sr-only"
          />
          <IconButton
            id="diary-next-day-btn"
            label="Next day"
            disabled={isToday}
            onClick={() => onChangeDate(shiftIsoDate(date, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      <form
        id="diary-entry-form"
        className="flex flex-col gap-6"
        onSubmit={(e) =>
          handleSubmit(e, () =>
            onSave({
              date,
              mood: mood ?? 0,
              workout,
              workoutNote: workout && workoutNote.trim() ? workoutNote.trim() : undefined,
              foodQuality,
              notes: notes.trim() || undefined,
            })
          )
        }
      >
        <fieldset className="flex flex-col gap-2">
          <legend className={`${LABEL_TEXT_CLASS} mb-2`}>Mood</legend>
          <div className="grid grid-cols-5 gap-2">
            {MOOD_LEVELS.map((level) => (
              <button
                key={level}
                id={`mood-btn-${level}`}
                type="button"
                aria-pressed={mood === level}
                onClick={() => setMood(level)}
                className={choiceClass(mood === level)}
              >
                <span className="text-base font-semibold leading-none">{level}</span>
                <span className="text-[11px] leading-tight">{MOOD_LABELS[level]}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className={`${LABEL_TEXT_CLASS} mb-2`}>Activity</legend>
          <div className="grid grid-cols-2 gap-2">
            <button id="activity-btn-rest" type="button" aria-pressed={!workout} onClick={() => setWorkout(false)} className={choiceClass(!workout)}>
              {ACTIVITY_LABELS.rest}
            </button>
            <button id="activity-btn-workout" type="button" aria-pressed={workout} onClick={() => setWorkout(true)} className={choiceClass(workout)}>
              {ACTIVITY_LABELS.workout}
            </button>
          </div>
          {workout && (
            <input
              id="diary-workout-note"
              type="text"
              aria-label="What you did"
              value={workoutNote}
              onChange={(e) => setWorkoutNote(e.target.value)}
              placeholder="What you did, e.g. a 5 km run"
              className={inputClass('subtle')}
            />
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className={`${LABEL_TEXT_CLASS} mb-2`}>Meals</legend>
          <div className="grid grid-cols-3 gap-2">
            {MEAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                id={`food-btn-${option.value.toLowerCase()}`}
                type="button"
                aria-pressed={foodQuality === option.value}
                onClick={() => setFoodQuality(option.value)}
                className={choiceClass(foodQuality === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor="diary-notes-textarea" className={LABEL_TEXT_CLASS}>
            Notes
          </label>
          <textarea
            id="diary-notes-textarea"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything that shaped the day or your spending"
            className="w-full text-xs rounded-lg border border-line-input bg-surface-2 p-3 text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </div>

        <div className="flex flex-col gap-2">
          {error && <div className={ERROR_BANNER_CLASS}>{error}</div>}
          <Button id="save-diary-entry-btn" type="submit" size="lg" block disabled={mood === null || isSubmitting} aria-describedby="diary-save-status">
            Save entry
          </Button>
          <p id="diary-save-status" role="status" className={`text-xs text-center ${savedMessage ? 'text-income font-semibold' : 'text-fg-muted'}`}>
            {savedMessage ?? (mood === null ? 'Pick a mood to save.' : '')}
          </p>
        </div>
      </form>
    </Card>
  );
};
