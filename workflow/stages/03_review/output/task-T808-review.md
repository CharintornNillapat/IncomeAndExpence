# Review: T808

## Round 1

### 1. Metadata

- Task: T808, Phase 148 closing docs (branch `phase-148-add-entry-close`, HEAD `29ce4ba`)
- Date: 2026-10-25
- Round: 1
- Verdict: APPROVED
- Target files: `AGENTS.md`, `README.md`, `docs/contexts/ui-and-e2e.md`, `docs/audit/decisions/0108-shell-dialogs-mount-at-idle.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`; bookkeeping `docs/audit/task-ledger.md`. `git check-ignore -v` on all seven: none ignored (exit 1).

### 2. Summary

Docs-only close of Phase 148. The Playwright counts move to 187 / 36 / 561 (555 pass, 6 skip) in `AGENTS.md:11`, `README.md:158` and `ui-and-e2e.md:67`. ADR 0108 gets the three spec edits (sole cause softened, Verification counts, entry chunk +33 B). The refactor-log entry and the baseline-metrics Phase 148 section are added. The ledger gets the T807 Commit cell `29ce4ba` and the rewritten T808 row. The diff matches section 6a word for word, with the real figures filled in: `<X>` = 76.30 s, and the metrics file has 193 lines where the spec guessed "about 194". The spec told the builder to write the real counts, and it did.

### 3. Invariants and parity

- Parity map: none touched (docs only).
- Every stated figure checked against my own runs: Playwright list 561 / 36 files (all projects) and 187 / 36 (chromium); unit 69 files / 1510; entry `index-D4N64t3V.js` 194626 / 56981; CSS `index-CNaxMlAk.css` 53359 / 10451; all app JS 886331 / 269276 / 39 files; modal chunks 2,497 / 6,986 / 2,955 / 16,577 B, which match ADR 0108 Consequences. Deltas against Phase 147 (194,593 / 56,963; 886,298 / 269,230) give +33 / +18 and +33 / +46: correct.
- Sha `29ce4ba` matches `git log --grep="(T807)"`.
- Line counts named in refactor-log Deliberately not done (ledger 192, metrics 193) match `wc -l`.
- CRLF: all seven files `w/crlf`, bareLF 0; line counts unchanged where they should be (134, 179, 79, 47).
- `<sha>` placeholders are kept literally. The T808 Commit cell is empty, and `baseline-metrics` has no `Measured at` line, as the spec says.
- Phase 149 untracked paths: still `??`. Their mtimes (19:58) are older than the spec (20:51) and the build (21:07 to 21:09), so they were not touched. The only mention of them is the one Deliberately not done item that section 6a step 6 calls for.

### 4. Gates run

- `npm run test:unit`: 69 files passed, 1510 tests passed, 0 failed, 0 skipped, 55.80 s. Log `workflow/stages/03_review/output/logs/T808-unit.log`.
- `npx playwright test --list`: `Total: 561 tests in 36 files`; `--project=chromium`: `Total: 187 tests in 36 files`.
- `rm -rf dist; npm run build`: exit 0 (log `workflow/stages/03_review/output/logs/T808-build.log`), figures as in section 3; `dist/` removed afterwards.
- Gate 5 sha: `29ce4ba`.
- Gate 6 stale-count grep: no output, exit 1.
- Gate 7 line counts: ledger 192, refactor-log 161, metrics 193.
- EOL: bareLF 0 and `w/crlf` on all seven files.
- Em dashes: 0 in added diff lines, 0 in each of the seven files, 0 in the T808 spec and build report.
- `git diff --stat`: 7 files, 27 insertions, 8 deletions (1 line each in `AGENTS.md`, `README.md`, `ui-and-e2e.md`; 3 in ADR 0108; refactor-log +11, metrics +8, ledger 2 rows).
- `git status --porcelain`: the seven files, the two T808 stage files, and the two Phase 149 `??` paths. Nothing else. No code, test or config file.
- No Playwright run (docs-only tier; no `src/` or `tests/` change).

### 5. Not verified

- The production fix itself (one press of "Add entry", signed in, after deploy). It is the owner's post-deploy check and is recorded under Deliberately not done.
- The T807 build and review timings quoted from their stage files (84.61 s, 10.2 min, 10.4 min). I did not rerun them; they are history.

### 6. Blocking

(none)

### 7. Non-blocking

- `workflow/stages/01_spec/output/task-T808-spec.md` has LF line endings (bareLF 164), while the other stage files use CRLF. It is a stage output, not a target, so this is harmless.
- `task-ledger.md` (192) and `baseline-metrics.md` (193) are past the ~150-line archive threshold. The entry already records this as a separate task.

### 8. Rule candidates

none.
