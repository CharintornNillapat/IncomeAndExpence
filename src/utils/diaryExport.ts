import { todayIsoDate } from './date';
import { DiaryEntry } from '../types';

/**
 * Split out of `csvExchange.ts` (T77): this builds a JSON `Blob` directly and
 * never touches Papa, but importing it from that module dragged `papaparse`
 * into `DiaryView`'s lazy chunk for a function that has no use for it.
 */
export function exportDiaryToJson(diaryEntries: DiaryEntry[]): void {
  const activeEntries = diaryEntries.filter((e) => !e.isDeleted);
  const avgMood =
    activeEntries.length > 0
      ? activeEntries.reduce((acc, curr) => acc + curr.mood, 0) / activeEntries.length
      : 0;
  const workoutCount = activeEntries.filter((e) => e.workout).length;
  const workoutRate = activeEntries.length > 0 ? (workoutCount / activeEntries.length) * 100 : 0;

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    summary: {
      totalEntries: activeEntries.length,
      averageMood: Math.round(avgMood * 100) / 100,
      workoutRatePercent: Math.round(workoutRate * 10) / 10,
    },
    entries: activeEntries,
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `holistic_diary_export_${todayIsoDate()}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
