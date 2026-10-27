# Build Report: T810

## Task ID
T810

## Status
BLOCKED on `tests/csv-classify.spec.ts:143-144` and `tests/csv-classify.spec.ts:187-189` in the Chromium Playwright gate (`workflow/stages/02_build/output/logs/T810-e2e-chromium.log`).

## Blocker Detail
In `tests/csv-classify.spec.ts`:
- Lines 143-144 (`a high-confidence answer fills the category and reaches the ledger`):
  ```ts
  const row = page.locator('button[id^="tx-row-"]').filter({ hasText: marker });
  await expect(row).toContainText(TRANSPORT.name);
  ```
  - Locator: `locator('button[id^="tx-row-"]').filter({ hasText: 'zzztaxi708044' })`
  - Expected substring: `"Transport & Fuel"`
  - Text met: `"zzztaxi708044, −฿210.00, 2026-10-27"`
- Lines 187-189 (`a manual override wins over both layers and survives the commit`):
  ```ts
  const row = page.locator('button[id^="tx-row-"]').filter({ hasText: marker });
  await expect(row).toContainText(GROCERIES.name);
  await expect(row).not.toContainText(TRANSPORT.name);
  ```
  - Locator: `locator('button[id^="tx-row-"]').filter({ hasText: 'zzzoverride708931' })`
  - Expected substring: `"Groceries"`
  - Text met: `"zzzoverride708931, −฿55.00, 2026-10-27"`

### Why It Fails Under Spec Section 4.4 Item 6
`task-T810-spec.md` section 4.4 item 6 specifies that in `TransactionsTable.tsx`:
- `button#tx-row-${tx.id}` lives in the **Note** `<td>`, while `<Chip label={chipLabel} color={chipColor} />` lives in the **Category** `<td>`.
- The `<span className="sr-only">` inside `button#tx-row-${tx.id}` uses the template string:
  `` `${title !== noteText ? `, ${title}` : ''}, ${amountText}, ${isoDate}` ``
  where `title = displayTitle(tx, category)` and `noteText = ownNote ? tx.description : 'No note'`.
- When a row has its own description (`marker`), `displayTitle(tx, category)` returns `tx.description` (`marker`), which equals `noteText`, so `title !== noteText` is `false` and the category label (`chipLabel`, e.g. `"Transport & Fuel"` or `"Groceries"`) is only rendered in the sibling Category `<td>`, not inside `button[id^="tx-row-"]`.

### Question for Orchestrator / Reviewer
Should `task-T810-spec.md` be amended to:
1. Include `chipLabel` (when `chipLabel && chipLabel !== noteText`) or `title` in the Note button's `<span className="sr-only">` in `src/components/transaction/TransactionsTable.tsx` (and update `docs/audit/test-selector-contract.md` accordingly), OR
2. Add `tests/csv-classify.spec.ts` to the target files for a locator-only move at lines 143 and 187 (e.g. scoping to the row `tr` that contains `button[id^="tx-row-"]`)?

## Files Changed So Far (10 target files + 1 ledger + 1 build report = 12 files)
1. `src/utils/txViewPreference.ts` (new) - exported `TX_VIEW_KEY`, `TxViewMode`, `readTxView`, and `writeTxView`.
2. `src/selectors/display.ts` - added `walletName` helper and `walletLabel`, and updated `secondaryLine` to reuse `walletName`.
3. `src/components/transaction/TransactionsTable.tsx` (new) - implemented the wide Table view per spec section 4.4.
4. `src/components/ui/ConfirmDialog.tsx` - comment-only update per spec section 4.6.
5. `src/views/TransactionsView.tsx` - added the Table/Calendar `SegmentedControl` (`mode="tabs"`), remembered view state via `readTxView` / `writeTxView` with hand-off override, `#tx-view-panel` `tabpanel` wrapper, and `isWide` rendering of `TransactionsTable` per spec section 4.5.
6. `unit/tx-view-preference.test.ts` (new) - added 4 unit tests per spec section 6.2.
7. `unit/selectors-display.test.ts` - added `walletLabel: the Transactions table's wallet cell` unit test per spec section 6.1.
8. `unit/transactions-page.test.tsx` - added `wide()` helper, `mount(rows, props)`, `the view switch (ADR 0109 D6)` (5 tests), and `the Table view, from lg (ADR 0109 D3)` (10 tests, including the narrow guard) per spec section 6.3.
9. `docs/audit/test-selector-contract.md` - added the `lg` Table view bullet under `### Transactions page` and the new `### Transactions views` section per spec section 4.7.
10. `docs/contexts/ui-and-e2e.md` - updated the `**Transactions** [0031, 0033, 0041, 0109]` bullet per spec section 4.7.
11. `docs/audit/task-ledger.md` - added row `T810` under `## Phase 149` (`in-progress`, `Commit` left empty).
12. `workflow/stages/02_build/output/task-T810-build.md` - this build report.

## Tests Added and Fail-Then-Pass Evidence

### Red Run (before creating `src/utils/txViewPreference.ts` and `src/components/transaction/TransactionsTable.tsx` and before editing `src/selectors/display.ts` and `src/views/TransactionsView.tsx`)
- Command: `npx vitest run unit/selectors-display.test.ts unit/tx-view-preference.test.ts unit/transactions-page.test.tsx`
- Log path: `workflow/stages/02_build/output/logs/T810-red.log`
- Result: `Test Files 3 failed (3)`, `Tests 15 failed | 47 passed (62)` (1 failed in `unit/selectors-display.test.ts`, 1 suite import error in `unit/tx-view-preference.test.ts`, 14 failed in `unit/transactions-page.test.tsx`, and all 47 pre-existing + narrow-guard tests passed).

### Green Run (after creating and editing the `src/` target files)
- Command: `npx vitest run unit/tx-view-preference.test.ts unit/selectors-display.test.ts unit/transactions-page.test.tsx unit/dom-id-convention.test.ts`
- Result: `Test Files 4 passed (4)`, `Tests 68 passed (68)` (4.23s).

## Gate Commands Run So Far
1. **Lint (`npm run lint`)**: exit 0 (`node-globals: 135 files in src, no Node globals.`, `safe-ids: 135 files in src, no id from the time alone.`, `tsc --noEmit` clean, `tsc -p api/tsconfig.json` clean).
2. **Targeted unit tests (`npx vitest run unit/tx-view-preference.test.ts unit/selectors-display.test.ts unit/transactions-page.test.tsx unit/dom-id-convention.test.ts`)**: `Test Files 4 passed (4)`, `Tests 68 passed (68)` (4.23s).
3. **Full unit suite (`npm run test:unit`)**: `Test Files 70 passed (70)`, `Tests 1535 passed (1535)` (54.11s). Log saved to `workflow/stages/02_build/output/logs/T810-unit.log`.
4. **Playwright Chromium (`npx playwright test <23 specs> --project=chromium`)**: `137 passed`, `2 failed` (`tests/csv-classify.spec.ts:115` at line 144 and `tests/csv-classify.spec.ts:169` at line 188). Log saved to `workflow/stages/02_build/output/logs/T810-e2e-chromium.log`. Stopped here per spec section 7 to report the locator mismatch to the orchestrator.

## Fix round 1 (Amendment 1)

### Summary of Amendment 1 Edits
Per Amendment 1 in `workflow/stages/01_spec/output/task-T810-spec.md` (owner chose option 1: include the category label in the Note button's `sr-only` text when it differs from both `noteText` and `title`):
1. `unit/transactions-page.test.tsx`:
   - In `populates a row button with the note, signed amount and ISO date, and shows the wallet and category cells` (`:562-581`), added `expect(btn.textContent).toContain(categoryName);` after the ISO date assertion.
   - In `shows No note for an empty description and keeps the category title in the button text` (`:601-611`), added `expect(btn.textContent!.split(categoryName).length - 1).toBe(1);` to pin the `chipLabel !== title` guard.
2. `src/components/transaction/TransactionsTable.tsx`:
   - Computed `categoryText = chipLabel && chipLabel !== noteText && chipLabel !== title ? `, ${chipLabel}` : ''` next to `title` and `noteText` (reusing `chipLabel = categoryLabel(tx, category)` without calling `categoryLabel` twice).
   - Updated the Note button's `<span className="sr-only">` template string to `` `${title !== noteText ? `, ${title}` : ''}${categoryText}, ${amountText}, ${isoDate}` ``.
3. `docs/audit/test-selector-contract.md`:
   - Replaced the `### Transactions page` Table view bullet with the Amendment 1 wording (section 4.7 (a)).
4. `docs/audit/task-ledger.md`:
   - Updated row `T810` `Status` to `done` and filled `Gate result` (`Commit` left empty).

### Amendment 1 Red Run (before editing `src/components/transaction/TransactionsTable.tsx`)
- Command: `npx vitest run unit/transactions-page.test.tsx`
- Log path: `workflow/stages/02_build/output/logs/T810-red-amend1.log`
- Result: `Test Files 1 failed (1)`, `Tests 1 failed | 38 passed (39)`
- Quoted failure from `workflow/stages/02_build/output/logs/T810-red-amend1.log`:
```text
 FAIL  unit/transactions-page.test.tsx > the Table view, from lg (ADR 0109 D3) > populates a row button with the note, signed amount and ISO date, and shows the wallet and category cells
AssertionError: expected 'Lunch, −฿100.00, 2026-10-27' to contain 'Food & Dining'
Expected: "Food & Dining"
Received: "Lunch, −฿100.00, 2026-10-27"
 ❯ unit/transactions-page.test.tsx:576:29
```

### Full Section 7 Gate Results (after Amendment 1)
1. **Lint (`npm run lint`)**:
   - Result: exit 0 (`node-globals: 135 files in src, no Node globals.`, `safe-ids: 135 files in src, no id from the time alone.`, `tsc --noEmit` clean, `tsc -p api/tsconfig.json` clean).
2. **Targeted unit tests (`npx vitest run unit/tx-view-preference.test.ts unit/selectors-display.test.ts unit/transactions-page.test.tsx unit/dom-id-convention.test.ts`)**:
   - Result: `Test Files 4 passed (4)`, `Tests 68 passed (68)` (4.21s).
3. **Full unit suite (`npm run test:unit`)**:
   - Log path: `workflow/stages/02_build/output/logs/T810-unit.log`
   - Result: `Test Files 70 passed (70)`, `Tests 1535 passed (1535)` (54.19s).
4. **Playwright 23 specs on Chromium (`npx playwright test <23 specs> --project=chromium`)**:
   - Log path: `workflow/stages/02_build/output/logs/T810-e2e-chromium.log`
   - Result: `139 passed (1.2m)`.
5. **Playwright 23 specs across all 3 browsers (`npx playwright test <23 specs>`)**:
   - Log path: `workflow/stages/02_build/output/logs/T810-e2e-all.log`
   - Result: `415 passed`, `2 skipped` (7.4m).
6. **Docs & ID verification (`git grep --untracked -nE "tx-view-table|tx-view-calendar|tx-view-panel|tx-menu-btn-|tx-menu-edit-btn-|tx-menu-delete-btn-|tx-menu-restore-btn-|TX_VIEW_KEY|pf_tx_view" src`)**:
   - Result: all 7 DOM IDs (`tx-view-table`, `tx-view-calendar`, `tx-view-panel`, `tx-menu-btn-`, `tx-menu-edit-btn-`, `tx-menu-delete-btn-`, `tx-menu-restore-btn-`), `TX_VIEW_KEY`, and `pf_tx_view` verified in `src/`.
7. **Text landed checks**:
   - `git diff src/selectors/display.ts`: shows only `walletName`, `walletLabel`, and `secondaryLine`'s two call sites.
   - `git diff src/components/ui/ConfirmDialog.tsx`: shows comment lines only.
8. **Line endings**:
   - `git ls-files --eol`: `w/crlf` on all 8 modified tracked files (`docs/audit/task-ledger.md`, `docs/audit/test-selector-contract.md`, `docs/contexts/ui-and-e2e.md`, `src/components/ui/ConfirmDialog.tsx`, `src/selectors/display.ts`, `src/views/TransactionsView.tsx`, `unit/selectors-display.test.ts`, `unit/transactions-page.test.tsx`).
   - New files (`src/utils/txViewPreference.ts`, `src/components/transaction/TransactionsTable.tsx`, `unit/tx-view-preference.test.ts`): `bare lf = 0` on all 3 files.
9. **Em-dash check**:
   - Added lines in `git diff -U0 HEAD`: `0`
   - New files and `workflow/stages/02_build/output/task-T810-build.md`: `0`.
10. **Scope (`git status --porcelain`)**:
    - Lists only the 10 target files from section 2, `docs/audit/task-ledger.md`, `workflow/stages/01_spec/output/task-T810-spec.md`, and `workflow/stages/02_build/output/task-T810-build.md`.

## Anything Not Done
None. Everything in `workflow/stages/01_spec/output/task-T810-spec.md` (including Amendment 1) is complete.
