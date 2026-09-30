import React from 'react';
import { Category, Transaction, Wallet } from '../../types';
import { categoryLabel, displayTitle, isSystemMovementCategory, secondaryLine } from '../../selectors/display';
import { SYSTEM_CATEGORY_COLOR } from '../../selectors/ledger';
import { Chip } from '../ui/Chip';
import { TxAmount, TxSoftDeletedTag, TxTypeIcon } from './TxCells';
import { transferDirection } from './txTypeMeta';

interface TransactionRowProps {
  tx: Transaction;
  category: Category | undefined;
  /** Every wallet the row may name, deleted ones included, so an old row still reads its wallet. */
  wallets: ReadonlyMap<string, Wallet>;
  /** Set inside one wallet's own view: a transfer is then signed by its direction (spec 4.8). */
  walletId?: string;
  /** Makes the whole row a button that reports this transaction (spec 4.9: click to edit). */
  onSelect?: (tx: Transaction) => void;
  /** The row being edited (spec 6.2). */
  selected?: boolean;
  /** Extra text for the second line, such as the date a flat list needs to show. */
  meta?: React.ReactNode;
  /**
   * The row's date as hidden text, for a list that shows the date only in a
   * `DayGroupHeader` above it. Assistive technology still reads each row's
   * date, and `presets.spec.ts` filters rows by it (Phase 58a, ADR 0031).
   */
  dateText?: string;
  id?: string;
  className?: string;
}

/**
 * Spec 4.9 (ADR 0029): one transaction row for every page, replacing the
 * three renderers (the transactions table row, the dashboard's recent table,
 * the wallet activity list) in the page redesign.
 *
 * - A 36px tile with the one icon set: ↙ income, ↗ expense, ⇄ transfer, +/−
 *   adjustment.
 * - The title and second line come from the L6/L7 selectors, the chip from
 *   L10/L13. So no row can print "No category", "General", the default
 *   "Transaction" or a raw enum, and a transfer has no chip at all.
 * - The amount is `TxAmount`, signed by direction only inside one wallet.
 * - With `onSelect` the whole row is a `<button>`. Without it, it is a plain
 *   `<div>`, so nothing looks clickable that is not.
 */
export const TransactionRow: React.FC<TransactionRowProps> = ({
  tx,
  category,
  wallets,
  walletId,
  onSelect,
  selected = false,
  meta,
  dateText,
  id,
  className = '',
}) => {
  const chipLabel = categoryLabel(tx, category);
  const isSystemRow = tx.type === 'ADJUSTMENT' || tx.type === 'DEBT_REPAYMENT' || !category || isSystemMovementCategory(category);
  const chipColor = isSystemRow ? SYSTEM_CATEGORY_COLOR : (category?.color ?? SYSTEM_CATEGORY_COLOR);
  const direction = walletId ? transferDirection(tx, walletId) : undefined;

  const classes = [
    'w-full flex items-center gap-3 px-4 py-3 text-left transition-control duration-150',
    onSelect ? 'cursor-pointer hover:bg-surface-2' : '',
    // Spec 6.2: the row being edited sits on the soft violet with a 3px violet
    // edge. An inset shadow draws the edge without shifting the row's content.
    selected ? 'bg-brand-soft shadow-[inset_3px_0_0_var(--focus)]' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <TxTypeIcon type={tx.type} amount={tx.amount} size="lg" />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-semibold ${tx.isDeleted ? 'line-through text-fg-muted' : 'text-fg'}`}>
          {displayTitle(tx, category)}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-fg-muted truncate">
          <span className="truncate">{secondaryLine(tx, wallets)}</span>
          {meta}
          {dateText && <span className="sr-only">, {dateText}</span>}
        </span>
        {tx.isDeleted && <TxSoftDeletedTag />}
      </span>
      {/* The wrapper owns the breakpoint, so `hidden` never competes with the chip's own `inline-flex`. */}
      {chipLabel && (
        <span className="hidden sm:inline-flex shrink-0 max-w-[140px]">
          <Chip label={chipLabel} color={chipColor} />
        </span>
      )}
      <TxAmount amount={tx.amount} type={tx.type} direction={direction} className="shrink-0 text-sm" />
    </>
  );

  if (onSelect) {
    return (
      <button id={id} type="button" onClick={() => onSelect(tx)} aria-current={selected ? 'true' : undefined} className={classes}>
        {content}
      </button>
    );
  }
  return (
    <div id={id} className={classes}>
      {content}
    </div>
  );
};
