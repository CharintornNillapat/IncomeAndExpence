import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  ArrowLeftRight, 
  Trash2, 
  X,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { APP_CURRENCY, APP_CURRENCY_SYMBOL } from '../utils/currency';
import { getWalletIcon } from '../utils/walletIcons';
import { AddWalletForm } from '../components/wallet/AddWalletForm';
import { WalletTransferForm } from '../components/wallet/WalletTransferForm';

export const WalletsView: React.FC = () => {
  const { wallets, deleteWallet } = useFinance();

  const [isAddWalletOpen, setIsAddWalletOpen] = useState<boolean>(false);
  const [isTransferOpen, setIsTransferOpen] = useState<boolean>(false);

  const activeWallets = useMemo(() => wallets.filter((w) => !w.isDeleted), [wallets]);

  return (
    <div className="space-y-6">
      {/* Header & Net Worth Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-stone-900 dark:text-white">Wallets & Accounts</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Manage your accounts, balances, and transfers
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            id="wallet-transfer-modal-btn"
            type="button"
            onClick={() => setIsTransferOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-semibold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Transfer</span>
          </button>

          <button
            id="wallet-add-modal-btn"
            type="button"
            onClick={() => setIsAddWalletOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-semibold text-white dark:text-stone-900 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            <span>Add Wallet</span>
          </button>
        </div>
      </div>

      {/* Wallets Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {activeWallets.map((wallet) => {
          const Icon = getWalletIcon(wallet.type);
          return (
            <motion.div
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              key={wallet.id}
              id={`wallet-entity-${wallet.id}`}
              className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs hover:border-stone-300 dark:hover:border-stone-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs"
                      style={{ backgroundColor: wallet.color }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white">{wallet.name}</h3>
                      <span className="text-[11px] font-medium text-stone-400 dark:text-stone-500 capitalize">
                        {wallet.type.replace('_', ' ').toLowerCase()}
                      </span>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    id={`delete-wallet-${wallet.id}`}
                    type="button"
                    onClick={() => deleteWallet(wallet.id)}
                    title="Delete wallet"
                    className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>

                <div className="mt-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 block">
                    Current Balance
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <div className="text-2xl font-bold font-mono text-stone-900 dark:text-white">
                      <AnimatedCounter
                        value={wallet.balance}
                        currencyPrefix={APP_CURRENCY_SYMBOL}
                        duration={0.8}
                      />
                    </div>
                    <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 font-mono">{APP_CURRENCY}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-500">
                <span>Created: {wallet.createdAt.slice(0, 10)}</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active Source
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Add Wallet Modal / Responsive Mobile Bottom Sheet */}
      <AnimatePresence>
        {isAddWalletOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsAddWalletOpen(false);
            }}
          >
            <motion.div 
              initial={{ y: 40, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 40, scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200/80 dark:border-stone-800 p-4 sm:p-6 space-y-4 sm:space-y-5 overscroll-contain"
            >
              {/* Mobile Drag Indicator */}
              <div className="sm:hidden -mt-1 pb-1 flex justify-center cursor-pointer" onClick={() => setIsAddWalletOpen(false)}>
                <div className="w-12 h-1.5 rounded-full bg-stone-300 dark:bg-stone-700" />
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-stone-100/80 dark:border-stone-800">
                <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white">Add Wallet</h3>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setIsAddWalletOpen(false)}
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              <AddWalletForm
                tone="subtle"
                ids={{
                  name: 'new-wallet-name',
                  type: 'new-wallet-type',
                  currency: 'new-wallet-currency',
                  balance: 'new-wallet-init-balance',
                  submit: 'save-new-wallet-btn',
                }}
                onCreated={() => setIsAddWalletOpen(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Funds Modal / Responsive Mobile Bottom Sheet */}
      <AnimatePresence>
        {isTransferOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsTransferOpen(false);
            }}
          >
            <motion.div 
              initial={{ y: 40, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 40, scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200/80 dark:border-stone-800 p-4 sm:p-6 space-y-4 sm:space-y-5 overscroll-contain"
            >
              {/* Mobile Drag Indicator */}
              <div className="sm:hidden -mt-1 pb-1 flex justify-center cursor-pointer" onClick={() => setIsTransferOpen(false)}>
                <div className="w-12 h-1.5 rounded-full bg-stone-300 dark:bg-stone-700" />
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-stone-100/80 dark:border-stone-800">
                <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white">Transfer Funds</h3>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setIsTransferOpen(false)}
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              <WalletTransferForm
                wallets={activeWallets}
                tone="subtle"
                ids={{
                  source: 'transfer-source-wallet',
                  dest: 'transfer-dest-wallet',
                  amount: 'transfer-amount-math',
                  note: 'transfer-note',
                  submit: 'execute-transfer-btn',
                }}
                onTransferred={() => setIsTransferOpen(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
