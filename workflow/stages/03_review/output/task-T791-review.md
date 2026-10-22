# Review: T791

## Round 1

### 1. Metadata

- Task: T791 (Phase 142 closing docs), branch `phase-142-clean-up-id-conventions`
- Date: 2026-10-22
- Round: 1
- Verdict: APPROVED
- Target files: `AGENTS.md`, `README.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`; bookkeeping `docs/audit/task-ledger.md`

### 2. Summary

Docs-only close of Phase 142. `AGENTS.md:11` and `README.md:157` now state 1465 unit tests in 64 files; `baseline-metrics.md` gains the Phase 142 section; `refactor-log.md` gains the Phase 142 entry with `docs <sha>` / `merged <sha>` left literal; the task ledger fills T790's Commit cell with `c8d16cf` and adds a `done` T791 row with an empty Commit cell. Every inserted block matches spec section 6a word for word, with `<X>` = 53.05 s from the builder's run.

### 3. Invariants and parity

- Parity map: no row touched (docs only).
- Scope: `git diff --stat` shows exactly the 5 announced files (23 insertions, 3 deletions); `git status --porcelain` adds only the untracked `task-T791-spec.md` and `task-T791-build.md`. No unannounced changes.
- `git check-ignore -v` on all 5 files: none ignored (exit 1).
- `AGENTS.md` and `README.md`: one changed line each, only the two numbers. Playwright counts (179 / 35 / 537) untouched and still correct.
- Historical `1463` / `63 files` figures in the Phase 141 entries left alone, as the spec requires.
- T790 row: only the Commit cell changed. Phase 142 heading, branch line and Backlog untouched.
- Facts in the refactor-log entry spot-checked against code: `c8d16cf` touches 24 `src/` files (20 components + 4 views), 24 `tests/` specs, 12 `unit/` files (11 renamed + the new guard); `TransactionForm.tsx:179` `submitBtnId` is `` `${idPrefix}-confirm-btn` ``; four literal `repay-*` testids at `:840`, `:888`, `:919`, `:930`; `unit/dom-id-convention.test.ts` has 2 tests and `'debts'` in `AREAS` (`:21`); `DebtsView.tsx` carries `debts-paid-off-heading`, `debts-caption` and `idPrefix="debt-repay"` (`:398`); `time-filter-*` used by `tests/date-boundary.spec.ts:88`; T790 review is round 1 CHANGES REQUESTED, round 2 APPROVED.
- Line endings: `git ls-files --eol` shows `w/crlf` for all 5; a per-line scan finds 0 bare-LF lines in each.
- Em dashes: 0 in the diff's added lines; 0 in each of the 5 files.
- File lengths after the task: `refactor-log.md` 95, `baseline-metrics.md` 133, `task-ledger.md` 133, all under the ~150 archive threshold.

### 4. Gates run

Docs-only tier, plus the spec's count checks (Git Bash equivalents of the spec's PowerShell commands):

| Command | Result | Log |
|---|---|---|
| `npm run test:unit` | 64 files passed (64), 1465 tests passed (1465), 0 failed, 0 skipped, 51.51 s | `workflow/stages/03_review/output/logs/T791-unit.log` |
| `npx playwright test --list` | `Total: 537 tests in 35 files` | `workflow/stages/03_review/output/logs/T791-pw-list.log` |
| `rm -rf dist && npm run build` | exit 0 | `workflow/stages/03_review/output/logs/T791-build.log` |
| bundle measure (gzip level 9) | `index-CQ64gmHG.js 193169 56374`, `index-BJZ9fITB.css 52877 10216`, `allJS 884709 268592 39`: matches the metrics block exactly | |
| `git rev-parse --short $(git merge-base main HEAD)` | `b21cb8d` | |
| `git log --format=%h -1 --grep=T790` | `c8d16cf` | |
| `git grep -n "1463\|63 files" -- AGENTS.md README.md` | no output, exit 1 | |
| `git ls-files --eol` (5 files) | all `i/lf w/crlf` | |
| em dash count over `git diff -U0 HEAD` added lines | `0` | |

### 5. Not verified

- The 53.05 s runtime written into the metrics and ledger is the builder's own run (log in `workflow/stages/02_build/output/logs/T791-unit.log`, which I did not reopen); my run took 51.51 s. The spec says to record the builder's seconds, so that is correct.
- The T790 figures quoted in the entry (74 red failures, 132 chromium passes, 531/6 on 3 browsers, 8.7 min, 10.9 min review rerun) come from the T790 build and review reports and the existing ledger row. I did not rerun Playwright, and the spec puts that out of scope.
- Step 6 (red run): skipped. The spec lists no tests.

### 6. Blocking

None.

### 7. Non-blocking

- `workflow/stages/02_build/output/task-T791-build.md` uses LF line endings. It is an untracked stage output, so this does not matter.

### 8. Rule candidates

None.
