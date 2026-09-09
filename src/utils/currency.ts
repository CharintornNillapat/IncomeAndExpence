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
 * Formats an amount as Thai Baht, e.g. `฿1,234.50` or `฿1,234.50 THB`.
 */
export function formatCurrencyAmount(
  amount: number,
  options: { showCode?: boolean; showSymbol?: boolean } = {}
): string {
  const { showCode = false, showSymbol = true } = options;
  const formattedNum = (Number(amount) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${showSymbol ? APP_CURRENCY_SYMBOL : ''}${formattedNum}${showCode ? ` ${APP_CURRENCY}` : ''}`;
}
