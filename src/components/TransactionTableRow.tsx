import React from 'react';
import { Landmark, RotateCcw, Trash2 } from 'lucide-react';
import { Transaction, Wallet, Category } from '../types';
import { TX_TYPE_META } from './transaction/txTypeMeta';
import { TxTypeIcon, TxAmount, TxCategoryChip, TxSoftDeletedTag } from './transaction/TxCells';
import { Badge } from './ui/Badge';

interface TransactionTableRowProps {
  tx: Transaction;
  wallet?: Wallet;
  destWallet?: Wallet;
  category?: Category;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TransactionTableRow: React.FC<TransactionTableRowProps> = React.memo(({
  tx,
  wallet,
  destWallet,
  category,
  onRestore,
  onDelete,
}) => {
  const isTransfer = tx.type === 'TRANSFER';
  const isDebtRepayment = tx.type === 'DEBT_REPAYMENT';

  return (
    <tr
      id={`tx-row-${tx.id}`}
      className={`hover:bg-stone-50/80 dark:hover:bg-stone-800/50 transition-colors border-b border-stone-100 dark:border-stone-800/60 ${
        tx.isDeleted ? 'opacity-50 bg-rose-50/30 dark:bg-rose-950/20' : ''
      }`}
    >
      {/* Date */}
      <td className="py-3 px-3 sm:px-4 font-mono text-stone-600 dark:text-stone-400 whitespace-nowrap text-[11px] sm:text-xs">
        {tx.transactionDate}
      </td>

      {/* Description & Progressive Disclosure for Mobile */}
      <td className="py-3 px-3 sm:px-4 max-w-[160px] sm:max-w-[260px] md:max-w-none">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <TxTypeIcon type={tx.type} size="md" />
          <div className="min-w-0 flex-1">
            <p className={`font-semibold truncate text-xs sm:text-sm ${tx.isDeleted ? 'line-through text-stone-500 dark:text-stone-500' : 'text-stone-900 dark:text-stone-100'}`}>
              {tx.description}
            </p>

            {/* Mobile-only secondary info: wallet & category badges */}
            <div className="flex items-center gap-1.5 mt-0.5 sm:hidden flex-wrap">
              {isDebtRepayment ? (
                <Badge tone="amber" size="sm" icon={<Landmark className="w-2.5 h-2.5" />}>
                  Debt Payoff
                </Badge>
              ) : (
                <TxCategoryChip category={category} size="sm" rounded="sm" showDot className="max-w-[100px]" />
              )}
              <span className="text-[10px] text-stone-400 dark:text-stone-500 truncate max-w-[90px]">
                {wallet?.name || 'Wallet'}
              </span>
            </div>

            {/* Formula display on tablet/desktop */}
            {tx.rawInput && tx.rawInput !== tx.amount.toString() && (
              <p className="hidden sm:block text-[10px] text-stone-400 dark:text-stone-500 font-mono truncate">
                Formula: <span className="text-stone-600 dark:text-stone-300">{tx.rawInput}</span>
              </p>
            )}

            {tx.isDeleted && <TxSoftDeletedTag />}
          </div>
        </div>
      </td>

      {/* Wallet (Hidden on mobile) */}
      <td className="hidden md:table-cell py-3.5 px-4 text-stone-700 dark:text-stone-300">
        <span className="truncate block max-w-[140px]">{wallet?.name || 'Unknown'}</span>
        {isTransfer && destWallet && (
          <span className="text-stone-400 dark:text-stone-500 block text-[10px] truncate max-w-[140px]">→ {destWallet.name}</span>
        )}
      </td>

      {/* Category (Hidden on mobile, displayed inline in description cell) */}
      <td className="hidden sm:table-cell py-3.5 px-4">
        {isDebtRepayment ? (
          <Badge tone="amber" size="md" icon={<Landmark className="w-3 h-3" />}>
            {TX_TYPE_META.DEBT_REPAYMENT.label}
          </Badge>
        ) : category ? (
          <TxCategoryChip category={category} size="md" rounded="md" className="max-w-[130px]" />
        ) : (
          <span className="text-stone-400 dark:text-stone-500">—</span>
        )}
      </td>

      {/* Amount */}
      <td className="py-3 px-3 sm:px-4 text-right font-mono font-bold whitespace-nowrap text-xs sm:text-sm">
        <TxAmount amount={tx.amount} type={tx.type} />
      </td>

      {/* Actions with accessible 44px min touch target */}
      <td className="py-2 px-2 sm:px-4 text-center">
        {tx.isDeleted ? (
          <button
            id={`tx-restore-btn-${tx.id}`}
            type="button"
            onClick={() => onRestore(tx.id)}
            title="Restore soft-deleted transaction"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        ) : (
          <button
            id={`tx-delete-btn-${tx.id}`}
            type="button"
            onClick={() => onDelete(tx.id)}
            title="Soft delete (reverts wallet balance)"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-stone-400 dark:text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );
});

TransactionTableRow.displayName = 'TransactionTableRow';
