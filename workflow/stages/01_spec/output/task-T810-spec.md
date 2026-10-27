# Spec: T810

## Amendment 1 (2026-10-27): the category inside the row button

The build stopped BLOCKED on `tests/csv-classify.spec.ts:143-144` and `:187-189` on chromium (`workflow/stages/02_build/output/task-T810-build.md`): `button[id^="tx-row-"]` filtered by the note expected the category name ("Transport & Fuel", "Groceries"), but met only `zzztaxi708044, −฿210.00, 2026-10-27`, because the Table puts the category in its own cell. The owner chose option 1: the Note button's `sr-only` text also carries the category label, as the list row's button does today (its chip sits inside the button, `TransactionRow.tsx:89-93`). No spec file is edited or added to the targets.

What changes in this spec: section 4.4 item 6 (the `sr-only` text), section 4.7 (a) (the contract bullet), section 6.3 (two assertions), and a red run for this amendment at the end of section 6. Everything else stands.

**The builder resumes from the state on disk.** The 12 files listed in the build report (the ten targets, the ledger row, the build report) stay as they are; do not redo the first red run or rewrite any file. The remaining work, in order:

1. The amendment's red run (end of section 6): add the two assertions to `unit/transactions-page.test.tsx`, run it against the current `TransactionsTable.tsx`, save the failure.
2. Edit `src/components/transaction/TransactionsTable.tsx` (section 4.4 item 6, sub-item 3) and the contract bullet in `docs/audit/test-selector-contract.md` (section 4.7 (a)).
3. Run every gate in section 7 again from the top (lint, the targeted unit files, the full unit run, both Playwright runs), overwriting the `T810-unit.log`, `T810-e2e-chromium.log` and `T810-e2e-all.log` logs.
4. Append a "Fix round 1 (Amendment 1)" section to the build report with the red-run counts, the gate results, and the ledger row set to `done`.

## Original spec

This is Phase 149, on branch `phase-149-transactions-views`, and covers task 2 of `docs/design/transactions-2026-10/spec.md` section 9 (the "design spec" below). The id T810 is free: the ledger's highest id is T809 (`docs/audit/task-ledger.md:147`), and no `task-T810-*` file exists. ADR 0109 is already written and committed, so this task needs no new ADR. The order names no Backlog row, so no Backlog status changes. The Phase 149 section already exists in the ledger; the builder adds the T810 row to it.

## 1. Goal

Give the Transactions page its view switch (Table and Calendar) with the last view remembered per device, and the Table view: from `lg` a real table of day rows and transaction rows with a row menu, under `lg` today's list unchanged. The Calendar tab exists and is remembered, but its panel is empty until T811 builds the calendar.

## 2. Target files

```
src/utils/txViewPreference.ts
src/selectors/display.ts
src/components/transaction/TransactionsTable.tsx
src/components/ui/ConfirmDialog.tsx
src/views/TransactionsView.tsx
unit/tx-view-preference.test.ts
unit/selectors-display.test.ts
unit/transactions-page.test.tsx
docs/audit/test-selector-contract.md
docs/contexts/ui-and-e2e.md
```

- `src/utils/txViewPreference.ts` and `src/components/transaction/TransactionsTable.tsx` and `unit/tx-view-preference.test.ts` are new files. Write them with CRLF line endings like the rest of the repo (check in section 7).
- `src/components/ui/ConfirmDialog.tsx`: a comment-only edit (section 4.6).
- Bookkeeping, always allowed: `docs/audit/task-ledger.md`. Add this row at the end of the Phase 149 table (after T809's row at `:147`), Status `in-progress` at the start, Commit empty; at the end set Status `done` and fill the gate result:
  ```
  | T810 | View switch with the remembered view, Table view with day rows from lg, the list under lg, row menu, contract ids (ADR 0109) | `src/utils/txViewPreference.ts`, `src/selectors/display.ts`, `src/components/transaction/TransactionsTable.tsx`, `src/components/ui/ConfirmDialog.tsx`, `src/views/TransactionsView.tsx`, `unit/tx-view-preference.test.ts`, `unit/selectors-display.test.ts`, `unit/transactions-page.test.tsx`, `docs/audit/test-selector-contract.md`, `docs/contexts/ui-and-e2e.md`, `docs/audit/task-ledger.md` | in-progress | | |
  ```
- Not targets: `src/context/`, `src/selectors/ledger.ts`, `src/selectors/timeRange.ts` (T809's helpers are not used by this task), `src/components/transaction/TransactionRow.tsx` and `DayGroupHeader.tsx` (the list under `lg` keeps using them as they are), `src/components/ui/OverflowMenu.tsx`, `src/components/ui/SegmentedControl.tsx`, `src/index.css`, `DESIGN.md`, `AGENTS.md`, `README.md`, `tests/*.spec.ts`.
- Pause rule: the Target files include `src/selectors/display.ts`, so the orchestrator pauses for the owner's go-ahead before `build T810`. The only selector change is one new pure function, `walletLabel` (section 4.2).

## 3. Context to read

- `docs/contexts/ui-and-e2e.md`: styling, 44px hit box, one render path per breakpoint, modals, the Transactions page contract, the selector contract and the Playwright rules.
- `docs/contexts/client-state.md`, only the sections "Money rules: `src/selectors/`" and "Unit tests for this layer": `walletLabel` is a selector and its test follows those rules.
- `docs/design/transactions-2026-10/spec.md`: D1 to D6, D9, O4, O5, sections 4, 4.1, 5, 7, 8.
- `docs/audit/decisions/0109-transactions-table-and-calendar-views.md`: D1, D3, D6.
- Not needed: `supabase-ledger.md`, `api-proxies.md`, `DESIGN.md` (rewritten by design task 6).

## 4. Current behaviour and the edits

### 4.1 Current behaviour

1. `TransactionsView` has no view switch. It renders one list card at every width: summary line (`TransactionsView.tsx:250-261`), then either the empty state (`:263-275`) or `DayGroupHeader` and `TransactionRow` buttons inset by 8px (`:276-297`), then the "Showing N of M / Load N more" footer (`:300-311`).
2. The selected row's panel is inline at 4/12 from `lg` and a `Modal` below (`:467-497`); `isWide` is `useMediaQuery('(min-width: 1024px)')` (`:211`). jsdom has no `matchMedia`, so `useMediaQuery` reports narrow (`src/hooks/useMediaQuery.ts:15,22`), and every test in `unit/transactions-page.test.tsx` sees the narrow layout.
3. `TransactionRow` is one `<button id="tx-row-<id>">` holding the title, the second line, a chip from `sm`, the amount, the `sr-only` ISO date (`dateText`) and the `[Soft Deleted]` tag (`TransactionRow.tsx:74-96,98-101`). Specs rely on that: `button[id^="tx-row-"]` filtered by the note text, `toContainText('+฿150.00')` (`transaction-edit.spec.ts:57`) and `toContainText('฿900.00')` (`account-and-mobile-nav.spec.ts:228`), the ISO date (`presets.spec.ts:214`), and `getByText('[Soft Deleted]')` inside the row (`soft-delete.spec.ts:47,56`). Every spec runs at 1280px (`playwright.config.ts:112-121`, Desktop Chrome, Firefox, Safari), so once the Table is the default at `lg`, each of those rows is a table row.
4. Delete and Restore live only in the selected row's panel (`EditTransactionPanel.tsx:356-364`, `DeletedTransactionDetails` in `TransactionDrawer.tsx:73`). `DESIGN.md:265` says "No trash button on a row"; the design spec's section 4.1 supersedes it for the Table (design task 6 rewrites `DESIGN.md`).
5. `ConfirmDialog` says in its doc comment it is "never for transaction soft-delete" (`ConfirmDialog.tsx:29-33`). Design spec 4.1 and ADR 0109 D7 have the Table's Delete confirm first, so that sentence becomes false.
6. A device preference already exists as a pattern: `pf_insights_collapsed` (`SpendingInsightsCard.tsx:16-33`), read and written in try/catch, and not in `LEDGER_STORAGE_KEYS` (`FinanceContext.tsx:287-296`), so `resetToGuestState` leaves it alone (`:829-845`).
7. `secondaryLine` builds the transfer route and the "Unknown wallet" fallback inside its own closure (`src/selectors/display.ts:53,64-73`). Nothing exports a wallet cell label.
8. `SegmentedControl` supports `mode="tabs"` (tablist, `role="tab"`, `aria-selected`), an `id` per option, `fill` and a tray `className` (`SegmentedControl.tsx:6-12,26,54-64`). It does not set `aria-controls`.
9. `OverflowMenu` takes `label`, `items` (each with an `id`, `tone: 'danger'`) and `triggerId`; its items exist only while it is open (`OverflowMenu.tsx:6-29,138-169`).
10. A sticky table header with the blur has a precedent: `ImportCsvModal.tsx:500-503`.

### 4.2 Edit 1: `src/selectors/display.ts` (red test first)

Add one module-level helper and one export, and make `secondaryLine` use the helper. Keep CRLF. Replace `:53` (`const UNKNOWN_WALLET = 'Unknown wallet';`) with:

```ts
const UNKNOWN_WALLET = 'Unknown wallet';

function walletName(wallets: ReadonlyMap<string, Wallet>, id: string | undefined): string {
  return (id && wallets.get(id)?.name) || UNKNOWN_WALLET;
}

/**
 * A row's wallet cell in the Transactions table (ADR 0109): "Main → Cash" for
 * a transfer, else the wallet's name. `secondaryLine` adds the transfer's note
 * after the route; this cell never does.
 */
export function walletLabel(tx: Transaction, wallets: ReadonlyMap<string, Wallet>): string {
  return tx.type === 'TRANSFER'
    ? `${walletName(wallets, tx.walletId)} → ${walletName(wallets, tx.destinationWalletId)}`
    : walletName(wallets, tx.walletId);
}
```

In `secondaryLine` delete the local `const name = ...` line (`:65`) and call `walletName(wallets, x)` where it called `name(x)` (the route at `:67` and the last line `:72`). Output of `secondaryLine` must not change; `unit/selectors-display.test.ts` already pins it.

### 4.3 Edit 2: `src/utils/txViewPreference.ts` (new)

```ts
/**
 * The Transactions page's remembered view (design spec O4, ADR 0109 D6): a
 * per-device preference in `localStorage`, never synced. It is not one of
 * `FinanceContext`'s `LEDGER_STORAGE_KEYS`, so signing out leaves it alone,
 * as it does `pf_insights_collapsed`.
 */
export const TX_VIEW_KEY = 'pf_tx_view';

export type TxViewMode = 'table' | 'calendar';

/** Anything but a stored "calendar", and any storage failure, is the Table. */
export function readTxView(): TxViewMode {
  try {
    return localStorage.getItem(TX_VIEW_KEY) === 'calendar' ? 'calendar' : 'table';
  } catch {
    return 'table';
  }
}

export function writeTxView(mode: TxViewMode): void {
  try {
    localStorage.setItem(TX_VIEW_KEY, mode);
  } catch {
    // Private mode or blocked site data: the switch still works for this
    // session; it just will not be remembered.
  }
}
```

### 4.4 Edit 3: `src/components/transaction/TransactionsTable.tsx` (new)

One component, the wide Table's body: the day groups as a real `<table>`, the row menu, the delete confirmation. Props and behaviour, exactly:

```ts
interface WriteResult { success: boolean; error?: string }

interface TransactionsTableProps {
  days: DayGroup[];                              // `shownDays` from the view (selectors/ledger `DayGroup`)
  dayNets: ReadonlyMap<string, number>;          // L11 nets over every filtered row, as the list uses
  today: string;
  categories: ReadonlyMap<string, Category>;
  wallets: ReadonlyMap<string, Wallet>;
  selectedTxId: string | null;
  onSelect: (tx: Transaction) => void;           // opens the edit panel
  onDelete: (id: string) => Promise<WriteResult>;
  onRestore: (id: string) => Promise<WriteResult>;
}
```

Structure (a fragment, so the view's card keeps its summary line above and its footer below):

1. If a Restore failed, a `<p role="alert" className={`${ERROR_BANNER_CLASS} mx-5 mb-3`}>` with the error, above the table; cleared when the next Restore starts.
2. A scroll box `<div className="max-h-[70vh] overflow-auto">` holding `<table className="w-full min-w-[36rem] border-separate border-spacing-0 text-left">`. `max-h-[70vh]` and `min-w-[36rem]` are layout classes, not data constants. The table scrolls sideways inside the card below `36rem`; the page never scrolls sideways (design spec 4.1).
3. `<caption className="sr-only">Transactions, newest first</caption>`.
4. `<thead><tr>` with six `<th scope="col">`: Date, Note, Category, Wallet, Amount (this one `text-right`), and an unlabelled last one whose content is `<span className="sr-only">Actions</span>`. Header cell class: `sticky top-0 z-10 bg-surface-2/90 backdrop-blur-sm px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-fg-secondary`, plus the alignment. Write a one-line comment citing `DESIGN.md` section 3 and `ImportCsvModal.tsx:502`: this is one of the two allowed blurs. No sort buttons, no sort state (O5).
5. One `<tbody key={day.date}>` per day (so `scope="rowgroup"` is true). Its first row is `<tr><th scope="rowgroup" colSpan={6}>`: a `flex items-center justify-between gap-3` holding `<span className="font-semibold text-fg-secondary">{formatDayLabel(day.date, today)}</span>` and `<Money value={net} showPlus className={`font-semibold ${net < 0 ? 'text-expense' : 'text-fg'}`} />` with `net = dayNets.get(day.date) ?? day.net`. Same colour rule as `DayGroupHeader` (`DayGroupHeader.tsx:24-29`); cell class `bg-surface-2 px-4 py-2 text-xs text-left border-t border-line`. A transfer, repayment or adjustment is shown in its day and is not counted (L11, already in the net).
6. Then one `<tr>` per `day.transactions` row, with these cells (cell class `px-4 py-1 border-t border-line align-middle`):
   - **Date:** `formatShortDate(tx.transactionDate.slice(0, 10))`, `whitespace-nowrap text-xs text-fg-secondary`.
   - **Note** (`w-full max-w-0`, so the text can truncate): the row button, `<button id={`tx-row-${tx.id}`} type="button" onClick={() => onSelect(tx)} aria-current={selected ? 'true' : undefined} className="w-full min-h-[44px] flex flex-col justify-center text-left cursor-pointer">`. Inside it, in this order:
     1. the visible note, `<span className="block truncate text-sm ...">`: `tx.description` when `hasOwnDescription(tx)`, else the text `No note`. Colour: `text-fg font-semibold`; `text-fg-muted` for "No note"; `line-through text-fg-muted` for a deleted row (as `TransactionRow.tsx:78`).
     2. `{tx.isDeleted && <TxSoftDeletedTag />}`.
     3. `<span className="sr-only">` with the one template string `` `${title !== noteText ? `, ${title}` : ''}${categoryText}, ${amountText}, ${isoDate}` `` where `title = displayTitle(tx, category)`, `noteText` is the visible note's text, `chipLabel = categoryLabel(tx, category)` (the Category cell's label, already computed for the chip), `categoryText = chipLabel && chipLabel !== noteText && chipLabel !== title ? `, ${chipLabel}` : ''`, `amountText = `${txTypeMetaFor(tx.type, tx.amount).sign}${formatCurrencyAmount(Math.abs(tx.amount))}``, `isoDate = tx.transactionDate.slice(0, 10)`. (Amendment 1: `categoryText` is new.) The button's text and accessible name then hold the note, the title when it differs from the note, the category label, the signed amount and the ISO date, which is what the list row's button exposes (`TransactionRow.tsx:74-96`, its chip inside the button), so `filter({ hasText: note })` then `toContainText(<category name>)` holds (`csv-classify.spec.ts:143-144,187-189`), as do the amount and ISO date checks (4.1 item 3). Each text is said once: the title only when it differs from the note (a transfer, a row with no note), the category only when it differs from both the note and the title (a no-note row's title already is its category label; a transfer has no category). Examples: `Lunch` + `, Food, −฿100.00, 2026-10-27`; a no-note row `No note` + `, Food, −฿80.00, <date>`; a transfer with note "Funds transfer" `Funds transfer` + `, Transfer, ฿500.00, <date>`. Put `categoryText` next to `title` and `noteText` in the row's consts; reuse the existing `chipLabel` const, do not call `categoryLabel` twice.
   - **Category:** `categoryLabel(tx, category)` in `<Chip label color>` when it is not `null`; an empty cell for a transfer (L7). Chip colour: the same rule as `TransactionRow.tsx:58-60` (`isSystemRow ? SYSTEM_CATEGORY_COLOR : (category?.color ?? SYSTEM_CATEGORY_COLOR)`); copy those two lines with a comment naming `TransactionRow`.
   - **Wallet:** `walletLabel(tx, wallets)`, `whitespace-nowrap text-xs text-fg-secondary`.
   - **Amount:** `text-right whitespace-nowrap`, holding `<span aria-hidden="true"><TxAmount amount={tx.amount} type={tx.type} className="text-sm" /></span>`. It is `aria-hidden` because the amount is already in the Note button's name; the visible figure is the sign-and-colour one from `txTypeMetaFor` (income `+`, spending `−`, a transfer unsigned).
   - **Actions:** `<OverflowMenu label={`More actions for ${displayTitle(tx, category)}`} triggerId={`tx-menu-btn-${tx.id}`} items={...} />`. Items for a live row: `{ id: `tx-menu-edit-btn-${tx.id}`, label: 'Edit', onSelect: () => onSelect(tx) }` and `{ id: `tx-menu-delete-btn-${tx.id}`, label: 'Delete', tone: 'danger', onSelect: () => setPendingDelete(tx) }`. A deleted row has one item, `{ id: `tx-menu-restore-btn-${tx.id}`, label: 'Restore', onSelect: () => restore(tx) }`. Put `ponytail:` comment: an open menu on the last rows scrolls inside the scroll box (it clips an absolute child); a flip-up `placement` prop on `OverflowMenu` is the upgrade.
   - **Selected row:** the `<tr>` gets `bg-brand-soft`, and its first `<td>` (Date) gets `shadow-[inset_3px_0_0_var(--focus)]` (the edge `TransactionRow.tsx:68` draws; on the cell, since a shadow on a `<tr>` is unreliable). `selected = tx.id === selectedTxId`. Other rows: `hover:bg-surface-3`.
7. Delete flow (state in this component): `pendingDelete: Transaction | null`, `isDeleting`, `deleteError`. A `<ConfirmDialog isOpen={pendingDelete !== null} title="Delete this transaction?" description="It leaves your lists and totals and reverses its effect on the wallet. You can restore it from Show deleted." confirmText="Delete" isLoading={isDeleting} error={deleteError} onConfirm={...} onClose={...} />`. `onConfirm`: set `isDeleting`, call `onDelete(pendingDelete.id)`, then on `success` clear `pendingDelete`, else set `deleteError` to `result.error ?? 'Could not delete this transaction.'` and keep the dialog open. `onClose` clears `pendingDelete` and `deleteError`. Restore: `onRestore(tx.id)`; on failure set the banner text to `result.error ?? 'Could not restore this transaction.'`.
8. No checkbox column, no select-all, no bulk bar: those are design task 5.
9. No em dash in any string. Header comment: cite design spec 4.1 and ADR 0109 D3.

### 4.5 Edit 4: `src/views/TransactionsView.tsx`

1. Imports: `TransactionsTable`, `TX_VIEW...` helpers, and the type (`readTxView`, `writeTxView`, `TxViewMode` from `../utils/txViewPreference`).
2. State, next to the filter states (after `:101`):
   ```ts
   // ADR 0109 D6: the last view is remembered per device. A hand-off (the
   // wallet's View all, a Dashboard row, a diary day) always opens the Table.
   const [viewMode, setViewMode] = useState<TxViewMode>(() =>
     initialWalletFilter || initialSelectedTxId || initialDayFilter ? 'table' : readTxView()
   );
   const chooseView = (mode: TxViewMode) => {
     setViewMode(mode);
     writeTxView(mode);
   };
   ```
   A hand-off opening the Table does not write the key.
3. In the `listCard` list body (`:276-297`): when `isWide` render `<TransactionsTable days={shownDays} dayNets={dayNets} today={today} categories={categoryMap} wallets={walletMap} selectedTxId={selectedTxId} onSelect={selectRow} onDelete={deleteTransaction} onRestore={restoreTransaction} />` in place of the `<div className="flex flex-col gap-1 p-2">` list; otherwise the existing list, untouched (same `DayGroupHeader`, `TransactionRow`, `dateText`). One render path by width, chosen in JavaScript. The summary line, the empty states and the footer stay as they are, shared by both.
4. The view switch, right after `PageHeader` and before the filter row (design spec 4):
   ```tsx
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
   ```
5. The panel: wrap what is today `:466-486` (the grid with the inline drawer, or `listCard`) in `<div id="tx-view-panel" role="tabpanel" aria-labelledby={`tx-view-${viewMode}`}>`. When `viewMode === 'calendar'` the panel's body is `null`, with the comment `// T811 builds the Calendar view here.` The filter row, the `Modal`s and `ImportCsvModal` stay outside the panel, unchanged. The filter row is unchanged in this task (hiding the range select in the Calendar view is T811).
6. Update the view's doc comment (`:74-79`) to name the view switch and the Table. Leave the orphan comment line at `:73` as it is.

### 4.6 Edit 5: `src/components/ui/ConfirmDialog.tsx` (comment only)

In the doc comment (`:28-34`) replace "for irreversible actions only (wallet delete, debt delete) - never for transaction soft-delete, which is reversible via restore and where a confirm would be pure friction." with "for deletes the person should confirm (wallet delete, debt delete, and, since ADR 0109, a transaction soft-delete from the Table's row menu or a bulk selection; the panel's own Delete does not confirm)." Change nothing else in the file.

### 4.7 Edit 6: docs

- `docs/contexts/ui-and-e2e.md:49`: in the Transactions bullet change the heading to `**Transactions** [0031, 0033, 0041, 0109]`, and replace "delete and restore live in the selected row's panel." with "delete and restore live in the selected row's panel and, from `lg` in the Table view, in each row's ⋯ menu (Delete confirms first). A Table/Calendar tablist (`tx-view-table`, `tx-view-calendar`) sits under the header; the last view is a per-device `localStorage` preference (`TX_VIEW_KEY` in `utils/txViewPreference.ts`), and a hand-off (wallet, Dashboard row, diary day) always opens the Table. From `lg` the Table is a real `<table>`; under `lg` it is the list; the width is chosen in JavaScript." Keep the rest of the bullet.
- `docs/audit/test-selector-contract.md`: (a) in the "### Transactions page" hazards list add this bullet: "From `lg` in the Table view (the default, and what every spec at 1280px sees) a row is a `<tr>` and `button#tx-row-*` sits in its Note cell. The button holds the note, the `[Soft Deleted]` tag, and `sr-only` text with the title (when it differs from the note), the category label, the signed amount and the ISO date, as the list row's button does, so `filter({ hasText })` on the button, `toContainText(<category name>)` in `csv-classify.spec.ts`, `toContainText('+฿150.00')` and the date check in `presets.spec.ts:214` hold. The visible Amount cell is `aria-hidden` and the Category cell shows the same label as the button's hidden text; a page-wide `getByText` on an amount or a category name can meet the button's hidden text as well, so scope it to a row or a cell." (Amendment 1: the builder already wrote the first version of this bullet; replace it with this text.) (b) Add a new section after "### Transactions page": "### Transactions views (Phase 149, no spec uses these yet; `tests/transactions-views.spec.ts` comes with design task 6)" with one bullet: "`#tx-view-table`, `#tx-view-calendar`, `#tx-view-panel`, `#tx-menu-btn-*`, `#tx-menu-edit-btn-*`, `#tx-menu-delete-btn-*`, `#tx-menu-restore-btn-*`. The `tx-cal-*`, `tx-select-*` and `tx-bulk-*` ids come with design tasks 3 and 5." Keep every existing id as it is.

## 5. Parity map

None. Delete and Restore from the row menu call the existing `deleteTransaction` and `restoreTransaction` from `useTransactions`, so the ledger arithmetic (`addTransaction` / `setTransactionDeleted` and `_ledger_apply_effect`) is untouched. `walletLabel` is display text only.

## 6. Tests to add

Write all tests first and run them against the unedited `src/` (the red run below), then build.

### 6.1 `unit/selectors-display.test.ts`

Add `walletLabel` to the import at `:2`, and one `describe('walletLabel: the Transactions table's wallet cell')` after the L7 block (`:75-100`), using the file's `WALLETS` (`main`, `cash`) and `tx()`:
- a transfer from `cash` to `main` is `'Cash → Main'`, and with a note "Funds transfer" it is still `'Cash → Main'` (while `secondaryLine` gives `'Cash → Main · Funds transfer'`).
- an expense on `cash` is `'Cash'`, with or without a description.
- an unknown `walletId` gives `'Unknown wallet'`; a transfer to an unknown destination gives `'Cash → Unknown wallet'`.
Fails today: `walletLabel` is `undefined` (`TypeError: walletLabel is not a function`).

### 6.2 `unit/tx-view-preference.test.ts` (new, `// @vitest-environment jsdom`)

`afterEach`: `localStorage.clear()` and `vi.restoreAllMocks()`. Tests:
- an empty store reads `'table'`; after `writeTxView('calendar')` it reads `'calendar'` and `localStorage.getItem(TX_VIEW_KEY)` is `'calendar'`; `writeTxView('table')` then reads `'table'`.
- any other stored value (`'grid'`, `''`, `'CALENDAR'`) reads `'table'`.
- with `vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); })` `readTxView()` is `'table'`; with `setItem` throwing, `writeTxView('calendar')` does not throw.
- `TX_VIEW_KEY` is `'pf_tx_view'`. Do not export or read anything from `FinanceContext` in this file.

Fails today: the module does not exist (import error, the whole file fails).

### 6.3 `unit/transactions-page.test.tsx`

Setup edits: in `afterEach` (`:32-35`) also `delete (window as { matchMedia?: unknown }).matchMedia;` and `vi.restoreAllMocks();`. Add a `wide()` helper copied from `unit/wallets-page.test.tsx:37-48` (a `matchMedia` that matches every query). Change `mount(rows)` (`:54-61`) to `mount(rows, props = {})` passing `props` to `TransactionsView`. Existing tests stay as they are and must still pass (the narrow list is unchanged).

Add `describe('the view switch (ADR 0109 D6)')`, narrow (no `wide()`):
- a tablist named "Transactions view" has two tabs, `#tx-view-table` ("Table", `aria-selected="true"`) and `#tx-view-calendar` ("Calendar"); `#tx-view-panel` has `role="tabpanel"` and `aria-labelledby="tx-view-table"`.
- clicking Calendar moves `aria-selected`, sets `aria-labelledby="tx-view-calendar"`, writes `localStorage` `TX_VIEW_KEY` = `'calendar'`, removes every `button[id^="tx-row-"]`, and leaves `#tx-search-input` and the filter selects in the page. Clicking Table brings the rows back.
- with `localStorage.setItem(TX_VIEW_KEY, 'calendar')` before `mount`, the Calendar tab is selected on arrival.
- the same stored value with `mount(rows, { initialDayFilter: todayIsoDate() })`, `{ initialWalletFilter: 'wal-cash' }` and `{ initialSelectedTxId: <a seeded id> }` each opens the Table, and the stored value is still `'calendar'` afterwards.
- with `Storage.prototype.getItem` throwing, the page mounts on the Table.

Add `describe('the Table view, from lg (ADR 0109 D3)')`, each test calling `wide()` before `mount`:
- structure: `document.querySelector('table')` exists with a `caption` "Transactions, newest first"; the `columnheader`s read `['Date', 'Note', 'Category', 'Wallet', 'Amount', 'Actions']` and `thead` holds no `button`; each day has a `<th scope="rowgroup">` with `colspan="6"` whose text is the day label (`/^(Today|Yesterday) · /`) and its L11 net (same figures as the existing grouped-by-day test, `:82-100`, so seed that test's three rows).
- a row: the Lunch row's `button#tx-row-<id>` text contains "Lunch", the signed amount (`MINUS` + `formatCurrencyAmount(100)`) and its ISO date; its `<tr>` shows the wallet name and the category name (read both from the seeded ledger, do not retype them). Amendment 1: the button's own text also contains `categoryName` (`expect(btn.textContent).toContain(categoryName)`, in the existing test at `unit/transactions-page.test.tsx:562-580`, after the ISO date check at `:575`).
- a transfer row: its Wallet cell is `Cash Wallet → Main Checking` (no note appended), its Category cell is empty, and the note "Funds transfer" is visible in the Note cell.
- a row with an empty description shows "No note", and its button text contains the category label (the title). Amendment 1: the label appears exactly once in the button (`expect(btn.textContent!.split(categoryName).length - 1).toBe(1)`, in the existing test at `:600-609`, after `:608`), which pins the `chipLabel !== title` guard.
- the income row's `<td>`s: the Amount cell's figure is `+` and `formatCurrencyAmount(700)` and is inside an `aria-hidden` element.
- L12: 30 expense rows show 25 `button[id^="tx-row-"]`, then "Load 5 more" (`#tx-load-more-btn`) shows 30 and the button goes; "Showing 30 of 30".
- selecting: clicking a row button opens `#tx-drawer` (the inline panel) and the button has `aria-current="true"`.
- Delete from the menu: click `#tx-menu-btn-<id>`, then `#tx-menu-delete-btn-<id>`; a dialog titled "Delete this transaction?" shows and the row is still there; click `#confirm-cancel-btn` and the row stays; open it again, click `#confirm-destructive-btn`, and (`waitFor`) the row is gone; `localStorage` `pf_transactions` still holds it with `isDeleted: true` after the write settles (or assert it through "Show deleted", which brings the row back with `[Soft Deleted]`).
- Restore from the menu: seed a deleted row, check `#tx-show-deleted`; the row shows `[Soft Deleted]`; its menu holds only Restore (no `#tx-menu-edit-btn-<id>`, no `#tx-menu-delete-btn-<id>`); clicking it removes the tag.
- narrow guard (no `wide()`): `document.querySelector('table')` is `null` and no `[id^="tx-menu-btn-"]` exists, while the list's `button[id^="tx-row-"]` rows are there.

Each test above fails today: there is no tablist, no `#tx-view-*`, no `table`, no `#tx-menu-*` (assertions fail with "Unable to find ..." or a null `querySelector`). The narrow-guard test and the existing tests pass today and must keep passing.

**Red run** (stage 02, step 4). Write the three test files first. With `src/utils/txViewPreference.ts` and `src/components/transaction/TransactionsTable.tsx` not yet created and `src/selectors/display.ts` and `src/views/TransactionsView.tsx` unedited (or stashed with `git stash push -- src/selectors/display.ts src/views/TransactionsView.tsx` if already edited), run `npx vitest run unit/selectors-display.test.ts unit/tx-view-preference.test.ts unit/transactions-page.test.tsx`. Expect failures: the new `walletLabel` test, the whole `tx-view-preference` file (import error), and every new test in the two `describe`s above except the narrow guard; every pre-existing test passes. Save the output to `workflow/stages/02_build/output/logs/T810-red.log`, record the failed and passed counts in the build report, then restore the edits and confirm green.

**Amendment 1 red run.** This one runs inside the test file, against the `TransactionsTable.tsx` now on disk (no stash). Add the two Amendment 1 assertions above to `unit/transactions-page.test.tsx`, then run `npx vitest run unit/transactions-page.test.tsx` before touching `TransactionsTable.tsx`. Expect exactly one failure: the Lunch row test, at the new `toContain(categoryName)` line (the button text is `Lunch, −฿100.00, <date>`, no category). The no-note test already passes (its title is the category, said once), and every other test passes. Save the output to `workflow/stages/02_build/output/logs/T810-red-amend1.log` and record the counts in the build report. Then make the section 4.4 edit and rerun: all pass. The reviewer's temporary edit to see red again: in `TransactionsTable.tsx` replace `${categoryText}` in the `sr-only` template with an empty string; the Lunch test fails. Dropping the `chipLabel !== title` guard instead fails the no-note test (the label counted twice).

## 7. Gates

Changed paths: `src/selectors/`, `src/utils/` (selectors and utils tier), `src/components/` and `src/views/` (components tier), `unit/`, docs. The union, as commands, in this order:

```
npm run lint
npx vitest run unit/tx-view-preference.test.ts unit/selectors-display.test.ts unit/transactions-page.test.tsx unit/dom-id-convention.test.ts
npm run test:unit
npx playwright test tests/account-and-mobile-nav.spec.ts tests/auth.spec.ts tests/csv-classify.spec.ts tests/csv.spec.ts tests/dashboard.spec.ts tests/date-boundary.spec.ts tests/diary-page.spec.ts tests/express-input.spec.ts tests/ios-field-zoom.spec.ts tests/jev-classify.spec.ts tests/layout-stability.spec.ts tests/presets.spec.ts tests/reduced-motion.spec.ts tests/routing.spec.ts tests/smart-rules.spec.ts tests/soft-delete.spec.ts tests/storage-persistence.spec.ts tests/tab-preload.spec.ts tests/toast-layering.spec.ts tests/transaction-edit.spec.ts tests/transaction.spec.ts tests/voice-input.spec.ts tests/wallet-forms.spec.ts --project=chromium
npx playwright test <the same 23 specs, no project filter>
```

- These 23 specs are every spec that opens the Transactions page or names a `tx-` id (found with `grep -lE "transactions'|tx-|#nav-tab-transactions|Transactions" tests/*.spec.ts`). The Table is the default at 1280px, so each is affected. If a spec outside the list fails, report it.
- Before Playwright: check ports 3000 and 3100 for stale dev servers, and do not edit `src/` while it runs.
- Expected: all pass, with only the skips already marked by design (6 across the whole suite). No existing spec may be edited. If a strict-mode `getByText` fails because the row button now holds hidden text (4.4, the Note cell), do not weaken the assertion: stop and report the spec line, the locator and the text it met; the orchestrator decides (the spec-edit policy allows a locator move only).
- Save the full `npm run test:unit` output with `tee` to `workflow/stages/02_build/output/logs/T810-unit.log`, and each Playwright run to `T810-e2e-chromium.log` and `T810-e2e-all.log` in the same folder. Report real figures: unit today is 1515 tests in 69 files; this task adds one file (70) and the new tests. Do not edit the counts in `AGENTS.md` or `README.md`; the task that ships the phase does that.
- Money path: `src/selectors/display.ts` gets its failing test first (the red run above).
- Docs: check each id the two docs name exists as written: `git grep -nE "tx-view-table|tx-view-calendar|tx-view-panel|tx-menu-btn-|tx-menu-edit-btn-|tx-menu-delete-btn-|tx-menu-restore-btn-|TX_VIEW_KEY|pf_tx_view" src` must show each of the seven ids, `TX_VIEW_KEY` and `pf_tx_view`.
- Convention: `unit/dom-id-convention.test.ts` (in the full unit run) passes: every new id starts `tx-`.
- Text landed: `git diff src/selectors/display.ts` shows only the `walletName` helper, `walletLabel`, and `secondaryLine`'s two call sites; `git diff src/components/ui/ConfirmDialog.tsx` shows comment lines only.
- Line endings: `git ls-files --eol` shows `w/crlf` for every modified target; for the three new files use `node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');console.log(f,'crlf',(s.match(/\r\n/g)||[]).length,'bare lf',(s.match(/(?<!\r)\n/g)||[]).length)}" src/utils/txViewPreference.ts src/components/transaction/TransactionsTable.tsx unit/tx-view-preference.test.ts` (bare lf must be 0).
- Em dashes: 0 in the added lines (`node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"`), and 0 in the three new files and the build report (`node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" src/utils/txViewPreference.ts src/components/transaction/TransactionsTable.tsx unit/tx-view-preference.test.ts workflow/stages/02_build/output/task-T810-build.md`).
- Scope: `git status --porcelain` lists only section 2's files, the ledger and the build report.

## 8. Production touch points

None. No Supabase, no `/api/*`, no `vercel.json` or workflow change, no sign-in. The Table's Delete and Restore call the existing guest and signed-in write paths through `useTransactions`; the specs run as a guest.

## 9. Out of scope

- The Calendar view, `TxCalendar`, the day panel, the `heat-1` to `heat-3` tokens, `TransactionForm`'s `initialDate`, and hiding the range select in the Calendar view (T811). The Calendar tab's panel renders nothing until then.
- Selection, the checkbox column, the select-all box, the bulk bar, `set_transactions_deleted` and the guest twin (design tasks 4 and 5).
- `tests/transactions-views.spec.ts` and the `DESIGN.md` Transactions rewrite (design task 6); editing any existing spec.
- Using T809's `monthBounds`, `dailyTotals`, `heatLevel` or `selectionSummary` (the Calendar and bulk bar use them).
- Sorting, saved views, keyboard shortcuts, the mock's pager (design spec O2, O5, O6, D5).
- Changing `TransactionRow`, `DayGroupHeader`, `OverflowMenu`, `SegmentedControl`, the edit panel, the filter row, or the narrow list.
- Updating test counts in `AGENTS.md` or `README.md`, `refactor-log.md` and `baseline-metrics.md` (the task that ships the phase).
