# Build Report - T825

## 1. Summary of Changes

Implemented Backlog row 103 (rollup-plugin-visualizer for bundle-size visibility, Phase 156):
- Authored ADR `docs/audit/decisions/0112-opt-in-bundle-visualizer.md` detailing the choice of exact pinned version `7.1.1`, opt-in by Vite mode (`vite build --mode analyze`), output location (`.cache/bundle-stats.html` outside `dist/` to prevent PWA precaching), and `gzipSize: true`.
- Added devDependency `rollup-plugin-visualizer@7.1.1` to `package.json` with the owner's recorded approval, resulting in 27 packages added to `package-lock.json` and 0 packages removed.
- Added script `"analyze": "vite build --mode analyze"` to `package.json`.
- Updated `vite.config.ts`: imported `visualizer` and conditionally attached it to Vite's `plugins` array only when `mode === 'analyze'`.
- Updated `README.md`: added `npm run analyze` explanation under `### 5. Run`.
- Added Phase 156 closing documentation:
  - Appended `### Phase 156 - delta against Phase 154` to `docs/audit/baseline-metrics.md`.
  - Added Phase 156 entry to `docs/audit/refactor-log.md`.
  - Updated `docs/audit/task-ledger.md`: added Phase 156 section, marked T825 as `done` with full gate results, and marked Backlog row 103 as `done in Phase 156 (T825)`.

## 2. Files Changed (8 files)

1. `docs/audit/decisions/0112-opt-in-bundle-visualizer.md` (new ADR)
2. `vite.config.ts` (modified)
3. `package.json` (modified)
4. `package-lock.json` (modified)
5. `README.md` (modified)
6. `docs/audit/refactor-log.md` (modified)
7. `docs/audit/baseline-metrics.md` (modified)
8. `docs/audit/task-ledger.md` (modified bookkeeping)

## 3. Tests Added and Fail-then-Pass Evidence

This task alters only build tooling configuration and build mode behavior without changing application runtime logic (`tests to add: none` per spec section 6).

### Fail-then-Pass Evidence

1. **Gate 2 Text-Landed Control Check:**
   - Pre-edit run: `blocks 7 bad 7` (all 7 tagged spec blocks absent, exit 1).
   - Post-edit run: `blocks 7 bad 0` (all 7 blocks matched exactly once in target files, exit 0).

2. **Gate 6 Mode Plugin Resolution:**
   - Pre-edit run: `serve development false`, `build production false`, `serve pwa-dev false`, `build analyze false`.
   - Post-edit run: `serve development false`, `build production false`, `serve pwa-dev false`, `build analyze true`.

## 4. Verification Gates Run

### Gate 1: Baseline Build Before Any Edit
- Executed `npm run clean && npm run build` on clean working tree.
- Saved build output to `workflow/stages/02_build/output/logs/T825-build-before.log`.
- Snapshot `T825-dist-before.txt` saved.
- Baseline asset figures (level 9 gzip):
  - Entry chunk `index-CsN9mAj5.js`: 198,233 B (57,965 B gzip)
  - All app JS: 39 files, 910,982 B (275,886 B gzip)
  - CSS `index-BNwLrid8.css`: 54,969 B (10,720 B gzip)
  - Exact match with Phase 152 / Phase 154 metrics.

### Gate 2: Text Landed Script
- Script extracted and verified all 7 spec fenced blocks:
  - `package.json` (analyze script): 1
  - `package.json` (visualizer devDependency): 1
  - `vite.config.ts` (visualizer import): 1
  - `vite.config.ts` (conditional plugin): 1
  - `README.md` (analyze section): 1
  - `docs/audit/task-ledger.md` (Branch line): 1
  - `docs/audit/task-ledger.md` (Backlog row): 1
- Result: `blocks 7 bad 0`, exit 0.

### Gate 3: Diff Shape
- `git diff -U0 vite.config.ts`: exactly 2 hunks, 0 deleted lines.
- `git diff -U0 package.json`: exactly 2 hunks, 0 deleted lines.
- `git diff --numstat package-lock.json`: 415 additions, 0 deletions.
- Packages added: 27 packages added (`open`, `yargs`, `picomatch`, `source-map`, and subtrees).

### Gate 4: Install Consistency
- `npm ci --dry-run`: exited 0 with no out-of-sync error.
- `npm ls rollup-plugin-visualizer`: prints `rollup-plugin-visualizer@7.1.1`.
- `npm ls --omit=dev rollup-plugin-visualizer`: prints `(empty)` and exits 1 (confirmed dev-only).
- Total `devDependencies` count: 18 (was 17).

### Gate 5: Default Build Byte-Identical
- Executed `npm run clean && npm run build`.
- Saved snapshot `T825-dist-after.txt`.
- Diff between `T825-dist-before.txt` and `T825-dist-after.txt` is empty (byte-identical file names, hashes, sizes, `sw.js`, and `manifest.webmanifest`).
- Confirmed missing: `.cache/bundle-stats.html` and `dist/stats.html` do not exist.

### Gate 6: Plugin Presence Per Mode
- Loaded Vite configuration dynamically across 4 modes:
  - `serve development`: visualizer = false
  - `build production`: visualizer = false
  - `serve pwa-dev`: visualizer = false
  - `build analyze`: visualizer = true

### Gate 7: Analyze Build and Clean Tree Check
- Saved status before analyze: `T825-status-before-analyze.txt`.
- Executed `npm run analyze` (logged to `T825-analyze.log`, built in 8.10s).
- Saved status after analyze: `T825-status-after-analyze.txt`.
- Diff between status before and after analyze is empty (working tree left clean).
- `git check-ignore -v .cache/bundle-stats.html`: outputs `.gitignore:62:.cache/	.cache/bundle-stats.html`.
- `.cache/bundle-stats.html` size: 1,175,700 bytes (> 0).
- Dist snapshot after analyze `T825-dist-analyze.txt` is byte-identical to `T825-dist-before.txt`.
- `dist/sw.js` check: does not mention `bundle-stats` (false).

### Gate 8: No Stray Output
- `stats.html` at repository root does not exist.

### Gate 9: Lint
- `npm run lint`: clean exit 0 (139 files in `src/` checked for node globals and safe ids; `tsc --noEmit` and API tsconfig clean). Logged to `T825-lint.log`.

### Gate 10: Unit Tests
- Targeted unit tests: `unit/reload-prompt.test.tsx` (4 tests) and `unit/workflow-hardening.test.ts` (17 tests) passed (21 passed).
- Full suite: `npm run test:unit` passed 72 test files, 1606 tests in 60.54s (0 delta against Phase 154). Logged to `T825-unit.log`.

### Gate 11: Playwright Smoke
- Confirmed ports 3000 and 3100 free before execution.
- Executed `npx playwright test tests/toast-layering.spec.ts --project=chromium`.
- 2 passed in 53.4s (dev server on 3000 and pwa-dev server on 3100 started and served without errors).

### Gate 12: Docs and Housekeeping
- Verified all figures in `baseline-metrics.md` match measurements.
- `git ls-files --eol`: `w/crlf` on all modified tracked files; 0 bare LF across all 7 target files and ADR 0112.
- Em dashes check: 0 em dashes (`\u2014`) in added lines and across all touched files.
- `task-ledger.md` line count: 143 lines (< 150).

## 5. Deliberately Not Done

- No size budget or CI threshold gate on the visualizer report.
- No CI upload of the visualizer HTML report.
- No brotli calculation enabled in visualizer options.
- No addition of `cross-env` or external CLI script runner dependencies (opt-in handled purely via Vite mode).
- No changes to `.gitignore` (`.cache/` is already ignored at line 62).
- No changes to `src/`, `unit/`, or `tests/`.
- `<sha>` placeholders in `docs/audit/refactor-log.md` and empty Commit cells in `docs/audit/task-ledger.md` left for the post-merge deploy record.
