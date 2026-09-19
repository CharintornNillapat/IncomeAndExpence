import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  ArrowLeftRight,
  ChevronRight,
  Trash2,
  Sliders,
  Wallet as WalletIcon,
  Receipt,
  Layers
} from 'lucide-react';
import { useFinanceState, useFinanceActions } from '../context/FinanceContext';
import { Modal } from './Modal';
import { APP_CURRENCY, APP_CURRENCY_SYMBOL, formatCurrencyAmount } from '../utils/currency';
import { todayIsoDate } from '../utils/date';
import { getWalletIcon } from '../utils/walletIcons';
import { TX_TYPE_META } from './transaction/txTypeMeta';

// T39: TRANSFER and ADD_WALLET are retired - WalletsView (via the shared,
// shell-level TransferFundsModal/AddWalletModal, T41) is the sole owner of
// those flows now. OVERVIEW keeps its inline per-wallet balance adjustment
// editor (there never was a dedicated ADJUST tab to retain - it has always
// lived inline in OVERVIEW) and TRANSACTIONS becomes a preview (T40).
export type WalletModalTab = 'OVERVIEW' | 'TRANSACTIONS';

// T39: hardcoded tab header buttons collapsed into a mapped array now that
// only 2 of the original 4 tabs survive. `buttonId` preserves each tab's
// pre-existing element id verbatim (no spec depends on them today, but they
// are still API per docs/audit/test-selector-contract.md).
const TAB_DEFS: Array<{
  id: WalletModalTab;
  buttonId: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  iconClassName: string;
}> = [
  { id: 'OVERVIEW', buttonId: 'tab-btn-overview', label: 'Wallets', icon: Layers, iconClassName: '' },
  { id: 'TRANSACTIONS', buttonId: 'tab-btn-txs', label: 'Activity', icon: Receipt, iconClassName: 'text-amber-600 dark:text-amber-400' },
];

interface WalletPopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: WalletModalTab;
  initialWalletId?: string;
  /** Opens the shared TransferFundsModal seeded to this wallet (T41) - replaces the retired in-modal TRANSFER tab. */
  onOpenTransfer: (walletId: string) => void;
  /** Navigates to TransactionsView pre-filtered by this wallet (T40) - the preview hands off rather than reimplementing pagination/search/filters. */
  onViewAllTransactions?: (walletId: string) => void;
}

export const WalletPopupModal: React.FC<WalletPopupModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'OVERVIEW',
  initialWalletId,
  onOpenTransfer,
  onViewAllTransactions,
}) => {
  const {
    wallets,
    transactions,
    totalNetWorth,
  } = useFinanceState();
  const { deleteWallet, addTransaction } = useFinanceActions();

  const [activeTab, setActiveTab] = useState<WalletModalTab>(initialTab);
  const [selectedWalletId, setSelectedWalletId] = useState<string>(initialWalletId || wallets[0]?.id || '');

  // Edit / Adjust Balance State
  const [isAdjustingBalance, setIsAdjustingBalance] = useState<string | null>(null);
  const [adjustedBalance, setAdjustedBalance] = useState<number>(0);

  const activeWallets = useMemo(() => wallets.filter((w) => !w.isDeleted), [wallets]);

  // Selected Wallet
  const currentWallet = useMemo(() => {
    return activeWallets.find((w) => w.id === selectedWalletId) || activeWallets[0];
  }, [activeWallets, selectedWalletId]);

  // Transactions specific to the selected wallet. T40: a 5-row preview that
  // hands off to TransactionsView via "View all" rather than reimplementing
  // its pagination, search, type filter, and soft-delete toggle here.
  const walletTransactions = useMemo(() => {
    if (!currentWallet) return [];
    return transactions
      .filter((t) => !t.isDeleted && (t.walletId === currentWallet.id || t.destinationWalletId === currentWallet.id))
      .slice(0, 5);
  }, [transactions, currentWallet]);

  /**
   * The modal is rendered unconditionally by its parent and only returns null
   * while closed, so it never unmounts and the useState initialisers above run
   * exactly once. Without this sync it reopens on whichever tab and wallet were
   * last used, ignoring what the caller asked for - which is why the dashboard's
   * "Add Wallet" shortcut used to land on the Overview tab (that shortcut, and
   * "Transfer", now open the shared shell-level modals directly - T41 - and no
   * longer touch this modal's own tab state at all).
   */
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    // Only override the wallet when the caller named one; opening the modal
    // generically should keep whatever the user was last looking at.
    if (initialWalletId) {
      setSelectedWalletId(initialWalletId);
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

  const header = (
    <>
      {/* Modal Header */}
      <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-200/70 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-900/70 backdrop-blur-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-xl bg-stone-900 dark:bg-stone-800 text-white flex items-center justify-center shadow-xs shrink-0 border border-stone-700">
            <WalletIcon className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 id="wallet-popup-modal-title" className="text-sm sm:text-base font-bold text-stone-900 dark:text-white">Wallets & Accounts</h3>
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

      {/* Tab Navigation Controls (T39: mapped array over the 2 surviving tabs) */}
      <div className="flex border-b border-stone-200 dark:border-stone-800 px-3 sm:px-6 bg-white dark:bg-stone-900 gap-1 sm:gap-3 overflow-x-auto text-xs font-semibold shrink-0 no-scrollbar">
        {TAB_DEFS.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              id={tab.buttonId}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-2 sm:px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'border-stone-900 dark:border-stone-100 text-stone-900 dark:text-white'
                  : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <TabIcon className={`w-4 h-4 ${tab.iconClassName}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      header={header}
      titleId="wallet-popup-modal-title"
      panelId="wallet-popup-modal"
      maxWidthClassName="max-w-3xl"
      bodyClassName="space-y-5 sm:space-y-6"
    >
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
                            onOpenTransfer(wallet.id);
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
                      onClick={() => onOpenTransfer(currentWallet.id)}
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

          {/* TAB 2: WALLET SPECIFIC ACTIVITY (T40: 5-row preview + handoff) */}
          {activeTab === 'TRANSACTIONS' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-stone-50 dark:bg-stone-800/80 p-3 rounded-xl border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2">
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

                <button
                  type="button"
                  id="wallet-modal-view-all-tx-btn"
                  onClick={() => onViewAllTransactions?.(selectedWalletId)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer shrink-0"
                >
                  <span>View all</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {walletTransactions.length === 0 ? (
                <div className="text-center py-10 text-stone-400 dark:text-stone-500 text-xs">
                  No recent activity recorded for this wallet.
                </div>
              ) : (
                <div className="space-y-2">
                  {walletTransactions.map((tx) => {
                    const CompactIcon = TX_TYPE_META[tx.type].compactIcon;
                    return (
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
                          <CompactIcon className="w-3.5 h-3.5" />
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
                          {TX_TYPE_META[tx.type].sign}{formatCurrencyAmount(tx.amount)}
                        </span>
                        <span className="text-[10px] text-stone-400 dark:text-stone-500 block uppercase font-medium">{tx.type}</span>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
    </Modal>
  );
};
