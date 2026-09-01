import React from 'react';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';
import { AnimatedCounter } from '../AnimatedCounter';

interface CashflowMetricsCardsProps {
  incomeTotal: number;
  expenseTotal: number;
  netBalance: number;
  primarySymbol: string;
}

export const CashflowMetricsCards: React.FC<CashflowMetricsCardsProps> = React.memo(({
  incomeTotal,
  expenseTotal,
  netBalance,
  primarySymbol,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-5">
      {/* 1. Total Income Card */}
      <motion.div 
        whileHover={{ y: -2 }}
        className="bg-white dark:bg-stone-900 rounded-2xl border-2 border-emerald-200/80 dark:border-emerald-900/60 p-4 sm:p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            Total Income
          </span>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-800">
            <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          </div>
        </div>
        <div className="mt-3.5 sm:mt-5">
          <p className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
            <AnimatedCounter
              value={incomeTotal}
              currencyPrefix={primarySymbol}
              duration={1.2}
            />
          </p>
          <div className="flex items-center justify-between mt-2 sm:mt-3 text-xs">
            <span className="hidden sm:inline text-stone-500 dark:text-stone-400 font-medium">Inflows across active accounts</span>
            <span className="text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-800 text-[11px]">
              + Inflow
            </span>
          </div>
        </div>
      </motion.div>

      {/* 2. Total Expense Card */}
      <motion.div 
        whileHover={{ y: -2 }}
        className="bg-white dark:bg-stone-900 rounded-2xl border-2 border-rose-200/80 dark:border-rose-900/60 p-4 sm:p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            Total Expense
          </span>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-800">
            <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          </div>
        </div>
        <div className="mt-3.5 sm:mt-5">
          <p className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400">
            <AnimatedCounter
              value={expenseTotal}
              currencyPrefix={primarySymbol}
              duration={1.2}
            />
          </p>
          <div className="flex items-center justify-between mt-2 sm:mt-3 text-xs">
            <span className="hidden sm:inline text-stone-500 dark:text-stone-400 font-medium">Outflows & regular expenses</span>
            <span className="text-rose-700 dark:text-rose-300 font-semibold bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-100 dark:border-rose-800 text-[11px]">
              − Outflow
            </span>
          </div>
        </div>
      </motion.div>

      {/* 3. Net Balance Card (Income - Expense) */}
      <motion.div 
        whileHover={{ y: -2 }}
        className={`bg-white dark:bg-stone-900 rounded-2xl border-2 p-4 sm:p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between ${
          netBalance >= 0 ? 'border-emerald-300 dark:border-emerald-800/80' : 'border-rose-300 dark:border-rose-800/80'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
            netBalance >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${netBalance >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            Net Balance
          </span>
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border ${
            netBalance >= 0 
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800' 
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800'
          }`}>
            {netBalance >= 0 ? (
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            ) : (
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            )}
          </div>
        </div>
        <div className="mt-3.5 sm:mt-5">
          <p className={`text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black font-mono tracking-tight ${
            netBalance >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {netBalance < 0 ? '-' : ''}
            <AnimatedCounter
              value={Math.abs(netBalance)}
              currencyPrefix={primarySymbol}
              duration={1.2}
            />
          </p>
          <div className="flex items-center justify-between mt-2 sm:mt-3 text-xs">
            <span className="hidden sm:inline text-stone-500 dark:text-stone-400 font-medium">
              {netBalance >= 0 ? 'Net positive surplus' : 'Net deficit'}
            </span>
            <span className={`font-semibold px-2 py-0.5 rounded-md border text-[11px] ${
              netBalance >= 0 
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800' 
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-800'
            }`}>
              Income − Expense
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

CashflowMetricsCards.displayName = 'CashflowMetricsCards';
