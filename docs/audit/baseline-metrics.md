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

### Phase 159 - delta against Phase 158

Measured at the T828 working tree; no build input changed (`src/`, `index.html`, `public/`, `vite.config.ts`, `package.json` untouched), so the bundle was not rebuilt and Phase 158 figures stand (`index-CAxfG7Qp.js` 198,228 B / 57,957 B gzip, all app JS 911,014 B / 275,891 B gzip in 39 files, CSS `index-BNwLrid8.css` 54,969 B / 10,720 B gzip in 57 files). Dependencies unchanged (dev 21, runtime 7).

- **Vitest**: 73 files, 1624 tests (+1 file, +18 tests against Phase 158: added `unit/pre-push-guard.test.ts`), 1624 passed in 91.44 s (`workflow/stages/02_build/output/logs/T828-unit.log`); the new test file passed 18 tests in 31.45 s (`workflow/stages/02_build/output/logs/T828-green.log`).
- **Playwright**: unchanged, 213 tests in 37 files, 639 runs; not run locally (no affected spec; agent tooling and docs only).

### Phase 158 - delta against Phase 156

Measured at the T827 working tree. Before the two fixes (with the devDependencies and config added), the default build is byte-identical to Phase 156 baseline (gate 3 diff against gate 2 baseline is empty). After the two fixes in `Modal.tsx` and `OverflowMenu.tsx`: 57 files (0 delta); CSS `index-BNwLrid8.css` is identical at 54,969 B / 10,720 B gzip (0 B delta); entry chunk is `index-CAxfG7Qp.js` 198,228 B (-5 B raw) / 57,957 B gzip (-8 B gzip against Phase 156 `index-CsN9mAj5.js` 198,233 / 57,965); all app JS is 911,014 B (+32 B raw) / 275,891 B gzip (+5 B gzip against Phase 156 910,982 / 275,886 in 39 files, 0 file delta); `dist/` contains 0 occurrences of "eslint".

- **Dependencies**: Dev dependencies 18 to 21 (+3, `eslint` 9.39.5, `eslint-plugin-react-hooks` 7.1.1, `typescript-eslint` 8.72.1); runtime dependencies unchanged at 7; lockfile `package-lock.json` adds 1368 lines and removes 2 lines (99 packages added from `npm install`).
- **Hooks linter**: `npm run lint:hooks` is an opt-in script; warnings reduced from 7 to 5 (0 errors), with the two non-money warnings in `Modal.tsx` and `OverflowMenu.tsx` fixed and the five in `FinanceContext.tsx` retained.
- **Vitest**: 72 files, 1606 tests (+0 files, +0 tests against Phase 156; no tests added), 1606 passed in 61.01 s (`workflow/stages/02_build/output/logs/T827-unit.log`); targeted unit suite (4 files, 61 tests) passed in 4.87 s.
- **Playwright**: unchanged, 213 tests in 37 files, 639 runs; targeted run on the 11 affected specs for Modal and OverflowMenu passed 83 tests in 1.3 min on Chromium (`workflow/stages/02_build/output/logs/T827-pw-chromium.log`) and 249 tests in 7.9 min across Chromium, Firefox and WebKit (`workflow/stages/02_build/output/logs/T827-pw-all.log`).

### Phase 156 - delta against Phase 154

Measured at the T825 working tree. The default build is byte-identical to the baseline pre-change build and reproduces Phase 152/154 hashes (`index-CsN9mAj5.js` 198,233 B / 57,965 B gzip, all app JS 910,982 B / 275,886 B gzip in 39 files, CSS `index-BNwLrid8.css` 54,969 B / 10,720 B gzip; gate 5 diff against gate 1 baseline is empty).

- **Bundle analysis**: `npm run analyze` writes a gzip treemap to `.cache/bundle-stats.html` (1,175,700 B, git-ignored), while `dist/` remains byte-identical to the default build and `dist/sw.js` does not precache it.
- **Dependencies**: Dev dependencies 17 to 18 (+1, `rollup-plugin-visualizer` 7.1.1); runtime dependencies unchanged at 7; lockfile `package-lock.json` adds 415 lines (27 packages added).
- **Vitest**: 72 files, 1606 tests (+0 files, +0 tests against Phase 154; no tests added), 1606 passed in 60.54 s (`workflow/stages/02_build/output/logs/T825-unit.log`).
- **Playwright**: unchanged, 213 tests in 37 files, 639 runs; smoke test `tests/toast-layering.spec.ts` on Chromium passed 2 tests in 53.4 s, proving dev (port 3000) and pwa-dev (port 3100) servers start and serve with the edited `vite.config.ts`. The merge commit `a1864ff` has the T825 tree plus docs, so the figures hold for it; the `main` push run for it passed all seven required checks (run 40822012459).

### Phase 154 - delta against Phase 152

Measured at the T822 working tree; no file under `src/`, `index.html`, `vite.config.ts`, `package.json` or `package-lock.json` changed (changed files: `.github/workflows/playwright.yml`, `unit/workflow-hardening.test.ts`, `AGENTS.md`, `README.md`, `docs/contexts/ui-and-e2e.md`, `docs/audit/decisions/0111-docs-only-prs-report-required-checks.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md`, `.gitignore`), so the entry chunk, all app JS and CSS are Phase 152's (`index-CsN9mAj5.js` 198,233 B / 57,965 B gzip, all app JS 910,982 B / 275,886 B gzip in 39 files, CSS `index-BNwLrid8.css` 54,969 B / 10,720 B gzip) and were not rebuilt.

- **Vitest**: 72 files, 1606 tests (+0 files, +5 tests against Phase 152/151: added suite in `unit/workflow-hardening.test.ts`), 1606 passed in 83.99 s (`workflow/stages/02_build/output/logs/T822-unit.log`); shuffled run 72 files, 1606 tests passed in 69.76 s with seed 1793187995002 (`workflow/stages/02_build/output/logs/T822-unit-shuffle.log`).
- **Playwright**: unchanged, 213 tests in 37 files, 639 runs; not run locally (no spec or app file changed; the docs-only path is proven by the first docs-only PR after the merge, ADR 0111). CI on PR #106 and on the `main` push for `3e31866` ran the full suite as code: all seven required checks passed (E2E 2m39s to 3m33s, `Type-check and unit tests` 2m59s).

### Phase 152 - delta against Phase 151

Measured at the T820 working tree.

- **Entry chunk** `index-CsN9mAj5.js`: 198,233 B (0 B delta), 57,965 B gzip (-9 B against Phase 151/149 `index-achQGTXo.js`, 198,233 / 57,974).
- **All app JS**: 910,982 B (+48 B), 275,886 B gzip (+34 B against Phase 151/149 910,934 / 275,852, 39 files, 0 file delta): `AddWalletModal-HUvfbRXN.js` is 3,006 B / 1,376 B gzip (was `AddWalletModal-CjIeYJ-s.js` 2,958 B / 1,343 B gzip in Phase 149).
- **CSS**: `index-BNwLrid8.css`: 54,969 B (0 delta), 10,720 B gzip (0 delta; the same file as Phase 149 and Phase 151).
- **Vitest**: 72 files, 1601 tests (+0 files, +0 tests against Phase 151; extended test in `unit/wallets-page.test.tsx`), 1601 passed in 62.98 s (`workflow/stages/02_build/output/logs/T820-unit.log`).
- **Playwright**: unchanged, 213 tests in 37 files, 639 runs across 3 projects; targeted run on three browsers for the 5 affected specs (`wallets.spec.ts`, `wallet-forms.spec.ts`, `soft-delete.spec.ts`, `account-and-mobile-nav.spec.ts`, `ios-field-zoom.spec.ts`), 96 passed in 2.4 min (`workflow/stages/02_build/output/logs/T820-e2e.log`).

### Phase 151 - delta against Phase 149

Measured at the T819 working tree; no file under `src/`, `index.html`, `vite.config.ts`, `package.json` or `package-lock.json` changed (gate 11), so the entry chunk, all app JS and CSS are Phase 149's (`index-achQGTXo.js` 198,233 B, all app JS 910,934 B in 39 files, CSS 54,969 B) and were not rebuilt.

- **Vitest**: 72 files, 1601 tests (+0 files, +3 tests against Phase 149: all three in `unit/migration-replay.test.ts`), 1601 passed in 55.54 s (`workflow/stages/02_build/output/logs/T819-unit.log`).
- **Playwright**: unchanged, 213 tests in 37 files, 639 runs; not run (no spec or `src/` change).

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
