import React from 'react';
import { TransactionType, Category } from '../../types';
import { formatCurrencyAmount } from '../../utils/currency';
import { TX_TYPE_META } from './txTypeMeta';
import { CategoryChip, CategoryChipSize, ChipRounding } from '../ui/Badge';

export type TxTypeIconVariant = 'full' | 'compact';
export type TxTypeIconSize = 'sm' | 'md';

interface TxTypeIconProps {
  type: TransactionType;
  /** `full` (`TX_TYPE_META.icon`, the 4-way icon set) or `compact` (`.compactIcon`, the binary Trending{Up,Down} set). */
  variant?: TxTypeIconVariant;
  /** `sm` = fixed `w-7 h-7` box (matches `WalletPopupModal`'s activity list); `md` = `w-7 h-7 sm:w-8 sm:h-8` (matches `TransactionTableRow`'s single icon spanning both breakpoints). */
  size?: TxTypeIconSize;
  /** A site's own tint string when it has already diverged from `TX_TYPE_META.tint` (e.g. `WalletPopupModal`'s 3-way scheme) - overrides the token default rather than changing what's on screen. */
  tintOverride?: string;
  className?: string;
}

const ICON_BOX_SIZE_CLASS: Record<TxTypeIconSize, string> = {
  sm: 'w-7 h-7',
  md: 'w-7 h-7 sm:w-8 sm:h-8',
};

/**
 * T49: the icon-in-a-tinted-box cell repeated (with a genuinely different
 * icon set and tint scheme per divergent site - see `txTypeMeta.ts`'s own
 * note) across `TransactionTableRow` and `WalletPopupModal`'s activity list.
 * `RecentTransactionsTable`'s Type column uses a 3rd icon set entirely
 * (`ArrowLeftRight`/`TrendingDown` for TRANSFER/DEBT_REPAYMENT, not
 * `TX_TYPE_META`'s `RefreshCw`/`Landmark`) and stays local - adopting this
 * component there would render the wrong icon, not just a different one.
 */
export const TxTypeIcon: React.FC<TxTypeIconProps> = ({ type, variant = 'full', size = 'md', tintOverride, className = '' }) => {
  const meta = TX_TYPE_META[type];
  const Icon = variant === 'compact' ? meta.compactIcon : meta.icon;
  const tint = tintOverride ?? meta.tint;

  return (
    <div className={`${ICON_BOX_SIZE_CLASS[size]} rounded-lg flex items-center justify-center shrink-0 ${tint} ${className}`.trim()}>
      <Icon className="w-3.5 h-3.5" />
    </div>
  );
};

export type TxAmountColorScheme = 'standard' | 'incomeOnly';

interface TxAmountProps {
  amount: number;
  type: TransactionType;
  /**
   * `standard` (income emerald / debt-repayment amber / else stone -
   * `TransactionTableRow`'s exact scheme) or `incomeOnly` (income emerald /
   * else stone - `WalletPopupModal`'s exact scheme, where debt-repayment
   * has never had its own color). Ignored when `colorClassName` is given.
   */
  colorScheme?: TxAmountColorScheme;
  /** A site's own divergent color scheme (e.g. `RecentTransactionsTable`'s 4-way emerald/rose/amber/indigo) - overrides both presets above. */
  colorClassName?: string;
  className?: string;
}

const STANDARD_COLOR: Partial<Record<TransactionType, string>> = {
  INCOME: 'text-emerald-600 dark:text-emerald-400',
  DEBT_REPAYMENT: 'text-amber-600 dark:text-amber-400',
};

const INCOME_ONLY_COLOR: Partial<Record<TransactionType, string>> = {
  INCOME: 'text-emerald-600 dark:text-emerald-400',
};

const DEFAULT_COLOR = 'text-stone-900 dark:text-stone-100';

/**
 * T49: formats an amount with `formatCurrencyAmount` and the canonical
 * `TX_TYPE_META[type].sign` glyph ('+' for INCOME, the shared `MINUS`
 * (U+2212) otherwise) - not a per-site re-derived ternary. Adopting the
 * canonical sign at `RecentTransactionsTable` is a deliberate fix, not a
 * preserved behavior: that file's pre-existing inline ternary rendered no
 * sign at all for TRANSFER/DEBT_REPAYMENT/ADJUSTMENT, diverging from every
 * other renderer. Its color scheme (a 4th, `RecentTransactionsTable`-only
 * emerald/rose/amber/indigo split) is passed in via `colorClassName` rather
 * than added as a 3rd preset, since forcing that page's colors onto the
 * other two sites (or vice versa) would be a real visual regression at
 * whichever site didn't already use it.
 */
export const TxAmount: React.FC<TxAmountProps> = ({ amount, type, colorScheme = 'standard', colorClassName, className = '' }) => {
  const preset = colorScheme === 'incomeOnly' ? INCOME_ONLY_COLOR : STANDARD_COLOR;
  const color = colorClassName ?? preset[type] ?? DEFAULT_COLOR;

  return (
    <span className={`font-mono font-bold ${color} ${className}`.trim()}>
      {TX_TYPE_META[type].sign}
      {formatCurrencyAmount(amount)}
    </span>
  );
};

interface TxCategoryChipProps {
  /** Renders nothing when absent - callers keep their own fallback branch (a debt badge, an em dash, a type-name string) alongside this, unchanged. */
  category: Category | undefined;
  size?: CategoryChipSize;
  rounded?: ChipRounding;
  showDot?: boolean;
  className?: string;
}

/**
 * T49: thin pass-through over `CategoryChip` (Phase 26) scoped to the
 * transaction-row shape - callers still own the "no category" branch (a
 * debt badge, an em dash, or a type-name fallback string), since that part
 * differs per site and isn't a category chip at all.
 */
export const TxCategoryChip: React.FC<TxCategoryChipProps> = ({ category, size = 'md', rounded = 'md', showDot = false, className = '' }) => {
  if (!category) return null;
  return <CategoryChip name={category.name} color={category.color} size={size} rounded={rounded} showDot={showDot} className={className} />;
};

/**
 * T49: the `[Soft Deleted]` tag - centralized so the string
 * `soft-delete.spec.ts` asserts on (`getByText('[Soft Deleted]')`) has one
 * source instead of being retyped at every renderer that adopts it.
 */
export const TxSoftDeletedTag: React.FC = () => (
  <span className="inline-block text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase">[Soft Deleted]</span>
);
