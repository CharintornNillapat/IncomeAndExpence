# Spec: T814

Phase 149 (branch `phase-149-transactions-views`), design spec `docs/design/transactions-2026-10/spec.md` section 9, task 6. Authority: that file (section 7's Playwright line, section 8) and ADR 0109. Already committed on this branch: T809 `a2634f1`, T810 `ec9fa58`, T811 `4e88626`, T812 `48e6750`, T813 `83d5c54`. The code under test is shipped; this task changes no `src/` file.

## 1. Goal

Pin the shipped Transactions views with a Playwright spec in guest mode (the view switch and its per-device memory, the wide Table, the Calendar with its heat shading, day panel and diary hand-off, row selection with the bulk bar, bulk delete and restore, and the focus rules after them), and bring `DESIGN.md`'s Transactions section and the selector contract in line with the code as it now stands.

## 2. Target files

```
tests/transactions-views.spec.ts          (new)
DESIGN.md
docs/audit/test-selector-contract.md
```

Bookkeeping: add the T814 row to the Phase 149 table in `docs/audit/task-ledger.md`, after T813, with Task text `Playwright spec for the Table and Calendar views and the Transactions section of DESIGN.md brought in line with the code (ADR 0109)` and section 2's files in the Files cell. Keep it up to date as you work.

`DESIGN.md`, the contract file and the new spec use CRLF in the working tree (`git ls-files --eol` shows `w/crlf` on the first two and on every neighbour spec); keep it, and write the new spec with CRLF.

No ADR (ADR 0109 decides it all). This task does not ship the phase: no `refactor-log.md`, no `baseline-metrics.md`. No `src/` file, no `helpers.ts`, no `AGENTS.md`, no `README.md`.

**Stop rule (read first).** If a test below exposes a real bug in `src/`, do not fix it and do not weaken the test: stop, write the failing test name, the observed value and the expected one in the build report, and report `BLOCKED`. If an expected string in this spec differs from the app only because this spec mis-copied a format (spacing, a glyph, an order of words) and the behaviour is the one described, fix the expectation and list each such fix in the build report. Everything else is a stop.

## 3. Context to read

- `docs/contexts/ui-and-e2e.md`: the Playwright and selector rules, the Transactions page contract (the bullet at `:49`), the `settle()` rule (ADR 0091), the ports check. Load `antislop` core (the DESIGN.md prose is user-facing copy of a sort: no filler, no em dash).
- `docs/design/transactions-2026-10/spec.md` sections 4, 5, 7, 8 (read, do not edit).
- `docs/audit/test-selector-contract.md` in full (you edit it).
- The tests to copy patterns from: `tests/dashboard.spec.ts:13-60` (seeding `pf_transactions` and pinning the clock and timezone), `tests/soft-delete.spec.ts:21-60`, `tests/diary-page.spec.ts:78-92` (the diary hand-off), `tests/helpers.ts` (`gotoTab`, `settle`, `seedLedger`, `SAMPLE_WALLETS`).
- `docs/contexts/client-state.md` and `supabase-ledger.md` are not needed.

## 4. Current behaviour (what the spec asserts; read each before you write the test)

View switch and memory
- `SegmentedControl mode="tabs"`, ids `tx-view-table`, `tx-view-calendar`; panel `#tx-view-panel` `role="tabpanel"` `aria-labelledby="tx-view-<mode>"` (`src/views/TransactionsView.tsx:681-692`, `:820`). `chooseView` writes `localStorage` key `pf_tx_view` (`src/utils/txViewPreference.ts:7-27`; anything but `calendar` reads as Table).
- A hand-off (wallet filter, selected row, day filter) opens the Table whatever is stored (`TransactionsView.tsx:132-134`).
- In the Calendar view `#tx-filter-range` and `#tx-day-filter` are not rendered (`:721`, `:746`) and the range is the month (`:163-171`). A day pick sets `dayFilter` (`:830`), which stays set when the person goes back to the Table (`chooseView` does not clear it, `:402-412`), so the Table then shows that one day with the `#tx-day-filter` chip.

Wide Table (from `lg`, 1024px)
- A `<table>` with sr-only caption "Transactions, newest first", seven column headers (checkbox, Date, Note, Category, Wallet, Amount, an sr-only "Actions"), a `th scope="rowgroup"` per day with `formatDayLabel` and the L11 net (`src/components/transaction/TransactionsTable.tsx:138-192`). `button#tx-row-<id>` is in the Note cell (`:234`).
- Row menu `#tx-menu-btn-<id>`: Edit (`#tx-menu-edit-btn-<id>`) and Delete (`#tx-menu-delete-btn-<id>`), or Restore (`#tx-menu-restore-btn-<id>`) for a deleted row (`:271-302`). Delete opens a `ConfirmDialog` "Delete this transaction?" (`:313-322`); on success focus goes to the next row's `#tx-row-*`, else the previous row's, else `#tx-select-all`, else `#tx-search-input`, unless the menu trigger is still in the page (Show deleted on) (`:84-123`).

Calendar
- Header `#tx-cal-heading` (`formatMonthYear`), `#tx-cal-prev-month-btn`, `#tx-cal-next-month-btn` (disabled when the next month starts after today and has no row, `TransactionsView.tsx:464-472`), `#tx-cal-month-in|out|net` (`TxCalendar.tsx:111-126`).
- Day cell `button#tx-cal-day-<iso>`, `aria-pressed`, `aria-label` = `<Wed, Oct 21>, spent <฿>, net <signed ฿>, <N> transaction(s)` plus `, today`, or `<date>, no transactions` (`:51-56`); `disabled` only when after today with no row (`:143`); class `bg-heat-1|2|3` for the heat level, `bg-brand-fill` when selected (`:58-72`); the net text inside the cell is `hidden sm:block` (`:159`). Legend `#tx-cal-legend` (`:174-189`).
- Selected day on arrival: today in the current month, else the month's last day with rows (`TransactionsView.tsx:440-449`). Day panel `#tx-cal-panel`, `#tx-cal-panel-title`, `#tx-cal-panel-in|out|net`, `#tx-cal-panel-empty` "No transactions on this day", `#tx-cal-add-btn` "Add transaction on <Sat, Oct 10>", `#tx-cal-diary-link` only when the day has a live diary entry (`TxDayPanel.tsx`). The panel's rows are `#tx-row-<id>` buttons; a row opens the edit `Modal` at every width (`sheetMode`, `:474`). The add button opens "Record New Transaction" with the `Transaction Date` input on that day (`:845-849`, `:905`). The diary link calls `onOpenDiaryDay` (`App.tsx:217-223`), which opens the Diary on that day.
- Heat: level = `ceil(3 x spending / monthMax)`, 0 for no spending (`selectors/ledger.ts` `heatLevel`); tokens in `src/index.css:195-198` (light) and `:268-271` (dark).

Selection (T813)
- Wide: `#tx-select-all` (header), `#tx-select-row-<id>`; `#tx-bulk-bar` is a `region` "Bulk actions" shown while something is selected, with `#tx-bulk-count` (`N selected`, `role="status"`), `#tx-bulk-net` (`Net` + signed amount, plus "Transfers, repayments, adjustments and deleted rows are not counted" when a transfer is selected; "Deleted rows are not in your totals" when every selected row is deleted), `#tx-bulk-clear-btn` ("Clear"), `#tx-bulk-delete-btn` or `#tx-bulk-restore-btn` (`TxBulkBar.tsx`). Delete opens "Delete N transactions?" / "Delete 1 transaction?" (`TransactionsView.tsx:953-969`); Restore has no dialog. Selection is over the loaded rows (25, then 25 more) and a row that leaves the list is dropped (`:263-285`).
- Focus: bulk Delete, Restore and Clear (wide) land on `#tx-select-all`; (phone) on `#tx-select-mode-btn` (`:373-400`).
- Phone (under `lg`): `#tx-select-mode-btn` "Select" in the summary line; the mode shows a checkbox per row inside a `<label>`, rows are `div#tx-row-*`, the bar is `fixed` above the bottom nav, its clear button reads "Cancel", and turning the mode on focuses the first row's checkbox (`:524-535`, `:590-612`, `:938-951`).

`DESIGN.md` today (`DESIGN.md:256-266`): the Transactions section says nothing of the view switch, the Table, the Calendar, the heat, the row menu, the delete confirm or the bulk bar; `:259` says rows are `TransactionRow` buttons only; `:265` says "No trash button on a row. Deleting happens in the panel." which is false from `lg` in the Table (the row menu has Delete). The Tokens table (`:37-57`) has no heat tokens; the contrast paragraph (`:62`) does not mention them.

The contract file today: `:92` says "no spec uses these yet; `tests/transactions-views.spec.ts` comes with design task 6"; `:99` ends "focus lands as decision 9's table says"; the per-spec id list (`:22-50`) has no line for the new spec.

## 5. Parity map

One row: **Spec-asserted DOM ids** to `docs/audit/test-selector-contract.md` and the specs (guarded by the Playwright suite). Handled by edits 2 and 3 below. No other row.

## 6. Tests to add: `tests/transactions-views.spec.ts`

Guest mode only: nothing here signs in, opens the Account modal's sign-in, or types a credential.

### 6.1 Fixtures

At the top of the file, a local `seedTransactions(page, { transactions, diary? })` helper (not in `helpers.ts`): `page.addInitScript` that, behind its own marker key `pf_e2e_tx_seeded` (so a `page.reload()` keeps what a test saved, as `seedLedger` does), writes `pf_transactions` and, when given, `pf_diary`. Call `seedLedger(page, { wallets })` first with `SAMPLE_WALLETS` where `wal-main-checking` has `balance: 50000` (so no delete can drive it negative). Pin the clock and zone for every test: `test.use({ timezoneId: 'Asia/Bangkok' })` and `page.clock.setFixedTime(new Date('2026-10-16T15:00:00+07:00'))` in a `beforeEach`. Today is **Fri, Oct 16, 2026**; Oct 10 is a Saturday.

Every seeded transaction: `userId: 'usr-guest-01'`, `walletId: 'wal-main-checking'`, `isDeleted: false`, `createdBy: 'usr-guest-01'`, `updatedAt` = `createdAt`, and a **unique `createdAt` that rises with array order** (so order within a day is newest-last-in-array first: `byNewest` ties on `createdAt`). The standard set, in this array order:

| id | type | amount | date | category | description |
|---|---|---|---|---|---|
| `tx-e2e-v-sep` | EXPENSE | 900 | 2026-09-20 | cat-food | E2E September Lunch |
| `tx-e2e-v-salary` | INCOME | 10000 | 2026-10-01 | cat-salary | E2E Salary |
| `tx-e2e-v-dinner` | EXPENSE | 2500 | 2026-10-10 | cat-food | E2E Dinner |
| `tx-e2e-v-snacks` | EXPENSE | 500 | 2026-10-10 | cat-groceries | E2E Snacks |
| `tx-e2e-v-move` | TRANSFER (`destinationWalletId: 'wal-cash'`) | 400 | 2026-10-12 | none | E2E Move to Cash |
| `tx-e2e-v-taxi` | EXPENSE | 1500 | 2026-10-13 | cat-transport | E2E Taxi |
| `tx-e2e-v-bus` | EXPENSE | 300 | 2026-10-14 | cat-transport | E2E Bus |
| `tx-e2e-v-coffee` | EXPENSE | 120 | 2026-10-16 | cat-food | E2E Coffee |
| `tx-e2e-v-future` | EXPENSE | 200 | 2026-10-20 | cat-food | E2E Future |

Derived figures the tests rely on: October spending is 5,120.00 (2500+500+1500+300+120+200), income 10,000.00, net +4,880.00; the top spending day is Oct 10 (3,000.00). Heat: Oct 10 level 3; Oct 13 (1,500, exactly half) level 2; Oct 14 (300) level 1; Oct 16 (120) level 1; Oct 20 (200) level 1; Oct 1 (income only), Oct 12 (transfer only) and Oct 11 level 0. Cell labels (verify against `TxCalendar.tsx:51-56`):
- Oct 10: `Sat, Oct 10, spent ฿3,000.00, net −฿3,000.00, 2 transactions` (the minus is U+2212).
- Oct 1: `Thu, Oct 1, spent ฿0.00, net +฿10,000.00, 1 transaction`.
- Oct 12: `Mon, Oct 12, spent ฿0.00, net ฿0.00, 1 transaction` (a transfer moves the count only).
- Oct 16: `Fri, Oct 16, spent ฿120.00, net −฿120.00, 1 transaction, today`.
- Oct 20: `Tue, Oct 20, spent ฿200.00, net −฿200.00, 1 transaction`; Oct 11: `Sun, Oct 11, no transactions`; Oct 17 and Oct 21 are `disabled`.

The 30-row set (select-all test only): thirty EXPENSE rows `tx-e2e-v-bulk-01` to `-30`, 10 baht each, all dated 2026-10-05, `cat-food`, description `E2E Bulk Row 01` to `30`, `createdAt` rising with the number (row 30 is newest and listed first).

Diary seed (hand-off tests): one entry `{ id: 'diary-e2e-v-1', userId: 'usr-guest-01', date: '2026-10-10', mood: 4, workout: false, foodQuality: 'AVERAGE', isDeleted: false, createdAt, updatedAt }`.

Conventions: reach a page with `gotoTab(page, 'transactions')`; call `settle(page)` before a click that follows a dialog or sheet closing; assert focus with `await expect(locator).toBeFocused()`; assert "no sideways page scroll" as `document.documentElement.scrollWidth <= window.innerWidth` (`tests/dashboard.spec.ts:113-117`); text for a cell's visible content with `toHaveText(..., { useInnerText: true })` (textContent includes `hidden` nodes). Viewports: the default 1280x720 for "wide"; a describe with `test.use({ viewport: { width: 390, height: 844 } })` for "phone".

### 6.2 The tests (write all, in this order)

**describe `view switch and memory`** (wide, standard set)
1. `defaults to the Table and the tablist reflects it`: `#tx-view-table` has `role=tab` `aria-selected=true`, `#tx-view-calendar` `false`; `#tx-view-panel` has `role=tabpanel` and `aria-labelledby=tx-view-table`; a `table` is visible and `#tx-cal-heading` has count 0. Click Calendar: the selected state, `aria-labelledby`, `#tx-cal-heading` "October 2026" follow, no `table`, `#tx-filter-range` count 0, `localStorage.getItem('pf_tx_view')` is `calendar`.
2. `remembers the last view per device and falls back to the Table`: choose Calendar, `page.reload()`, `gotoTab` back: Calendar is selected. Choose Table, reload: Table. Then `page.evaluate` sets `pf_tx_view` to `garbage`, reload: Table is selected and nothing throws (assert `#tx-view-table` `aria-selected=true`).
3. `a hand-off opens the Table even when the Calendar is remembered`: (a) set `pf_tx_view=calendar` (`page.evaluate`, then `page.reload()`), open the Dashboard, click the first `[id^="dashboard-tx-"]` row: `#nav-tab-transactions` is current, `#tx-view-table` is selected and `#tx-drawer` is visible. (b) with the diary seed and `pf_tx_view=calendar`, open the Diary, click `#diary-day-tx-link-2026-10-10` (`tests/diary-page.spec.ts:84` does the same): Transactions opens on the Table with `#tx-day-filter` visible and exactly the two Oct 10 rows listed.

**describe `wide Table`** (standard set)
4. `lays out a real table with day rows`: the table has an sr-only caption "Transactions, newest first"; `getByRole('columnheader', { name })` exists for Date, Note, Category, Wallet, Amount and Actions, and the header row has seven cells; the first rowgroup header (Oct 20) reads `Tue, Oct 20` and `−฿200.00`; the Oct 10 rowgroup reads `Sat, Oct 10` and `−฿3,000.00`; the Oct 12 row (the transfer) is listed; today's rowgroup starts `Today · Fri, Oct 16`; no sideways page scroll.
5. `the row menu edits, confirms a delete, lands focus and restores`: table order is newest first: Oct 20 future, Oct 16 coffee, Oct 14 bus, Oct 13 taxi, Oct 12 move, Oct 10 snacks then dinner, Oct 1 salary, Sep 20 sep. Open `#tx-menu-btn-tx-e2e-v-bus`, Edit: `#tx-drawer` is visible with the row's title; close it. Menu, Delete on `tx-e2e-v-taxi`: a dialog named "Delete this transaction?"; Cancel keeps the row; Delete again and confirm (`#confirm-destructive-btn`): the row is gone and the next row down, `#tx-row-tx-e2e-v-move`, is focused. Delete `tx-e2e-v-sep` (the last row) the same way: the previous row, `#tx-row-tx-e2e-v-salary`, is focused. Turn Show deleted on: `tx-e2e-v-taxi` and `tx-e2e-v-sep` are listed with `[Soft Deleted]`; the menu of `#tx-menu-btn-tx-e2e-v-taxi` offers only Restore (`#tx-menu-restore-btn-tx-e2e-v-taxi`); Restore: that row's `[Soft Deleted]` tag is gone. Still with Show deleted on, delete `tx-e2e-v-bus` through its menu and confirm: the row stays, tagged, and `#tx-menu-btn-tx-e2e-v-bus` is focused.
6. `at 1024px the inline panel opens and the page does not scroll sideways`: `page.setViewportSize({ width: 1024, height: 768 })`, click `#tx-row-tx-e2e-v-dinner`: `#tx-drawer` is visible (inline, no dialog), no sideways page scroll.

**describe `Calendar`** (wide, standard set, Calendar chosen by clicking `#tx-view-calendar`)
7. `shows the month, its totals, the legend and today selected`: `#tx-cal-heading` "October 2026"; `#tx-cal-month-in` contains `+฿10,000.00`, `#tx-cal-month-out` `−฿5,120.00`, `#tx-cal-month-net` `+฿4,880.00`; `#tx-cal-legend` lists the three heat labels from `TxCalendar.tsx` (`HEAT_LEGEND`), "Today" and "Selected day"; `#tx-cal-day-2026-10-16` is `aria-pressed=true` and `#tx-cal-panel-title` reads `Today · Fri, Oct 16` with `#tx-row-tx-e2e-v-coffee` listed; Monday is the first weekday column: October 1, 2026 is a Thursday, so `#tx-cal-day-2026-10-01`'s week row has exactly three empty `span` siblings before it.
8. `heat shades the days by spending and day cells state their figures`: the exact `aria-label`s in 6.1 for Oct 10, Oct 1, Oct 12, Oct 16, Oct 20 and Oct 11; `toHaveClass(/bg-heat-3/)` on Oct 10, `/bg-heat-2/` on Oct 13, `/bg-heat-1/` on Oct 14 and Oct 20; Oct 1, Oct 11 and Oct 12 have none of `bg-heat-1|2|3`; the computed `background-color` of Oct 10, Oct 13 and Oct 14 are three different values and each differs from Oct 11's. Oct 17 and Oct 21 are `disabled`; Oct 20 is enabled (D12). `#tx-cal-day-2026-10-10` shows `−฿3,000.00` inside the cell (`useInnerText`).
9. `heat stays distinct in the dark theme` (own describe with `test.use({ colorScheme: 'dark' })`): `html` has class `dark` (if not, use the cycling in `tests/theme.spec.ts:29-42` and say so in the build report); the three heat cells' computed `background-color`s are still three different values, each different from Oct 11's.
10. `a day pick shows that day, an empty day says so, and the Table keeps the day`: click Oct 10: `aria-pressed=true`, title `Sat, Oct 10`, `#tx-cal-panel-out` `−฿3,000.00`, `#tx-cal-panel-net` `−฿3,000.00`, `#tx-cal-panel-in` `฿0.00`, rows `#tx-row-tx-e2e-v-dinner` and `-snacks` visible, `#tx-row-tx-e2e-v-coffee` count 0. Click Oct 11: `#tx-cal-panel-empty` reads "No transactions on this day". Click Oct 10 again, then `#tx-view-table`: `#tx-day-filter` is visible and reads `Only Sat, Oct 10`, exactly two `button[id^="tx-row-"]` are listed (D10).
11. `steps through months`: `#tx-cal-next-month-btn` is disabled in October; `#tx-cal-prev-month-btn` goes to "September 2026", `#tx-cal-panel-title` is `Sun, Sep 20`... use the code (`:440-449`): the month's last day with rows is Sep 20 (a Sunday); `#tx-row-tx-e2e-v-sep` is listed; `#tx-cal-next-month-btn` is enabled and returns to October with Oct 16 selected again; the month totals in September read `−฿900.00` out.
12. `the filters are shared with the Table`: in the Table type `Taxi` into `#tx-search-input`; choose Calendar: `#tx-cal-day-2026-10-13` label ends `1 transaction`, `#tx-cal-day-2026-10-10` label is `Sat, Oct 10, no transactions`; clear the search and click `#tx-filter-type-income`: Oct 1 has a count and Oct 10 says no transactions.
13. `a panel row opens the edit sheet in a dialog and focus comes back`: click Oct 10, click `#tx-row-tx-e2e-v-dinner`: a `dialog` is visible, `#tx-drawer` count 0 (no inline panel in this view); Escape closes it and `#tx-row-tx-e2e-v-dinner` is focused.
14. `the diary link shows only for a day with an entry and opens that day` (diary seed): Oct 13 has no `#tx-cal-diary-link`; Oct 10 has it; click it: `#nav-tab-diary` is current and `#diary-cal-day-2026-10-10` is `aria-pressed=true`.
15. `Add on the selected day presets its date and the new row lands there`: click Oct 10, `#tx-cal-add-btn` reads `Add transaction on Sat, Oct 10`; click it: the dialog "Record New Transaction" is open and its `Transaction Date` input (`getByLabel`) has value `2026-10-10`. Fill the amount `75`, a unique description and submit as `helpers.ts addQuickTransaction` does (`input[name="amount_expression"]`, `input[id$="-desc"]`, `select[id$="-wallet"]`, `button[type="submit"]`, scoped to this dialog); the dialog closes, the panel lists the new row and the Oct 10 label now says `3 transactions`. Then close and reopen through `#tx-open-add-modal-btn`: its date is today, `2026-10-16`.

**describe `selection and the bulk bar`** (wide, standard set, Table)
16. `a checkbox column with a select-all header`: `#tx-select-all` is a checkbox named "Select all loaded rows"; every listed row has `#tx-select-row-<id>` named `Select <title>`; no `#tx-bulk-bar` yet.
17. `selecting shows the count, the net and the uncounted note, and Clear returns focus to select-all`: tick `tx-e2e-v-dinner` and `tx-e2e-v-salary`: `#tx-bulk-bar` is a `region` named "Bulk actions"; `#tx-bulk-count` reads "2 selected" and is `role=status`; `#tx-bulk-net` contains `+฿7,500.00`; tick `tx-e2e-v-move` (the transfer): "3 selected", the net is unchanged and `#tx-bulk-net` contains "Transfers, repayments, adjustments and deleted rows are not counted"; `#tx-select-all` is indeterminate (`evaluate`, `.indeterminate`); Clear: the bar is gone, every box unchecked, `#tx-select-all` is focused.
18. `a row button opens the panel without toggling, and a filter drops a hidden selection`: tick `tx-e2e-v-dinner` and `tx-e2e-v-salary`; click `#tx-row-tx-e2e-v-bus`: `#tx-drawer` is visible and "2 selected" is unchanged; click `#tx-filter-type-income`: "1 selected".
19. `bulk Delete confirms, cancels cleanly, deletes together and lands focus on select-all`: tick `dinner` and `snacks`; Delete opens a dialog named "Delete 2 transactions?"; Cancel keeps both rows listed, both ticked and the bar; Delete and confirm: both rows gone, no bar, `#tx-select-all` focused; Show deleted on lists both with `[Soft Deleted]`; `page.reload()`, `gotoTab`, Show deleted off: both are still gone (the seed marker keeps the reload from re-seeding).
20. `an all-deleted selection offers Restore, shows no net and restores without a dialog`: delete `dinner` and `snacks` as in test 19; Show deleted on; tick the two deleted rows: `#tx-bulk-restore-btn` present, `#tx-bulk-delete-btn` count 0, `#tx-bulk-net` reads "Deleted rows are not in your totals"; Restore: no dialog, no `[Soft Deleted]` on either, no bar, `#tx-select-all` focused.
21. `select-all covers the loaded rows only` (the 30-row set): `#tx-select-all` selects 25 ("25 selected", checked); `#tx-load-more-btn` ("Load 5 more"): `#tx-select-all` is indeterminate and unchecked, "25 selected" unchanged; click it again: "30 selected"; click it once more: no bar.

**describe `phone`** (viewport 390x844; standard set unless noted)
22. `the switch spans the width and the Table is the list`: `#tx-view-table` and `#tx-view-calendar` are visible and the tablist is at least 350px wide (390 minus the 16px page padding on each side, with slack); there is no `table` element; `button[id^="tx-row-"]` exist; `#tx-select-all` count 0 and `#tx-select-mode-btn` is visible; no sideways page scroll.
23. `Select mode: checkboxes, a pinned bar above the bottom nav, tap to toggle, Cancel`: press `#tx-select-mode-btn`: `#tx-bulk-count` reads "0 selected", `#tx-bulk-delete-btn` is disabled, the first row's `[id^="tx-select-row-"]` is focused, `button[id^="tx-row-"]` count 0 while `[id^="tx-row-"]` still matches every row; tap a row's label text (the row title): "1 selected", then another: "2 selected" and `#tx-bulk-net` shows a net; the bar's bottom edge is above the top edge of `nav[aria-label="Mobile Navigation"]` (bounding boxes) and after `window.scrollTo(0, document.body.scrollHeight)` the "Showing N of M" footer text of the list card ends above the bar's top; no sideways page scroll; Cancel (`#tx-bulk-clear-btn` reads "Cancel"): no checkbox, no bar, `#tx-select-mode-btn` focused, and pressing Select again starts at "0 selected".
24. `a bulk Delete completes and leaves Select mode`: Select, tick `dinner` and `snacks`, Delete, confirm: the rows are gone, no bar, no checkbox, `#tx-select-mode-btn` is visible and focused.
25. `the Calendar fits the phone`: choose Calendar: the cell for Oct 10 is at least 44px tall and shows only its day number (`useInnerText` equals `10`) while its `aria-label` still states the figures; `#tx-cal-panel` sits below the calendar (its top is at or below the bottom of `#tx-cal-legend`); no sideways page scroll; tap Oct 10 then the `dinner` row: a `dialog` opens (not `#tx-drawer`), Escape returns focus to that row.
26. `a tablet width keeps the list` (`page.setViewportSize({ width: 900, height: 1000 })`): no `table`, `#tx-select-mode-btn` visible, a row opens a `dialog`.

That is 26 tests (78 runs on three browsers).

### 6.3 The red run (the finished spec has nothing to fail against, so the order is inverted)

The code under test is shipped, so a correct spec is green on first run and a stash has nothing to remove. To show the assertions bite, write the whole file, then **before** the first green run apply these three temporary edits inside the spec and run only those tests:

```
npx playwright test tests/transactions-views.spec.ts --project=chromium -g "heat shades|bulk Delete confirms|the switch spans" 2>&1 | tee workflow/stages/02_build/output/logs/T814-red.log
```

1. In test 8, change the Oct 10 expectation from `/bg-heat-3/` to `/bg-heat-1/`. Must fail: class mismatch on `#tx-cal-day-2026-10-10`.
2. In test 19, change the focus assertion after the confirmed delete from `#tx-select-all` to `#tx-search-input`. Must fail: `#tx-search-input` is not focused.
3. In test 22, change `#tx-select-all` count 0 to count 1. Must fail: count is 0.

Expected: exactly 3 failed. Quote the three failure lines in the build report, then revert the three edits (by hand, no `git checkout`) and run the green gates. The reviewer repeats the same three edits.

## 7. Docs edits

**1. `DESIGN.md`, the Transactions section (`:256-266`).** Bring it in line with the code as shipped. Keep its bullet style, no em dash, no filler. Verify each fact against the file cited before writing it. It must say, at least:
- The header line is unchanged. A **view switch** under the header: a tab-mode `SegmentedControl` ("Table", "Calendar") that controls the page's tabpanel; the last view is remembered per device and the Table is the default; a hand-off from the Dashboard, a wallet or the Daily diary always opens the Table.
- **Filter row:** add that in the Calendar view the range select and the day chip are hidden (the month is the range) while search, wallet, category, type and Show deleted stay and apply to both views.
- **Table (from `lg`):** replaces the "List" bullet's wide case. One card: the summary line, a real table (checkbox, Date, Note, Category, Wallet, Amount and a row menu column), a sticky header with the allowed blur, a day row per day with its L11 net coloured as `DayGroupHeader`, "Load 25 more" at the foot. The row's Note cell is the button that opens the panel. Under `lg` the card is the list of `DayGroupHeader`s and `TransactionRow` buttons as before.
- **Row menu:** each Table row has a "⋯" `OverflowMenu` with Edit and Delete (red), or Restore for a deleted row. Delete asks "Delete this transaction?" first, then soft-deletes. After a delete that removes the row, focus goes to the next row, else the previous, else the select-all box, else the search box. **Correct `:265`:** it no longer says "No trash button on a row"; say that the Table has the row menu and that the list under `lg` has no row menu, so deleting there happens in the panel, which does not confirm.
- **Selection and the bulk bar:** from `lg`, a checkbox column (16px box in a 44px hit area) and a "Select all loaded rows" header box; a bar on `brand-soft` above the table while rows are selected: "N selected" (a polite live region), the selection's net (transfers, repayments, adjustments and deleted rows are not counted, and it says so), Clear, and Delete (confirmed, "Delete N transactions?") or Restore when every selected row is deleted. Under `lg`, a "Select" button starts a mode with a checkbox per row, a tap toggles, and the bar is pinned above the bottom nav with Cancel. A failure keeps the selection and shows the message. Focus after a bulk action or Clear is the select-all box (the Select button on a phone).
- **Calendar view:** the 7/12 and 5/12 layout from `lg`, stacked below; Monday first; a header with ‹ › (› disabled on the current month unless a later month has rows) and the month's In, Out and Net; each day a 44px button named in full ("Sat, Oct 10, spent ฿3,000.00, net −฿3,000.00, 2 transactions"), the day number and its signed net from `sm`, the day number alone on a phone; a future day is disabled only when it has no rows; today has the inset `focus` ring, the selected day the brand fill; **heat:** the background is one of three steps of the `expense` hue, by spending against the month's highest day (thirds), none when the day spent nothing, and a legend names every shade. The **day panel:** the day's heading, In, Out and Net insets, its rows, "No transactions on this day" when empty, "Add transaction on <date>" (opens the Add form on that day) and, when the Daily diary has an entry for it, "Open this day in Daily diary". A row opens the edit panel in the sheet at every width in this view. Picking a day is the same day filter the diary hand-off uses, so going back to the Table keeps it.
- **Tokens table (`:37-57`):** add one row for the calendar heat: Role "Calendar spending heat", Token `heat-1`, `heat-2`, `heat-3`, Dark `#291A1E`, `#3A1E23`, `#4C2229`, Light `#FEF4F2`, `#FBE7E4`, `#F8DBD7` (copy the values from `src/index.css:195-198` and `:268-271` again before writing; they must match). Add to the contrast paragraph (`:62`) that `fg` and `expense` text reach 4.5:1 and the `focus` ring 3:1 on each heat step, in both themes, checked by `scripts/wcag-tokens.mjs` (run it and confirm).
- **Daily diary section `:323`:** the "Only Wed, Sep 30 ×" chip appears in the Table view only.

Do not restate numbers that change (row counts, test counts). Do not add a Shared-components table row.

**2. `docs/audit/test-selector-contract.md`.**
- `:92`: change the heading to `### Transactions views (Phase 149; \`tests/transactions-views.spec.ts\` uses them)`.
- `:99`: replace "focus lands as decision 9's table says" with the rule: after a bulk Delete, a bulk Restore or Clear in the Table, focus lands on `#tx-select-all`; on the phone, after a bulk action or Cancel, on `#tx-select-mode-btn`; either falls back to `#tx-search-input` when the control is gone; turning Select mode on focuses the first row's checkbox; after a confirmed row-menu Delete that removes the row, focus lands on the next row's `#tx-row-*` button, else the previous row's, else `#tx-select-all`, else `#tx-search-input`; with Show deleted on, a row-menu Delete or Restore leaves focus on that row's `#tx-menu-btn-*`.
- Add one bullet under "Transactions views": the heat cells are asserted by class, `bg-heat-1|2|3` on `#tx-cal-day-*` (renaming the utilities breaks `transactions-views.spec.ts`); the Add-on-day dialog is `getByRole('dialog', { name: /Record New Transaction/ })`; the diary hand-off uses `#diary-day-tx-link-<date>` and `#diary-cal-day-<date>`.
- Add `- \`transactions-views.spec.ts\`: ids ...` to the per-spec list (`:22-50`), alphabetically after `transaction.spec.ts`, listing every id and test id the new spec uses, taken from the finished file (the `#tx-*` ids in section 4, `#nav-tab-*`, `#dashboard-tx-*`, `#diary-day-tx-link-*`, `#diary-cal-day-*`, `#confirm-destructive-btn`, `#tx-open-add-modal-btn`, `#tx-search-input`, `#tx-filter-type-income`, `#tx-show-deleted`, `#tx-load-more-btn`, `#tx-drawer`, `#tx-day-filter`, plus the suffix families the helper uses). Check by script: every `#id`, `[id^="..."]` and `[id$="..."]` literal in the finished spec appears in the contract file.
- Under "Text and title locators", add a bullet for the strings the spec matches: dialog titles "Delete this transaction?", "Delete N transactions?" and "Record New Transaction"; the region "Bulk actions"; the status text "N selected"; the Net and uncounted strings; "No transactions on this day"; the `aria-label` format of a calendar cell; "Select all loaded rows"; the tablist names "Table" and "Calendar".

## 8. Gates

Changed paths and tiers: `tests/*.spec.ts` (spec row), `docs/` and `DESIGN.md` (docs, with names, paths and token values to check). No `src/`, `unit/`, `api/`, `supabase/` change, so no unit tier. In order:

```
npm run lint
node scripts/wcag-tokens.mjs
npx playwright test tests/transactions-views.spec.ts --project=chromium 2>&1 | tee workflow/stages/02_build/output/logs/T814-e2e-chromium.log
npx playwright test tests/transactions-views.spec.ts 2>&1 | tee workflow/stages/02_build/output/logs/T814-e2e-all.log
npx playwright test tests/transactions-views.spec.ts --project=webkit --repeat-each=3 2>&1 | tee workflow/stages/02_build/output/logs/T814-e2e-webkit-x3.log
```

Before Playwright, check ports 3000 and 3100 for a stale dev server and stop any you started. Never edit `src/` while Playwright runs (this task edits none).

Checks the builder runs and reports:
- **Green:** 26 tests, 26 passed on chromium; 78 on three browsers (any skip must be named); the webkit repeat all passed.
- **Red run** per 6.3 saved to `T814-red.log` with the 3 failures quoted.
- **Playwright count:** `npx playwright test --list` now reports 37 spec files; record the new test and run totals (the old figures were 187 tests, 36 specs, 561 runs). Do **not** edit `AGENTS.md`, `README.md` or `docs/contexts/ui-and-e2e.md` for them; the phase-closing task updates those counts, as T808 did.
- **No `src/` change:** `git diff --stat HEAD -- src unit supabase api AGENTS.md` is empty.
- **Docs landed:** the heat token values in `DESIGN.md` equal those in `src/index.css` (compare by script); `:265` of the old text ("No trash button on a row") is gone from `DESIGN.md`; the old `:99` sentence ("decision 9's table") and the old `:92` heading text are gone from the contract file; every id literal in the spec is in the contract file.
- **Line endings:** `git ls-files --eol DESIGN.md docs/audit/test-selector-contract.md` still `w/crlf`; for the new spec a Node count of `\r\n` and of bare `\n` shows no bare `\n`.
- **Em dashes:** 0 in the added diff lines (command in `workflow/stages/01_spec/CONTEXT.md`) and in the new spec and the build report (the whole-file command there).
- **Owner files unchanged:** `git hash-object docs/audit/decisions/0109-transactions-table-and-calendar-views.md docs/design/transactions-2026-10/spec.md` equals T813's: `4b233a3025b6b3a725867f88475aa5b3ed81dd5a` and `2711cad4aeefe0fb084b27583c1e9245db29704d`.
- **Scope:** `git status --porcelain` lists only section 2's files, the ledger, and the task's spec, build report and `workflow/stages/02_build/output/logs/` (ignored).

## 9. Production touch points

None. The spec is guest mode only; it writes no SQL, calls no `/api/*` (a guest session does not reach the proxies; the spec does not use Smart Rules or Jev), signs in nowhere and uses no MCP or CLI write tool. No Target file is on the automatic-pause list (no `src/context/`, `src/selectors/`, ledger, `supabase/`, `api/`, `.claude/agents/`, `AGENTS.md` or stage `CONTEXT.md`), so the orchestrator can send `build T814` without pausing.

## 10. Out of scope

- Every `src/` file. T813's review noted two unfinished polish items; neither is done here: `px-0` on the header checkbox cell (`TransactionsTable.tsx:143`, where `HEADER_CELL_CLASS` still carries `px-4`) and the focus-in-`requestAnimationFrame` choice. While the spec runs, if the select-all box looks off-centre against the row boxes at 1280px, note it in the build report; do not change it.
- `helpers.ts` (the local `seedTransactions` stays in the spec; promote it only when a second spec needs it), other specs, `AGENTS.md`, `README.md`, `docs/contexts/*` (the Playwright totals there change in the phase-closing task), `refactor-log.md`, `baseline-metrics.md`, the ADR and the design spec.
- Signed-in behaviour (the bulk RPC against Supabase), a real-device look, the CSV import/export, the Add form's other fields, and keyboard-only paths beyond the focus targets above.
- A visual-regression screenshot of the heat colours (colour values are covered by `unit/theme-tokens.test.ts` and `scripts/wcag-tokens.mjs`; the spec only proves the levels differ).
