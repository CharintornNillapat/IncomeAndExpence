/**
 * Local-calendar date helpers.
 *
 * `new Date().toISOString().slice(0, 10)` formats in UTC, so for any positive
 * timezone offset it reports yesterday during the early hours of the local day.
 * In Thailand (UTC+7) every moment between 00:00 and 06:59 local resolves to the
 * previous date, which files transactions and diary entries under the wrong day.
 *
 * Transaction dates, diary dates and "today"/"yesterday" labels are all local
 * calendar days, so they must be derived from the local date components.
 */

/** Formats a Date as `YYYY-MM-DD` using its local calendar components. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today's local calendar date as `YYYY-MM-DD`. */
export function todayIsoDate(): string {
  return toIsoDate(new Date());
}

/**
 * The local calendar date `days` days before today, as `YYYY-MM-DD`.
 *
 * Uses `setDate` rather than subtracting milliseconds so that days spanning a
 * daylight-saving transition still step by exactly one calendar day.
 */
export function daysAgoIsoDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toIsoDate(d);
}

export interface DayInfo {
  dayName: string;
  fullDate: string;
  badge: string;
}

/**
 * Formats a local calendar date (`YYYY-MM-DD`) into a display day name, a
 * full date string, and a "Today"/"Yesterday" badge - all derived from local
 * calendar components, never `new Date(dateStr)` (which parses a bare
 * `YYYY-MM-DD` as UTC midnight and would misdate near local-day boundaries,
 * same failure mode this module's other helpers guard against).
 *
 * `todayStr`/`yesterdayStr` default to fresh `todayIsoDate()`/
 * `daysAgoIsoDate(1)` calls, but callers formatting many dates in a loop
 * (e.g. a list of diary entries) should compute them once and pass them in,
 * rather than recomputing "today" on every call.
 */
export function formatDayInfo(
  dateStr: string,
  todayStr: string = todayIsoDate(),
  yesterdayStr: string = daysAgoIsoDate(1)
): DayInfo {
  if (!dateStr) return { dayName: '', fullDate: '', badge: '' };
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);

  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const fullDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  let badge = '';
  if (dateStr === todayStr) badge = 'Today';
  else if (dateStr === yesterdayStr) badge = 'Yesterday';

  return { dayName, fullDate, badge };
}
