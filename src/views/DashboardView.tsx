import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownLeft,
  Wallet as WalletIcon,
  ArrowLeftRight,
  Plus,
  Landmark,
  Banknote,
  PiggyBank,
  Coins,
  Layers,
  ChevronRight,
  Search,
  Calendar,
  DollarSign,
  ArrowRight,
  Filter,
  Receipt,
  CheckCircle2,
  Clock,
  Sparkles,
  Globe
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { TransactionForm } from '../components/TransactionForm';
import { WalletPopupModal, WalletModalTab } from '../components/WalletPopupModal';
import { WalletType, TransactionType } from '../types';
import { getWalletsCurrencyBreakdown, getCurrencySymbol } from '../utils/currency';

export type TimeFilter = 'DAY' | 'WEEK' | 'MONTH' | 'ALL';

interface DashboardViewProps {
  onNavigate?: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { transactions, wallets, debts, categories, totalNetWorth, addTransaction } = useFinance();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('MONTH');
  
  // Wallet Popup Modal State in Dashboard
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [walletModalTab, setWalletModalTab] = useState<WalletModalTab>('OVERVIEW');
  const [selectedWalletIdForModal, setSelectedWalletIdForModal] = useState<string | undefined>(undefined);

  const openWalletModal = (tab: WalletModalTab = 'OVERVIEW', walletId?: string) => {
    setWalletModalTab(tab);
    setSelectedWalletIdForModal(walletId);
    setIsWalletModalOpen(true);
  };

  const activeWallets = useMemo(() => wallets.filter((w) => !w.isDeleted), [wallets]);

  const currencyBreakdown = useMemo(() => {
    return getWalletsCurrencyBreakdown(activeWallets);
  }, [activeWallets]);

  const getWalletIcon = (type: WalletType) => {
    switch (type) {
      case 'BANK_ACCOUNT': return Landmark;
      case 'CASH': return Banknote;
      case 'SAVINGS': return PiggyBank;
      case 'CREDIT_CARD': return CreditCard;
      default: return Coins;
    }
  };

  // Filter transactions based on time breakdown
  const filteredTransactions = useMemo(() => {
    const activeTxs = transactions.filter((t) => !t.isDeleted);
    const now = new Date();

    if (timeFilter === 'ALL') return activeTxs;

    return activeTxs.filter((tx) => {
      const txDate = new Date(tx.transactionDate);
      if (timeFilter === 'DAY') {
        return tx.transactionDate === now.toISOString().slice(0, 10);
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

  // Aggregate Metrics for Selected Timeframe
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

  const netBalance = incomeTotal - expenseTotal;
  const netSavings = incomeTotal - expenseTotal - debtRepaymentTotal;
  const savingsRate = incomeTotal > 0 ? Math.max(0, (netSavings / incomeTotal) * 100) : 0;

  // Category Expense Distribution
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

  // Overall Debt Summary
  const totalDebtTarget = debts.reduce((sum, d) => sum + d.totalAmount, 0);
  const remainingDebtTarget = debts.reduce((sum, d) => sum + d.remainingAmount, 0);
  const paidDebtTarget = totalDebtTarget - remainingDebtTarget;
  const debtProgressPercent = totalDebtTarget > 0 ? (paidDebtTarget / totalDebtTarget) * 100 : 0;

  // Total Money & Wealth Aggregations across all wallets
  const liquidCashAndBank = useMemo(() => {
    return activeWallets
      .filter((w) => w.type === 'BANK_ACCOUNT' || w.type === 'CASH' || w.type === 'E_WALLET')
      .reduce((sum, w) => sum + Number(w.balance || 0), 0);
  }, [activeWallets]);

  const savingsAndInvestments = useMemo(() => {
    return activeWallets
      .filter((w) => w.type === 'SAVINGS' || w.type === 'INVESTMENT')
      .reduce((sum, w) => sum + Number(w.balance || 0), 0);
  }, [activeWallets]);

  const creditAndLiabilities = useMemo(() => {
    const creditBalances = activeWallets
      .filter((w) => w.type === 'CREDIT_CARD')
      .reduce((sum, w) => sum + Number(w.balance || 0), 0);
    return creditBalances + remainingDebtTarget;
  }, [activeWallets, remainingDebtTarget]);

  // Compact Recent 5 Transactions for Dashboard Preview
  const recentTransactions = useMemo(() => {
    return transactions
      .filter((t) => !t.isDeleted)
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
      .slice(0, 5);
  }, [transactions]);

  const walletMap = useMemo(() => {
    return new Map(wallets.map((w) => [w.id, w]));
  }, [wallets]);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  return (
    <div className="space-y-8">
      {/* 1. High-Visibility Total Money & Complete Net Worth Hero Section */}
      <section aria-label="Total Wealth & Net Worth" className="space-y-4">
        <div className="bg-stone-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-800 relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                  Total Money Across All Wallets
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {activeWallets.length} Accounts Active
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black font-mono tracking-tight text-white">
                    {currencyBreakdown.primarySymbol}
                    {currencyBreakdown.primaryTotal.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </h1>
                  <span className="text-sm sm:text-base font-semibold font-mono text-emerald-400">
                    {currencyBreakdown.primaryCurrency} Total Balance
                  </span>
                </div>

                {!currencyBreakdown.isSingleCurrency && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-[11px] text-stone-400 font-medium">Currency Breakdown:</span>
                    {currencyBreakdown.groups.map((group) => (
                      <span
                        key={group.currency}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-800 border border-stone-700 text-xs font-mono font-bold text-stone-200"
                      >
                        <span className="text-emerald-400">{group.symbol}</span>
                        <span>{group.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="text-[10px] text-stone-400 font-sans">{group.currency} ({group.count})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs sm:text-sm text-stone-400 max-w-xl">
                Cumulative liquid capital, bank balances, reserve savings, and investment assets across all registered accounts.
              </p>
            </div>

            {/* Quick Actions in Hero */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                id="hero-transfer-funds-btn"
                type="button"
                onClick={() => openWalletModal('TRANSFER')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-stone-900 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <ArrowLeftRight className="w-4 h-4 text-stone-950" />
                <span>Transfer Funds</span>
              </button>

              <button
                id="hero-add-wallet-btn"
                type="button"
                onClick={() => openWalletModal('ADD_WALLET')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Add Wallet</span>
              </button>

              <button
                id="hero-manage-all-wallets-btn"
                type="button"
                onClick={() => openWalletModal('OVERVIEW')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-stone-300 hover:text-white bg-stone-800/80 hover:bg-stone-700 border border-stone-700 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>Manage All</span>
              </button>
            </div>
          </div>

          {/* 3-Pillar Asset Distribution Sub-Bar */}
          <div className="mt-8 pt-6 border-t border-stone-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-stone-800/60 p-4 rounded-2xl border border-stone-700/50">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span className="flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-emerald-400" /> Liquid Cash & Banks
                </span>
                <span className="font-mono text-stone-300">
                  {totalNetWorth > 0 ? `${((liquidCashAndBank / totalNetWorth) * 100).toFixed(0)}%` : '0%'}
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-white mt-1">
                {currencyBreakdown.primarySymbol}{liquidCashAndBank.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-stone-800/60 p-4 rounded-2xl border border-stone-700/50">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span className="flex items-center gap-1.5">
                  <PiggyBank className="w-3.5 h-3.5 text-indigo-400" /> Savings & Investments
                </span>
                <span className="font-mono text-stone-300">
                  {totalNetWorth > 0 ? `${((savingsAndInvestments / totalNetWorth) * 100).toFixed(0)}%` : '0%'}
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-white mt-1">
                {currencyBreakdown.primarySymbol}{savingsAndInvestments.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-stone-800/60 p-4 rounded-2xl border border-stone-700/50">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-rose-400" /> Debt & Outstanding Liabilities
                </span>
                <span className="font-mono text-rose-400">Target</span>
              </div>
              <p className="text-xl font-bold font-mono text-rose-300 mt-1">
                {currencyBreakdown.primarySymbol}{creditAndLiabilities.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. All User Wallets & Accounts Grid */}
      <section aria-label="User Wallets & Accounts" className="space-y-4">
        <div className="flex items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-xs">
              <WalletIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900">Your Wallets & Accounts</h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {activeWallets.length} Accounts
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Balances across checking, cash, savings, and credit lines
              </p>
            </div>
          </div>
        </div>

        {/* Wallets Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeWallets.map((wallet) => {
            const Icon = getWalletIcon(wallet.type);
            const percentOfNetWorth = totalNetWorth > 0 ? (wallet.balance / totalNetWorth) * 100 : 0;

            return (
              <div
                key={wallet.id}
                id={`dashboard-wallet-card-${wallet.id}`}
                onClick={() => openWalletModal('OVERVIEW', wallet.id)}
                className="group bg-white rounded-2xl border border-stone-200 hover:border-stone-400 p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
              >
                {/* Top Accent bar based on wallet color */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: wallet.color }}
                />

                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                        style={{ backgroundColor: wallet.color }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-stone-800 line-clamp-1">
                          {wallet.name}
                        </h3>
                        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                          {wallet.type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="p-1 rounded-lg text-stone-300 group-hover:text-stone-700 group-hover:bg-stone-100 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                      Balance
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                        wallet.balance < 0 ? 'text-rose-600' : 'text-stone-900'
                      }`}>
                        {getCurrencySymbol(wallet.currency)}{wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[11px] font-semibold font-mono text-stone-400">{wallet.currency}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100">
                  <div className="flex items-center justify-between text-[10px] text-stone-500 mb-1.5">
                    <span>Share of Total</span>
                    <span className="font-mono font-bold text-stone-700">
                      {percentOfNetWorth > 0 ? `${percentOfNetWorth.toFixed(1)}%` : '0%'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, Math.max(0, percentOfNetWorth))}%`,
                        backgroundColor: wallet.color 
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 text-[11px]">
                    <span className="text-stone-400 text-[10px]">Click to inspect</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openWalletModal('TRANSFER', wallet.id);
                      }}
                      className="inline-flex items-center gap-1 text-indigo-600 font-semibold hover:underline"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span>Transfer</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Financial Performance & Timeframe Breakdown */}
      <section aria-label="Performance Breakdown" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div>
            <h2 className="text-base font-bold text-stone-900">Periodic Cashflow & Outflow Analysis</h2>
            <p className="text-xs text-stone-500">
              Filter cashflow by day, week, month, or all-time records
            </p>
          </div>

          {/* Time Filter Controls */}
          <div className="flex items-center bg-stone-100 p-1 rounded-xl gap-1 self-start sm:self-auto border border-stone-200">
            {(['DAY', 'WEEK', 'MONTH', 'ALL'] as TimeFilter[]).map((f) => (
              <button
                key={f}
                id={`time-filter-${f.toLowerCase()}`}
                type="button"
                onClick={() => setTimeFilter(f)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  timeFilter === f
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {f === 'DAY' ? 'Today' : f === 'WEEK' ? 'This Week' : f === 'MONTH' ? 'Past 30 Days' : 'All Time'}
              </button>
            ))}
          </div>
        </div>

        {/* 3 Prominent Hero Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. Total Income Card */}
          <div className="bg-white rounded-2xl border-2 border-emerald-200/80 p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Total Income
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
              </div>
            </div>
            <div className="mt-5">
              <p className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-emerald-600">
                {currencyBreakdown.primarySymbol}{incomeTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center justify-between mt-3 text-xs">
                <span className="text-stone-500 font-medium">Inflows across active accounts</span>
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  + Inflow
                </span>
              </div>
            </div>
          </div>

          {/* 2. Total Expense Card */}
          <div className="bg-white rounded-2xl border-2 border-rose-200/80 p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                Total Expense
              </span>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
              </div>
            </div>
            <div className="mt-5">
              <p className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-rose-600">
                {currencyBreakdown.primarySymbol}{expenseTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center justify-between mt-3 text-xs">
                <span className="text-stone-500 font-medium">Outflows & regular expenses</span>
                <span className="text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                  − Outflow
                </span>
              </div>
            </div>
          </div>

          {/* 3. Net Balance Card (Income - Expense) */}
          <div className={`bg-white rounded-2xl border-2 p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between ${
            netBalance >= 0 ? 'border-emerald-300' : 'border-rose-300'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
                netBalance >= 0 ? 'text-emerald-800' : 'text-rose-800'
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${netBalance >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                Net Balance
              </span>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                netBalance >= 0 
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                  : 'bg-rose-50 text-rose-600 border-rose-100'
              }`}>
                {netBalance >= 0 ? (
                  <TrendingUp className="w-5 h-5 stroke-[2.5]" />
                ) : (
                  <TrendingDown className="w-5 h-5 stroke-[2.5]" />
                )}
              </div>
            </div>
            <div className="mt-5">
              <p className={`text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight ${
                netBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}>
                {netBalance < 0 ? '-' : ''}{currencyBreakdown.primarySymbol}{Math.abs(netBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center justify-between mt-3 text-xs">
                <span className="text-stone-500 font-medium">
                  {netBalance >= 0 ? 'Net positive surplus' : 'Net deficit'}
                </span>
                <span className={`font-semibold px-2 py-0.5 rounded-md border ${
                  netBalance >= 0 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                    : 'bg-rose-50 text-rose-700 border-rose-100'
                }`}>
                  Income − Expense
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Main Action & Breakdown Section: Add Transaction + Category & Debt Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Direct Add Transaction Form (lg:col-span-6) */}
        <div className="lg:col-span-6">
          <TransactionForm
            wallets={wallets.filter((w) => !w.isDeleted)}
            categories={categories.filter((c) => !c.isDeleted)}
            onSubmitTransaction={(data) => {
              addTransaction({
                ...data,
                transactionDate: data.date,
              });
            }}
          />
        </div>

        {/* Right Column: Category Breakdown + Debt Progress (lg:col-span-6) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Category Breakdown */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-stone-600" />
                <h3 className="text-sm font-bold text-stone-900">Expense Category Distribution</h3>
              </div>
              <span className="text-xs text-stone-400 font-mono">
                Total: {currencyBreakdown.primarySymbol}{(expenseTotal + debtRepaymentTotal).toFixed(2)}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {categoryBreakdown.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-8">No expense records in this timeframe.</p>
              ) : (
                categoryBreakdown.map((item) => {
                  const totalExp = expenseTotal + debtRepaymentTotal;
                  const percent = totalExp > 0 ? (item.amount / totalExp) * 100 : 0;
                  return (
                    <div key={item.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-800">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-stone-500">{percent.toFixed(1)}%</span>
                          <span className="font-mono font-bold text-stone-900">
                            {currencyBreakdown.primarySymbol}{item.amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Debt Payoff Progress Overview */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-rose-600" />
                  <h3 className="text-sm font-bold text-stone-900">Total Debt Payoff Target</h3>
                </div>
                <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                  {debts.filter((d) => !d.isSettled && !d.isDeleted).length} Active
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stone-500">Payoff Progress:</span>
                    <span className="font-mono font-bold text-stone-900">{debtProgressPercent.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, debtProgressPercent)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <span className="text-[11px] text-stone-500 block">Remaining Balance</span>
                    <span className="text-base font-bold font-mono text-rose-600">
                      {currencyBreakdown.primarySymbol}{remainingDebtTarget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <span className="text-[11px] text-stone-500 block">Total Principal Paid</span>
                    <span className="text-base font-bold font-mono text-emerald-600">
                      {currencyBreakdown.primarySymbol}{paidDebtTarget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-stone-400 mt-6 pt-4 border-t border-stone-100">
              Payments automatically update your wallet balance and reduce what you owe.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Compact Recent 5 Transactions List with View All Button */}
      <section aria-label="Recent Transactions" className="space-y-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-base font-bold text-stone-900">Recent Transactions</h2>
                <p className="text-xs text-stone-500">Your latest 5 financial activities</p>
              </div>
            </div>

            <button
              id="dashboard-view-all-transactions-btn"
              type="button"
              onClick={() => onNavigate?.('transactions')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-all cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
            </button>
          </div>

          {/* Compact Transactions Table */}
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Wallet</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-stone-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Receipt className="w-8 h-8 text-stone-300" />
                        <p className="text-xs font-semibold text-stone-600">No transactions recorded yet</p>
                        <p className="text-[11px] text-stone-400">
                          Use the form above to record your first transaction.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((tx) => {
                    const category = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
                    const wallet = tx.walletId ? walletMap.get(tx.walletId) : undefined;
                    const toWallet = tx.toWalletId ? walletMap.get(tx.toWalletId) : undefined;

                    return (
                      <tr key={tx.id} className="hover:bg-stone-50/80 transition-colors">
                        {/* Date */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-stone-700">
                          {new Date(tx.transactionDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>

                        {/* Description */}
                        <td className="py-3 px-4">
                          <p className="font-bold text-stone-900 line-clamp-1">{tx.description}</p>
                          {tx.note && (
                            <p className="text-[11px] text-stone-500 line-clamp-1">{tx.note}</p>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {category ? (
                            <span 
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold"
                              style={{ 
                                backgroundColor: `${category.color}15`,
                                color: category.color,
                                border: `1px solid ${category.color}30` 
                              }}
                            >
                              <span 
                                className="w-1.5 h-1.5 rounded-full" 
                                style={{ backgroundColor: category.color }}
                              />
                              {category.name}
                            </span>
                          ) : (
                            <span className="text-stone-400 text-[11px] italic">Uncategorized</span>
                          )}
                        </td>

                        {/* Wallet */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {tx.type === 'TRANSFER' ? (
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-stone-700">
                              <span>{wallet?.name || 'Source'}</span>
                              <ArrowRight className="w-3 h-3 text-stone-400" />
                              <span className="text-indigo-600">{toWallet?.name || 'Target'}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-800">
                              <span 
                                className="w-2 h-2 rounded-full shrink-0" 
                                style={{ backgroundColor: wallet?.color || '#94a3b8' }} 
                              />
                              <span>{wallet?.name || 'Wallet'}</span>
                            </div>
                          )}
                        </td>

                        {/* Type Badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            tx.type === 'INCOME' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : tx.type === 'EXPENSE' 
                              ? 'bg-rose-100 text-rose-800' 
                              : tx.type === 'TRANSFER' 
                              ? 'bg-indigo-100 text-indigo-800' 
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {tx.type.replace('_', ' ')}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className={`font-mono font-black text-sm ${
                            tx.type === 'INCOME' 
                              ? 'text-emerald-600' 
                              : tx.type === 'EXPENSE' 
                              ? 'text-rose-600' 
                              : tx.type === 'TRANSFER' 
                              ? 'text-indigo-600' 
                              : 'text-purple-600'
                          }`}>
                            {tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? '−' : tx.type === 'TRANSFER' ? '⇄ ' : ''}
                            {getCurrencySymbol(wallet?.currency)}{tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Wallet Management & Transfer Pop-up Modal */}
      <WalletPopupModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        initialTab={walletModalTab}
        initialWalletId={selectedWalletIdForModal}
      />
    </div>
  );
};
