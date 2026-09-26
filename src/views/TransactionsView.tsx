import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  Plus, 
  Download, 
  Upload, 
  Search, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Sparkles,
} from 'lucide-react';
import { useFinanceState } from '../context/FinanceContext';
import { useTransactions } from '../hooks/useTransactions';
import { ImportPreviewSummary, ImportRowValidation, TransactionType } from '../types';
import { todayIsoDate } from '../utils/date';
import { formatCurrencyAmount } from '../utils/currency';
import { exportTransactionsToCsv, parseAndValidateTransactionCsv } from '../utils/csvExchange';
import { exportDiaryToJson } from '../utils/diaryExport';
import { TransactionForm } from '../components/TransactionForm';
import { TransactionTableRow } from '../components/TransactionTableRow';
import { Modal } from '../components/Modal';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { buildLookupMap } from '../utils/mapUtils';
import { useTransientFlash } from '../hooks/useTransientFlash';
import { OPTION_CLASS } from '../utils/formStyles';
import { matchSmartDescription } from '../utils/smartMatcher';
import { toClassifyCandidates } from '../utils/jevClassifier';
import type { JevSuggestion } from '../utils/jevClassifier';
import { classifyBatch } from '../utils/batchClassifier';
import type { BatchClassifyProgress } from '../utils/batchClassifier';

// Caps the CSV dry-run preview's rendered rows so a large import doesn't put
// thousands of `<tr>`s in the DOM at once - the summary counts above the
// table already total the whole file, and every valid row still commits
// regardless of whether it was rendered in this preview.
const CSV_PREVIEW_ROW_CAP = 100;

interface TransactionsViewProps {
  /** Pre-selects the wallet filter (T40: the wallet popup's Activity preview hands off here via "View all"). */
  initialWalletFilter?: string;
  /** Called once, right after mount, when `initialWalletFilter` was set - lets the caller clear its own state so a later, unrelated navigation to this tab does not inherit a stale filter. */
  onConsumeInitialWalletFilter?: () => void;
  /** Opens the shell-level `TransferFundsModal` (ADR 0013: TRANSFER is no longer a type in the entry form). */
  onOpenTransfer?: () => void;
  /** Switches to the Debts tab, where repayments live. */
  onNavigateToDebts?: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  initialWalletFilter,
  onConsumeInitialWalletFilter,
  onOpenTransfer,
  onNavigateToDebts,
}) => {
  const {
    wallets,
    categories,
    keywordRules,
    diaryEntries,
  } = useFinanceState();

  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>(initialWalletFilter || 'ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // This view remounts fresh on every navigation to the tab (App.tsx keys the
  // active view by `activeTab`, so switching away and back unmounts it), so
  // the initializer above only ever needs to run once per mount - consuming
  // the filter here (rather than leaving it in App.tsx state) prevents a
  // later, unrelated tab switch from silently inheriting a stale wallet id.
  useEffect(() => {
    if (initialWalletFilter) {
      onConsumeInitialWalletFilter?.();
    }
    // eslint-disable-next-line
  }, []);

  // Filtering, soft-delete visibility and the write actions all come from the
  // domain hook; 'ALL' is the view's sentinel for "no filter", which the hook
  // expresses as `undefined`.
  const {
    transactions: filteredTransactions,
    rawTransactions,
    addTransaction,
    deleteTransaction,
    restoreTransaction,
    commitBulkImport,
    showSoftDeleted,
    setShowSoftDeleted,
  } = useTransactions({
    walletId: selectedWalletId === 'ALL' ? undefined : selectedWalletId,
    type: selectedType === 'ALL' ? undefined : (selectedType as TransactionType),
    searchQuery: debouncedSearchTerm,
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedWalletId, selectedType, showSoftDeleted]);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  
  // CSV Import State
  const [importPreview, setImportPreview] = useState<ImportPreviewSummary | null>(null);
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [importCommitError, setImportCommitError] = useState<string | null>(null);
  const [isCommittingImport, setIsCommittingImport] = useState<boolean>(false);
  // A ref as well as the state: a fast double-tap lands both clicks before the
  // disabled state commits, and the second click would insert every row again
  // (the idempotency keys are per-row and `Date.now()`-based). This is an
  // in-flight guard, not import dedupe - ADR 0019 and `csv.spec.ts` still
  // expect two separate imports of the same row to produce two rows.
  const commitInFlightRef = useRef<boolean>(false);
  const [isParsingCsv, setIsParsingCsv] = useState<boolean>(false);
  const { value: importSuccessMsg, flash: flashImportSuccess, clear: clearImportSuccess } = useTransientFlash<string | null>(null);

  /*
   * Layer 2 state (ADR 0019). All preview-only: none of it reaches
   * `commitBulkImport`, which reads `categoryId` off the row and nothing else.
   * `ImportRowValidation` is the commit payload and deliberately does not
   * carry confidence or applied/suggested state.
   */
  const [rowSuggestions, setRowSuggestions] = useState<Map<number, JevSuggestion>>(new Map());
  const [classifyProgress, setClassifyProgress] = useState<BatchClassifyProgress | null>(null);
  const [classifyNote, setClassifyNote] = useState<string | null>(null);
  const classifyAbortRef = useRef<AbortController | null>(null);

  // Maps for O(1) row lookups
  const walletMap = useMemo(() => buildLookupMap(wallets), [wallets]);

  const categoryMap = useMemo(() => buildLookupMap(categories), [categories]);

  // Active-only slices for the Add Transaction modal (Memoized, T9)
  const activeWalletsForForm = useMemo(() => wallets.filter((w) => !w.isDeleted), [wallets]);
  const activeCategoriesForForm = useMemo(() => categories.filter((c) => !c.isDeleted), [categories]);

  const handleRestoreTx = useCallback((id: string) => {
    restoreTransaction(id);
  }, [restoreTransaction]);

  const handleDeleteTx = useCallback((id: string) => {
    deleteTransaction(id);
  }, [deleteTransaction]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // Handle CSV File Selection (Step 1: Dry-Run Parse)
  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileError(null);
    setImportCommitError(null);
    clearImportSuccess();
    setIsParsingCsv(true);

    resetClassification();

    try {
      const text = await file.text();
      const preview = await parseAndValidateTransactionCsv(text, wallets);
      // Layer 1 runs here, synchronously and for free, before the preview is
      // ever shown (ADR 0011's ordering, applied to the bulk path).
      setImportPreview(applyRuleLayer(preview));
    } catch (err: any) {
      setImportFileError(err.message || 'Failed to parse CSV file');
    } finally {
      setIsParsingCsv(false);
    }
  };

  /*
   * ------------------------------------------------------------------
   * The importer's two categorization layers (ADR 0019)
   * ------------------------------------------------------------------
   */

  /**
   * A row is eligible when it is valid and its `categoryName` does not resolve
   * to a live category. That covers both "no Category column" and "names a
   * category you do not have" - in either case the row was going to commit
   * uncategorized, so filling it can only improve on the status quo.
   */
  const isEligibleForCategorization = useCallback(
    (row: ImportRowValidation): boolean => {
      if (!row.isValid) return false;
      if (row.categoryId) return false;
      if (!row.categoryName) return true;
      const named = row.categoryName.trim().toLowerCase();
      return !categories.some((c) => !c.isDeleted && c.name.trim().toLowerCase() === named);
    },
    [categories]
  );

  const resetClassification = () => {
    classifyAbortRef.current?.abort();
    classifyAbortRef.current = null;
    setRowSuggestions(new Map());
    setClassifyProgress(null);
    setClassifyNote(null);
  };

  /** Layer 1: the synchronous keyword matcher, authoritative and free. */
  const applyRuleLayer = (preview: ImportPreviewSummary): ImportPreviewSummary => ({
    ...preview,
    rows: preview.rows.map((row) => {
      if (!isEligibleForCategorization(row)) return row;
      const match = matchSmartDescription(row.description, keywordRules, categories);
      // A rule may only supply a category whose type agrees with the row's.
      // `type` drives the wallet debit direction in `commitBulkImport` and is
      // never changed here, so a disagreement means the rule does not apply.
      if (!match.categoryId || match.type !== row.type) return row;
      return { ...row, categoryId: match.categoryId };
    }),
  });

  const uncategorizedRows = useMemo(
    () => (importPreview ? importPreview.rows.filter(isEligibleForCategorization) : []),
    [importPreview, isEligibleForCategorization]
  );

  const ruleMatchedCount = useMemo(
    () => (importPreview ? importPreview.rows.filter((r) => r.isValid && r.categoryId).length : 0),
    [importPreview]
  );

  /** Layer 2: Jev, on the rows Layer 1 did not resolve, behind an explicit tap. */
  const handleClassifyRemaining = async () => {
    if (!importPreview || uncategorizedRows.length === 0) return;

    const controller = new AbortController();
    classifyAbortRef.current = controller;
    setClassifyNote(null);
    setClassifyProgress({ done: 0, total: uncategorizedRows.length });

    const candidates = toClassifyCandidates(categories);
    const result = await classifyBatch(
      uncategorizedRows.map((r) => ({ id: r.rowIndex, text: r.description })),
      categories,
      candidates,
      { onProgress: setClassifyProgress, signal: controller.signal }
    );

    classifyAbortRef.current = null;
    setClassifyProgress(null);

    if (controller.signal.aborted) return;

    if (result.unavailable) {
      // A very different message from "nothing matched": the endpoint is not
      // there (an unconfigured deployment, or the dev server, which does not
      // serve `api/`). The import still commits perfectly well without it.
      setClassifyNote('Jev is unavailable right now — import still works, categories stay blank.');
      return;
    }

    // Only AUTO_FILL is written. SUGGEST is held in `rowSuggestions` for the
    // user to accept with one click, mirroring the live form's gate exactly.
    setImportPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((row) => {
          const suggestion = result.suggestions.get(row.rowIndex);
          if (!suggestion || !isEligibleForCategorization(row)) return row;
          // A category whose type disagrees with the row's is demoted to a
          // suggestion, never applied - the row's own `type` is authoritative
          // because it drives the wallet debit direction.
          if (suggestion.strength !== 'AUTO_FILL' || suggestion.type !== row.type) return row;
          return { ...row, categoryId: suggestion.categoryId };
        }),
      };
    });

    setRowSuggestions(result.suggestions);

    const autoFilled = Array.from(result.suggestions.values()).filter((s) => s.strength === 'AUTO_FILL').length;
    setClassifyNote(
      `Classified ${result.suggestions.size} of ${uncategorizedRows.length} — ${autoFilled} applied, ` +
        `${result.suggestions.size - autoFilled} to confirm. ${result.attempted} request${result.attempted === 1 ? '' : 's'} sent.`
    );
  };

  /** A manual pick, or accepting a mid-confidence suggestion. Always wins. */
  const setRowCategory = (rowIndex: number, categoryId: string) => {
    setImportPreview((prev) =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map((row) =>
              row.rowIndex === rowIndex ? { ...row, categoryId: categoryId || undefined } : row
            ),
          }
        : prev
    );
  };

  // Handle Commit Import (Step 2). Not a database transaction: the rows are
  // inserted, then balances are written, and a failure part-way is
  // compensated by `commitBulkImport` (ADR 0022).
  const handleCommitImport = async () => {
    if (!importPreview || importPreview.validRowsCount === 0) return;
    if (commitInFlightRef.current) return;
    commitInFlightRef.current = true;
    setIsCommittingImport(true);
    setImportCommitError(null);

    try {
      const validRows = importPreview.rows.filter((r) => r.isValid);
      const result = await commitBulkImport(validRows);

      if (!result.success) {
        // Keep the preview open and populated so the user can retry.
        setImportCommitError(result.error || 'The import could not be saved.');
        return;
      }

      const skippedNote = result.skippedCount > 0
        ? ` ${result.skippedCount} row${result.skippedCount === 1 ? '' : 's'} skipped (unknown or deleted wallet).`
        : '';
      setImportPreview(null);
      resetClassification();
      flashImportSuccess(
        `Successfully imported ${result.insertedCount} transactions (${formatCurrencyAmount(result.totalAmount)})!${skippedNote}`,
        2000,
        () => setIsImportModalOpen(false)
      );
    } finally {
      commitInFlightRef.current = false;
      setIsCommittingImport(false);
    }
  };

  // Download Sample CSV
  const handleDownloadSampleCsv = () => {
    const sampleCsv = `Date,Wallet,Category,Type,Amount,Description,DestinationWallet\n${todayIsoDate()},Chase Checking,Food & Dining,EXPENSE,35.50,Lunch with team,\n${todayIsoDate()},Chase Checking,Salary,INCOME,3200.00,Monthly Paycheck,\n${todayIsoDate()},Chase Checking,,TRANSFER,500.00,Savings Deposit,Marcus High-Yield Savings`;
    const blob = new Blob([sampleCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_transactions_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader
        title="Transaction Management"
        subtitle="CRUD operations with soft-delete safety, math parser, and 2-step CSV synchronization"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* CSV Export */}
            <button
              id="tx-export-csv-btn"
              type="button"
              onClick={() => exportTransactionsToCsv(rawTransactions, wallets, categories)}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            {/* Diary JSON Export */}
            <button
              id="diary-export-json-btn"
              type="button"
              onClick={() => exportDiaryToJson(diaryEntries)}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
              <span className="hidden sm:inline">Export Diary (JSON)</span>
              <span className="sm:hidden">Diary</span>
            </button>

            {/* 2-Step Import CSV */}
            <button
              id="tx-import-csv-btn"
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl border border-indigo-200 dark:border-indigo-800/60 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import CSV</span>
            </button>

            {/* Add Transaction */}
            <button
              id="tx-open-add-modal-btn"
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white dark:text-stone-900 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
              <span>Add Transaction</span>
            </button>
          </div>
        }
      />

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-stone-900 p-3.5 sm:p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3 top-3 pointer-events-none" />
            <input
              id="tx-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search description, amount, math..."
              className="w-full min-h-[44px] pl-9 pr-8 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setDebouncedSearchTerm('');
                }}
                className="absolute right-2.5 top-2.5 p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Wallet Filter */}
          <div>
            <select
              id="tx-filter-wallet"
              value={selectedWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              className="w-full min-h-[44px] py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
            >
              <option value="ALL">All Wallets</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id} className={OPTION_CLASS}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              id="tx-filter-type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full min-h-[44px] py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
            >
              <option value="ALL">All Types</option>
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
              <option value="TRANSFER">Transfer</option>
              <option value="DEBT_REPAYMENT">Debt Repayment</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </div>

          {/* Soft Delete Switch */}
          <div className="flex items-center justify-between sm:justify-end gap-2 px-1 min-h-[44px]">
            <label htmlFor="tx-show-deleted" className="text-xs font-semibold text-stone-600 dark:text-stone-300 cursor-pointer">
              Show Soft Deleted
            </label>
            <input
              id="tx-show-deleted"
              type="checkbox"
              checked={showSoftDeleted}
              onChange={(e) => setShowSoftDeleted(e.target.checked)}
              className="w-4 h-4 rounded border-stone-300 dark:border-stone-600 text-stone-900 dark:text-stone-100 focus:ring-stone-800 dark:focus:ring-stone-400 cursor-pointer accent-stone-900 dark:accent-stone-100"
            />
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 dark:bg-stone-800/80 border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-3 sm:px-4">Date</th>
                <th className="py-3 px-3 sm:px-4">Details</th>
                <th className="hidden md:table-cell py-3 px-4">Wallet</th>
                <th className="hidden sm:table-cell py-3 px-4">Category</th>
                <th className="py-3 px-3 sm:px-4 text-right">Amount</th>
                <th className="py-3 px-2 sm:px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon={Search} title="No transactions match your current filters." />
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => (
                  <TransactionTableRow
                    key={tx.id}
                    tx={tx}
                    wallet={walletMap.get(tx.walletId)}
                    destWallet={tx.destinationWalletId ? walletMap.get(tx.destinationWalletId) : undefined}
                    category={tx.categoryId ? categoryMap.get(tx.categoryId) : undefined}
                    onRestore={handleRestoreTx}
                    onDelete={handleDeleteTx}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-stone-50 dark:bg-stone-800/60 border-t border-stone-200 dark:border-stone-800 text-xs">
          <span className="text-stone-500 dark:text-stone-400 text-center sm:text-left text-[11px] sm:text-xs">
            Showing {filteredTransactions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredTransactions.length)} of {filteredTransactions.length} entries
          </span>

          <div className="flex items-center gap-1.5">
            <button
              id="tx-prev-page-btn"
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="min-h-[44px] px-3.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium hover:bg-stone-50 dark:hover:bg-stone-750 transition-colors"
            >
              Previous
            </button>
            <span className="px-2 font-mono font-semibold text-stone-800 dark:text-stone-200">
              {currentPage} / {totalPages}
            </span>
            <button
              id="tx-next-page-btn"
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="min-h-[44px] px-3.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium hover:bg-stone-50 dark:hover:bg-stone-750 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      {/* Add Transaction Modal / Responsive Mobile Bottom Sheet */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Record New Transaction"
        subtitle="Add an expense or income"
        titleId="add-transaction-modal-title"
        closeButtonId="close-add-transaction-modal-btn"
        maxWidthClassName="max-w-xl"
      >
        <TransactionForm
          wallets={activeWalletsForForm}
          categories={activeCategoriesForForm}
          formTestId="tx-form-page"
          onRequestTransfer={
            onOpenTransfer &&
            (() => {
              setIsAddModalOpen(false);
              onOpenTransfer();
            })
          }
          onRequestRepayDebt={
            onNavigateToDebts &&
            (() => {
              setIsAddModalOpen(false);
              onNavigateToDebts();
            })
          }
          onSubmitTransaction={async (data) => {
            const res = await addTransaction({
              ...data,
              transactionDate: data.date,
            });
            if (res && res.success) {
              setIsAddModalOpen(false);
            }
            return res;
          }}
        />
      </Modal>

      {/* Two-Step CSV Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportPreview(null);
          setImportCommitError(null);
          // Aborts a run still in flight - closing the modal must not leave
          // requests walking a list nobody is looking at any more.
          resetClassification();
        }}
        title="Two-Step CSV Transaction Import"
        subtitle="Step 1: Dry-run parse & validate rows → Step 2: Commit valid rows into your ledger"
        maxWidthClassName="max-w-3xl"
        bodyClassName="space-y-6"
      >
        {/* Step 1: Upload File */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Select CSV File
            </label>
            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3" /> Download Sample CSV Template
            </button>
          </div>

          <input
            id="csv-file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvFileUpload}
            className="w-full text-xs text-stone-600 dark:text-stone-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-stone-900 dark:file:bg-stone-100 file:text-white dark:file:text-stone-900 hover:file:bg-stone-800 dark:hover:file:bg-white cursor-pointer border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 rounded-xl p-2"
          />

          {isParsingCsv && (
            <p className="text-xs text-stone-500 dark:text-stone-400 animate-pulse">Running dry-run validation checks...</p>
          )}

          {importFileError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{importFileError}</span>
            </div>
          )}

          {importSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{importSuccessMsg}</span>
            </div>
          )}
        </div>

        {/* Dry Run Preview Summary & Table */}
        {importPreview && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-4 gap-3 bg-stone-50 dark:bg-stone-800/80 p-3 rounded-xl border border-stone-200 dark:border-stone-700 text-xs">
              <div>
                <span className="text-stone-500 dark:text-stone-400 block">Total Rows</span>
                <span className="font-bold text-stone-900 dark:text-stone-100 font-mono text-sm">{importPreview.totalRows}</span>
              </div>
              <div>
                <span className="text-stone-500 dark:text-stone-400 block">Valid Rows</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">{importPreview.validRowsCount}</span>
              </div>
              <div>
                <span className="text-stone-500 dark:text-stone-400 block">Errors / Invalid</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 font-mono text-sm">{importPreview.invalidRowsCount}</span>
              </div>
              <div>
                <span className="text-stone-500 dark:text-stone-400 block">Total Amount</span>
                <span className="font-bold text-stone-900 dark:text-stone-100 font-mono text-sm">{formatCurrencyAmount(importPreview.totalAmount)}</span>
              </div>
            </div>

            {/*
              The importer's two categorization layers (ADR 0019). Layer 1 has
              already run by the time this renders - it is synchronous and
              free. Layer 2 is behind this button on purpose: nothing touches
              the network or spends TypeSafe credits until it is pressed,
              which is also how you skip it when offline or in a hurry.
            */}
            <div className="flex flex-col gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs text-stone-600 dark:text-stone-300">
                  <strong className="font-mono font-bold text-stone-900 dark:text-stone-100">{ruleMatchedCount}</strong>{' '}
                  matched by rules &middot;{' '}
                  <strong className="font-mono font-bold text-stone-900 dark:text-stone-100">{uncategorizedRows.length}</strong>{' '}
                  uncategorized
                </span>

                {uncategorizedRows.length > 0 && !classifyProgress && (
                  <button
                    type="button"
                    id="csv-classify-btn"
                    onClick={handleClassifyRemaining}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Classify remaining with Jev
                  </button>
                )}

                {classifyProgress && (
                  <button
                    type="button"
                    id="csv-classify-cancel-btn"
                    onClick={() => classifyAbortRef.current?.abort()}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {classifyProgress && (
                <div data-testid="csv-classify-progress" className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-stone-600 dark:text-stone-300">
                    Classifying {classifyProgress.done} of {classifyProgress.total} with Jev&hellip;
                  </span>
                  <div className="h-1.5 w-full rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                    <div
                      className="h-full bg-stone-900 dark:bg-stone-100 transition-all"
                      style={{
                        width: `${classifyProgress.total > 0 ? (classifyProgress.done / classifyProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {classifyNote && !classifyProgress && (
                <p data-testid="csv-classify-note" className="text-[11px] font-medium text-stone-600 dark:text-stone-400">
                  {classifyNote}
                </p>
              )}
            </div>

            {/* Dry Run Row Table */}
            <div className="max-h-60 overflow-y-auto rounded-xl border border-stone-200 dark:border-stone-700 text-xs">
              <table className="w-full text-left">
                <thead className="bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 sticky top-0 font-semibold">
                  <tr>
                    <th className="p-2">Row</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Date</th>
                    <th className="p-2">Wallet</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Description / Error</th>
                    <th className="p-2">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {importPreview.rows.slice(0, CSV_PREVIEW_ROW_CAP).map((row) => (
                    <tr key={row.rowIndex} className={row.isValid ? 'bg-white dark:bg-stone-900' : 'bg-rose-50/50 dark:bg-rose-950/30'}>
                      <td className="p-2 font-mono text-stone-500 dark:text-stone-400">{row.rowIndex}</td>
                      <td className="p-2">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400 font-semibold text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5" /> Error
                          </span>
                        )}
                      </td>
                      <td className="p-2 font-mono text-stone-700 dark:text-stone-300">{row.date}</td>
                      <td className="p-2 text-stone-700 dark:text-stone-300">{row.walletName}</td>
                      <td className="p-2 font-mono font-bold text-stone-900 dark:text-stone-100">{formatCurrencyAmount(row.amount)}</td>
                      <td className="p-2">
                        {row.isValid ? (
                          <span className="text-stone-700 dark:text-stone-300">{row.description}</span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 font-medium">{row.errorMessage}</span>
                        )}
                      </td>
                      {/*
                        The override channel. A manual pick writes `categoryId`
                        directly and always wins - neither layer ever revisits a
                        row, and `commitBulkImport` prefers the id it finds here.
                      */}
                      <td className="p-2">
                        {row.isValid ? (
                          <div className="flex flex-col gap-1">
                            <select
                              data-testid={`csv-row-category-${row.rowIndex}`}
                              value={row.categoryId || ''}
                              onChange={(e) => setRowCategory(row.rowIndex, e.target.value)}
                              className="w-full max-w-[10rem] text-[11px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-1.5 py-1 text-stone-900 dark:text-stone-100 cursor-pointer"
                            >
                              <option value="" className={OPTION_CLASS}>
                                Uncategorized
                              </option>
                              {activeCategoriesForForm.map((c) => (
                                <option key={c.id} value={c.id} className={OPTION_CLASS}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            {(() => {
                              const suggestion = rowSuggestions.get(row.rowIndex);
                              if (!suggestion) return null;
                              // Applied: report it. Not applied (mid-confidence,
                              // or a type disagreement): offer it as one click.
                              if (row.categoryId === suggestion.categoryId) {
                                return (
                                  <span
                                    data-testid={`csv-row-confidence-${row.rowIndex}`}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
                                  >
                                    <Sparkles className="w-2.5 h-2.5" />
                                    {Math.round(suggestion.confidence * 100)}%
                                  </span>
                                );
                              }
                              return (
                                <button
                                  type="button"
                                  data-testid={`csv-row-confidence-${row.rowIndex}`}
                                  onClick={() => setRowCategory(row.rowIndex, suggestion.categoryId)}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-stone-600 dark:text-stone-300 underline underline-offset-2 hover:text-stone-900 dark:hover:text-white cursor-pointer text-left"
                                >
                                  <Sparkles className="w-2.5 h-2.5 shrink-0" />
                                  {suggestion.categoryName} ({Math.round(suggestion.confidence * 100)}%)
                                </button>
                              );
                            })()}
                          </div>
                        ) : (
                          <span className="text-stone-400 dark:text-stone-600">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {importPreview.rows.length > CSV_PREVIEW_ROW_CAP && (
                  <tfoot>
                    <tr>
                      <td colSpan={7} className="p-2 text-center text-stone-500 dark:text-stone-400 italic">
                        +{importPreview.rows.length - CSV_PREVIEW_ROW_CAP} more rows omitted from preview
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Same banner as the Step 1 file error, so the modal reads as one surface. */}
            {importCommitError && (
              <div
                id="import-commit-error"
                role="alert"
                className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Import failed: {importCommitError}</span>
              </div>
            )}

            {/* Step 2 Confirmation Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Commit inserts every valid row, then updates wallet balances. If the insert fails, nothing changes.
              </p>
              <button
                id="commit-import-btn"
                type="button"
                disabled={importPreview.validRowsCount === 0 || isCommittingImport}
                onClick={handleCommitImport}
                className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer ${
                  importPreview.validRowsCount > 0 && !isCommittingImport
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                    : 'bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-600 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isCommittingImport ? 'Importing…' : `Confirm & Commit (${importPreview.validRowsCount} Rows)`}
                </span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
