import React, { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { TransactionForm } from './TransactionForm';
import { useFinanceState } from '../context/FinanceContext';

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
  const { wallets, categories, addTransaction } = useFinanceState();

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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-stone-900/60 dark:bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-record-modal-title"
            initial={{ y: 40, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl rounded-t-3xl sm:rounded-2xl max-w-xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-stone-200/80 dark:border-stone-800"
          >
            {/* Mobile Sheet Handle */}
            <div className="sm:hidden pt-3 pb-1 flex justify-center cursor-pointer" onClick={onClose}>
              <div className="w-12 h-1.5 rounded-full bg-stone-300 dark:bg-stone-700" />
            </div>

            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-100/80 dark:border-stone-800 flex items-center justify-between">
              <div>
                <h3 id="quick-record-modal-title" className="text-base sm:text-lg font-bold text-stone-900 dark:text-white">
                  Quick Record Transaction
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 hidden sm:block">
                  Add an expense, income, or wallet transfer instantly
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                id="close-quick-record-modal-btn"
                onClick={onClose}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(92vh-70px)] sm:max-h-[calc(90vh-80px)] overscroll-contain">
              <TransactionForm
                wallets={activeWallets}
                categories={activeCategories}
                onSubmitTransaction={handleSubmitTransaction}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
