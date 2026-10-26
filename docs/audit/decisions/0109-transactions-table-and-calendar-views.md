# 0109: Transactions redesign 2026-10: a Table and a Calendar view over one filter state, bulk delete through one RPC

**Status:** Accepted. Not implemented yet; the phase that ships it records its commits here.
- **Amends** ADR 0031: the page keeps its header, filter row, day groups, L12 loading and edit panel, and gains a view switch, a Table view and a Calendar view.
- **Adds** `docs/design/transactions-2026-10/spec.md` as the redesign's authority for the Transactions page, in place of `docs/design/finlife-redesign-spec.md` section 6.2. For every page not yet redesigned that spec stays the source.
- **Extends** ADR 0023 and ADR 0091 with one new ledger function, `set_transactions_deleted`.
- **Keeps** ADR 0028's L1, L11 and L12, ADR 0033's edit panel, and ADR 0036's day filter hand-off.

**Date:** 2026-10-25

## Context

1. The owner reviewed three redesign directions for the Transactions page on the canvas "FinLife Transactions Redesign" and chose two of them together: B (a month calendar with a day panel) and C (a table with multi-select).
2. The canvas is a mock: dark only, raw hex, Sunday-first weeks, a pager, tinted chips, whole-baht calendar figures, sample rows typed in from a screenshot, and saved-view tabs named after the owner's own categories. `spec.md` section 10 lists what not to copy.
3. The owner asked that nothing be hardcoded, and that any place that needs a fixed value be raised first. Six such places were raised (`spec.md` section 2, O1 to O6) and answered on 2026-10-25.
4. No ledger function changes more than one row: `set_transaction_deleted` and `update_transaction` take one id each. A selection of N rows deleted by N calls can fail part-way, which ADR 0091 rules out for a signed-in write.

## Decision

### D1. One page, two views, one filter state

A tab-mode `SegmentedControl` switches between Table and Calendar. Both read the one `useTransactions(...)` result; switching keeps every filter. In the Calendar view the month header replaces the range select, and picking a day sets the existing `dayFilter` (ADR 0036), not a second day state.

Why: two pages, or two filter states, would let the views disagree about the same rows.

### D2. The existing tokens, the existing helpers, nothing new hardcoded

No new palette except the three heat tokens (D5). Options, dates, amounts, sums, page size and breakpoint come from the data, `utils/date.ts`, `formatCurrencyAmount` / `Money`, `src/selectors/`, `PAGE_STEP` and the existing `lg` media query (`spec.md` D3). The only new constants are `HEAT_LEVELS` (D5) and the stored-view key (D6), each exported once.

Why: the owner's instruction (Context 3), and every value the mock fixed already has a source in the app.

### D3. The Table keeps the list's rules

Rows stay grouped by day with the day's L11 net (a spanning row per day), newest first, `PAGE_STEP` at a time behind "Load N more". Five columns: Date, Note, Category, Wallet, Amount, and a row menu. No sorting. Under `lg` the Table view renders today's list (`TransactionRow`, `DayGroupHeader`), chosen in JavaScript, never both.

Why: a sort other than date order breaks the day groups (O5); the mock's pager would undo L12; a table does not fit 390px.

### D4. The Calendar follows the diary's calendar

Monday first through `monthGrid()`; today's inset ring and the selected day's brand fill as `DiaryCalendar` draws them; a day is disabled only when it is after today and has no rows. Each cell is a 44px button whose name states the day's spending, net and count. Cells show the signed net through `Money` where it fits and only the day number and heat on a phone. The edit panel opens in the `Modal` at every width in this view, since the right column is the day panel. `DiaryCalendar` itself does not change.

Why: one calendar look across the app; rows dated ahead of today exist (`rangeBounds` leaves the end open); D13 of the spec forbids whole-baht figures.

### D5. Heat: three shades, relative to the month (O3)

`heatLevel = ceil(HEAT_LEVELS × spending / monthMax)`, 0 when the day spent nothing, with `HEAT_LEVELS = 3`. Three tokens, `heat-1` to `heat-3`, on the `expense` hue in both themes, each passing `scripts/wcag-tokens.mjs` for the day number and the net drawn on it. A legend names every shade.

Why: a scale relative to the month needs no baht threshold, so nothing about the owner's spending level is fixed in code.

### D6. Table opens first, and the last view is remembered per device (O4)

The view is read from `localStorage` inside try/catch and falls back to Table. The Dashboard and Daily diary hand-offs always open the Table.

Why: every existing spec arrives at the tab expecting `#tx-row-*` in a list; a per-device choice is a convenience, not data, so it does not sync.

### D7. Bulk delete and restore through one new RPC (O1)

`set_transactions_deleted(ids uuid[], deleted boolean)` soft-deletes or restores every listed row in one locked transaction, reusing `_ledger_apply_effect` per row so each wallet and debt moves exactly as `set_transaction_deleted` would move it; any failure rolls back the whole call. The guest path in `FinanceContext` applies the same arithmetic to the local ledger in one state update, and the pair joins `AGENTS.md`'s parity map. The UI offers Delete (confirmed with `ConfirmDialog`, naming the count) or Restore, never both at once, and keeps the selection on failure. Bulk recategorize and move-wallet are out.

Why: ADR 0091, one database function or nothing. Delete and restore already have a one-row function whose effect the new one can reuse; recategorize and move have no such base.

### D8. Out of this redesign (O2, O6)

Saved views, column sorting and keyboard shortcuts.

Why: the saved-view tabs in the mock were sample data and would need their own storage and sync; sorting conflicts with D3; a global keydown handler collides with the inputs and the PWA shell.

## Consequences

- One migration and one probe for `set_transactions_deleted`. Writing it is a `supabase/` task that pauses after its spec; applying it to the live project needs the owner's go-ahead in that session.
- New `tx-` ids join `docs/audit/test-selector-contract.md` (`spec.md` section 7); no existing id changes.
- `TransactionForm` gains an optional `initialDate` prop for "Add transaction on <day>".
- Three new colour tokens in `src/index.css`, both themes.
- `DESIGN.md`'s Transactions section is rewritten by the phase's last task, to the code as shipped.

## Not done

- A shared month-calendar component for the diary and the Transactions page: `TxCalendar` reuses the date helpers and the diary's day styles, and the diary is left alone. Revisit if a third calendar appears.
- Swipe between months, long-press to select, and a bottom-sheet filter panel on phones.
- Any change to the header, the nav, or board A of the canvas.
