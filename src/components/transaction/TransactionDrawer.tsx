import React, { useState } from 'react';
import type { Category, Debt, Transaction, TransactionEdit, Wallet } from '../../types';
import { Button } from '../ui/Button';
import { EditTransactionPanel } from './EditTransactionPanel';
import { Chip } from '../ui/Chip';
import { TxAmount } from './TxCells';
import { txTypeMetaFor } from './txTypeMeta';
import { categoryLabel, hasOwnDescription, isSystemMovementCategory } from '../../selectors/display';
import { SYSTEM_CATEGORY_COLOR } from '../../selectors/ledger';
import { formatLongDate } from '../../utils/date';
import { ERROR_BANNER_CLASS } from '../../utils/formStyles';

interface WriteResult {
  success: boolean;
  error?: string;
}

interface TransactionDetailsProps {
  tx: Transaction;
  category: Category | undefined;
  /** Every wallet, deleted ones included, so an old row still names its wallet. */
  wallets: ReadonlyMap<string, Wallet>;
  /** The same wallets and every category, for the edit panel's selects. */
  walletList: Wallet[];
  categoryList: Category[];
  /** The debt a repayment paid, if it still resolves. */
  debt?: Debt;
  onSave: (id: string, edit: TransactionEdit) => Promise<WriteResult>;
  onDelete: (id: string) => Promise<WriteResult>;
  onRestore: (id: string) => Promise<WriteResult>;
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 border-b border-line last:border-b-0 text-sm">
    <dt className="text-fg-muted shrink-0">{label}</dt>
    <dd className="text-fg text-right min-w-0 break-words">{children}</dd>
  </div>
);

/**
 * Spec 6.2's side panel for the selected row (Phase 58a, ADR 0031). A live row
 * opens `EditTransactionPanel` (Phase 58b, ADR 0033), which holds Save changes
 * and Delete. A deleted row is shown read-only here with Restore, since a
 * deleted row cannot be edited.
 *
 * The view decides where it sits: inline beside the list from `lg`, a bottom
 * sheet below. It is rendered once either way.
 *
 * A failed delete or restore is shown here. Before Phase 58a the table's
 * trash button discarded the `MutationResult`, so a failure showed nothing.
 *
 * Each row gets its own panel instance (`key={tx.id}`, ADR 0056). A save or
 * restore still in flight when another row is opened then finishes on the old
 * instance, which is gone, so its "saved" or its error can never land on the
 * new row. Before, both panels cleared their feedback in an effect on
 * `tx.id`, and a late result arrived after that effect had run.
 */
export const TransactionDetails: React.FC<TransactionDetailsProps> = (props) =>
  props.tx.isDeleted ? (
    <DeletedTransactionDetails key={props.tx.id} {...props} />
  ) : (
    <EditTransactionPanel
      key={props.tx.id}
      tx={props.tx}
      wallets={props.walletList}
      categories={props.categoryList}
      debt={props.debt}
      onSave={props.onSave}
      onDelete={props.onDelete}
    />
  );

const DeletedTransactionDetails: React.FC<TransactionDetailsProps> = ({ tx, category, wallets, onRestore }) => {
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const run = async (action: (id: string) => Promise<WriteResult>, fallback: string) => {
    setIsWorking(true);
    setError(null);
    try {
      const result = await action(tx.id);
      if (!result.success) setError(result.error || fallback);
    } finally {
      setIsWorking(false);
    }
  };

  const walletName = (id: string | undefined) => (id && wallets.get(id)?.name) || 'Unknown wallet';
  const chipLabel = categoryLabel(tx, category);
  const isSystemRow = tx.type === 'ADJUSTMENT' || tx.type === 'DEBT_REPAYMENT' || !category || isSystemMovementCategory(category);
  const note = hasOwnDescription(tx) ? tx.description.trim() : null;
  const formula = tx.rawInput && tx.rawInput.trim() !== String(tx.amount) ? tx.rawInput.trim() : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">{txTypeMetaFor(tx.type, tx.amount).label}</span>
        <TxAmount amount={tx.amount} type={tx.type} className="text-2xl" />
        <span className="text-sm font-semibold text-expense">Deleted</span>
      </div>

      <dl className="flex flex-col">
        {tx.type === 'TRANSFER' ? (
          <>
            <Field label="From">{walletName(tx.walletId)}</Field>
            <Field label="To">{walletName(tx.destinationWalletId)}</Field>
          </>
        ) : (
          <Field label="Wallet">{walletName(tx.walletId)}</Field>
        )}
        {chipLabel && (
          <Field label="Category">
            <Chip label={chipLabel} color={isSystemRow ? SYSTEM_CATEGORY_COLOR : (category?.color ?? SYSTEM_CATEGORY_COLOR)} />
          </Field>
        )}
        <Field label="Date">{formatLongDate(tx.transactionDate.slice(0, 10))}</Field>
        <Field label="Note">{note ?? <span className="text-fg-muted">No note</span>}</Field>
        {formula && <Field label="Typed as">{formula}</Field>}
      </dl>

      {error && (
        <p role="alert" className={ERROR_BANNER_CLASS}>
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button id={`tx-restore-btn-${tx.id}`} variant="soft" block disabled={isWorking} onClick={() => run(onRestore, 'Could not restore this transaction.')}>
          Restore
        </Button>
        <p className="text-xs text-fg-muted">Restore it to edit it. Restoring puts its effect back on the wallet.</p>
      </div>
    </div>
  );
};
