import React from 'react';
import { TransactionType } from '../../types';
import { formatCurrencyAmount } from '../../utils/currency';
import { TX_TYPE_META, txTypeMetaFor, TransferDirection } from './txTypeMeta';

export type TxTypeIconSize = 'md' | 'lg';

interface TxTypeIconProps {
  type: TransactionType;
  /** The row's amount. Only an ADJUSTMENT reads it: its direction, and so its icon, comes from the sign (ADR 0024). */
  amount?: number;
  /** `md` = `w-7 h-7 sm:w-8 sm:h-8`, the old transactions table's, kept as the default; `lg` = the spec's 36px tile (`TransactionRow`). */
  size?: TxTypeIconSize;
  className?: string;
}

const ICON_BOX_SIZE_CLASS: Record<TxTypeIconSize, string> = {
  md: 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg',
  lg: 'w-9 h-9 rounded-inner',
};

/**
 * T49: the icon-in-a-tinted-box cell, and (Phase 56) the 36px tile of
 * `TransactionRow` (size `lg`, spec 4.9). Since Phase 59 every activity list
 * renders through `TransactionRow`, so the app draws one icon set everywhere;
 * the wallet popup's compact set and its own tints went with the popup.
 */
export const TxTypeIcon: React.FC<TxTypeIconProps> = ({ type, amount, size = 'md', className = '' }) => {
  const meta = amount === undefined ? TX_TYPE_META[type] : txTypeMetaFor(type, amount);
  const Icon = meta.icon;
  const tint = meta.tint;

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

/**
 * T49: the `[Soft Deleted]` tag - centralized so the string
 * `soft-delete.spec.ts` asserts on (`getByText('[Soft Deleted]')`) has one
 * source instead of being retyped at every renderer that adopts it.
 */
export const TxSoftDeletedTag: React.FC = () => (
  <span className="inline-block text-[10px] font-semibold text-expense uppercase">[Soft Deleted]</span>
);
