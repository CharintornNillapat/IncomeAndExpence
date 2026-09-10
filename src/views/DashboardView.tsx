import React, { useState, useMemo, useCallback } from 'react';
import { motion, Variants } from 'framer-motion';
import { useFinance } from '../context/FinanceContext';
import { useWallets } from '../hooks/useWallets';
import { useDebts } from '../hooks/useDebts';
import { TransactionForm } from '../components/TransactionForm';
import { WalletPopupModal, WalletModalTab } from '../components/WalletPopupModal';
import { TotalWealthHero } from '../components/dashboard/TotalWealthHero';
import { WalletAccountsGrid } from '../components/dashboard/WalletAccountsGrid';
import { CashflowMetricsCards } from '../components/dashboard/CashflowMetricsCards';
import { CategoryExpenseDistribution } from '../components/dashboard/CategoryExpenseDistribution';
import { DebtPayoffOverview } from '../components/dashboard/DebtPayoffOverview';
import { RecentTransactionsTable } from '../components/dashboard/RecentTransactionsTable';
import { APP_CURRENCY_SYMBOL } from '../utils/currency';
import { todayIsoDate } from '../utils/date';

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
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { transactions, categories, addTransaction } = useFinance();
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

  const handleOpenTransfer = useCallback(() => {
    openWalletModal('TRANSFER');
  }, [openWalletModal]);

  const handleOpenAddWallet = useCallback(() => {
    openWalletModal('ADD_WALLET');
  }, [openWalletModal]);

  const handleOpenManageWallets = useCallback(() => {
    openWalletModal('OVERVIEW');
  }, [openWalletModal]);

  // Filter transactions based on time breakdown (Memoized)
  const filteredTransactions = useMemo(() => {
    const activeTxs = transactions.filter((t) => !t.isDeleted);
    const now = new Date();

    if (timeFilter === 'ALL') return activeTxs;

    return activeTxs.filter((tx) => {
      const txDate = new Date(tx.transactionDate);
      if (timeFilter === 'DAY') {
        return tx.transactionDate === todayIsoDate();
      }
      if (timeFilter === 'WEEK') {
        const weekAgo = new Date(now.getTime() - 7 * 86400000);
        return txDate >= weekAgo;
      }
      if (timeFilter === 'MONTH') {
        const monthAgo = new Date(now.getTime() - 30 * 86400000);
        return txDate >= monthAgo;
      }
      return true;
    });
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
    const catMap = new Map<string, typeof categories[0]>(categories.map((c) => [c.id, c]));
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
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
      .slice(0, 5);
  }, [transactions]);

  const walletMap = useMemo(() => {
    return new Map(allWallets.map((w) => [w.id, w]));
  }, [allWallets]);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  // Form submit callback stabilized with useCallback
  const handleTransactionSubmit = useCallback((data: {
    amount: number;
    rawInput?: string;
    description: string;
    walletId: string;
    destinationWalletId?: string;
    categoryId?: string;
    debtId?: string;
    type: any;
    date: string;
    idempotencyKey?: string;
  }) => {
    return addTransaction({
      ...data,
      transactionDate: data.date,
    });
  }, [addTransaction]);

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
          onOpenTransfer={handleOpenTransfer}
          onOpenAddWallet={handleOpenAddWallet}
          onOpenManageWallets={handleOpenManageWallets}
        />
      </motion.section>

      {/* 2. All User Wallets & Accounts Grid */}
      <motion.section variants={itemVariants} aria-label="User Wallets & Accounts">
        <WalletAccountsGrid
          wallets={activeWallets}
          totalNetWorth={totalNetWorth}
          onOpenWalletModal={openWalletModal}
        />
      </motion.section>

      {/* 3. Financial Performance & Timeframe Breakdown */}
      <motion.section variants={itemVariants} aria-label="Performance Breakdown" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs transition-colors">
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-white">Periodic Cashflow & Outflow Analysis</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Filter cashflow by day, week, month, or all-time records
            </p>
          </div>

          {/* Time Filter Controls */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-1 rounded-xl gap-1 self-start sm:self-auto border border-stone-200 dark:border-stone-700">
            {(['DAY', 'WEEK', 'MONTH', 'ALL'] as TimeFilter[]).map((f) => (
              <motion.button
                whileTap={{ scale: 0.95 }}
                key={f}
                id={`time-filter-${f.toLowerCase()}`}
                type="button"
                onClick={() => setTimeFilter(f)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  timeFilter === f
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                {f === 'DAY' ? 'Today' : f === 'WEEK' ? 'This Week' : f === 'MONTH' ? 'Past 30 Days' : 'All Time'}
              </motion.button>
            ))}
          </div>
        </div>

        {/* 3 Prominent Hero Metric Cards */}
        <CashflowMetricsCards
          incomeTotal={incomeTotal}
          expenseTotal={expenseTotal}
          netBalance={netBalance}
          primarySymbol={APP_CURRENCY_SYMBOL}
        />
      </motion.section>

      {/* 4. Main Action & Breakdown Section: Add Transaction + Category & Debt Progress */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Direct Add Transaction Form (lg:col-span-6) */}
        <div className="lg:col-span-6">
          <TransactionForm
            wallets={activeWallets}
            categories={categories.filter((c) => !c.isDeleted)}
            onSubmitTransaction={handleTransactionSubmit}
          />
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
      />
    </motion.div>
  );
};
