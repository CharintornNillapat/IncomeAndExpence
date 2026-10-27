/**
 * The Transactions page's remembered view (design spec O4, ADR 0109 D6): a
 * per-device preference in `localStorage`, never synced. It is not one of
 * `FinanceContext`'s `LEDGER_STORAGE_KEYS`, so signing out leaves it alone,
 * as it does `pf_insights_collapsed`.
 */
export const TX_VIEW_KEY = 'pf_tx_view';

export type TxViewMode = 'table' | 'calendar';

/** Anything but a stored "calendar", and any storage failure, is the Table. */
export function readTxView(): TxViewMode {
  try {
    return localStorage.getItem(TX_VIEW_KEY) === 'calendar' ? 'calendar' : 'table';
  } catch {
    return 'table';
  }
}

export function writeTxView(mode: TxViewMode): void {
  try {
    localStorage.setItem(TX_VIEW_KEY, mode);
  } catch {
    // Private mode or blocked site data: the switch still works for this
    // session; it just will not be remembered.
  }
}
