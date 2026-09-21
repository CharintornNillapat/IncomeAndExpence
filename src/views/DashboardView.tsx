import React, { useState, useMemo, useCallback } from 'react';
import { motion, Variants } from 'framer-motion';
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
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { todayIsoDate, daysAgoIsoDate } from '../utils/date';
import { buildLookupMap } from '../utils/mapUtils';

export type TimeFilter = 'DAY' | 'WEEK' | 'MONTH' | 'ALL';

// Stagger animation container & item variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 24,
      stiffness: 300,
    },
  },
};

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
  const { transactions, categories } = useFinanceState();
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

  // Filter transactions based on time breakdown (Memoized). `transactionDate`
  // is a local-calendar `YYYY-MM-DD` string, so every cutoff is computed once,
  // outside the per-transaction predicate, as the same kind of string
  // (`todayIsoDate()`/`daysAgoIsoDate()`) and compared with plain string
  // operators - never `new Date(tx.transactionDate)`. Parsing a bare date
  // string constructs UTC midnight, which at UTC+7 sits 7 hours after local
  // midnight and would misclassify transactions filed near the local-day
  // boundary. Lexicographic comparison on same-format ISO strings matches
  // chronological order exactly, with no timezone parsing involved.
  const filteredTransactions = useMemo(() => {
    const activeTxs = transactions.filter((t) => !t.isDeleted);

    if (timeFilter === 'ALL') return activeTxs;

    if (timeFilter === 'DAY') {
      const todayIso = todayIsoDate();
      return activeTxs.filter((tx) => tx.transactionDate === todayIso);
    }

    const cutoffIso = daysAgoIsoDate(timeFilter === 'WEEK' ? 7 : 30);
    return activeTxs.filter((tx) => tx.transactionDate >= cutoffIso);
  }, [transactions, timeFilter]);

  // Aggregate Metrics for Selected Timeframe (Memoized)
  const incomeTotal = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const expenseTotal = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const debtRepaymentTotal = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'DEBT_REPAYMENT')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const netBalance = useMemo(() => {
    return incomeTotal - expenseTotal;
  }, [incomeTotal, expenseTotal]);

  const walletMap = useMemo(() => buildLookupMap(allWallets), [allWallets]);

  const categoryMap = useMemo(() => buildLookupMap(categories), [categories]);

  // Category Expense Distribution (Memoized). Reuses `categoryMap` above
  // instead of building a second, identical id->Category lookup over the
  // same `categories` array.
  const categoryBreakdown = useMemo(() => {
    const expenseMap: Record<string, { name: string; amount: number; color: string }> = {};

    filteredTransactions
      .filter((t) => t.type === 'EXPENSE' || t.type === 'DEBT_REPAYMENT')
      .forEach((tx) => {
        const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
        const name = cat ? cat.name : 'Uncategorized';
        const color = cat?.color || '#94a3b8';
        if (!expenseMap[name]) {
          expenseMap[name] = { name, amount: 0, color };
        }
        expenseMap[name].amount += tx.amount;
      });

    return Object.values(expenseMap).sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions, categoryMap]);

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
    <motion.div 
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* 1. Total Wealth & Complete Net Worth Hero Section */}
      <motion.section variants={itemVariants} aria-label="Total Wealth & Net Worth">
        <TotalWealthHero
          totalNetWorth={totalNetWorth}
          activeWalletCount={activeWallets.length}
          onOpenTransfer={handleHeroOpenTransfer}
          onOpenAddWallet={handleHeroOpenAddWallet}
          onOpenManageWallets={handleOpenManageWallets}
        />
      </motion.section>

      {/* 2. All User Wallets & Accounts Grid */}
      <motion.section variants={itemVariants} aria-label="User Wallets & Accounts">
        <WalletAccountsGrid
          wallets={activeWallets}
          totalNetWorth={totalNetWorth}
          onOpenWallet={handleWalletCardOpen}
          onOpenTransfer={handleGridOpenTransfer}
        />
      </motion.section>

      {/* 3. Financial Performance & Timeframe Breakdown */}
      <motion.section variants={itemVariants} aria-label="Performance Breakdown" className="space-y-4">
        <SectionHeader
          className="transition-colors"
          title="Periodic Cashflow & Outflow Analysis"
          subtitle="Filter cashflow by day, week, month, or all-time records"
          action={
            <SegmentedControl<TimeFilter>
              className="flex items-center self-start sm:self-auto"
              size="sm"
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
      </motion.section>

      {/* 4. Category & Debt Progress Breakdown */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        <CategoryExpenseDistribution
          categoryBreakdown={categoryBreakdown}
          totalExpenseAmount={expenseTotal + debtRepaymentTotal}
        />

        <DebtPayoffOverview
          activeDebtCount={debtSummary.activeCount}
          debtProgressPercent={debtSummary.progressPercent}
          remainingDebtTarget={debtSummary.remainingTarget}
          paidDebtTarget={debtSummary.paidTarget}
        />
      </motion.div>

      {/* 5. Compact Recent 5 Transactions List with View All Button */}
      <motion.section variants={itemVariants} aria-label="Recent Transactions">
        <RecentTransactionsTable
          transactions={recentTransactions}
          walletMap={walletMap}
          categoryMap={categoryMap}
          onNavigate={onNavigate}
        />
      </motion.section>

      {/* Wallet Management & Transfer Pop-up Modal */}
      <WalletPopupModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        initialTab={walletModalTab}
        initialWalletId={selectedWalletIdForModal}
        onOpenTransfer={handlePopupOpenTransfer}
        onViewAllTransactions={handlePopupViewAllTransactions}
      />
    </motion.div>
  );
};
