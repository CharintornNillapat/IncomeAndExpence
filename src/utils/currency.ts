import { Wallet } from '../types';

export const CURRENCY_SYMBOLS: Record<string, string> = {
  THB: '฿',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  SGD: 'S$',
  AUD: 'A$',
  CAD: 'CA$',
  CHF: 'CHF ',
  HKD: 'HK$',
  KRW: '₩',
  INR: '₹',
  MYR: 'RM ',
  PHP: '₱',
  VND: '₫',
  IDR: 'Rp ',
  TWD: 'NT$',
  NZD: 'NZ$',
  BRL: 'R$',
  AED: 'AED ',
  SAR: 'SAR ',
  SEK: 'kr ',
  NOK: 'kr ',
  DKK: 'kr ',
  PLN: 'zł ',
  TRY: '₺',
  RUB: '₽',
  ZAR: 'R ',
  MXN: 'Mex$',
};

/**
 * Returns the symbol for a given currency code (e.g. 'THB' -> '฿', 'USD' -> '$')
 */
export function getCurrencySymbol(currency?: string): string {
  if (!currency) return '$';
  const upper = currency.toUpperCase().trim();
  return CURRENCY_SYMBOLS[upper] || `${upper} `;
}

/**
 * Formats a numeric amount with its currency symbol and code.
 */
export function formatCurrencyAmount(
  amount: number,
  currency: string = 'USD',
  options: { showCode?: boolean; showSymbol?: boolean } = { showCode: true, showSymbol: true }
): string {
  const symbol = options.showSymbol !== false ? getCurrencySymbol(currency) : '';
  const formattedNum = (Number(amount) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const code = options.showCode ? ` ${currency.toUpperCase()}` : '';
  return `${symbol}${formattedNum}${code}`;
}

export interface CurrencyGroupSummary {
  currency: string;
  symbol: string;
  total: number;
  count: number;
  wallets: Wallet[];
}

export interface WalletsCurrencyBreakdown {
  groups: CurrencyGroupSummary[];
  isSingleCurrency: boolean;
  primaryCurrency: string;
  primarySymbol: string;
  primaryTotal: number;
  totalCount: number;
  overallGrandTotal: number;
  formattedSummaryString: string;
}

/**
 * Groups and calculates currency-specific balances across active wallets.
 */
export function getWalletsCurrencyBreakdown(wallets: Wallet[]): WalletsCurrencyBreakdown {
  const activeWallets = wallets.filter((w) => !w.isDeleted && !w.isArchived);

  const groupMap = new Map<string, { total: number; count: number; wallets: Wallet[] }>();

  activeWallets.forEach((w) => {
    const cur = (w.currency || 'USD').toUpperCase().trim();
    const existing = groupMap.get(cur) || { total: 0, count: 0, wallets: [] };
    existing.total += Number(w.balance || 0);
    existing.count += 1;
    existing.wallets.push(w);
    groupMap.set(cur, existing);
  });

  const groups: CurrencyGroupSummary[] = Array.from(groupMap.entries())
    .map(([currency, data]) => ({
      currency,
      symbol: getCurrencySymbol(currency),
      total: data.total,
      count: data.count,
      wallets: data.wallets,
    }))
    .sort((a, b) => b.total - a.total);

  const isSingleCurrency = groups.length <= 1;
  const primaryCurrency = groups[0]?.currency || 'USD';
  const primarySymbol = getCurrencySymbol(primaryCurrency);
  const primaryTotal = groups[0]?.total || 0;
  const overallGrandTotal = groups.reduce((acc, g) => acc + g.total, 0);

  const formattedSummaryString =
    groups.length === 0
      ? `${primarySymbol}0.00 ${primaryCurrency}`
      : groups
          .map(
            (g) =>
              `${g.symbol}${g.total.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} ${g.currency}`
          )
          .join(' + ');

  return {
    groups,
    isSingleCurrency,
    primaryCurrency,
    primarySymbol,
    primaryTotal,
    totalCount: activeWallets.length,
    overallGrandTotal,
    formattedSummaryString,
  };
}
