import { CurrencyCode } from '../types';

/**
 * FinLife Tracker is single-currency: everything is Thai Baht.
 *
 * There is deliberately no exchange-rate table or conversion helper here. The
 * transfer path moves balances 1:1 in nominal units, which is only correct while
 * every wallet shares one currency - so introducing a second currency requires
 * adding conversion to the ledger first, not just a symbol here.
 */
export const APP_CURRENCY: CurrencyCode = 'THB';
export const APP_CURRENCY_SYMBOL = '฿';

/**
 * Canonical negative-amount glyph (U+2212, a proper minus sign) for display
 * surfaces - not the CSV export, which stays ASCII since a machine-readable
 * column must round-trip through a plain `-`.
 */
export const MINUS = '−';

/**
 * Shared `toLocaleString` options for two-decimal currency display, so
 * `formatCurrencyAmount` and `AnimatedCounter` (which animates the same
 * shape of number and must match its formatting exactly mid-animation)
 * can't drift apart by editing one and not the other.
 */
export const CURRENCY_DISPLAY_OPTIONS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

/**
 * Formats an amount as Thai Baht, e.g. `฿1,234.50`.
 */
export function formatCurrencyAmount(amount: number): string {
  const formattedNum = (Number(amount) || 0).toLocaleString('en-US', CURRENCY_DISPLAY_OPTIONS);
  return `${APP_CURRENCY_SYMBOL}${formattedNum}`;
}
