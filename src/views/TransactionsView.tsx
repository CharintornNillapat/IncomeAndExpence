import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Plus, Search, X, Check, ArrowLeftRight } from 'lucide-react';
import { useFinanceState } from '../context/FinanceContext';
import { useDiaryState } from '../context/DiaryContext';
import { useTransactions } from '../hooks/useTransactions';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { Transaction, TransactionType } from '../types';
import { formatShortDate, formatWeekdayDate, monthKeyOf, shiftMonth, todayIsoDate } from '../utils/date';
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
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { TransactionRow } from '../components/transaction/TransactionRow';
import { DayGroupHeader } from '../components/transaction/DayGroupHeader';
import { TransactionDetails } from '../components/transaction/TransactionDrawer';
import { ImportCsvModal } from '../components/transaction/ImportCsvModal';
import { TransactionsTable } from '../components/transaction/TransactionsTable';
import { TxCalendar, TxCalendarDay } from '../components/transaction/TxCalendar';
import { TxDayPanel } from '../components/transaction/TxDayPanel';
import { SelectCheckbox } from '../components/transaction/SelectCheckbox';
import { TxBulkBar } from '../components/transaction/TxBulkBar';
import { readTxView, writeTxView, TxViewMode } from '../utils/txViewPreference';
import { formatRangeLabel, monthBounds, rangeBounds, TimeRange } from '../selectors/timeRange';
import { cashFlow, dailyTotals, groupByDay, heatLevel, selectionSummary, sumIncome, sumSpending } from '../selectors/ledger';
import { PAGE_STEP, hasMoreRows, visibleRows } from '../selectors/pagination';
import { displayTitle, systemCategoryLabel } from '../selectors/display';
import { activeWallets, byNewest } from '../selectors/wallets';

interface TransactionsViewProps {
  /** Pre-selects the wallet filter (T40: the wallet popup's Activity preview hands off here via "View all"). */
  initialWalletFilter?: string;
  /** Called once, right after mount, when `initialWalletFilter` was set - lets the caller clear its own state so a later, unrelated navigation to this tab does not inherit a stale filter. */
  onConsumeInitialWalletFilter?: () => void;
  /** Opens this row's panel on arrival (the Dashboard's Recent activity hands off here, Phase 58b). */
  initialSelectedTxId?: string;
  /** Called once, right after mount, when `initialSelectedTxId` was set, for the same reason as the wallet filter's. */
  onConsumeInitialSelectedTx?: () => void;
  /** Shows one local calendar day only (the Daily diary's "N transactions" hands off here, Phase 61). */
  initialDayFilter?: string;
  /** Called once, right after mount, when `initialDayFilter` was set, for the same reason as the wallet filter's. */
  onConsumeInitialDayFilter?: () => void;
  /** Opens the Daily diary on this local day (the Calendar view's day panel hands off here, ADR 0109). */
  onOpenDiaryDay?: (date: string) => void;
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

/** The range select's value while a diary day filter is on; never a `TimeRange`. */
const DAY_FILTER_OPTION = 'DAY_FILTER';

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'INCOME', label: 'Income' },
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'TRANSFER', label: 'Transfer' },
];

/** The filter row's selects: the same shape as the search box beside them, sharing a row evenly on a phone. */
const FILTER_SELECT_CLASS =
  'flex-1 min-w-[8rem] sm:flex-none min-h-[44px] py-2 px-3 text-xs rounded-lg border border-line-input bg-surface-2 text-fg focus:outline-none focus:ring-2 focus:ring-focus transition-control';

/**
 * Subscribes to `DiaryStateContext` only while the Calendar view is open, so the
 * Table view keeps zero diary re-renders (ADR 0092, ADR 0093, ADR 0109).
 */
const CalendarDayPanel: React.FC<Omit<React.ComponentProps<typeof TxDayPanel>, 'hasDiaryEntry'>> = (props) => {
  const { diaryEntries } = useDiaryState();
  const hasDiaryEntry = useMemo(
    () => (props.day !== null ? diaryEntries.some((e) => !e.isDeleted && e.date === props.day) : false),
    [props.day, diaryEntries]
  );
  return <TxDayPanel {...props} hasDiaryEntry={hasDiaryEntry} />;
};

/** Newest day first; inside a day, the most recently recorded first. */
/**
 * Spec 6.2 (Phase 58a, ADR 0031): a filter row, one list grouped by day with
 * "Load 25 more" (L12), and a side panel for the selected row. Since Phase 58b
 * (ADR 0033) the panel edits a live row and restores a deleted one. The CSV
 * import lives in `ImportCsvModal`. Phase 149 (ADR 0109) adds the Table/Calendar
 * view switch (`readTxView` / `writeTxView`), renders `TransactionsTable` in
 * the Table view from `lg` up, and renders `TxCalendar` + `TxDayPanel` in the
 * Calendar view.
 */
export const TransactionsView: React.FC<TransactionsViewProps> = ({
  initialWalletFilter,
  onConsumeInitialWalletFilter,
  initialSelectedTxId,
  onConsumeInitialSelectedTx,
  initialDayFilter,
  onConsumeInitialDayFilter,
  onOpenDiaryDay,
  onOpenTransfer,
  onNavigateToDebts,
}) => {
  const { wallets, categories, debts } = useFinanceState();
  const today = todayIsoDate();

  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>(initialWalletFilter || 'ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<TypeFilter>('ALL');
  const [range, setRange] = useState<TimeRange>('ALL');
  // Phase 61 (ADR 0036): one day, handed off from the Daily diary. It
  // overrides the range until it is cleared or the range is changed.
  const [dayFilter, setDayFilter] = useState<string | null>(initialDayFilter ?? null);
  // ADR 0109 D6: the last view is remembered per device. A hand-off (the
  // wallet's View all, a Dashboard row, a diary day) always opens the Table.
  const [viewMode, setViewMode] = useState<TxViewMode>(() =>
    initialWalletFilter || initialSelectedTxId || initialDayFilter ? 'table' : readTxView()
  );
  const [calendarMonth, setCalendarMonth] = useState<string>(() => monthKeyOf(initialDayFilter ?? today));

  // This view remounts fresh on every navigation to the tab (App.tsx keys the
  // active view by `activeTab`, so switching away and back unmounts it), so
  // the initializer above only ever needs to run once per mount - consuming
  // the filter here (rather than leaving it in App.tsx state) prevents a
  // later, unrelated tab switch from silently inheriting a stale wallet id.
  useEffect(() => {
    if (initialWalletFilter) {
      onConsumeInitialWalletFilter?.();
    }
    if (initialSelectedTxId) {
      onConsumeInitialSelectedTx?.();
    }
    if (initialDayFilter) {
      onConsumeInitialDayFilter?.();
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

  const bounds = useMemo(
    () =>
      viewMode === 'calendar'
        ? monthBounds(calendarMonth)
        : dayFilter
          ? { start: dayFilter, end: dayFilter }
          : rangeBounds(range, today),
    [viewMode, calendarMonth, dayFilter, range, today]
  );

  // Filtering, soft-delete visibility and the write actions all come from the
  // domain hook; 'ALL' is the view's sentinel for "no filter", which the hook
  // expresses as `undefined`.
  const {
    transactions: filteredTransactions,
    rawTransactions,
    addTransaction,
    deleteTransaction,
    restoreTransaction,
    updateTransaction,
    setTransactionsDeleted,
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
  // The reset happens during the render that sees the new filters, not in an
  // effect (ADR 0056): the search settles on a timer, and an effect runs after
  // its render, so a "Load more" click that landed in between was undone.
  const [shownCount, setShownCount] = useState<number>(PAGE_STEP);
  const filterKey = [debouncedSearchTerm, selectedWalletId, selectedCategoryId, selectedType, range, dayFilter, showSoftDeleted].join('\u0000');
  const [shownFor, setShownFor] = useState(filterKey);
  if (shownFor !== filterKey) {
    setShownFor(filterKey);
    setShownCount(PAGE_STEP);
  }
  const loadMore = () => setShownCount((n) => n + PAGE_STEP);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addModalDate, setAddModalDate] = useState<string | undefined>(undefined);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  const walletMap = useMemo(() => buildLookupMap(wallets), [wallets]);
  const categoryMap = useMemo(() => buildLookupMap(categories), [categories]);

  // Active-only slices for the Add Transaction modal (Memoized, T9). An
  // archived wallet is not offered for a new entry (Phase 59).
  const activeWalletsForForm = useMemo(() => activeWallets(wallets), [wallets]);
  const activeCategoriesForForm = useMemo(() => categories.filter((c) => !c.isDeleted), [categories]);

  const sortedRows = useMemo(() => [...filteredTransactions].sort(byNewest), [filteredTransactions]);
  // ADR 0041: with no live row at all, the empty list is a first run, whatever
  // the filters say. Otherwise an empty list is the filters' doing.
  const hasLiveTransactions = useMemo(() => rawTransactions.some((t) => !t.isDeleted), [rawTransactions]);
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

  // One render path by width, never two copies hidden by CSS (ADR 0031). Inline
  // from `lg` since Phase 58b (audit 006 finding 2), where the list keeps about 620px.
  const isWide = useMediaQuery('(min-width: 1024px)');

  // The selected row. It closes when the row leaves the list, such as a
  // delete while "Show deleted" is off.
  const [selectedTxId, setSelectedTxId] = useState<string | null>(initialSelectedTxId ?? null);
  const selectedTx = useMemo(
    () => (selectedTxId ? sortedRows.find((tx) => tx.id === selectedTxId) ?? null : null),
    [selectedTxId, sortedRows]
  );
  // A selected row that left the list closes the panel, in the render that
  // finds it gone (ADR 0056). As an effect it ran after that render, and its
  // `null` replaced a row the user had picked in between.
  if (selectedTxId && !selectedTx) setSelectedTxId(null);

  // Bulk selection states (ADR 0109)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectMode, setSelectMode] = useState<boolean>(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isBulkWorking, setIsBulkWorking] = useState<boolean>(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [bulkDeleteCount, setBulkDeleteCount] = useState<number>(0);
  const pendingFocusRef = useRef<'wide-action' | 'phone-action' | 'phone-select-mode' | null>(null);

  // Render-time pruning of selected ids that left shownRows (ADR 0056)
  const shownIdsSet = useMemo(() => new Set(shownRows.map((r) => r.id)), [shownRows]);
  const activeIds = useMemo(() => {
    if (!isWide && !selectMode) return new Set<string>();
    return selectedIds;
  }, [isWide, selectMode, selectedIds]);

  const prunedIds = useMemo(() => {
    let changed = false;
    const next = new Set<string>();
    for (const id of selectedIds) {
      if (shownIdsSet.has(id)) {
        next.add(id);
      } else {
        changed = true;
      }
    }
    return changed ? next : selectedIds;
  }, [selectedIds, shownIdsSet]);

  if (prunedIds !== selectedIds) {
    setSelectedIds(prunedIds);
  }

  if (!isWide && selectMode && sortedRows.length === 0) {
    setSelectMode(false);
  }

  const summary = useMemo(
    () => selectionSummary(shownRows, activeIds, categoryMap),
    [shownRows, activeIds, categoryMap]
  );

  const liveIds = useMemo(
    () => shownRows.filter((r) => activeIds.has(r.id) && !r.isDeleted).map((r) => r.id),
    [shownRows, activeIds]
  );

  const allDeleted = useMemo(
    () => summary.count > 0 && liveIds.length === 0,
    [summary.count, liveIds]
  );

  const handleToggleRow = useCallback((id: string) => {
    setBulkError(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = shownRows.length > 0 && shownRows.every((r) => activeIds.has(r.id));
  const someSelected = activeIds.size > 0;

  const handleToggleAll = useCallback(() => {
    setBulkError(null);
    setSelectedIds((prev) => {
      if (shownRows.every((r) => prev.has(r.id))) {
        return new Set();
      }
      return new Set(shownRows.map((r) => r.id));
    });
  }, [shownRows]);

  const handleOpenBulkDelete = () => {
    setBulkDeleteCount(liveIds.length);
    setDeleteError(null);
    setConfirmBulkDelete(true);
  };

  const handleBulkDeleteConfirm = async () => {
    setIsBulkWorking(true);
    setDeleteError(null);
    const res = await setTransactionsDeleted(liveIds, true);
    setIsBulkWorking(false);
    if (res.success) {
      pendingFocusRef.current = isWide ? 'wide-action' : 'phone-action';
      setSelectedIds(new Set());
      setSelectMode(false);
      setConfirmBulkDelete(false);
    } else {
      setDeleteError(res.error ?? 'Could not delete transactions');
    }
  };

  const handleBulkRestore = async () => {
    setIsBulkWorking(true);
    setBulkError(null);
    const res = await setTransactionsDeleted([...activeIds], false);
    setIsBulkWorking(false);
    if (res.success) {
      pendingFocusRef.current = isWide ? 'wide-action' : 'phone-action';
      setSelectedIds(new Set());
      setSelectMode(false);
    } else {
      setBulkError(res.error ?? 'Could not restore transactions');
    }
  };

  const handleClearSelection = () => {
    pendingFocusRef.current = isWide ? 'wide-action' : 'phone-action';
    setSelectedIds(new Set());
    if (!isWide) {
      setSelectMode(false);
    }
    setBulkError(null);
  };

  // Focus effect: intentionally runs on every render without a dependency array
  // so that queued target focuses schedule in requestAnimationFrame after commit.
  // Exits immediately when no focus target is pending.
  useEffect(() => {
    if (!pendingFocusRef.current) return;
    const target = pendingFocusRef.current;
    pendingFocusRef.current = null;
    requestAnimationFrame(() => {
      if (target === 'wide-action') {
        const selectAll = document.getElementById('tx-select-all');
        if (selectAll && document.body.contains(selectAll)) {
          selectAll.focus();
        } else {
          document.getElementById('tx-search-input')?.focus();
        }
      } else if (target === 'phone-action') {
        const modeBtn = document.getElementById('tx-select-mode-btn');
        if (modeBtn && document.body.contains(modeBtn)) {
          modeBtn.focus();
        } else {
          document.getElementById('tx-search-input')?.focus();
        }
      } else if (target === 'phone-select-mode') {
        const firstRowCheckbox = document.querySelector<HTMLInputElement>('[id^="tx-select-row-"]');
        firstRowCheckbox?.focus();
      }
    });
  });

  const chooseView = (mode: TxViewMode) => {
    setViewMode(mode);
    writeTxView(mode);
    setSelectedTxId(null);
    setSelectedIds(new Set());
    setSelectMode(false);
    setBulkError(null);
    if (mode === 'calendar' && dayFilter) {
      setCalendarMonth(monthKeyOf(dayFilter));
    }
  };

  const handleChangeCalendarMonth = useCallback((nextMonth: string) => {
    setCalendarMonth(nextMonth);
    setDayFilter(null);
  }, []);

  const dayTotals = useMemo(
    () => (viewMode === 'calendar' ? dailyTotals(sortedRows, categoryMap) : new Map()),
    [viewMode, sortedRows, categoryMap]
  );

  const calendarDays = useMemo(() => {
    if (viewMode !== 'calendar') return new Map<string, TxCalendarDay>();
    const monthMax = Math.max(0, ...[...dayTotals.values()].map((d) => d.spending));
    const out = new Map<string, TxCalendarDay>();
    for (const [iso, d] of dayTotals) {
      out.set(iso, { ...d, heat: heatLevel(d.spending, monthMax) });
    }
    return out;
  }, [viewMode, dayTotals]);

  const monthFlow = useMemo(() => {
    if (viewMode !== 'calendar') return { income: 0, spending: 0, net: 0 };
    const cf = cashFlow(sortedRows, categoryMap);
    return { income: cf.income, spending: cf.spending, net: cf.leftOver };
  }, [viewMode, sortedRows, categoryMap]);

  const calendarDay = useMemo<string | null>(() => {
    if (viewMode !== 'calendar') return null;
    if (dayFilter && monthKeyOf(dayFilter) === calendarMonth) return dayFilter;
    if (calendarMonth === monthKeyOf(today)) return today;
    let latest: string | null = null;
    for (const iso of dayTotals.keys()) {
      if (latest === null || iso > latest) latest = iso;
    }
    return latest;
  }, [viewMode, dayFilter, calendarMonth, today, dayTotals]);

  const dayRows = useMemo(
    () =>
      viewMode === 'calendar' && calendarDay
        ? sortedRows.filter((tx) => tx.transactionDate.slice(0, 10) === calendarDay)
        : [],
    [viewMode, calendarDay, sortedRows]
  );

  const dayPanelTotals = useMemo(
    () => (viewMode === 'calendar' && calendarDay ? dayTotals.get(calendarDay) : undefined),
    [viewMode, calendarDay, dayTotals]
  );

  const canGoNext = useMemo(() => {
    if (viewMode !== 'calendar') return false;
    const nextMonth = shiftMonth(calendarMonth, 1);
    if (nextMonth <= monthKeyOf(today)) return true;
    const nextMonthStart = `${nextMonth}-01`;
    return rawTransactions.some(
      (tx) => (showSoftDeleted || !tx.isDeleted) && tx.transactionDate.slice(0, 10) >= nextMonthStart
    );
  }, [viewMode, calendarMonth, today, rawTransactions, showSoftDeleted]);

  const sheetMode = !isWide || viewMode === 'calendar';
  const drawerTitleRef = useRef<HTMLHeadingElement>(null);
  const lastSelectedRef = useRef<string | null>(initialSelectedTxId ?? null);

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
    if (selectedTxId && isWide && viewMode === 'table') drawerTitleRef.current?.focus();
  }, [selectedTxId, isWide, viewMode]);

  const selectedCategory = selectedTx?.categoryId ? categoryMap.get(selectedTx.categoryId) : undefined;
  const selectedDebt = selectedTx?.debtId ? debts.find((d) => d.id === selectedTx.debtId) : undefined;
  const details = selectedTx && (
    <TransactionDetails
      tx={selectedTx}
      category={selectedCategory}
      wallets={walletMap}
      walletList={wallets}
      categoryList={categories}
      debt={selectedDebt}
      onSave={updateTransaction}
      onDelete={deleteTransaction}
      onRestore={restoreTransaction}
    />
  );

  const listCard = (
    <Card padding="none">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4 border-b border-line">
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold text-fg">{dayFilter ? formatShortDate(dayFilter) : formatRangeLabel(range, today)}</span>
          <span className="text-fg-secondary">
            In <Money value={totalIn} showPlus className="font-semibold text-income" />
          </span>
          <span className="text-fg-secondary">
            Out <Money value={-totalOut} className="font-semibold text-expense" />
          </span>
        </p>
        <span className="text-xs text-fg-muted">Transfers and balance adjustments are not counted</span>
        {!isWide && !selectMode && sortedRows.length > 0 && (
          <Button
            id="tx-select-mode-btn"
            variant="secondary"
            onClick={() => {
              setSelectMode(true);
              pendingFocusRef.current = 'phone-select-mode';
            }}
          >
            Select
          </Button>
        )}
      </div>

      {isWide && viewMode === 'table' && sortedRows.length > 0 && summary.count > 0 && (
        <TxBulkBar
          placement="inline"
          count={summary.count}
          net={summary.net}
          hasUncounted={summary.hasUncounted}
          allDeleted={allDeleted}
          busy={isBulkWorking}
          error={bulkError}
          onDelete={handleOpenBulkDelete}
          onRestore={handleBulkRestore}
          onClear={handleClearSelection}
        />
      )}

      {sortedRows.length === 0 ? (
        hasLiveTransactions ? (
          <EmptyState icon={Search} title="No transactions match your current filters." />
        ) : (
          // "Above" holds at every width: the page header's buttons sit on the
          // title's row from `sm` and under it below, both above this list.
          <EmptyState
            icon={ArrowLeftRight}
            title="No transactions yet"
            subtitle="Add your first one with Add transaction above, or import a CSV from Import / export."
          />
        )
      ) : isWide ? (
        <TransactionsTable
          days={shownDays}
          dayNets={dayNets}
          today={today}
          categories={categoryMap}
          wallets={walletMap}
          selectedTxId={selectedTxId}
          onSelect={selectRow}
          onDelete={deleteTransaction}
          onRestore={restoreTransaction}
          selectedIds={activeIds}
          onToggleRow={handleToggleRow}
          onToggleAll={handleToggleAll}
          allSelected={allSelected}
          someSelected={someSelected}
        />
      ) : (
        // Inset by 8px, like the Dashboard's Recent activity: each row's 2px
        // focus outline, 2px out, then has room inside the card.
        <div className="flex flex-col gap-1 p-2">
          {shownDays.map((day) => (
            <div key={day.date} className="flex flex-col">
              <DayGroupHeader date={day.date} today={today} net={dayNets.get(day.date) ?? day.net} className="rounded-control" />
              {day.transactions.map((tx) =>
                selectMode ? (
                  <label
                    key={tx.id}
                    className={`flex items-center gap-2 p-2 rounded-control hover:bg-surface-2 transition-colors cursor-pointer min-h-[44px] ${
                      activeIds.has(tx.id) ? 'bg-brand-soft' : ''
                    }`}
                  >
                    <SelectCheckbox
                      id={`tx-select-row-${tx.id}`}
                      checked={activeIds.has(tx.id)}
                      onChange={() => handleToggleRow(tx.id)}
                    />
                    <div className="flex-1 min-w-0 pointer-events-none">
                      <TransactionRow
                        id={`tx-row-${tx.id}`}
                        tx={tx}
                        category={tx.categoryId ? categoryMap.get(tx.categoryId) : undefined}
                        wallets={walletMap}
                        dateText={tx.transactionDate.slice(0, 10)}
                        className="rounded-control"
                      />
                    </div>
                  </label>
                ) : (
                  <TransactionRow
                    key={tx.id}
                    id={`tx-row-${tx.id}`}
                    tx={tx}
                    category={tx.categoryId ? categoryMap.get(tx.categoryId) : undefined}
                    wallets={walletMap}
                    onSelect={selectRow}
                    selected={tx.id === selectedTxId}
                    dateText={tx.transactionDate.slice(0, 10)}
                    className="rounded-control"
                  />
                )
              )}
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
            <Button id="tx-load-more-btn" variant="secondary" onClick={loadMore}>
              Load {Math.min(PAGE_STEP, sortedRows.length - shownRows.length)} more
            </Button>
          )}
        </div>
      )}
    </Card>
  );

  return (
    <div className={`flex flex-col gap-6 ${!isWide && selectMode ? 'pb-28' : ''}`}>
      <PageHeader
        title="Transactions"
        description="Click any row to edit it"
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
            <Button
              id="tx-open-add-modal-btn"
              onClick={() => {
                setAddModalDate(undefined);
                setIsAddModalOpen(true);
              }}
              icon={<Plus className="w-4 h-4" />}
            >
              Add transaction
            </Button>
          </>
        }
      />

      <SegmentedControl<TxViewMode>
        mode="tabs"
        ariaLabel="Transactions view"
        fill
        className="flex w-full lg:w-fit"
        value={viewMode}
        onChange={chooseView}
        options={[
          { value: 'table', label: 'Table', id: 'tx-view-table' },
          { value: 'calendar', label: 'Calendar', id: 'tx-view-calendar' },
        ]}
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

        {viewMode === 'table' && (
          <select
            id="tx-filter-range"
            aria-label="Date range"
            value={dayFilter ? DAY_FILTER_OPTION : range}
            onChange={(e) => {
              setRange(e.target.value as TimeRange);
              setDayFilter(null);
            }}
            className={FILTER_SELECT_CLASS}
          >
            {/* While a day from the diary is shown, the select says so rather than "All time" (audit 010 finding 1). */}
            {dayFilter && (
              <option value={DAY_FILTER_OPTION} disabled className={OPTION_CLASS}>
                One day
              </option>
            )}
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className={OPTION_CLASS}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {viewMode === 'table' && dayFilter && (
          <Button
            id="tx-day-filter"
            variant="soft"
            onClick={() => setDayFilter(null)}
            aria-label={`Clear the day filter: ${formatWeekdayDate(dayFilter)}`}
          >
            Only {formatWeekdayDate(dayFilter)}
            <X aria-hidden="true" className="w-3.5 h-3.5" />
          </Button>
        )}

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

      <div id="tx-view-panel" role="tabpanel" aria-labelledby={`tx-view-${viewMode}`}>
        {viewMode === 'calendar' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7">
              <TxCalendar
                monthKey={calendarMonth}
                onChangeMonth={handleChangeCalendarMonth}
                canGoNext={canGoNext}
                today={today}
                selectedDay={calendarDay}
                onSelectDay={setDayFilter}
                days={calendarDays}
                month={monthFlow}
              />
            </div>
            <div className="lg:col-span-5">
              <CalendarDayPanel
                day={calendarDay}
                today={today}
                totals={dayPanelTotals}
                rows={dayRows}
                categories={categoryMap}
                wallets={walletMap}
                selectedTxId={selectedTxId}
                onSelect={selectRow}
                onAdd={() => {
                  if (!calendarDay) return;
                  setAddModalDate(calendarDay);
                  setIsAddModalOpen(true);
                }}
                onOpenDiary={onOpenDiaryDay && calendarDay ? () => onOpenDiaryDay(calendarDay) : undefined}
              />
            </div>
          </div>
        ) : /* Spec 6.2: the list takes the full width until a row is selected, then 8/12 beside the panel. */
        selectedTx && isWide ? (
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
      </div>

      {/* Below `lg`, and at every width in the Calendar view (D11), the panel opens in Modal. Rendered only there, so it never doubles the inline one. */}
      <Modal
        isOpen={!!selectedTx && sheetMode}
        onClose={closeDrawer}
        title={selectedTx ? displayTitle(selectedTx, selectedCategory) : ''}
        closeButtonId="tx-drawer-close-btn"
        maxWidthClassName="max-w-md"
      >
        {sheetMode && details}
      </Modal>

      {/* Add Transaction Modal / Responsive Mobile Bottom Sheet */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setAddModalDate(undefined);
          setIsAddModalOpen(false);
        }}
        title="Record New Transaction"
        subtitle="Add an expense or income"
        titleId="add-transaction-modal-title"
        closeButtonId="tx-add-modal-close-btn"
        maxWidthClassName="max-w-xl"
      >
        <TransactionForm
          wallets={activeWalletsForForm}
          categories={activeCategoriesForForm}
          formTestId="tx-form-page"
          initialDate={addModalDate}
          onRequestTransfer={
            onOpenTransfer &&
            (() => {
              setAddModalDate(undefined);
              setIsAddModalOpen(false);
              onOpenTransfer();
            })
          }
          onRequestRepayDebt={
            onNavigateToDebts &&
            (() => {
              setAddModalDate(undefined);
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
              setAddModalDate(undefined);
              setIsAddModalOpen(false);
            }
            return res;
          }}
        />
      </Modal>

      <ImportCsvModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />

      {!isWide && selectMode && (
        <TxBulkBar
          placement="pinned"
          count={summary.count}
          net={summary.net}
          hasUncounted={summary.hasUncounted}
          allDeleted={allDeleted}
          busy={isBulkWorking}
          error={bulkError}
          onDelete={handleOpenBulkDelete}
          onRestore={handleBulkRestore}
          onClear={handleClearSelection}
        />
      )}

      <ConfirmDialog
        isOpen={confirmBulkDelete}
        onClose={() => {
          setConfirmBulkDelete(false);
          setDeleteError(null);
        }}
        title={`Delete ${bulkDeleteCount} ${bulkDeleteCount === 1 ? 'transaction' : 'transactions'}?`}
        description={
          bulkDeleteCount === 1
            ? 'It leaves your lists and totals and reverses its effect on the wallet. You can restore it from Show deleted.'
            : 'They leave your lists and totals and reverse their effect on your wallets and debts. You can restore them from Show deleted.'
        }
        confirmText="Delete"
        isLoading={isBulkWorking}
        error={deleteError}
        onConfirm={handleBulkDeleteConfirm}
      />
    </div>
  );
};
