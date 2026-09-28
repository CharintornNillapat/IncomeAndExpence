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

/** Two-decimal currency display. Exported until `AnimatedCounter` was removed (ADR 0026). */
const CURRENCY_DISPLAY_OPTIONS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

/**
 * Formats an amount as Thai Baht, e.g. `฿1,234.50`, and a negative as
 * `−฿1,234.50`: `MINUS` before the symbol (spec section 4.8, Phase 55a). Until
 * then a negative came out as `฿-1,234.50`, which is why every signed display
 * (`TxAmount`, `Money`) formats `Math.abs` and prints its own sign.
 */
export function formatCurrencyAmount(amount: number): string {
  const value = Number(amount) || 0;
  const formattedNum = Math.abs(value).toLocaleString('en-US', CURRENCY_DISPLAY_OPTIONS);
  return `${value < 0 ? MINUS : ''}${APP_CURRENCY_SYMBOL}${formattedNum}`;
}
