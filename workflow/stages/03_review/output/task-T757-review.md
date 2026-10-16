# T757 review

## Round 1

### 1. Metadata

- Task: T757, promote the line-ending Backlog row into stage 01's Rules
- Date: 2026-10-16
- Round: 1
- Verdict: APPROVED
- Branch: `phase-130-eol-check`, at `706e335`, uncommitted working tree
- Target files: `workflow/stages/01_spec/CONTEXT.md`, `docs/audit/refactor-log.md`; bookkeeping `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T757-build.md`

### 2. Summary

The builder added one Rules bullet at `workflow/stages/01_spec/CONTEXT.md:50`, word for word as the spec wrote it, between `- No em dash in the spec.` and the "Stop after writing the spec" bullet. It added the Phase 130 refactor-log entry above Phase 129, the Phase 130 ledger section with T757 `done` and `Commit` left empty, and set the line-ending Backlog row's Status to `done in Phase 130 (T757)`, leaving its Item and Source cells alone.

### 3. Invariants and parity

- Parity map: no row touched (docs only).
- Line endings: all three files stay `w/crlf`, with 0 bare LF (Node).
- Text from the spec: the `CONTEXT.md` bullet, the ledger section and the Backlog Status cell match spec section 7 exactly in the diff. The refactor-log heading keeps the `<sha>` placeholders, as the spec says. The entry has all four required headings (`refactor-log.md:9` to `:16` format).
- Shape: one blank line on each side of the new ledger section (`:58`, `:66`, then `## Backlog` at `:67`). The refactor-log entry is followed by a blank line, `---` and a blank line, the same as Phase 129.
- Only one line removed across the diff: the Backlog row rewritten in place.
- `git check-ignore -v` on the three target files: none ignored (exit 1).

### 4. Gates run

All in Git Bash from the repo root; output in `workflow/stages/03_review/output/logs/T757-gates.log`.

- G1 `ls` of the six named paths: all 6 listed, exit 0.
- G2 `git diff --numstat`: `11 0` refactor-log, `9 1` task-ledger, `1 0` CONTEXT.md. Matches the spec.
- G3 `git ls-files --eol`: `i/lf w/crlf` for all three. Node: CONTEXT.md CRLF 58 bareLF 0; refactor-log CRLF 122 bareLF 0; task-ledger CRLF 95 bareLF 0. Matches the spec.
- G4 the new bullet is at `:50`, between `:49` (`- No em dash in the spec.`) and `:51` (Stop after writing); literal-string count 1.
- G5 `## Phase 130` at `:59`, T757 row at `:65` (Status `done`), `## Backlog` at `:67`, closed Backlog row at `:83`.
- G6 em dashes: 0 across `CONTEXT.md`, `refactor-log.md`, `task-ledger.md`, `task-T757-build.md` and `task-T757-spec.md`.
- G7 scope: `git diff --stat` shows 3 files, 21 insertions, 1 deletion; `git status --porcelain` shows the same 3 modified plus the untracked `task-T757-spec.md` and `task-T757-build.md`. No unannounced file.

No lint or test suite: docs-only tier (`AGENTS.md:92`). Tests `none` per spec section 6, so step 6's stash check does not apply.

### 5. Not verified

- The refactor-log heading's date and `<sha>` cells: the deploy record fills the shas after the merge.

### 6. Blocking

None.

### 7. Non-blocking

- The build report says G4 "and grep count check" without showing the command; it would read better with the command copied. No change needed.

### 8. Rule candidates

None new. This task promotes the one open candidate.
