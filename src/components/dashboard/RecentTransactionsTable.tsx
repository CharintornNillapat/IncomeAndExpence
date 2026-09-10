import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronRight, Receipt, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, TrendingDown } from 'lucide-react';
import { Transaction, Wallet, Category } from '../../types';
import { APP_CURRENCY, formatCurrencyAmount } from '../../utils/currency';

interface RecentTransactionsTableProps {
  transactions: Transaction[];
  walletMap: Map<string, Wallet>;
  categoryMap: Map<string, Category>;
  onNavigate?: (tab: string) => void;
}

export const RecentTransactionsTable: React.FC<RecentTransactionsTableProps> = React.memo(({
  transactions,
  walletMap,
  categoryMap,
  onNavigate,
}) => {
  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 sm:p-5 shadow-2xs space-y-3 sm:space-y-4 transition-colors">
      <div className="flex items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <div>
            <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white">Recent Transactions</h2>
            <p className="hidden sm:block text-xs text-stone-500 dark:text-stone-400">Your latest 5 financial activities</p>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }}
          id="dashboard-view-all-transactions-btn"
          type="button"
          onClick={() => onNavigate?.('transactions')}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 rounded-xl transition-all cursor-pointer"
        >
          <span>View All</span>
          <ChevronRight className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
        </motion.button>
      </div>

      {/* Compact Transactions Table with Progressive Disclosure */}
      <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 dark:bg-stone-800/80 border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 px-3 sm:px-4">Date</th>
              <th className="py-3 px-3 sm:px-4">Description</th>
              <th className="hidden sm:table-cell py-3 px-4">Category</th>
              <th className="hidden md:table-cell py-3 px-4">Wallet</th>
              <th className="hidden lg:table-cell py-3 px-4">Type</th>
              <th className="py-3 px-3 sm:px-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 bg-white dark:bg-stone-900">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-stone-400 dark:text-stone-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Receipt className="w-8 h-8 text-stone-300 dark:text-stone-600" />
                    <p className="text-xs font-semibold text-stone-600 dark:text-stone-300">No transactions recorded yet</p>
                    <p className="text-[11px] text-stone-400 dark:text-stone-500">
                      Use the quick recorder above to log your first transaction
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const wallet = tx.walletId ? walletMap.get(tx.walletId) : undefined;
                const destWallet = tx.destinationWalletId ? walletMap.get(tx.destinationWalletId) : undefined;
                const category = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
                const currency = APP_CURRENCY;

                return (
                  <tr key={tx.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors">
                    <td className="py-3 px-3 sm:px-4 font-mono text-stone-500 dark:text-stone-400 whitespace-nowrap text-[11px] sm:text-xs">
                      {tx.transactionDate}
                    </td>

                    <td className="py-3 px-3 sm:px-4 font-medium text-stone-900 dark:text-white max-w-[170px] sm:max-w-[240px]">
                      <div className="min-w-0">
                        <p className="truncate text-xs sm:text-sm font-semibold">{tx.description}</p>
                        
                        {/* Mobile subtitled badges */}
                        <div className="flex items-center gap-1.5 mt-0.5 sm:hidden flex-wrap">
                          {category && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium truncate max-w-[90px]"
                              style={{ backgroundColor: `${category.color}20`, color: category.color }}
                            >
                              <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
                              <span className="truncate">{category.name}</span>
                            </span>
                          )}
                          <span className="text-[10px] text-stone-400 dark:text-stone-500 truncate max-w-[80px]">
                            {wallet?.name || 'Wallet'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Category Column (Hidden on mobile) */}
                    <td className="hidden sm:table-cell py-3 px-4">
                      {category ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium truncate max-w-[120px]"
                          style={{
                            backgroundColor: `${category.color}20`,
                            color: category.color,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="truncate">{category.name}</span>
                        </span>
                      ) : (
                        <span className="text-stone-400 dark:text-stone-500 text-[11px]">
                          {tx.type === 'TRANSFER' ? 'Transfer' : tx.type === 'DEBT_REPAYMENT' ? 'Debt' : 'General'}
                        </span>
                      )}
                    </td>

                    {/* Wallet Column (Hidden on tablets/mobiles) */}
                    <td className="hidden md:table-cell py-3 px-4 text-stone-600 dark:text-stone-300 font-medium">
                      {tx.type === 'TRANSFER' && destWallet ? (
                        <span className="truncate block max-w-[130px]">{wallet?.name || 'Source'} → {destWallet.name}</span>
                      ) : (
                        <span className="truncate block max-w-[130px]">{wallet?.name || 'Main Wallet'}</span>
                      )}
                    </td>

                    {/* Type Column (Hidden on small screens) */}
                    <td className="hidden lg:table-cell py-3 px-4">
                      {tx.type === 'INCOME' && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          <ArrowDownLeft className="w-3 h-3" /> Income
                        </span>
                      )}
                      {tx.type === 'EXPENSE' && (
                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold text-[11px]">
                          <ArrowUpRight className="w-3 h-3" /> Expense
                        </span>
                      )}
                      {tx.type === 'TRANSFER' && (
                        <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold text-[11px]">
                          <ArrowLeftRight className="w-3 h-3" /> Transfer
                        </span>
                      )}
                      {tx.type === 'DEBT_REPAYMENT' && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                          <TrendingDown className="w-3 h-3" /> Repayment
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-3 sm:px-4 text-right font-mono font-bold whitespace-nowrap text-xs sm:text-sm">
                      <span
                        className={
                          tx.type === 'INCOME'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.type === 'EXPENSE'
                            ? 'text-rose-600 dark:text-rose-400'
                            : tx.type === 'DEBT_REPAYMENT'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-indigo-600 dark:text-indigo-400'
                        }
                      >
                        {tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? '−' : ''}
                        {formatCurrencyAmount(tx.amount)}
                      </span>
                      <span className="text-[10px] text-stone-400 dark:text-stone-500 ml-1 hidden sm:inline">{currency}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

RecentTransactionsTable.displayName = 'RecentTransactionsTable';
