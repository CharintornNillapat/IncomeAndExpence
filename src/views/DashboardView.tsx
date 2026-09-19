import React, { useState, useMemo, useCallback } from 'react';
import { motion, Variants } from 'framer-motion';
import { PlusCircle } from 'lucide-react';
import { useFinanceState } from '../context/FinanceContext';
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
import { PRIMARY_BUTTON_CLASS } from '../utils/formStyles';

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
  /** Opens the shared Quick Add modal (owned by App.tsx) - retired the inline TransactionForm this view used to render directly (T37). */
  onOpenQuickAdd?: () => void;
  /** Opens the shared, shell-level TransferFundsModal (owned by App.tsx), optionally seeded to a wallet (T41). */
  onOpenTransfer?: (walletId?: string) => void;
  /** Opens the shared, shell-level AddWalletModal (owned by App.tsx, T41). */
  onOpenAddWallet?: () => void;
  /** Navigates to TransactionsView pre-filtered by a wallet (T40 handoff from the wallet popup's Activity preview). */
  onOpenWalletTransactions?: (walletId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenQuickAdd,
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

  // Category Expense Distribution (Memoized)
  const categoryBreakdown = useMemo(() => {
    const catMap = buildLookupMap(categories);
    const expenseMap: Record<string, { name: string; amount: number; color: string }> = {};

    filteredTransactions
      .filter((t) => t.type === 'EXPENSE' || t.type === 'DEBT_REPAYMENT')
      .forEach((tx) => {
        const cat = tx.categoryId ? catMap.get(tx.categoryId) : undefined;
        const name = cat ? cat.name : 'Uncategorized';
        const color = cat?.color || '#94a3b8';
        if (!expenseMap[name]) {
          expenseMap[name] = { name, amount: 0, color };
        }
        expenseMap[name].amount += tx.amount;
      });

    return Object.values(expenseMap).sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions, categories]);

  // Compact Recent 5 Transactions for Dashboard Preview (Memoized)
  const recentTransactions = useMemo(() => {
    return transactions
      .filter((t) => !t.isDeleted)
      // Newest first. `transactionDate` strings compare chronologically as
      // plain strings (see `filteredTransactions` above) - no `new Date(...)`
      // parsing needed for a same-format ISO date sort.
      .sort((a, b) => (b.transactionDate > a.transactionDate ? 1 : b.transactionDate < a.transactionDate ? -1 : 0))
      .slice(0, 5);
  }, [transactions]);

  const walletMap = useMemo(() => buildLookupMap(allWallets), [allWallets]);

  const categoryMap = useMemo(() => buildLookupMap(categories), [categories]);

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

      {/* 4. Main Action & Breakdown Section: Add Transaction + Category & Debt Progress */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Quick Add Entry Point (lg:col-span-6) */}
        <div className="lg:col-span-6">
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs p-8">
            <div className="w-14 h-14 rounded-2xl bg-stone-900 dark:bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <PlusCircle className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-white">Record a Transaction</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-xs">
                Log an expense, income, transfer, or debt payment in a few seconds.
              </p>
            </div>
            <div className="w-full max-w-[220px]">
              <button
                id="dash-open-add-modal-btn"
                type="button"
                onClick={onOpenQuickAdd}
                className={`${PRIMARY_BUTTON_CLASS} flex items-center justify-center gap-2`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Transaction</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Category Breakdown + Debt Progress (lg:col-span-6) */}
        <div className="lg:col-span-6 space-y-6">
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
        </div>
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
