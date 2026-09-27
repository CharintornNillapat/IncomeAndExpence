import React, { useMemo, useState } from 'react';
import { Download, Info } from 'lucide-react';
import { useFinanceState } from '../../context/FinanceContext';

/**
 * F5's companion policy (ADR 0024): signing in REPLACES this device's guest
 * ledger with the account's - it never merges. When the guest ledger holds
 * transactions, `AuthModal` says so before the user submits, and offers the
 * existing CSV export so nothing is lost without a choice.
 *
 * It subscribes to finance state itself, so `AuthModal` - shell-level and
 * `React.memo`'d - still never does (CLAUDE.md: no component above view level
 * subscribes). It renders only while the modal is open, because `Modal`
 * unmounts its body when closed.
 *
 * The exporter is loaded on click: `AuthModal` is eager, and a static import
 * would pull papaparse into the entry chunk for every visitor.
 */
export const GuestDataNotice: React.FC = () => {
  const { isAuthenticated, transactions, wallets, categories, debts } = useFinanceState();
  const [isExporting, setIsExporting] = useState(false);

  const guestTransactionCount = useMemo(
    () => transactions.filter((t) => !t.isDeleted).length,
    [transactions]
  );

  if (isAuthenticated || guestTransactionCount === 0) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { exportTransactionsToCsv } = await import('../../utils/csvExchange');
      exportTransactionsToCsv(transactions, wallets, categories, debts);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      id="auth-guest-data-notice"
      className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2"
    >
      <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="space-y-2">
        <p>
          This device holds <strong>{guestTransactionCount}</strong> guest transaction
          {guestTransactionCount === 1 ? '' : 's'}. Signing in replaces them with your account&apos;s data - they are
          not merged into it.
        </p>
        <button
          id="auth-guest-export-btn"
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExporting ? 'Preparing…' : 'Export them as CSV first'}</span>
        </button>
      </div>
    </div>
  );
};
