import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownLeft 
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { TransactionForm } from '../components/TransactionForm';

export type TimeFilter = 'DAY' | 'WEEK' | 'MONTH' | 'ALL';

export const DashboardView: React.FC = () => {
  const { transactions, wallets, debts, categories, addTransaction } = useFinance();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('MONTH');

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

  // Aggregate Metrics
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

  return (
    <div className="space-y-8">
      {/* High-Visibility Primary Financial Summary (Top Hero Section) */}
      <section aria-label="Financial Summary" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
              Financial Summary
            </h1>
            <p className="text-xs sm:text-sm text-stone-500">
              High-visibility overview of total cash inflow, expense outflow, and net balance
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
                ${incomeTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                ${expenseTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                {netBalance < 0 ? '-' : ''}${Math.abs(netBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {/* Analytics & Breakdown Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-stone-900">Performance & Allocation Breakdown</h2>
          <p className="text-xs text-stone-500">
            Granular breakdown of debt paydowns, savings rates, and expense allocations
          </p>
        </div>
      </div>

      {/* 4 Core Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Income Card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Income</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold font-mono text-stone-900">
              ${incomeTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-emerald-600 font-medium mt-1">
              Active cash inflows
            </p>
          </div>
        </div>

        {/* Expenses Card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Expenses</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold font-mono text-stone-900">
              ${expenseTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-rose-600 font-medium mt-1">
              Outgoing spending
            </p>
          </div>
        </div>

        {/* Debt Repayment Card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Debt Repaid</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold font-mono text-stone-900">
              ${debtRepaymentTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-indigo-600 font-medium mt-1">
              Accelerating debt freedom
            </p>
          </div>
        </div>

        {/* Net Savings & Rate Card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Net Savings</span>
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-800 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className={`text-2xl font-bold font-mono ${netSavings >= 0 ? 'text-stone-900' : 'text-rose-600'}`}>
              ${netSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-stone-500 font-medium mt-1">
              Savings Rate: <strong className="text-stone-800">{savingsRate.toFixed(1)}%</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Main Action & Breakdown Section: Add Transaction + Category & Debt Progress */}
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
                Total: ${(expenseTotal + debtRepaymentTotal).toFixed(2)}
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
                          <span className="font-mono font-bold text-stone-900">${item.amount.toFixed(2)}</span>
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
                      ${remainingDebtTarget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <span className="text-[11px] text-stone-500 block">Total Principal Paid</span>
                    <span className="text-base font-bold font-mono text-emerald-600">
                      ${paidDebtTarget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-stone-400 mt-6 pt-4 border-t border-stone-100">
              Repayments automatically deduct from selected wallet & reduce debt balance atomically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
