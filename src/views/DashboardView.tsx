import React, { useState, useMemo, useCallback } from 'react';
import { useFinanceState } from '../context/FinanceContext';
import { Transaction } from '../types';
import { useWallets } from '../hooks/useWallets';
import { useDebts } from '../hooks/useDebts';
import { WalletPopupModal, WalletModalTab } from '../components/WalletPopupModal';
import { TotalWealthHero } from '../components/dashboard/TotalWealthHero';
import { WalletAccountsGrid } from '../components/dashboard/WalletAccountsGrid';
import { CashflowMetricsCards } from '../components/dashboard/CashflowMetricsCards';
import { CategoryExpenseDistribution } from '../components/dashboard/CategoryExpenseDistribution';
import { DebtPayoffOverview } from '../components/dashboard/DebtPayoffOverview';
import { RecentTransactionsTable } from '../components/dashboard/RecentTransactionsTable';
import { SectionHeader } from '../components/ui/SectionHeader';
import { SpendingInsightsCard } from '../components/dashboard/SpendingInsightsCard';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { todayIsoDate } from '../utils/date';
import { buildLookupMap } from '../utils/mapUtils';
import { roundToCents } from '../utils/money';
import { filterByRange, TimeRange } from '../selectors/timeRange';
import { spendingByCategory, sumIncome, sumSpending } from '../selectors/ledger';

export type TimeFilter = TimeRange;

interface DashboardViewProps {
  onNavigate?: (tab: string) => void;
  /** Opens the shared, shell-level TransferFundsModal (owned by App.tsx), optionally seeded to a wallet (T41). */
  onOpenTransfer?: (walletId?: string) => void;
  /** Opens the shared, shell-level AddWalletModal (owned by App.tsx, T41). */
  onOpenAddWallet?: () => void;
  /** Navigates to TransactionsView pre-filtered by a wallet (T40 handoff from the wallet popup's Activity preview). */
  onOpenWalletTransactions?: (walletId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenTransfer,
  onOpenAddWallet,
  onOpenWalletTransactions,
}) => {
  const { transactions, categories, currentUser } = useFinanceState();
  // `wallets` here is already the active (non-deleted) set; `allWallets` still
  // includes soft-deleted ones so historic rows can resolve their wallet name.
  const { wallets: activeWallets, allWallets, totalNetWorth } = useWallets();
  const { metrics: debtSummary } = useDebts();
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

  // T41: Transfer and Add Wallet no longer open tabs inside this view's own
  // WalletPopupModal (T39 retired those tabs) - they open the shared,
  // shell-level TransferFundsModal/AddWalletModal that App.tsx owns, so the
  // exact same modal (and ids) is reachable from WalletsView too.
  const handleHeroOpenTransfer = useCallback(() => {
    onOpenTransfer?.();
  }, [onOpenTransfer]);

  const handleHeroOpenAddWallet = useCallback(() => {
    onOpenAddWallet?.();
  }, [onOpenAddWallet]);

  const handleOpenManageWallets = useCallback(() => {
    openWalletModal('OVERVIEW');
  }, [openWalletModal]);

  const handleWalletCardOpen = useCallback(
    (walletId: string) => openWalletModal('OVERVIEW', walletId),
    [openWalletModal]
  );

  const handleGridOpenTransfer = useCallback(
    (walletId: string) => onOpenTransfer?.(walletId),
    [onOpenTransfer]
  );

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

  const walletMap = useMemo(() => buildLookupMap(allWallets), [allWallets]);

  const categoryMap = useMemo(() => buildLookupMap(categories), [categories]);

  // Spec L1 and L2 through the shared selectors (ADR 0028). The range is
  // today's `TimeRange` with the same boundaries as before (WEEK from today - 7,
  // MONTH from today - 30); `isSpending` is EXPENSE only. The category chart
  // used to add debt repayments on top and group by name, so its total and the
  // Expense card disagreed; both are `sumSpending`'s figure now.
  const filteredTransactions = useMemo(
    () => filterByRange(transactions, timeFilter, todayIsoDate()),
    [transactions, timeFilter]
  );

  const incomeTotal = useMemo(() => sumIncome(filteredTransactions, categoryMap), [filteredTransactions, categoryMap]);

  const expenseTotal = useMemo(() => sumSpending(filteredTransactions, categoryMap), [filteredTransactions, categoryMap]);

  const netBalance = useMemo(() => roundToCents(incomeTotal - expenseTotal), [incomeTotal, expenseTotal]);

  const categoryBreakdown = useMemo(
    () => spendingByCategory(filteredTransactions, categoryMap),
    [filteredTransactions, categoryMap]
  );

  // Compact Recent 5 Transactions for Dashboard Preview (Memoized). A single
  // linear pass keeping a running top-5 (by `transactionDate`, newest first)
  // instead of sorting the entire ledger just to keep 5 rows of it - O(n)
  // instead of O(n log n), and the only per-transaction work is a handful of
  // string comparisons against an at-most-5-element buffer.
  const recentTransactions = useMemo(() => {
    // Ascending by date while filling; index 0 is always the oldest (and
    // therefore first to be evicted) of the currently-held top 5.
    const top: Transaction[] = [];

    for (const t of transactions) {
      if (t.isDeleted) continue;

      if (top.length < 5) {
        let i = top.length - 1;
        while (i >= 0 && top[i].transactionDate > t.transactionDate) i--;
        top.splice(i + 1, 0, t);
      } else if (t.transactionDate > top[0].transactionDate) {
        top.shift();
        let i = top.length - 1;
        while (i >= 0 && top[i].transactionDate > t.transactionDate) i--;
        top.splice(i + 1, 0, t);
      }
    }

    return top.reverse();
  }, [transactions]);

  return (
    <div className="space-y-8">
      {/* 1. Total Wealth & Complete Net Worth Hero Section */}
      <section aria-label="Total Wealth & Net Worth">
        <TotalWealthHero
          totalNetWorth={totalNetWorth}
          activeWalletCount={activeWallets.length}
          onOpenTransfer={handleHeroOpenTransfer}
          onOpenAddWallet={handleHeroOpenAddWallet}
          onOpenManageWallets={handleOpenManageWallets}
        />
      </section>

      {/* 2. All User Wallets & Accounts Grid */}
      <section aria-label="User Wallets & Accounts">
        <WalletAccountsGrid
          wallets={activeWallets}
          totalNetWorth={totalNetWorth}
          onOpenWallet={handleWalletCardOpen}
          onOpenTransfer={handleGridOpenTransfer}
        />
      </section>

      {/* 3. Financial Performance & Timeframe Breakdown */}
      <section aria-label="Performance Breakdown" className="space-y-4">
        <SectionHeader
          className="transition-colors"
          title="Income and spending by period"
          subtitle="Filter cashflow by day, week, month, or all-time records"
          action={
            <SegmentedControl<TimeFilter>
              className="flex items-center self-start sm:self-auto"
              size="sm"
              ariaLabel="Period"
              value={timeFilter}
              onChange={setTimeFilter}
              options={(['DAY', 'WEEK', 'MONTH', 'ALL'] as TimeFilter[]).map((f) => ({
                value: f,
                id: `time-filter-${f.toLowerCase()}`,
                label: f === 'DAY' ? 'Today' : f === 'WEEK' ? 'This Week' : f === 'MONTH' ? 'Past 30 Days' : 'All Time',
              }))}
            />
          }
        />

        {/* 3 Prominent Hero Metric Cards */}
        <CashflowMetricsCards
          incomeTotal={incomeTotal}
          expenseTotal={expenseTotal}
          netBalance={netBalance}
        />
      </section>

      {/* 4. Category & Debt Progress Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        <CategoryExpenseDistribution
          categoryBreakdown={categoryBreakdown}
          totalExpenseAmount={expenseTotal}
        />

        <DebtPayoffOverview
          activeDebtCount={debtSummary.activeCount}
          debtProgressPercent={debtSummary.progressPercent}
          remainingDebtTarget={debtSummary.remainingTarget}
          paidDebtTarget={debtSummary.paidTarget}
        />
      </div>

      {/* 4b. The monthly wrap-up (ADR 0020). Sits under the distribution it
             talks about, and owns its own fetching - this view stays unaware
             that a network call exists. */}
      <section aria-label="Monthly Spending Insights">
        <SpendingInsightsCard
          transactions={transactions}
          categories={categories}
          userId={currentUser.id}
        />
      </section>

      {/* 5. Compact Recent 5 Transactions List with View All Button */}
      <section aria-label="Recent Transactions">
        <RecentTransactionsTable
          transactions={recentTransactions}
          walletMap={walletMap}
          categoryMap={categoryMap}
          onNavigate={onNavigate}
        />
      </section>

      {/* Wallet Management & Transfer Pop-up Modal */}
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
