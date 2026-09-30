import React from 'react';
import { TransactionType, Category } from '../../types';
import { formatCurrencyAmount } from '../../utils/currency';
import { TX_TYPE_META, txTypeMetaFor, TransferDirection } from './txTypeMeta';
import { Chip, ChipSize } from '../ui/Chip';

export type TxTypeIconVariant = 'full' | 'compact';
export type TxTypeIconSize = 'sm' | 'md' | 'lg';

interface TxTypeIconProps {
  type: TransactionType;
  /** The row's amount. Only an ADJUSTMENT reads it: its direction, and so its icon, comes from the sign (ADR 0024). */
  amount?: number;
  /** `full` (`TX_TYPE_META.icon`, the 4-way icon set) or `compact` (`.compactIcon`, the binary Trending{Up,Down} set). */
  variant?: TxTypeIconVariant;
  /** `sm` = fixed `w-7 h-7` box (matches `WalletPopupModal`'s activity list); `md` = `w-7 h-7 sm:w-8 sm:h-8` (matches `TransactionTableRow`'s single icon spanning both breakpoints); `lg` = the spec's 36px tile (`TransactionRow`). */
  size?: TxTypeIconSize;
  /** A site's own tint string when it has already diverged from `TX_TYPE_META.tint` (e.g. `WalletPopupModal`'s 3-way scheme) - overrides the token default rather than changing what's on screen. */
  tintOverride?: string;
  className?: string;
}

const ICON_BOX_SIZE_CLASS: Record<TxTypeIconSize, string> = {
  sm: 'w-7 h-7 rounded-lg',
  md: 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg',
  lg: 'w-9 h-9 rounded-inner',
};

/**
 * T49: the icon-in-a-tinted-box cell shared by `TransactionTableRow` and
 * `WalletPopupModal`'s activity list, and (Phase 56) the 36px tile of
 * `TransactionRow` (size `lg`, spec 4.9), which the Dashboard's Recent
 * activity uses since Phase 57. The other pages move onto `TransactionRow`
 * in their own phases, which gives the app one icon set everywhere.
 */
export const TxTypeIcon: React.FC<TxTypeIconProps> = ({ type, amount, variant = 'full', size = 'md', tintOverride, className = '' }) => {
  const meta = amount === undefined ? TX_TYPE_META[type] : txTypeMetaFor(type, amount);
  const Icon = variant === 'compact' ? meta.compactIcon : meta.icon;
  const tint = tintOverride ?? meta.tint;

  // A <span>, not a <div>: since Phase 58a the tile sits inside a
  // `TransactionRow` <button>, which may hold phrasing content only.
  return (
    <span aria-hidden="true" className={`${ICON_BOX_SIZE_CLASS[size]} flex items-center justify-center shrink-0 ${tint} ${className}`.trim()}>
      <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
    </span>
  );
};

interface TxAmountProps {
  amount: number;
  type: TransactionType;
  /** Set only inside one wallet's own view: a transfer then shows `+` arriving or `−` leaving (see `transferDirection`). */
  direction?: TransferDirection;
  /** A site's own colour when it deliberately differs from the sign rule (e.g. `DiaryEntryCard`'s all-outflow list) - overrides `txTypeMetaFor(...).text`. */
  colorClassName?: string;
  className?: string;
}

/**
 * T49: formats an amount with `formatCurrencyAmount` and the canonical
 * `txTypeMetaFor(type, amount, direction).sign` glyph - not a per-site
 * re-derived ternary.
 *
 * The colour comes from the same metadata (spec section 3, ADR 0027): income
 * green `+`, expense red `−`, a transfer blue and unsigned, an adjustment or a
 * repayment grey. Digits align through the body's `tabular-nums`, not a
 * monospace face.
 */
export const TxAmount: React.FC<TxAmountProps> = ({ amount, type, direction, colorClassName, className = '' }) => {
  const meta = txTypeMetaFor(type, amount, direction);
  const color = colorClassName ?? meta.text;

  return (
    <span className={`tabular-nums font-bold ${color} ${className}`.trim()}>
      {meta.sign}
      {formatCurrencyAmount(Math.abs(amount))}
    </span>
  );
};

interface TxCategoryChipProps {
  /** Renders nothing when absent - callers keep their own fallback branch (a debt badge, an em dash, a type-name string) alongside this, unchanged. */
  category: Category | undefined;
  size?: ChipSize;
  className?: string;
}

/**
 * T49: thin pass-through over the shared chip, scoped to the transaction-row
 * shape - callers still own the "no category" branch, since that part differs
 * per site and isn't a category chip at all (L13 unifies it in the page phase).
 *
 * Phase 56 (spec 4.7): the chip is neutral with the category's colour on its
 * dot, so the rounding and dot options each call site used to pick are gone.
 */
export const TxCategoryChip: React.FC<TxCategoryChipProps> = ({ category, size = 'md', className = '' }) => {
  if (!category) return null;
  return <Chip label={category.name} color={category.color} size={size} className={className} />;
};

/**
 * T49: the `[Soft Deleted]` tag - centralized so the string
 * `soft-delete.spec.ts` asserts on (`getByText('[Soft Deleted]')`) has one
 * source instead of being retyped at every renderer that adopts it.
 */
export const TxSoftDeletedTag: React.FC = () => (
  <span className="inline-block text-[10px] font-semibold text-expense uppercase">[Soft Deleted]</span>
);
