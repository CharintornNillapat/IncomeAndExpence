import { DiaryEntry, FoodQuality } from '../../types';

/** Spec 6.5: a mood is a number and a word, never an emoji. */
export const MOOD_LABELS: Record<number, string> = {
  1: 'Very low',
  2: 'Low',
  3: 'Neutral',
  4: 'Good',
  5: 'Great',
};

export const MOOD_LEVELS = [1, 2, 3, 4, 5] as const;

/** The app's existing activity option, `workout`, as spec 6.5's two choices. */
export const ACTIVITY_LABELS = { rest: 'Rest day', workout: 'Workout' } as const;

export const MEAL_OPTIONS: Array<{ value: FoodQuality; label: string; summary: string }> = [
  { value: 'HEALTHY', label: 'Clean / home', summary: 'Clean / home meals' },
  { value: 'AVERAGE', label: 'Average', summary: 'Average meals' },
  { value: 'JUNK', label: 'Fast food / junk', summary: 'Fast food / junk meals' },
];

/** A recent entry's one-line summary: "Neutral · Rest day · Average meals · 3 transactions". */
export function entrySummaryParts(entry: Pick<DiaryEntry, 'mood' | 'workout' | 'foodQuality'>): string[] {
  const meal = MEAL_OPTIONS.find((option) => option.value === entry.foodQuality)?.summary ?? 'Average meals';
  return [MOOD_LABELS[entry.mood] ?? `Mood ${entry.mood}`, entry.workout ? ACTIVITY_LABELS.workout : ACTIVITY_LABELS.rest, meal];
}

export function transactionCountLabel(count: number): string {
  return count === 0 ? 'No transactions' : `${count} ${count === 1 ? 'transaction' : 'transactions'}`;
}
