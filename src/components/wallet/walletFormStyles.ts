/**
 * Shared field styling for the wallet forms.
 *
 * `WalletsView` renders its fields on a subtly tinted ground while
 * `WalletPopupModal` renders them flat white, so the tone is a prop rather than
 * something the shared components hard-code.
 */
export type FieldTone = 'subtle' | 'plain';

const FIELD_BASE =
  'w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400';

const TONE: Record<FieldTone, string> = {
  subtle:
    'bg-stone-50 dark:bg-stone-800 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors',
  plain: 'bg-white dark:bg-stone-800',
};

export const LABEL_CLASS =
  'text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1';

/** Text / number inputs use slightly wider horizontal padding than selects. */
export function inputClass(tone: FieldTone): string {
  return `${FIELD_BASE} px-3.5 py-2.5 placeholder:text-stone-400 dark:placeholder:text-stone-500 ${TONE[tone]}`;
}

export function selectClass(tone: FieldTone): string {
  return `${FIELD_BASE} px-3 py-2.5 ${TONE[tone]}`;
}

/** Native <option> elements need explicit dark colours to render correctly. */
export const OPTION_CLASS = 'dark:bg-stone-800 dark:text-stone-100';

export const ERROR_BANNER_CLASS =
  'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 p-3 rounded-xl text-xs font-medium';

export const PRIMARY_BUTTON_CLASS =
  'w-full py-2.5 sm:py-3 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 rounded-xl font-semibold text-xs transition-all shadow-xs cursor-pointer';

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
