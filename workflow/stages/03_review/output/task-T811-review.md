# Review: T811

## Round 1

### 1. Metadata

- Task: T811, Phase 149 task 3 (Calendar view, heat tokens, day panel, `initialDate`, diary hand-off), ADR 0109
- Date: 2026-10-27
- Round: 1
- Verdict: APPROVED
- Target files: the 17 files of the spec's section 2 (`src/index.css`, `scripts/wcag-tokens.mjs`, `TxCalendar.tsx` (new), `TxDayPanel.tsx` (new), `TransactionForm.tsx`, `TransactionsView.tsx`, `DiaryView.tsx`, `App.tsx`, five unit files with `unit/tx-calendar.test.tsx` new, three docs, `task-ledger.md`). `git check-ignore -v` on the tracked targets printed nothing, so none is ignored.

### 2. Summary

Adds the three `heat-N` tokens in both themes with 18 contrast checks, the `TxCalendar` month grid and `TxDayPanel`, the Calendar branch in `TransactionsView` (month rows, hidden range select and day chip, selection cleared on a view switch, edit panel in `Modal` at every width, Add on the selected day through `TransactionForm initialDate`), and the Transactions-to-Diary day hand-off. Every spec decision (4.2 items 1 to 11) is implemented as written, with one justified deviation (see Invariants).

### 3. Invariants and parity

- Compaction check (every spec edit landed): tokens in `:root`, `.dark` and `@theme inline` with the frozen values; the 18 wcag checks; `initialDate` in the form; `chooseView` moved below `selectedTxId` and clears it; `calendarMonth` and its month-change reset of `dayFilter`; `sheetMode` and the title-focus guard; `addModalDate` reset on header open, `onClose`, save, and the transfer and repay shortcuts; `canGoNext` rule; day default rule; `onOpenDiaryDay` prop, `App.tsx` state and both callbacks, `DiaryView` props and consume effect; design spec renames (`tx-cal-panel`, new ids list, "Switching views clears the selected row"); contract ids and four bullets; `ui-and-e2e.md` line. All present. `grep tx-cal-day-panel` finds nothing left.
- Ids: every id the contract names exists in `src` (grep above), none start outside `tx-`; `unit/dom-id-convention.test.ts` passes.
- Parity map: "Spec-asserted DOM ids" row handled (contract updated). No ledger arithmetic, context, selector, type, `index.html` or `vercel.json` change. Figures come from `dailyTotals`, `cashFlow`, `heatLevel` (selectors), none redefined.
- Deviation from spec 4.2 item 11 (accepted): the spec computed `useDiaryState()` in `TransactionsView`; the builder put it in a small `CalendarDayPanel` wrapper rendered only in the Calendar view. This is correct: `unit/rerender-matrix.test.tsx` requires the Transactions view to re-render 0 times on a diary save (ADR 0093), which a view-level subscription would break. The unit suite passes the matrix.
- Heat classes written out in full, no raw hex in `TxCalendar.tsx` (theme-tokens test). Disabled/selected/heat/ring precedence matches 4.5 item 5. Net span is `hidden sm:block`; label carries the figures.
- Line endings: all 14 modified tracked targets `w/crlf`; the three new files and the build report have 0 bare LF. Em dashes: 0 in added lines, 0 in the three new files and the build report.
- Scope: `git status --porcelain` lists only the 17 targets, plus `task-T811-spec.md` and `task-T811-build.md` (bookkeeping). `git diff --stat`: 14 files, 675 insertions, 77 deletions, nothing unannounced.

### 4. Gates run

| Command | Result | Log |
|---|---|---|
| `npm run lint` | exit 0 (node-globals, safe-ids, both `tsc`) | `workflow/stages/03_review/output/logs/T811-lint.log` |
| `node scripts/wcag-tokens.mjs` | exit 0, `All token pairs pass.`; 18 `heat-` lines | `.../T811-wcag.log` |
| `npx vitest run` theme-tokens, tx-calendar, transactions-page, transaction-form-category, diary-page, dom-id-convention | 6 files, 93 passed, 0 failed | `.../T811-targeted.log` |
| `npm run test:unit` | 71 files, 1560 passed, 0 failed, 0 skipped | `.../T811-unit.log` |
| Playwright, the spec's 26 specs, `--project=chromium` | 145 passed, 0 failed (1.4m) | `.../T811-e2e-chromium.log` |
| Playwright, the same 26 specs, all projects | 429 passed, 6 skipped, 0 failed (7.7m) | `.../T811-e2e-all.log` |

Stash check (step 6): `git status --porcelain` hash recorded (`119e65a4...`), stashed `src/index.css`, `src/App.tsx`, `TransactionForm.tsx`, `TransactionsView.tsx`, `DiaryView.tsx`, `scripts/wcag-tokens.mjs` (all `w/crlf`; the two new components are untracked so stayed in place). Result with the new tests: 4 files failed, 16 tests failed, 75 passed: the heat-token test, the `initialDate` form test, the diary hand-off test, and 13 Transactions page tests (two changed T810 tests plus new Calendar tests 1 to 11). Not failing without the source change: `unit/tx-calendar.test.tsx` and the "no raw hex" test, because they exercise the new components, which stayed in place. `git stash pop --index` restored the tree; the porcelain hash is identical. Log: `.../T811-stashed-red.log`.

### 5. Not verified

- The visual check at 1280px and 390px, light and dark (build report, 4 numbers of layout): I did not open a browser. The Playwright runs cover regressions only; no spec exercises the Calendar until design task 6. The builder's measurements are unchecked.
- The App-level hand-off (click the diary link, land on the diary day) is covered only by `DiaryView` and `TransactionsView` unit tests separately; no test mounts `App`.
- Several new page tests build dates from `todayIsoDate()` (first or last day of the month branches); I ran them on 2026-10-27 only.

### 6. Blocking

None.

### 7. Non-blocking

- `src/views/DiaryView.tsx:19-20` - the JSDoc line `/** Opens the Transactions page filtered to one day ... */` is duplicated. Delete one.
- Build report summary bullet 4 is inaccurate against the code: it says the `#tx-day-filter` chip hides "except when `dayFilter` is active" and that a "wide inline row editor" sits over the day panel with a "narrow sheet switching between the day panel and the row editor". The code (and the tests) hide the chip in the Calendar view always and open the edit panel in `Modal` at every width, as the spec says. Correct the report if it is read later.
- `unit/transactions-page.test.tsx` changes two T810 tests (range select now absent in Calendar; the row moved to yesterday). Expected by the spec's behaviour change; noted only because they are edits to existing tests.
- `src/views/TransactionsView.tsx` `dayTotals` uses an untyped `new Map()` for the non-Calendar branch; typing it `new Map<string, DayTotals>()` would keep `d` typed in `calendarDays`. Compiles today.

### 8. Rule candidates

- A view that must keep zero re-renders on a context's writes subscribes to that context only inside a child that mounts when it is needed (the `CalendarDayPanel` pattern, ADR 0093). Fits `docs/contexts/ui-and-e2e.md` once a second case exists.

### 9. Fix block

Not applicable (APPROVED).
