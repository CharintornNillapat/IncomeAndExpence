import React, { useState, useMemo, useCallback } from 'react';
import { useFinanceState } from '../context/FinanceContext';
import { useWallets } from '../hooks/useWallets';
import { useDebts } from '../hooks/useDebts';
import { WalletPopupModal, WalletModalTab } from '../components/WalletPopupModal';
import { PageHeader } from '../components/ui/PageHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { NetWorthCard } from '../components/dashboard/NetWorthCard';
import { CashFlowCard } from '../components/dashboard/CashFlowCard';
import { DebtWarningBanner } from '../components/dashboard/DebtWarningBanner';
import { WalletsSection } from '../components/dashboard/WalletsSection';
import { CategorySpendingCard } from '../components/dashboard/CategorySpendingCard';
import { DebtPayoffCard } from '../components/dashboard/DebtPayoffCard';
import { RecentActivityCard } from '../components/dashboard/RecentActivityCard';
import { MoodSpendingCard } from '../components/dashboard/MoodSpendingCard';
import { SpendingInsightsCard } from '../components/dashboard/SpendingInsightsCard';
import { formatLongDate, greetingFor, todayIsoDate } from '../utils/date';
import { buildLookupMap } from '../utils/mapUtils';
import { filterByRange, formatRangeLabel, TimeRange } from '../selectors/timeRange';
import { cashFlow, groupByDay, spendingByCategory } from '../selectors/ledger';
import { debtRemaining, netWorth, walletShares, walletTotal } from '../selectors/wallets';
import { debtPlan, monthlySurplus } from '../selectors/debts';
import { foldAdjustmentPairs } from '../selectors/adjustments';
import { moodSpendingDays } from '../selectors/diary';

export type TimeFilter = TimeRange;

/** How many activity items (a folded adjustment pair counts as one) the Recent activity card shows. */
const RECENT_ITEMS = 6;

const PERIODS: { value: TimeFilter; label: string; name: string }[] = [
  { value: 'DAY', label: 'Today', name: 'today' },
  { value: 'WEEK', label: 'This week', name: 'this week' },
  { value: 'MONTH', label: 'Past 30 days', name: 'past 30 days' },
  { value: 'ALL', label: 'All time', name: 'all time' },
];

interface DashboardViewProps {
  onNavigate?: (tab: string) => void;
  /** Opens the shared, shell-level TransferFundsModal (owned by App.tsx), optionally seeded to a wallet (T41). */
  onOpenTransfer?: (walletId?: string) => void;
  /** Opens the shared, shell-level AddWalletModal (owned by App.tsx, T41). */
  onOpenAddWallet?: () => void;
  /** Navigates to TransactionsView pre-filtered by a wallet (T40 handoff from the wallet popup's Activity preview). */
  onOpenWalletTransactions?: (walletId: string) => void;
  /** Opens one row on the Transactions page with its edit panel (Recent activity, Phase 58b). */
  onOpenTransaction?: (txId: string) => void;
}

/**
 * Spec 6.1 (ADR 0030): one period for the whole page (L2), and every figure
 * through `src/selectors/` (ADR 0028), computed once here and passed down.
 * The cards only lay figures out.
 */
export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenTransfer,
  onOpenAddWallet,
  onOpenWalletTransactions,
  onOpenTransaction,
}) => {
  const { transactions, categories, diaryEntries, currentUser } = useFinanceState();
  // `wallets` here is already the active set; `allWallets` still includes
  // deleted ones so historic rows can resolve their wallet name.
  const { wallets: activeWallets, allWallets } = useWallets();
  const { debts, metrics: debtSummary } = useDebts();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('MONTH');

  // Wallet Popup Modal State in Dashboard
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [walletModalTab, setWalletModalTab] = useState<WalletModalTab>('OVERVIEW');
  const [selectedWalletIdForModal, setSelectedWalletIdForModal] = useState<string | undefined>(undefined);

  const openWalletModal = useCallback((tab: WalletModalTab = 'OVERVIEW', walletId?: string) => {
    setWalletModalTab(tab);
    setSelectedWalletIdForModal(walletId);
    setIsWalletModalOpen(true);
  }, []);

  // T41: Transfer and Add Wallet open the shared, shell-level modals App.tsx
  // owns. The section's Transfer passes no wallet, so the form seeds its
  // defaults (`transfer-preview.spec.ts`).
  const handleOpenTransfer = useCallback(() => onOpenTransfer?.(), [onOpenTransfer]);
  const handleOpenAddWallet = useCallback(() => onOpenAddWallet?.(), [onOpenAddWallet]);
  const handleOpenManageWallets = useCallback(() => openWalletModal('OVERVIEW'), [openWalletModal]);
  const handleOpenWallet = useCallback((walletId: string) => openWalletModal('OVERVIEW', walletId), [openWalletModal]);

  const handlePopupOpenTransfer = useCallback(
    (walletId: string) => {
      setIsWalletModalOpen(false);
      onOpenTransfer?.(walletId);
    },
    [onOpenTransfer]
  );

  const handlePopupViewAllTransactions = useCallback(
    (walletId: string) => {
      setIsWalletModalOpen(false);
      onOpenWalletTransactions?.(walletId);
    },
    [onOpenWalletTransactions]
  );

  const goTo = useCallback((tab: string) => () => onNavigate?.(tab), [onNavigate]);

  const today = todayIsoDate();
  const walletMap = useMemo(() => buildLookupMap(allWallets), [allWallets]);
  const categoryMap = useMemo(() => buildLookupMap(categories), [categories]);

  // L2: one period for the page. Cash flow and the category card read the
  // same filtered rows, so their Spending is one figure (acceptance check 1).
  const periodRows = useMemo(() => filterByRange(transactions, timeFilter, today), [transactions, timeFilter, today]);
  const flow = useMemo(() => cashFlow(periodRows, categoryMap), [periodRows, categoryMap]);
  const categoryRows = useMemo(() => spendingByCategory(periodRows, categoryMap), [periodRows, categoryMap]);

  // L3
  const wealth = useMemo(
    () => ({
      netWorth: netWorth(activeWallets, debts),
      walletTotal: walletTotal(activeWallets),
      debtRemaining: debtRemaining(debts),
      shares: walletShares(activeWallets),
    }),
    [activeWallets, debts]
  );

  // L4 and L5: the surplus is always the past 30 days, whatever the period.
  const plan = useMemo(
    () => debtPlan(debts, today, monthlySurplus(transactions, today, categoryMap)),
    [debts, today, transactions, categoryMap]
  );

  // L8 and L11: the newest live rows, a cancelling adjustment pair folded,
  // and each day's net over all of that day's rows.
  const { recentItems, dayNets } = useMemo(() => {
    const live = transactions
      .filter((tx) => !tx.isDeleted)
      .sort((a, b) =>
        a.transactionDate !== b.transactionDate
          ? a.transactionDate < b.transactionDate ? 1 : -1
          : a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
      );
    const items = foldAdjustmentPairs(live).slice(0, RECENT_ITEMS);
    const nets = new Map(groupByDay(live, categoryMap).map((day) => [day.date, day.net]));
    return { recentItems: items, dayNets: nets };
  }, [transactions, categoryMap]);

  const mood = useMemo(
    () => moodSpendingDays(diaryEntries, transactions, categoryMap, timeFilter, today),
    [diaryEntries, transactions, categoryMap, timeFilter, today]
  );
  const todayLogged = useMemo(() => diaryEntries.some((entry) => !entry.isDeleted && entry.date === today), [diaryEntries, today]);

  const period = PERIODS.find((p) => p.value === timeFilter) ?? PERIODS[2];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={greetingFor(new Date().getHours())}
        description={`${formatLongDate(today)} · every figure below uses the selected period`}
        actions={
          <SegmentedControl<TimeFilter>
            size="sm"
            ariaLabel="Period"
            value={timeFilter}
            onChange={setTimeFilter}
            options={PERIODS.map((p) => ({ value: p.value, id: `time-filter-${p.value.toLowerCase()}`, label: p.label }))}
          />
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-5">
          <NetWorthCard
            netWorth={wealth.netWorth}
            walletTotal={wealth.walletTotal}
            walletCount={activeWallets.length}
            debtRemaining={wealth.debtRemaining}
          />
        </div>
        <div className="md:col-span-7">
          <CashFlowCard flow={flow} periodName={period.name} periodDates={formatRangeLabel(timeFilter, today)} />
        </div>
      </div>

      <DebtWarningBanner plan={plan} onReviewPlan={goTo('debts')} />

      <WalletsSection
        wallets={activeWallets}
        shares={wealth.shares}
        onTransfer={handleOpenTransfer}
        onAddWallet={handleOpenAddWallet}
        onManageWallets={handleOpenManageWallets}
        onOpenWallet={handleOpenWallet}
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7">
          <CategorySpendingCard rows={categoryRows} total={flow.spending} />
        </div>
        <div className="xl:col-span-5">
          <DebtPayoffCard
            plan={plan}
            paid={debtSummary.paidTarget}
            total={debtSummary.totalTarget}
            progressPercent={debtSummary.progressPercent}
            onOpenDebts={goTo('debts')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-8">
          <RecentActivityCard
            items={recentItems}
            dayNets={dayNets}
            wallets={walletMap}
            categories={categoryMap}
            today={today}
            onViewAll={goTo('transactions')}
            onOpenTransaction={onOpenTransaction}
          />
        </div>
        <div className="xl:col-span-4">
          <MoodSpendingCard mood={mood} today={today} todayLogged={todayLogged} onOpenDiary={goTo('diary')} />
        </div>
      </div>

      {/* The monthly wrap-up (ADR 0020) owns its own fetching and its own
          calendar-month period, which its title names. */}
      <section aria-label="Spending insights">
        <SpendingInsightsCard transactions={transactions} categories={categories} userId={currentUser.id} />
      </section>

      <WalletPopupModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        initialTab={walletModalTab}
        initialWalletId={selectedWalletIdForModal}
        onOpenTransfer={handlePopupOpenTransfer}
        onViewAllTransactions={handlePopupViewAllTransactions}
      />
    </div>
  );
};
