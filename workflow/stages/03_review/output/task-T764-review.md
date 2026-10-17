# T764 review: the month-to-date comparison (Dashboard redesign SEL-3), and the Phase 134 paperwork

## Round 1

### Metadata

- Task: T764, Phase 134, branch `phase-134-dashboard-selectors` (on top of T762 `e6fb160` and T763 `30da09d`); ships the phase
- Date: 2026-10-17
- Round: 1
- Verdict: APPROVED
- Target files: `src/selectors/ledger.ts`, `unit/selectors-dashboard.test.ts`, `docs/contexts/client-state.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` (bookkeeping: `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T764-build.md`)

### Summary

`monthToDate(txs, today, categories?)` (`src/selectors/ledger.ts:145-163`) returns N, each month's day 1 to N window with its Spending and Left over (through `cashFlow`), and the two percent changes, `null` on a zero base. The code, imports (`:3-4`), types (`:117-134`) and the private `percentChange` (`:136-138`) match spec 7.1 exactly. Nine new tests cover spec groups 1 to 8 and every date the owner named; T763's future-dated test gains its direct assertion (`unit/selectors-dashboard.test.ts:339`); the phase's refactor-log entry, metrics section, context line and ledger row are in.

### Invariants and parity

- Parity map: no row touched (reuses `cashFlow` and `inRange`; no ledger arithmetic). Confirmed.
- L1: both sides go through `cashFlow`. Test 1 excludes a transfer, a repayment, a movement-category expense, an adjustment and a deleted row, and gets 300/700 against 200/600. Holds.
- One N for both months (spec 7.1, reading 1): `days = min(today's day, last month's length)` and both windows end at day N. Test 2 (Oct 31 against September: N 30, the 31st's 45 not counted) and test 3 (March 29 to 31: N 29 in 2028, N 28 in 2027, March 29's 8 not counted) pin it. Holds.
- Last month's length without a new helper: `shiftIsoDate(\`${monthKeyOf(today)}-01\`, -1)`; checked in both zones for 2028-02-29, 2027-02-28, 2026-12-31 and 2026-09-30. `debts.ts`'s `daysInMonth` untouched. Holds.
- Year crossing: January 15, 31 and 1 against December (test 4). Holds.
- Negative base (spec 7.1, reading 2): `percentChange` divides by `Math.abs(before)`; -200 to -100 gives +50 (test 6). Spending's change is the plain formula, as spending is never negative. Holds.
- Zero base: both changes `null`, no `NaN` or `Infinity` (test 5). Holds.
- Rounding: figures come from `cashFlow` (`roundToCents`); test 7 gets exactly 0.3. Percents are not rounded, like `spentPercent` and `keptPercent`. Holds.
- `today` is an argument; the windows are ISO-string bounds into `inRange`. No clock read. Holds.
- Time zones: the new zone block asserts the offset (0 / -420) before its checks. Holds in both.
- T763 tightening: one line added at `:339`, nothing else in that block changed; it passes with and without `monthToDate` (it tests committed T763 code). Holds.
- Docs: `client-state.md:63` is spec 7.2's new line exactly (`1	1`). The refactor-log entry has every template heading, `<sha>` placeholders as Phases 132 and 133 had, and the red and gate figures match the three ledger rows. The baseline section's figures match my own build and test run (below). Holds.

### Gates run

- `git check-ignore -v` on all five targets: exit 1, none ignored. `dist/` is ignored (`.gitignore:7`) and shows only as `!! dist/`.
- Scope: `git diff --stat`: 6 files, 240 insertions, 3 deletions (`baseline-metrics.md` +8, `refactor-log.md` +11, `task-ledger.md` +1, `client-state.md` 1/1, `ledger.ts` +50/-1, `selectors-dashboard.test.ts` +169/-1). `git status --porcelain`: those 6 plus the untracked T764 spec and build report. No unannounced file.
- `npm run lint`: exit 0. Log: `workflow/stages/03_review/output/logs/T764-lint.log`.
- `npx vitest run unit/selectors-dashboard.test.ts unit/selectors-ledger.test.ts unit/selectors-debts.test.ts unit/diary-page.test.tsx`: 4 files passed, 100 tests passed, 0 failed, 0 skipped.
- `npm run test:unit`: 62 files passed, 1404 tests passed, 0 failed, 0 skipped (51.8s). Log: `workflow/stages/03_review/output/logs/T764-unit.log`. 1404 = Phase 132's 1378 + 8 (T762) + 9 (T763) + 9 (T764).
- `npm run clean` then `npm run build` (repo `.env` present, not read): both exit 0. Log: `workflow/stages/03_review/output/logs/T764-build.log`. Gzip level 9 over `dist/assets`: entry `index-C7LsbYem.js` 191,696 / 55,810; all JS 878,229 / 266,912 in 40 files; CSS `index-CqllkKUj.css` 52,759 / 10,159. Identical to the builder's figures and to Phase 132 (0 delta: the new exports have no caller yet).
- Red check (step 6): stashed `src/selectors/ledger.ts` (back to T763's committed version), ran `npx vitest run unit/selectors-dashboard.test.ts`: 9 failed, 32 passed; all 9 failures are the new `monthToDate` tests with `TypeError: monthToDate is not a function`; the tightened T763 test passed. `git stash pop`; `git status --porcelain` identical before and after.
- Playwright: no affected spec. `monthToDate` has no caller in `src/`.
- `git ls-files --eol`: all six touched files `i/lf w/crlf`.
- Em dashes (Node count, `String.fromCharCode(0x2014)`): 0 in all six touched files and the build report.

### Not verified

- The owner's confirmation of spec 7.1's two readings (one N for both months; Left over's change over the size of last month's figure) is not written in the spec. The orchestrator paused after the spec and then sent the build order, which I take as acceptance. If not, tests 2, 3 and 6 are the ones to change.
- The comparison line on the page: nothing renders it until UI-2 (Phase 135).
- `npm run test:unit:shuffle`: not a gate for these tiers. Each zone block restores `Asia/Bangkok` in its own `afterAll`.

### Blocking

None.

### Non-blocking

- Build report gate 5: the builder ran PowerShell's `Remove-Item dist` instead of `npm run clean`, which also removes `server.js`. The outcome here is the same (my `npm run clean` run gave the same figures), but the metrics recipe names `npm run clean`.
- `unit/selectors-dashboard.test.ts` test 5 checks `Number.isFinite` field by field; a loop over the nested values (as T762's test 6 does) would catch a future field too.

### Rule candidates

- Still none promoted. The forks-pool `TZ` note now covers three zone blocks, all in `selectors-dashboard.test.ts`; the two newest carry the offset guard. Promote to `docs/contexts/client-state.md` when a second test file switches zones mid-file.
