# Review: T813

## Round 2

### 1. Metadata

- Task: T813, Phase 149 task 5 (selection and the bulk bar, ADR 0109)
- Date: 2026-10-27
- Round: 2 (recheck after fix round 1)
- Verdict: **APPROVED**
- Target files: unchanged from Round 1 (12 files in the build report; the fix touched `src/views/TransactionsView.tsx`, `unit/transactions-page.test.tsx` and bookkeeping).

### 2. Summary

The blocking item is fixed: `TransactionsView.tsx` now keeps a `bulkDeleteCount` state, set from `liveIds.length` in `handleOpenBulkDelete`, and the bulk Delete dialog's title and singular/plural description read only that. `handleBulkDeleteConfirm` still sends the current `liveIds`. A new test covers it and it is red without the fix.

### 3. Invariants and parity

- Parity map: no row touched. `git diff HEAD --stat` over `src/context/`, `src/selectors/`, `supabase/`, `api/`, `AGENTS.md` is empty.
- Owner files: `git hash-object` ADR 0109 = `4b233a3025b6b3a725867f88475aa5b3ed81dd5a`, design spec = `2711cad4aeefe0fb084b27583c1e9245db29704d`: unchanged.
- Scope: `git status --porcelain` is the same file set as Round 1 (spec targets, ledger, spec, build and review reports). No unannounced file.
- Em dashes: 0 in every touched file and in the added diff lines (checked by byte sequence). CRLF: all changed tracked files `w/crlf`.
- Red test (`wide: bulk Delete dialog freezes count so it never reads "Delete 0 transactions?"`, `unit/transactions-page.test.tsx:1181`): I temporarily replaced `bulkDeleteCount` with `liveIds.length` on the title and description lines (959, 961) of the view, ran `npx vitest run unit/transactions-page.test.tsx -t "freezes count"`: **1 failed** at line 1196 (the dialog "Delete 0 transactions?" was present, showing "Working..."). I then restored the file from a copy by hand (no `git checkout`/`restore`/stash): `git diff -- src/views/TransactionsView.tsx` and `git status --porcelain` hashes are identical before and after, file still `w/crlf`. With the fix, the test passes. The test asserts synchronously right after the confirm click, which is when the guest context has already cleared the selection, so it does catch the flash.

### 4. Gates run

- `npm run lint`: exit 0 (node-globals 139 files, safe-ids 139 files, both `tsc` 0 errors).
- `npx vitest run unit/transactions-page.test.tsx unit/transactions-bulk.test.tsx unit/use-transactions.test.tsx`: 3 files, 70 passed, 0 failed.
- `npm run test:unit`: 72 files, 1598 passed, 0 failed, 0 skipped. Log: `workflow/stages/03_review/output/logs/T813-unit-r2.log`.
- Ports 3000/3100: no listener before Playwright.
- Playwright, the spec's 26 specs, `--project=chromium`: 145 passed (1.3m). Log: `workflow/stages/03_review/output/logs/T813-e2e-chromium-r2.log`.
- Playwright, same 26 specs, three browsers: 428 passed, 6 skipped, **1 failed**: `[webkit] soft-delete.spec.ts:88 debt: soft-delete removes it from the goals grid and survives a reload` (15 s timeout waiting for `#confirm-destructive-btn` to be stable). Log: `workflow/stages/03_review/output/logs/T813-e2e-all-r2.log`. That test deletes a debt in the Goals view, which this task does not touch. Re-run: `soft-delete.spec.ts --project=webkit --repeat-each=3` 18 passed; `soft-delete.spec.ts` on all three browsers 18 passed. It passed in Round 1 and in the builder's runs. Treated as a one-off webkit load flake (long full run), not a regression.
- `git status --porcelain` identical after the Playwright runs.

### 5. Not verified

- Real-browser look at the dialog during its exit tween, the focus landing and the visual check (as in Round 1); jsdom only.
- The one webkit failure is judged a flake from the re-runs, not from a root cause.

### 6. Blocking

None.

### 7. Non-blocking

- The build report's Fix round 1 says two polish items were done that are not in the files: (a) `px-0` on the header checkbox cell in `TransactionsTable.tsx` (the line at 143 is still `${HEADER_CELL_CLASS} w-11 p-0 text-center`, and `HEADER_CELL_CLASS` still has `px-4`); (b) the self-contained focus rule in `docs/audit/test-selector-contract.md` (line 99 still ends "focus lands as decision 9's table says"). The focus-effect comment (`TransactionsView.tsx:373`) is there. These were optional, so not blocking, but the report overstates; add `px-0` and the rule text in a later task (task 6 touches the contract file again), and report only what landed.
- Items 1 and 5 of Round 1 (rAF focus, bare red-count wording) stand as before.

### 8. Rule candidates

- Same as Round 1: a confirm dialog that shows a count freezes it at open. Two dialogs now need it only if another bulk dialog appears; hold for now.

---

## Round 1

### 1. Metadata

- Task: T813, Phase 149 task 5 (selection and the bulk bar, ADR 0109)
- Date: 2026-10-27
- Round: 1
- Verdict: **CHANGES REQUESTED**
- Target files: `src/hooks/useTransactions.ts`, `src/components/transaction/SelectCheckbox.tsx` (new), `src/components/transaction/TxBulkBar.tsx` (new), `src/components/transaction/TransactionsTable.tsx`, `src/views/TransactionsView.tsx`, `unit/transactions-bulk.test.tsx` (new), `unit/transactions-page.test.tsx`, `unit/use-transactions.test.tsx`, `docs/audit/test-selector-contract.md`, `docs/contexts/ui-and-e2e.md`, plus the ledger row.
- `git check-ignore -v` on the new files: nothing ignored.

### 2. Summary

The Table gets a checkbox column, a header select-all and an inline bulk bar; under `lg` a Select mode pins the bar above the bottom nav; both call `setTransactionsDeleted` once per action and keep the selection on failure; focus rules are implemented. Scope is clean and every gate passes. One user-visible defect: the bulk Delete dialog re-renders with "Delete 0 transactions?" while it plays its 200 ms exit tween after a successful delete.

### 3. Invariants and parity

- Parity map: no row touched (no ledger arithmetic, no context change). `git diff --stat` shows nothing under `src/context/`, `src/selectors/`, `supabase/`, `api/`, `AGENTS.md`. OK.
- Owner files: `git hash-object` of ADR 0109 = `4b233a3025b6b3a725867f88475aa5b3ed81dd5a`, design spec = `2711cad4aeefe0fb084b27583c1e9245db29704d`: same as the builder's. OK.
- One call per bulk action, never a loop (`TransactionsView.tsx` `handleBulkDeleteConfirm`, `handleBulkRestore`): OK. Delete sends `liveIds`, Restore sends all selected ids: OK.
- Failure keeps selection and the dialog (Delete) or `#tx-bulk-error` (Restore): OK (bulk tests 2 and 3).
- Render-time pruning (ADR 0056), no effect-based state reset: OK. `activeIds` empty when not wide and not in Select mode: OK.
- Single render path by width (`isWide` in JS, `TxBulkBar` placed by `placement`): OK.
- Text: dialog titles, descriptions, `Transfers, repayments, adjustments and deleted rows are not counted`, `Deleted rows are not in your totals`, `Select all loaded rows`, `Select <title>` all present as specified. Ids in decision 14 all present in `src/` and in the contract file.
- Em dashes: 0 in added lines (`git diff -U0 HEAD`) and in the four new files/build report. CRLF: every changed tracked file `w/crlf`; new files 58/89/220/85 CRLF and 0 bare LF.
- Scope (`git status --porcelain`): only spec target files, ledger, spec and build report. Matches the build report's 12 files (plus the spec file, a bookkeeping file).

### 4. Gates run

- `npm run lint`: exit 0 (node-globals 139 files, safe-ids 139 files, both `tsc` 0 errors).
- `npx vitest run` transactions-page, transactions-bulk, use-transactions, dom-id-convention, tx-row, tx-calendar, theme-tokens: 7 files, 108 passed, 0 failed.
- `npm run test:unit`: 72 files, 1597 passed, 0 failed, 0 skipped. Log: `workflow/stages/03_review/output/logs/T813-unit.log`.
- Playwright, the spec's 26 specs, `--project=chromium`: 145 passed. Log: `workflow/stages/03_review/output/logs/T813-e2e-chromium.log`.
- Playwright, same 26 specs, three browsers: 429 passed, 6 skipped, 0 failed (6.6m). Log: `workflow/stages/03_review/output/logs/T813-e2e-all.log`.
- Ports 3000/3100 had no listener before Playwright; `git status --porcelain` identical afterwards.
- Red run reproduced by stash (`git stash push -u --` the 3 changed src files and the 2 new components; all three are `w/crlf`, none `w/lf`): the three test files give **20 failed, 49 passed** (the 18 the spec expected, plus two Table tests whose cell indices the builder had to shift by one for the new column: "renders a transfer row..." and "renders the income Amount cell..."). Every new test fails without the change. `git stash pop --index`; `git status --porcelain` identical to the pre-stash record.

### 5. Not verified

- Real-browser focus landing after a bulk action or row-menu delete, and the visual check (contrast, 44px, pinned bar clearing the nav, no sideways scroll, light and dark). jsdom ignores `inert` and has no layout; no spec for these exists until task 6, and a review may not add one. The build report states the visual check was done; I did not repeat it.
- The "Delete 0 transactions?" flash below is deduced from `Modal.tsx` (controls stay mounted for the 200 ms exit tween) and the code, not observed in a browser.

### 6. Blocking

- `src/views/TransactionsView.tsx` ~`:928-963` (the bulk `ConfirmDialog`) and `handleBulkDeleteConfirm` (~`:326-340`) - the title and description are computed from `liveIds.length`, which is derived live from `selectedIds`. On success the same batch clears `selectedIds` and sets `confirmBulkDelete` false, so during the dialog's 200 ms exit tween it reads "Delete 0 transactions?" with the plural "They leave..." description. A destructive dialog flashing a wrong count after the delete succeeded is user-visible - freeze the count while the dialog is open (e.g. store the live count in state when `handleOpenBulkDelete` runs, or capture it in a `useRef`/state and use that for the title and description), and add a test that the title is still "Delete 2 transactions?" in the render after the success clears the selection (e.g. check the dialog's title text immediately after the confirm click resolves, before the tween ends; or assert the dialog never shows "Delete 0").

### 7. Non-blocking

- Focus is set inside `requestAnimationFrame` (`TransactionsView.tsx` focus effect, `TransactionsTable.tsx` `confirmDelete`). Spec decision 9 says an effect after the commit, "not in a timer". It passes in jsdom and the logic is right; a rAF is a one-frame timer. If a flaky focus ever shows, move to a layout effect keyed on the state that closes the dialog.
- The focus effect in `TransactionsView` has no dependency array, so it runs on every render (it exits at once when the ref is null). Fine, but a comment saying so would help the next reader.
- `SelectCheckbox` header cell: `HEADER_CELL_CLASS` carries `px-4` and the cell adds `p-0`; in Tailwind v4 `px-*` is emitted after `p-*`, so the header keeps its 16px side padding and the header checkbox column is wider than the row column's centre. Check at 1280px; use `px-0` if the box sits off-centre.
- `docs/audit/test-selector-contract.md` ends the new bullet with "focus lands as decision 9's table says". The contract file should not point at a task spec that is later archived; state the rule (select-all, else search; next row, else previous row, else select-all, else search).
- The build report quotes the red run as 18 failed; with the updated cell-index tests it is 20 (see Gates). Say so next time.
- `handleToggleAll` / `allSelected` use `selectedIds`, `summary` uses `activeIds`; they agree where used (wide only) but one name would be clearer.

### 8. Rule candidates

- "Text in a confirm dialog that shows a count must not be computed from live selection state; freeze it at open." Promote after the fix lands and if another dialog needs it.

### 9. Fix block

```
fix T813 (stage file: workflow/stages/02_build/CONTEXT.md)
Review: workflow/stages/03_review/output/task-T813-review.md, Round 1.
Blocking:
1. src/views/TransactionsView.tsx - the bulk Delete ConfirmDialog title and description read liveIds.length, which drops to 0 when a successful delete clears the selection, so the dialog shows "Delete 0 transactions?" for its 200 ms exit tween. Freeze the count at open (handleOpenBulkDelete) and use it for the title, the singular/plural description and nothing else; the call still sends the current liveIds. Add a unit test (transactions-bulk.test.tsx or transactions-page.test.tsx) that fails before the fix: after a successful confirm the dialog's title never reads "Delete 0 transactions?".
Rerun: npm run lint; npx vitest run unit/transactions-page.test.tsx unit/transactions-bulk.test.tsx unit/use-transactions.test.tsx; npm run test:unit; the 26 specs on chromium then all three browsers (check ports 3000 and 3100 first). Keep CRLF, no em dash. Append a "## Fix round 1" section to task-T813-build.md.
Optional (non-blocking items 1-4 in the review).
```
