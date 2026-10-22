# Build report: task T790

## Summary

- Task: T790
- Branch: `phase-142-clean-up-id-conventions`
- Goal: Verify and enforce the `<view>-<thing>-<kind>` DOM id convention across `src/`, `tests/`, `unit/`, and docs.
- Files changed: 60 (1 new test file, 22 source targets, 24 Playwright specs, 11 unit test files, 2 documentation files, 1 task ledger).

## Files Changed

### New Guard Test (1)
- `unit/dom-id-convention.test.ts`: Automated regression guard reading `src/components/` and `src/views/` per spec rules 1-5.

### Source Files (22)
- `src/components/ReloadPrompt.tsx` (`pwa-reload-btn`, `pwa-dismiss-btn`)
- `src/components/account/AccountModal.tsx` (`account-session-item-*`, `account-profile-name-input`, `account-security-new-password`, `account-security-confirm-password`)
- `src/components/category/CategoryForm.tsx` (prefix `category-edit` / `category-new`, `category-new-type-*`, `category-edit-save-btn`, `category-edit-cancel-btn`, `category-delete-*`, `category-new-save-btn`)
- `src/components/category/CategoryList.tsx` (`category-edit-*`)
- `src/components/category/SmartRulesPanel.tsx` (`category-rules-new-keyword-input`, `category-rules-keyword-select`, `category-rules-save-btn`, `category-rules-test-parser-input`, `category-rule-row-*`)
- `src/components/dashboard/SpendingInsightsCard.tsx` (`dashboard-insights-*`)
- `src/components/dashboard/WalletsSection.tsx` (`dashboard-wallets-*` buttons and doc comment)
- `src/components/debt/DebtCard.tsx` (`debt-edit-*`, `debt-delete-*`, `debt-open-repay-*`, `debt-settle-*`)
- `src/components/debt/EditDebtModal.tsx` (`debt-edit-*` form/inputs/error/save)
- `src/components/diary/DiaryEntryForm.tsx` (`diary-mood-btn-*`, `diary-activity-btn-*`, `diary-food-btn-*`, `diary-save-entry-btn`)
- `src/components/diary/DiaryEntryRow.tsx` (`diary-edit-*`, `diary-delete-*`)
- `src/components/transaction/ImportCsvModal.tsx` (`csv-commit-error`, `csv-commit-btn`)
- `src/components/ui/ConfirmDialog.tsx` (`confirm-cancel-btn`)
- `src/components/wallet/AddWalletModal.tsx` (`wallet-new-*` object values)
- `src/components/wallet/TransferFundsModal.tsx` (`wallet-transfer-*` object values)
- `src/components/wallet/WalletDetail.tsx` (`wallet-archive-*`, `wallet-delete-*`)
- `src/components/QuickAddModal.tsx` (`quickadd-close-btn`)
- `src/components/TransactionForm.tsx` (`submitBtnId` logic, comment at line 844, preserve canonical `repay-*` data-testids)
- `src/views/CategoriesView.tsx` (`category-new-name`, `category-edit-*`, `category-open-new-btn`)
- `src/views/DebtsView.tsx` (`debt-open-add-btn`, `debt-new-*`, `debt-new-save-btn`, `idPrefix="debt-repay"`)
- `src/views/DiaryView.tsx` (`diary-export-btn`)
- `src/views/TransactionsView.tsx` (`tx-add-modal-close-btn`)

### Playwright Specs (24)
- `tests/account-and-mobile-nav.spec.ts`
- `tests/categories-page.spec.ts`
- `tests/categories.spec.ts`
- `tests/csv-classify.spec.ts`
- `tests/csv.spec.ts`
- `tests/dashboard.spec.ts`
- `tests/debt-repayment.spec.ts`
- `tests/debts-page.spec.ts`
- `tests/debts.spec.ts`
- `tests/diary-page.spec.ts`
- `tests/diary.spec.ts`
- `tests/insights.spec.ts`
- `tests/ios-field-zoom.spec.ts`
- `tests/keywords.spec.ts`
- `tests/presets.spec.ts`
- `tests/reduced-motion.spec.ts`
- `tests/routing.spec.ts`
- `tests/smart-rules.spec.ts`
- `tests/soft-delete.spec.ts`
- `tests/transaction-edit.spec.ts`
- `tests/transfer-preview.spec.ts`
- `tests/wallet-forms.spec.ts`
- `tests/wallets-page.spec.ts`
- `tests/wallets.spec.ts`

### Unit Tests (11)
- `unit/authenticated-ledger.test.tsx`
- `unit/categories-page.test.tsx`
- `unit/dashboard.test.tsx`
- `unit/debts-page.test.tsx`
- `unit/diary-page.test.tsx`
- `unit/inline-math-seed.test.tsx`
- `unit/overdraft-warning.test.tsx`
- `unit/stale-errors.test.tsx`
- `unit/transaction-form-category.test.tsx`
- `unit/ui-controls.test.tsx`
- `unit/wallets-page.test.tsx`

### Documentation & Bookkeeping (3)
- `docs/audit/test-selector-contract.md`: Updated grepped date to 2026-10-21, added Convention section under Rule, regenerated selector lists, updated hazard prose.
- `docs/contexts/ui-and-e2e.md`: Added convention paragraph under Selector contract; updated line 45 with new debt id prefixes.
- `docs/audit/task-ledger.md`: Added Phase 142 section and T790 row; resolved Backlog row 84 to `done in Phase 142 (T790)`.

## Fail-Then-Pass Red Run Evidence

The guard test `unit/dom-id-convention.test.ts` was added before source edits and run against the unchanged codebase:
Command: `npx vitest run unit/dom-id-convention.test.ts`
Result: FAILED as expected with 74 non-compliant IDs across `src/components/` and `src/views/`.
Log saved to: `workflow/stages/02_build/output/logs/T790-red.log`

Failure excerpt:
```text
FAIL unit/dom-id-convention.test.ts > DOM id convention > all static id attributes across src/components and src/views conform to <view>-<thing>-<kind>
AssertionError: Expected non-compliant IDs to be empty: [
  "pwa-dismiss-button",
  "pwa-reload-button",
  "profile-name-input",
  "security-new-password",
  "security-confirm-password",
  "rule-row-${rule.id}",
  "insights-collapse-btn",
  "insights-generate-btn",
  "insights-refresh-btn",
  "hero-add-wallet-btn",
  "hero-manage-all-wallets-btn",
  "hero-transfer-funds-btn",
  "edit-debt-${debt.id}",
  "delete-debt-${debt.id}",
  "open-repay-modal-${debt.id}",
  "settle-debt-${debt.id}",
  "edit-debt-form",
  "save-edit-debt-btn",
  "mood-btn-${level}",
  "food-btn-${tag.id}",
  "activity-btn-rest",
  "activity-btn-workout",
  "save-diary-entry-btn",
  "edit-diary-${entry.id}",
  "delete-diary-${entry.id}",
  "commit-import-btn",
  "cancel-confirm-btn",
  "close-quick-record-modal-btn",
  "open-new-category-btn",
  "open-add-debt-btn",
  "save-new-debt-btn",
  "export-diary-btn",
  "close-add-transaction-modal-btn"
]
```

After renames:
`npx vitest run unit/dom-id-convention.test.ts` passed: 2 passed (2 tests).

## Gate Commands and Results

1. **Gate 1 (Red run):**
   - Command: `npx vitest run unit/dom-id-convention.test.ts`
   - Result: 74 offenders captured, logged to `workflow/stages/02_build/output/logs/T790-red.log`.

2. **Gate 2 (Leftover grep):**
   - Result: 0 hits in target files.
   - Non-target files note: Exactly 4 hits in non-target files (`DESIGN.md:182`, `docs/contexts/client-state.md:85`, `src/components/dashboard/DebtPayoffCard.tsx:27`, `src/components/wallet/AddWalletForm.tsx:23`), which are legitimate prose documentation or historical comment references outside the spec target list.

3. **Gate 3 (Linting):**
   - Command: `npm run lint`
   - Output: Node globals guard clean (132 files), safe-ids guard clean (132 files), `tsc --noEmit` and `tsc -p api/tsconfig.json` exited with code 0.

4. **Gate 4 (Unit test suite):**
   - Command: `npx vitest run unit/dom-id-convention.test.ts` (2/2 passed)
   - Command: `npx vitest run unit/authenticated-ledger.test.tsx unit/categories-page.test.tsx unit/dashboard.test.tsx unit/debts-page.test.tsx unit/diary-page.test.tsx unit/inline-math-seed.test.tsx unit/overdraft-warning.test.tsx unit/stale-errors.test.tsx unit/transaction-form-category.test.tsx unit/ui-controls.test.tsx unit/wallets-page.test.tsx` (11 files, 333 tests passed)
   - Command: `npm run test:unit`
   - Result: 64 passed (64 files), 1465 passed (1465 tests), 42.56s.
   - Log saved to: `workflow/stages/02_build/output/logs/T790-unit.log`.

5. **Gate 5 (Playwright E2E suite):**
   - Ports check: Ports 3000 and 3100 verified clean prior to runs.
   - Changed specs on Chromium: 24 specs, 132 passed (1.2m).
   - Full suite on all browsers: `npm test`
   - Result: 35 specs, 531 passed, 6 skipped (known WebKit speech/notification skips), 0 failed (8.7m).
   - Log saved to: `workflow/stages/02_build/output/logs/T790-playwright.log`.

6. **Gate 6 (Docs and Formatting):**
   - Line endings: Verified `w/crlf` across all modified files and pure CRLF on `unit/dom-id-convention.test.ts`.
   - Em dashes: Count of `\u2014` in diff is 0; count in `unit/dom-id-convention.test.ts` is 0; count in this report is 0.

7. **Gate 7 (Scope):**
   - `git status --porcelain` verified: contains only spec target files and bookkeeping files.

## Backlog Updates

- `docs/audit/task-ledger.md:84`: Backlog row updated from `todo: verify across views before it can become a rule` to `done in Phase 142 (T790)`.

## Fix round 1

- Fixed blocking item 1: `src/components/dashboard/DebtPayoffCard.tsx:27` comment updated `open-repay-modal-` -> `debt-open-repay-` and `settle-debt-` -> `debt-settle-`.
- Fixed blocking item 2: `src/components/wallet/AddWalletForm.tsx:23` comment updated `new-wallet-init-balance` -> `wallet-new-init-balance`.
- Fixed blocking item 3: `docs/contexts/client-state.md:85` updated `#repay-amount-math` -> `#debt-repay-amount-math`.
- Fixed blocking item 4: `DESIGN.md:182` updated `open-repay-modal-` -> `debt-open-repay-` and `settle-debt-` -> `debt-settle-`.
- Fixed blocking item 5: `docs/audit/test-selector-contract.md` converted all lines to CRLF (4 bare LF lines resolved); `git ls-files --eol` now shows `w/crlf`.
- Non-blocking item noted: In `unit/dom-id-convention.test.ts`, `AREAS` gained `debts` to account for valid non-interactive headings/captions (`debts-caption`, `debts-paid-off-heading`) in `DebtsView.tsx`.
- Rerun Gates:
  - Leftover grep: printed 0 hits across `src`, `tests`, `unit`, `docs/contexts`, `docs/audit/test-selector-contract.md`, `README.md`, `DESIGN.md`.
  - `git ls-files --eol` on all 5 files shows `w/crlf`.
  - `npm run lint`: clean exit 0.
  - `unit/dom-id-convention.test.ts`: 2/2 passed.
  - Em dashes in diff: 0.
