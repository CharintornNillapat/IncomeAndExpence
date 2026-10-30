# Review T834: builder gate logs are UTF-8

## Round 1

### 1. Metadata

- Task: T834 (Phase 163, branch `phase-163-loader-check`)
- Date: 2026-10-30
- Round: 1
- Verdict: APPROVED
- Target files: `workflow/stages/02_build/CONTEXT.md` (not gitignored: `git check-ignore -v` exit 1). Bookkeeping: `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T834-build.md`.

### 2. Summary

One line inserted as step 5's first sub-bullet in the build stage file: logs are UTF-8; in PowerShell 5.1 never use `>`, `>>` or `Tee-Object` for a log, use `cmd /c '... > log 2>&1'` with `$LASTEXITCODE`; in Git Bash use `tee` plus `${PIPESTATUS[0]}`; `Out-File -Encoding utf8` only for a cmdlet's own output. The ledger gains the Phase 163 section and the T834 row, as the spec gives them.

### 3. Invariants and parity

- Parity map: none touched (spec section 5 says none; confirmed, a stage-file doc edit).
- Edit text matches the spec byte for byte after CRLF normalisation (G1 anchor 1, new text 1, adjacent 1); the diff is exactly 1 insertion, 0 deletions on the target (G2), so no other line of the file changed.
- Line endings: target and ledger `w/crlf`, 0 bare LF (G5).
- Ledger: heading, branch line and T834 Task/Files cells match spec section 7; Commit cell empty; Status `done` with a gate result, per stage 02 step 6. No T835 row added.
- Em dashes: 0 in the added lines, the target, the ledger, the spec and the build report.
- The documented command forms work on this machine: both were run for real (Gate 2a, 2b) and produced plain UTF-8 logs. The builder's own T834 logs (`T834-ps-form.log`, `T834-bash-form.log`, `T834-gates.log`) have no BOM and 0 NUL bytes, so the new rule already holds for this task's builder output.
- Builder's extracted `T834-gates.cjs` is identical (after CR strip) to the reviewer's own extraction from the spec.

### 4. Gates run

- Scope: `git diff --stat` shows 2 files, 9 insertions (ledger 8, target 1). `git status --porcelain -uall`: the 2 modified files plus the T834 spec, T835 spec and T834 build report, all allowed.
- Gate 1: gate script extracted from the spec by script to `workflow/stages/03_review/output/logs/T834-gates.cjs` (43 lines); `cmp` against the builder's copy: identical.
- Gate 2a (PowerShell 5.1 `cmd /c` form, from Git Bash via `powershell.exe -NoProfile`): `exit=0`. Log `workflow/stages/03_review/output/logs/T834-ps-form.log`: first bytes `0a 20 52 55`, 1 test file passed, 2 tests passed.
- Gate 2b (Git Bash `tee` form): `exit=0`. Log `workflow/stages/03_review/output/logs/T834-bash-form.log`: first bytes `0a 20 52 55`, 1 test file passed (1), 2 tests passed (2).
- Gate 3 (`node T834-gates.cjs workflow/stages/03_review/output/logs`, saved through the `cmd /c` form): `exit=0`, 13 `OK` lines, `bad 0`. Log `workflow/stages/03_review/output/logs/T834-gates.log` (first bytes `4f 4b`, plain UTF-8).
- Docs-only tier: no lint or test suite required; the stated commands and paths were checked by Gate 2.

### 5. Not verified

- Step 6 (red run): not applicable, the spec's tests are `none`.
- The Thai-garbling claim for `Out-File` and the `NativeCommandError` wrapping were not re-run in this round; they rest on the spec's own reproduction (section 4 table) and are advisory text, not a command the builder runs.
- G6 ran before this review file existed; the file is on the gate's allowed list, so its presence does not change the result.

### 6. Blocking

None.

### 7. Non-blocking

- The build report's Gate 2a/2b commands prefixed `$env:NO_COLOR = '1'`, which the spec did not give. Harmless (vitest's `Tests  N passed` line matched in the reviewer's runs without it), but a later task should not depend on it.

### 8. Rule candidates

None. The rule now lives in the build stage file, the one place the PowerShell builder reads it.
