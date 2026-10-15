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
