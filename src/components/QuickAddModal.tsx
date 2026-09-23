import React, { useCallback, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { TransactionForm } from './TransactionForm';
import { Modal } from './Modal';
import { useFinanceState, useFinanceActions } from '../context/FinanceContext';
import { formatCurrencyAmount } from '../utils/currency';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Forwarded to `TransactionForm`'s shortcut row - closes this modal and opens `TransferFundsModal`. */
  onRequestTransfer?: () => void;
  /** Forwarded to `TransactionForm`'s shortcut row - closes this modal and switches to the Debts tab. */
  onRequestRepayDebt?: () => void;
}

/**
 * Extracted from App.tsx (T1, Phase 2) so this is the only part of the app
 * that subscribes to the finance context for the quick-add flow. Previously
 * `MainApp` itself subscribed for `wallets`/`categories`/
 * `addTransaction` purely to feed this modal, which meant every financial
 * write re-rendered the entire app shell (Navbar, swipe wrapper, active
 * view, MobileBottomNav, AuthModal, ReloadPrompt, footer) regardless of
 * whether the modal was even open.
 */
export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  onRequestTransfer,
  onRequestRepayDebt,
}) => {
  const { wallets, categories, presets } = useFinanceState();
  const { addTransaction, applyPreset, deletePreset } = useFinanceActions();
  const [presetError, setPresetError] = useState<string | null>(null);

  // Memoized so TransactionForm doesn't receive a new array identity on
  // every render of this component (e.g. while it's closed and unmounted
  // from AnimatePresence's perspective, or on unrelated context changes).
  const activeWallets = useMemo(() => wallets.filter((w) => !w.isDeleted), [wallets]);
  const activeCategories = useMemo(() => categories.filter((c) => !c.isDeleted), [categories]);

  const handleSubmitTransaction = useCallback(
    async (data: Parameters<React.ComponentProps<typeof TransactionForm>['onSubmitTransaction']>[0]) => {
      const res = await addTransaction({
        ...data,
        transactionDate: data.date,
      });
      if (res && res.success) {
        onClose();
      }
      return res;
    },
    [addTransaction, onClose]
  );

  // One-tap logging: applies the template as a brand-new transaction dated
  // today instead of prefilling the form below for review - the form's own
  // template chips (inside TransactionForm) cover the "prefill, then tweak
  // before submitting" case.
  const handleApplyPreset = useCallback(
    async (id: string) => {
      setPresetError(null);
      const res = await applyPreset(id);
      if (res.success) {
        onClose();
      } else {
        setPresetError(res.error || 'Failed to apply template');
      }
    },
    [applyPreset, onClose]
  );

  const handleDeletePreset = useCallback(
    async (id: string) => {
      setPresetError(null);
      const res = await deletePreset(id);
      if (!res.success) {
        setPresetError(res.error || 'Failed to delete template');
      }
    },
    [deletePreset]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Record Transaction"
      subtitle="Add an expense or income instantly"
      titleId="quick-record-modal-title"
      closeButtonId="close-quick-record-modal-btn"
      maxWidthClassName="max-w-xl"
    >
      {presets.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          <span className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide">
            Quick templates
          </span>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <span
                key={preset.id}
                id={`quickadd-preset-chip-${preset.id}`}
                className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 text-xs font-medium rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
              >
                <button
                  type="button"
                  id={`quickadd-preset-apply-${preset.id}`}
                  onClick={() => handleApplyPreset(preset.id)}
                  className="cursor-pointer"
                >
                  {preset.name} · {formatCurrencyAmount(preset.amount)}
                </button>
                <button
                  type="button"
                  id={`quickadd-preset-delete-${preset.id}`}
                  onClick={() => handleDeletePreset(preset.id)}
                  aria-label={`Delete ${preset.name} template`}
                  className="p-0.5 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          {presetError && (
            <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">{presetError}</p>
          )}
        </div>
      )}

      <TransactionForm
        wallets={activeWallets}
        categories={activeCategories}
        formTestId="tx-form-quickadd"
        onRequestTransfer={onRequestTransfer}
        onRequestRepayDebt={onRequestRepayDebt}
        onSubmitTransaction={handleSubmitTransaction}
      />
    </Modal>
  );
};
