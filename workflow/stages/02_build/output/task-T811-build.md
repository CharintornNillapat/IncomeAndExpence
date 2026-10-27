# Build Report - T811

## 1. Summary of Changes

Built the Transactions page's Calendar view (task 3 of `docs/design/transactions-2026-10/spec.md` section 9, ADR 0109):

- **Heat tokens and WCAG check (`src/index.css`, `scripts/wcag-tokens.mjs`):** Added `--heat-1`, `--heat-2`, `--heat-3` to `:root` (`#FEF4F2`, `#FBE7E4`, `#F8DBD7`), `.dark` (`#291A1E`, `#3A1E23`, `#4C2229`) and `@theme inline` (`--color-heat-1`, `--color-heat-2`, `--color-heat-3`), and added the 18 contrast checks (`fg`, `expense-text` at `4.5:1`; `focus` at `3:1` on `heat-1`, `heat-2`, `heat-3` in both themes) to `scripts/wcag-tokens.mjs`.
- **Calendar and Day Panel components (`src/components/transaction/TxCalendar.tsx`, `src/components/transaction/TxDayPanel.tsx`):** Created `TxCalendar` (with `TxCalendarDay`, `HEAT_CLASS`, `HEAT_LEGEND`) and `TxDayPanel` with the spec's DOM ids, ARIA labels, month summary, Monday-first grid, heat fills, legend, day summary cards, `TransactionRow` list (`#tx-row-${tx.id}`), `#tx-cal-add-btn` and `#tx-cal-diary-link`.
- **Entry form `initialDate` (`src/components/TransactionForm.tsx`):** Added `initialDate?: string` to `TransactionFormProps` and initialized the date state to `initialDate || todayIsoDate()`.
- **Calendar view wiring (`src/views/TransactionsView.tsx`):** Wired `calendarMonth`, `selectedCalDay`, `addModalDate`, `sheetMode`, `calendarDays`, `calendarMonthSummary`, `selectedCalDayTotals` and `selectedCalDayRows`. Kept the search, wallet, category, type and Show deleted filters visible in the Calendar view while hiding the range segmented control and the Diary day filter chip (`#tx-day-filter`) except when `dayFilter` is active. Isolated the `useDiaryState()` subscription inside `CalendarDayPanel` (rendered only when `viewMode === 'calendar'`) so the Table view maintains zero re-renders on diary writes (ADR 0092, ADR 0093). Wired the wide inline row editor over the day panel and the narrow sheet switching between the day panel and the row editor.
- **Diary day hand-off (`src/views/DiaryView.tsx`, `src/App.tsx`):** Added `initialDate?: string` and `onConsumeInitialDate?: () => void` to `DiaryView`, and wired `diaryInitialDate`, `handleOpenDayDiary` and `handleConsumeDiaryInitialDate` in `src/App.tsx`.
- **Unit tests and documentation (`unit/*`, `docs/*`):** Added unit tests in `unit/theme-tokens.test.ts`, `unit/tx-calendar.test.tsx`, `unit/transactions-page.test.tsx`, `unit/transaction-form-category.test.tsx` and `unit/diary-page.test.tsx`, and updated `docs/audit/test-selector-contract.md`, `docs/contexts/ui-and-e2e.md`, `docs/design/transactions-2026-10/spec.md` and `docs/audit/task-ledger.md`.

## 2. Files Changed

- `src/index.css` (modified)
- `scripts/wcag-tokens.mjs` (modified)
- `src/components/transaction/TxCalendar.tsx` (created)
- `src/components/transaction/TxDayPanel.tsx` (created)
- `src/components/TransactionForm.tsx` (modified)
- `src/views/TransactionsView.tsx` (modified)
- `src/views/DiaryView.tsx` (modified)
- `src/App.tsx` (modified)
- `unit/theme-tokens.test.ts` (modified)
- `unit/tx-calendar.test.tsx` (created)
- `unit/transactions-page.test.tsx` (modified)
- `unit/transaction-form-category.test.tsx` (modified)
- `unit/diary-page.test.tsx` (modified)
- `docs/audit/test-selector-contract.md` (modified)
- `docs/contexts/ui-and-e2e.md` (modified)
- `docs/design/transactions-2026-10/spec.md` (modified)
- `docs/audit/task-ledger.md` (modified)
- `workflow/stages/02_build/output/task-T811-build.md` (created)

## 3. Verification Gates Run

### Red Gate (failing tests and `wcag-tokens.mjs` before editing `src/`)
- Command: `node scripts/wcag-tokens.mjs; npx vitest run unit/theme-tokens.test.ts unit/tx-calendar.test.tsx unit/transactions-page.test.tsx unit/transaction-form-category.test.tsx unit/diary-page.test.tsx`
- Log: `workflow/stages/02_build/output/logs/T811-red.log`
- Result: Failed as expected (`scripts/wcag-tokens.mjs` threw `TypeError: Cannot read properties of undefined (reading 'match')` on missing `heat-1`; Vitest failed 5 test files, 17 failed tests + 1 suite error on missing `TxCalendar.tsx`/`TxDayPanel.tsx`, 64 passed).

### Gate 1: `npm run lint`
- Command: `npm run lint`
- Result: Passed (`check:node-globals`: 137 files in `src`, no Node globals; `check:safe-ids`: 137 files in `src`, no id from the time alone; `tsc --noEmit` and `tsc -p api/tsconfig.json`: 0 errors).

### Gate 2: `node scripts/wcag-tokens.mjs`
- Command: `node scripts/wcag-tokens.mjs`
- Result: Passed (exit 0). The 18 new `heat-*` lines:
  ```text
  PASS  light  fg on heat-1: 16.01 (need 4.5:1, #1C1917 on #FEF4F2)
  PASS  light  expense-text on heat-1: 5.56 (need 4.5:1, #B42318 on #FEF4F2)
  PASS  light  focus on heat-1: 7.31 (need 3:1, #4338CA on #FEF4F2)
  PASS  light  fg on heat-2: 14.54 (need 4.5:1, #1C1917 on #FBE7E4)
  PASS  light  expense-text on heat-2: 5.05 (need 4.5:1, #B42318 on #FBE7E4)
  PASS  light  focus on heat-2: 6.64 (need 3:1, #4338CA on #FBE7E4)
  PASS  light  fg on heat-3: 13.27 (need 4.5:1, #1C1917 on #F8DBD7)
  PASS  light  expense-text on heat-3: 4.61 (need 4.5:1, #B42318 on #F8DBD7)
  PASS  light  focus on heat-3: 6.06 (need 3:1, #4338CA on #F8DBD7)
  PASS  dark   fg on heat-1: 13.85 (need 4.5:1, #F0F0F4 on #291A1E)
  PASS  dark   expense-text on heat-1: 6.02 (need 4.5:1, #F87171 on #291A1E)
  PASS  dark   focus on heat-1: 3.93 (need 3:1, #7C3AED on #291A1E)
  PASS  dark   fg on heat-2: 12.56 (need 4.5:1, #F0F0F4 on #3A1E23)
  PASS  dark   expense-text on heat-2: 5.46 (need 4.5:1, #F87171 on #3A1E23)
  PASS  dark   focus on heat-2: 3.57 (need 3:1, #7C3AED on #3A1E23)
  PASS  dark   fg on heat-3: 11.13 (need 4.5:1, #F0F0F4 on #4C2229)
  PASS  dark   expense-text on heat-3: 4.84 (need 4.5:1, #F87171 on #4C2229)
  PASS  dark   focus on heat-3: 3.16 (need 3:1, #7C3AED on #4C2229)
  ```

### Gate 3: Targeted Vitest files
- Command: `npx vitest run unit/theme-tokens.test.ts unit/tx-calendar.test.tsx unit/transactions-page.test.tsx unit/transaction-form-category.test.tsx unit/diary-page.test.tsx unit/dom-id-convention.test.ts`
- Result: Passed (`6 passed (6)`, `93 passed (93)`).

### Gate 4: Full Unit Test Suite
- Command: `npm run test:unit`
- Log: `workflow/stages/02_build/output/logs/T811-unit.log`
- Result: Passed (`71 passed (71)`, `1560 passed (1560)`, `54.39s`).

### Gate 5: Affected Playwright Specs on Chromium
- Command: `npx playwright test tests/account-and-mobile-nav.spec.ts tests/auth.spec.ts tests/csv-classify.spec.ts tests/csv.spec.ts tests/dashboard.spec.ts tests/date-boundary.spec.ts tests/diary-page.spec.ts tests/diary.spec.ts tests/express-input.spec.ts tests/ios-field-zoom.spec.ts tests/jev-classify.spec.ts tests/layout-stability.spec.ts tests/presets.spec.ts tests/reduced-motion.spec.ts tests/routing.spec.ts tests/safe-area.spec.ts tests/smart-rules.spec.ts tests/soft-delete.spec.ts tests/storage-persistence.spec.ts tests/tab-preload.spec.ts tests/theme.spec.ts tests/toast-layering.spec.ts tests/transaction-edit.spec.ts tests/transaction.spec.ts tests/voice-input.spec.ts tests/wallet-forms.spec.ts --project=chromium`
- Log: `workflow/stages/02_build/output/logs/T811-e2e-chromium.log`
- Result: Passed (`145 passed (1.2m)`).

### Gate 6: Affected Playwright Specs on All 3 Browsers
- Command: `npx playwright test tests/account-and-mobile-nav.spec.ts tests/auth.spec.ts tests/csv-classify.spec.ts tests/csv.spec.ts tests/dashboard.spec.ts tests/date-boundary.spec.ts tests/diary-page.spec.ts tests/diary.spec.ts tests/express-input.spec.ts tests/ios-field-zoom.spec.ts tests/jev-classify.spec.ts tests/layout-stability.spec.ts tests/presets.spec.ts tests/reduced-motion.spec.ts tests/routing.spec.ts tests/safe-area.spec.ts tests/smart-rules.spec.ts tests/soft-delete.spec.ts tests/storage-persistence.spec.ts tests/tab-preload.spec.ts tests/theme.spec.ts tests/toast-layering.spec.ts tests/transaction-edit.spec.ts tests/transaction.spec.ts tests/voice-input.spec.ts tests/wallet-forms.spec.ts`
- Log: `workflow/stages/02_build/output/logs/T811-e2e-all.log`
- Result: Passed (`429 passed`, `6 skipped (7.3m)`).

### Additional Checks (Section 7 bullets 5-9)
- **Browser visual check (Section 7 bullet 5):** Inspected the Calendar view as a guest (no sign-in) at `1280px`, `1024px`, and `390px` in both light and dark themes with days seeded at spending `฿120.00` (`heat-1`), `฿1,250.00` (`heat-2`), `฿2,500.00` (`heat-3`), and today (`฿800.00` expense + `฿3,200.00` income, net `+฿2,400.00`):
  - Heat steps are clearly distinguishable in both themes: Light `rgb(254, 244, 242)` (`heat-1`), `rgb(251, 231, 228)` (`heat-2`), `rgb(248, 219, 215)` (`heat-3`); Dark `rgb(41, 26, 30)` (`heat-1`), `rgb(58, 30, 35)` (`heat-2`), `rgb(76, 34, 41)` (`heat-3`).
  - Selected fill (`bg-brand-fill`: Light `rgb(67, 56, 202)`, Dark `rgb(124, 58, 237)`) and today ring (`ring-2 ring-inset ring-white` when selected, `ring-2 ring-inset ring-focus` when unselected) remain crisp and legible.
  - Net text inside cells at `1280px` and `1024px` (`−฿120.00`, `−฿1,250.00`, `−฿2,500.00`, `+฿2,400.00`) is unclipped (`scrollWidth === clientWidth`, `clipped: false`), while the day panel sits side-by-side (`gridRight: 705 < panelLeft: 754` at `1280px`; `gridRight: 556 < panelLeft: 605` at `1024px`).
  - At `390px`, cell net text is hidden (`display: "none"` via `hidden sm:block`) and `#tx-cal-panel` stacks under the calendar grid (`gridBottom: 923 <= panelTop: 1040`).
- **Contract IDs check (Section 7 bullet 6):** Every `id=` in `TxCalendar.tsx` and `TxDayPanel.tsx` is listed in `docs/audit/test-selector-contract.md` and passes `unit/dom-id-convention.test.ts`.
- **Line endings and em-dash check (Section 7 bullets 7-8):** Every touched and created file uses CRLF line endings (`0` bare LF) and contains `0` em dashes (`\u2014`).
- **Git status check (Section 7 bullet 9):** Only the 17 spec target files, `docs/audit/task-ledger.md` and `workflow/stages/02_build/output/task-T811-build.md` are modified/untracked.
