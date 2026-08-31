import React from 'react';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { Transaction, Wallet, Category } from '../types';

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
  const isIncome = tx.type === 'INCOME';
  const isTransfer = tx.type === 'TRANSFER';

  return (
    <tr
      id={`tx-row-${tx.id}`}
      className={`hover:bg-stone-50/80 transition-colors ${
        tx.isDeleted ? 'opacity-50 bg-rose-50/30' : ''
      }`}
    >
      {/* Date */}
      <td className="py-3 px-3 sm:px-4 font-mono text-stone-600 whitespace-nowrap text-[11px] sm:text-xs">
        {tx.transactionDate}
      </td>

      {/* Description & Progressive Disclosure for Mobile */}
      <td className="py-3 px-3 sm:px-4 max-w-[160px] sm:max-w-[260px] md:max-w-none">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isIncome
                ? 'bg-emerald-100 text-emerald-700'
                : isTransfer
                ? 'bg-blue-100 text-blue-700'
                : 'bg-rose-100 text-rose-700'
            }`}
          >
            {isIncome ? (
              <ArrowDownLeft className="w-3.5 h-3.5" />
            ) : isTransfer ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <ArrowUpRight className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`font-semibold truncate text-xs sm:text-sm ${tx.isDeleted ? 'line-through text-stone-500' : 'text-stone-900'}`}>
              {tx.description}
            </p>

            {/* Mobile-only secondary info: wallet & category badges */}
            <div className="flex items-center gap-1.5 mt-0.5 sm:hidden flex-wrap">
              {category && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium truncate max-w-[100px]"
                  style={{ backgroundColor: `${category.color}15`, color: category.color }}
                >
                  <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
                  <span className="truncate">{category.name}</span>
                </span>
              )}
              <span className="text-[10px] text-stone-400 truncate max-w-[90px]">
                {wallet?.name || 'Wallet'}
              </span>
            </div>

            {/* Formula display on tablet/desktop */}
            {tx.rawInput && tx.rawInput !== tx.amount.toString() && (
              <p className="hidden sm:block text-[10px] text-stone-400 font-mono truncate">
                Formula: <span className="text-stone-600">{tx.rawInput}</span>
              </p>
            )}

            {tx.isDeleted && (
              <span className="inline-block text-[10px] font-semibold text-rose-600 uppercase">
                [Soft Deleted]
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Wallet (Hidden on mobile) */}
      <td className="hidden md:table-cell py-3.5 px-4 text-stone-700">
        <span className="truncate block max-w-[140px]">{wallet?.name || 'Unknown'}</span>
        {isTransfer && destWallet && (
          <span className="text-stone-400 block text-[10px] truncate max-w-[140px]">→ {destWallet.name}</span>
        )}
      </td>

      {/* Category (Hidden on mobile, displayed inline in description cell) */}
      <td className="hidden sm:table-cell py-3.5 px-4">
        {category ? (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium truncate max-w-[130px]"
            style={{ backgroundColor: `${category.color}15`, color: category.color }}
          >
            {category.name}
          </span>
        ) : (
          <span className="text-stone-400">—</span>
        )}
      </td>

      {/* Amount */}
      <td className="py-3 px-3 sm:px-4 text-right font-mono font-bold whitespace-nowrap text-xs sm:text-sm">
        <span className={isIncome ? 'text-emerald-600' : 'text-stone-900'}>
          {isIncome ? '+' : '-'}${tx.amount.toFixed(2)}
        </span>
      </td>

      {/* Actions with accessible 44px min touch target */}
      <td className="py-2 px-2 sm:px-4 text-center">
        {tx.isDeleted ? (
          <button
            id={`tx-restore-btn-${tx.id}`}
            type="button"
            onClick={() => onRestore(tx.id)}
            title="Restore soft-deleted transaction"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        ) : (
          <button
            id={`tx-delete-btn-${tx.id}`}
            type="button"
            onClick={() => onDelete(tx.id)}
            title="Soft delete (reverts wallet balance)"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );
});

TransactionTableRow.displayName = 'TransactionTableRow';
