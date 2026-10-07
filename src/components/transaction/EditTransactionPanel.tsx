import React, { useMemo, useState } from 'react';
import type { Category, Debt, Transaction, TransactionEdit, TransactionType, Wallet } from '../../types';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { TxAmount } from './TxCells';
import { txTypeMetaFor } from './txTypeMeta';
import { systemCategoryLabel } from '../../selectors/display';
import { safeEvaluateMath } from '../../utils/mathEvaluator';
import { APP_CURRENCY_SYMBOL, formatCurrencyAmount } from '../../utils/currency';
import { MAX_AMOUNT, MAX_AMOUNT_ERROR, roundToCents } from '../../utils/money';
import { ERROR_BANNER_CLASS, LABEL_TEXT_CLASS, OPTION_CLASS, inputClass, selectClass } from '../../utils/formStyles';

interface WriteResult {
  success: boolean;
  error?: string;
}

type EditableType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

const TYPE_OPTIONS: { value: EditableType; label: string }[] = [
  { value: 'INCOME', label: 'Income' },
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'TRANSFER', label: 'Transfer' },
];

const EDITABLE_TYPES: ReadonlySet<TransactionType> = new Set(['INCOME', 'EXPENSE', 'TRANSFER']);

/** What `transfer_funds` writes for a transfer sent with no note - the placeholder says the same. */
const TRANSFER_PLACEHOLDER = 'Transfer between wallets';

/** A typed amount with only digits and one decimal point is a plain number, not a formula worth keeping. */
const PLAIN_NUMBER = /^\d+(\.\d+)?$/;

interface EditTransactionPanelProps {
  tx: Transaction;
  /** Every wallet, deleted ones included; the selects offer the live ones plus the row's own. */
  wallets: Wallet[];
  /** Every category; the select offers the live ones plus the row's own. */
  categories: Category[];
  /** The debt a repayment paid, named read-only since its money cannot change. */
  debt?: Debt;
  onSave: (id: string, edit: TransactionEdit) => Promise<WriteResult>;
  onDelete: (id: string) => Promise<WriteResult>;
}

interface Draft {
  type: TransactionType;
  amountText: string;
  description: string;
  categoryId: string;
  walletId: string;
  destinationWalletId: string;
  date: string;
}

function draftOf(tx: Transaction): Draft {
  return {
    type: tx.type,
    amountText: String(tx.amount),
    description: tx.description,
    categoryId: tx.categoryId ?? '',
    walletId: tx.walletId,
    destinationWalletId: tx.destinationWalletId ?? '',
    date: tx.transactionDate.slice(0, 10),
  };
}

/**
 * Spec 6.2's edit panel (Phase 58b, ADR 0033), inside the selected row's
 * drawer. Income, expense and transfer edit everything the spec lists; a debt
 * repayment or an adjustment shows its money as text and edits only its note
 * and date, the same rule `update_transaction` enforces.
 *
 * The amount is a plain field that also takes a formula (`100+50`), evaluated
 * with the same `safeEvaluateMath` as the add form, so it can be 24px and
 * coloured by type as the spec asks. A formula becomes the row's `rawInput`; a
 * plain number clears it, and an untouched amount keeps whatever the row had.
 */
export const EditTransactionPanel: React.FC<EditTransactionPanelProps> = ({ tx, wallets, categories, debt, onSave, onDelete }) => {
  const [draft, setDraft] = useState<Draft>(() => draftOf(tx));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  /*
   * A saved row (or one reloaded from the cloud) is the new baseline (ADR 0056).
   * Reset during render, when the row's version changes, not in an effect: an
   * effect runs after its render, so a keystroke landing in between was
   * replaced by the stale reset. `tx` itself changes identity on unrelated
   * writes; its version is what matters. A different row is a different
   * instance (`TransactionDetails` keys the panel by id), so it starts clean.
   */
  const [baseVersion, setBaseVersion] = useState(tx.updatedAt);
  if (tx.updatedAt !== baseVersion) {
    setBaseVersion(tx.updatedAt);
    setDraft(draftOf(tx));
  }

  const moneyEditable = EDITABLE_TYPES.has(tx.type);
  const isTransfer = draft.type === 'TRANSFER';

  const walletOptions = useMemo(
    () => wallets.filter((w) => !w.isDeleted || w.id === tx.walletId || w.id === tx.destinationWalletId),
    [wallets, tx.walletId, tx.destinationWalletId]
  );
  /*
   * The draft type's own live categories (ADR 0085, audit finding 3), plus
   * the row's own category while its type is unchanged, so a row filed before
   * the filter (an expense under Balance Adjustment) still shows and keeps
   * what it holds when only its note is edited.
   */
  const categoryOptions = useMemo(
    () =>
      categories.filter(
        (c) => (!c.isDeleted && c.type === draft.type) || (c.id === tx.categoryId && draft.type === tx.type)
      ),
    [categories, draft.type, tx.categoryId, tx.type]
  );

  const amountTouched = draft.amountText.trim() !== String(tx.amount);
  const evaluated = useMemo(() => safeEvaluateMath(draft.amountText), [draft.amountText]);
  const amount = moneyEditable ? (evaluated.isValid ? evaluated.value : null) : tx.amount;
  const isFormula = !PLAIN_NUMBER.test(draft.amountText.trim());

  const problem: string | null = (() => {
    if (moneyEditable) {
      if (amount === null || !(amount > 0)) return 'Enter an amount greater than zero';
      // The save's own cap (ADR 0086): Save stays off instead of failing.
      if (amount > MAX_AMOUNT) return MAX_AMOUNT_ERROR;
      if (isTransfer && (!draft.destinationWalletId || draft.destinationWalletId === draft.walletId)) {
        return 'Choose two different wallets';
      }
    }
    if (!draft.description.trim()) return 'Add a note';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return 'Choose a date';
    return null;
  })();

  const edit: TransactionEdit = {
    type: draft.type,
    // Whole cents, as the ledger will store it, so "100.001" is not a change.
    amount: amount === null ? tx.amount : roundToCents(amount),
    rawInput: moneyEditable && amountTouched ? (isFormula ? draft.amountText.trim() : undefined) : tx.rawInput,
    walletId: draft.walletId,
    destinationWalletId: isTransfer ? draft.destinationWalletId || undefined : undefined,
    categoryId: isTransfer ? undefined : draft.categoryId || undefined,
    description: draft.description.trim(),
    transactionDate: draft.date,
  };

  const hasChanges =
    edit.type !== tx.type ||
    edit.amount !== tx.amount ||
    (edit.rawInput ?? null) !== (tx.rawInput ?? null) ||
    edit.walletId !== tx.walletId ||
    (edit.destinationWalletId ?? null) !== (tx.destinationWalletId ?? null) ||
    (edit.categoryId ?? null) !== (tx.categoryId ?? null) ||
    // The note as typed: a stray space an old row carries is not an edit.
    draft.description !== tx.description ||
    edit.transactionDate !== tx.transactionDate.slice(0, 10);

  const update = (changes: Partial<Draft>) => {
    setStatus(null);
    // A refused save's message described the draft that was sent (ADR 0086).
    setError(null);
    setDraft((previous) => ({ ...previous, ...changes }));
  };

  const changeType = (type: EditableType) => {
    if (type === 'TRANSFER') {
      // A transfer has no category, and needs a second wallet.
      const to =
        draft.destinationWalletId && draft.destinationWalletId !== draft.walletId
          ? draft.destinationWalletId
          : walletOptions.find((w) => !w.isDeleted && w.id !== draft.walletId)?.id ?? '';
      update({ type, categoryId: '', destinationWalletId: to });
    } else {
      // A category of the old type goes; back on the row's own type, its own
      // category returns (ADR 0085).
      const keeps = categories.find((c) => c.id === draft.categoryId)?.type === type;
      const categoryId = keeps ? draft.categoryId : type === tx.type ? tx.categoryId ?? '' : '';
      update({ type, categoryId, destinationWalletId: '' });
    }
  };

  const run = async (action: () => Promise<WriteResult>, fallback: string, done?: string) => {
    setIsWorking(true);
    setError(null);
    setStatus(null);
    try {
      const result = await action();
      if (!result.success) setError(result.error || fallback);
      else if (done) setStatus(done);
    } finally {
      setIsWorking(false);
    }
  };

  const walletLabel = (w: Wallet) => (w.isDeleted ? `${w.name} (deleted)` : w.name);
  const walletSelect = (id: string, label: string, value: string, onChange: (value: string) => void) => (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className={LABEL_TEXT_CLASS}>{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass('plain')}>
        {/* Only when nothing is chosen, so the field never shows a wallet the draft does not hold. */}
        {value === '' && (
          <option value="" className={OPTION_CLASS}>
            Choose a wallet
          </option>
        )}
        {walletOptions.map((w) => (
          <option key={w.id} value={w.id} className={OPTION_CLASS}>
            {walletLabel(w)}
          </option>
        ))}
      </select>
    </label>
  );

  const meta = txTypeMetaFor(draft.type, amount ?? tx.amount);
  const lockedWallet = wallets.find((w) => w.id === tx.walletId);
  const lockedWalletName = lockedWallet ? walletLabel(lockedWallet) : 'Unknown wallet';

  return (
    <div className="flex flex-col gap-4 @container">
      {moneyEditable ? (
        <>
          <SegmentedControl<EditableType>
            fill
            className="flex"
            ariaLabel="Transaction type"
            value={draft.type as EditableType}
            onChange={changeType}
            options={TYPE_OPTIONS.map((option) => ({ ...option, id: `tx-edit-type-${option.value.toLowerCase()}` }))}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="tx-edit-amount" className={LABEL_TEXT_CLASS}>
              Amount
            </label>
            <div className="flex items-center gap-2 min-h-[44px] rounded-lg border border-line-input bg-surface-2 px-3.5 focus-within:ring-2 focus-within:ring-focus">
              <span aria-hidden="true" className={`text-2xl font-semibold ${meta.text}`}>
                {APP_CURRENCY_SYMBOL}
              </span>
              <input
                id="tx-edit-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={draft.amountText}
                onChange={(e) => update({ amountText: e.target.value })}
                aria-describedby="tx-edit-amount-hint"
                className={`w-full min-w-0 py-1.5 bg-transparent text-2xl font-semibold ${meta.text} focus:outline-none`}
              />
            </div>
            <span id="tx-edit-amount-hint" className="text-xs text-fg-muted min-h-4">
              {evaluated.isValid && isFormula && amount !== null ? `= ${formatCurrencyAmount(amount)}` : 'You can type a sum, like 100+50'}
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">{meta.label}</span>
          <TxAmount amount={tx.amount} type={tx.type} className="text-2xl" />
          <dl className="flex flex-col gap-1 mt-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted shrink-0">Wallet</dt>
              <dd className="text-fg text-right min-w-0 break-words">{lockedWalletName}</dd>
            </div>
            {tx.type === 'DEBT_REPAYMENT' && (
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted shrink-0">Debt</dt>
                <dd className="text-fg text-right min-w-0 break-words">{debt?.name ?? 'Unknown debt'}</dd>
              </div>
            )}
          </dl>
          <span className="text-xs text-fg-muted mt-1">Only the note and date of a {tx.type === 'ADJUSTMENT' ? 'balance adjustment' : 'debt repayment'} can change.</span>
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className={LABEL_TEXT_CLASS}>Note</span>
        <input
          id="tx-edit-description"
          type="text"
          maxLength={255}
          value={draft.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder={isTransfer ? TRANSFER_PLACEHOLDER : 'What was it for?'}
          className={inputClass('plain')}
        />
      </label>

      {moneyEditable && (
        <div className="grid grid-cols-1 @xs:grid-cols-2 gap-3">
          {isTransfer ? (
            <>
              {walletSelect('tx-edit-from', 'From', draft.walletId, (walletId) => update({ walletId }))}
              {walletSelect('tx-edit-to', 'To', draft.destinationWalletId, (destinationWalletId) => update({ destinationWalletId }))}
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className={LABEL_TEXT_CLASS}>Category</span>
                <select
                  id="tx-edit-category"
                  value={draft.categoryId}
                  onChange={(e) => update({ categoryId: e.target.value })}
                  className={selectClass('plain')}
                >
                  <option value="" className={OPTION_CLASS}>
                    No category
                  </option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id} className={OPTION_CLASS}>
                      {systemCategoryLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
              {walletSelect('tx-edit-wallet', 'Wallet', draft.walletId, (walletId) => update({ walletId }))}
            </>
          )}
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className={LABEL_TEXT_CLASS}>Date</span>
        <input
          id="tx-edit-date"
          type="date"
          value={draft.date}
          onChange={(e) => update({ date: e.target.value })}
          className={inputClass('plain')}
        />
      </label>

      {error && (
        <p role="alert" className={ERROR_BANNER_CLASS}>
          {error}
        </p>
      )}
      <p role="status" className="text-xs text-fg-secondary min-h-4 -my-2">
        {status ?? (hasChanges && problem ? problem : '')}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Button
          id={`tx-save-btn-${tx.id}`}
          variant="primary"
          block
          disabled={isWorking || !hasChanges || problem !== null}
          onClick={() => run(() => onSave(tx.id, edit), 'Could not save this transaction.', 'Changes saved')}
        >
          Save changes
        </Button>
        <Button
          id={`tx-delete-btn-${tx.id}`}
          variant="danger"
          block
          disabled={isWorking}
          onClick={() => run(() => onDelete(tx.id), 'Could not delete this transaction.')}
        >
          Delete
        </Button>
      </div>
      <p className="text-xs text-fg-muted">A deleted transaction can be restored from Show deleted. Deleting reverses its effect on the wallet.</p>
    </div>
  );
};
