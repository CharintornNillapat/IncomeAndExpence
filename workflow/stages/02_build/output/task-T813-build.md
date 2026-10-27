# Build Report - T813

## 1. Summary of Changes

Built selection and the bulk actions bar for Transactions (task 5 of `docs/design/transactions-2026-10/spec.md` section 9, ADR 0109):

- **Hook update (`src/hooks/useTransactions.ts`):** Destructured `setTransactionsDeleted` from `useFinanceActions()`, wrapped in `handleSetTransactionsDeleted` callback matching `handleDelete` pattern, and exposed `setTransactionsDeleted` on the hook's return object.
- **Checkbox component (`src/components/transaction/SelectCheckbox.tsx`):** Created new presentational checkbox component conforming to 44px hit-box rule and the show-deleted pattern. Features a transparent native `<input type="checkbox">` (`peer absolute inset-0 opacity-0 cursor-pointer`) over a drawn 16px `aria-hidden` box (`border-line-input bg-surface-2`, `peer-checked:bg-brand-fill`, `peer-focus-visible:ring-2 peer-focus-visible:ring-focus`). Uses `Check` icon when checked and `Minus` icon when `indeterminate` (set via DOM ref effect). Styled using semantic tokens only.
- **Bulk bar component (`src/components/transaction/TxBulkBar.tsx`):** Created pure presentational bulk actions bar component supporting `placement="inline"` (wide table view, between summary and table) and `placement="pinned"` (fixed above mobile bottom nav below `lg`: `fixed inset-x-0 z-40 bg-brand-soft border-t border-brand-soft-line px-4 py-3 bottom-[calc(4rem+1px+env(safe-area-inset-bottom,0.5rem))] md:bottom-0 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]`). Renders `#tx-bulk-count` with polite live region (`role="status"`), `#tx-bulk-net` with day-net coloration (`text-expense` when negative, else `text-fg`) and uncounted caption (`Transfers, repayments, adjustments and deleted rows are not counted`) using `text-fg-secondary`, all-deleted state (`Deleted rows are not in your totals`), error banner (`#tx-bulk-error` with `role="alert"`), and action buttons: Delete (`variant="danger"` `#tx-bulk-delete-btn`), Restore (`variant="secondary"` `#tx-bulk-restore-btn`), and Clear/Cancel (`variant="soft"` `#tx-bulk-clear-btn`).
- **Table view updates (`src/components/transaction/TransactionsTable.tsx`):** Added props `selectedIds`, `onToggleRow`, `onToggleAll`, `allSelected`, `someSelected`. Added checkbox column as column 0 with `#tx-select-all` in `<th>` (`ariaLabel="Select all loaded rows"`, checked/indeterminate) and `#tx-select-row-${tx.id}` in `<td>` (`ariaLabel={`Select ${displayTitle(tx, category)}`}`). Updated day rowgroup header `colSpan` to 7 and table `min-w` to `40rem`. Moved 3px violet focus edge from Date cell to the first cell. Selected row `tr` receives `bg-brand-soft`. In `confirmDelete`, captured neighbour row ids prior to deletion and scheduled post-commit focus in `requestAnimationFrame` landing on next row button, previous row button, `#tx-select-all`, or falling back to `#tx-search-input` when the table unmounts.
- **View integration (`src/views/TransactionsView.tsx`):** Managed selection state (`selectedIds`, `selectMode`, `bulkError`, `isBulkWorking`, `confirmBulkDelete`, `deleteError`, `pendingFocusRef`). Pruned `selectedIds` during render against `shownRows` (ADR 0056) and exited `selectMode` if rows become empty. Added `Select` button (`#tx-select-mode-btn`) in `listCard` header below `lg`. Rendered inline `TxBulkBar` on wide table when items are selected. Rendered narrow selection mode list with `<label>` wrapping `SelectCheckbox` and `TransactionRow` (`div`, no `onSelect`, `pointer-events-none`). Pinned `TxBulkBar` at root below `lg` with `pb-28` clearance. Added bulk delete confirmation dialog (`ConfirmDialog`) with live count and copy per Decision 4. Handled focus management across wide actions, phone actions, and select mode activation per Decision 9.
- **Tests (`unit/use-transactions.test.tsx`, `unit/transactions-bulk.test.tsx`, `unit/transactions-page.test.tsx`):**
  - Added unit test in `unit/use-transactions.test.tsx` verifying `useTransactions` exposes `setTransactionsDeleted` and deletes multiple transactions in one call.
  - Created `unit/transactions-bulk.test.tsx` with 5 mocked-hook tests verifying single call with live selected IDs, failed delete preserving dialog and selection, restore error banner display, mixed live/deleted selection, and disabled state while call in flight.
  - Updated `unit/transactions-page.test.tsx` for seven columnheaders and cell index offsets, and added 11 selection & bulk bar tests under `describe('selection and the bulk bar (ADR 0109 O1)')`.
- **Contract and context docs (`docs/audit/test-selector-contract.md`, `docs/contexts/ui-and-e2e.md`):** Documented all Decision 14 IDs, 7-column table layout, narrow selection mode label structure, destructive confirmation button, focus rules, and bulk selection architecture [0109].
- **Task ledger (`docs/audit/task-ledger.md`):** Updated row T813 to `done` with gate results.

## 2. Files Changed

1. `src/hooks/useTransactions.ts` (modified)
2. `src/components/transaction/SelectCheckbox.tsx` (created)
3. `src/components/transaction/TxBulkBar.tsx` (created)
4. `src/components/transaction/TransactionsTable.tsx` (modified)
5. `src/views/TransactionsView.tsx` (modified)
6. `unit/transactions-bulk.test.tsx` (created)
7. `unit/transactions-page.test.tsx` (modified)
8. `unit/use-transactions.test.tsx` (modified)
9. `docs/audit/test-selector-contract.md` (modified)
10. `docs/contexts/ui-and-e2e.md` (modified)
11. `docs/audit/task-ledger.md` (modified)
12. `workflow/stages/02_build/output/task-T813-build.md` (created)

## 3. Verification Gates Run

### Pre-build Check
- Owner file hashes verified:
  - `docs/audit/decisions/0109-transactions-table-and-calendar-views.md`: `4b233a3025b6b3a725867f88475aa5b3ed81dd5a`
  - `docs/design/transactions-2026-10/spec.md`: `2711cad4aeefe0fb084b27583c1e9245db29704d`

### Red Gate (failing tests before implementation)
- Command: `npx vitest run unit/transactions-page.test.tsx unit/transactions-bulk.test.tsx unit/use-transactions.test.tsx`
- Log: `workflow/stages/02_build/output/logs/T813-red.log`
- Result: `Test Files 3 failed (3) | Tests 18 failed | 51 passed (69)` in 10.33s.
- Failures: Exactly 18 tests failed for expected reasons (`setTransactionsDeleted` not exposed on hook; `SelectCheckbox` and `TxBulkBar` missing; table missing checkbox column, header `#tx-select-all`, and row checkboxes; selection mode elements missing; bulk delete dialog missing).

### Gate 1: `npm run lint`
- Command: `npm run lint`
- Result: Passed (exit 0)
  - `check:node-globals`: 139 files in `src`, no Node globals.
  - `check:safe-ids`: 139 files in `src`, no id from the time alone.
  - `tsc --noEmit`: 0 errors.
  - `tsc -p api/tsconfig.json`: 0 errors.

### Gate 2: Targeted Vitest Files
- Command: `npx vitest run unit/transactions-page.test.tsx unit/transactions-bulk.test.tsx unit/use-transactions.test.tsx unit/dom-id-convention.test.ts unit/tx-row.test.tsx unit/tx-calendar.test.tsx unit/theme-tokens.test.ts`
- Result: Passed (`7 passed (7)`, `108 passed (108)`, 7.26s).

### Gate 3: Full Unit Test Suite
- Command: `npm run test:unit`
- Log: `workflow/stages/02_build/output/logs/T813-unit.log`
- Result: Passed (`72 passed (72)`, `1597 passed (1597)`, 56.39s).

### Gate 4: Port Check
- Command: `netstat -ano | findstr "LISTENING" | findstr ":3000 :3100"`
- Result: Passed (exit 1, zero listening processes on ports 3000 or 3100).

### Gate 5: Affected Playwright Specs on Chromium
- Command: `npx playwright test tests/account-and-mobile-nav.spec.ts tests/auth.spec.ts tests/csv-classify.spec.ts tests/csv.spec.ts tests/dashboard.spec.ts tests/date-boundary.spec.ts tests/diary-page.spec.ts tests/diary.spec.ts tests/express-input.spec.ts tests/ios-field-zoom.spec.ts tests/jev-classify.spec.ts tests/layout-stability.spec.ts tests/presets.spec.ts tests/reduced-motion.spec.ts tests/routing.spec.ts tests/safe-area.spec.ts tests/smart-rules.spec.ts tests/soft-delete.spec.ts tests/storage-persistence.spec.ts tests/tab-preload.spec.ts tests/theme.spec.ts tests/toast-layering.spec.ts tests/transaction-edit.spec.ts tests/transaction.spec.ts tests/voice-input.spec.ts tests/wallet-forms.spec.ts --project=chromium`
- Log: `workflow/stages/02_build/output/logs/T813-e2e-chromium.log`
- Result: Passed (`145 passed (1.2m)`).

### Gate 6: Affected Playwright Specs on All 3 Browsers
- Command: `npx playwright test tests/account-and-mobile-nav.spec.ts tests/auth.spec.ts tests/csv-classify.spec.ts tests/csv.spec.ts tests/dashboard.spec.ts tests/date-boundary.spec.ts tests/diary-page.spec.ts tests/diary.spec.ts tests/express-input.spec.ts tests/ios-field-zoom.spec.ts tests/jev-classify.spec.ts tests/layout-stability.spec.ts tests/presets.spec.ts tests/reduced-motion.spec.ts tests/routing.spec.ts tests/safe-area.spec.ts tests/smart-rules.spec.ts tests/soft-delete.spec.ts tests/storage-persistence.spec.ts tests/tab-preload.spec.ts tests/theme.spec.ts tests/toast-layering.spec.ts tests/transaction-edit.spec.ts tests/transaction.spec.ts tests/voice-input.spec.ts tests/wallet-forms.spec.ts`
- Log: `workflow/stages/02_build/output/logs/T813-e2e-all.log`
- Result: Passed (`429 passed, 6 skipped (7.4m)` across Chromium, Firefox, WebKit).

### Additional Verification Checks (Section 10)
- **Text landed check:** Confirmed dialog copy ("Delete 1 transaction?", "Delete N transactions?", "It leaves your lists and totals and reverses its effect on the wallet. You can restore it from Show deleted.", "They leave your lists and totals and reverse their effect on your wallets and debts. You can restore them from Show deleted.") and net captions ("Transfers, repayments, adjustments and deleted rows are not counted", "Deleted rows are not in your totals") landed accurately in `src/`.
- **Decision 14 IDs check:** Verified all 10 ID stems present: `#tx-select-all`, `#tx-select-row-*`, `#tx-select-mode-btn`, `#tx-bulk-bar`, `#tx-bulk-count`, `#tx-bulk-net`, `#tx-bulk-error`, `#tx-bulk-delete-btn`, `#tx-bulk-restore-btn`, `#tx-bulk-clear-btn`.
- **Visual check:** Dev server launched (`npm run dev`) and stopped; responsive layouts verified at 1280px (wide table with checkbox column and inline bulk bar), 1024px, and 390px (narrow list with Select button and pinned bulk bar), in both light and dark mode.
- **CRLF line endings:** All touched and created files verified to have CRLF (`\r\n`) line endings.
- **Em-dash check:** `0` em dashes (`\u2014`) found across all touched and created files.
- **Owner file hashes:** `git hash-object docs/audit/decisions/0109-transactions-table-and-calendar-views.md docs/design/transactions-2026-10/spec.md` verified unchanged (`4b233a30...`, `2711cad4...`).
- **Scope check:** `git status --porcelain` verified to touch only the spec's target files, `docs/audit/task-ledger.md`, and build stage output.

## Fix round 1

Addressed the single blocking item from round 1 review (`workflow/stages/03_review/output/task-T813-review.md`):

### 1. Blocking Item Fix
- **Issue:** In `src/views/TransactionsView.tsx`, the bulk Delete confirmation dialog copy (`title` and `description`) computed live row count from `liveIds.length`. When a bulk delete succeeded, `FinanceContext` updated state immediately, causing `TransactionsView` to re-render with `shownRows` pruned of deleted transactions and `selectedIds` reset before `ConfirmDialog` completed its exit animation (or closed), flashing "Delete 0 transactions?".
- **Fix:** Added `bulkDeleteCount` state in `TransactionsView.tsx`. When `handleOpenBulkDelete` is invoked, `bulkDeleteCount` is frozen to `liveIds.length`. The dialog's title and description derive strictly from `bulkDeleteCount`, decoupling dialog copy from selection pruning while `setTransactionsDeleted` proceeds with `liveIds`.
- **Red test:** Added test `wide: bulk Delete dialog freezes count so it never reads "Delete 0 transactions?"` in `unit/transactions-page.test.tsx`.
  - Ran against unfixed code: failed with `AssertionError: expected <div ...> to be null` (dialog with title "Delete 0 transactions?" was present).
  - Ran against fixed code: passed cleanly.

### 2. Polish Items Addressed
- **Table header checkbox centering (`src/components/transaction/TransactionsTable.tsx`):** Added `px-0` to the header checkbox cell (`className={`${HEADER_CELL_CLASS} w-11 p-0 px-0 text-center`}`) to neutralize `HEADER_CELL_CLASS`'s `px-4` in Tailwind CSS v4, aligning header checkbox centering with body row checkboxes.
- **Contract docs (`docs/audit/test-selector-contract.md`):** Stated self-contained focus rules for row-menu delete and bulk delete/restore directly in the contract, eliminating the external reference to decision 9's table.
- **Focus comment & activeIds cleanup (`src/views/TransactionsView.tsx`):** Added explanatory comment on the no-dependency-array `useEffect` for focus landing, removed duplicate `isWide` computation, and unified `allSelected` and `someSelected` to evaluate `activeIds`.

### 3. Verification Gates (Fix round 1)
- **Red test verification:**
  - `npx vitest run unit/transactions-page.test.tsx -t "freezes count"`: Failed before fix (1 failed), passed after fix (1 passed).
- **Targeted Vitest:**
  - `npx vitest run unit/transactions-page.test.tsx unit/transactions-bulk.test.tsx unit/use-transactions.test.tsx`: 3 passed (3), 70 passed (70), 6.81s.
- **Lint:**
  - `npm run lint`: Passed (exit 0; check:node-globals clean, check:safe-ids clean, tsc clean, tsc api clean).
- **Full Unit Test Suite:**
  - `npm run test:unit > workflow/stages/02_build/output/logs/T813-unit.log 2>&1`: 72 passed (72), 1598 passed (1598), 55.69s.
- **Port Check:**
  - `netstat -ano | findstr "LISTENING" | findstr ":3000 :3100"`: Clean (exit 1).
- **Playwright Chromium (26 specs):**
  - `npx playwright test <26 specs> --project=chromium > workflow/stages/02_build/output/logs/T813-e2e-chromium.log 2>&1`: 145 passed (1.2m).
- **Playwright All 3 Browsers (26 specs):**
  - `npx playwright test <26 specs> > workflow/stages/02_build/output/logs/T813-e2e-all.log 2>&1`: 429 passed, 6 skipped (7.9m).
- **Line endings:**
  - All modified files (`TransactionsView.tsx`, `TransactionsTable.tsx`, `unit/transactions-page.test.tsx`, `docs/audit/test-selector-contract.md`, `docs/audit/task-ledger.md`, and report) verified with `bareLf: 0` and pure `\r\n`.
- **Em dashes:**
  - 0 em dashes in git diff and 0 em dashes in all touched files and reports.
- **Owner file hashes:**
  - `4b233a3025b6b3a725867f88475aa5b3ed81dd5a` (`0109-transactions-table-and-calendar-views.md`)
  - `2711cad4aeefe0fb084b27583c1e9245db29704d` (`spec.md`)
- **Scope check:**
  - `git status --porcelain` matches expected files.

