# Spec: T811

Phase 149 (branch `phase-149-transactions-views`), task 3 of `docs/design/transactions-2026-10/spec.md` section 9 (the "design spec" below; its decisions are D1 to D13 and O1 to O6, recorded in ADR 0109). The id T811 is free: the ledger's highest id is T810 and no `task-T811-*` file exists. ADR 0109 is already written, so no new ADR. The order names no Backlog row, so no Backlog status changes. The Phase 149 section already exists in `docs/audit/task-ledger.md`; the builder adds the T811 row to it (Status `in-progress` first, `done` with the gate results at the end; leave `Commit` empty).

T809 (`a2634f1`) already shipped `monthBounds` (`src/selectors/timeRange.ts:54`), `dailyTotals` and `DayTotals` (`src/selectors/ledger.ts:229,243`), `HEAT_LEVELS` and `heatLevel` (`:261,269`), `selectionSummary`. Use them; do not redefine or edit them. T810 (`ec9fa58`) shipped the view switch and `TransactionsTable`.

## 1. Goal

Build the Transactions page's Calendar view: a Monday-first month grid whose days are shaded by how much was spent (three new `heat-N` colour tokens that pass the contrast check), a day panel beside it (stacked under it on a phone) with that day's rows and an "Add transaction on this day" button, and a way to open the diary for the day. The range select is hidden in this view because the month header is the range.

## 2. Target files

```
src/index.css
scripts/wcag-tokens.mjs
src/components/transaction/TxCalendar.tsx
src/components/transaction/TxDayPanel.tsx
src/components/TransactionForm.tsx
src/views/TransactionsView.tsx
src/views/DiaryView.tsx
src/App.tsx
unit/theme-tokens.test.ts
unit/tx-calendar.test.tsx
unit/transactions-page.test.tsx
unit/transaction-form-category.test.tsx
unit/diary-page.test.tsx
docs/audit/test-selector-contract.md
docs/contexts/ui-and-e2e.md
docs/design/transactions-2026-10/spec.md
docs/audit/task-ledger.md
```

`TxCalendar.tsx`, `TxDayPanel.tsx` and `unit/tx-calendar.test.tsx` are new. `unit/transaction-form-category.test.tsx` is the existing `TransactionForm` test file (it mounts the form with `FinanceProvider`); the `initialDate` tests go there. `docs/design/transactions-2026-10/spec.md` gets three small edits (section 7); see 4.9. `DESIGN.md` is not a target (design task 6 rewrites it).

## 3. Context to read

- `docs/contexts/ui-and-e2e.md` (components, views, modals, page contracts, the Playwright and selector rules).
- `docs/contexts/client-state.md` only for the entry form's `initialDate` and the filter state; no hook, context or selector changes are made.
- `docs/design/transactions-2026-10/spec.md` sections 1, 4.2, 5, 6, 7, 8, and `docs/audit/decisions/0109-transactions-table-and-calendar-views.md` D1, D4, D5.
- Do not open `docs/design/*.html`.

## 4. Current behaviour and what to build

### 4.1 Where the code stands

- `TransactionsView` holds `viewMode` (`src/views/TransactionsView.tsx:108`) and `chooseView` (`:111`). The Calendar tab's panel renders `null` (`:505-507`).
- `bounds` is the day filter, else `rangeBounds(range, today)` (`:143-146`), passed to `useTransactions` as `startDate`/`endDate` (`:160-167`). `sortedRows` (`:194`), `dayNets` (`:201`) and the summary sums (`:207-208`) derive from it.
- `selectedTxId`/`selectedTx` (`:212-220`); the bottom sheet opens on `!!selectedTx && !isWide` (`:534`) and the inline aside only inside the Table branch (`:509`). `drawerTitleRef` is focused when `selectedTxId && isWide` (`:241-243`).
- The Add modal renders `TransactionForm` (`:544-582`), opened by `setIsAddModalOpen(true)` (`:360`). `Modal` unmounts its children when closed (`src/components/Modal.tsx`, `{isOpen && (` in its return), so the form starts fresh on every open.
- `TransactionForm` starts its date at `todayIsoDate()` (`src/components/TransactionForm.tsx:153`) and has no initial-date prop (props at `:31-74`).
- `DiaryCalendar` (`src/components/diary/DiaryCalendar.tsx`) is the look to follow: `dayClass` (`:21-34`), weekday labels (`:19`, `text-[11px]` at `:70`), legend (`:103-117`). It does not change.
- `DiaryView` always starts on today (`src/views/DiaryView.tsx:39-41`). There is no hand-off into it yet; the Diary-to-Transactions hand-off is the model (`src/App.tsx:72-74,206-213,260-261,280`).
- `src/index.css`: tokens in `:root` (`:170`) and `.dark` (`:240`), mapped in `@theme inline` (`:309`). `scripts/wcag-tokens.mjs` reads both blocks and checks pairs (per-theme loop `:64-110`).

### 4.2 Decisions this spec makes (the builder follows them, no other judgment call)

1. **Switching views clears the selected row** (the open question from T810's review). `chooseView` also calls `setSelectedTxId(null)`, in both directions. Why: in the Calendar the edit panel is always the `Modal` (design D11), in the Table from `lg` it is the inline aside; carrying a selection across would open a sheet the user did not ask for (narrow Calendar) or pop an aside in (wide Table). Move `chooseView` below the `selectedTxId` state, since it now reads `setSelectedTxId`.
2. **The Calendar's rows are the month's, not the page range.** When `viewMode === 'calendar'`, `bounds` is `monthBounds(calendarMonth)` (new state `calendarMonth`, a `YYYY-MM` string) and the range and `dayFilter` are not applied to `useTransactions`. The search, wallet, category, type and Show deleted filters still apply (design D1). The Table keeps exactly today's `bounds`. The range state is kept untouched, so switching back restores it.
3. **A calendar day is `dayFilter`** (design D10): picking a day calls `setDayFilter(iso)`. The selected day shown is `dayFilter` when it lies in `calendarMonth`, else the default: today when `calendarMonth` is the current month, else the latest day in the month's `dailyTotals` map, else `null` (the panel says "Pick a day"). The default is derived, never stored, so it does not leak into the Table; an explicit pick does leak (the Table then shows its "Only <day>" chip), which is what D10 asks for.
4. **Month change clears `dayFilter`** (`setDayFilter(null)` with `setCalendarMonth`), so the default rule in item 3 applies to the new month. `chooseView('calendar')` sets `calendarMonth` to `monthKeyOf(dayFilter)` when a day filter is on (a diary hand-off day, then the user opens the Calendar), else leaves it. Initial `calendarMonth` is `monthKeyOf(initialDayFilter ?? today)`.
5. **In the Calendar view the filter row hides the range select (`#tx-filter-range`) and the `#tx-day-filter` chip.** The chip is hidden because its Clear would leave the panel with no day while the heading already names the day. Both stay in the Table view. Everything else in the row is unchanged.
6. **Next month (›) is disabled** when the next month starts after `today` and the ledger holds no row dated on or after that month's first day: `rawTransactions.some((tx) => (showSoftDeleted || !tx.isDeleted) && tx.transactionDate.slice(0, 10) >= nextMonthStart)`, where `nextMonthStart = \`${shiftMonth(calendarMonth, 1)}-01\``. It ignores the search and type filters on purpose (a hint that rows exist ahead, per design D12). The view computes this boolean and passes it as `canGoNext`. The previous month is never disabled.
7. **A day cell is disabled** only when `iso > today` and `days` has no entry for it (design D12); `days` is built from the filtered month rows.
8. **The day panel lists all of the day's rows** (no "Load more"): a single day's rows are bounded by what one person enters in a day. The ceiling is stated in a code comment starting `ponytail:`. L12 still holds for the Table.
9. **The edit panel opens in `Modal` at every width in the Calendar view.** Define `const sheetMode = !isWide || viewMode === 'calendar'`; use it for the sheet's `isOpen` (`!!selectedTx && sheetMode`) and its child (`sheetMode && details`). The inline `#tx-drawer` aside stays Table-only (it already is). Guard the title-focus effect with `viewMode === 'table'`.
10. **Selected cell:** the brand fill wins over heat and the day number and net are `text-white` (as `DiaryCalendar`'s `dayClass`); today's ring is `ring-white` on the selected day. This keeps the contrast pairs the script already checks (`white on brand-fill`).
11. **The "Open this day in Daily diary" link** needs a hand-off into the diary, which is the one place this task touches outside the Transactions page (`App.tsx`, `DiaryView.tsx`); see 4.8. `TransactionsView` gets an optional prop `onOpenDiaryDay?: (date: string) => void`; with it unset (as in unit tests that omit it) the link never renders. The link also needs "the diary has an entry that day": `useDiaryState()` from `../context/DiaryContext`, `diaryEntries.some((e) => !e.isDeleted && e.date === selectedDay)`, computed once in the view.

### 4.3 Colour tokens and the contrast pass (`src/index.css`, `scripts/wcag-tokens.mjs`)

Add three tokens, on the `expense` hue, in both blocks, and map them:

| Token | `:root` (light) | `.dark` |
|---|---|---|
| `--heat-1` | `#FEF4F2` | `#291A1E` |
| `--heat-2` | `#FBE7E4` | `#3A1E23` |
| `--heat-3` | `#F8DBD7` | `#4C2229` |

In `@theme inline` add `--color-heat-1: var(--heat-1);` and the same for 2 and 3, so `bg-heat-1` to `bg-heat-3` exist. Put a comment above the three light/dark lines citing design spec O3 and ADR 0109 D5.

These values were measured (WCAG ratios, the script's own formula): `fg` on heat-1/2/3 is 16.01/14.54/13.27 light and 13.85/12.56/11.13 dark; `expense-text` on them is at least 4.61 light (heat-3) and 4.84 dark (heat-3); `focus` on them is at least 6.06 light and 3.16 dark (heat-3). The light heat-3 is the darkest the `expense-text` colour (`#B6332A`) allows at 4.5:1, which is why the light steps are close (about 1.10 between neighbours): shade is never the only signal (net is signed, the label states the figures, the legend names each step). If the script reports a fail on a value, lighten that token by one step and report the new value; do not change `expense-text` or any existing token.

In `scripts/wcag-tokens.mjs`, inside the per-theme loop, add (with a comment `// Phase 149 (ADR 0109 D5): ...`): for each of `heat-1`, `heat-2`, `heat-3`, `check(theme, \`fg on heat-N\`, c('fg'), c('heat-N'), 4.5)`, the same for `expense-text` (the negative net) at 4.5, and `focus` (today's ring) at 3. Do not add the heat tokens to the `surfaces` array.

### 4.4 `TransactionForm` `initialDate`

Add `initialDate?: string` to `TransactionFormProps` with a doc comment ("Starts the date field on this local day instead of today; the date stays editable"), and change line 153 to `useState<string>(initialDate || todayIsoDate())`. Add `initialDate` to the destructured props. Nothing else in the form changes.

In `TransactionsView`: new state `addModalDate: string | undefined`. The header's "Add transaction" button sets it to `undefined` then opens the modal; the day panel's button sets it to the selected day then opens it. Pass `initialDate={addModalDate}` to the form. Reset it to `undefined` when the modal closes (`onClose` and after a successful save).

### 4.5 `TxCalendar` (new, `src/components/transaction/TxCalendar.tsx`)

A presentational component; every figure arrives as a prop (design D4). Export:

```ts
export interface TxCalendarDay extends DayTotals { heat: number }   // DayTotals from ../../selectors/ledger
export const HEAT_CLASS: Record<number, string> = { 1: 'bg-heat-1', 2: 'bg-heat-2', 3: 'bg-heat-3' };
export const HEAT_LEGEND: Record<number, string> = { 1: ..., 2: ..., 3: ... };   // legend labels, see below

interface TxCalendarProps {
  monthKey: string;                       // YYYY-MM
  onChangeMonth: (monthKey: string) => void;
  canGoNext: boolean;
  today: string;
  selectedDay: string | null;
  onSelectDay: (iso: string) => void;
  days: ReadonlyMap<string, TxCalendarDay>;
  month: { income: number; spending: number; net: number };
}
```

The `HEAT_CLASS` literals must be written out in full (Tailwind scans source text; `source(none)` in `src/index.css:15` means a built class name is never generated). The legend labels: 1 `Up to a third of the top day`, 2 `Up to two thirds`, 3 `Over two thirds`. These are tied to `HEAT_LEVELS = 3`; a unit test asserts `Object.keys(HEAT_CLASS)` and `Object.keys(HEAT_LEGEND)` both have `HEAT_LEVELS` entries, so raising the constant without the tokens fails a test.

Structure (copy `DiaryCalendar`'s structure and classes where the same; `Card padding="none"` with `className="p-4 sm:p-6 flex flex-col gap-4"`):

1. Header row: `<h2 id="tx-cal-heading">` with `formatMonthYear(monthKey)`; ‹ and › `IconButton`s with ids `tx-cal-prev-month-btn` ("Previous month") and `tx-cal-next-month-btn` ("Next month", `disabled={!canGoNext}`), calling `onChangeMonth(shiftMonth(monthKey, -1 | 1))`.
2. Month line under it: "In", "Out" and "Net", each label followed by a `Money`. In: `showPlus`, `text-income`, wrapper `id="tx-cal-month-in"`; Out: `Money value={-month.spending}`, `text-expense`, `id="tx-cal-month-out"`; Net: `showPlus`, `text-expense` when negative else `text-fg`, `id="tx-cal-month-net"`. Same type scale as the Table card's summary line (`text-sm`).
3. Weekday labels exactly as `DiaryCalendar` (Monday first, `aria-hidden`, `text-[11px]`), then `monthGrid(monthKey)` weeks, a `<span>` for each `null`.
4. A day cell is `<button type="button" id={\`tx-cal-day-${iso}\`}>` with `aria-pressed={iso === selectedDay}`, `disabled={iso > today && !days.has(iso)}` and this `aria-label`: `formatWeekdayDate(iso)` then, when `days.get(iso)` exists, `, spent ${formatCurrencyAmount(d.spending)}, net ${signed(d.net)}, ${d.count} ${d.count === 1 ? 'transaction' : 'transactions'}`, else `, no transactions`; append `, today` when `iso === today`. `signed(n)` is `+` for a positive, nothing for zero, and the `MINUS` prefix coming from `formatCurrencyAmount` for a negative: `${n > 0 ? '+' : ''}${formatCurrencyAmount(n)}` (import `formatCurrencyAmount` from `../../utils/currency`). Example: `Wed, Oct 21, spent ฿735.00, net −฿735.00, 4 transactions`.
5. Cell look: `w-full min-h-[44px] sm:min-h-[56px] rounded-inner tabular-nums flex flex-col items-center justify-center gap-0.5 transition-control duration-150`. Number: `text-xs`. Fill, in this order of precedence: selected `bg-brand-fill text-white font-semibold`; else a future empty day `text-fg-disabled cursor-not-allowed`; else `HEAT_CLASS[d.heat]` when `d && d.heat > 0` (no hover fill; the heat shade stays) with `text-fg font-semibold`; else `text-fg-secondary hover:bg-surface-3 hover:text-fg` (plus `font-semibold text-fg` when the day has rows). Today's ring: `ring-2 ring-inset ring-focus`, or `ring-white` when selected (the `dayClass` rule). `cursor-pointer` on enabled cells.
6. Inside a day with rows, under the number: `<span className="hidden sm:block max-w-full truncate text-[11px] leading-none ...">` holding `<Money value={d.net} showPlus />`, `text-white` when selected, else `text-expense` when `d.net < 0` else `text-fg`. The `hidden sm:block` hides it on a phone (design D13) with one element, not a second copy; the `aria-label` carries the figure at every width. `text-[11px]` is the size `DiaryCalendar` already uses for the weekday labels. `ponytail:` comment: an amount too wide for a cell is clipped by `truncate`; the full figure is in the label and the panel.
7. Legend under the grid: `<ul id="tx-cal-legend" aria-label="Legend">`, items (swatch `w-3 h-3 rounded-sm` then text): one per `HEAT_LEVELS` (`HEAT_CLASS[level]` swatch, `HEAT_LEGEND[level]`), then Today (`ring-2 ring-inset ring-focus`), then "Selected day" (`bg-brand-fill`). Add a one-line note beside or under it: `Shading is spending against the month's highest day.` (no em dash). Wrap on small widths like `DiaryCalendar`'s legend.

### 4.6 `TxDayPanel` (new, `src/components/transaction/TxDayPanel.tsx`)

Presentational. Props: `day: string | null`, `today: string`, `totals: { income: number; spending: number; net: number } | undefined`, `rows: Transaction[]`, `categories: ReadonlyMap<string, Category>`, `wallets: ReadonlyMap<string, Wallet>`, `selectedTxId: string | null`, `onSelect: (tx: Transaction) => void`, `onAdd: () => void`, `hasDiaryEntry: boolean`, `onOpenDiary?: () => void`.

- Container `<section id="tx-cal-panel" aria-labelledby="tx-cal-panel-title">` in a `Card className="flex flex-col gap-5"`.
- `day === null`: `<h2 id="tx-cal-panel-title">Pick a day</h2>` and one line "Choose a day in the calendar to see its transactions." Nothing else (no Add button).
- Otherwise: `<h2 id="tx-cal-panel-title">{formatDayLabel(day, today)}</h2>`; three insets (`bg-surface-2 rounded-inner`, label + `Money`) In (`showPlus`, `text-income`, `id="tx-cal-panel-in"`), Out (`Money value={-spending}`, `text-expense`, `id="tx-cal-panel-out"`), Net (`showPlus`, the expense/fg rule, `id="tx-cal-panel-net"`); zeros when `totals` is undefined.
- Rows: when `rows` is non-empty, a column of `TransactionRow` with `id={\`tx-row-${tx.id}\`}`, `category`, `wallets`, `onSelect`, `selected={tx.id === selectedTxId}`, `className="rounded-control"` (as the narrow list does, `TransactionsView.tsx:308-318`), inside a `flex flex-col gap-1` wrapper with the same 8px inset idea. Empty: `<p id="tx-cal-panel-empty">No transactions on this day</p>`.
- `Button id="tx-cal-add-btn" variant="secondary"` full width (`className="w-full"`), label `Add transaction on ${formatWeekdayDate(day)}`, `onClick={onAdd}`.
- When `hasDiaryEntry && onOpenDiary`: a `Button id="tx-cal-diary-link" variant="soft"` (or `secondary`) labelled `Open this day in Daily diary`, `onClick={onOpenDiary}`. Use `Button` with the existing variants only; check `src/components/ui/Button.tsx` for the variant names and do not add one.

### 4.7 `TransactionsView` wiring

All figures are computed here, once, in `useMemo`s keyed on `viewMode === 'calendar'` (return empty values otherwise, so the Table path pays nothing):

- `dayTotals = dailyTotals(sortedRows, categoryMap)`; `monthMax = Math.max(0, ...[...dayTotals.values()].map((d) => d.spending))`; `calendarDays: Map<string, TxCalendarDay>` = each entry spread with `heat: heatLevel(d.spending, monthMax)`.
- `monthFlow = cashFlow(sortedRows, categoryMap)` gives `{ income, spending, net: monthFlow.leftOver }` for `month`.
- `calendarDay` per decision 3; `dayRows = sortedRows.filter((tx) => tx.transactionDate.slice(0, 10) === calendarDay)` (rows keep `byNewest` order); `dayPanelTotals = calendarDay ? dayTotals.get(calendarDay) : undefined`.
- `canGoNext` per decision 6; `hasDiaryEntry` per decision 11.
- Render, inside `#tx-view-panel` for `viewMode === 'calendar'`: `<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">` with `TxCalendar` in `lg:col-span-7` and `TxDayPanel` in `lg:col-span-5` (the diary's layout, `DiaryView.tsx:127-157`; one DOM copy, the grid collapses by CSS, so the day panel stacks under the calendar below `lg`, tablet included, design section 5). No Table, no list card, no "Showing N of M" footer, no EmptyState in this view.
- `TxDayPanel`'s `onAdd`: set `addModalDate` to `calendarDay`, open the Add modal. `onOpenDiary`: `onOpenDiaryDay?.(calendarDay)`.
- `selectRow` is the panel's `onSelect`. The existing `closeDrawer` focus return to `#tx-row-<id>` works because the panel's rows carry the same ids.
- Keep the Table path, `listCard` and the narrow list exactly as T810 left them.

### 4.8 The diary hand-off (`src/App.tsx`, `src/views/DiaryView.tsx`)

Mirror the Diary-to-Transactions hand-off:

- `App.tsx`: state `diaryInitialDate: string | undefined`; `handleOpenDayDiary = useCallback((date) => { setDiaryInitialDate(date); handleTabChange('diary'); }, [handleTabChange])`; `handleConsumeDiaryInitialDate = useCallback(() => setDiaryInitialDate(undefined), [])`. Pass `onOpenDiaryDay={handleOpenDayDiary}` to `TransactionsView` (`:254-262`) and `initialDate={diaryInitialDate}` / `onConsumeInitialDate={handleConsumeDiaryInitialDate}` to `DiaryView` (`:280`). Add a comment citing ADR 0109.
- `DiaryView`: props `initialDate?: string` and `onConsumeInitialDate?: () => void`. Initial `selectedDate` is `initialDate && initialDate <= today ? initialDate : today`, and `calendarMonth` is `monthKeyOf` of it. A mount `useEffect(() => { if (initialDate) onConsumeInitialDate?.(); }, [])` (same `// eslint-disable-next-line` style as `TransactionsView.tsx:131`). Nothing else in the diary changes; `DiaryCalendar` is untouched.

### 4.9 Docs

- `docs/audit/test-selector-contract.md`: under "Transactions views (Phase 149 ...)" add the new ids (4.10) and one bullet each for: the day panel's rows reuse `#tx-row-*` (the Table is not mounted in this view, so ids stay unique); `#tx-cal-day-*` matches the cells only (the panel uses `tx-cal-panel-*`); the future-day rule and that a cell's name states the figures (a spec reads `aria-label`, not the net text, which is hidden below `sm`); the Add modal's date field starts on the selected day. Update the intro line so it no longer says the `tx-cal-*` ids "come with design tasks 3 and 5" (only `tx-select-*` and `tx-bulk-*` still do).
- `docs/contexts/ui-and-e2e.md`: add the Calendar view facts the next builder needs, in the section T810 edited (month rows not the page range, selection cleared on a view switch, edit panel in `Modal` at every width, range select and day chip hidden). Keep it short and match the file's style.
- `docs/design/transactions-2026-10/spec.md`: (a) section 7, rename `tx-cal-day-panel` to `tx-cal-panel` in the new-ids list and add the ids from 4.10, because `tx-cal-day-panel` would match a `[id^="tx-cal-day-"]` selector meant for the cells; (b) section 4.2, "Day panel", the same rename if the id is named there; (c) section 4.2, after the "Selected day on arrival" bullet, one sentence: switching views clears the selected row. No other change to that file.
- `docs/audit/task-ledger.md`: the T811 row.

### 4.10 New ids (all start `tx-`; `unit/dom-id-convention.test.ts` enforces it)

`tx-cal-heading`, `tx-cal-prev-month-btn`, `tx-cal-next-month-btn`, `tx-cal-month-in`, `tx-cal-month-out`, `tx-cal-month-net`, `tx-cal-day-*` (cells, `tx-cal-day-YYYY-MM-DD`), `tx-cal-legend`, `tx-cal-panel`, `tx-cal-panel-title`, `tx-cal-panel-in`, `tx-cal-panel-out`, `tx-cal-panel-net`, `tx-cal-panel-empty`, `tx-cal-add-btn`, `tx-cal-diary-link`. The sheet reuses `tx-drawer-close-btn` as today.

## 5. Parity map

- "Spec-asserted DOM ids" row: the new ids go into `docs/audit/test-selector-contract.md` in this task (guarded by the Playwright suite; no spec uses them until design task 6).
- Everything else: none. No ledger arithmetic, no context, no selector, no type and no `index.html`/`vercel.json` change. The three `heat-N` tokens are not in the parity map; the contrast script is their guard.

## 6. Tests to add

Order for the red run: add and extend the tests and the `wcag-tokens.mjs` checks first, run them against the unchanged source, save the output to `workflow/stages/02_build/output/logs/T811-red.log`, then implement. Expected red: every new test fails (no tokens, no `TxCalendar`, no `initialDate` prop, empty Calendar panel, no hand-off), and `node scripts/wcag-tokens.mjs` exits with `cannot parse colour undefined` (the new checks read `heat-N` before the tokens exist; record that line in the log as that gate's red state). These are UI and CSS changes; no money-path file (`FinanceContext`, `src/selectors/`, `api/`) is edited, but the figures shown come from selectors, so the tests check them against the selectors, not against typed numbers alone.

**`unit/theme-tokens.test.ts`** (extend; why it fails today: the tokens do not exist)
- `defines heat-1 to heat-3 in :root and .dark with the frozen values and maps color-heat-N in @theme inline`: the six values in 4.3 and `var(--heat-N)`.
- `heat tokens are not consumed as raw hex`: `TxCalendar.tsx` source contains `bg-heat-1`, `bg-heat-2`, `bg-heat-3` and no `#[0-9a-fA-F]{3,8}\b` (fails today: the file does not exist; use `readFileSync` like the existing `WalletTransferForm` test).

**`unit/tx-calendar.test.tsx`** (new, `// @vitest-environment jsdom`; renders `TxCalendar` and `TxDayPanel` with props, no provider needed for `TxCalendar`; `TxDayPanel` renders `TransactionRow`, which takes plain props)
1. October 2026: 31 buttons `#tx-cal-day-2026-10-01` to `-31`; the first row's leading cells are empty so 2026-10-01 (a Thursday) is the fourth cell (Monday first); the weekday labels read Mon to Sun.
2. A spending day's `aria-label` is exactly `Wed, Oct 21, spent ฿735.00, net −฿735.00, 4 transactions` for matching props, a one-row day says `1 transaction`, a day absent from `days` says `Thu, Oct 22, no transactions`, and today's ends with `, today`.
3. `aria-pressed` is `true` only on `selectedDay`; clicking a cell calls `onSelectDay` with its ISO date.
4. A day after `today` with no entry is `disabled`; a day after `today` with an entry is enabled; today and past days are enabled.
5. Heat: a day with `heat: 1|2|3` has `bg-heat-1|2|3`; `heat: 0` has none; the selected cell has `bg-brand-fill` and no `bg-heat-*`.
6. The net text sits in an element whose class has `hidden` and `sm:block`, reads `−฿735.00` for a negative day and `+฿500.00` for a positive one, and is absent for a day with no entry.
7. `HEAT_CLASS` and `HEAT_LEGEND` each have exactly `HEAT_LEVELS` keys (imported from `../src/selectors/ledger`), and the legend renders one swatch label per level plus Today and Selected day.
8. Header: `#tx-cal-heading` is `October 2026`; ‹ calls `onChangeMonth('2026-09')`, › calls `onChangeMonth('2026-11')`, and `canGoNext={false}` disables › only; December steps to `2027-01`.
9. Month line: `#tx-cal-month-in/out/net` show the three figures through `formatCurrencyAmount`.
10. `TxDayPanel`: with a day it shows `formatDayLabel`, the three insets, the rows as `#tx-row-<id>` buttons, and `Add transaction on <formatWeekdayDate>`; clicking Add calls `onAdd`; empty rows show `#tx-cal-panel-empty` text "No transactions on this day"; `day={null}` shows "Pick a day" and no `#tx-cal-add-btn`; the diary link renders only with `hasDiaryEntry` and `onOpenDiary`, and calls it.

**`unit/transactions-page.test.tsx`** (extend, using its seeding helpers; why each fails today: the Calendar panel is `null`)
1. Calendar view (click `#tx-view-calendar`, or seed `pf_tx_view`): shows `#tx-cal-heading` for the current month, no `<table>`, no `#tx-filter-range`, no `#tx-day-filter` even with a day filter, but `#tx-search-input`, `#tx-filter-wallet`, `#tx-filter-category`, the type filter and `#tx-show-deleted` are present; the Table view still has `#tx-filter-range`.
2. Month figures match the selectors: seed an income row, two expense rows on different days and a transfer in the current month; `#tx-cal-month-in/out/net` equal `cashFlow` of those rows (`income`, `spending`, `leftOver`) through `formatCurrencyAmount`, and each day cell's `aria-label` spending/net/count equals `dailyTotals` for that day (the transfer moves `count` only).
3. Default selected day is today (`aria-pressed`), the panel lists only today's rows as `#tx-row-*`, a row dated another day is absent; clicking another day's cell moves `aria-pressed`, swaps the panel's rows and heading, and switching to the Table then shows `#tx-day-filter` with that day's label and only that day's rows.
4. Month step: ‹ shows the previous month's heading and its rows (seed one at `<prev month>-15`); the selected day becomes that month's latest day with rows; with a month holding no rows the panel says "Pick a day"; stepping back to the current month selects today again. A row dated the last day of the month (use `monthBounds(...).end`) appears in the grid.
5. › is disabled in the current month with no row ahead, and enabled when a row dated in a later month exists; the cell of a future day with no rows is `disabled`, and one with a row is not.
6. Heat: of two spending days, the larger has `bg-heat-3` and the smaller `bg-heat-N` with `N = heatLevel(smaller, larger)` (import `heatLevel`), an income-only day has no `bg-heat-*`.
7. Filters apply: the type filter Expense removes the income row from the panel and the month In figure; Show deleted counts a deleted row's `count`.
8. Edit opens in the sheet at every width: after `wide()`, clicking a panel row opens a `role="dialog"` with the details and renders no `#tx-drawer`; the Table at `wide()` still opens `#tx-drawer` inline (existing tests keep passing).
9. Selection is cleared on a switch: select a row in the Table at `wide()` (aside open), switch to Calendar, then back to the Table: no aside; narrow: open the sheet from the list, switch to Calendar: no dialog.
10. Add on the day: with a day selected, `#tx-cal-add-btn` opens the Add modal and its date field's value is that day; the header's Add transaction still starts on today; after the modal closes and reopens from the header the date is today again.
11. Diary link: with a diary entry for the selected day (seed through the guest ledger fixture used by `diary-page.test.tsx`) and `onOpenDiaryDay` passed, `#tx-cal-diary-link` calls it with the day; with no entry, or no prop, the link is absent.
12. The remembered view still wins at mount and the hand-offs (initial wallet, row, or day) still open the Table (existing T810 tests keep passing; add no duplicate).

**`unit/transaction-form-category.test.tsx`** (extend): `initialDate="2026-10-21"` makes the date field's value `2026-10-21` and a submit sends `date: '2026-10-21'`; without the prop the field is `todayIsoDate()`. Fails today: the prop is ignored.

**`unit/diary-page.test.tsx`** (extend): `DiaryView` with `initialDate` set to yesterday selects that day (the form heading and `aria-pressed` on `#diary-cal-day-<yesterday>`) and calls `onConsumeInitialDate` once; a future `initialDate` falls back to today. Fails today: the prop does not exist.

Narrow vs wide: jsdom has no `matchMedia`, so a test without `wide()` is the phone layout. The CSS-only parts (`hidden sm:block`, the `lg:` grid) are asserted by class name; real layout is checked by the Playwright run below.

## 7. Gates

Changed paths: `src/index.css`, `src/components/`, `src/views/`, `src/App.tsx` (components tier), `scripts/`, `unit/`, docs. Run, in order:

```
npm run lint
node scripts/wcag-tokens.mjs
npx vitest run unit/theme-tokens.test.ts unit/tx-calendar.test.tsx unit/transactions-page.test.tsx unit/transaction-form-category.test.tsx unit/diary-page.test.tsx unit/dom-id-convention.test.ts
npm run test:unit
npx playwright test tests/account-and-mobile-nav.spec.ts tests/auth.spec.ts tests/csv-classify.spec.ts tests/csv.spec.ts tests/dashboard.spec.ts tests/date-boundary.spec.ts tests/diary-page.spec.ts tests/diary.spec.ts tests/express-input.spec.ts tests/ios-field-zoom.spec.ts tests/jev-classify.spec.ts tests/layout-stability.spec.ts tests/presets.spec.ts tests/reduced-motion.spec.ts tests/routing.spec.ts tests/safe-area.spec.ts tests/smart-rules.spec.ts tests/soft-delete.spec.ts tests/storage-persistence.spec.ts tests/tab-preload.spec.ts tests/theme.spec.ts tests/toast-layering.spec.ts tests/transaction-edit.spec.ts tests/transaction.spec.ts tests/voice-input.spec.ts tests/wallet-forms.spec.ts --project=chromium
npx playwright test <the same 26 specs, no project filter>
```

- The list is T810's 23 specs (every spec that opens the Transactions page or names a `tx-` id) plus `diary.spec.ts` and `theme.spec.ts` (the diary hand-off and the new colour tokens in both themes) and `safe-area.spec.ts` (an `index.css` change; the Backlog row from T774 asks the layout specs to run on token changes; `layout-stability.spec.ts` is already in the 23). Table is the default view, so the existing specs see no Calendar. If a spec outside the list fails, report it. No existing spec may be edited.
- `node scripts/wcag-tokens.mjs` must end `All token pairs pass.`; paste its 18 new lines (`fg`, `expense-text` and `focus` on each of the three heat tokens, in each theme) into the build report.
- Before Playwright: check ports 3000 and 3100 for stale dev servers, and do not edit `src/` while it runs.
- Save the full `npm run test:unit` output with `tee` to `workflow/stages/02_build/output/logs/T811-unit.log`, and each Playwright run to `T811-e2e-chromium.log` and `T811-e2e-all.log` in the same folder. Report real figures; unit is 1535 tests in 70 files today and this task adds one file (71) and the new tests. Do not edit the counts in `AGENTS.md` or `README.md` (the task that ships the phase does).
- Look at the Calendar once in a browser at 1280px and 390px, light and dark (`npm run dev`, a guest ledger with a few days of spending), and say in the build report what you saw: heat steps distinguishable, today ring and selected fill legible, net text not clipped at 1024px, the day panel stacked under the grid at 390px. This is the only check of the layout; do not skip it. Do not sign in.
- Convention: `unit/dom-id-convention.test.ts` passes.
- Docs: every id the contract names exists in `src`: `git grep -nE "tx-cal-(heading|prev-month-btn|next-month-btn|month-in|month-out|month-net|day-|legend|panel|add-btn|diary-link)" src` shows each.
- Line endings: `git ls-files --eol` shows `w/crlf` for every modified tracked target; for the three new files use `node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');console.log(f,'crlf',(s.match(/\r\n/g)||[]).length,'bare lf',(s.match(/(?<!\r)\n/g)||[]).length)}" src/components/transaction/TxCalendar.tsx src/components/transaction/TxDayPanel.tsx unit/tx-calendar.test.tsx` (bare lf must be 0).
- Em dashes: 0 in the added lines (`node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"`), and 0 in the three new files and the build report (`node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" src/components/transaction/TxCalendar.tsx src/components/transaction/TxDayPanel.tsx unit/tx-calendar.test.tsx workflow/stages/02_build/output/task-T811-build.md`). The minus sign U+2212 in tests is not an em dash.
- Scope: `git status --porcelain` lists only section 2's files, the build report and the logs folder (ignored).

## 8. Production touch points

None. No Supabase, no `/api/*`, no `vercel.json` or workflow change, no sign-in, no migration. The Add flow and the edit sheet use the existing guest and signed-in write paths through `useTransactions`; the specs run as a guest.

## 9. Out of scope

- `set_transactions_deleted`, its migration and the guest twin (design task 4); selection, checkboxes and the bulk bar (task 5); `tests/transactions-views.spec.ts` and the `DESIGN.md` Transactions rewrite, which must also record the three heat tokens, the legend and the contrast numbers (task 6).
- Editing `monthBounds`, `dailyTotals`, `heatLevel`, `HEAT_LEVELS`, `selectionSummary`, `useTransactions`, `FinanceContext`, or any other selector.
- Changing `DiaryCalendar`, `TransactionRow`, `DayGroupHeader`, `TransactionsTable`, `SegmentedControl`, `Modal`, the edit panel, or the Table and the narrow list (beyond the shared `chooseView`/sheet lines in 4.2).
- A shared month-calendar component for the diary and this page (ADR 0109 "Not done").
- Swipe between months, long-press, jumping the calendar to the month of a just-added transaction, pagination of the day panel, a hover treatment on heat cells.
- Any existing token's value; any existing spec; `AGENTS.md` and `README.md` counts; `refactor-log.md` and `baseline-metrics.md` (the task that ships the phase).
