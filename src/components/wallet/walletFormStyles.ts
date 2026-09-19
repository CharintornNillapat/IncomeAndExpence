/**
 * Wallet-specific form data. Generic field styling (labels, inputs, error
 * banners, buttons) lives in `src/utils/formStyles.ts` (T24) - this file now
 * holds only the domain data that's actually specific to wallets.
 */
export type { FieldTone } from '../../utils/formStyles';

/** Theme colours offered when creating a wallet. */
export const WALLET_COLOR_PALETTE = [
  '#0284c7',
  '#16a34a',
  '#7c3aed',
  '#f59e0b',
  '#ef4444',
  '#0f172a',
  '#059669',
  '#d97706',
] as const;

export const WALLET_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'BANK_ACCOUNT', label: 'Bank Account' },
  { value: 'CASH', label: 'Cash' },
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'INVESTMENT', label: 'Investment' },
  { value: 'E_WALLET', label: 'E-Wallet' },
];
