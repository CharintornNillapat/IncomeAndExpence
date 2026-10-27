# Spec: T815

## Owner summary (read before `build T815`)

The orchestrator pauses here because `AGENTS.md` is a target. The task is docs only. In `AGENTS.md`, exactly one line changes, line 11:

- now: `- **Tests:** Vitest in \`unit/\` (1510 tests, 69 files, PGlite replays every migration); Playwright in \`tests/\` (187 tests, 36 specs, 561 runs on three browsers).`
- after: `- **Tests:** Vitest in \`unit/\` (1598 tests, 72 files, PGlite replays every migration); Playwright in \`tests/\` (213 tests, 37 specs, 639 runs on three browsers).`

Nothing else in `AGENTS.md` changes. The builder measures the four numbers first (section 7, gates 1 and 2). If any of them differs from this line, it stops and reports the difference instead of editing. The other files are `README.md` (the same counts), `docs/contexts/ui-and-e2e.md` (the Playwright count line), ADR 0109 (Status, Implementation, Verification, Release), and the three audit files. Production touch points: none for the task. The owner's live apply of the T812 migration before the merge is recorded in the docs, not done here.

---

Phase 149, branch `phase-149-transactions-views`, cut from `main` at `27a6e5f` (`git merge-base main HEAD`). This task ships the phase. T815 is free: no ledger row and no `task-T815-*` stage file exists (`git grep T815` empty). No new ADR. Format model: the Phase 148 closing task T808 (`ef434cd`, `workflow/stages/01_spec/output/task-T808-spec.md`) and the Phase 144 one, T800 (`237684e`), which also ran the full Playwright suite.

## 1. Goal

Close Phase 149 (the Transactions Table and Calendar views, ADR 0109) on paper. Add the refactor-log entry with Surprises and Deliberately not done, the baseline-metrics section measured on this branch, the T809 to T814 Commit cells and the T815 row, the real unit and Playwright counts in `AGENTS.md`, `README.md` and `docs/contexts/ui-and-e2e.md`, and ADR 0109's Status, Implementation and Verification. Also record the owner's pending live step: apply the T812 migration, write its history row, and run the read-only drift check. The task runs the full Playwright suite once, because no task in the phase did and the pass and skip counts in `ui-and-e2e.md` need it.

## 2. Target files

```
AGENTS.md
README.md
docs/contexts/ui-and-e2e.md
docs/audit/decisions/0109-transactions-table-and-calendar-views.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (the six Commit cells and the new T815 row; section 6a step 7).

- Pause rule: `AGENTS.md` is a target, so the orchestrator pauses for the owner before `build T815`.
- No file under `src/`, `tests/`, `unit/`, `supabase/`, `api/`, `scripts/` or `.github/`, and no config file.

## 3. Context to read

none (docs only). As the shapes to copy, the builder reads the template block and the Phase 148 entry at the top of `docs/audit/refactor-log.md` (`:7-31`), the Phase 148 section of `docs/audit/baseline-metrics.md` (`:26-34`; its `Measured at` line came from the post-merge deploy record, so the new section leaves it out), and the Phase 149 section of `docs/audit/task-ledger.md` (`:141-152`).

## 4. Current behaviour

1. **Phase 149 commits** (`git log --oneline main..HEAD`, spec author): T809 `a2634f1` (2026-10-26), T810 `ec9fa58`, T811 `4e88626`, T812 `48e6750`, T813 `83d5c54`, T814 `9caee5e` (all 2026-10-27). Code diff since `27a6e5f` over `src unit tests supabase api scripts`: 35 files, +5080 / -104.
2. **Ledger** (`docs/audit/task-ledger.md`, 205 lines, CRLF):
   - `:1-5`: the header says "Leave `Commit` empty: the owner-approved deploy record fills every task's `Commit` cell once per phase, after the merge". Since Phase 146 the closing task has filled the earlier tasks' cells: T804 filled T803, T806 filled T805, T808 filled T807 (`ef434cd`). The deploy record on `main` filled only the closing task's own cell and the branch line (`27a6e5f`, the Phase 148 record: `task-ledger.md` T808 cell and `:134`, refactor-log `docs`/`merged` shas, baseline-metrics `Measured at` line). T815 follows that practice.
   - `:141` heading, `:143` branch line `Branch \`phase-149-transactions-views\`, cut from \`main\` at \`27a6e5f\`.`, rows T809 to T814 at `:147-152`, all `done`, every Commit cell empty. No T815 row.
3. **Counts** (spec author, at `9caee5e`):
   - Playwright: `npx playwright test --list` prints `Total: 639 tests in 37 files`; `--project=chromium` prints `Total: 213 tests in 37 files`; `ls tests/*.spec.ts` gives 37. Phase 148: 187 / 36 / 561. So +26 tests, +1 spec, +78 runs, all in `tests/transactions-views.spec.ts` (T814).
   - Unit: `ls unit | grep -cE "test\.tsx?$"` gives 72. The last full run in the phase was 1598 passed in 72 files (T813, ledger `:151`, review round 2). T814 changed no unit file. Phase 148: 1510 / 69. So +88 tests and +3 files (`unit/tx-view-preference.test.ts`, `unit/tx-calendar.test.tsx`, `unit/transactions-bulk.test.tsx`). Ten other unit files were extended: `selectors-ledger`, `selectors-display`, `transactions-page`, `diary-page`, `theme-tokens`, `transaction-form-category`, `authenticated-ledger`, `ledger-guards`, `migration-replay`, `use-transactions`.
   - Stale lines (`git grep` of `AGENTS.md`, `README.md`, `docs/contexts/`, `DESIGN.md`, `docs/audit/README.md`, `workflow/stages/*/CONTEXT.md`; nothing else found):
     - `AGENTS.md:11` `(1510 tests, 69 files, ...)` and `(187 tests, 36 specs, 561 runs on three browsers)`.
     - `README.md:157` `# Vitest: 1510 tests in 69 files, ...` and `README.md:158` `# Playwright: 187 tests in 36 spec files on Chromium, Firefox and WebKit (561 runs)`.
     - `docs/contexts/ui-and-e2e.md:67` `**187 tests in 36 specs on Chromium, Firefox and WebKit: 561 runs, 555 pass, 6 skip by design**`.
   - Full Playwright run in the phase: none. T810, T811 and T813 ran 26 specs. T812 ran 4 specs. T814 ran only the new spec (26 tests, 78 runs, 0 skipped). The 6 skips by design are Chromium-only layout shift and safe-area emulation, so the expected full result is 633 passed and 6 skipped.
4. **Bundle** (spec author: `rm -rf dist`, then `npm run build` exit 0 with `.env` present, gzip level 9 over `dist/assets`, at `9caee5e`; `dist/` removed afterwards):
   - Entry `index-achQGTXo.js` 198,233 B / 57,974 B gzip (Phase 148 `index-D4N64t3V.js` 194,626 / 56,981: +3,607 / +993).
   - All app JS 910,934 B / 275,852 B gzip, 39 files (Phase 148 886,331 / 269,276: +24,603 / +6,576, 0 file delta). `TransactionsView-FspLBvoz.js` is 55,405 B.
   - CSS `index-BNwLrid8.css` 54,969 B / 10,720 B gzip (Phase 148 `index-CNaxMlAk.css` 53,359 / 10,451: +1,610 / +269).
5. **ADR 0109** (`docs/audit/decisions/0109-transactions-table-and-calendar-views.md`, 80 lines, **LF**: `git ls-files --eol` gives `i/lf w/lf`, 0 CRLF; keep it LF):
   - `:3` `**Status:** Accepted. Not implemented yet; the phase that ships it records its commits here.`
   - There is no Implementation, Verification or Release section. The sections are Context `:11`, Decision `:18`, Consequences `:68`, Not done `:76`, and the file ends at `:80`.
   - `:74` `- \`DESIGN.md\`'s Transactions section is rewritten by the phase's last task, to the code as shipped.` T814 did that, not the last task (T815).
6. **The pending live step** (T812 spec section 8, `workflow/stages/01_spec/output/task-T812-spec.md:838-859`): the owner applies `supabase/migrations/20261027_phase149_set_transactions_deleted.sql` in the SQL editor before the merge, then runs the history row that `npm run migration:print-history -- <file>` prints at that moment, then runs the read-only query from `npm run schema:drift` (expect zero rows). The T812 review (`workflow/stages/03_review/output/task-T812-review.md:69`) left it unverified. Until it is applied, a signed-in bulk Delete or Restore rolls back and returns `databaseUpdateNeeded()` (`src/context/FinanceContext.tsx:2383`, caught at `:2443`). That shows `This needs the latest database update. Nothing was changed.` (`:395`). Earlier phases recorded such steps in the ADR (ADR 0090 `:54-56` "To apply it", ADR 0099 `:83` Consequences, then a Release section written after the apply) and in the refactor-log entry's Deliberately not done (the T808 entry, `refactor-log.md:29`).
7. **Open non-blocking review notes, still true in the code** (spec author, `grep`):
   - T810: `confirmDelete` (`src/components/transaction/TransactionsTable.tsx:84-95`) sets `isDeleting` true, awaits `onDelete`, then sets it false, with no `try/finally`. A rejected `onDelete` would leave the dialog busy. The hook returns a `MutationResult` and does not throw, so the guard would be defensive only.
   - T813: the header checkbox cell (`TransactionsTable.tsx:143`) adds `p-0` to `HEADER_CELL_CLASS`, which carries `px-4` (`:45-46`). In Tailwind v4 `px-*` wins, so the header box may sit off the row boxes' centre. T813's build report said `px-0` was added, and it was not. No reviewer looked at it in a browser.
   - T813: focus after a bulk action or a row-menu delete is set inside `requestAnimationFrame` (`src/views/TransactionsView.tsx:380`, `:487`; `TransactionsTable.tsx:98`), a one-frame timer, not an effect after the commit.
   - T811: the JSDoc line `/** Opens the Transactions page filtered to one day ... */` is duplicated (`src/views/DiaryView.tsx:18-19`). `dayTotals` falls back to an untyped `new Map()` (`TransactionsView.tsx:420`).
   - T810: the content inside `#tx-view-panel` was not re-indented (cosmetic).
8. **File lengths and line endings** (Node count): `AGENTS.md` 135, `README.md` 179, `ui-and-e2e.md` 79, `refactor-log.md` 161, `baseline-metrics.md` 195, `task-ledger.md` 205: all CRLF with 0 bare LF. ADR 0109 has 80 lines, LF only. 0 em dashes in all seven.
9. **Working tree at spec time:** `git status --porcelain` is empty, apart from this spec.

## 5. Parity map

none. The task names the `setTransactionsDeleted` / `set_transactions_deleted` row (T812) in prose only and does not change it.

## 6. Tests to add

none. The task is docs only and cannot alter behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 6a. Edits (exact)

Order: run gates 1 to 5 of section 7 first, because they measure the figures the edits record. Then make the edits, then run gate 6 onward. Keep CRLF in the six CRLF files and LF in ADR 0109. No em dash anywhere. Placeholders, filled from the gates:

- `<U>`: the seconds of gate 1's unit run, two decimals.
- `<P>`, `<S>`, `<M>`: gate 5's passed and skipped counts and its minutes, one decimal.

Keep `docs \`<sha>\`` and `merged \`<sha>\`` literal: the post-merge deploy record fills them.

If gate 1 does not give 72 files and 1598 passed, or gate 2 does not print `Total: 639 tests in 37 files` and `Total: 213 tests in 37 files`, stop and report the difference. Do not edit anything (the owner approved the `AGENTS.md` line with these numbers). Gate 5 rules are in section 7.

1. **`AGENTS.md:11`**: change `(1510 tests, 69 files,` to `(1598 tests, 72 files,` and `(187 tests, 36 specs, 561 runs on three browsers)` to `(213 tests, 37 specs, 639 runs on three browsers)`. Change nothing else in the file.

2. **`README.md`**:
   - `:157`: change `1510 tests in 69 files` to `1598 tests in 72 files`.
   - `:158`: change `187 tests in 36 spec files` to `213 tests in 37 spec files` and `(561 runs)` to `(639 runs)`.
   - Both lines keep their length and column alignment. Change nothing else.

3. **`docs/contexts/ui-and-e2e.md:67`**: change `**187 tests in 36 specs on Chromium, Firefox and WebKit: 561 runs, 555 pass, 6 skip by design**` to `**213 tests in 37 specs on Chromium, Firefox and WebKit: 639 runs, <P> pass, <S> skip by design**`. Keep the rest of the line. Change nothing else.

4. **ADR 0109** (LF), four edits, no other text:
   - `:3`: replace the whole line with:

     ```markdown
     **Status:** Accepted. Implemented in Phase 149 (T809 to T815): code `a2634f1` to `9caee5e`, docs `<sha>`, merged `<sha>`. The migration `20261027_phase149_set_transactions_deleted.sql` is not applied to live yet; the owner applies it before the merge (see Release).
     ```

   - `:74`: replace the whole bullet with `- \`DESIGN.md\`'s Transactions section was rewritten by T814, the phase's last code task, to the code as shipped.`
   - Insert this block before `## Consequences` (`:68`), so that one blank line separates it from the `Why:` paragraph above and from `## Consequences` below:

     ```markdown
     ## Implementation

     Phase 149, branch `phase-149-transactions-views`, cut from `main` at `27a6e5f`:

     - **T809** (`a2634f1`): `monthBounds` in `src/selectors/timeRange.ts`; `dailyTotals`, `HEAT_LEVELS`, `heatLevel` and `selectionSummary` in `src/selectors/ledger.ts` (D2, D5). This ADR and `docs/design/transactions-2026-10/spec.md` were committed with it.
     - **T810** (`ec9fa58`): the Table and Calendar switch, with the view stored per device under `pf_tx_view` (`src/utils/txViewPreference.ts`; D1, D6); `TransactionsTable` from `lg`, with day rows, five columns and a row menu, and the list under `lg` (D3); `walletLabel` in `src/selectors/display.ts`.
     - **T811** (`4e88626`): the `heat-1` to `heat-3` tokens in both themes, checked by `scripts/wcag-tokens.mjs` (D5); `TxCalendar` and `TxDayPanel` (D4); `TransactionForm`'s `initialDate`; the day panel's hand-off to the diary through `App.tsx` and `DiaryView`.
     - **T812** (`48e6750`): `set_transactions_deleted(uuid[], boolean)` in `supabase/migrations/20261027_phase149_set_transactions_deleted.sql`, with its probe `supabase/tests/20261027_phase149.probe.sql`; the guest twin `setTransactionsDeleted` in `FinanceContext.tsx`; the `AGENTS.md` parity-map row (D7).
     - **T813** (`83d5c54`): row checkboxes and select-all (`SelectCheckbox`); the bulk bar (`TxBulkBar`), inline from `lg` and pinned in Select mode under `lg`; bulk Delete (confirmed, with the count frozen when the dialog opens) and Restore, one `setTransactionsDeleted` call each (D7).
     - **T814** (`9caee5e`): `tests/transactions-views.spec.ts`, 26 tests; `DESIGN.md`'s Transactions section.
     - **T815** (docs `<sha>`): the phase's closing docs.

     ## Verification

     - **Unit:** `npm run test:unit` 72 files, 1598 passed (T815, <U> s). The phase added 88 tests: three new files (`unit/tx-view-preference.test.ts`, `unit/tx-calendar.test.tsx`, `unit/transactions-bulk.test.tsx`) and ten extended ones. Among them, `unit/ledger-guards.test.tsx` and `unit/authenticated-ledger.test.tsx` cover the guest twin and the one-call signed-in path, and `unit/migration-replay.test.ts` replays the migration in PGlite and runs the probe before and after it.
     - **Migration:** `npm run schema:drift` replays 22 migrations offline, clean (T812). The probe ran only in PGlite; nothing ran on live.
     - **Contrast:** `node scripts/wcag-tokens.mjs` passes, 18 heat pairs (T811, T814).
     - **E2E:** `tests/transactions-views.spec.ts`: 26 tests, 78 runs on three browsers; three inverse edits each turned it red first (T814). `npm test`: 213 tests in 37 specs, 639 runs, <P> passed, <S> skipped, 0 failed (T815, <M> min).

     ```

   - Append this block at the end of the file, after the last `Not done` bullet, with one blank line before `## Release` and the file ending in one `\n`:

     ```markdown
     ## Release

     Pending. Before the merge, the owner, in the Supabase SQL editor (T812 spec section 8):

     1. Apply `supabase/migrations/20261027_phase149_set_transactions_deleted.sql` from the phase branch.
     2. In the same tab, run the history row that `npm run migration:print-history -- supabase/migrations/20261027_phase149_set_transactions_deleted.sql` prints at that moment (ADR 0065).
     3. Read-only: run the query that `npm run schema:drift` prints; expect zero rows.

     Until step 1, a signed-in bulk Delete or Restore changes nothing and shows "This needs the latest database update. Nothing was changed." (`FinanceContext.tsx:395`). The post-merge deploy record replaces this section with what was applied and checked.
     ```

5. **`docs/audit/baseline-metrics.md`**: insert this block after `## Figures` and its blank line (`:24-25`), above `### Phase 148 - delta against Phase 147`.
   - If gate 3 prints a different entry name, CSS name or byte count than below, stop and report it instead of writing the block.
   - Leave out a `Measured at <sha>` line; the post-merge deploy record adds it.

   ```markdown
   ### Phase 149 - delta against Phase 148

   - **Entry chunk** `index-achQGTXo.js`: 198,233 B (+3,607 B), 57,974 B gzip (+993 B against Phase 148 `index-D4N64t3V.js`, 194,626 / 56,981): the phase changed files that load with the entry, among them `FinanceContext.tsx` (T812's `setTransactionsDeleted`) and `App.tsx` (T811's diary hand-off).
   - **All app JS**: 910,934 B (+24,603 B), 275,852 B gzip (+6,576 B against Phase 148 886,331 / 269,276, 39 files, 0 file delta): the new Table, Calendar, day panel and bulk bar add no chunk; `TransactionsView-FspLBvoz.js` is 55,405 B.
   - **CSS**: `index-BNwLrid8.css`: 54,969 B (+1,610 B), 10,720 B gzip (+269 B against Phase 148 `index-CNaxMlAk.css`, 53,359 / 10,451): T811's three heat tokens in both themes and the new views' utility classes.
   - **Vitest**: 72 files, 1598 tests (+3 files, +88 tests against Phase 148: `unit/tx-view-preference.test.ts`, `unit/tx-calendar.test.tsx` and `unit/transactions-bulk.test.tsx` new, ten files extended), 1598 passed in <U> s (`workflow/stages/02_build/output/logs/T815-unit.log`). Per-task runs: T809 1515 (87.38 s), T810 1535 (54.19 s), T811 1560 (54.39 s), T812 1580 (55.59 s), T813 1598 (55.69 s), each in `workflow/stages/02_build/output/logs/<id>-unit.log`.
   - **Playwright**: `npx playwright test --list` reports 213 tests in 37 files, 639 runs across 3 projects (+26 tests, +1 file, +78 runs against Phase 148, all in `tests/transactions-views.spec.ts`, new in T814). Full run by T815: <P> passed, <S> skipped, 0 failed across 3 projects (<M> min, `workflow/stages/02_build/output/logs/T815-e2e.log`). Before it, the phase ran targeted specs only (T810, T811 and T813: 26 specs on three browsers; T812: 4 specs; T814: the new spec).

   ```

6. **`docs/audit/refactor-log.md`**: insert this block after the `---` that follows the template (`:20`) and its blank line, above `## Phase 148 - ...` (`:22`). Follow it with a blank line, `---` and a blank line. In **Verified**, replace each `<gate cell Tnnn>` with that task's Gate result cell from `docs/audit/task-ledger.md:147-152`, copied verbatim.

   ```markdown
   ## Phase 149 - Transactions redesign, Table and Calendar views: T809-T815 (2026-10-26 to 2026-10-27, code `a2634f1` to `9caee5e`, docs `<sha>`, merged `<sha>`)

   ADR `0109`, amending ADR `0031` and extending ADR `0023` and ADR `0091`. The Transactions page gains a Table view (day rows, five columns, a row menu, row selection and a bulk Delete and Restore bar) and a Calendar view (a month grid shaded by the day's spending, a day panel, and a hand-off to the diary). Both views read one filter state, and a selection of rows is deleted or restored by one new ledger function, `set_transactions_deleted`, or not at all.

   **Changed:** T809 (`a2634f1`: ADR 0109 and `docs/design/transactions-2026-10/spec.md` committed; `src/selectors/timeRange.ts`: `monthBounds`; `src/selectors/ledger.ts`: `dailyTotals`, `HEAT_LEVELS`, `heatLevel`, `selectionSummary`; `unit/selectors-ledger.test.ts`: 5 tests; `docs/contexts/client-state.md`: one bullet; `docs/audit/task-ledger.md`: Phase 149 section). T810 (`ec9fa58`: `src/utils/txViewPreference.ts`: new, the stored view under `pf_tx_view`; `src/selectors/display.ts`: `walletLabel`; `src/components/transaction/TransactionsTable.tsx`: new, the Table from `lg` with day rows, the `sr-only` row text and the row menu; `src/components/ui/ConfirmDialog.tsx`: doc comment; `src/views/TransactionsView.tsx`: the view switch and `#tx-view-panel`; `unit/tx-view-preference.test.ts`: new; `unit/selectors-display.test.ts`, `unit/transactions-page.test.tsx`; the contract and `docs/contexts/ui-and-e2e.md`). T811 (`4e88626`: `src/index.css`: `heat-1` to `heat-3` in both themes; `scripts/wcag-tokens.mjs`: 18 heat pairs; `src/components/transaction/TxCalendar.tsx` and `TxDayPanel.tsx`: new; `src/components/TransactionForm.tsx`: `initialDate`; `src/views/TransactionsView.tsx`: the Calendar branch, the selection cleared on a view switch, the edit panel in `Modal` at every width; `src/views/DiaryView.tsx` and `src/App.tsx`: the day hand-off to the diary; `unit/tx-calendar.test.tsx`: new; `unit/theme-tokens.test.ts`, `unit/transactions-page.test.tsx`, `unit/transaction-form-category.test.tsx`, `unit/diary-page.test.tsx`; the contract, `docs/contexts/ui-and-e2e.md` and the design spec). T812 (`48e6750`: `supabase/migrations/20261027_phase149_set_transactions_deleted.sql` and `supabase/tests/20261027_phase149.probe.sql`: new; `src/utils/zodSchemas.ts`: the ids schema; `src/context/FinanceContext.tsx`: `setTransactionsDeleted`; `unit/migration-replay.test.ts`, `unit/ledger-guards.test.tsx`, `unit/authenticated-ledger.test.tsx`; `AGENTS.md`: the parity-map row; `docs/contexts/supabase-ledger.md` and `docs/contexts/client-state.md`). T813 (`83d5c54`: `src/components/transaction/SelectCheckbox.tsx` and `TxBulkBar.tsx`: new; `src/components/transaction/TransactionsTable.tsx`: the checkbox column and select-all; `src/views/TransactionsView.tsx`: the selection, phone Select mode, bulk Delete and Restore, focus after a bulk action; `src/hooks/useTransactions.ts`: exposes `setTransactionsDeleted`; `unit/transactions-bulk.test.tsx`: new; `unit/transactions-page.test.tsx`, `unit/use-transactions.test.tsx`; the contract and `docs/contexts/ui-and-e2e.md`). T814 (`9caee5e`: `tests/transactions-views.spec.ts`: new, 26 tests; `DESIGN.md`: the Transactions section, the heat token row and the contrast sentence; the contract). T815 (`AGENTS.md`, `README.md` and `docs/contexts/ui-and-e2e.md`: unit 1598 tests in 72 files, Playwright 213 tests in 37 specs, 639 runs; ADR 0109: Status, Implementation, Verification and Release, and the `DESIGN.md` Consequence; `docs/audit/baseline-metrics.md`: Phase 149 section; `docs/audit/task-ledger.md`: the T809 to T814 commits and the T815 row; this file).
   **Verified:** T809: <gate cell T809>. T810: <gate cell T810>. T811: <gate cell T811>. T812: <gate cell T812>. T813: <gate cell T813>. T814: <gate cell T814>. T815: full unit 72 files 1598 passed (<U>s); playwright list 213 tests in 37 files, 639 runs; full e2e 37 specs <P> passed <S> skipped 0 failed on 3 browsers (<M>m); clean production build index-achQGTXo.js 198,233 B / 57,974 B gzip, all app JS 910,934 B / 275,852 B gzip, 39 files, CSS index-BNwLrid8.css 54,969 B / 10,720 B gzip; CRLF kept, ADR 0109 LF; 0 em dashes in git diff. Reviews: T809 to T812 approved in round 1; T813 and T814 approved in round 2, after one fix round each.
   **Surprises:** (a) T810's Table put the category in its own cell, so `tests/csv-classify.spec.ts`, which finds a row button by its note and expects the category in it, failed on chromium; the owner chose to carry the category label in the row button's `sr-only` text, as the list row does (T810 spec Amendment 1). (b) T811's spec read the diary state in `TransactionsView`, which would break `unit/rerender-matrix.test.tsx` (the Transactions view re-renders 0 times on a diary save, ADR 0093); the builder moved it into a small `CalendarDayPanel` that mounts only in the Calendar view. (c) T813's first build computed the bulk Delete dialog's count from the live selection, so for the dialog's 200 ms exit after a successful delete it read "Delete 0 transactions?"; the fix freezes the count when the dialog opens. (d) T813's round 2 three-browser run failed once on WebKit in `tests/soft-delete.spec.ts:88` (a debt delete on the Goals page, which the phase did not touch), then passed 18 of 18 with `--repeat-each=3` and on all three browsers; treated as a flake. (e) T814's contract edit by search and replace also rewrote the `dashboard.spec.ts` line; round 2 restored it. The new spec needed a `gotoTransactions` helper (the desktop nav is hidden on phone sizes) and retrying assertions after the search box's 250 ms debounce. (f) The PowerShell `Tee-Object` logs of T809's build are UTF-16LE, which `grep` cannot read (T809 review).
   **Deliberately not done:** the live apply, still owed by the owner before the merge: in the Supabase SQL editor, apply `supabase/migrations/20261027_phase149_set_transactions_deleted.sql`, run the history row that `npm run migration:print-history` prints at that moment, then run the read-only `npm run schema:drift` query and expect zero rows (T812 spec section 8, ADR 0109 Release); until then a signed-in bulk Delete or Restore changes nothing and shows "This needs the latest database update. Nothing was changed."; the probe on live (it writes inside `BEGIN ... ROLLBACK`) and real lock contention (PGlite has one connection); `confirmDelete` in `TransactionsTable.tsx` has no `try/finally`, so a rejected `onDelete` would leave the dialog busy, which is defensive only, since the hook returns a `MutationResult` (T810 review); `px-0` on the header checkbox cell, whose `p-0` loses to `HEADER_CELL_CLASS`'s `px-4`, so the select-all box may sit off the row boxes' centre, and no one has looked in a browser (T813 review); focus after a bulk action or a row-menu delete is set in `requestAnimationFrame`, not an effect after the commit (T813 review); the duplicated JSDoc line in `DiaryView.tsx` and the untyped `new Map()` for `dayTotals` in `TransactionsView.tsx` (T811 review); the re-indent inside `#tx-view-panel` (T810 review); saved views, column sorting and keyboard shortcuts (ADR 0109 D8); bulk recategorize and move-wallet (D7); a shared calendar with the diary, swipe between months, long-press to select and a phone filter sheet (ADR 0109 Not done); archiving `task-ledger.md` (<L> lines), `refactor-log.md` (<R> lines) and `baseline-metrics.md` (<B> lines), all past the ~150-line threshold in `docs/audit/README.md`, left for a separate task.

   ---
   ```

   `<L>`, `<R>` and `<B>` are the line counts from gate 7, after all edits.

7. **`docs/audit/task-ledger.md`** (Phase 149 table only):
   - Commit cells: T809 (`:147`) `a2634f1`, T810 (`:148`) `ec9fa58`, T811 (`:149`) `4e88626`, T812 (`:150`) `48e6750`, T813 (`:151`) `83d5c54`, T814 (`:152`) `9caee5e`. Change no other cell of those rows.
   - Add row T815 right after the T814 row. Set its Status to `in-progress` when you start and `done` at the end:

     ```markdown
     | T815 | Phase 149 closing docs: refactor-log entry, baseline-metrics section, T809 to T814 Commit cells, unit 1598 / 72 files and Playwright 213 / 37 / 639 in AGENTS.md, README.md and ui-and-e2e.md, ADR 0109 Status, Implementation, Verification and Release; full Playwright run | `AGENTS.md`, `README.md`, `docs/contexts/ui-and-e2e.md`, `docs/audit/decisions/0109-transactions-table-and-calendar-views.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md` | done | | unit 72 files 1598 passed (<U>s); playwright list 213/37/639; full e2e 37 specs <P> passed <S> skipped on 3 browsers (<M>m); clean prod build (index-achQGTXo.js 198,233 B, all app JS 910,934 B 39 files, CSS 54,969 B); CRLF kept, ADR 0109 LF; 0 em dashes |
     ```

   - Leave T815's Commit cell empty. Do not edit the heading `:141`, the branch line `:143`, the header `:1-5`, any earlier phase or the Backlog.

## 7. Gates

The docs-only tier requires nothing beyond checking every stated count, path and sha. The owner's order adds the measurements, which supply the recorded figures, and one full Playwright run. Run the commands in Git Bash from the repo root (Bash `tee` writes UTF-8 logs; PowerShell 5.1 `Tee-Object` writes UTF-16):

```bash
# 1-5: before any edit
npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T815-unit.log | tail -6        # 1: expect 72 files, 1598 passed; <U>
npx playwright test --list | tail -1; npx playwright test --list --project=chromium | tail -1  # 2: expect 639 / 213 tests in 37 files
rm -rf dist && npm run build                                                                     # 3: .env present; never read or print it
node -e "const fs=require('fs'),z=require('zlib'),p='dist/assets/';let t=0,g=0,n=0;for(const f of fs.readdirSync(p)){const b=fs.readFileSync(p+f),c=z.gzipSync(b,{level:9}).length;if(f.endsWith('.js')){t+=b.length;g+=c;n++}if(/^index-.*\.(js|css)$/.test(f)||/^TransactionsView-/.test(f))console.log(f,b.length,c)}console.log('allJS',t,g,n)"; rm -rf dist
netstat -ano | grep -E ":(3000|3100) .*LISTENING"                                                # 4: expect no output (no stale dev server)
npx playwright test 2>&1 | tee workflow/stages/02_build/output/logs/T815-e2e.log | tail -8      # 5: expect 633 passed, 6 skipped; <P> <S> <M>

# 6 onward: after the edits
git grep -n -E "1510 tests|69 files|187 tests|561 runs|555 pass|36 spec|Not implemented yet|phase's last task" -- AGENTS.md README.md docs/contexts/ docs/audit/decisions/0109-transactions-table-and-calendar-views.md   # 6: expect nothing (exit 1)
for f in docs/audit/task-ledger.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md; do node -e "console.log(process.argv[1], require('fs').readFileSync(process.argv[1],'utf8').split('\n').length-1)" "$f"; done   # 7: <L> <R> <B>
node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');console.log(f,'crlf',s.split('\r\n').length-1,'bareLF',s.split('\n').length-s.split('\r\n').length)}" AGENTS.md README.md docs/contexts/ui-and-e2e.md docs/audit/decisions/0109-transactions-table-and-calendar-views.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md   # 8
git ls-files --eol AGENTS.md README.md docs/contexts/ui-and-e2e.md docs/audit/decisions/0109-transactions-table-and-calendar-views.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md   # 9
for t in T809 T810 T811 T812 T813 T814; do git log --format="%h $t" -1 --grep="($t)"; done   # 10
grep -c "<gate cell" docs/audit/refactor-log.md; grep -n -E "<U>|<P>|<S>|<M>|<L>|<R>|<B>" AGENTS.md README.md docs/contexts/ui-and-e2e.md docs/audit/decisions/0109-transactions-table-and-calendar-views.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md   # 11: expect 0, then nothing
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"   # 12
node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" workflow/stages/01_spec/output/task-T815-spec.md workflow/stages/02_build/output/task-T815-build.md   # 13
git diff --stat; git status --porcelain   # 14
```

Expect:
- Gate 1: 72 files, 1598 passed, 0 failed. Gate 2: `Total: 639 tests in 37 files` and `Total: 213 tests in 37 files`. Any difference: stop and report (section 6a).
- Gate 3: `index-achQGTXo.js 198233 57974`, `index-BNwLrid8.css 54969 10720`, `TransactionsView-FspLBvoz.js 55405 ...`, `allJS 910934 275852 39`. Any difference: report it, and do not write the metrics block.
- Gate 5: 633 passed, 6 skipped, 0 failed. If a test fails, rerun only that spec on that project with `--repeat-each=3`, and save the output to `workflow/stages/02_build/output/logs/T815-e2e-rerun.log`.
  - If every rerun passes: write `<P>` and `<S>` as the full run's passed and skipped counts plus the flaky test's runs counted as passed (633 and 6 when it is one flake). Add to the T815 part of **Verified**: `; one failure in the full run (<project> <file>:<line>), then <n> passed with --repeat-each=3`. Add the same fact to Surprises as item (g).
  - If a rerun fails: stop with the failure, edit nothing, and report it. Do not touch `src/` or `tests/`.
- Gate 6: no output. Gate 7: 206, about 172 and about 203. Gate 8: the six CRLF files `bareLF 0`; ADR 0109 `crlf 0`. Gate 9: `w/crlf` for the six, `w/lf` for ADR 0109. Gate 10: `a2634f1`, `ec9fa58`, `4e88626`, `48e6750`, `83d5c54`, `9caee5e`. Gate 11: `0`, then no output. Gates 12 and 13: `0`.
- Gate 14: `git diff --stat` lists `AGENTS.md` (1 line), `README.md` (2), `docs/contexts/ui-and-e2e.md` (1), ADR 0109, and the three audit files. `git status --porcelain` lists only those seven and `workflow/stages/*/output/` files. No code, test, config or SQL file.

## 8. Production touch points

none for the task. No SQL, no `/api/*` request, no MCP write, no deploy, no sign-in. The build reads `.env` without printing it.

- **The owner's live step, recorded and not done:** the T812 migration is applied by the owner in the Supabase SQL editor before the merge. That means the file, then its printed history row, then the read-only drift query (T812 spec section 8). T815 records it in ADR 0109's Release section and in the refactor-log entry.
- **T815's own hash, as in earlier phases:** T815's Commit cell stays empty, and `docs \`<sha>\`` and `merged \`<sha>\`` stay literal in the refactor-log heading and ADR 0109's Status and Implementation. After the merge, the owner's post-merge deploy record does the rest. That is a docs-only `[skip ci]` commit on `main`, made or approved by the owner, as `27a6e5f` did for Phase 148. It:
  - fills those shas and T815's Commit cell;
  - rewrites the ledger branch line `:143` with the commit count, the merge commit, the PR and the migration;
  - adds the `Measured at` line in `baseline-metrics.md`;
  - replaces ADR 0109's Release section with what was applied and checked.

## 9. Out of scope

- Any code, test, config, script or SQL file. Do not fix the review notes of section 4 item 7 here; they are listed under Deliberately not done.
- `.claude/agents/`, the `workflow/stages/*/CONTEXT.md` files, `DESIGN.md`, `docs/audit/test-selector-contract.md`, `docs/design/transactions-2026-10/spec.md`, `docs/contexts/client-state.md` and `docs/contexts/supabase-ledger.md`.
- `AGENTS.md` beyond line 11; `README.md` beyond lines 157 and 158; `docs/contexts/ui-and-e2e.md` beyond line 67.
- Any text of ADR 0109 except the four edits of 6a step 4. Converting ADR 0109 to CRLF. No new ADR, and no edit to ADRs 0023, 0031 or 0091.
- In the ledger: the T809 to T814 Task, Files, Status and Gate result cells; the Phase 149 heading and branch line; the header; earlier phases; every Backlog row.
- Historical counts in earlier `refactor-log.md` and `baseline-metrics.md` entries, ADRs and stage outputs.
- Archiving any `docs/audit/` file; any request to production `/api/*`; any live Supabase SQL, `npm run schema:drift -- --live` or a `schema-drift` workflow dispatch; `git commit` or `git push`.
