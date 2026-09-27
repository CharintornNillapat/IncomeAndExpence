import React from 'react';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';
import { Money } from '../ui/Money';

interface CashflowMetricsCardsProps {
  incomeTotal: number;
  expenseTotal: number;
  netBalance: number;
}

export const CashflowMetricsCards: React.FC<CashflowMetricsCardsProps> = React.memo(({
  incomeTotal,
  expenseTotal,
  netBalance,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-5">
      {/* 1. Total Income Card */}
      <div
        data-testid="metric-card-income"
        className="bg-surface-1 rounded-xl border-2 border-income-line p-4 sm:p-6 relative overflow-hidden flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-income flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-income-fill"></span>
            Total Income
          </span>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-income-tint text-income flex items-center justify-center border border-income-line">
            <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          </div>
        </div>
        <div className="mt-3.5 sm:mt-5">
          <p className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight text-income">
            <Money value={incomeTotal} />
          </p>
          <div className="flex items-center justify-between mt-2 sm:mt-3 text-xs">
            <span className="hidden sm:inline text-fg-secondary font-medium">Inflows across active accounts</span>
            <span className="text-income font-semibold bg-income-tint px-2 py-0.5 rounded-sm border border-income-line text-[11px]">
              + Inflow
            </span>
          </div>
        </div>
      </div>

      {/* 2. Total Expense Card */}
      <div
        data-testid="metric-card-expense"
        className="bg-surface-1 rounded-xl border-2 border-expense-line p-4 sm:p-6 relative overflow-hidden flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-expense flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-expense-fill"></span>
            Total Expense
          </span>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-expense-tint text-expense flex items-center justify-center border border-expense-line">
            <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          </div>
        </div>
        <div className="mt-3.5 sm:mt-5">
          <p className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight text-expense">
            <Money value={expenseTotal} />
          </p>
          <div className="flex items-center justify-between mt-2 sm:mt-3 text-xs">
            <span className="hidden sm:inline text-fg-secondary font-medium">Outflows & regular expenses</span>
            <span className="text-expense font-semibold bg-expense-tint px-2 py-0.5 rounded-sm border border-expense-line text-[11px]">
              − Outflow
            </span>
          </div>
        </div>
      </div>

      {/* 3. Net Balance Card (Income - Expense) */}
      <div
        data-testid="metric-card-net"
        className={`bg-surface-1 rounded-xl border-2 p-4 sm:p-6 relative overflow-hidden flex flex-col justify-between ${
          netBalance >= 0 ? 'border-income-line' : 'border-expense-line'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
            netBalance >= 0 ? 'text-income' : 'text-expense'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${netBalance >= 0 ? 'bg-income-fill' : 'bg-expense-fill'}`}></span>
            Net Balance
          </span>
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center border ${
            netBalance >= 0
              ? 'bg-income-tint text-income border-income-line'
              : 'bg-expense-tint text-expense border-expense-line'
          }`}>
            {netBalance >= 0 ? (
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            ) : (
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            )}
          </div>
        </div>
        <div className="mt-3.5 sm:mt-5">
          <p className={`text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight ${
            netBalance >= 0 ? 'text-income' : 'text-expense'
          }`}>
            <Money value={netBalance} />
          </p>
          <div className="flex items-center justify-between mt-2 sm:mt-3 text-xs">
            <span className="hidden sm:inline text-fg-secondary font-medium">
              {netBalance >= 0 ? 'Net positive surplus' : 'Net deficit'}
            </span>
            <span className={`font-semibold px-2 py-0.5 rounded-sm border text-[11px] ${
              netBalance >= 0
                ? 'bg-income-tint text-income border-income-line'
                : 'bg-expense-tint text-expense border-expense-line'
            }`}>
              Income − Expense
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

CashflowMetricsCards.displayName = 'CashflowMetricsCards';
