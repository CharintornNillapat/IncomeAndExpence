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
 * Formats an amount as Thai Baht, e.g. `฿1,234.50`.
 */
export function formatCurrencyAmount(amount: number): string {
  const formattedNum = (Number(amount) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${APP_CURRENCY_SYMBOL}${formattedNum}`;
}
