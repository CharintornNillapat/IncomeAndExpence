import { shiftIsoDate } from '../utils/date';

/**
 * Spec L2 (ADR 0028): one time range for a whole screen. The ids behind
 * `#time-filter-*` (`day`, `week`, `month`, `all`) are frozen by
 * `date-boundary.spec.ts`, and so is what each one means.
 */
export type TimeRange = 'DAY' | 'WEEK' | 'MONTH' | 'ALL';

/** Inclusive bounds as local `YYYY-MM-DD` strings; `null` is an open side. */
export interface RangeBounds {
  start: string | null;
  end: string | null;
}

/**
 * DAY is today. WEEK is from `today - 7` and MONTH from `today - 30` - eight
 * and thirty-one days inclusive, the dashboard's boundaries since before the
 * redesign and the spec's own example ("Aug 29 – Sep 28" on Sep 28). WEEK,
 * MONTH and ALL leave the end open, as the dashboard always did, so a row
 * dated ahead of today still shows.
 */
export function rangeBounds(range: TimeRange, today: string): RangeBounds {
  switch (range) {
    case 'DAY':
      return { start: today, end: today };
    case 'WEEK':
      return { start: shiftIsoDate(today, -7), end: null };
    case 'MONTH':
      return { start: shiftIsoDate(today, -30), end: null };
    case 'ALL':
      return { start: null, end: null };
  }
}

/** ISO calendar days compare correctly as strings (CLAUDE.md), so no `Date` is parsed here. */
export function inRange(date: string, bounds: RangeBounds): boolean {
  const day = date.slice(0, 10);
  return (bounds.start === null || day >= bounds.start) && (bounds.end === null || day <= bounds.end);
}

/** The rows dated inside the range. ALL returns the same array. */
export function filterByRange<T extends { transactionDate: string }>(rows: T[], range: TimeRange, today: string): T[] {
  if (range === 'ALL') return rows;
  const bounds = rangeBounds(range, today);
  return rows.filter((row) => inRange(row.transactionDate, bounds));
}

function parts(iso: string): { year: number; label: string } {
  const [year, month, day] = iso.split('-').map(Number);
  const label = new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { year, label };
}

/**
 * The range as real dates, for the caption beside the range control:
 * "Aug 29 – Sep 28", "Sep 28", or "All time". The year is named only when the
 * range crosses one.
 */
export function formatRangeLabel(range: TimeRange, today: string): string {
  if (range === 'ALL') return 'All time';
  const end = parts(today);
  if (range === 'DAY') return end.label;
  const start = parts(rangeBounds(range, today).start!);
  return start.year === end.year
    ? `${start.label} – ${end.label}`
    : `${start.label}, ${start.year} – ${end.label}, ${end.year}`;
}
