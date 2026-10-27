# Spec: T813

Phase 149 (branch `phase-149-transactions-views`), design spec `docs/design/transactions-2026-10/spec.md` section 9, task 5. Authority: that file (sections 4.1, 5, 7, 8) and ADR 0109 (D7, O1). Already committed on this branch: T809 `a2634f1` (`selectionSummary`), T810 `ec9fa58` (Table view), T811 `4e88626` (Calendar), T812 `48e6750` (`set_transactions_deleted` and the context action `setTransactionsDeleted`).

## 1. Goal

Let the person select several Transactions rows and delete or restore them together. From `lg` the Table gets a checkbox column, a "Select all loaded rows" header checkbox and a bulk bar above the table; under `lg` a "Select" button turns on a selection mode with a bar pinned above the bottom nav. The bar shows "N selected", the selection's net (with an honest note when some rows are not counted) and Delete (confirmed) or Restore, each one call to `setTransactionsDeleted`. A failure keeps the selection. This task also decides where focus goes after a bulk action and after a confirmed row-menu Delete, closing T810's review note.

## 2. Target files

```
src/hooks/useTransactions.ts
src/components/transaction/SelectCheckbox.tsx      (new)
src/components/transaction/TxBulkBar.tsx           (new)
src/components/transaction/TransactionsTable.tsx
src/views/TransactionsView.tsx
unit/transactions-bulk.test.tsx                    (new)
unit/transactions-page.test.tsx
unit/use-transactions.test.tsx
docs/audit/test-selector-contract.md
docs/contexts/ui-and-e2e.md
```

No ADR (ADR 0109 decides O1 and D7), no `FinanceContext.tsx`, no SQL, no selector change: `setTransactionsDeleted` (`src/context/FinanceContext.tsx:210`, `:2301`) and `selectionSummary` (`src/selectors/ledger.ts:286`) are used as they stand. If the build finds either needs a change, stop and report; do not edit them. This task does not ship the phase: no `refactor-log.md`, no `baseline-metrics.md`.

Bookkeeping: add the T813 row to the Phase 149 table in `docs/audit/task-ledger.md`, after T812, with Task text `Selection and the bulk bar: checkbox column and header select-all, phone Select mode and pinned bar, bulk Delete and Restore through setTransactionsDeleted, focus after a bulk action and a row-menu delete (ADR 0109)` and section 2's files in the Files cell. Keep it up to date as you work.

New files use CRLF in the working tree, like their neighbours (`git ls-files --eol` shows `w/crlf` on every existing file above).

## 3. Context to read

- `docs/contexts/ui-and-e2e.md`: tokens, the 44px rule, one render path per width, layer order (`z-40` for a fixed bar), `Modal` focus rules, the selector contract and its id convention. Load the `antislop` core skill and `antislop-ui` and `antislop-layoutmobile` for the work (that file asks for them on UI and mobile layout).
- `docs/design/transactions-2026-10/spec.md` sections 4.1, 5, 7, 8 (read, do not edit).
- `docs/contexts/client-state.md` is not needed: no state, selector or money rule changes. The context action is called, not changed.

## 4. Current behaviour

- `useTransactions` (`src/hooks/useTransactions.ts:22-29`, `:144-168`) exposes `deleteTransaction` and `restoreTransaction` (one id each) and no bulk action. `setTransactionsDeleted: (ids: string[], deleted: boolean) => Promise<MutationResult>` exists on the actions context (`FinanceContext.tsx:210`): all ids or none, a row already in the asked-for state is skipped, a repeated id counts once, an unknown id returns `{ success: false, error: 'Transaction not found' }`, an empty list `{ success: false, error: 'Select at least one transaction' }`, a missing server function the `databaseUpdateNeeded()` result.
- `selectionSummary(rows, ids, categories)` (`ledger.ts:286-297`) returns `{ count, net, hasUncounted }`. An id with no row in `rows` is not counted. `hasUncounted` is true when a selected row is neither income nor spending: a transfer, repayment, adjustment, movement-category row or a deleted row (T809 spec, "hasUncounted is true exactly when..."). Nothing renders it yet.
- `TransactionsView` holds the filters and the page of rows. `shownRows` (`TransactionsView.tsx:221`) is the loaded rows; `shownDays` groups them (`:222`); `dayNets` (`:224-227`); `listCard` (`:354-431`) is the summary line, then `<TransactionsTable>` when `isWide` (`:381-392`) else the list of `DayGroupHeader` + `TransactionRow` (`:393-416`), then the "Showing N of M" footer. `chooseView` (`:245-252`) clears `selectedTxId` (the edit panel's row, not a bulk selection). State resets during render, not in effects (ADR 0056, e.g. `:198-201`, `:243`).
- `TransactionsTable` (`TransactionsTable.tsx:49-267`) has six columns: Date, Note, Category, Wallet, Amount, Actions (`:104-122`); each day's `<th scope="rowgroup" colSpan={6}>` (`:130-133`); the Date cell carries the edit-selected row's 3px inset edge (`:167-171`); the row's `tr` is `bg-brand-soft` when `selected` (the edit panel's row, `:166`). `confirmDelete` (`:73-84`) calls `onDelete`, closes the `ConfirmDialog` on success (`:79-80`). After a confirmed Delete that removes the row, the focused menu trigger is removed with it and focus falls to `body` (T810 review section 7).
- `Modal` returns focus to the control that opened it only if that control is still connected (`Modal.tsx:225-231`); `OverflowMenu` returns focus to its trigger when an item is chosen (`OverflowMenu.tsx:156-158`).
- `ConfirmDialog` (`ConfirmDialog.tsx:7-26`) takes `error` (red banner, dialog stays open), `isLoading`, `confirmText`; its buttons are `#confirm-cancel-btn` and `#confirm-destructive-btn`.
- The show-deleted checkbox is the 44px pattern to copy: a transparent native input over a drawn 16px box, `peer` classes (`TransactionsView.tsx:582-602`).
- `MobileBottomNav` is `md:hidden fixed bottom-0 z-40` (`MobileBottomNav.tsx:131`); its height is `4rem + 1px + env(safe-area-inset-bottom, 0.5rem)`, the same figure `App.tsx:361` uses to clear it. `ReloadPrompt` is `z-45` (`ReloadPrompt.tsx:53`). The nav exists only below `md` (768px), so the tablet range (768 to 1023px, which takes the phone layout) has no bottom nav.
- Ids already in the contract: `docs/audit/test-selector-contract.md:94` says "The `tx-select-*` and `tx-bulk-*` ids come with design task 5."
- Tests that this task changes: `unit/transactions-page.test.tsx:542-565` asserts six column headers and `colspan` `6`.

## 5. Parity map

None. No ledger arithmetic, no context change: the bar calls the existing `setTransactionsDeleted`, whose parity row T812 added to `AGENTS.md`. The spec-asserted DOM ids row is handled by the contract-file edit (edit 9).

## 6. Design decisions (the builder makes no other judgment calls)

1. **State lives in `TransactionsView`** (D4): `selectedIds: Set<string>`, `selectMode: boolean` (phone only), `bulkError: string | null` (Restore failures), `isBulkWorking: boolean`, `confirmBulkDelete: boolean`, `deleteError: string | null`. Figures are computed once there: `summary = selectionSummary(shownRows, activeIds, categoryMap)`.
2. **Who can select what.** Selection is over `shownRows` (the loaded rows), live and deleted alike (a deleted row is selectable only when Show deleted is on). `activeIds` is `selectedIds` when `isWide || selectMode`, else empty. A selected id that is no longer in `shownRows` (a filter change, "Load more" reset, a row that left the list) is dropped in the render that sees it (ADR 0056 pattern: compare, then `setSelectedIds` during render), so a bulk action never touches a row the person cannot see.
3. **Delete and Restore.** `liveIds` = the selected rows with `isDeleted === false`. `allDeleted` = `summary.count > 0 && liveIds.length === 0`. The bar offers **Restore** when `allDeleted`, else **Delete**. Delete acts on `liveIds` only (a mixed selection with Show deleted on skips the already-deleted rows, as the action would anyway); Restore acts on all selected ids (all deleted). One call per bulk action: `setTransactionsDeleted(ids, true|false)`; never a loop of `deleteTransaction`. Delete confirms first with `ConfirmDialog`; Restore does not (design spec 4.1).
4. **Delete dialog copy.** Title `Delete 1 transaction?` / `Delete N transactions?` (N = `liveIds.length`, the live count, not the selected count). Description, one row: `It leaves your lists and totals and reverses its effect on the wallet. You can restore it from Show deleted.`; several rows: `They leave your lists and totals and reverse their effect on your wallets and debts. You can restore them from Show deleted.` Confirm text `Delete`.
5. **Success.** Clear `selectedIds`, close the dialog, set `selectMode` false, then move focus (decision 9). **Failure.** Keep `selectedIds` and `selectMode`. Delete: the dialog stays open and `ConfirmDialog`'s `error` shows the message. Restore: the bar shows the message in `#tx-bulk-error` (`role="alert"`, `ERROR_BANNER_CLASS`). Clear `bulkError` / `deleteError` when the selection changes or a new action starts. While a call is in flight (`isBulkWorking`) Delete, Restore and Clear are disabled and the dialog gets `isLoading`.
6. **The bar's text.**
   - Count: `#tx-bulk-count`, `N selected`, a `role="status"` element (polite live region).
   - Net, in `#tx-bulk-net`, when `summary.count > 0 && !allDeleted`: `Net` then `<Money value={summary.net} showPlus className=...>` coloured as a day net (`text-expense` when negative, else `text-fg`). When `summary.hasUncounted`, follow it with a separate `text-fg-secondary` span: `Transfers, repayments, adjustments and deleted rows are not counted`. (On `bg-brand-soft`, use `text-fg-secondary`, not `text-fg-muted`; the text was chosen to match the existing "Transfers and balance adjustments are not counted" caption.)
   - When `allDeleted` there is no net figure (it would read ฿0.00 and mislead); `#tx-bulk-net` instead says `Deleted rows are not in your totals`.
   - With `count === 0` (phone selection mode, nothing picked yet) `#tx-bulk-net` is not rendered, and Delete is disabled.
7. **The bar is one presentational component, `TxBulkBar`**, placed by `isWide` in JavaScript (never two copies hidden by CSS):
   - `placement="inline"` (wide): rendered inside `listCard` between the summary line and the table, only while `viewMode === 'table'`, `sortedRows.length > 0` and `summary.count > 0`. Classes: `flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 bg-brand-soft border-b border-brand-soft-line`. Not sticky (`ponytail:` comment: the table scrolls inside its own box, so the bar stays above it; a sticky bar is the upgrade).
   - `placement="pinned"` (under `lg`): rendered at the root of the view's tree, beside the `Modal`s, never inside `listCard` (a fixed element inside a transformed ancestor would misplace). Classes: `fixed inset-x-0 z-40 bg-brand-soft border-t border-brand-soft-line px-4 py-3 bottom-[calc(4rem+1px+env(safe-area-inset-bottom,0.5rem))] md:bottom-0 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]` (the first `bottom` is the figure `App.tsx:361` uses; from `md` there is no bottom nav). It is shown while `selectMode`, even with 0 selected. The root `div` gains `pb-28` while it is shown, so the last row and "Load more" clear it. Opaque, no blur (`brand-soft` is opaque; blur is for the nav and sticky table header only).
   - Both: `<section id="tx-bulk-bar" role="region" aria-label="Bulk actions">`. Buttons are `ui/Button`: Delete `variant="danger"` `id="tx-bulk-delete-btn"`; Restore `variant="secondary"` `id="tx-bulk-restore-btn"`; the clear button `variant="soft"` `id="tx-bulk-clear-btn"`, labelled `Clear` inline and `Cancel` pinned. Only one of Delete and Restore renders. All 44px.
8. **Wide Table.** `TransactionsTable` gains a first column.
   - Header cell: `<th scope="col">` holding `SelectCheckbox` `id="tx-select-all"` with `ariaLabel="Select all loaded rows"`. Checked when every shown row is selected; indeterminate when some are; clicking selects every shown row, or clears when every shown row is already selected. The column is always present from `lg`, with or without a selection.
   - Row cell: `SelectCheckbox` `id={`tx-select-row-${tx.id}`}` with `ariaLabel={`Select ${displayTitle(tx, category)}`}`. A checked row's `tr` is `bg-brand-soft` (no edge), so it differs from the edit panel's row, which keeps `bg-brand-soft` plus the 3px `focus` edge; the edge moves to this new first cell (it is now the row's leading edge). The row button `#tx-row-*` still opens the edit panel and does not toggle.
   - The rowgroup `colSpan` becomes `7`, the table's `min-w` grows by the column (`min-w-[36rem]` to `min-w-[40rem]`).
   - New props, computed by the view: `selectedIds: ReadonlySet<string>`, `onToggleRow: (id: string) => void`, `onToggleAll: () => void`, `allSelected: boolean`, `someSelected: boolean`.
9. **Focus.** Two Modal facts drive it: `Modal` focuses the opener only if it is still connected, and a confirm button can keep focus through the dialog's exit tween. So an explicit `focus()` runs from an effect after the commit that closes the dialog (not in the click handler, not in a timer), and the tests wait on `document.activeElement` with `waitFor`, never a fixed wait. The target, first connected element wins:

   | Event | Focus lands on |
   |---|---|
   | Bulk Delete or Restore succeeds, wide | `#tx-select-all`, else `#tx-search-input` (the table is gone when the list is empty) |
   | Bulk Delete or Restore succeeds, phone (mode exits) | `#tx-select-mode-btn`, else `#tx-search-input` |
   | Clear (wide) | `#tx-select-all`, else `#tx-search-input` |
   | Cancel (phone, mode exits) | `#tx-select-mode-btn`, else `#tx-search-input` |
   | Select mode turns on (phone) | the first row's `#tx-select-row-*` checkbox |
   | Row-menu Delete confirmed and the row left the list (Show deleted off) | the next row's `#tx-row-*` button in table order, else the previous row's, else `#tx-select-all`, else `#tx-search-input` |
   | Row-menu Delete confirmed and the row is still listed (Show deleted on), or a row-menu Restore | unchanged: the menu trigger is still connected and gets focus back as today |
   | A bulk call fails | focus stays where it is (the open dialog, or the Restore button) |

   For the row-menu rule `TransactionsTable` captures the next and previous row ids from `days` before it awaits `onDelete`, and decides after the commit whether `#tx-menu-btn-${id}` is still in the document.
10. **Phone selection mode** (design spec 5). A `Select` button, `Button variant="secondary" id="tx-select-mode-btn"`, in the summary line of `listCard`, rendered only when `!isWide`, `!selectMode` and `sortedRows.length > 0`. Pressing it sets `selectMode` true with an empty selection. In the mode each day's rows render as: a `<label>` (`flex items-center`, `bg-brand-soft` when checked) holding a `SelectCheckbox` `id={`tx-select-row-${tx.id}`}` (no `ariaLabel`: its name is the label's text, which is the row's title, second line, category, amount and date) and the existing `TransactionRow` with `id={`tx-row-${tx.id}`}` and **no `onSelect`**, so it is a `div`, not a button, and a tap anywhere on the row toggles the checkbox. In the mode no row opens the edit sheet. No long-press. `DayGroupHeader`, the footer and "Load more" are unchanged and stay usable. Outside the mode the list is exactly today's.
11. **Leaving.** `chooseView` also clears `selectedIds`, `selectMode`, `bulkError`. Leaving the tab unmounts the view (App keys the active view by tab), so the state goes with it. When `isWide` becomes true with `selectMode` still set, the wide path applies (checkbox column and the inline bar when something is selected) and the selection carries over; when `isWide` becomes false without `selectMode`, `activeIds` is empty, so no invisible selection exists.
12. **`SelectCheckbox`** (new, `src/components/transaction/SelectCheckbox.tsx`): props `id`, `checked`, `indeterminate?`, `onChange`, `ariaLabel?`. It is the show-deleted pattern: `<span className="relative w-11 h-11 inline-flex items-center justify-center shrink-0">`, a native `<input type="checkbox">` `peer absolute inset-0 opacity-0 cursor-pointer` (the element specs and tests use), and a drawn 16px `aria-hidden` box (`border-line-input bg-surface-2`, `peer-checked:bg-brand-fill peer-checked:border-brand-fill`, `peer-focus-visible:ring-2 peer-focus-visible:ring-focus`, a `Check` icon when checked and a `Minus` icon when `indeterminate`, filled `bg-brand-fill` in both). Sets `input.indeterminate` from a ref in an effect. No `transition-colors` (use `transition-control` if animated). Colours are tokens only.
13. **`useTransactions`** returns `setTransactionsDeleted`, a `useCallback` over the action, in the same shape as `handleDelete` (`useTransactions.ts:144-149`).
14. **Ids** (all new, all `tx-`): `tx-select-all`, `tx-select-row-*` (rows only, so `[id^="tx-select-row-"]` matches checkboxes only and never `tx-select-all` or `tx-select-mode-btn`), `tx-select-mode-btn`, `tx-bulk-bar`, `tx-bulk-count`, `tx-bulk-net`, `tx-bulk-error`, `tx-bulk-delete-btn`, `tx-bulk-restore-btn`, `tx-bulk-clear-btn`. `tx-select-row-*` is the design spec's `tx-select-*` family; the longer stem is the one deviation, so the family is unambiguous.

Out of design: nothing is announced when a bulk action finishes (the count region only reports the selection); a result announcement is a later, owner-led choice.

## 7. Edits

Write the tests first (section 8), run the red run, then these edits.

1. `src/hooks/useTransactions.ts`: decision 13. Add `setTransactionsDeleted` to the destructuring at `:22-29`, the callback after `handleRestore` (`:151-156`), and the return object (`:158-168`).
2. `src/components/transaction/SelectCheckbox.tsx` (new): decision 12.
3. `src/components/transaction/TxBulkBar.tsx` (new): decisions 6 and 7. Props: `count`, `net`, `hasUncounted`, `allDeleted`, `placement: 'inline' | 'pinned'`, `busy`, `error`, `onDelete`, `onRestore`, `onClear`. Pure layout: it computes nothing; the figures come in.
4. `src/components/transaction/TransactionsTable.tsx`: decisions 8 and 9 (row-menu rule). New props as listed; the checkbox header and cells; `colSpan={7}`; the edge moved to the first cell; neighbour capture and the post-commit focus in `confirmDelete`.
5. `src/views/TransactionsView.tsx`: decisions 1 to 11. `selectedIds`, `selectMode`, the bulk handlers, `summary`, the `Select` button, the inline bar in `listCard`, the pinned bar and the bulk `ConfirmDialog` at the root, the select-mode row markup, `chooseView` clearing, the render-time pruning, the focus effect. Import `ConfirmDialog` from `../components/ui/ConfirmDialog` and `selectionSummary` from the ledger selectors.
6. `unit/` per section 8.
7. `docs/audit/test-selector-contract.md`: replace the last sentence of `:94` ("The `tx-select-*` and `tx-bulk-*` ids come with design task 5.") by a list of the ids in decision 14, and add under the "Transactions views" list: `[id^="tx-select-row-"]` matches the row checkboxes only; from `lg` the Table has a checkbox column (so a row has seven cells and the header seven column headers, the first holding `#tx-select-all`); under `lg` in selection mode a row is a `div#tx-row-*` inside a `<label>` (`button[id^="tx-row-"]` finds none until the mode ends); the bar's Delete confirms through `#confirm-destructive-btn`; focus lands as decision 9's table says. Keep CRLF.
8. `docs/contexts/ui-and-e2e.md` `:49` (the Transactions bullet): append one sentence: from `lg` the Table has a checkbox column and a bulk bar (`TxBulkBar`) over `setTransactionsDeleted`; under `lg` a Select mode pins the bar above the bottom nav; selection is over the loaded rows and drops rows that leave the list; Delete confirms, Restore does not; a failure keeps the selection; focus after a bulk action or a row-menu delete that removes the row is set explicitly [0109]. Keep it to the bullet's style and CRLF.

## 8. Tests to add

Write all of these first; run them against the current code (section 9) and save the failures.

### 8.1 `unit/transactions-page.test.tsx` (real provider, guest mode; `wide()` helper as the file's other Table tests)

- **Update** `:542-565` ("renders a table with caption, six columnheaders..."): the headers are `['', 'Date', 'Note', 'Category', 'Wallet', 'Amount', 'Actions']` (the checkbox column's header has no text) and the `colspan`s `['7', '7']`; rename the test "seven columnheaders". The assertion survives; only its expected values move (spec-edit policy).
- **Add** a `describe('selection and the bulk bar (ADR 0109 O1)')`:
  1. `wide: a checkbox column with a select-all header` - `#tx-select-all` is a checkbox named "Select all loaded rows"; each row has `#tx-select-row-<id>`, a checkbox named `Select <displayTitle>`; no `#tx-bulk-bar` yet.
  2. `wide: selecting shows the bar with the count, the net and the uncounted note` - tick an expense (฿100) and an income (฿700): `#tx-bulk-bar` is a `region` named "Bulk actions", `#tx-bulk-count` reads "2 selected" and has `role="status"`, `#tx-bulk-net` contains `+฿600.00` (via `formatCurrencyAmount`) and no "not counted"; tick a transfer: the net is unchanged and `#tx-bulk-net` contains "Transfers, repayments, adjustments and deleted rows are not counted"; Clear removes the bar and unticks every box.
  3. `wide: select-all covers the loaded rows only` - 30 rows: `#tx-select-all` selects 25 ("25 selected", header checked); "Load 5 more" leaves the header `indeterminate` and unchecked; clicking it selects all 30; clicking again clears.
  4. `wide: a selection drops a row a filter hides, and a view switch clears it` - select an income and an expense; set `#tx-filter-type-income`: "1 selected"; select again, switch to `#tx-view-calendar` and back: no selection, no bar.
  5. `wide: a row button still opens the edit panel and does not toggle the checkbox`.
  6. `wide: bulk Delete confirms, cancels cleanly, deletes together and lands focus on select-all` - select two live rows; Delete opens a dialog named "Delete 2 transactions?"; Cancel keeps both rows, both checked and the bar; Delete again, confirm: both rows gone, bar gone, `waitFor` `document.activeElement?.id === 'tx-select-all'`; `#tx-show-deleted` shows both `[Soft Deleted]`.
  7. `wide: an all-deleted selection offers Restore, shows no net, restores without a dialog` - Show deleted on, select the two deleted rows: `#tx-bulk-restore-btn` present, `#tx-bulk-delete-btn` absent, `#tx-bulk-net` says "Deleted rows are not in your totals"; Restore: no dialog, rows live, bar gone, focus on `#tx-select-all`.
  8. `wide: row-menu Delete lands focus on a neighbour` - three rows in one day (order newest first by `createdAt`): deleting the middle one focuses the next row's `#tx-row-*`; deleting the last focuses the previous; deleting the only row focuses `#tx-search-input`. With Show deleted on, deleting a row leaves focus on its `#tx-menu-btn-*` trigger.
  9. `narrow: Select mode` - without `wide()`: no `#tx-select-all`, no checkbox, `#tx-select-mode-btn` named "Select"; press it: `#tx-bulk-bar` shows "0 selected" with Delete disabled, the first row's `#tx-select-row-*` has focus, every row has a checkbox, `button[id^="tx-row-"]` finds none while `[id^="tx-row-"]` finds every row, tapping a row's label toggles ("1 selected", then "2 selected"); Cancel exits (no checkbox, no bar, `#tx-select-mode-btn` has focus, selection cleared); pressing Select again starts at "0 selected". The pinned bar's class list contains `fixed` and `z-40`.
  10. `narrow: Delete completes and exits the mode` - select two rows, Delete, confirm: rows gone, mode off (`#tx-select-mode-btn` back and focused), no bar.
  11. `narrow: outside the mode the list is today's` - a row is a `button#tx-row-*`, opens the sheet; `#tx-select-mode-btn` is the only new element.

### 8.2 `unit/transactions-bulk.test.tsx` (new; the hook mocked)

`// @vitest-environment jsdom`. `vi.mock('../src/hooks/useTransactions', ...)` returns a controlled object (rows from a hoisted variable, `setTransactionsDeleted`, `deleteTransaction` and `restoreTransaction` as `vi.fn`), with the real `FinanceProvider` around the real `TransactionsView` (it still reads wallets and categories from it), seeded like `transactions-page.test.tsx`'s `mount`, `wide()` copied. It proves what the real guest path cannot: how many calls, with what, and what a failure leaves.

1. `Delete calls setTransactionsDeleted once with the live selected ids and true` - three rows selected, confirm: one call, `ids` equal to the three ids as a set, `true`; `deleteTransaction` and `restoreTransaction` never called.
2. `a failed Delete keeps the dialog open with the message, and the selection` - the mock resolves `{ success: false, error: 'boom' }`: the dialog is open, shows "boom", `#tx-bulk-count` still says "3 selected" and every box is checked; Cancel closes the dialog and the selection is intact.
3. `Restore calls the action once with false, and a failure shows #tx-bulk-error` - first resolve `{ success: false, error: 'boom' }`: `#tx-bulk-error` is a `role="alert"` with "boom", selection kept, no dialog; then success: one more call is not required, assert `toHaveBeenLastCalledWith(ids, false)` and the bar gone.
4. `a mixed selection offers Delete and sends only the live rows` - Show deleted on (`showSoftDeleted: true` in the mock), one deleted and two live rows selected: Delete is offered, the dialog is named "Delete 2 transactions?", the call carries the two live ids.
5. `Delete, Restore and Clear are disabled while a call is in flight` - the mock returns a promise that stays pending: after confirm, `#confirm-destructive-btn` is disabled/busy and the call count stays 1 after a second click.

### 8.3 `unit/use-transactions.test.tsx`

`exposes setTransactionsDeleted and deletes several rows in one call` - add a second live row to the file's seed in the new test only, `act(() => result.current.setTransactionsDeleted([...ids], true))` resolves `{ success: true }` and `result.current.transactions` (Show deleted off) no longer lists either.

### 8.4 Why they fail today

`setTransactionsDeleted` is not on `useTransactions`; `#tx-select-all`, `#tx-select-row-*`, `#tx-select-mode-btn`, `#tx-bulk-bar` and the dialog do not exist; the table has six columns and `colSpan` 6. Every new test fails on a missing element or `TypeError`. The updated column-header test fails on the old six headers.

## 9. The red run

With section 8's test edits in place and nothing else changed, run:

```
npx vitest run unit/transactions-page.test.tsx unit/transactions-bulk.test.tsx unit/use-transactions.test.tsx 2>&1 | tee workflow/stages/02_build/output/logs/T813-red.log
```

Expected: the updated seven-header test, the 11 new tests in `transactions-page`, the 5 in `transactions-bulk` and the 1 in `use-transactions` fail (18 tests), and every other test in those files passes. Quote the command and the failure lines in the build report; if the count differs, say why before going on. (This task changes UI and a hook, not a selector or the ledger, but a ledger action is called from new code, so the red run is kept.)

## 10. Gates

Changed paths and tiers: `src/hooks/` (context/hooks row), `src/components/`, `src/views/` (UI row), `unit/` (unit row), `docs/` (docs, with names and ids to check). In order:

```
npm run lint
npx vitest run unit/transactions-page.test.tsx unit/transactions-bulk.test.tsx unit/use-transactions.test.tsx unit/dom-id-convention.test.ts unit/tx-row.test.tsx unit/tx-calendar.test.tsx unit/theme-tokens.test.ts
npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T813-unit.log
```

Before Playwright, check ports 3000 and 3100 for a stale dev server and stop any you started. Never edit `src/` while Playwright runs.

```
npx playwright test tests/account-and-mobile-nav.spec.ts tests/auth.spec.ts tests/csv-classify.spec.ts tests/csv.spec.ts tests/dashboard.spec.ts tests/date-boundary.spec.ts tests/diary-page.spec.ts tests/diary.spec.ts tests/express-input.spec.ts tests/ios-field-zoom.spec.ts tests/jev-classify.spec.ts tests/layout-stability.spec.ts tests/presets.spec.ts tests/reduced-motion.spec.ts tests/routing.spec.ts tests/safe-area.spec.ts tests/smart-rules.spec.ts tests/soft-delete.spec.ts tests/storage-persistence.spec.ts tests/tab-preload.spec.ts tests/theme.spec.ts tests/toast-layering.spec.ts tests/transaction-edit.spec.ts tests/transaction.spec.ts tests/voice-input.spec.ts tests/wallet-forms.spec.ts --project=chromium 2>&1 | tee workflow/stages/02_build/output/logs/T813-e2e-chromium.log
npx playwright test <the same 26 specs, no project filter> 2>&1 | tee workflow/stages/02_build/output/logs/T813-e2e-all.log
```

(The same 26 specs T811 ran; they cover the Table's rows, delete, the layout and the safe-area checks.)

Checks the builder runs and reports:

- **Full unit** today is 71 files and 1580 tests (T812). This task adds 1 file and about 17 tests (11 + 5 + 1, the updated test keeps its count). Report the real figures.
- **Text landed:** the dialog titles and descriptions, the net and uncounted strings and the aria names in decisions 4, 6 and 8 appear in `src/` exactly as written, checked with `git grep` on each string.
- **Ids:** every id in decision 14 exists in `src/` (`git grep -n` each) and is in the contract file; `[id^="tx-select-row-"]` finds only checkboxes.
- **Single render path:** a unit assertion (8.1 tests 1 and 9) proves a width shows only its own controls: wide has no `#tx-select-mode-btn`, narrow has no `#tx-select-all`.
- **Visual check** (the one thing unit tests cannot see): with `npm run dev`, check the wide Table with a selection at 1280px and 1024px, and the phone Select mode at 390px, in light and dark: the bar's contrast, the checkboxes at 44px, the pinned bar clearing the bottom nav and the last row, and no sideways page scroll. Record what was seen; start and stop the dev server yourself and stop it before Playwright.
- **Line endings:** `git ls-files --eol` on every changed tracked file still shows `w/crlf`; for the three new files a Node count of `\r\n` and of bare `\n` shows no bare `\n`.
- **Em dashes:** 0 in the added lines (`node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split(String.fromCharCode(8212)).length-1)"`) and in the new files and the build report (`node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split(String.fromCharCode(8212)).length-1)" src/components/transaction/SelectCheckbox.tsx src/components/transaction/TxBulkBar.tsx unit/transactions-bulk.test.tsx workflow/stages/02_build/output/task-T813-build.md`).
- **Owner files unchanged:** `git hash-object docs/audit/decisions/0109-transactions-table-and-calendar-views.md docs/design/transactions-2026-10/spec.md` gives the same hashes before and after; record them. `git diff --stat` shows no change to `src/context/`, `src/selectors/`, `supabase/`, `api/`, `AGENTS.md`.
- **Scope:** `git status --porcelain` lists only section 2's files, the ledger, and the build report.

## 11. Production touch points

None. The task writes no SQL, calls no `/api/*`, signs in nowhere and uses no MCP or CLI write tool. For context only: a signed-in bulk call needs T812's `set_transactions_deleted` on the live project, which the owner applies by hand before the phase merges (T812 spec section 8). Until then a signed-in bulk action shows the existing "database update needed" message and changes nothing; guest mode is unaffected.

## 12. Out of scope

- `tests/transactions-views.spec.ts` and the `DESIGN.md` Transactions section (task 6), `refactor-log.md`, `baseline-metrics.md`, `AGENTS.md`, `README.md`.
- `FinanceContext.tsx`, `setTransactionsDeleted`, `set_transaction_deleted`, any SQL, `selectionSummary` and every other selector.
- Selection in the Calendar view (its day panel is not a selection surface), bulk recategorize and bulk move-wallet (ADR 0109 D7: out), long-press to select, a sticky inline bar, shift-click ranges, selecting beyond the loaded rows ("select all 152"), keyboard shortcuts (O6), sorting (O5), saved views (O2).
- Announcing a bulk result, a flip-up `OverflowMenu`, changing `ConfirmDialog`'s or `Modal`'s behaviour, and `TransactionRow` (select mode uses it as it is, without `onSelect`).
- The Backlog rows and the other T810 non-blocking notes (`confirmDelete`'s missing `try/finally`, the un-reindented panel block, the squeezed test body) unless a line is touched anyway.
