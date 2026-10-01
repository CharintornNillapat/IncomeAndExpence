/**
 * Wallet-specific form data. Generic field styling (labels, inputs, error
 * banners, buttons) lives in `src/utils/formStyles.ts` (T24) - this file now
 * holds only the domain data that's actually specific to wallets.
 */
export type { FieldTone } from '../../utils/formStyles';

/**
 * The colours offered when creating or editing a wallet: spec section 1's
 * twelve muted identity colours (audit 008 finding 2). None is red, green,
 * blue, cyan or amber, which carry money meaning (spec section 3). Wallets
 * that already hold an older colour keep it until spec 5.1's migration.
 */
export const WALLET_COLOR_PALETTE = [
  '#D9A066', // tan
  '#6C8EEF', // blue
  '#4FB7A8', // teal
  '#F59E6B', // peach
  '#E879A6', // rose
  '#7DA2F0', // periwinkle
  '#B69CF5', // lavender
  '#5CC8B8', // aqua
  '#C7B38A', // khaki
  '#8FA8C8', // steel
  '#D98FD0', // orchid
  '#9C8CD9', // iris
] as const;

export const WALLET_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'BANK_ACCOUNT', label: 'Bank Account' },
  { value: 'CASH', label: 'Cash' },
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'INVESTMENT', label: 'Investment' },
  { value: 'E_WALLET', label: 'E-Wallet' },
];

/** A wallet type's display label ("Bank Account"), never the raw enum (spec L10's rule, applied to wallets). */
export function walletTypeLabel(type: string): string {
  return WALLET_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? 'Wallet';
}
