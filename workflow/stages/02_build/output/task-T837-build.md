# Build report T837: one shared skeleton for the three ICM stage files

## 1. Task ID and files changed

Task: T837
Files changed (4 files):
- `workflow/stages/01_spec/CONTEXT.md`
- `workflow/stages/02_build/CONTEXT.md`
- `workflow/stages/03_review/CONTEXT.md`
- `docs/audit/task-ledger.md`

## 2. Tests added and fail-then-pass evidence

None (docs-only task per spec section 6; stage 02 step 4 does not apply).

## Shell note tags

- workflow/stages/01_spec/CONTEXT.md: [generic] A gate that checks line endings
- workflow/stages/01_spec/CONTEXT.md: [generic] A gate that counts em dashes
- workflow/stages/02_build/CONTEXT.md: [generic] In Windows PowerShell 5.1, `>`, `>>`
- workflow/stages/02_build/CONTEXT.md: [local] Run the command through `cmd /c`
- workflow/stages/02_build/CONTEXT.md: [generic] Use `| Out-File -Encoding utf8 <log>`

## 4. Gates run

### Gate 0: save the script
Extracted js fenced block from `workflow/stages/01_spec/output/task-T837-spec.md` to `workflow/stages/02_build/output/logs/T837-restructure.cjs`.

### Gate 1: proof check
Command:
```cmd
node workflow\stages\02_build\output\logs\T837-restructure.cjs check
```
Log: `workflow/stages/02_build/output/logs/T837-check.log`
Result:
- R1: before text sha256 matches pins for 01, 02, 03; new sentences block holds 3 sentences; definitions match owner wording
- R2 & P1 to P7: all 3 files match spec blocks exactly; titles, skeletons, subheadings, sentences, tags, code spans all verified OK
- R3: stage 02 steps 4, 5 and sub-bullets and stage 03 step 6 and sub-steps 6.1 to 6.4 keep their numbers
- R4: zero runtime names in stage files
- R5: zero em dashes in added diff lines and spec
- R6: all targets and ledger have CRLF line endings and 0 bare LF
- R7: exactly 1 ledger row for T837
- R8: git status scope clean
Summary: 40 OK lines, bad 0.

### Gate 2: guard test
Command:
```cmd
npx vitest run unit/workflow-hardening.test.ts
```
Log: `workflow/stages/02_build/output/logs/T837-workflow-hardening.log`
Result: 1 test file passed, 17 tests passed, 0 failed in 298ms.

### Gate 3: proof catches a reword (selftest)
Command:
```cmd
node workflow\stages\02_build\output\logs\T837-restructure.cjs selftest
```
Log: `workflow/stages/02_build/output/logs/T837-selftest.log`
Result: 2 S0 checks passed (unmutated stage 02 and 03 pass), all 11 mutations caught (changed true, caught true), 24 OK lines, bad 0.

## 5. Playwright gates left to the reviewer

None (docs-only task).

## 6. Deliberately not done

None.
