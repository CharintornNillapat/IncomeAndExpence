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
  return shiftIsoDate(todayIsoDate(), -days);
}

/**
 * A local calendar date (`YYYY-MM-DD`) moved by `days` calendar days, which
 * may be negative. Built from the date's own components with `setDate`, never
 * `new Date(iso)` (UTC midnight) or millisecond arithmetic (DST), so it is the
 * same stepping `daysAgoIsoDate` has always done, from any starting day - the
 * selectors in `src/selectors/` take "today" as an argument (ADR 0028).
 */
export function shiftIsoDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/**
 * Spec 4.10: a day group's heading - "Sun, Sep 27", with "Today · " or
 * "Yesterday · " in front when it is one of those, and the year only when it
 * is not `today`'s. Built from local calendar components like
 * `formatDayInfo`, and `today` is an argument so a list formats every day
 * against the same one.
 */
export function formatDayLabel(iso: string, today: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  const label = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  if (iso === today) return `Today · ${label}`;
  if (iso === shiftIsoDate(today, -1)) return `Yesterday · ${label}`;
  return label;
}

/**
 * An instant (a full ISO timestamp such as a session's last refresh) as local
 * `YYYY-MM-DD HH:MM`. The timestamp is an instant, so parsing it is correct -
 * unlike a bare calendar-day string - and the output uses local components,
 * so it matches the day every other date in the app shows. `null` for an
 * unparseable value.
 */
export function formatLocalDateTime(instant: string): string | null {
  const d = new Date(instant);
  if (isNaN(d.getTime())) return null;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${toIsoDate(d)} ${hours}:${minutes}`;
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
