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

function localDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** The Dashboard header's date: "Monday, Sep 28, 2026". */
export function formatLongDate(iso: string): string {
  return localDate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

/** A date with its year and no weekday, such as a debt's due date: "Jan 1, 2027". */
export function formatShortDate(iso: string): string {
  return localDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** A nearby day with its weekday and no year: "Mon, Sep 28". */
export function formatWeekdayDate(iso: string): string {
  return localDate(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** A calendar month key (`YYYY-MM`) as its name: "September". */
export function formatMonthName(monthKey: string): string {
  return localDate(`${monthKey}-01`).toLocaleDateString('en-US', { month: 'long' });
}

/** A local calendar date's month key: `2026-09-28` -> `2026-09`. */
export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

/** A month key (`YYYY-MM`) moved by `months`, which may be negative. */
export function shiftMonth(monthKey: string, months: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/**
 * Spec 6.5's month calendar: the month's days as weeks that start on Monday,
 * each day a local `YYYY-MM-DD`, with `null` before the 1st and after the
 * last day so every week has seven cells. Built from local calendar parts.
 */
export function monthGrid(monthKey: string): Array<Array<string | null>> {
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  // getDay(): Sunday 0 ... Saturday 6. Monday-first puts Sunday last.
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells: Array<string | null> = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(`${monthKey}-${String(day).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** The diary form's heading (spec 6.5): "Monday, Sep 28", with the year only when it is not `today`'s. */
export function formatDiaryHeading(iso: string, today: string): string {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
  if (iso.slice(0, 4) !== today.slice(0, 4)) options.year = 'numeric';
  return localDate(iso).toLocaleDateString('en-US', options);
}

/** A calendar month key (`YYYY-MM`) with its year: "September 2026". */
export function formatMonthYear(monthKey: string): string {
  return localDate(`${monthKey}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** The Dashboard's greeting for a local hour (0 to 23): morning from 5, afternoon from 12, evening from 18. */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
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
