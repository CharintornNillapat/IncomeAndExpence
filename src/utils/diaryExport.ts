import { todayIsoDate } from './date';
import { saveJsonFile } from './accountExport';
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

  saveJsonFile(exportPayload, `holistic_diary_export_${todayIsoDate()}.json`);
}
