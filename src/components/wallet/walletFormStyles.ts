/**
 * Wallet-specific form data. Generic field styling (labels, inputs, error
 * banners, buttons) lives in `src/utils/formStyles.ts` (T24) - this file now
 * holds only the domain data that's actually specific to wallets.
 */
import { formatCurrencyAmount } from '../../utils/currency';
import { walletTotal } from '../../selectors/wallets';
import type { Wallet } from '../../types';

export type { FieldTone } from '../../utils/formStyles';

export const WALLET_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'BANK_ACCOUNT', label: 'Bank Account' },
  { value: 'CASH', label: 'Cash' },
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'INVESTMENT', label: 'Investment' },
  { value: 'E_WALLET', label: 'E-Wallet' },
];

/**
 * The caption under an allocation bar with nothing above zero (ADR 0042):
 * "no money" only when the wallets hold none, and their total when they add
 * up to less than zero (ADR 0085, audit finding 8).
 */
export function emptyWalletsCaption(wallets: Wallet[]): string {
  const total = walletTotal(wallets);
  return total < 0 ? `Your wallets add up to ${formatCurrencyAmount(total)}` : 'No money in your wallets yet';
}

/** A wallet type's display label ("Bank Account"), never the raw enum (spec L10's rule, applied to wallets). */
export function walletTypeLabel(type: string): string {
  return WALLET_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? 'Wallet';
}
