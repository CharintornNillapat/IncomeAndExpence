# Review T825

## Round 1

### 1. Metadata

- Task: T825 (Phase 156, branch `phase-156-bundle-visualizer`, the phase's only and last task)
- Date: 2026-10-29
- Round: 1
- Verdict: APPROVED
- Target files: `docs/audit/decisions/0112-opt-in-bundle-visualizer.md`, `vite.config.ts`, `package.json`, `package-lock.json`, `README.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, plus bookkeeping `docs/audit/task-ledger.md`.
- `git check-ignore -v` on the targets: none is ignored (`.cache/bundle-stats.html` is ignored by `.gitignore:62`, by design).

### 2. Summary

Adds `rollup-plugin-visualizer` 7.1.1 (exact pin) as a devDependency, a script `"analyze": "vite build --mode analyze"`, and an import plus a mode-gated plugin entry in `vite.config.ts` that writes a gzip treemap to the git-ignored `.cache/bundle-stats.html`. The default build, dev server and pwa-dev server are unchanged; the analyze build leaves the working tree untouched. ADR 0112, a README line and the Phase 156 closing docs are in place.

### 3. Invariants and parity

- Parity map: no row covers `vite.config.ts` or `package.json`; none touched.
- Dependencies: `package.json` diff is exactly two added lines (the script after `build`, `"rollup-plugin-visualizer": "7.1.1"`), 0 deleted lines. devDependencies 17 to 18, dependencies 7 unchanged. Pin is exact (no caret).
- Lockfile: 415 added lines, 0 deleted. Additions: the root package's devDependency line, the `rollup-plugin-visualizer` entry (7.1.1, bin `dist/bin/cli.js`) and 26 transitive entries (bundle-name, cliui, default-browser, open 11.0.4, yargs tree, and so on): 27 `node_modules/` entries in all, matching the spec. No existing package's version changed and no `esbuild` flag line changed.
- `vite.config.ts`: exactly 2 hunks (import after the react import; comment plus `...(mode === 'analyze' ? [visualizer({ filename: '.cache/bundle-stats.html', gzipSize: true })] : [])` as the last `plugins` entry), 0 deleted lines. The `DISABLE_HMR` block and `registerType: 'prompt'` are untouched (`unit/reload-prompt.test.tsx` passes).
- Default build byte-identical: see gate 5.
- Pause list: no changed path is on it (AGENTS.md, `src/`, `supabase/`, `api/`, `vercel.json`, `index.html`, `.github/workflows/`, `.claude/agents/`, `workflow/stages/*/CONTEXT.md` are all absent from the diff and status). The spec's Production touch points section lists only the recorded dependency approval, which is not a pause-list item. **Nothing would hit the pause list, so the PR is eligible for the auto-merge path.** It is a code PR (`package-lock.json`, `vite.config.ts` outside `docs/`, `anti-slop/`, `*.md`), so the full required checks run.
- Text: zero em dashes in all touched files and in the added diff lines; `git ls-files --eol` shows `w/crlf` on every changed tracked file (unchanged `i/lf` side) and on the new ADR and build report. Only the spec file is `w/lf` (reviewer-authored, output file, not a target; it has no CR damage to fix).
- Scope: `git diff --stat` shows 7 modified files (454 insertions, 1 deletion; the deletion is the Backlog row flip in the ledger). Untracked: the ADR, `task-T825-spec.md`, `task-T825-build.md`. Nothing unannounced.
- Ledger: 142 lines (under 150), Phase 156 section before `## Backlog`, row 103 flipped as the spec's block says. Gate 2 (7 landed blocks) re-run by me: `blocks 7 bad 0`, exit 0.

### 4. Gates run

Logs in `workflow/stages/03_review/output/logs/`.

1. Baseline: my rebuild of the changed tree is compared with the baseline-metrics figures (Phase 152/154) and with the builder's pre-change `T825-dist-before.txt`; see 5.
2. Text landed: `blocks 7 bad 0`, exit 0.
3. Diff shape: vite.config.ts 2 hunks / 0 deleted; package.json 2 hunks / 0 deleted; package-lock.json `415 0`, 27 packages.
4. `npm ci --dry-run` exit 0 (no out-of-sync error); `npm ls rollup-plugin-visualizer` prints `rollup-plugin-visualizer@7.1.1`; `npm ls --omit=dev rollup-plugin-visualizer` prints `(empty)`, exit 1 (expected); devDependencies 18.
5. Default build (`npm run clean && npm run build`, exit 0, `T825-build-after.log`, `T825-dist-after.txt`, 57 files): diff against the builder's pre-change snapshot is empty except a missing trailing newline on its last line (content identical). Recomputed figures: `index-CsN9mAj5.js` 198,233 B; all app JS 39 files, 910,982 B, 275,886 B gzip (level 9); `index-BNwLrid8.css` 54,969 B. These equal the baseline-metrics Phase 152/154 figures. `.cache/bundle-stats.html` and `dist/stats.html` missing after the default build (I removed `.cache` first).
6. `resolveConfig` per mode: `serve development false`, `build production false`, `serve pwa-dev false`, `build analyze true`.
7. `npm run analyze`: exit 0, no error or warning lines; `git status --porcelain` before and after identical (`T825-status-*-analyze.txt`); `git check-ignore -v` prints `.gitignore:62:.cache/	.cache/bundle-stats.html`; report 1,175,700 bytes (matches the builder's figure); analyze `dist` listing identical to the default build's; `sw.js` mentions bundle-stats: false.
8. Repo-root `stats.html`: missing.
9. `npm run lint`: exit 0 (`T825-lint.log`).
10. `npx vitest run unit/reload-prompt.test.tsx unit/workflow-hardening.test.ts`: 2 files, 21 tests passed. `npm run test:unit`: 72 files, 1606 tests passed, 0 failed, 0 skipped listed, 56.68 s (`T825-unit.log`).
11. `npx playwright test tests/toast-layering.spec.ts --project=chromium`: 2 passed in 14.0 s (`T825-playwright.log`); ports 3000 and 3100 were free before the run and left only TIME_WAIT sockets after.
12. Docs: baseline-metrics figures (198,233 / 910,982 / 54,969 B, 39 files, 275,886 B gzip, report 1,175,700 B, dev deps 17 to 18, runtime 7, 415 lines, 27 packages, 72 files / 1606 tests) all equal what I recomputed. The ADR's `.gitignore:62` and `vite.config.ts:67` references hold (the glob line is at 67 in the unchanged part of the config).

Tests-to-add is `none` by the spec, so the red-run step does not apply.

### 5. Not verified

- The ADR/refactor-log claim "plugin default filename is `stats.html` in the working directory" and the 2026-08-14 release date come from the spec's `npm view` and the plugin's documented default; I did not re-query the registry (a read-only call, skipped as the lockfile pins 7.1.1 and the filename override is proven by gate 8).
- The only independent "before" reference for gate 5 is the baseline-metrics figures and the builder's saved pre-change snapshot; I did not rebuild the unmodified HEAD tree (it would need a stash or worktree). The hashed names and sizes matching the two Phase 152/154 records is strong evidence.
- Full Playwright suite on three browsers was not run (the spec judges the byte-identical output to need only the smoke).
- Vercel/CI `npm ci` on the remote was not run; `npm ci --dry-run` passed locally.

### 6. Blocking

None.

### 7. Non-blocking

- `docs/audit/baseline-metrics.md` and the ledger row quote the unit run as 60.54 s; my run took 56.68 s. A timing difference between runs, not an error.
- The refactor-log "Verified" line is a dense gate list ("7 blocks n 1 bad 0"); readable enough but could be tidied at the deploy record.
- `<sha>` placeholders (heading `pending the deploy record`, empty Commit cell) are left for the orchestrator's post-merge deploy-record commit, as the spec says.

### 8. Rule candidates

- A build-tooling dependency task should record the exact installed-package count from `npm ci --dry-run`/lockfile `node_modules/` additions in its gate (done here by the spec); no rule change proposed until the auto-merge path has run once and shown whether the classifier handles a lockfile-only code PR as intended.

### Files to stage (by path)

- `docs/audit/decisions/0112-opt-in-bundle-visualizer.md`
- `vite.config.ts`
- `package.json`
- `package-lock.json`
- `README.md`
- `docs/audit/refactor-log.md`
- `docs/audit/baseline-metrics.md`
- `docs/audit/task-ledger.md`
- `workflow/stages/01_spec/output/task-T825-spec.md`
- `workflow/stages/02_build/output/task-T825-build.md`
- `workflow/stages/03_review/output/task-T825-review.md`

Logs under `workflow/stages/03_review/output/logs/` are git-ignored and are not staged. `.cache/` and `dist/` are git-ignored.
