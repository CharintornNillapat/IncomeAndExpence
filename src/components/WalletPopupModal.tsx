import React, { useState, useMemo, useEffect } from 'react';
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
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Wallet } from '../types';
import { APP_CURRENCY, APP_CURRENCY_SYMBOL, formatCurrencyAmount } from '../utils/currency';
import { todayIsoDate } from '../utils/date';
import { OPTION_CLASS } from '../utils/formStyles';
import { getWalletIcon } from '../utils/walletIcons';
import { TxTypeIcon, TxAmount } from './transaction/TxCells';
import { transferDirection } from './transaction/txTypeMeta';

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
  { id: 'TRANSACTIONS', buttonId: 'tab-btn-txs', label: 'Activity', icon: Receipt, iconClassName: 'text-brand' },
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

  // T42: wallet deletion used to fire on a bare `window.confirm` - replaced
  // with the shared `ConfirmDialog` for a consistent, accessible dialog.
  const [walletToDelete, setWalletToDelete] = useState<Wallet | null>(null);
  const [isDeletingWallet, setIsDeletingWallet] = useState<boolean>(false);

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

    // The signed difference (ADR 0024). This wrote `Math.abs(diff)`, and every
    // ledger path treats ADJUSTMENT as `balance + amount` - so lowering a
    // balance raised it by the same amount.
    await addTransaction({
      amount: diff,
      description: `Manual balance adjustment (${diff >= 0 ? '+' : '-'}${formatCurrencyAmount(Math.abs(diff))})`,
      walletId: target.id,
      type: 'ADJUSTMENT',
      transactionDate: todayIsoDate(),
    });

    setIsAdjustingBalance(null);
  };

  const handleConfirmDeleteWallet = async () => {
    if (!walletToDelete) return;
    setIsDeletingWallet(true);
    await deleteWallet(walletToDelete.id);
    setIsDeletingWallet(false);
    setWalletToDelete(null);
  };

  const header = (
    <>
      {/* Modal Header */}
      <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-line flex items-center justify-between bg-surface-1 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-lg bg-brand-tint flex items-center justify-center shrink-0 border border-brand-line">
            <WalletIcon className="w-4 sm:w-5 h-4 sm:h-5 text-brand" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 id="wallet-popup-modal-title" className="text-sm sm:text-base font-bold text-fg">Wallets & Accounts</h3>
              <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-tint text-brand border border-brand-line">
                {activeWallets.length}
              </span>
            </div>
            <p className="text-xs text-fg-secondary">
              Total: <strong className="text-fg">{formatCurrencyAmount(totalNetWorth)}</strong>
            </p>
          </div>
        </div>

        <IconButton id="close-wallet-modal-btn" label="Close wallet details" onClick={onClose} className="-mr-2">
          <X className="w-5 h-5" />
        </IconButton>
      </div>

      {/* Tab Navigation Controls (T39: mapped array over the 2 surviving tabs) */}
      <div className="flex border-b border-line px-3 sm:px-6 bg-surface-1 gap-1 sm:gap-3 overflow-x-auto text-xs font-semibold shrink-0 no-scrollbar">
        {TAB_DEFS.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              id={tab.buttonId}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[44px] py-3 px-2 sm:px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'border-brand text-fg'
                  : 'border-transparent text-fg-secondary hover:text-fg'
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
    <>
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
                      className={`p-3.5 sm:p-4 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                        isSelected
                          ? 'border-brand bg-surface-2'
                          : 'border-line bg-surface-1 hover:border-line-input'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <div
                              className="w-9 sm:w-10 h-9 sm:h-10 rounded-lg flex items-center justify-center text-white shrink-0"
                              style={{ backgroundColor: wallet.color }}
                            >
                              <Icon className="w-4 sm:w-5 h-4 sm:h-5" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-bold text-fg truncate">{wallet.name}</h4>
                              <span className="text-[10px] sm:text-[11px] font-medium text-fg-secondary capitalize">
                                {wallet.type.replace('_', ' ').toLowerCase()}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <IconButton
                              id={`wallet-adjust-btn-${wallet.id}`}
                              label="Adjust Balance"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsAdjustingBalance(wallet.id);
                                setAdjustedBalance(wallet.balance);
                              }}
                              className="-my-2"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </IconButton>
                            <IconButton
                              label="Delete Wallet"
                              tone="danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWalletToDelete(wallet);
                              }}
                              className="-my-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </IconButton>
                          </div>
                        </div>

                        {/* Balance display or adjustment editor */}
                        {isAdjustingBalance === wallet.id ? (
                          <div className="mt-3 p-2.5 bg-surface-1 rounded-lg border border-line space-y-2" onClick={(e) => e.stopPropagation()}>
                            <label className="text-xs font-semibold text-fg-secondary block">
                              Set Balance ({APP_CURRENCY_SYMBOL})
                            </label>
                            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                              <input
                                id="wallet-adjust-input"
                                type="number"
                                step="0.01"
                                value={adjustedBalance}
                                onChange={(e) => setAdjustedBalance(parseFloat(e.target.value) || 0)}
                                className="w-full min-h-[44px] text-xs px-2.5 py-1.5 rounded-lg border border-line-input bg-surface-2 text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-focus"
                              />
                              <div className="flex items-center gap-1 shrink-0">
                                <Button id="wallet-adjust-save-btn" onClick={() => handleSaveBalanceAdjustment(wallet.id)}>
                                  Save
                                </Button>
                                <Button variant="secondary" onClick={() => setIsAdjustingBalance(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 sm:mt-4">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted block">
                              Balance
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                              <span
                                id={`modal-wallet-balance-${wallet.id}`}
                                className="text-lg sm:text-xl font-black text-fg"
                              >
                                {formatCurrencyAmount(wallet.balance)}
                              </span>
                              <span className="text-[11px] font-semibold text-fg-secondary">{APP_CURRENCY}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between text-[11px]">
                        <span className="text-fg-muted">
                          {percentOfTotal > 0 ? `${percentOfTotal.toFixed(1)}% of total` : '0%'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenTransfer(wallet.id);
                          }}
                          className="min-h-[44px] -my-2.5 text-transfer font-semibold hover:underline flex items-center gap-1 cursor-pointer"
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
                <div className="p-4 rounded-xl bg-surface-2 border border-line text-fg flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 sm:w-10 h-9 sm:h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: currentWallet.color }}
                    >
                      {React.createElement(getWalletIcon(currentWallet.type), { className: 'w-4 sm:w-5 h-4 sm:h-5 text-white' })}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold">{currentWallet.name}</h4>
                      <p className="text-[11px] sm:text-xs text-fg-secondary">
                        {currentWallet.type.replace('_', ' ')} • {APP_CURRENCY}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => onOpenTransfer(currentWallet.id)}
                      className="flex-1 sm:flex-none"
                      icon={<ArrowLeftRight className="w-3.5 h-3.5 text-transfer" />}
                    >
                      <span>Transfer</span>
                    </Button>
                    <Button
                      onClick={() => setActiveTab('TRANSACTIONS')}
                      className="flex-1 sm:flex-none"
                      icon={<Receipt className="w-3.5 h-3.5" />}
                    >
                      <span>Activity</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WALLET SPECIFIC ACTIVITY (T40: 5-row preview + handoff) */}
          {activeTab === 'TRANSACTIONS' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-2 p-3 rounded-lg border border-line">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-fg-secondary">
                    Account Activity:
                  </span>
                  <select
                    value={selectedWalletId}
                    onChange={(e) => setSelectedWalletId(e.target.value)}
                    aria-label="Account activity wallet"
                    className="min-h-[44px] text-xs font-semibold bg-surface-1 border border-line-input rounded-lg px-2.5 py-1.5 text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    {activeWallets.map((w) => (
                      <option key={w.id} value={w.id} className={OPTION_CLASS}>
                        {w.name} ({formatCurrencyAmount(w.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  id="wallet-modal-view-all-tx-btn"
                  onClick={() => onViewAllTransactions?.(selectedWalletId)}
                  className="min-h-[44px] inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline cursor-pointer shrink-0"
                >
                  <span>View all</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {walletTransactions.length === 0 ? (
                <div className="text-center py-10 text-fg-muted text-xs">
                  No recent activity recorded for this wallet.
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Icon tint and amount colour both come from `txTypeMetaFor`. This
                      is one wallet's own view, so a transfer is signed by which
                      way it moved for this wallet (ADR 0027). */}
                  {walletTransactions.map((tx) => {
                    return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-lg border border-line bg-surface-1 flex items-center justify-between text-xs gap-3"
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <TxTypeIcon type={tx.type} amount={tx.amount} variant="compact" size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold text-fg truncate">{tx.description}</p>
                          <span className="text-[10px] text-fg-muted">{tx.transactionDate}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <TxAmount amount={tx.amount} type={tx.type} direction={transferDirection(tx, selectedWalletId)} />
                        <span className="text-[10px] text-fg-muted block uppercase font-medium">{tx.type}</span>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
    </Modal>

    {/* Delete Wallet Confirmation (T42) */}
    <ConfirmDialog
      isOpen={!!walletToDelete}
      onClose={() => setWalletToDelete(null)}
      onConfirm={handleConfirmDeleteWallet}
      isLoading={isDeletingWallet}
      title="Delete Wallet"
      description={
        walletToDelete
          ? `Delete "${walletToDelete.name}"? Its transaction history is kept, but the wallet itself will no longer appear in your active accounts.`
          : ''
      }
    />
    </>
  );
};
