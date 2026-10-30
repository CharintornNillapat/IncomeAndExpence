# Build report: T834 (Builder gate logs are UTF-8)

- Task ID: T834
- Phase: Phase 163 (Branch `phase-163-loader-check`)
- Files changed (2 files):
  - `workflow/stages/02_build/CONTEXT.md` (1 insertion, 0 deletions)
  - `docs/audit/task-ledger.md` (bookkeeping: Phase 163 section and T834 row)

## Tests added

None. As specified in Section 6 of `task-T834-spec.md`, this is a doc edit to a stage file with no changes to app behaviour.

## Fail-then-pass evidence

None (no test additions required).

## Gate results

- **Gate 1 (extract gate script):** Extracted `workflow/stages/02_build/output/logs/T834-gates.cjs` directly from `workflow/stages/01_spec/output/task-T834-spec.md` (43 lines, 2684 bytes).
- **Gate 2a (PowerShell form):**
  - Command: `$env:NO_COLOR = '1'; cmd /c 'npx vitest run unit/date-format.test.ts > workflow\stages\02_build\output\logs\T834-ps-form.log 2>&1'; 'exit=' + $LASTEXITCODE`
  - Exit code: `exit=0`
  - Log path: `workflow/stages/02_build/output/logs/T834-ps-form.log`
  - Result: 1 test file passed, 2 tests passed, UTF-8 plain text without UTF-16 BOM, 0 NUL bytes.
- **Gate 2b (Git Bash form):**
  - Command: `$env:NO_COLOR = '1'; & 'C:\Program Files\Git\bin\bash.exe' -c 'npx vitest run unit/date-format.test.ts 2>&1 | tee workflow/stages/02_build/output/logs/T834-bash-form.log; echo exit=${PIPESTATUS[0]}'`
  - Exit code: `exit=0`
  - Log path: `workflow/stages/02_build/output/logs/T834-bash-form.log`
  - Result: 1 test file passed, 2 tests passed, UTF-8 plain text without UTF-16 BOM, 0 NUL bytes.
- **Gate 3 (verification checks):**
  - Command: `cmd /c 'node workflow\stages\02_build\output\logs\T834-gates.cjs workflow/stages/02_build/output/logs > workflow\stages\02_build\output\logs\T834-gates.log 2>&1'; 'exit=' + $LASTEXITCODE`
  - Exit code: `exit=0`
  - Log path: `workflow/stages/02_build/output/logs/T834-gates.log`
  - Checks:
    - G1 blocks: 2
    - G1 anchor: 1
    - G1 new text: 1
    - G1 adjacent: 1
    - G2 numstat: 1 0
    - G3 T834-ps-form.log: utf16=false nul=0 passed=true
    - G3 T834-bash-form.log: utf16=false nul=0 passed=true
    - G4 em dash added lines: 0
    - G4 em dash spec: 0
    - G4 em dash build report: 0
    - G5 CONTEXT.md: w/crlf=true bareLF=0
    - G5 task-ledger.md: w/crlf=true bareLF=0
    - G6 scope: clean
    - Summary: bad 0

## Left to the reviewer

None. No Playwright tests were part of this task.

## Anything not done

None.
