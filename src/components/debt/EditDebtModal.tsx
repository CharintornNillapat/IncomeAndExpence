import React, { useState } from 'react';
import { Debt, DebtEdit } from '../../types';
import type { MutationResult } from '../../context/FinanceContext';
import { useSubmitHandler } from '../../hooks/useSubmitHandler';
import { APP_CURRENCY_SYMBOL } from '../../utils/currency';
import { ERROR_BANNER_CLASS, LABEL_CLASS, inputClass } from '../../utils/formStyles';
import { Modal } from '../Modal';
import { Button } from '../ui/Button';
import { Money } from '../ui/Money';

interface EditDebtModalProps {
  /** The debt being edited; `null` closes the modal. */
  debt: Debt | null;
  onClose: () => void;
  onSave: (id: string, details: DebtEdit) => Promise<MutationResult>;
}

/** A blank optional field clears it. */
function optionalNumber(text: string): number | undefined {
  if (text.trim() === '') return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : NaN;
}

const EditDebtForm: React.FC<{ debt: Debt; onClose: () => void; onSave: EditDebtModalProps['onSave'] }> = ({ debt, onClose, onSave }) => {
  const [name, setName] = useState(debt.name);
  const [total, setTotal] = useState(String(debt.totalAmount));
  const [interest, setInterest] = useState(debt.interestRate ? String(debt.interestRate) : '');
  const [minimum, setMinimum] = useState(debt.minimumPayment ? String(debt.minimumPayment) : '');
  const [dueDate, setDueDate] = useState(debt.dueDate ?? '');

  const { error, isSubmitting, handleSubmit } = useSubmitHandler({
    defaultErrorMessage: 'Failed to update debt',
    onSuccess: onClose,
  });

  const remaining = debt.isSettled ? 0 : debt.remainingAmount;

  return (
    <form
      id="edit-debt-form"
      className="space-y-4"
      onSubmit={(e) =>
        handleSubmit(e, () =>
          onSave(debt.id, {
            name: name.trim(),
            totalAmount: Number(total),
            interestRate: optionalNumber(interest),
            minimumPayment: optionalNumber(minimum),
            dueDate: dueDate || undefined,
          })
        )
      }
    >
      <div>
        <label htmlFor="edit-debt-name" className={LABEL_CLASS}>
          Debt title
        </label>
        <input id="edit-debt-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass('subtle')} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label htmlFor="edit-debt-total" className={LABEL_CLASS}>
            Borrowed ({APP_CURRENCY_SYMBOL})
          </label>
          <input
            id="edit-debt-total"
            type="number"
            step="0.01"
            min="0"
            required
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            aria-describedby="edit-debt-owed"
            className={inputClass('subtle')}
          />
        </div>
        <div>
          <span className={LABEL_CLASS}>Still owed</span>
          <p id="edit-debt-owed" className="min-h-[44px] flex items-center text-sm font-semibold text-expense">
            <span className="sr-only">Still owed: </span>
            <Money value={remaining} />
          </p>
        </div>
      </div>

      <p className="text-xs text-fg-muted">
        What is still owed changes only through repayments. Borrowed can't go below it.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label htmlFor="edit-debt-interest" className={LABEL_CLASS}>
            Interest rate (% APR)
          </label>
          <input
            id="edit-debt-interest"
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            placeholder="0"
            className={inputClass('subtle')}
          />
        </div>
        <div>
          <label htmlFor="edit-debt-min-payment" className={LABEL_CLASS}>
            Min monthly ({APP_CURRENCY_SYMBOL})
          </label>
          <input
            id="edit-debt-min-payment"
            type="number"
            step="1"
            min="0"
            value={minimum}
            onChange={(e) => setMinimum(e.target.value)}
            placeholder="0"
            className={inputClass('subtle')}
          />
        </div>
      </div>

      <div>
        <label htmlFor="edit-debt-due-date" className={LABEL_CLASS}>
          Target payoff date
        </label>
        <input id="edit-debt-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass('subtle')} />
      </div>

      <div className="pt-2 space-y-3">
        {error && (
          <div id="edit-debt-error" role="alert" className={ERROR_BANNER_CLASS}>
            {error}
          </div>
        )}
        <Button id="save-edit-debt-btn" type="submit" size="lg" block disabled={isSubmitting}>
          Save changes
        </Button>
      </div>
    </form>
  );
};

/**
 * Phase 60 (ADR 0035): a debt's Edit, from its ⋯ menu. Name, borrowed total,
 * interest, minimum payment and due date; what is still owed is shown, never
 * offered. A rejected save keeps the form open with the reason.
 */
export const EditDebtModal: React.FC<EditDebtModalProps> = ({ debt, onClose, onSave }) => (
  <Modal isOpen={!!debt} onClose={onClose} title="Edit debt" bodyClassName="space-y-4 sm:space-y-5">
    {debt && <EditDebtForm key={debt.id} debt={debt} onClose={onClose} onSave={onSave} />}
  </Modal>
);
