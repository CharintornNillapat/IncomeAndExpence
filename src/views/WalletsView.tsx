import React, { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  ArrowLeftRight,
  Trash2,
  Wallet as WalletIcon,
} from 'lucide-react';
import { useFinanceState, useFinanceActions } from '../context/FinanceContext';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Wallet } from '../types';
import { APP_CURRENCY, APP_CURRENCY_SYMBOL } from '../utils/currency';
import { getWalletIcon } from '../utils/walletIcons';
import { toIsoDate } from '../utils/date';

interface WalletsViewProps {
  /** Opens the shared, shell-level TransferFundsModal (owned by App.tsx, T41) - this view no longer mounts its own copy. */
  onOpenTransfer?: () => void;
  /** Opens the shared, shell-level AddWalletModal (owned by App.tsx, T41) - this view no longer mounts its own copy. */
  onOpenAddWallet?: () => void;
}

export const WalletsView: React.FC<WalletsViewProps> = ({ onOpenTransfer, onOpenAddWallet }) => {
  const { wallets } = useFinanceState();
  const { deleteWallet } = useFinanceActions();

  // T42: wallet deletion had no confirmation at all (a real bug, not a
  // stylistic gap) - `walletToDelete` gates it behind `ConfirmDialog`.
  const [walletToDelete, setWalletToDelete] = useState<Wallet | null>(null);
  const [isDeletingWallet, setIsDeletingWallet] = useState<boolean>(false);
  const [deleteWalletError, setDeleteWalletError] = useState<string | null>(null);

  const activeWallets = useMemo(() => wallets.filter((w) => !w.isDeleted), [wallets]);

  const handleOpenDeleteWallet = useCallback((wallet: Wallet) => {
    setDeleteWalletError(null);
    setWalletToDelete(wallet);
  }, []);

  const handleCloseDeleteWallet = useCallback(() => {
    setWalletToDelete(null);
    setDeleteWalletError(null);
  }, []);

  // Rejected write keeps the dialog open with the reason shown, instead of
  // closing as if nothing happened - the same MutationResult convention every
  // write form in this app follows.
  const handleConfirmDeleteWallet = useCallback(async () => {
    if (!walletToDelete) return;
    setIsDeletingWallet(true);
    setDeleteWalletError(null);
    const result = await deleteWallet(walletToDelete.id);
    setIsDeletingWallet(false);
    if (!result.success) {
      setDeleteWalletError(result.error || 'Failed to delete wallet');
      return;
    }
    setWalletToDelete(null);
  }, [walletToDelete, deleteWallet]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Wallets & Accounts"
        subtitle="Manage your accounts, balances, and transfers"
        action={
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="wallet-transfer-modal-btn"
              type="button"
              onClick={() => onOpenTransfer?.()}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-semibold text-fg-secondary bg-surface-2 hover:bg-surface-3 border border-line hover:border-brand rounded-lg transition-all cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-transfer" />
              <span>Transfer</span>
            </button>

            <button
              id="wallet-add-modal-btn"
              type="button"
              onClick={() => onOpenAddWallet?.()}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-semibold text-white bg-brand-fill hover:bg-brand-fill-hover rounded-lg transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Add Wallet</span>
            </button>
          </div>
        }
      />

      {/* Wallets Cards Grid */}
      {activeWallets.length === 0 ? (
        <Card>
          <EmptyState
            icon={WalletIcon}
            title="No wallets yet"
            subtitle="Add a wallet to start tracking balances, transfers, and transactions"
          />
        </Card>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {activeWallets.map((wallet) => {
          const Icon = getWalletIcon(wallet.type);
          return (
            <motion.div
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              key={wallet.id}
              id={`wallet-entity-${wallet.id}`}
              className="bg-surface-1 rounded-xl border border-line p-5 hover:border-brand transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: wallet.color }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-fg">{wallet.name}</h3>
                      <span className="text-[11px] font-medium text-fg-muted capitalize">
                        {wallet.type.replace('_', ' ').toLowerCase()}
                      </span>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    id={`delete-wallet-${wallet.id}`}
                    type="button"
                    onClick={() => handleOpenDeleteWallet(wallet)}
                    title="Delete wallet"
                    className="p-1.5 text-fg-muted hover:text-expense hover:bg-expense-tint rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>

                <div className="mt-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted block">
                    Current Balance
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <div className="text-2xl font-bold font-mono text-fg">
                      <AnimatedCounter
                        value={wallet.balance}
                        currencyPrefix={APP_CURRENCY_SYMBOL}
                        duration={0.8}
                      />
                    </div>
                    <span className="text-xs font-semibold text-fg-secondary font-mono">{APP_CURRENCY}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-line flex items-center justify-between text-[11px] text-fg-muted">
                {/* `createdAt` is a full ISO instant; slicing its first 10 characters
                    would read the UTC calendar date, which at UTC+7 shows the wrong
                    day for anything created 00:00-06:59 local. `toIsoDate` reads the
                    `Date`'s local calendar components instead. */}
                <span>Created: {toIsoDate(new Date(wallet.createdAt))}</span>
                <span className="inline-flex items-center gap-1 text-income font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-income-fill" /> Active Source
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
      )}

      {/*
        T41: the Add Wallet and Transfer Funds modals used to be rendered
        here, locally. They now live at shell level (App.tsx) as
        `AddWalletModal`/`TransferFundsModal` - self-subscribing components
        mounted once, exactly like `QuickAddModal` - so the *same* modal
        instance (and the same ids: #new-wallet-name, #transfer-source-wallet,
        etc.) is reachable from this view's header buttons above AND from
        DashboardView's hero/wallet-card triggers, which live in a different
        view and could never open a modal only WalletsView mounted locally.
      */}

      {/* Delete Wallet Confirmation (T42) */}
      <ConfirmDialog
        isOpen={!!walletToDelete}
        onClose={handleCloseDeleteWallet}
        onConfirm={handleConfirmDeleteWallet}
        isLoading={isDeletingWallet}
        error={deleteWalletError}
        title="Delete Wallet"
        description={
          walletToDelete
            ? `Delete "${walletToDelete.name}"? Its transaction history is kept, but the wallet itself will no longer appear in your active accounts.`
            : ''
        }
      />
    </div>
  );
};
