# Review: T806

## Round 1

### 1. Metadata

- Task: T806, Phase 147 closing docs, branch `phase-147-update-prompt` (T805 committed as `d6261d4`).
- Date: 2026-10-25
- Round: 1
- Verdict: APPROVED
- Target files: `AGENTS.md`, `README.md`, `docs/audit/decisions/0107-ask-before-updating-the-offline-app.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`; bookkeeping `docs/audit/task-ledger.md`. None is gitignored (`git check-ignore -v` exit 1 for all six).

### 2. Summary

Docs-only close of Phase 147. The unit count in `AGENTS.md:11` and `README.md:157` moves to 1510 tests in 69 files, and ADR 0107's Verification parenthetical now says `skipWaiting call true`, inside the message listener. `baseline-metrics.md` gets its Phase 147 section and `refactor-log.md` its Phase 147 entry. The ledger gets the T805 Commit cell (`d6261d4`) and the T806 row. Every edit matches spec section 6a word for word, with `<X>` filled as 61.55 s.

### 3. Invariants and parity

- Parity map: none touched (docs only).
- Scope: `git diff --stat` shows 6 files, 24 insertions, 5 deletions: AGENTS.md 1, README.md 1, ADR 0107 1, baseline-metrics +8, refactor-log +11, ledger 2. `git status --porcelain` also shows the untracked `task-T806-spec.md` and `task-T806-build.md` (stage outputs), plus the three pre-existing files below. No code, test or config file appears, and neither does `docs/contexts/ui-and-e2e.md`.
- The three pre-existing ` M` files (`workflow/stages/01_spec/output/task-T805-spec.md`, `workflow/stages/02_build/CONTEXT.md`, `workflow/stages/02_build/output/task-T805-build.md`) are byte-identical to the index and to HEAD. `git hash-object --no-filters` equals `git rev-parse :<f>` equals `git rev-parse HEAD:<f>` (6169f2c, 11c8426, 9c13a8b), and `git diff --cached` is empty. The ` M` comes only from a stale stat entry plus the autocrlf warning (`i/lf w/lf`). They are out of T806's scope and must stay unstaged.
- Figures in the new text, checked against my own runs: entry 194,593 / 56,963, all JS 886,298 / 269,230 over 39 files, CSS 53,359 / 10,451. They match the Phase 146 section (`baseline-metrics.md:36-40`: 194,386 / 56,893, 886,091 / 269,167, same CSS file), and the deltas +207 / +70 / +63 are correct. Unit files: `ls unit | grep -cE "test\.tsx?$"` gives 69. The 61.55 s is confirmed in `workflow/stages/02_build/output/logs/T806-unit.log`.
- ADR 0107: only the `:33` parenthetical changed. Its new text matches the built `dist/sw.js`.
- Ledger: only the T805 Commit cell and the T806 row changed. The heading, the branch line, earlier phases and the Backlog are untouched.
- `docs/contexts/ui-and-e2e.md:67` (183 / 36 / 549) still matches the list output, so leaving it alone was right.

### 4. Gates run

- `npm run test:unit`: 69 files passed (69), 1510 tests passed (1510), 0 failed, 0 skipped, 68.36 s. Log: `workflow/stages/03_review/output/logs/T806-unit.log`.
- `npx playwright test --list`: `Total: 549 tests in 36 files`. With `--project=chromium`: `Total: 183 tests in 36 files`.
- `npm run build` (no `dist/` beforehand): exit 0. Log: `workflow/stages/03_review/output/logs/T806-build.log`. Bundle node script: `index-B-nRqlko.js 194593 56963`, `index-CNaxMlAk.css 53359 10451`, `allJS 886298 269230 39`.
- `dist/sw.js` check: `SKIP_WAITING true`, `clientsClaim false`, `skipWaiting calls 1`, `in listener true`. `dist/` removed afterwards.
- Gate 6: `git log --format=%h -1 --grep="(T805)"` gives `d6261d4`.
- Gate 7: `git grep -n -E "1506 tests|68 files" -- AGENTS.md README.md docs/contexts/` gives no output (exit 1).
- Gate 8, line counts: ledger 183, refactor-log 150, metrics 183. These match the counts named in the refactor-log's last Deliberately not done item.
- Line endings: all six files `bareLF 0` and `w/crlf`.
- Em dashes: 0 in the added lines of `git diff -U0 HEAD`, and 0 in each of the six files, the T806 spec and the T806 build report.

### 5. Not verified

- No Playwright run. The task is docs-only with no `src/` or `tests/` change, and the spec requires none.
- The figures copied from the T805 rows of the refactor-log Verified line (for example toast-layering 24.7 s) are the builder's T805 numbers. They match the committed ledger row and were not rerun.

### 6. Blocking

None.

### 7. Non-blocking

- `workflow/stages/01_spec/output/task-T806-spec.md` is LF-only in the working tree, because it is untracked. With `core.autocrlf=true` it is stored as LF on add, the same as the other stage outputs, so no action is needed.
- The ADR 0107 `:33` sentence still begins "immediate `self.skipWaiting()` invocations are absent" and then reports `skipWaiting call true`. This is correct as worded ("immediate" against "inside the listener"), and it is what the spec asked for.

### 8. Rule candidates

None.
