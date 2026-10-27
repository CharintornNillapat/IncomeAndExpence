# Baseline metrics

The figures a phase is measured against. Phases 0 to 124 are in `archive/baseline-metrics-phases-000-124.md` and **Phases 125 to 147** in `archive/baseline-metrics-phases-125-147.md`; read them only when asked to prove or disprove an improvement over an older phase. The Phase 124 section at the bottom stays as the floor the archived Phase 125 and 127 deltas start from. **Never rewrite an archived column.** Each phase that ships adds its section at the top of "Figures" with deltas against the one below; past about 150 lines, move the older sections to the archive.

## How to measure

```powershell
# Bundle: always rebuild, never read a stale dist/. Build with the repo's .env present:
# VITE_ values are inlined into the entry, so a build without it is smaller.
npm run clean
npm run build
# Then gzip each file in dist/assets at level 9 and record raw and gzip bytes:
# the entry index-*.js, and the sum of all app JS.

# Tests: record files, tests, runs, result and time; keep the logs.
npm run test:unit
npm run test:unit:shuffle      # note the seed it prints
npx playwright test            # local, 4 workers; note whether the dev servers were cold

# Type-check time: run 3 times, discard the cold first run, take the median of the rest.
npx tsc --noEmit --extendedDiagnostics
```

## Figures

### Phase 149 - delta against Phase 148

Measured at `9caee5e`; T815 changed docs only and the merge commit `12a12eb` has the same tree as `6343851`, so the figures hold for it.

- **Entry chunk** `index-achQGTXo.js`: 198,233 B (+3,607 B), 57,974 B gzip (+993 B against Phase 148 `index-D4N64t3V.js`, 194,626 / 56,981): the phase changed files that load with the entry, among them `FinanceContext.tsx` (T812's `setTransactionsDeleted`) and `App.tsx` (T811's diary hand-off).
- **All app JS**: 910,934 B (+24,603 B), 275,852 B gzip (+6,576 B against Phase 148 886,331 / 269,276, 39 files, 0 file delta): the new Table, Calendar, day panel and bulk bar add no chunk; `TransactionsView-FspLBvoz.js` is 55,405 B.
- **CSS**: `index-BNwLrid8.css`: 54,969 B (+1,610 B), 10,720 B gzip (+269 B against Phase 148 `index-CNaxMlAk.css`, 53,359 / 10,451): T811's three heat tokens in both themes and the new views' utility classes.
- **Vitest**: 72 files, 1598 tests (+3 files, +88 tests against Phase 148: `unit/tx-view-preference.test.ts`, `unit/tx-calendar.test.tsx` and `unit/transactions-bulk.test.tsx` new, ten files extended), 1598 passed in 60.32 s (`workflow/stages/02_build/output/logs/T815-unit.log`). Per-task runs: T809 1515 (87.38 s), T810 1535 (54.19 s), T811 1560 (54.39 s), T812 1580 (55.59 s), T813 1598 (55.69 s), each in `workflow/stages/02_build/output/logs/<id>-unit.log`.
- **Playwright**: `npx playwright test --list` reports 213 tests in 37 files, 639 runs across 3 projects (+26 tests, +1 file, +78 runs against Phase 148, all in `tests/transactions-views.spec.ts`, new in T814). Full run by T815: 633 passed, 6 skipped, 0 failed across 3 projects (12.0 min, `workflow/stages/02_build/output/logs/T815-e2e.log`). Before it, the phase ran targeted specs only (T810, T811 and T813: 26 specs on three browsers; T812: 4 specs; T814: the new spec).

### Phase 148 - delta against Phase 147

Measured at `29ce4ba`; T808 changed docs only and the merge commit `2cc177c` has the same tree as `ef434cd`, so the figures hold for it.

- **Entry chunk** `index-D4N64t3V.js`: 194,626 B (+33 B), 56,981 B gzip (+18 B against Phase 147 `index-B-nRqlko.js`, 194,593 / 56,963): T807's idle callback in `App.tsx` also flips the four shell-dialog latches.
- **All app JS**: 886,331 B (+33 B), 269,276 B gzip (+46 B against Phase 147 886,298 / 269,230, 39 files, 0 file delta).
- **CSS**: `index-CNaxMlAk.css`: 53,359 B (0 delta), 10,451 B gzip (0 delta; the same file as Phase 147).
- **Vitest**: 69 files, 1510 tests (0 delta against Phase 147), 1510 passed in 76.30 s (`workflow/stages/02_build/output/logs/T808-unit.log`). Per-task run: T807 1510 passed in 84.61 s (`workflow/stages/02_build/output/logs/T807-unit.log`).
- **Playwright**: `npx playwright test --list` reports 187 tests in 36 files, 561 runs across 3 projects (+4 tests, +12 runs against Phase 147, all in `tests/tab-preload.spec.ts`, new in T807). Full run by T807: 555 passed, 6 skipped, 0 failed across 3 projects (10.2 min, `workflow/stages/02_build/output/logs/T807-e2e.log`); the T807 review's run gave the same (10.4 min). No full run by T808 (docs-only; the code is unchanged since T807).

### Phase 124 (latest code change)

- **Entry chunk** `index-BLSMm3p4.js`: 191,674 B, 55,793 B gzip (Phase 123: 195,458 / 57,105).
- **All app JS**: 878,223 B, 266,908 B gzip, 40 files.
- **Runtime dependencies**: 7.
- **Vitest** (`unit/`): 62 files, 1375 tests, 1375/1375 in 41 s; shuffled 1375/1375 (seed `1791595131349`).
- **Playwright** (local, 4 workers): 34 files, 164 tests, 492 runs, 486 passed, 6 skipped, 0 failed, in 8.2 min, first run.
