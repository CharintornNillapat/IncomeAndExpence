import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Plus, 
  ArrowLeftRight, 
  Trash2, 
  Sliders, 
  TrendingUp, 
  TrendingDown, 
  Wallet as WalletIcon,
  Receipt,
  Layers
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { AddWalletForm } from './wallet/AddWalletForm';
import { WalletTransferForm } from './wallet/WalletTransferForm';
import { APP_CURRENCY, APP_CURRENCY_SYMBOL, formatCurrencyAmount } from '../utils/currency';
import { todayIsoDate } from '../utils/date';
import { getWalletIcon } from '../utils/walletIcons';

export type WalletModalTab = 'OVERVIEW' | 'TRANSFER' | 'ADD_WALLET' | 'TRANSACTIONS';

interface WalletPopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: WalletModalTab;
  initialWalletId?: string;
}

export const WalletPopupModal: React.FC<WalletPopupModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'OVERVIEW',
  initialWalletId
}) => {
  const { 
    wallets, 
    transactions, 
    totalNetWorth, 
    deleteWallet, 
    addTransaction 
  } = useFinance();

  const [activeTab, setActiveTab] = useState<WalletModalTab>(initialTab);
  const [selectedWalletId, setSelectedWalletId] = useState<string>(initialWalletId || wallets[0]?.id || '');

  // The overview's "Transfer" shortcuts preselect which wallet the transfer
  // starts from; the form itself owns the rest of the transfer state.
  const [transferSourceId, setTransferSourceId] = useState<string>(initialWalletId || '');
  const [transferStatus, setTransferStatus] = useState<string | null>(null);

  // Edit / Adjust Balance State
  const [isAdjustingBalance, setIsAdjustingBalance] = useState<string | null>(null);
  const [adjustedBalance, setAdjustedBalance] = useState<number>(0);

  const activeWallets = useMemo(() => wallets.filter((w) => !w.isDeleted), [wallets]);

  // Selected Wallet
  const currentWallet = useMemo(() => {
    return activeWallets.find((w) => w.id === selectedWalletId) || activeWallets[0];
  }, [activeWallets, selectedWalletId]);

  // Transactions specific to the selected wallet
  const walletTransactions = useMemo(() => {
    if (!currentWallet) return [];
    return transactions
      .filter((t) => !t.isDeleted && (t.walletId === currentWallet.id || t.destinationWalletId === currentWallet.id))
      .slice(0, 15);
  }, [transactions, currentWallet]);

  /**
   * The modal is rendered unconditionally by its parent and only returns null
   * while closed, so it never unmounts and the useState initialisers above run
   * exactly once. Without this sync it reopens on whichever tab and wallet were
   * last used, ignoring what the caller asked for - which is why the dashboard's
   * "Transfer" and "Add Wallet" shortcuts always landed on the Overview tab.
   */
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    // Only override the wallet when the caller named one; opening the modal
    // generically should keep whatever the user was last looking at.
    if (initialWalletId) {
      setSelectedWalletId(initialWalletId);
      setTransferSourceId(initialWalletId);
    }
  }, [isOpen, initialTab, initialWalletId]);

  if (!isOpen) return null;

  const handleSaveBalanceAdjustment = async (walletId: string) => {
    const target = activeWallets.find(w => w.id === walletId);
    if (!target) return;
    const diff = adjustedBalance - target.balance;
    if (diff === 0) {
      setIsAdjustingBalance(null);
      return;
    }

    await addTransaction({
      amount: Math.abs(diff),
      description: `Manual balance adjustment (${diff >= 0 ? '+' : '-'}${formatCurrencyAmount(Math.abs(diff))})`,
      walletId: target.id,
      type: 'ADJUSTMENT',
      transactionDate: todayIsoDate(),
    });

    setIsAdjustingBalance(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div 
            id="wallet-popup-modal"
            initial={{ y: 40, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl rounded-t-3xl sm:rounded-2xl max-w-3xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl border border-stone-200/80 dark:border-stone-800 overflow-hidden"
          >
            {/* Mobile Swipe Handle */}
            <div className="sm:hidden pt-3 pb-1 flex justify-center cursor-pointer" onClick={onClose}>
              <div className="w-12 h-1.5 rounded-full bg-stone-300 dark:bg-stone-700" />
            </div>

            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-200/70 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-900/70 backdrop-blur-xs shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-xl bg-stone-900 dark:bg-stone-800 text-white flex items-center justify-center shadow-xs shrink-0 border border-stone-700">
                  <WalletIcon className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white">Wallets & Accounts</h3>
                    <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                      {activeWallets.length}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                    Total: <strong className="text-stone-900 dark:text-stone-100">{formatCurrencyAmount(totalNetWorth)}</strong>
                  </p>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.9 }}
                id="close-wallet-modal-btn"
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/80 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

        {/* Tab Navigation Navigation Controls */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 px-3 sm:px-6 bg-white dark:bg-stone-900 gap-1 sm:gap-3 overflow-x-auto text-xs font-semibold shrink-0 no-scrollbar">
          <button
            type="button"
            id="tab-btn-overview"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`py-3 px-2 sm:px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'OVERVIEW'
                ? 'border-stone-900 dark:border-stone-100 text-stone-900 dark:text-white'
                : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Wallets</span>
          </button>

          <button
            type="button"
            id="tab-btn-transfer"
            onClick={() => setActiveTab('TRANSFER')}
            className={`py-3 px-2 sm:px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'TRANSFER'
                ? 'border-stone-900 dark:border-stone-100 text-stone-900 dark:text-white'
                : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Transfer</span>
          </button>

          <button
            type="button"
            id="tab-btn-add"
            onClick={() => setActiveTab('ADD_WALLET')}
            className={`py-3 px-2 sm:px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'ADD_WALLET'
                ? 'border-stone-900 dark:border-stone-100 text-stone-900 dark:text-white'
                : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Add Wallet</span>
          </button>

          <button
            type="button"
            id="tab-btn-txs"
            onClick={() => setActiveTab('TRANSACTIONS')}
            className={`py-3 px-2 sm:px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'TRANSACTIONS'
                ? 'border-stone-900 dark:border-stone-100 text-stone-900 dark:text-white'
                : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Receipt className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Activity</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 overscroll-contain">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {activeWallets.map((wallet) => {
                  const Icon = getWalletIcon(wallet.type);
                  const isSelected = wallet.id === selectedWalletId;
                  const percentOfTotal = totalNetWorth > 0 ? (wallet.balance / totalNetWorth) * 100 : 0;

                  return (
                    <div
                      key={wallet.id}
                      id={`modal-wallet-card-${wallet.id}`}
                      onClick={() => setSelectedWalletId(wallet.id)}
                      className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                        isSelected 
                          ? 'border-stone-900 dark:border-stone-300 bg-stone-50/80 dark:bg-stone-800/90 shadow-xs' 
                          : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-300 dark:hover:border-stone-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <div
                              className="w-9 sm:w-10 h-9 sm:h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                              style={{ backgroundColor: wallet.color }}
                            >
                              <Icon className="w-4 sm:w-5 h-4 sm:h-5" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white truncate">{wallet.name}</h4>
                              <span className="text-[10px] sm:text-[11px] font-medium text-stone-500 dark:text-stone-400 capitalize">
                                {wallet.type.replace('_', ' ').toLowerCase()}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              title="Adjust Balance"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsAdjustingBalance(wallet.id);
                                setAdjustedBalance(wallet.balance);
                              }}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Delete Wallet"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete wallet "${wallet.name}"?`)) {
                                  deleteWallet(wallet.id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Balance display or adjustment editor */}
                        {isAdjustingBalance === wallet.id ? (
                          <div className="mt-3 p-2.5 bg-white dark:bg-stone-800 rounded-xl border border-stone-300 dark:border-stone-700 space-y-2" onClick={(e) => e.stopPropagation()}>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block">
                              Set Balance ({APP_CURRENCY_SYMBOL})
                            </label>
                            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                value={adjustedBalance}
                                onChange={(e) => setAdjustedBalance(parseFloat(e.target.value) || 0)}
                                className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:border-stone-900 dark:focus:border-stone-400"
                              />
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleSaveBalanceAdjustment(wallet.id)}
                                  className="px-3 py-1.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-lg text-xs font-semibold hover:bg-stone-800 dark:hover:bg-white"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsAdjustingBalance(null)}
                                  className="px-2 py-1.5 text-stone-500 dark:text-stone-400 text-xs hover:text-stone-800 dark:hover:text-stone-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 sm:mt-4">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 block">
                              Balance
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                              <span className="text-lg sm:text-xl font-black font-mono text-stone-900 dark:text-white">
                                {formatCurrencyAmount(wallet.balance)}
                              </span>
                              <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 font-mono">{APP_CURRENCY}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[11px]">
                        <span className="text-stone-400 dark:text-stone-500 font-mono">
                          {percentOfTotal > 0 ? `${percentOfTotal.toFixed(1)}% of total` : '0%'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTransferSourceId(wallet.id);
                            setActiveTab('TRANSFER');
                          }}
                          className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                          <span>Transfer</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Wallet Quick Summary Banner */}
              {currentWallet && (
                <div className="p-4 rounded-2xl bg-stone-900 dark:bg-stone-800/90 border border-stone-800 dark:border-stone-700 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-9 sm:w-10 h-9 sm:h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: currentWallet.color }}
                    >
                      {React.createElement(getWalletIcon(currentWallet.type), { className: 'w-4 sm:w-5 h-4 sm:h-5 text-white' })}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold">{currentWallet.name}</h4>
                      <p className="text-[11px] sm:text-xs text-stone-300 dark:text-stone-400">
                        {currentWallet.type.replace('_', ' ')} • {APP_CURRENCY}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTransferSourceId(currentWallet.id);
                        setActiveTab('TRANSFER');
                      }}
                      className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Transfer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('TRANSACTIONS')}
                      className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-white dark:bg-stone-100 text-stone-900 text-xs font-semibold transition-colors hover:bg-stone-100 dark:hover:bg-stone-200 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Activity</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TRANSFER FUNDS */}
          {activeTab === 'TRANSFER' && (
            <div className="space-y-4 max-w-lg mx-auto">
              <div className="bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800/60 rounded-xl p-3 text-xs text-indigo-900 dark:text-indigo-300 flex items-center gap-2.5">
                <ArrowLeftRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Transfers move money between your accounts directly.</span>
              </div>

              <WalletTransferForm
                key={transferSourceId}
                wallets={activeWallets}
                initialSourceWalletId={transferSourceId}
                tone="plain"
                errorPlacement="top"
                statusMessage={transferStatus}
                amountPlaceholder="e.g. 250 or 500/2"
                ids={{
                  source: 'modal-transfer-source',
                  dest: 'modal-transfer-dest',
                  amount: 'modal-transfer-amount-input',
                  note: 'modal-transfer-note-input',
                  submit: 'modal-submit-transfer-btn',
                }}
                onTransferred={() => {
                  setTransferStatus('Transfer completed successfully!');
                  setTimeout(() => {
                    setTransferStatus(null);
                    setActiveTab('OVERVIEW');
                  }, 1000);
                }}
              />
            </div>
          )}

          {/* TAB 3: ADD NEW WALLET */}
          {activeTab === 'ADD_WALLET' && (
            <AddWalletForm
              tone="plain"
              className="max-w-lg mx-auto"
              ids={{
                name: 'modal-new-wallet-name',
                type: 'modal-new-wallet-type',
                currency: 'modal-new-wallet-currency',
                balance: 'modal-new-wallet-balance',
                submit: 'modal-create-wallet-submit',
              }}
              onCreated={() => setActiveTab('OVERVIEW')}
            />
          )}

          {/* TAB 4: WALLET SPECIFIC ACTIVITY */}
          {activeTab === 'TRANSACTIONS' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-stone-50 dark:bg-stone-800/80 p-3 rounded-xl border border-stone-200 dark:border-stone-700">
                <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Account Activity:
                </span>
                <select
                  value={selectedWalletId}
                  onChange={(e) => setSelectedWalletId(e.target.value)}
                  className="text-xs font-semibold bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-900 dark:text-white focus:outline-none"
                >
                  {activeWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatCurrencyAmount(w.balance)})
                    </option>
                  ))}
                </select>
              </div>

              {walletTransactions.length === 0 ? (
                <div className="text-center py-10 text-stone-400 dark:text-stone-500 text-xs">
                  No recent activity recorded for this wallet.
                </div>
              ) : (
                <div className="space-y-2">
                  {walletTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/80 flex items-center justify-between text-xs gap-3"
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          tx.type === 'INCOME' 
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' 
                            : tx.type === 'EXPENSE' 
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' 
                            : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                        }`}>
                          {tx.type === 'INCOME' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-stone-900 dark:text-stone-100 truncate">{tx.description}</p>
                          <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono">{tx.transactionDate}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`font-mono font-bold ${
                          tx.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-900 dark:text-stone-100'
                        }`}>
                          {tx.type === 'INCOME' ? '+' : '-'}{formatCurrencyAmount(tx.amount)}
                        </span>
                        <span className="text-[10px] text-stone-400 dark:text-stone-500 block uppercase font-medium">{tx.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
  );
};
