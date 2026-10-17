# Baseline metrics

The figures a phase is measured against. Phases 0 to 124 are in `archive/baseline-metrics-phases-000-124.md`, read only when asked to prove or disprove an improvement over an older phase. **Never rewrite an archived column.** Each phase that ships adds its section at the top of "Figures" with deltas against the one below; past about 150 lines, move the older sections to the archive.

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

### Phase 134 - delta against Phase 132

- **Entry chunk** `index-C7LsbYem.js`: 191,696 B (0 delta), 55,810 B gzip (0 delta against Phase 132 `index-C7LsbYem.js`, 191,696 / 55,810).
- **All app JS**: 878,229 B (0 delta), 266,912 B gzip (0 delta), 40 files (0 delta against Phase 132 878,229 / 266,912, 40 files).
- **CSS**: `index-CqllkKUj.css`: 52,759 B (0 delta), 10,159 B gzip (0 delta against Phase 132 `index-CqllkKUj.css`, 52,759 / 10,159).
- **Vitest**: 62 files, 1404 tests (+26 tests against Phase 132), 1404 passed in 49.85 s (`workflow/stages/02_build/output/logs/T764-unit.log`).
- **Playwright**: not run: no UI path changed in Phase 134; nothing renders the new selectors.

### Phase 132 - delta against Phase 129

- **Entry chunk** `index-C7LsbYem.js`: 191,696 B (+22 B), 55,810 B gzip (+8 B against Phase 129 `index-BB5386eR.js`, 191,674 / 55,802).
- **All app JS**: 878,229 B (+22 B), 266,912 B gzip (-30 B), 40 files (0 delta against Phase 129 878,207 / 266,942, 40 files).
- **CSS**: `index-CqllkKUj.css`: 52,759 B (0 delta), 10,159 B gzip (0 delta against Phase 129 `index-CqllkKUj.css`, 52,759 / 10,159).
- **Vitest**: 62 files, 1378 tests, 1378 passed in 49.8 s (`workflow/stages/02_build/output/logs/T760-unit.log`).
- **Playwright**: 2 files (`tests/transfer-preview.spec.ts`, `tests/wallet-forms.spec.ts`), 11 tests, 33 runs across 3 browsers (Chromium, Firefox, WebKit), 33 passed, 0 failed in 56.8 s (`workflow/stages/02_build/output/logs/T760-e2e.log`); Chromium alone: 11 passed in 46.4 s.

### Phase 129 - delta against Phase 127

- **Entry chunk** `index-BB5386eR.js`: 191,674 B (0 delta), 55,802 B gzip (+6 B against Phase 127 `index-0LGxXWZU.js`, 191,674 / 55,796).
- **All app JS**: 878,207 B (-4 B), 266,942 B gzip (-9 B), 40 files (0 delta against Phase 127 878,211 / 266,951, 40 files).
- **CSS**: `index-CqllkKUj.css`: 52,759 B (0 delta), 10,159 B gzip (0 delta against Phase 127 `index-CqllkKUj.css`, 52,759 / 10,159).
- **Vitest**: 62 files, 1375 tests, 1375 passed in 69.9 s (`workflow/stages/02_build/output/logs/T756-unit.log`).
- **Playwright**: 3 files (`tests/wallet-forms.spec.ts`, `tests/transfer-preview.spec.ts`, `tests/ios-field-zoom.spec.ts`), 13 tests, 39 runs across 3 browsers (Chromium, Firefox, WebKit), 39 passed, 0 failed in 1.2 m (`workflow/stages/02_build/output/logs/T756-e2e.log`); Chromium alone: 13 passed in 28.6 s.

### Phase 127 - delta against Phase 124

- **Entry chunk** `index-0LGxXWZU.js`: 191,674 B (0 delta), 55,796 B gzip (+3 B against Phase 124 `index-BLSMm3p4.js`, 191,674 / 55,793).
- **All app JS**: 878,211 B (-12 B), 266,951 B gzip (+43 B), 40 files (0 delta against Phase 124 878,223 / 266,908, 40 files).
- **CSS**: `index-CqllkKUj.css`: 52,759 B, 10,159 B gzip.
- **Vitest**: 62 files, 1375 tests, 1375 passed in 75.3 s (`workflow/stages/02_build/output/logs/T753-unit.log`).
- **Playwright**: 2 files (`tests/presets.spec.ts`, `tests/debt-repayment.spec.ts`), 17 tests, 51 runs across 3 browsers (Chromium, Firefox, WebKit), 51 passed, 0 failed in 1.5 m (`workflow/stages/02_build/output/logs/T753-e2e.log`); Chromium alone: 17 passed in 59.4 s.

### Phase 125 (docs only) - delta against Phase 124

- **No `src/` change:** the bundle is Phase 124's.
- **Rule files loaded at session start:** about 20 KB (global `CLAUDE.md`, this repo's `CLAUDE.md` and `AGENTS.md`, the memory index, a plugin's start hook), from about 185 KB with the old `CLAUDE.md`.
- **Live `docs/audit/*.md`:** 1,497.8 KB in 12 files on `main`, about 27 KB in 5 files now.
- **Vitest:** 62 files, 1375/1375 (71.5 s, run during the context audit). Playwright: not run (no code change); 492 tests in 34 files listed.

### Phase 124 (latest code change)

- **Entry chunk** `index-BLSMm3p4.js`: 191,674 B, 55,793 B gzip (Phase 123: 195,458 / 57,105).
- **All app JS**: 878,223 B, 266,908 B gzip, 40 files.
- **Runtime dependencies**: 7.
- **Vitest** (`unit/`): 62 files, 1375 tests, 1375/1375 in 41 s; shuffled 1375/1375 (seed `1791595131349`).
- **Playwright** (local, 4 workers): 34 files, 164 tests, 492 runs, 486 passed, 6 skipped, 0 failed, in 8.2 min, first run.
