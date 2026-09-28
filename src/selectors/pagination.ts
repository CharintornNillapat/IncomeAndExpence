/**
 * Spec L12 (ADR 0028): the transaction list loads 25 rows at a time behind a
 * "Load 25 more" button, instead of pages of 8.
 */
export const PAGE_STEP = 25;

export function visibleRows<T>(rows: T[], loadedCount: number): T[] {
  return rows.slice(0, loadedCount);
}

export function hasMoreRows(rows: unknown[], loadedCount: number): boolean {
  return rows.length > loadedCount;
}
