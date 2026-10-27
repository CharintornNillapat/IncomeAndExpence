import React from 'react';
import { ERROR_BANNER_CLASS } from '../../utils/formStyles';
import { Button } from '../ui/Button';
import { Money } from '../ui/Money';

export interface TxBulkBarProps {
  count: number;
  net: number;
  hasUncounted: boolean;
  allDeleted: boolean;
  placement: 'inline' | 'pinned';
  busy: boolean;
  error: string | null;
  onDelete: () => void;
  onRestore: () => void;
  onClear: () => void;
}

/**
 * Design spec 4.1, 5, 7 (ADR 0109): pure presentational bulk actions bar
 * placed inline on wide Table views or pinned above the bottom nav on phones.
 */
export const TxBulkBar: React.FC<TxBulkBarProps> = ({
  count,
  net,
  hasUncounted,
  allDeleted,
  placement,
  busy,
  error,
  onDelete,
  onRestore,
  onClear,
}) => {
  // ponytail: the table scrolls inside its own box, so the bar stays above it; a sticky bar is the upgrade.
  const containerClasses =
    placement === 'inline'
      ? 'flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 bg-brand-soft border-b border-brand-soft-line'
      : 'fixed inset-x-0 z-40 bg-brand-soft border-t border-brand-soft-line px-4 py-3 bottom-[calc(4rem+1px+env(safe-area-inset-bottom,0.5rem))] md:bottom-0 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]';

  return (
    <section id="tx-bulk-bar" role="region" aria-label="Bulk actions" className={containerClasses}>
      {error && (
        <p id="tx-bulk-error" role="alert" className={`${ERROR_BANNER_CLASS} w-full`}>
          {error}
        </p>
      )}

      <span id="tx-bulk-count" role="status" className="text-sm font-semibold text-fg">
        {count} selected
      </span>

      {allDeleted ? (
        <span id="tx-bulk-net" className="text-xs text-fg-secondary">
          Deleted rows are not in your totals
        </span>
      ) : count > 0 ? (
        <span id="tx-bulk-net" className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="text-fg-secondary">Net</span>
          <Money
            value={net}
            showPlus
            className={`font-semibold ${net < 0 ? 'text-expense' : 'text-fg'}`}
          />
          {hasUncounted && (
            <span className="text-fg-secondary">
              Transfers, repayments, adjustments and deleted rows are not counted
            </span>
          )}
        </span>
      ) : null}

      <div className="flex items-center gap-2 ml-auto">
        <Button id="tx-bulk-clear-btn" variant="soft" onClick={onClear} disabled={busy}>
          {placement === 'inline' ? 'Clear' : 'Cancel'}
        </Button>
        {allDeleted ? (
          <Button id="tx-bulk-restore-btn" variant="secondary" onClick={onRestore} disabled={busy}>
            Restore
          </Button>
        ) : (
          <Button id="tx-bulk-delete-btn" variant="danger" onClick={onDelete} disabled={busy || count === 0}>
            Delete
          </Button>
        )}
      </div>
    </section>
  );
};
