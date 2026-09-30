# 0031 — Transactions page: one list grouped by day, a panel for the selected row, editing next

**Status:** Accepted.
- **Implements** `docs/design/finlife-redesign-spec.md` section 6.2 for the page itself, in Phase 58a. The spec's second page after the Dashboard (ADR `0030`).
- **Defers** the panel's edit fields and "Save changes" to Phase 58b, which needs a new ledger write (see "Split").
- **Puts on screen** L12 (`PAGE_STEP`, `visibleRows`, `hasMoreRows`), the first page besides the Dashboard to use `TransactionRow` and `DayGroupHeader`, and `OverflowMenu`.
- **Closes** audit 004 finding 4 (the transactions table 16px wider than its scroller at 390px): the table is gone.

**Date:** 2026-09-30

## Context

The page was the last big screen on the old design:
- a carded "Transaction Management" header with four buttons, one of them the diary's JSON export;
- a filter bar with no date or category filter;
- a `<table>` of eight rows a page with Previous and Next;
- a trash or restore button on every row.

The file was 901 lines, about 500 of them the CSV import.

Spec 6.2 asks for a filter row, one list grouped by day with "Load 25 more", and a right-hand edit panel that replaces the trash buttons. **Nothing in the app can edit a transaction.** An edit is a new ledger write: a locked SQL function that reverses the old effect and applies the new one, its probe and a live migration, and a client write path that can move up to four wallets and two debts.

The owner's decisions (2026-09-28):
1. **Split.** 58a is the page, with a panel that shows the row and offers Delete or Restore. 58b adds editing through an `update_transaction` RPC. Each has its own PR, audit and deploy check.
2. **58b edits** type (among income, expense and transfer), amount, description, category, wallet or From/To, and date on those three types. A debt repayment or an adjustment changes only its description and date.
3. **58b uses a new `EditTransactionPanel`**, not `TransactionForm`, so ADR `0013` and the add form stay as they are.
4. **antislop in mode 2** (audit 006).

## Decision

### The page
- **`PageHeader` "Transactions"**, with an "Import / export" menu and the primary "Add transaction".
  - The menu is `OverflowMenu` with a new text trigger (`triggerLabel`, `triggerId`), a secondary `Button` with a chevron. Its items keep the ids the specs use.
  - "Export Diary (JSON)" leaves this page. The diary has its own, and no spec used this copy.
- **The filter row follows the spec's order:** search, date range (new; All time is the default, so every spec still sees its rows), wallet, category (new), a type control (All / Income / Expense / Transfer), and Show deleted.
  - Debt repayment and adjustment lose their type option, as the spec lists four.
- **One list card:**
  - The summary line gives the range, In (`sumIncome`) and Out (`sumSpending`). A note says transfers and adjustments are not counted, and neither is a deleted row.
  - Rows are sorted newest first, then **paged before they are grouped**: `visibleRows` takes 25, and `groupByDay` groups what is shown.
  - Each day's net comes from all of that day's filtered rows, so a day split across a "Load 25 more" boundary shows its real net.
  - Any filter change starts again at 25.
- **The panel** is inline at 4/12 beside the list at `xl` and a `Modal` below.
  - It shows the type, the signed amount, wallet or From/To, the category chip, the date, the note and the typed formula.
  - It offers Delete (danger), or Restore on a deleted row.
  - A failed delete or restore is shown there. The old trash button discarded the `MutationResult`.
  - Focus moves to the panel's heading when it opens and back to the row when it closes. A row that leaves the list closes it.

### Rendered once, never twice
The panel's two homes are chosen by `useMediaQuery('(min-width: 1280px)')`, never by hiding a copy with CSS.
- The Playwright suite counts hidden elements (`toHaveCount`) and matches text strictly (`getByText`). A second, hidden copy of the panel would break both.
- Every spec runs at 1280px, where the query matches, so the specs exercise the inline panel.
- **Found in the MCP pass:** Chromium's full-page screenshot briefly reports a narrower viewport, so a capture shows the sheet fading in. Plain screenshots and the DOM showed one panel.

### What the specs needed, and the one kind of edit made
Every spec edit is a locator or step move that keeps its assertion (`test-selector-contract.md`):
- **17 row locators** move from `tr[id^="tx-row-"]` to `button[id^="tx-row-"]`. The rows keep their `tx-row-{id}` ids.
- **Delete and Restore:** `soft-delete.spec.ts` clicks the row before it; the button locators become page-level with the same id prefixes.
- **Import and Export CSV:** `csv.spec.ts` and `csv-classify.spec.ts` open `#tx-import-export-btn` first.

Kept without an edit:
- **The row's ISO date.** `TransactionRow` gained `dateText`, rendered as `sr-only` text. `presets.spec.ts` filters rows by `2026-09-18`, and assistive technology reads each row's date as well as the day heading.
- **A transfer's note.** `secondaryLine` now appends a transfer's own note after its wallets ("Main → Cash · Funds transfer"). The title is always "Transfer", so the note would otherwise vanish. `wallet-forms.spec.ts:38` reads that note, and a user reads it too. Both defaults ("Transaction", "Transfer between wallets") add nothing.

### Smaller changes that came with it
- **`TxTypeIcon` renders a `<span>`.** It sits inside the row's `<button>`, which may hold phrasing content only.
- **`SegmentedControl` options keep a 44px minimum width**, found when "All" measured 43px.
- **The list is inset 8px with rounded rows**, like the Dashboard's Recent activity. The card's `overflow-hidden` had clipped every row's focus ring.
- **The CSV import moved to `transaction/ImportCsvModal.tsx` unchanged.** A whitespace-insensitive diff against the old view shows only the new wrapper and the open and close props. It subscribes to the finance state it needs itself.
- **`TransactionTableRow` and `TxCategoryChip` are deleted**; nothing else used them.

## Split: why editing waits for 58b
An edit must follow ADRs `0016`, `0022`, `0023` and `0024`, which rules out a quick edit path:
- one locked RPC that reverses the old effect and applies the new one with `_ledger_apply_effect`;
- the overpayment guard re-run after the reversal;
- the client's values computed before any `setState`;
- an unknown outcome re-read from the server;
- an adopter wider than `adoptLedgerState`.

The page gains nothing from waiting for that, and the RPC gains a phase of its own with its probe and a migration applied before the frontend.

## Consequences
- The page is 470 lines, down from 901, and the import is 552 lines on its own (its imports, props and doc comment included).
- `OverflowMenu` is on screen for the first time.
- `TransactionRow` is now the list row on two pages. The wallet popup's activity list is the last renderer that does not use it.
- Phase 58b changes the header's description from "Click any row to see it, or to delete or restore it" to the spec's "Click any row to edit it".
