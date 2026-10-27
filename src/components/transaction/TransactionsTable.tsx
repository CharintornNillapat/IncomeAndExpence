import React, { useState } from 'react';
import { Category, Transaction, Wallet } from '../../types';
import {
  categoryLabel,
  displayTitle,
  hasOwnDescription,
  isSystemMovementCategory,
  walletLabel,
} from '../../selectors/display';
import { DayGroup, SYSTEM_CATEGORY_COLOR } from '../../selectors/ledger';
import { formatCurrencyAmount } from '../../utils/currency';
import { formatDayLabel, formatShortDate } from '../../utils/date';
import { ERROR_BANNER_CLASS } from '../../utils/formStyles';
import { Chip } from '../ui/Chip';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Money } from '../ui/Money';
import { OverflowMenu } from '../ui/OverflowMenu';
import { TxAmount, TxSoftDeletedTag } from './TxCells';
import { txTypeMetaFor } from './txTypeMeta';

interface WriteResult {
  success: boolean;
  error?: string;
}

interface TransactionsTableProps {
  days: DayGroup[];
  dayNets: ReadonlyMap<string, number>;
  today: string;
  categories: ReadonlyMap<string, Category>;
  wallets: ReadonlyMap<string, Wallet>;
  selectedTxId: string | null;
  onSelect: (tx: Transaction) => void;
  onDelete: (id: string) => Promise<WriteResult>;
  onRestore: (id: string) => Promise<WriteResult>;
}

// DESIGN.md section 3 and ImportCsvModal.tsx:502: sticky table headers are one of the two allowed backdrop blurs.
const HEADER_CELL_CLASS =
  'sticky top-0 z-10 bg-surface-2/90 backdrop-blur-sm px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-fg-secondary';

const CELL_CLASS = 'px-4 py-1 border-t border-line align-middle';

/**
 * Design spec 4.1 (ADR 0109 D3): the wide Transactions Table view from `lg` up,
 * rendering day groups as a semantic `<table>` with a row overflow menu and
 * delete confirmation.
 */
export const TransactionsTable: React.FC<TransactionsTableProps> = ({
  days,
  dayNets,
  today,
  categories,
  wallets,
  selectedTxId,
  onSelect,
  onDelete,
  onRestore,
}) => {
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const restore = async (tx: Transaction) => {
    setRestoreError(null);
    const result = await onRestore(tx.id);
    if (!result.success) {
      setRestoreError(result.error ?? 'Could not restore this transaction.');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    const result = await onDelete(pendingDelete.id);
    setIsDeleting(false);
    if (result.success) {
      setPendingDelete(null);
    } else {
      setDeleteError(result.error ?? 'Could not delete this transaction.');
    }
  };

  const closeDelete = () => {
    setPendingDelete(null);
    setDeleteError(null);
  };

  return (
    <>
      {restoreError && (
        <p role="alert" className={`${ERROR_BANNER_CLASS} mx-5 mb-3`}>
          {restoreError}
        </p>
      )}

      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[36rem] border-separate border-spacing-0 text-left">
          <caption className="sr-only">Transactions, newest first</caption>
          <thead>
            <tr>
              <th scope="col" className={HEADER_CELL_CLASS}>
                Date
              </th>
              <th scope="col" className={HEADER_CELL_CLASS}>
                Note
              </th>
              <th scope="col" className={HEADER_CELL_CLASS}>
                Category
              </th>
              <th scope="col" className={HEADER_CELL_CLASS}>
                Wallet
              </th>
              <th scope="col" className={`${HEADER_CELL_CLASS} text-right`}>
                Amount
              </th>
              <th scope="col" className={HEADER_CELL_CLASS}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          {days.map((day) => {
            const net = dayNets.get(day.date) ?? day.net;
            return (
              <tbody key={day.date}>
                <tr>
                  <th
                    scope="rowgroup"
                    colSpan={6}
                    className="bg-surface-2 px-4 py-2 text-xs text-left border-t border-line"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-fg-secondary">{formatDayLabel(day.date, today)}</span>
                      <Money
                        value={net}
                        showPlus
                        className={`font-semibold ${net < 0 ? 'text-expense' : 'text-fg'}`}
                      />
                    </div>
                  </th>
                </tr>

                {day.transactions.map((tx) => {
                  const category = tx.categoryId ? categories.get(tx.categoryId) : undefined;
                  const selected = tx.id === selectedTxId;
                  const ownNote = hasOwnDescription(tx);
                  const noteText = ownNote ? tx.description : 'No note';
                  const title = displayTitle(tx, category);
                  const chipLabel = categoryLabel(tx, category);
                  const categoryText =
                    chipLabel && chipLabel !== noteText && chipLabel !== title ? `, ${chipLabel}` : '';
                  const isoDate = tx.transactionDate.slice(0, 10);
                  const amountText = `${txTypeMetaFor(tx.type, tx.amount).sign}${formatCurrencyAmount(Math.abs(tx.amount))}`;
                  // Same chip colour rule as TransactionRow (TransactionRow.tsx:58-60).
                  const isSystemRow =
                    tx.type === 'ADJUSTMENT' ||
                    tx.type === 'DEBT_REPAYMENT' ||
                    !category ||
                    isSystemMovementCategory(category);
                  const chipColor = isSystemRow ? SYSTEM_CATEGORY_COLOR : (category?.color ?? SYSTEM_CATEGORY_COLOR);

                  return (
                    <tr key={tx.id} className={selected ? 'bg-brand-soft' : 'hover:bg-surface-3'}>
                      <td
                        className={`${CELL_CLASS} whitespace-nowrap text-xs text-fg-secondary ${
                          selected ? 'shadow-[inset_3px_0_0_var(--focus)]' : ''
                        }`.trim()}
                      >
                        {formatShortDate(isoDate)}
                      </td>

                      <td className={`${CELL_CLASS} w-full max-w-0`}>
                        <button
                          id={`tx-row-${tx.id}`}
                          type="button"
                          onClick={() => onSelect(tx)}
                          aria-current={selected ? 'true' : undefined}
                          className="w-full min-h-[44px] flex flex-col justify-center text-left cursor-pointer"
                        >
                          <span
                            className={`block truncate text-sm font-semibold ${
                              tx.isDeleted ? 'line-through text-fg-muted' : ownNote ? 'text-fg' : 'text-fg-muted'
                            }`}
                          >
                            {noteText}
                          </span>
                          {tx.isDeleted && <TxSoftDeletedTag />}
                          <span className="sr-only">
                            {`${title !== noteText ? `, ${title}` : ''}${categoryText}, ${amountText}, ${isoDate}`}
                          </span>
                        </button>
                      </td>

                      <td className={CELL_CLASS}>
                        {chipLabel ? <Chip label={chipLabel} color={chipColor} /> : null}
                      </td>

                      <td className={`${CELL_CLASS} whitespace-nowrap text-xs text-fg-secondary`}>
                        {walletLabel(tx, wallets)}
                      </td>

                      <td className={`${CELL_CLASS} text-right whitespace-nowrap`}>
                        <span aria-hidden="true">
                          <TxAmount amount={tx.amount} type={tx.type} className="text-sm" />
                        </span>
                      </td>

                      <td className={CELL_CLASS}>
                        {/* ponytail: an open menu on the last rows scrolls inside the scroll box (it clips an absolute child); a flip-up `placement` prop on `OverflowMenu` is the upgrade. */}
                        <OverflowMenu
                          label={`More actions for ${title}`}
                          triggerId={`tx-menu-btn-${tx.id}`}
                          items={
                            tx.isDeleted
                              ? [
                                  {
                                    id: `tx-menu-restore-btn-${tx.id}`,
                                    label: 'Restore',
                                    onSelect: () => {
                                      void restore(tx);
                                    },
                                  },
                                ]
                              : [
                                  {
                                    id: `tx-menu-edit-btn-${tx.id}`,
                                    label: 'Edit',
                                    onSelect: () => onSelect(tx),
                                  },
                                  {
                                    id: `tx-menu-delete-btn-${tx.id}`,
                                    label: 'Delete',
                                    tone: 'danger',
                                    onSelect: () => {
                                      setDeleteError(null);
                                      setPendingDelete(tx);
                                    },
                                  },
                                ]
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete this transaction?"
        description="It leaves your lists and totals and reverses its effect on the wallet. You can restore it from Show deleted."
        confirmText="Delete"
        isLoading={isDeleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onClose={closeDelete}
      />
    </>
  );
};
