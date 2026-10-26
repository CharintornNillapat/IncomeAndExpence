# Review: T809

## Round 1

### 1. Metadata

- Task: T809, Phase 149 task 1 (ADR 0109): pure helpers `monthBounds`, `dailyTotals`, `heatLevel` / `HEAT_LEVELS`, `selectionSummary`, their unit tests, and the Phase 149 ledger section.
- Date: 2026-10-26
- Round: 1
- Verdict: APPROVED
- Branch: `phase-149-transactions-views` (HEAD `27a6e5f`)
- Target files: `src/selectors/timeRange.ts`, `src/selectors/ledger.ts`, `unit/selectors-ledger.test.ts`, `docs/contexts/client-state.md`, `docs/audit/decisions/0109-transactions-table-and-calendar-views.md` (owner file, unchanged), `docs/design/transactions-2026-10/spec.md` (owner file, unchanged), plus the bookkeeping file `docs/audit/task-ledger.md`. `git check-ignore -v` on all six targets matches nothing (exit 1), so none is ignored.

### 2. Summary

The build adds `monthBounds` to `timeRange.ts` and `DayTotals`, `dailyTotals`, `HEAT_LEVELS`, `heatLevel`, `SelectionSummary` and `selectionSummary` to the end of `ledger.ts`. The text matches spec section 4.1 exactly. The build also adds a five-test block and four import edits to `unit/selectors-ledger.test.ts`, one `client-state.md` bullet, and the Phase 149 ledger section with the T809 row. No existing export changes, and nothing in `src/` or `tests/` uses the new helpers yet.

### 3. Invariants and parity

- Parity map: no row is touched. These are new read-only selectors with no ledger write arithmetic, so the `addTransaction` / RPC row and the transfer-preview row do not apply.
- L1 / L11: `dailyTotals` uses `sumIncome` / `sumSpending` (already rounded through `roundToCents`) and takes `net` from `groupByDay`, so a calendar day's net equals the Table day row's net. `selectionSummary` nets through `roundToCents(sumIncome - sumSpending)`, the same form as `groupByDay`. No inline money filter.
- Rounding rule: `heatLevel`'s `Math.round(x * 100)` converts to integer cents only for a comparison. Nothing is divided back or stored, so this is not ledger rounding, and the doc comment says so. I independently confirmed the float trap the comment cites: in Node, `3*0.1/0.3` = `1.0000000000000002` and `3*0.2/0.3` = `2.0000000000000004`. The `!(x > 0)` guards cover `NaN`, 0 and negative values. `Math.min` clamps a day above `monthMax`.
- Dates: `monthBounds` builds its bounds only from `shiftMonth` and `shiftIsoDate`, which split the key, so no ISO string is parsed as a UTC `Date`. Bounds are inclusive `YYYY-MM-DD` strings that work with `inRange`. The tests cover a leap February (2028) and December stepping into January.
- Text landed (compared by script against the spec code blocks, CRLF normalised): line 1 of `timeRange.ts` equals the spec's new import, and edit 2 sits exactly between `filterByRange`'s closing `}` and `function parts`. Edit 3 (the `ledger.ts` added lines) is an exact match. The unit test block is the file's exact tail. The unit diff has 76 added lines: 71 block lines, 1 blank line and 4 import lines. The `client-state.md` diff adds exactly the spec's bullet and nothing else. The ledger section matches the spec's heading, branch line and row, with the Commit cell left empty.
- Exports: `git grep -nE "export (function|const|interface) (monthBounds|dailyTotals|heatLevel|HEAT_LEVELS|selectionSummary)\b" src/selectors` gives 5 lines (`ledger.ts:243, :261, :269, :286`, `timeRange.ts:54`). Every name in the new doc bullet exists as written.
- Owner files: `git hash-object` gives `4b233a3025b6b3a725867f88475aa5b3ed81dd5a` (ADR 0109) and `f9ee0348663f181c094d16908b76ec3c41769cc4` (design spec), the same as the build report's before and after values. Both files still have 0 CRLF and 0 em dashes.
- Line endings: `git ls-files --eol` shows `i/lf w/crlf` on all five tracked changed files, both before and after the stash check.
- Text: 0 em dashes in the added lines of `git diff -U0 HEAD`, and 0 in each touched file and the build report.
- Scope: `git diff --stat` covers 5 files (+165 / -4). `git status --porcelain` lists only those 5 files, the untracked ADR 0109, `docs/design/transactions-2026-10/` (contains only `spec.md`), `task-T809-spec.md` and `task-T809-build.md`. Nothing is unannounced.

### 4. Gates run

| Command | Result | Log |
|---|---|---|
| `npm run lint` | exit 0: node-globals 133 files clean, safe-ids 133 files clean, `tsc --noEmit` and `tsc -p api/tsconfig.json` clean | `workflow/stages/03_review/output/logs/T809-lint.log` |
| `npx vitest run unit/selectors-ledger.test.ts unit/selectors-dashboard.test.ts` | 2 files passed, 68 tests passed, 0 failed, 0 skipped | `workflow/stages/03_review/output/logs/T809-related.log` |
| `npm run test:unit` | 69 files passed (69), 1515 tests passed (1515), 0 failed, 0 skipped (66.19s) | `workflow/stages/03_review/output/logs/T809-unit.log` |
| Red run: `git stash push -- src/selectors/timeRange.ts src/selectors/ledger.ts`, then `npx vitest run unit/selectors-ledger.test.ts`, then `git stash pop --index` | 1 file failed; 5 failed, 22 passed (27). The 5 failures are exactly the five new tests: `monthBounds is not a function` (x2), `dailyTotals is not a function`, `expected undefined to be 3` (HEAT_LEVELS), `selectionSummary is not a function`. After the pop, `git status --porcelain` is identical to before (diffed), and the `git diff` hash is unchanged (`77f3787...`) | `workflow/stages/03_review/output/logs/T809-red.log` |

No Playwright gate: the change touches no component, view, context or hook, and nothing in `src/` imports the helpers yet (grep confirmed).

### 5. Not verified

- The "before build" hashes of the two owner files rest on the build report. The spec did not record them. They match today, and both files are still LF with 0 em dashes, as the spec stated when it was written.

### 6. Blocking

None.

### 7. Non-blocking

- `workflow/stages/02_build/output/task-T809-build.md:49`: the quoted red-log line reads `unit/selectors-ledger.ts:308:20` (missing `.test`). The builder's log is UTF-16, so this line was evidently typed by hand rather than pasted. This is cosmetic, and my own red run reproduced the failure.
- The builder's logs are UTF-16LE (PowerShell `Tee-Object`), which makes `grep` miss them. A future build could pipe through Bash `tee`, or use `Out-File -Encoding utf8`.

### 8. Rule candidates

None.
