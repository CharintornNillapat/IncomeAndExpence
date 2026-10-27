# Transactions redesign, 2026-10: Table and Calendar views

Owner: Charintorn. Source design: the canvas "FinLife Transactions Redesign" (https://claude.ai/artifact/TZew5R5LFQnDTKvBmCSbaK), boards **B · Calendar** and **C · Power Table**. Board A is not part of this work.

**This file is the authority, not the canvas.** The canvas shows layout and intent only. Every colour, size, label and number on it is a mock value (sample rows typed in from a screenshot, raw hex, Sunday-first weeks). The real values come from `src/index.css` tokens, `DESIGN.md`, `src/selectors/` and the user's own data.

**Status:** decided. The owner answered every open question in section 2 on 2026-10-25. Recorded in ADR 0109 (`docs/audit/decisions/0109-transactions-table-and-calendar-views.md`).

## 1. Decisions (settled)

- **D1. One page, two views over one filter state.** The Transactions page gets a view switch: **Table** and **Calendar**. Both read the same `useTransactions(...)` result, so search, wallet, category, type and Show deleted apply to both. Switching views keeps every filter.
- **D2. No new palette.** Existing semantic tokens only, both themes. The mock's violet is `brand`, its green `income`, its red `expense`, its blue `transfer`. A category or wallet colour is the record's own `color`, painted through the existing chip rules. No raw hex in `src/`.
- **D3. Nothing is hardcoded that the data or an existing helper already knows.**
  - Wallet, category and type options come from `useFinanceState()` (`wallets`, `categories`) and the existing `TYPE_OPTIONS`.
  - Today is `todayIsoDate()`. Month grids are `monthGrid()`. Month names and day labels are `formatMonthYear()`, `formatDayLabel()`, `formatWeekdayDate()`.
  - Every amount goes through `formatCurrencyAmount` or `ui/Money`. Every sum comes from `src/selectors/`.
  - The page size is `PAGE_STEP`. The wide layout is the existing `useMediaQuery('(min-width: 1024px)')`.
  - Any new constant (a count, a threshold, a key, a default) is an owner decision first (section 2). The task that adds it names it in one exported constant with a comment that cites this spec.
- **D4. Every figure is computed once in `TransactionsView`** from `src/selectors/` (ADR 0030's rule). Views and cells only lay out.
- **D5. L12 stays.** The Table view loads `PAGE_STEP` rows at a time behind "Load N more". The mock's pager ("1–23 of 152 ‹ ›") is dropped.
- **D6. L11 stays in the Table.** Rows are grouped by day: a day row spanning the table shows `DayGroupHeader`'s label and net, then that day's rows. Transfers are shown and not counted.
- **D7. Weeks start on Monday**, through `monthGrid()`, as the Daily diary's calendar does. The mock's Sunday-first grid is dropped.
- **D8. Chips follow `DESIGN.md`:** a neutral `ui/Chip` with the category's 7px dot. The mock's tinted chips are dropped.
- **D9. The edit panel does not change.** A row opens `TransactionDetails` as today: inline at 4/12 from `lg` in the Table view, and in the existing `Modal` everywhere else (D11).
- **D10. A calendar day is the existing day filter.** Picking a day sets the same `dayFilter` state the Daily diary hand-off uses (Phase 61). No second day state.
- **D11. In the Calendar view the edit panel opens in the `Modal` at every width.** The right column is the day panel, so there is no room for an inline edit panel. One render path.
- **D12. A day is disabled only when it is after today and has no rows.** Rows dated ahead of today exist (`rangeBounds` leaves the end open), so such a day stays reachable.
- **D13. Calendar cells show whole amounts only where they fit**, and always through `formatCurrencyAmount` (two decimals). On a phone a cell shows its day number and heat only; the figures are in the day panel below. The mock's whole-baht "−735" is dropped.

## 2. Owner decisions (2026-10-25)

Each was a place where something would otherwise be hardcoded or a new contract would appear. The owner took the recommended option for all six.

| # | Question | Decision | Why |
|---|---|---|---|
| O1 | **Bulk actions.** No bulk ledger function exists; `set_transaction_deleted` and `update_transaction` take one row. | **New RPC `set_transactions_deleted(ids uuid[], deleted boolean)`**, delete and restore only. One migration, one atomic call for the whole selection, the guest-mode twin in `FinanceContext`, and a row in `AGENTS.md`'s parity map. Bulk recategorize and move-wallet are out of this redesign. Writing the migration is a `supabase/` task (pause after spec); applying it to the live project needs the owner's go-ahead in that session. | Looping one-row calls breaks "one database function or nothing" for the batch. |
| O2 | **Saved views** (the mock's tabs). | **Not in this redesign.** No tabs, no storage. | The mock's tab names were sample data. |
| O3 | **Calendar heat scale.** | **Three shades plus none**, steps at the thirds of the month's highest spending day: level = `ceil(3 × spending / monthMax)`, 0 when the day spent nothing. Three new tokens `heat-1`, `heat-2`, `heat-3` in `src/index.css`, light and dark, on the `expense` hue, and a `scripts/wcag-tokens.mjs` pass for the day number and net on each. The count lives in one exported constant, `HEAT_LEVELS = 3`. | Relative to the month, so it needs no baht threshold. |
| O4 | **Which view opens first**, and is it remembered? | **Table by default; the last view is remembered per device** in `localStorage` (try/catch, falls back to Table). The key is one exported constant. The diary hand-off and the Dashboard hand-off always open the Table. | Every existing spec arrives at the tab and expects `#tx-row-*` in a list. |
| O5 | **Table columns and sorting.** | **Five columns** (Date, Note, Category, Wallet, Amount) plus the row menu. **No sorting:** newest first, as today. | Day groups (D6) only make sense in date order. |
| O6 | **Keyboard shortcuts.** | **Out.** | A global keydown handler collides with the inputs and the PWA shell. |

## 3. Token mapping (mock to app)

| Mock | Meaning | App |
|---|---|---|
| `#0b0d12` page, `#12151c` card | ground, card | `bg-canvas`, `bg-surface-1` + `rounded-card` + `border-line` |
| `#151922` table header, `#0f1218` insets | inner surface | `bg-surface-2` |
| `#161a23` row hover | hover | `bg-surface-3` |
| `#1a1530` selected row, bulk bar | selected | `bg-brand-soft` with the 3px `focus` edge (as a selected row today) |
| `#7c3aed` primary | primary action | `ui/Button` primary (`brand-fill`) |
| `#34d399`, `#f87171`, `#93c5fd` amounts | income, spending, transfer | `text-income`, `text-expense`, `text-transfer` via `txTypeMetaFor` / `Money` |
| red cell backgrounds | spending heat | `bg-heat-1` to `bg-heat-3` (O3) |
| `#e7e9ee` / `#9aa1ad` / `#8a92a0` text | text | `text-fg` / `text-fg-secondary` / `text-fg-muted` |
| category hues | identity | the category's own `color` as the chip's 7px dot |

Type: IBM Plex Sans Thai, `tabular-nums`, `DESIGN.md` section 2's scale. No `text-[Npx]` except what `DiaryCalendar` already uses for weekday labels.

## 4. Page structure, wide (from `lg`, 1024px)

Top to bottom, inside the existing `max-w-7xl` main:

1. **`PageHeader`**, unchanged: "Transactions", its line, Import / export, Add transaction.
2. **View switch:** a `SegmentedControl` in tab mode (`role="tab"`, `aria-selected`), options Table and Calendar, ids `tx-view-table` and `tx-view-calendar`. It controls `tx-view-panel`.
3. **Filter row**, as today, with one difference: in the Calendar view the range select is hidden, because the month header (5.1) is the range. Search, wallet, category, type and Show deleted stay.
4. **The view** (section 5).

### 4.1 Table view

- One `Card padding="none"` holding the summary line (as today), the table, and the "Showing N of M / Load N more" footer (as today).
- A real `<table>` with a visually hidden `<caption>` ("Transactions, newest first") and `<th scope="col">` headers: Date, Note, Category, Wallet, Amount, and an unlabelled actions column whose header is visually hidden text "Actions".
- The header row is sticky inside the card's scroll box. `DESIGN.md` section 3 allows the blur there.
- **Day rows (D6):** a `<tr>` whose one `<th scope="rowgroup" colspan>` shows `formatDayLabel(date, today)` and the day's L11 net from `groupByDay`, with `DayGroupHeader`'s colour rule.
- **Transaction rows:**
  - Date: `formatShortDate(tx.transactionDate)`.
  - Note: `tx.description` when `hasOwnDescription(tx)`, else `fg-muted` "No note". The cell holds the row's `<button id="tx-row-${id}">`, which opens the edit panel. The button's accessible name is `displayTitle(tx, category)` plus the amount.
  - Category: `categoryLabel(tx, category)` in `ui/Chip`; empty for a transfer (L7).
  - Wallet: the wallet's name; for a transfer, the route from `secondaryLine`'s rule ("Main → Cash").
  - Amount: `ui/Money` with the type's sign and colour (`txTypeMetaFor`), right aligned.
  - Actions: `ui/OverflowMenu` with Edit and Delete (Delete confirms first, then calls the existing soft delete). Restore for a deleted row.
- The selected row (edit panel open) is `brand-soft` with the 3px `focus` edge, as today.
- With a row selected, the card is 8/12 and the panel 4/12 (unchanged). The table scrolls sideways inside its card below its minimum width; the page never scrolls sideways.
- **Selection and the bulk bar (O1):** a checkbox column first, each checkbox a 16px box in a 44px hit area (the Show deleted pattern), a "Select all loaded rows" checkbox in the header, and a bar above the table while one or more rows are selected: "N selected", the selection's net (from section 6's `selectionSummary`, with "transfers not counted" when any is selected), Delete (or Restore when every selected row is deleted), and Clear. Delete confirms first with `ConfirmDialog`, naming the count. The bar is `role="region"` with a polite live region for the count. A failure keeps the selection and shows the red banner; nothing is half-applied, since the RPC is one call.

### 4.2 Calendar view

- Two columns: the calendar card at 7/12 and the day panel at 5/12, as the Daily diary lays out its form and calendar.
- **Calendar card** (`TxCalendar`, new, in `components/transaction/`):
  - Header: `formatMonthYear(monthKey)` as an h2, ‹ and › `IconButton`s (`tx-cal-prev-month-btn`, `tx-cal-next-month-btn`). › is disabled when the next month starts after today and has no rows (D12's rule, per month).
  - Under it, the month's In, Out and Net from `cashFlow` over the month's rows (section 6's `monthBounds`).
  - The grid from `monthGrid(monthKey)`, weekday labels as `DiaryCalendar` draws them.
  - **A day cell** is a `<button id="tx-cal-day-${iso}">`, 44px minimum, `aria-pressed` when it is the selected day, and an `aria-label` that says everything the cell shows: "Wed, Oct 21, spent ฿735.00, net −฿735.00, 4 transactions", or "Thu, Oct 22, no transactions".
  - It shows the day number and, when the day has rows, its L11 net through `Money` (`fg` when zero or more, `expense` when negative, always signed, as `DayGroupHeader`).
  - Background: `bg-heat-N` for the day's heat level (O3), none at level 0.
  - Today has the inset `focus` ring; the selected day the brand fill (white ring when both), exactly as `DiaryCalendar`'s `dayClass`.
  - A legend under the grid names every shade and mark it uses.
- **Day panel** (`tx-cal-panel`):
  - Heading `formatDayLabel(selectedDay, today)`; three insets In, Out, Net for that day from `cashFlow`.
  - The day's rows through `TransactionRow` with ids `tx-row-${id}` (the Table is not rendered in this view, so the ids stay unique).
  - Empty: "No transactions on this day".
  - "Add transaction on <short date>" (secondary, full width) opens the Add modal with the day preset. `TransactionForm` has no initial-date prop today; the task adds `initialDate?: string`.
  - When the Daily diary has an entry for the day, a link "Open this day in Daily diary".
- **Selected day on arrival:** today when the shown month is the current one, else the month's last day with rows, else none (the panel shows "Pick a day"). Switching views clears the selected row.

## 5. Phone and tablet (under `lg`)

One render path per width, chosen in JavaScript (`isWide`), never two copies hidden by CSS.

- **Header and view switch:** as wide; the switch spans the full width under the header.
- **Filter row:** unchanged from today (it already wraps and shares rows on a phone).
- **Table view becomes the list.** A table does not fit 390px, so under `lg` the Table view renders today's list: `DayGroupHeader` and `TransactionRow` inside the card, "Load N more" at the foot. Same ids (`tx-row-*`, `tx-load-more-btn`).
  - **Selection (O1):** a "Select" button in the summary line enters selection mode. Each row then shows a checkbox in a 44px box before its tile, and a tap toggles instead of opening the sheet. A bar pinned above `MobileBottomNav` shows "N selected", the selection's net, Delete (or Restore) and Cancel. Leaving the view, Cancel, or finishing an action exits the mode. No long-press (it fights scrolling and `useTabSwipe`, and has no keyboard path).
- **Calendar view:**
  - The calendar card full width. Cells keep the 44px minimum and show the day number and heat only (D13); the cell's `aria-label` still states the figures.
  - The day panel stacks under the calendar, not in a sheet, so the month and the day are both on screen.
  - A row opens the existing edit sheet (`Modal`).
  - No swipe between months; the ‹ › buttons only.
- **Tablet (768 to 1023px):** the same as the phone layout, with the calendar and day panel stacked. The inline edit panel still starts at `lg`.

## 6. Data and selectors

**Reused as they are:** `useTransactions`, `groupByDay`, `sumIncome`, `sumSpending`, `cashFlow`, `isIncome`, `isSpending`, `PAGE_STEP`, `visibleRows`, `hasMoreRows`, `displayTitle`, `secondaryLine`, `categoryLabel`, `hasOwnDescription`, `systemCategoryLabel`, `byNewest`, `activeWallets`, `buildLookupMap`, `formatCurrencyAmount`, `Money`, and the `utils/date.ts` helpers named above.

**New, each pure and unit-tested in `unit/`:**

| Selector | File | Returns | Test |
|---|---|---|---|
| `monthBounds(monthKey)` | `selectors/timeRange.ts` | `RangeBounds` for the 1st to the last day of the month, built from `monthGrid` or local date parts, never `toISOString` | Months of 28, 29, 30, 31 days; a December to January step |
| `dailyTotals(txs, categories)` | `selectors/ledger.ts` | `Map<isoDay, { income, spending, net, count }>` built on `isIncome` / `isSpending` and `roundToCents` | The sum of every day's income and spending equals `cashFlow` over the same rows to the cent; a transfer moves `count` only |
| `heatLevel(spending, monthMax)` with `HEAT_LEVELS` | `selectors/ledger.ts` | `0` to `HEAT_LEVELS`: `ceil(HEAT_LEVELS × spending / monthMax)`, 0 when spending or `monthMax` is 0 | Zero spending is 0; the month's top day is `HEAT_LEVELS`; a day at exactly a third is level 1; never `NaN` |
| `selectionSummary(rows, ids, categories)` | `selectors/ledger.ts` | `{ count, net, hasUncounted }` | Net equals `sumIncome - sumSpending` of the selected rows; a selected transfer sets `hasUncounted` |

The Calendar view filters the page's rows by `monthBounds` for the grid and by `dayFilter` for the panel. The summary line in the Table view stays on the current range.

## 7. Ids and tests

- **Keep** every Transactions id in `docs/audit/test-selector-contract.md`: `tx-row-*`, `tx-search-input`, `tx-filter-range`, `tx-filter-wallet`, `tx-filter-category`, `tx-filter-type-*`, `tx-show-deleted`, `tx-day-filter`, `tx-load-more-btn`, `tx-drawer`, `tx-drawer-title`, `tx-drawer-close-btn`, `tx-open-add-modal-btn`, `tx-import-export-btn`, `tx-import-csv-btn`, `tx-export-csv-btn`, and the edit panel's ids.
- **New** ids start `tx-`: `tx-view-table`, `tx-view-calendar`, `tx-view-panel`, `tx-cal-heading`, `tx-cal-prev-month-btn`, `tx-cal-next-month-btn`, `tx-cal-month-in`, `tx-cal-month-out`, `tx-cal-month-net`, `tx-cal-day-*`, `tx-cal-legend`, `tx-cal-panel`, `tx-cal-panel-title`, `tx-cal-panel-in`, `tx-cal-panel-out`, `tx-cal-panel-net`, `tx-cal-panel-empty`, `tx-cal-add-btn`, `tx-cal-diary-link`, `tx-select-*`, `tx-select-all`, `tx-select-mode-btn`, `tx-bulk-bar`, `tx-bulk-delete-btn`, `tx-bulk-restore-btn`, `tx-bulk-clear-btn`.
- Add each new id to the contract file in the same task that adds it.
- **Playwright:** a new `tests/transactions-views.spec.ts` covers the switch, the calendar month step, a day pick showing that day's rows, and the Add-on-day preset. Run at the desktop and the phone project widths.

## 8. Accessibility

- The view switch is a tablist; the panel is `role="tabpanel"` labelled by the selected tab.
- Table semantics as in 4.1. A row's open button and its checkbox are separate controls with separate names.
- The calendar is a grid of named buttons (4.2); colour is never the only signal (the net is signed, heat has a legend, the label states the figures).
- Every control has a 44px hit box. Focus returns to the row or day that opened a sheet, as every `Modal` does today.
- No user-facing em dash. No animation beyond `DESIGN.md`'s 150 to 200ms state transitions.

## 9. Task plan

Each task takes its gates from `AGENTS.md`'s tier table. The ADR comes first (task 0). Task ids are assigned from the ledger when the phase starts.

| Task | Scope | Waits on | Pause after spec |
|---|---|---|---|
| 0 | ADR 0109: the six owner decisions and D1 to D13 (done) | none | no |
| 1 | `monthBounds`, `dailyTotals`, `heatLevel`, `selectionSummary` and their unit tests | 0 | yes (`src/selectors/`) |
| 2 | View switch with the remembered view, Table view (wide) with day rows, list under `lg`, contract ids | 1 | no |
| 3 | `heat-1` to `heat-3` tokens and the WCAG pass, `TxCalendar`, day panel, `TransactionForm` `initialDate`, phone layout, contract ids | 1 | no |
| 4 | Migration `set_transactions_deleted`, its probe and PGlite replay, the guest twin in `FinanceContext`, the parity-map row | 0 | yes (`supabase/`, money path); live apply needs the owner |
| 5 | Selection and bulk bar, wide and phone | 2, 4 | no |
| 6 | `tests/transactions-views.spec.ts`, `DESIGN.md` Transactions section updated to this spec | 2, 3, 5 | no |

## 10. Mock values not to copy

- Every hex colour, the 1440px frame, and the mock's font link (the app self-hosts the font).
- The sample rows, the "152 entries" count, the period "Oct 15 – 25" and the month totals: all come from the user's data.
- The saved-view tab names ("This month", a bill category, a cigarette category, "Income only"): no view ships by default (O2).
- Sunday-first weeks (D7), the pager (D5), tinted chips (D8), whole-baht calendar figures (D13), the keyboard hint line (O6), the "Sum" label in the bulk bar (it is the selection's net, transfers not counted).
