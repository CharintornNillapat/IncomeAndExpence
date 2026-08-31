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
      <td className="py-3.5 px-4 font-mono text-stone-600">
        {tx.transactionDate}
      </td>

      {/* Description & Type */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
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
          <div>
            <p className={`font-semibold ${tx.isDeleted ? 'line-through text-stone-500' : 'text-stone-900'}`}>
              {tx.description}
            </p>
            {tx.rawInput && tx.rawInput !== tx.amount.toString() && (
              <p className="text-[10px] text-stone-400 font-mono">
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

      {/* Wallet */}
      <td className="py-3.5 px-4 text-stone-700">
        <span>{wallet?.name || 'Unknown'}</span>
        {isTransfer && destWallet && (
          <span className="text-stone-400 block text-[10px]">→ {destWallet.name}</span>
        )}
      </td>

      {/* Category */}
      <td className="py-3.5 px-4">
        {category ? (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium"
            style={{ backgroundColor: `${category.color}15`, color: category.color }}
          >
            {category.name}
          </span>
        ) : (
          <span className="text-stone-400">—</span>
        )}
      </td>

      {/* Amount */}
      <td className="py-3.5 px-4 text-right font-mono font-bold">
        <span className={isIncome ? 'text-emerald-600' : 'text-stone-900'}>
          {isIncome ? '+' : '-'}${tx.amount.toFixed(2)}
        </span>
      </td>

      {/* Actions */}
      <td className="py-3.5 px-4 text-center">
        {tx.isDeleted ? (
          <button
            id={`tx-restore-btn-${tx.id}`}
            type="button"
            onClick={() => onRestore(tx.id)}
            title="Restore soft-deleted transaction"
            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        ) : (
          <button
            id={`tx-delete-btn-${tx.id}`}
            type="button"
            onClick={() => onDelete(tx.id)}
            title="Soft delete (reverts wallet balance)"
            className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );
});

TransactionTableRow.displayName = 'TransactionTableRow';
