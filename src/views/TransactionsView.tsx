import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Plus, Search, X, Check } from 'lucide-react';
import { useFinanceState } from '../context/FinanceContext';
import { useTransactions } from '../hooks/useTransactions';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { Transaction, TransactionType } from '../types';
import { todayIsoDate } from '../utils/date';
import { exportTransactionsToCsv } from '../utils/csvExchange';
import { buildLookupMap } from '../utils/mapUtils';
import { OPTION_CLASS } from '../utils/formStyles';
import { TransactionForm } from '../components/TransactionForm';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { Money } from '../components/ui/Money';
import { OverflowMenu } from '../components/ui/OverflowMenu';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { TransactionRow } from '../components/transaction/TransactionRow';
import { DayGroupHeader } from '../components/transaction/DayGroupHeader';
import { TransactionDetails } from '../components/transaction/TransactionDrawer';
import { ImportCsvModal } from '../components/transaction/ImportCsvModal';
import { formatRangeLabel, rangeBounds, TimeRange } from '../selectors/timeRange';
import { groupByDay, sumIncome, sumSpending } from '../selectors/ledger';
import { PAGE_STEP, hasMoreRows, visibleRows } from '../selectors/pagination';
import { displayTitle, systemCategoryLabel } from '../selectors/display';

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

type TypeFilter = 'ALL' | 'INCOME' | 'EXPENSE' | 'TRANSFER';

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'ALL', label: 'All time' },
  { value: 'DAY', label: 'Today' },
  { value: 'WEEK', label: 'This week' },
  { value: 'MONTH', label: 'Past 30 days' },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'INCOME', label: 'Income' },
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'TRANSFER', label: 'Transfer' },
];

/** The filter row's selects: the same shape as the search box beside them. */
const FILTER_SELECT_CLASS =
  'min-h-[44px] py-2 px-3 text-xs rounded-lg border border-line-input bg-surface-2 text-fg focus:outline-none focus:ring-2 focus:ring-focus transition-control';

/** Newest day first; inside a day, the most recently recorded first. */
function byNewest(a: Transaction, b: Transaction): number {
  if (a.transactionDate !== b.transactionDate) return a.transactionDate < b.transactionDate ? 1 : -1;
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

/**
 * Spec 6.2 (Phase 58a, ADR 0031): a filter row, one list grouped by day with
 * "Load 25 more" (L12), and a side panel for the selected row that holds
 * Delete and Restore. Editing a row arrives in Phase 58b. The CSV import lives
 * in `ImportCsvModal`, unchanged.
 */
export const TransactionsView: React.FC<TransactionsViewProps> = ({
  initialWalletFilter,
  onConsumeInitialWalletFilter,
  onOpenTransfer,
  onNavigateToDebts,
}) => {
  const { wallets, categories, debts } = useFinanceState();

  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>(initialWalletFilter || 'ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<TypeFilter>('ALL');
  const [range, setRange] = useState<TimeRange>('ALL');

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

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const today = todayIsoDate();
  const bounds = useMemo(() => rangeBounds(range, today), [range, today]);

  // Filtering, soft-delete visibility and the write actions all come from the
  // domain hook; 'ALL' is the view's sentinel for "no filter", which the hook
  // expresses as `undefined`.
  const {
    transactions: filteredTransactions,
    rawTransactions,
    addTransaction,
    deleteTransaction,
    restoreTransaction,
    showSoftDeleted,
    setShowSoftDeleted,
  } = useTransactions({
    walletId: selectedWalletId === 'ALL' ? undefined : selectedWalletId,
    categoryId: selectedCategoryId === 'ALL' ? undefined : selectedCategoryId,
    type: selectedType === 'ALL' ? undefined : (selectedType as TransactionType),
    startDate: bounds.start ?? undefined,
    endDate: bounds.end ?? undefined,
    searchQuery: debouncedSearchTerm,
  });

  // L12: 25 at a time. A filter change starts the list again from the top.
  const [shownCount, setShownCount] = useState<number>(PAGE_STEP);
  useEffect(() => {
    setShownCount(PAGE_STEP);
  }, [debouncedSearchTerm, selectedWalletId, selectedCategoryId, selectedType, range, showSoftDeleted]);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  const walletMap = useMemo(() => buildLookupMap(wallets), [wallets]);
  const categoryMap = useMemo(() => buildLookupMap(categories), [categories]);

  // Active-only slices for the Add Transaction modal (Memoized, T9)
  const activeWalletsForForm = useMemo(() => wallets.filter((w) => !w.isDeleted), [wallets]);
  const activeCategoriesForForm = useMemo(() => categories.filter((c) => !c.isDeleted), [categories]);

  const sortedRows = useMemo(() => [...filteredTransactions].sort(byNewest), [filteredTransactions]);
  const shownRows = useMemo(() => visibleRows(sortedRows, shownCount), [sortedRows, shownCount]);
  const shownDays = useMemo(() => groupByDay(shownRows, categoryMap), [shownRows, categoryMap]);
  // L11: a day's net counts every filtered row of that day, not only the ones loaded so far.
  const dayNets = useMemo(
    () => new Map(groupByDay(sortedRows, categoryMap).map((day) => [day.date, day.net])),
    [sortedRows, categoryMap]
  );
  // The summary line follows the filters, on the L1 definition: a transfer, a
  // repayment and an adjustment are neither In nor Out, and neither is a deleted row.
  const totalIn = useMemo(() => sumIncome(sortedRows, categoryMap), [sortedRows, categoryMap]);
  const totalOut = useMemo(() => sumSpending(sortedRows, categoryMap), [sortedRows, categoryMap]);

  // The selected row. It closes when the row leaves the list, such as a
  // delete while "Show deleted" is off.
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const selectedTx = useMemo(
    () => (selectedTxId ? sortedRows.find((tx) => tx.id === selectedTxId) ?? null : null),
    [selectedTxId, sortedRows]
  );
  useEffect(() => {
    if (selectedTxId && !selectedTx) setSelectedTxId(null);
  }, [selectedTxId, selectedTx]);

  // One render path by width, never two copies hidden by CSS (ADR 0031).
  const isWide = useMediaQuery('(min-width: 1280px)');
  const drawerTitleRef = useRef<HTMLHeadingElement>(null);
  const lastSelectedRef = useRef<string | null>(null);

  const selectRow = useCallback((tx: Transaction) => {
    lastSelectedRef.current = tx.id;
    setSelectedTxId(tx.id);
  }, []);

  const closeDrawer = useCallback(() => {
    setSelectedTxId(null);
    // Back to the row that opened it, when it is still in the list.
    const rowId = lastSelectedRef.current;
    if (rowId) requestAnimationFrame(() => document.getElementById(`tx-row-${rowId}`)?.focus());
  }, []);

  // Keyboard users land on the panel they just opened.
  useEffect(() => {
    if (selectedTxId && isWide) drawerTitleRef.current?.focus();
  }, [selectedTxId, isWide]);

  const selectedCategory = selectedTx?.categoryId ? categoryMap.get(selectedTx.categoryId) : undefined;
  const details = selectedTx && (
    <TransactionDetails
      tx={selectedTx}
      category={selectedCategory}
      wallets={walletMap}
      onDelete={deleteTransaction}
      onRestore={restoreTransaction}
    />
  );

  const listCard = (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4 border-b border-line">
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold text-fg">{formatRangeLabel(range, today)}</span>
          <span className="text-fg-secondary">
            In <Money value={totalIn} showPlus className="font-semibold text-income" />
          </span>
          <span className="text-fg-secondary">
            Out <Money value={-totalOut} className="font-semibold text-expense" />
          </span>
        </p>
        <span className="text-xs text-fg-muted">Transfers and balance adjustments are not counted</span>
      </div>

      {sortedRows.length === 0 ? (
        <EmptyState icon={Search} title="No transactions match your current filters." />
      ) : (
        <div className="flex flex-col">
          {shownDays.map((day) => (
            <div key={day.date} className="flex flex-col">
              <DayGroupHeader date={day.date} today={today} net={dayNets.get(day.date) ?? day.net} />
              {day.transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  id={`tx-row-${tx.id}`}
                  tx={tx}
                  category={tx.categoryId ? categoryMap.get(tx.categoryId) : undefined}
                  wallets={walletMap}
                  onSelect={selectRow}
                  selected={tx.id === selectedTxId}
                  dateText={tx.transactionDate.slice(0, 10)}
                  className="px-5"
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {sortedRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-line text-xs text-fg-secondary">
          <span>
            Showing {shownRows.length} of {sortedRows.length}
          </span>
          {hasMoreRows(sortedRows, shownCount) && (
            <Button id="tx-load-more-btn" variant="secondary" onClick={() => setShownCount((n) => n + PAGE_STEP)}>
              Load {Math.min(PAGE_STEP, sortedRows.length - shownRows.length)} more
            </Button>
          )}
        </div>
      )}
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transactions"
        description="Click any row to see it, or to delete or restore it"
        actions={
          <>
            <OverflowMenu
              label="Import or export transactions"
              triggerLabel="Import / export"
              triggerId="tx-import-export-btn"
              items={[
                { id: 'tx-import-csv-btn', label: 'Import CSV', onSelect: () => setIsImportModalOpen(true) },
                {
                  id: 'tx-export-csv-btn',
                  label: 'Export CSV',
                  onSelect: () => exportTransactionsToCsv(rawTransactions, wallets, categories, debts),
                },
              ]}
            />
            <Button id="tx-open-add-modal-btn" onClick={() => setIsAddModalOpen(true)} icon={<Plus className="w-4 h-4" />}>
              Add transaction
            </Button>
          </>
        }
      />

      {/* Filter row, in the spec's order: search, range, wallet, category, type, show deleted. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="w-4 h-4 text-fg-muted absolute left-3 top-3.5 pointer-events-none" />
          <input
            id="tx-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search description, amount, math..."
            aria-label="Search transactions"
            className="w-full min-h-[44px] pl-9 pr-11 py-2 text-xs rounded-lg border border-line-input bg-surface-2 text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-focus transition-control"
          />
          {searchTerm && (
            <IconButton
              label="Clear search"
              onClick={() => {
                setSearchTerm('');
                setDebouncedSearchTerm('');
              }}
              className="absolute right-0 top-0"
            >
              <X className="w-3.5 h-3.5" />
            </IconButton>
          )}
        </div>

        <select
          id="tx-filter-range"
          aria-label="Date range"
          value={range}
          onChange={(e) => setRange(e.target.value as TimeRange)}
          className={FILTER_SELECT_CLASS}
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value} className={OPTION_CLASS}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          id="tx-filter-wallet"
          aria-label="Wallet"
          value={selectedWalletId}
          onChange={(e) => setSelectedWalletId(e.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="ALL" className={OPTION_CLASS}>All wallets</option>
          {wallets.map((w) => (
            <option key={w.id} value={w.id} className={OPTION_CLASS}>
              {w.name}
            </option>
          ))}
        </select>

        <select
          id="tx-filter-category"
          aria-label="Category"
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="ALL" className={OPTION_CLASS}>All categories</option>
          {activeCategoriesForForm.map((c) => (
            <option key={c.id} value={c.id} className={OPTION_CLASS}>
              {systemCategoryLabel(c)}
            </option>
          ))}
        </select>

        <SegmentedControl<TypeFilter>
          size="sm"
          ariaLabel="Type"
          value={selectedType}
          onChange={setSelectedType}
          options={TYPE_OPTIONS.map((option) => ({ ...option, id: `tx-filter-type-${option.value.toLowerCase()}` }))}
        />

        <div className="flex items-center gap-1 min-h-[44px]">
          <label htmlFor="tx-show-deleted" className="text-xs font-semibold text-fg-secondary cursor-pointer">
            Show deleted
          </label>
          {/* Same shape as the diary's workout checkbox: a drawn 16px box under a
              transparent 44px native input, which stays the element specs check. */}
          <span className="relative w-11 h-11 inline-flex items-center justify-center shrink-0">
            <input
              id="tx-show-deleted"
              type="checkbox"
              checked={showSoftDeleted}
              onChange={(e) => setShowSoftDeleted(e.target.checked)}
              className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <span
              aria-hidden="true"
              className="w-4 h-4 rounded-sm border border-line-input bg-surface-2 flex items-center justify-center peer-checked:bg-brand-fill peer-checked:border-brand-fill peer-focus-visible:ring-2 peer-focus-visible:ring-focus pointer-events-none"
            >
              {showSoftDeleted && <Check className="w-3 h-3 text-white" />}
            </span>
          </span>
        </div>
      </div>

      {/* Spec 6.2: the list takes the full width until a row is selected, then 8/12 beside the panel. */}
      {selectedTx && isWide ? (
        <div className="grid grid-cols-12 gap-4 items-start">
          <div className="col-span-8">{listCard}</div>
          <aside id="tx-drawer" aria-labelledby="tx-drawer-title" className="col-span-4 sticky top-20">
            <Card className="flex flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <h2 id="tx-drawer-title" ref={drawerTitleRef} tabIndex={-1} className="text-base font-semibold text-fg break-words min-w-0">
                  {displayTitle(selectedTx, selectedCategory)}
                </h2>
                <IconButton id="tx-drawer-close-btn" label="Close details" onClick={closeDrawer} className="-mr-2 -mt-2">
                  <X className="w-4 h-4" />
                </IconButton>
              </div>
              {details}
            </Card>
          </aside>
        </div>
      ) : (
        listCard
      )}

      {/* Below `xl` the same panel opens as a bottom sheet. Rendered only there, so it never doubles the inline one. */}
      <Modal
        isOpen={!!selectedTx && !isWide}
        onClose={closeDrawer}
        title={selectedTx ? displayTitle(selectedTx, selectedCategory) : ''}
        closeButtonId="tx-drawer-close-btn"
        maxWidthClassName="max-w-md"
      >
        {!isWide && details}
      </Modal>

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

      <ImportCsvModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
    </div>
  );
};
