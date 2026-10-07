import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Plus, Landmark } from 'lucide-react';
import { useDebts } from '../hooks/useDebts';
import { useSubmitHandler } from '../hooks/useSubmitHandler';
import { useFinanceState, useFinanceActions } from '../context/FinanceContext';
import { APP_CURRENCY_SYMBOL, formatCurrencyAmount } from '../utils/currency';
import { todayIsoDate } from '../utils/date';
import { buildLookupMap } from '../utils/mapUtils';
import { debtPlan, monthlySurplus, DebtPlanItem } from '../selectors/debts';
import { Debt } from '../types';
import { DebtCard } from '../components/debt/DebtCard';
import { DebtSummaryCard } from '../components/debt/DebtSummaryCard';
import { EditDebtModal } from '../components/debt/EditDebtModal';
import { TransactionForm } from '../components/TransactionForm';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { LABEL_CLASS, inputClass, ERROR_BANNER_CLASS } from '../utils/formStyles';
import { Button } from '../components/ui/Button';

/**
 * Spec 6.4 (Phase 60, ADR 0035): the Debt payoff page. A summary of what is
 * still owed, paid off and needed a month (L4, L5), then the active debts
 * nearest due date first, then the paid-off ones. Every figure comes from
 * `useDebts().metrics` or `src/selectors/` (ADR 0028), computed here once.
 */
export const DebtsView: React.FC = () => {
  const { debts, activeDebts, settledDebts, wallets, metrics, addDebt, editDebt, settleDebt, deleteDebt } = useDebts();
  const { categories, transactions } = useFinanceState();
  const { addTransaction } = useFinanceActions();

  const today = todayIsoDate();
  const categoryMap = useMemo(() => buildLookupMap(categories), [categories]);
  // L4 and L5: the surplus is the past 30 days, as on the Dashboard.
  const plan = useMemo(
    () => debtPlan(debts, today, monthlySurplus(transactions, today, categoryMap)),
    [debts, today, transactions, categoryMap]
  );
  const planItems = useMemo(() => new Map<string, DebtPlanItem>(plan.items.map((item) => [item.debt.id, item])), [plan]);

  const [isAddDebtOpen, setIsAddDebtOpen] = useState<boolean>(false);
  const [repayDebtTarget, setRepayDebtTarget] = useState<Debt | null>(null);
  // The dialogs store ids, resolved at render, so the card callbacks below
  // never close over `debts` and keep `DebtCard`'s `React.memo` (T73).
  const [editDebtId, setEditDebtId] = useState<string | null>(null);
  const [debtToDeleteId, setDebtToDeleteId] = useState<string | null>(null);
  const [isDeletingDebt, setIsDeletingDebt] = useState<boolean>(false);
  const [deleteDebtError, setDeleteDebtError] = useState<string | null>(null);
  const [debtToSettleId, setDebtToSettleId] = useState<string | null>(null);
  const [isSettlingDebt, setIsSettlingDebt] = useState<boolean>(false);
  const [settleDebtError, setSettleDebtError] = useState<string | null>(null);

  // New Debt Form State. Every figure starts empty, with an example in its
  // placeholder (ADR 0086, audit finding 12): the form used to open on
  // ฿5,000, 4.5%, ฿200 and 2026-12-31, so a name and Save added a debt
  // nobody owed, with a due date that ages into overdue.
  const [debtName, setDebtName] = useState<string>('');
  const [totalText, setTotalText] = useState<string>('');
  const [remainingText, setRemainingText] = useState<string>('');
  const [interestText, setInterestText] = useState<string>('');
  const [minimumText, setMinimumText] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');

  const findDebt = (id: string | null) => (id ? debts.find((d) => d.id === id) ?? null : null);
  const debtToDelete = findDebt(debtToDeleteId);
  const debtToSettle = findDebt(debtToSettleId);
  const debtToEdit = findDebt(editDebtId);

  // `Modal` gives focus back to the control that opened it, but Mark as paid
  // off, a settling repayment and Delete each remove that control. Focus then
  // goes to the debt's ⋯ menu, which a paid-off card keeps, or to Add debt.
  const focusAfterCloseRef = useRef<string | null>(null);
  useEffect(() => {
    const id = focusAfterCloseRef.current;
    if (!id || debtToSettleId || debtToDeleteId || repayDebtTarget) return;
    focusAfterCloseRef.current = null;
    document.getElementById(id)?.focus({ preventScroll: true });
  }, [debtToSettleId, debtToDeleteId, repayDebtTarget, debts]);

  const handleSettle = useCallback((id: string) => {
    setSettleDebtError(null);
    setDebtToSettleId(id);
  }, []);

  const handleCloseSettle = useCallback(() => {
    setDebtToSettleId(null);
    setSettleDebtError(null);
  }, []);

  // A rejected write keeps the dialog open with the reason (MutationResult).
  const handleConfirmSettle = useCallback(async () => {
    if (!debtToSettleId) return;
    setIsSettlingDebt(true);
    setSettleDebtError(null);
    const result = await settleDebt(debtToSettleId);
    setIsSettlingDebt(false);
    if (!result.success) {
      setSettleDebtError(result.error || 'Failed to mark the debt as paid off');
      return;
    }
    focusAfterCloseRef.current = `debt-menu-btn-${debtToSettleId}`;
    setDebtToSettleId(null);
  }, [debtToSettleId, settleDebt]);

  const handleEdit = useCallback((id: string) => setEditDebtId(id), []);
  const handleCloseEdit = useCallback(() => setEditDebtId(null), []);

  const handleDelete = useCallback((id: string) => {
    setDeleteDebtError(null);
    setDebtToDeleteId(id);
  }, []);

  const handleCloseDeleteDebt = useCallback(() => {
    setDebtToDeleteId(null);
    setDeleteDebtError(null);
  }, []);

  const handleConfirmDeleteDebt = useCallback(async () => {
    if (!debtToDeleteId) return;
    setIsDeletingDebt(true);
    setDeleteDebtError(null);
    const result = await deleteDebt(debtToDeleteId);
    setIsDeletingDebt(false);
    if (!result.success) {
      setDeleteDebtError(result.error || 'Failed to delete debt');
      return;
    }
    focusAfterCloseRef.current = 'open-add-debt-btn';
    setDebtToDeleteId(null);
  }, [debtToDeleteId, deleteDebt]);

  const handleOpenRepay = useCallback((debt: Debt) => {
    setRepayDebtTarget(debt);
  }, []);

  // Keeps the form open so a rejected debt goal can be corrected.
  const { error: createDebtError, handleSubmit: submitCreateDebt } = useSubmitHandler({
    defaultErrorMessage: 'Failed to create debt goal',
    onSuccess: () => {
      setIsAddDebtOpen(false);
      setDebtName('');
      setTotalText('');
      setRemainingText('');
      setInterestText('');
      setMinimumText('');
      setDueDate('');
    },
  });

  // A blank optional field is absent; a blank total is 0, which `DebtSchema` refuses.
  const optionalNumber = (text: string) => (text.trim() === '' ? undefined : Number(text));
  const handleCreateDebt = (e: React.FormEvent) => {
    const totalAmount = Number(totalText) || 0;
    const remaining = Number(remainingText) || 0;
    return submitCreateDebt(e, () =>
      addDebt({
        name: debtName.trim(),
        totalAmount,
        // Blank (or 0) owes the whole total, as before.
        remainingAmount: remaining > 0 ? remaining : totalAmount,
        interestRate: optionalNumber(interestText),
        minimumPayment: optionalNumber(minimumText),
        dueDate: dueDate || undefined,
      })
    );
  };

  // T38: routes through the same generic addTransaction path every other
  // TransactionForm consumer uses. addTransaction itself decrements the
  // target debt's remainingAmount (and auto-settles it at zero) whenever type
  // is DEBT_REPAYMENT and a debtId is present.
  const handleRepaySubmit = useCallback(
    async (data: Parameters<React.ComponentProps<typeof TransactionForm>['onSubmitTransaction']>[0]) => {
      const res = await addTransaction({
        ...data,
        transactionDate: data.date,
      });
      if (res && res.success) {
        // A payment of the whole remainder settles the debt, which takes its
        // Make repayment button away.
        if (repayDebtTarget && data.amount >= repayDebtTarget.remainingAmount) {
          focusAfterCloseRef.current = `debt-menu-btn-${repayDebtTarget.id}`;
        }
        setRepayDebtTarget(null);
      }
      return res;
    },
    [addTransaction, repayDebtTarget]
  );

  const activeCount = activeDebts.length;
  const renderCard = (debt: Debt) => (
    <DebtCard
      key={debt.id}
      debt={debt}
      planItem={planItems.get(debt.id)}
      onOpenRepay={handleOpenRepay}
      onSettle={handleSettle}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Debt payoff"
        description={
          activeCount === 0
            ? 'No active debts'
            : `${activeCount} active ${activeCount === 1 ? 'debt' : 'debts'} · sorted by due date`
        }
        actions={
          <Button id="open-add-debt-btn" onClick={() => setIsAddDebtOpen(true)} icon={<Plus aria-hidden="true" className="w-4 h-4" />}>
            Add debt
          </Button>
        }
      />

      {debts.length === 0 ? (
        <Card>
          <EmptyState
            icon={Landmark}
            title="No debts tracked yet"
            subtitle="Add a payoff goal to start tracking repayment progress against a wallet"
          />
        </Card>
      ) : (
        <>
          <DebtSummaryCard
            remaining={metrics.remainingTarget}
            total={metrics.totalTarget}
            paid={metrics.paidTarget}
            progressPercent={metrics.progressPercent}
            plan={plan}
          />

          {activeCount === 0 ? (
            <p className="text-sm text-fg-muted">Every debt is paid off.</p>
          ) : (
            <section aria-label="Active debts" className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {activeDebts.map(renderCard)}
            </section>
          )}

          {settledDebts.length > 0 && (
            <section aria-labelledby="debts-paid-off-heading" className="space-y-4">
              <h2 id="debts-paid-off-heading" className="text-base font-semibold text-fg">
                Paid off ({settledDebts.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{settledDebts.map(renderCard)}</div>
            </section>
          )}

          <p id="debts-caption" className="text-xs text-fg-muted">
            Debt repayments move money out of a wallet but aren't counted as spending.
          </p>
        </>
      )}

      {/* Add Debt Modal / Responsive Mobile Bottom Sheet */}
      <Modal
        isOpen={isAddDebtOpen}
        onClose={() => setIsAddDebtOpen(false)}
        title="Add debt"
        bodyClassName="space-y-4 sm:space-y-5"
      >
        <form onSubmit={handleCreateDebt} className="space-y-4">
          <div>
            <label htmlFor="new-debt-name" className={LABEL_CLASS}>
              Debt title *
            </label>
            <input
              id="new-debt-name"
              type="text"
              required
              value={debtName}
              onChange={(e) => setDebtName(e.target.value)}
              placeholder="e.g. Student Loan, Car Loan"
              className={inputClass('subtle')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label htmlFor="new-debt-total" className={LABEL_CLASS}>
                Total amount ({APP_CURRENCY_SYMBOL}) *
              </label>
              <input
                id="new-debt-total"
                type="number"
                step="0.01"
                min="1"
                required
                value={totalText}
                placeholder="e.g. 120000"
                onChange={(e) => {
                  setTotalText(e.target.value);
                  setRemainingText(e.target.value);
                }}
                className={inputClass('subtle')}
              />
            </div>

            <div>
              <label htmlFor="new-debt-remaining" className={LABEL_CLASS}>
                Remaining ({APP_CURRENCY_SYMBOL})
              </label>
              <input
                id="new-debt-remaining"
                type="number"
                step="0.01"
                min="0"
                value={remainingText}
                placeholder="e.g. 80000"
                onChange={(e) => setRemainingText(e.target.value)}
                className={inputClass('subtle')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label htmlFor="new-debt-interest" className={LABEL_CLASS}>
                Interest rate (% APR)
              </label>
              <input
                id="new-debt-interest"
                type="number"
                step="0.1"
                min="0"
                value={interestText}
                placeholder="e.g. 4.5"
                onChange={(e) => setInterestText(e.target.value)}
                className={inputClass('subtle')}
              />
            </div>

            <div>
              <label htmlFor="new-debt-min-payment" className={LABEL_CLASS}>
                Min monthly ({APP_CURRENCY_SYMBOL})
              </label>
              <input
                id="new-debt-min-payment"
                type="number"
                step="1"
                min="0"
                value={minimumText}
                placeholder="e.g. 3000"
                onChange={(e) => setMinimumText(e.target.value)}
                className={inputClass('subtle')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="new-debt-due-date" className={LABEL_CLASS}>
              Target payoff date
            </label>
            <input
              id="new-debt-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass('subtle')}
            />
          </div>

          <div className="pt-2">
            {createDebtError && (
              <div className={ERROR_BANNER_CLASS}>
                {createDebtError}
              </div>
            )}

            <Button id="save-new-debt-btn" type="submit" size="lg" block>
              Add debt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Repay Debt Modal / Responsive Mobile Bottom Sheet */}
      <Modal
        isOpen={!!repayDebtTarget}
        onClose={() => setRepayDebtTarget(null)}
        title={repayDebtTarget ? `Repay: ${repayDebtTarget.name}` : 'Repay'}
        subtitle="Deducts directly from your selected wallet"
        bodyClassName="space-y-4 sm:space-y-5"
      >
        {repayDebtTarget && (
          <TransactionForm
            key={repayDebtTarget.id}
            wallets={wallets}
            categories={categories.filter((c) => !c.isDeleted)}
            idPrefix="repay"
            presetType="DEBT_REPAYMENT"
            lockType
            presetDebtId={repayDebtTarget.id}
            onSubmitTransaction={handleRepaySubmit}
          />
        )}
      </Modal>

      <EditDebtModal debt={debtToEdit} onClose={handleCloseEdit} onSave={editDebt} />

      {/* Mark as paid off writes the debt off: no payment, no wallet moves (ADR 0016, 0035). */}
      <ConfirmDialog
        isOpen={!!debtToSettleId}
        onClose={handleCloseSettle}
        onConfirm={handleConfirmSettle}
        isLoading={isSettlingDebt}
        error={settleDebtError}
        isDestructive={false}
        title="Mark as paid off"
        confirmText="Mark as paid off"
        description={
          debtToSettle
            ? `Mark "${debtToSettle.name}" as paid off? This sets what is still owed (${formatCurrencyAmount(debtToSettle.remainingAmount)}) to zero without recording a payment or moving money. To pay from a wallet, use Make repayment.`
            : ''
        }
      />

      {/* Delete Debt Confirmation (T42) */}
      <ConfirmDialog
        isOpen={!!debtToDeleteId}
        onClose={handleCloseDeleteDebt}
        onConfirm={handleConfirmDeleteDebt}
        isLoading={isDeletingDebt}
        error={deleteDebtError}
        title="Delete debt"
        description={
          debtToDelete
            ? `Delete "${debtToDelete.name}"? It leaves your payoff goals. Its repayment transactions stay in your history.`
            : ''
        }
      />
    </div>
  );
};
