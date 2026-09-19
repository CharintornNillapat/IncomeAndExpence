import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Plus, 
  Download, 
  Upload, 
  Search, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  X,
} from 'lucide-react';
import { useFinanceState } from '../context/FinanceContext';
import { useTransactions } from '../hooks/useTransactions';
import { ImportPreviewSummary, TransactionType } from '../types';
import { todayIsoDate } from '../utils/date';
import { formatCurrencyAmount } from '../utils/currency';
import { exportTransactionsToCsv, exportDiaryToJson, parseAndValidateTransactionCsv } from '../utils/csvExchange';
import { TransactionForm } from '../components/TransactionForm';
import { TransactionTableRow } from '../components/TransactionTableRow';
import { Modal } from '../components/Modal';
import { buildLookupMap } from '../utils/mapUtils';
import { useTransientFlash } from '../hooks/useTransientFlash';
import { OPTION_CLASS } from '../utils/formStyles';

interface TransactionsViewProps {
  /** Pre-selects the wallet filter (T40: the wallet popup's Activity preview hands off here via "View all"). */
  initialWalletFilter?: string;
  /** Called once, right after mount, when `initialWalletFilter` was set - lets the caller clear its own state so a later, unrelated navigation to this tab does not inherit a stale filter. */
  onConsumeInitialWalletFilter?: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  initialWalletFilter,
  onConsumeInitialWalletFilter,
}) => {
  const {
    wallets,
    categories,
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
  const [isParsingCsv, setIsParsingCsv] = useState<boolean>(false);
  const { value: importSuccessMsg, flash: flashImportSuccess, clear: clearImportSuccess } = useTransientFlash<string | null>(null);

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
    clearImportSuccess();
    setIsParsingCsv(true);

    try {
      const text = await file.text();
      const preview = await parseAndValidateTransactionCsv(text, wallets);
      setImportPreview(preview);
    } catch (err: any) {
      setImportFileError(err.message || 'Failed to parse CSV file');
    } finally {
      setIsParsingCsv(false);
    }
  };

  // Handle Commit Import (Step 2: Single Atomic Batch)
  const handleCommitImport = async () => {
    if (!importPreview || importPreview.validRowsCount === 0) return;

    const validRows = importPreview.rows.filter((r) => r.isValid);
    const result = await commitBulkImport(validRows);

    const skippedNote = result.skippedCount > 0
      ? ` ${result.skippedCount} row${result.skippedCount === 1 ? '' : 's'} skipped (unknown or deleted wallet).`
      : '';
    setImportPreview(null);
    flashImportSuccess(
      `Successfully imported ${result.insertedCount} transactions (${formatCurrencyAmount(result.totalAmount)})!${skippedNote}`,
      2000,
      () => setIsImportModalOpen(false)
    );
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
      {/* Header & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white dark:bg-stone-900 p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-stone-900 dark:text-white">Transaction Management</h2>
          <p className="hidden sm:block text-xs text-stone-500 dark:text-stone-400">
            CRUD operations with soft-delete safety, math parser, and 2-step CSV synchronization
          </p>
        </div>

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
      </div>

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
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs overflow-hidden">
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
                  <td colSpan={6} className="text-center py-10 text-stone-400 dark:text-stone-500">
                    No transactions match your current filters.
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
      </div>

      {/* Add Transaction Modal / Responsive Mobile Bottom Sheet */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Record New Transaction"
        subtitle="Add an expense, income, transfer, or debt payment"
        titleId="add-transaction-modal-title"
        closeButtonId="close-add-transaction-modal-btn"
        maxWidthClassName="max-w-xl"
      >
        <TransactionForm
          wallets={activeWalletsForForm}
          categories={activeCategoriesForForm}
          formTestId="tx-form-page"
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
        }}
        title="Two-Step CSV Transaction Import"
        subtitle={'Step 1: Dry-run parse & validate rows $\\rightarrow$ Step 2: Atomic commit into MySQL'}
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {importPreview.rows.map((row) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Step 2 Confirmation Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Executing commit will insert valid entries & update wallet balances inside a single transaction.
              </p>
              <button
                id="commit-import-btn"
                type="button"
                disabled={importPreview.validRowsCount === 0}
                onClick={handleCommitImport}
                className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer ${
                  importPreview.validRowsCount > 0
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                    : 'bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-600 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Commit ({importPreview.validRowsCount} Rows)</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
