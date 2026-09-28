import React from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Transaction, Wallet, Category } from '../types';
import { TX_TYPE_META } from './transaction/txTypeMeta';
import { TxTypeIcon, TxAmount, TxCategoryChip, TxSoftDeletedTag } from './transaction/TxCells';
import { Chip } from './ui/Chip';
import { IconButton } from './ui/IconButton';
import { SYSTEM_CATEGORY_COLOR } from '../selectors/ledger';

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
      className={`hover:bg-surface-2 transition-control border-b border-line ${
        tx.isDeleted ? 'opacity-50 bg-expense-tint' : ''
      }`}
    >
      {/* Date */}
      <td className="py-3 px-3 sm:px-4 text-fg-secondary whitespace-nowrap text-[11px] sm:text-xs">
        {tx.transactionDate}
      </td>

      {/* Description & Progressive Disclosure for Mobile */}
      <td className="py-3 px-3 sm:px-4 max-w-[160px] sm:max-w-[260px] md:max-w-none">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <TxTypeIcon type={tx.type} amount={tx.amount} size="md" />
          <div className="min-w-0 flex-1">
            <p className={`font-semibold truncate text-xs sm:text-sm ${tx.isDeleted ? 'line-through text-fg-muted' : 'text-fg'}`}>
              {tx.description}
            </p>

            {/* Mobile-only secondary info: wallet & category badges */}
            <div className="flex items-center gap-1.5 mt-0.5 sm:hidden flex-wrap">
              {isDebtRepayment ? (
                <Chip label="Debt Payoff" color={SYSTEM_CATEGORY_COLOR} size="sm" />
              ) : (
                <TxCategoryChip category={category} size="sm" className="max-w-[100px]" />
              )}
              <span className="text-[10px] text-fg-muted truncate max-w-[90px]">
                {wallet?.name || 'Wallet'}
              </span>
            </div>

            {/* Formula display on tablet/desktop */}
            {tx.rawInput && tx.rawInput !== tx.amount.toString() && (
              <p className="hidden sm:block text-[10px] text-fg-muted truncate">
                Formula: <span className="text-fg-secondary">{tx.rawInput}</span>
              </p>
            )}

            {tx.isDeleted && <TxSoftDeletedTag />}
          </div>
        </div>
      </td>

      {/* Wallet (Hidden on mobile) */}
      <td className="hidden md:table-cell py-3.5 px-4 text-fg-secondary">
        <span className="truncate block max-w-[140px]">{wallet?.name || 'Unknown'}</span>
        {isTransfer && destWallet && (
          <span className="text-fg-muted block text-[10px] truncate max-w-[140px]">→ {destWallet.name}</span>
        )}
      </td>

      {/* Category (Hidden on mobile, displayed inline in description cell) */}
      <td className="hidden sm:table-cell py-3.5 px-4">
        {isDebtRepayment ? (
          <Chip label={TX_TYPE_META.DEBT_REPAYMENT.label} color={SYSTEM_CATEGORY_COLOR} />
        ) : category ? (
          <TxCategoryChip category={category} className="max-w-[130px]" />
        ) : (
          <span className="text-fg-muted">No category</span>
        )}
      </td>

      {/* Amount */}
      <td className="py-3 px-3 sm:px-4 text-right font-bold whitespace-nowrap text-xs sm:text-sm">
        <TxAmount amount={tx.amount} type={tx.type} />
      </td>

      {/* Actions with accessible 44px min touch target */}
      <td className="py-2 px-2 sm:px-4 text-center">
        {tx.isDeleted ? (
          <IconButton id={`tx-restore-btn-${tx.id}`} label="Restore transaction" tone="income" onClick={() => onRestore(tx.id)}>
            <RotateCcw className="w-4 h-4" />
          </IconButton>
        ) : (
          <IconButton
            id={`tx-delete-btn-${tx.id}`}
            label="Delete and reverse the wallet change"
            tone="danger"
            onClick={() => onDelete(tx.id)}
          >
            <Trash2 className="w-4 h-4" />
          </IconButton>
        )}
      </td>
    </tr>
  );
});

TransactionTableRow.displayName = 'TransactionTableRow';
