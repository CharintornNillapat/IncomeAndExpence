/**
 * Wallet-specific form data. Generic field styling (labels, inputs, error
 * banners, buttons) lives in `src/utils/formStyles.ts` (T24) - this file now
 * holds only the domain data that's actually specific to wallets.
 */
import { IDENTITY_COLORS } from '../../utils/identityPalette';

export type { FieldTone } from '../../utils/formStyles';

/**
 * The colours offered when creating or editing a wallet: spec section 1's
 * twelve muted identity colours (audit 008 finding 2), the same twelve the
 * Categories page offers (`identityPalette.ts`). The starter wallets moved onto
 * them in spec 5.1's migration (ADR 0038); a wallet on any other colour keeps it,
 * since Save sends the colour unchanged until another is picked.
 */
export const WALLET_COLOR_PALETTE = IDENTITY_COLORS;

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
