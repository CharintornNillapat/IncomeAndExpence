import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronRight, Receipt, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, TrendingDown } from 'lucide-react';
import { Transaction, Wallet, Category } from '../../types';

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
    <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <div>
            <h2 className="text-base font-bold text-stone-900">Recent Transactions</h2>
            <p className="text-xs text-stone-500">Your latest 5 financial activities</p>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }}
          id="dashboard-view-all-transactions-btn"
          type="button"
          onClick={() => onNavigate?.('transactions')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-all cursor-pointer"
        >
          <span>View All</span>
          <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
        </motion.button>
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
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-stone-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Receipt className="w-8 h-8 text-stone-300" />
                    <p className="text-xs font-semibold text-stone-600">No transactions recorded yet</p>
                    <p className="text-[11px] text-stone-400">
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
                const currency = wallet?.currency || 'USD';

                return (
                  <tr key={tx.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-stone-500 whitespace-nowrap">
                      {tx.transactionDate}
                    </td>
                    <td className="py-3 px-4 font-medium text-stone-900">
                      {tx.description}
                    </td>
                    <td className="py-3 px-4">
                      {category ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
                          style={{
                            backgroundColor: `${category.color}15`,
                            color: category.color,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          {category.name}
                        </span>
                      ) : (
                        <span className="text-stone-400 text-[11px]">
                          {tx.type === 'TRANSFER' ? 'Transfer' : tx.type === 'DEBT_REPAYMENT' ? 'Debt' : 'General'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-stone-600 font-medium">
                      {tx.type === 'TRANSFER' && destWallet ? (
                        <span>{wallet?.name || 'Source'} → {destWallet.name}</span>
                      ) : (
                        <span>{wallet?.name || 'Main Wallet'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {tx.type === 'INCOME' && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                          <ArrowDownLeft className="w-3 h-3" /> Income
                        </span>
                      )}
                      {tx.type === 'EXPENSE' && (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-[11px]">
                          <ArrowUpRight className="w-3 h-3" /> Expense
                        </span>
                      )}
                      {tx.type === 'TRANSFER' && (
                        <span className="inline-flex items-center gap-1 text-indigo-600 font-semibold text-[11px]">
                          <ArrowLeftRight className="w-3 h-3" /> Transfer
                        </span>
                      )}
                      {tx.type === 'DEBT_REPAYMENT' && (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-[11px]">
                          <TrendingDown className="w-3 h-3" /> Repayment
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                      <span
                        className={
                          tx.type === 'INCOME'
                            ? 'text-emerald-600'
                            : tx.type === 'EXPENSE'
                            ? 'text-rose-600'
                            : tx.type === 'DEBT_REPAYMENT'
                            ? 'text-amber-600'
                            : 'text-indigo-600'
                        }
                      >
                        {tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? '−' : ''}
                        ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-stone-400 ml-1">{currency}</span>
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
