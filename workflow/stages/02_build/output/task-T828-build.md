# T828 Build Report: Unattended pushes behind a pre-push guard

**Task ID:** T828  
**Phase:** 159 (`phase-159-unattended-pushes`)  
**Status:** BUILT  

## 1. Files Changed (13 total)

1. `docs/audit/decisions/0114-unattended-pushes-pre-push-guard.md`: ADR 0114 recorded in full.
2. `unit/pre-push-guard.test.ts`: 18 isolated git push unit tests in temp repositories.
3. `scripts/git-hooks/pre-push`: Versioned pre-push guard script (LF, ending with `exit 0\n`).
4. `.gitattributes`: Line added enforcing `text eol=lf` for `scripts/git-hooks/*`.
5. `.git/hooks/pre-push`: Untracked live hook replaced by exact copy of `scripts/git-hooks/pre-push`.
6. `.claude/settings.json`: Added 6 allow rules (3 push, 2 gh pr create, 1 notification), 14 deny rules (7 Bash, 7 PowerShell), removed 4 blanket ask rules.
7. `AGENTS.md`: Updated Vitest counts (1624 tests, 73 files) and added Unattended pushes [ADR 0114] rule.
8. `README.md`: Updated Vitest counts in Testing section (1624 tests in 73 files).
9. `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`: Added Phase 159 amendment note.
10. `~/.claude/commands/finlife.md`: Updated MASTER preflight hook check (B9), notification on blocked/prompt (B10, B11), exact push/pr commands (B12, B13) (outside repo, not committed).
11. `docs/audit/refactor-log.md`: Phase 159 entry added above Phase 158.
12. `docs/audit/baseline-metrics.md`: Phase 159 delta section added to Figures.
13. `docs/audit/task-ledger.md`: Phase 159 section created with T828 row; Backlog row A marked `done in Phase 159 (T828)`.

## 2. Tests Added and Fail-then-Pass Evidence

**Test file:** `unit/pre-push-guard.test.ts` (18 tests)

### Fail (Red Run - against old hook)
- Command: `npx vitest run unit/pre-push-guard.test.ts > workflow/stages/02_build/output/logs/T828-red.log 2>&1`
- Output: `Tests  13 failed | 5 passed (18)`
- Failures:
  - `refs/heads/main takes only deploy records > refuses a deploy-record message on a commit that touches a code file`
  - `refs/heads/main takes only deploy records > refuses a subject without the docs(deploy) prefix`
  - `refs/heads/main takes only deploy records > refuses a subject without the [skip ci] suffix`
  - `refs/heads/main takes only deploy records > refuses a range that holds a code commit after a valid deploy record`
  - `refs/heads/main takes only deploy records > refuses a deploy record that touches another docs file`
  - `refs/heads/main takes only deploy records > refuses a deploy record that adds a new ADR`
  - `refs/heads/main takes only deploy records > refuses a merge commit even when both sides are deploy records`
  - `refs/heads/main takes only deploy records > refuses a force push that rewrites main`
  - `refs/heads/main takes only deploy records > refuses deleting main`
  - `refs/heads/main takes only deploy records > refuses a code commit pushed to main from another branch`
  - `inside a herdr pane > does not open main to a code commit when ALLOW_GIT_WRITE=1 is set`
  - `inside a herdr pane > refuses a force push to a phase branch`
  - `inside a herdr pane > refuses deleting a remote branch`
- Log: `workflow/stages/02_build/output/logs/T828-red.log`

### Pass (Green Run - against new hook)
- Command: `npx vitest run unit/pre-push-guard.test.ts > workflow/stages/02_build/output/logs/T828-green.log 2>&1`
- Output: `Tests  18 passed (18)` in 31.45s
- Log: `workflow/stages/02_build/output/logs/T828-green.log`

## 3. Verification Gates

- **Gate 1 (Red run):** `Tests  13 failed | 5 passed (18)` verified in `workflow/stages/02_build/output/logs/T828-red.log`.
- **Gate 2 (Green run):** `Tests  18 passed (18)` verified in `workflow/stages/02_build/output/logs/T828-green.log`.
- **Gate 3 (Installed hook):** `node -e ...` confirmed `.git/hooks/pre-push` is byte-identical to `scripts/git-hooks/pre-push` (`identical true CR 0 shebang true final LF true`), and `git check-attr eol` verified `scripts/git-hooks/pre-push: eol: lf`. Log: `workflow/stages/02_build/output/logs/T828-install.log`.
- **Gate 4 (Replay on real history):** Cloned repo to temp bare repo and pushed all 36 recent deploy records plus tested merge commit: `accepted 36 refused 0; merge 160c4b7 onto 5d993de refused: pre-push guard: refusing a merge commit on refs/heads/main`. Log: `workflow/stages/02_build/output/logs/T828-replay.log`.
- **Gate 5 (Order check):** Verified ordering timestamps (`red.log < green.log < replay.log < .claude/settings.json`) and prerequisites: `push allow rules 3 installed true red true green true replay true ordered true`.
- **Gate 6 (Settings rule list parity against HEAD):** `allow 8 deny 113 ask 7 OK`. `git diff --numstat -- .claude/settings.json` is `22 6 .claude/settings.json`, total 139 lines.
- **Gate 7 (Text landed):** Script validated all Blocks B1-B17 and Gones G1-G10: `blocks 27 bad 0`. Verified byte equality of Block B1 and B2, and diff on `finlife.md` confirmed exactly 2 inserted lines and 3 modified lines.
- **Gate 8 (Lint):** `npm run lint` clean (check:node-globals: 139 files; check:safe-ids: 139 files; tsc --noEmit: clean; tsc -p api/tsconfig.json: clean).
- **Gate 9 (Targeted unit tests):** `npx vitest run unit/pre-push-guard.test.ts unit/security-headers.test.ts`: 2 files passed, 28 tests passed in 23.79s.
- **Gate 10 (Full unit suite):** `npm run test:unit > workflow/stages/02_build/output/logs/T828-unit.log 2>&1`: `Test Files  73 passed (73)`, `Tests  1624 passed (1624)` in 91.44s.
- **Gate 11 (Line endings):** Verified 8 files with CRLF only (`bareLF 0`), 3 files with LF only (`crlf 0`: `scripts/git-hooks/pre-push`, `.git/hooks/pre-push`, `finlife.md`), and ADR 0114 and unit test unmixed (`bareLF 0`).
- **Gate 12 (Em dashes):** 0 em dashes in `git diff -U0 HEAD`, and 0 em dashes across all touched files.
- **Gate 13 (Scope check):** `git status --porcelain` matches the exact target files list (8 modified, 5 untracked including build report and spec). Preserved `.git/hooks/pre-commit` timestamp (`2026-10-16`). `git diff --numstat` confirmed `AGENTS.md` 2 1, `README.md` 1 1, `.gitattributes` 1 0, ADR 0101 4 0.

## 4. Deliberately Not Done

- No `core.hooksPath`, no npm install script and no `postinstall` hook.
- No limit on which branches other than `main` a push may create or advance.
- `.git/hooks/pre-commit` is unchanged and still untracked.
- No PowerShell push allow rule (PowerShell has no `VAR=1 command` form).
- No `PreToolUse` hook and no change to the owner's `~/.claude/settings.json` (`autoMode` block and notifier settings).
- No test of Claude Code permission rules (testing a copy of matcher).
- Backlog row B (builder chromium-only runs) is a separate task.
- Filling `<sha>` placeholders and Commit cells, left to the owner-approved post-merge deploy record.
