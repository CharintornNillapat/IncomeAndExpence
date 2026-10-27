# Review: T810

## Round 1

### 1. Metadata

- Task: T810, Phase 149 task 2 (view switch, remembered view, Table view from `lg`, row menu, contract ids; ADR 0109)
- Date: 2026-10-27
- Round: 1 (spec with Amendment 1; build report with "Fix round 1 (Amendment 1)")
- Verdict: APPROVED
- Branch: `phase-149-transactions-views`, HEAD `a2634f1` (T809)
- Target files: `src/utils/txViewPreference.ts` (new), `src/selectors/display.ts`, `src/components/transaction/TransactionsTable.tsx` (new), `src/components/ui/ConfirmDialog.tsx` (comment only), `src/views/TransactionsView.tsx`, `unit/tx-view-preference.test.ts` (new), `unit/selectors-display.test.ts`, `unit/transactions-page.test.tsx`, `docs/audit/test-selector-contract.md`, `docs/contexts/ui-and-e2e.md`; bookkeeping `docs/audit/task-ledger.md`
- `git check-ignore -v` on all ten targets: none ignored (exit 1).

### 2. Summary

`TransactionsView` gains a Table/Calendar tablist (`SegmentedControl mode="tabs"`) whose choice is stored per device under `pf_tx_view` (hand-offs force the Table without writing), and a `#tx-view-panel` tabpanel; the Calendar panel is empty until T811. From `lg` the list card's body is the new `TransactionsTable` (a real `<table>`: day `rowgroup` headers with L11 nets, Note button holding the `sr-only` title/category/amount/ISO date, Category chip, `walletLabel` cell, `aria-hidden` amount, and an `OverflowMenu` with Edit/Delete or Restore, Delete confirmed through `ConfirmDialog`); under `lg` the list is unchanged. `walletLabel` is a new pure selector sharing a `walletName` helper with `secondaryLine`.

### 3. Invariants and parity

- Ledger arithmetic parity row: not touched. Menu Delete/Restore call the view's existing `deleteTransaction` / `restoreTransaction` from `useTransactions` (the same functions the panel uses). No context, RPC or SQL change.
- Transfer preview / debt payoff, proxy, starter set, identity colours, CSP, types/backup schemas, Playwright version rows: not touched.
- Spec-asserted DOM ids row: `tx-row-*` stays on the row button in both layouts; new ids (`tx-view-table`, `tx-view-calendar`, `tx-view-panel`, `tx-menu-btn-*`, `tx-menu-edit-btn-*`, `tx-menu-delete-btn-*`, `tx-menu-restore-btn-*`) are listed in `docs/audit/test-selector-contract.md` and each exists in `src` (`git grep --untracked`: all seven, `TX_VIEW_KEY` x3, `pf_tx_view` x1). `dom-id-convention` passes (full unit run).
- Amendment 1: the `sr-only` template is exactly `${title !== noteText ? `, ${title}` : ''}${categoryText}, ${amountText}, ${isoDate}` with `categoryText` guarded by `chipLabel !== noteText && chipLabel !== title`, reusing the one `chipLabel` const (`TransactionsTable.tsx:152-154,192`). `csv-classify.spec.ts` rows now pass on chromium.
- Money and dates: amounts via `formatCurrencyAmount` / `Money` / `TxAmount`; day label via `formatDayLabel`, date via `formatShortDate` on the ISO day slice; no `toISOString`. No inline money filter: day nets come from the view's `groupByDay` (`dayNets`), as the list uses.
- `secondaryLine` output unchanged (its existing tests pass; diff is only the two call sites).
- One render path per breakpoint: `isWide ? <TransactionsTable> : <list>` chosen in JS; narrow guard test confirms no `<table>` and no menu triggers below `lg`.
- Chip colour copy matches `TransactionRow.tsx:58-60` with a comment naming it.
- `TX_VIEW_KEY` is not in `LEDGER_STORAGE_KEYS`, so sign-out leaves it (matches the `pf_insights_collapsed` pattern); reads and writes are try/catch.
- `ConfirmDialog.tsx`: diff is the doc comment only (3 lines in, 3 out).
- `display.ts` diff: only `walletName`, `walletLabel` and `secondaryLine`'s call sites.
- Line endings: all eight modified tracked targets `w/crlf`; the three new files crlf with 0 bare LF (rechecked after the stash pop).
- Em dashes: 0 in added lines of `git diff -U0 HEAD`, 0 in every touched file and the build report.
- Scope: `git status --porcelain` lists only the ten targets, the ledger, the spec and the build report. `git diff --stat`: 8 tracked files, 354+/13-. No unannounced file.

### 4. Gates run

| Command | Result | Log |
|---|---|---|
| `npm run lint` | exit 0 (node-globals 135 files, safe-ids 135 files, both `tsc` clean) | console |
| `npx vitest run unit/tx-view-preference.test.ts unit/selectors-display.test.ts unit/transactions-page.test.tsx unit/dom-id-convention.test.ts` | 4 files passed, 68 tests passed, 0 failed, 0 skipped | console |
| `npm run test:unit` | 70 files passed, 1535 tests passed, 0 failed, 0 skipped (53.51s) | `workflow/stages/03_review/output/logs/T810-unit.log` |
| Red run (stash of `src/selectors/display.ts`, `src/views/TransactionsView.tsx`, `src/utils/txViewPreference.ts`, `src/components/transaction/TransactionsTable.tsx`): `npx vitest run unit/selectors-display.test.ts unit/tx-view-preference.test.ts unit/transactions-page.test.tsx` | 3 files failed; 15 failed, 47 passed (62): the `walletLabel` test, the `tx-view-preference` file (import error), 5 view-switch tests, 9 Table tests; the narrow guard and all pre-existing tests passed. Pop restored `git status --porcelain` identical to before. | `workflow/stages/03_review/output/logs/T810-red.log` |
| Ports 3000/3100 | no listener before Playwright | console |
| `npx playwright test <23 specs> --project=chromium` | 139 passed, 0 failed, 0 skipped (1.2m) | `workflow/stages/03_review/output/logs/T810-e2e-chromium.log` |
| `npx playwright test <23 specs>` (all three browsers) | 415 passed, 2 skipped (pre-marked by design), 0 failed, 0 flaky, 417 total (6.4m) | `workflow/stages/03_review/output/logs/T810-e2e-all.log` |

### 5. Not verified

- The Amendment 1 red run against the on-disk `TransactionsTable.tsx` (replace `${categoryText}` with `''`): not reproduced. That is a temporary edit to a source file, which the review stage file does not allow (only the stash or a temporary test edit for a test-only task). Evidence instead: the stash red run above fails the Lunch test (whole table absent), and the builder's `workflow/stages/02_build/output/logs/T810-red-amend1.log` shows exactly 1 failed / 38 passed with `expected 'Lunch, −฿100.00, 2026-10-27' to contain 'Food & Dining'` at `unit/transactions-page.test.tsx:576`. The `chipLabel !== title` guard is pinned by the no-note test's count of 1 (read, not mutated).
- `ConfirmDialog.tsx` (comment-only) and the docs were not stashed; no new test depends on them beyond the existing dialog ids.
- Visual appearance (sticky blurred header, selected-row edge, 70vh scroll box) was not checked in a browser screenshot; out of the gates.

### 6. Blocking

None.

### 7. Non-blocking

- `src/components/transaction/TransactionsTable.tsx:73-84`: `confirmDelete` has no `try/finally`, so a rejected `onDelete` would leave `isDeleting` true. The panel's `run` helper (`EditTransactionPanel.tsx:186-197`) uses `try/finally`. The hook returns a `MutationResult` rather than throwing, so this is defensive only.
- `src/views/TransactionsView.tsx:504-530`: the content inside the new `#tx-view-panel` div was not re-indented and has a stray blank line before `</div>`; cosmetic.
- `unit/transactions-page.test.tsx` ("mounts on Table when localStorage.getItem throws"): the `mockImplementation` body is squeezed onto the opening line; cosmetic.
- After a confirmed menu Delete the focused trigger is removed with its row, so focus falls to `body`. The panel's Delete has the same outcome today; worth handling with the bulk bar (design task 5) or task 6.
- In the Calendar view on a narrow screen a still-selected row keeps its bottom sheet (`!!selectedTx && !isWide`); harmless now, but T811 should decide whether switching views clears the selection.

### 8. Rule candidates

- None new. The contract bullet already records the lesson (a hidden-text row button makes a page-wide `getByText` on an amount or category ambiguous; scope to a row or cell).
