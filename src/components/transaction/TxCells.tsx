import React from 'react';
import { TransactionType, Category } from '../../types';
import { formatCurrencyAmount } from '../../utils/currency';
import { TX_TYPE_META, txTypeMetaFor } from './txTypeMeta';
import { CategoryChip, CategoryChipSize, ChipRounding } from '../ui/Badge';

export type TxTypeIconVariant = 'full' | 'compact';
export type TxTypeIconSize = 'sm' | 'md';

interface TxTypeIconProps {
  type: TransactionType;
  /** The row's amount. Only an ADJUSTMENT reads it: its direction, and so its icon, comes from the sign (ADR 0024). */
  amount?: number;
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
export const TxTypeIcon: React.FC<TxTypeIconProps> = ({ type, amount, variant = 'full', size = 'md', tintOverride, className = '' }) => {
  const meta = amount === undefined ? TX_TYPE_META[type] : txTypeMetaFor(type, amount);
  const Icon = variant === 'compact' ? meta.compactIcon : meta.icon;
  const tint = tintOverride ?? meta.tint;

  return (
    <div className={`${ICON_BOX_SIZE_CLASS[size]} rounded-lg flex items-center justify-center shrink-0 ${tint} ${className}`.trim()}>
      <Icon className="w-3.5 h-3.5" />
    </div>
  );
};

interface TxAmountProps {
  amount: number;
  type: TransactionType;
  /** A site's own colour when it deliberately differs from the sign rule (e.g. `DiaryEntryCard`'s all-outflow list) - overrides `txTypeMetaFor(...).text`. */
  colorClassName?: string;
  className?: string;
}

/**
 * T49: formats an amount with `formatCurrencyAmount` and the canonical
 * `txTypeMetaFor(type, amount).sign` glyph ('+' for INCOME and an upward
 * ADJUSTMENT, the shared `MINUS` (U+2212) otherwise) - not a per-site
 * re-derived ternary.
 *
 * Phase 53b (DESIGN.md §4): the colour comes from the same metadata, so every
 * ledger renders `+` emerald, `−` rose, a transfer cyan and a repayment amber.
 * Until then this took one of three per-site schemes (`standard`,
 * `incomeOnly`, and `RecentTransactionsTable`'s own 4-way map); that table's
 * map was already this rule, and the other two left expenses in plain text.
 */
export const TxAmount: React.FC<TxAmountProps> = ({ amount, type, colorClassName, className = '' }) => {
  const meta = txTypeMetaFor(type, amount);
  const color = colorClassName ?? meta.text;

  return (
    <span className={`font-mono tabular-nums font-bold ${color} ${className}`.trim()}>
      {meta.sign}
      {formatCurrencyAmount(Math.abs(amount))}
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
  <span className="inline-block text-[10px] font-semibold text-expense uppercase">[Soft Deleted]</span>
);
