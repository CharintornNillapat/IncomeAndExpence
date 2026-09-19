import React, { useCallback, useMemo } from 'react';
import { TransactionForm } from './TransactionForm';
import { Modal } from './Modal';
import { useFinanceState, useFinanceActions } from '../context/FinanceContext';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
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
export const QuickAddModal: React.FC<QuickAddModalProps> = ({ isOpen, onClose }) => {
  const { wallets, categories } = useFinanceState();
  const { addTransaction } = useFinanceActions();

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Record Transaction"
      subtitle="Add an expense, income, or wallet transfer instantly"
      titleId="quick-record-modal-title"
      closeButtonId="close-quick-record-modal-btn"
      maxWidthClassName="max-w-xl"
    >
      <TransactionForm
        wallets={activeWallets}
        categories={activeCategories}
        onSubmitTransaction={handleSubmitTransaction}
      />
    </Modal>
  );
};
