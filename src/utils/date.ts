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
