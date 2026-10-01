import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Plus, Wallet as WalletIcon } from 'lucide-react';
import { useFinanceState, useFinanceActions } from '../context/FinanceContext';
import { useWallets } from '../hooks/useWallets';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { WalletList } from '../components/wallet/WalletList';
import { WalletDetail } from '../components/wallet/WalletDetail';
import type { Wallet, WalletEdit } from '../types';
import { formatCurrencyAmount } from '../utils/currency';
import { todayIsoDate } from '../utils/date';
import { buildLookupMap } from '../utils/mapUtils';
import { archivedWallets, walletActivity, walletShares, walletTotal } from '../selectors/wallets';
import { foldAdjustmentPairs } from '../selectors/adjustments';
import { groupByDay } from '../selectors/ledger';

/** Spec 6.3: how much of a wallet's activity its detail shows before "View all". */
const RECENT_ITEMS = 10;

interface WalletsViewProps {
  /**
   * Opens the shared, shell-level TransferFundsModal (owned by App.tsx, T41),
   * optionally with this wallet as the source. The header's Transfer passes
   * no wallet; a click event must never reach it as one.
   */
  onOpenTransfer?: (walletId?: string) => void;
  /** Opens the shared, shell-level AddWalletModal (owned by App.tsx, T41). */
  onOpenAddWallet?: () => void;
  /** Opens the Transactions page filtered to one wallet ("View all"). */
  onOpenWalletTransactions?: (walletId: string) => void;
  /** Opens one row on the Transactions page with its edit panel. */
  onOpenTransaction?: (txId: string) => void;
  /** A wallet to select on arrival: the Dashboard's wallet rows hand off here (Phase 59). */
  initialSelectedWalletId?: string;
  /** Called once, right after mount, when `initialSelectedWalletId` was set, as the Transactions page does with its own. */
  onConsumeInitialSelectedWallet?: () => void;
}

type PendingAction = { kind: 'delete' | 'archive'; wallet: Wallet };

/**
 * Spec 6.3 (Phase 59, ADR 0034): a master-detail page. The list (4/12) holds
 * the AllocationBar and a row per wallet; the detail (8/12) shows the
 * selected wallet. Below `lg` the list stands alone and a tapped wallet opens
 * in a bottom sheet - one render path, never two copies hidden by CSS (the
 * specs count hidden elements).
 *
 * It replaces both the old card grid and the Dashboard's `WalletPopupModal`:
 * this page is the one place a wallet is inspected, edited, adjusted,
 * archived or deleted.
 */
export const WalletsView: React.FC<WalletsViewProps> = ({
  onOpenTransfer,
  onOpenAddWallet,
  onOpenWalletTransactions,
  onOpenTransaction,
  initialSelectedWalletId,
  onConsumeInitialSelectedWallet,
}) => {
  const { transactions, categories } = useFinanceState();
  const { addTransaction, deleteWallet, editWallet, setWalletArchived } = useFinanceActions();
  const { wallets, allWallets } = useWallets();
  const isWide = useMediaQuery('(min-width: 1024px)');

  const [selectedId, setSelectedId] = useState<string | undefined>(initialSelectedWalletId);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);

  useEffect(() => {
    if (initialSelectedWalletId) onConsumeInitialSelectedWallet?.();
    // eslint-disable-next-line
  }, []);

  const today = todayIsoDate();
  const walletMap = useMemo(() => buildLookupMap(allWallets), [allWallets]);
  const categoryMap = useMemo(() => buildLookupMap(categories), [categories]);
  const archived = useMemo(() => archivedWallets(allWallets), [allWallets]);
  const shares = useMemo(() => walletShares(wallets), [wallets]);
  const total = walletTotal(wallets);

  // From `lg` a wallet is always selected (the first one by default); below
  // it, only a tapped one, which opens the sheet. A selection that is no
  // longer active (deleted, archived) falls back the same way.
  const chosen = wallets.find((w) => w.id === selectedId);
  const selected = chosen ?? (isWide ? wallets[0] : undefined);

  const { items, dayNets } = useMemo(() => {
    if (!selected) return { items: [], dayNets: new Map<string, number>() };
    const rows = walletActivity(transactions, selected.id);
    return {
      items: foldAdjustmentPairs(rows).slice(0, RECENT_ITEMS),
      dayNets: new Map(groupByDay(rows, categoryMap).map((day) => [day.date, day.net])),
    };
  }, [transactions, selected, categoryMap]);

  const handleAdjustBalance = useCallback(
    async (walletId: string, newBalance: number) => {
      const target = wallets.find((w) => w.id === walletId);
      if (!target) return { success: false, error: 'Wallet not found or has been deleted' };
      const diff = newBalance - Number(target.balance);
      if (diff === 0) return { success: true };
      // The signed difference (ADR 0024): every ledger path treats an
      // ADJUSTMENT as `balance + amount`, so lowering a balance must be negative.
      return addTransaction({
        amount: diff,
        description: `Manual balance adjustment (${diff >= 0 ? '+' : '-'}${formatCurrencyAmount(Math.abs(diff))})`,
        walletId: target.id,
        type: 'ADJUSTMENT',
        transactionDate: todayIsoDate(),
      });
    },
    [wallets, addTransaction]
  );

  const handleEdit = useCallback((walletId: string, details: WalletEdit) => editWallet(walletId, details), [editWallet]);

  const requestAction = useCallback((kind: PendingAction['kind']) => (wallet: Wallet) => {
    setConfirmError(null);
    setPending({ kind, wallet });
  }, []);

  const closeConfirm = useCallback(() => {
    setPending(null);
    setConfirmError(null);
  }, []);

  // A rejected write keeps the dialog open with the reason shown - the same
  // MutationResult convention every write form in this app follows.
  const confirmPending = useCallback(async () => {
    if (!pending) return;
    setIsConfirming(true);
    setConfirmError(null);
    const result =
      pending.kind === 'delete' ? await deleteWallet(pending.wallet.id) : await setWalletArchived(pending.wallet.id, true);
    setIsConfirming(false);
    if (!result.success) {
      setConfirmError(result.error || `Failed to ${pending.kind} the wallet`);
      return;
    }
    setPending(null);
    // The selection falls back to the first wallet from `lg`, and closes the sheet below it.
    setSelectedId(undefined);
  }, [pending, deleteWallet, setWalletArchived]);

  const handleUnarchive = useCallback(
    async (walletId: string) => {
      setUnarchivingId(walletId);
      await setWalletArchived(walletId, false);
      setUnarchivingId(null);
    },
    [setWalletArchived]
  );

  const pendingRowCount = useMemo(
    () => (pending ? walletActivity(transactions, pending.wallet.id).length : 0),
    [pending, transactions]
  );

  const confirmCopy = (() => {
    if (!pending) return { title: '', description: '', confirmText: '' };
    const { wallet } = pending;
    const rows = pendingRowCount === 1 ? '1 transaction' : `${pendingRowCount} transactions`;
    const money = formatCurrencyAmount(Number(wallet.balance));
    if (pending.kind === 'delete') {
      return {
        title: 'Delete wallet',
        description: `Delete "${wallet.name}"? Its ${rows} stay in your history and still count toward spending and income. Its ${money} balance leaves your wallet total and net worth.`,
        confirmText: 'Delete wallet',
      };
    }
    return {
      title: 'Archive wallet',
      description: `Archive "${wallet.name}"? It leaves your wallet list, the wallet pickers and net worth, along with its ${money} balance. Its ${rows} stay in your history. You can unarchive it from the Archived list.`,
      confirmText: 'Archive wallet',
    };
  })();

  const detail = (wallet: Wallet, inSheet: boolean) => (
    <WalletDetail
      wallet={wallet}
      items={items}
      dayNets={dayNets}
      wallets={walletMap}
      categories={categoryMap}
      today={today}
      inSheet={inSheet}
      onTransferOut={(walletId) => onOpenTransfer?.(walletId)}
      onAdjustBalance={handleAdjustBalance}
      onEdit={handleEdit}
      onRequestArchive={requestAction('archive')}
      onRequestDelete={requestAction('delete')}
      onViewAllTransactions={(walletId) => onOpenWalletTransactions?.(walletId)}
      onOpenTransaction={(txId) => onOpenTransaction?.(txId)}
    />
  );

  const list = (
    <WalletList
      wallets={wallets}
      archived={archived}
      shares={shares}
      selectedId={selected?.id}
      onSelect={setSelectedId}
      onAddWallet={() => onOpenAddWallet?.()}
      onUnarchive={handleUnarchive}
      unarchivingId={unarchivingId}
    />
  );

  const walletCount = wallets.length === 1 ? '1 wallet' : `${wallets.length} wallets`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallets"
        description={`${formatCurrencyAmount(total)} across ${walletCount}`}
        actions={
          <>
            <Button
              id="wallet-transfer-modal-btn"
              variant="secondary"
              onClick={() => onOpenTransfer?.()}
              icon={<ArrowLeftRight aria-hidden="true" className="w-3.5 h-3.5 text-transfer" />}
            >
              Transfer
            </Button>
            <Button id="wallet-add-modal-btn" onClick={() => onOpenAddWallet?.()} icon={<Plus aria-hidden="true" className="w-4 h-4" />}>
              Add wallet
            </Button>
          </>
        }
      />

      {wallets.length === 0 && archived.length === 0 ? (
        <Card>
          <EmptyState
            icon={WalletIcon}
            title="No wallets yet"
            subtitle="Add a wallet to start tracking balances, transfers, and transactions"
          />
        </Card>
      ) : isWide ? (
        <div className="grid grid-cols-12 gap-4 items-start">
          {/* Spec 6.3's 4/8 from `xl`; 5/7 between `lg` and `xl`, where a 4/12 list truncated every name. */}
          <div className="col-span-5 xl:col-span-4">{list}</div>
          <div className="col-span-7 xl:col-span-8">
            {selected ? (
              detail(selected, false)
            ) : (
              <Card>
                <EmptyState icon={WalletIcon} title="No active wallets" subtitle="Unarchive a wallet or add one to see its details." />
              </Card>
            )}
          </div>
        </div>
      ) : (
        list
      )}

      {/* Below `lg` the detail opens as a bottom sheet. Rendered only there, so it never doubles the inline one. */}
      <Modal
        isOpen={!isWide && !!selected}
        onClose={() => setSelectedId(undefined)}
        title={selected?.name ?? ''}
        closeButtonId="wallet-detail-close-btn"
        maxWidthClassName="max-w-lg"
      >
        {!isWide && selected && detail(selected, true)}
      </Modal>

      <ConfirmDialog
        isOpen={!!pending}
        onClose={closeConfirm}
        onConfirm={confirmPending}
        isLoading={isConfirming}
        error={confirmError}
        isDestructive={pending?.kind === 'delete'}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmText={confirmCopy.confirmText}
      />
    </div>
  );
};
