import React from 'react';
import { Calendar, ChevronRight, Receipt, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, TrendingDown } from 'lucide-react';
import { Transaction, Wallet, Category } from '../../types';
import { TxAmount, TxCategoryChip } from '../transaction/TxCells';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';

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
    <div className="bg-surface-1 rounded-xl border border-line p-4 sm:p-5 space-y-3 sm:space-y-4 transition-colors">
      <div className="flex items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-line">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand shrink-0" />
          <div>
            <h2 className="text-sm sm:text-base font-bold text-fg">Recent Transactions</h2>
            <p className="hidden sm:block text-xs text-fg-secondary">Your latest 5 financial activities</p>
          </div>
        </div>

        <Button
          id="dashboard-view-all-transactions-btn"
          variant="secondary"
          onClick={() => onNavigate?.('transactions')}
        >
          <span>View All</span>
          <ChevronRight className="w-3.5 h-3.5 text-fg-muted" />
        </Button>
      </div>

      {/* Compact Transactions Table with Progressive Disclosure */}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-2 border-b border-line text-fg-secondary font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 px-3 sm:px-4">Date</th>
              <th className="py-3 px-3 sm:px-4">Description</th>
              <th className="hidden sm:table-cell py-3 px-4">Category</th>
              <th className="hidden md:table-cell py-3 px-4">Wallet</th>
              <th className="hidden lg:table-cell py-3 px-4">Type</th>
              <th className="py-3 px-3 sm:px-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-surface-1">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    icon={Receipt}
                    title="No transactions recorded yet"
                    subtitle="Use the quick recorder above to log your first transaction"
                  />
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const wallet = tx.walletId ? walletMap.get(tx.walletId) : undefined;
                const destWallet = tx.destinationWalletId ? walletMap.get(tx.destinationWalletId) : undefined;
                const category = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;

                return (
                  <tr key={tx.id} className="hover:bg-surface-2 transition-colors">
                    <td className="py-3 px-3 sm:px-4 text-fg-secondary whitespace-nowrap text-[11px] sm:text-xs">
                      {tx.transactionDate}
                    </td>

                    <td className="py-3 px-3 sm:px-4 font-medium text-fg max-w-[170px] sm:max-w-[240px]">
                      <div className="min-w-0">
                        <p className="truncate text-xs sm:text-sm font-semibold">{tx.description}</p>
                        
                        {/* Mobile subtitled badges */}
                        <div className="flex items-center gap-1.5 mt-0.5 sm:hidden flex-wrap">
                          <TxCategoryChip category={category} size="sm" className="max-w-[90px]" />
                          <span className="text-[10px] text-fg-muted truncate max-w-[80px]">
                            {wallet?.name || 'Wallet'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Category Column (Hidden on mobile) */}
                    <td className="hidden sm:table-cell py-3 px-4">
                      {category ? (
                        <TxCategoryChip category={category} className="max-w-[120px]" />
                      ) : (
                        <span className="text-fg-muted text-[11px]">
                          {tx.type === 'TRANSFER' ? 'Transfer' : tx.type === 'DEBT_REPAYMENT' ? 'Debt' : 'General'}
                        </span>
                      )}
                    </td>

                    {/* Wallet Column (Hidden on tablets/mobiles) */}
                    <td className="hidden md:table-cell py-3 px-4 text-fg-secondary font-medium">
                      {tx.type === 'TRANSFER' && destWallet ? (
                        <span className="truncate block max-w-[130px]">{wallet?.name || 'Source'} → {destWallet.name}</span>
                      ) : (
                        <span className="truncate block max-w-[130px]">{wallet?.name || 'Main Wallet'}</span>
                      )}
                    </td>

                    {/* Type Column (Hidden on small screens) */}
                    <td className="hidden lg:table-cell py-3 px-4">
                      {tx.type === 'INCOME' && (
                        <span className="inline-flex items-center gap-1 text-income font-semibold text-[11px]">
                          <ArrowDownLeft className="w-3 h-3" /> Income
                        </span>
                      )}
                      {tx.type === 'EXPENSE' && (
                        <span className="inline-flex items-center gap-1 text-expense font-semibold text-[11px]">
                          <ArrowUpRight className="w-3 h-3" /> Expense
                        </span>
                      )}
                      {tx.type === 'TRANSFER' && (
                        <span className="inline-flex items-center gap-1 text-transfer font-semibold text-[11px]">
                          <ArrowLeftRight className="w-3 h-3" /> Transfer
                        </span>
                      )}
                      {tx.type === 'DEBT_REPAYMENT' && (
                        <span className="inline-flex items-center gap-1 text-adjust font-semibold text-[11px]">
                          <TrendingDown className="w-3 h-3" /> Repayment
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-3 sm:px-4 text-right font-bold whitespace-nowrap text-xs sm:text-sm">
                      {/* Spec 4.8: the currency code sits on the hero figure only, never after each row. */}
                      <TxAmount amount={tx.amount} type={tx.type} />
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
