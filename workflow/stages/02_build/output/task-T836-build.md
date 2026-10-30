# Build report T836: role-only stage files, AGENTS.md and MASTER.md

## 1. Task ID and files changed

Task: T836
Files changed (7 files):
- `workflow/stages/01_spec/CONTEXT.md`
- `workflow/stages/02_build/CONTEXT.md`
- `workflow/stages/03_review/CONTEXT.md`
- `AGENTS.md`
- `workflow/orchestrator/runtimes.md`
- `workflow/orchestrator/MASTER.md`
- `docs/audit/task-ledger.md`

## 2. Tests added and fail-then-pass evidence

None (docs-only task per spec section 6; stage 02 step 4 does not apply).

## 3. Required note

No MASTER.md line was kept for the word-for-word reason: the BUILDER role prompt (MASTER.md:44) is sent verbatim, but nothing in it needs the runtime's name, both loaders read it from MASTER.md section 5 without quoting it, and the new parenthetical holds no double quote, backtick or dollar sign. A builder already running keeps its old role prompt until the next `reset` or spawn.

## 4. Gates run

### Gate 0: save the gate script
Extracted js fenced block from `workflow/stages/01_spec/output/task-T836-spec.md` to `workflow/stages/02_build/output/logs/T836-gates.cjs`.

### Gate 1: owner's grep (done-when)
Command:
```powershell
& 'C:\Program Files\Git\usr\bin\grep.exe' -nE 'Claude Code|agy|Gemini|Sonnet|Opus' workflow/stages/01_spec/CONTEXT.md workflow/stages/02_build/CONTEXT.md workflow/stages/03_review/CONTEXT.md workflow/orchestrator/MASTER.md; 'exit=' + $LASTEXITCODE
```
Result: 0 lines matched, exit=1.

### Gate 2: guard test
Command:
```cmd
npx vitest run unit/workflow-hardening.test.ts
```
Log: `workflow/stages/02_build/output/logs/T836-workflow-hardening.log`
Result: 1 test file passed, 17 tests passed, 0 failed (294ms).

### Gate 3: checks script
Command:
```cmd
node workflow\stages\02_build\output\logs\T836-gates.cjs
```
Log: `workflow/stages/02_build/output/logs/T836-gates.log`
Result:
- G1: stage files and MASTER.md line numbers match expected (none)
- G2: AGENTS.md matches 0 lines
- G3: 22 text blocks checked across 11 edits, each old text 0 occurrences and each new text exactly 1 occurrence
- G4: git diff numstat matches expected:
  - `workflow/stages/01_spec/CONTEXT.md`: 1 1
  - `workflow/stages/02_build/CONTEXT.md`: 1 1
  - `workflow/stages/03_review/CONTEXT.md`: 1 1
  - `AGENTS.md`: 4 4
  - `workflow/orchestrator/runtimes.md`: 1 1
  - `workflow/orchestrator/MASTER.md`: 3 3
- G5: `workflow/orchestrator/runtimes.md` exists with all 5 required rows, and role prompt is shell-safe
- G6: 0 em dashes in added lines, spec, and build report
- G7: all target files and ledger are w/crlf with 0 bare LF
- G8: git status scope clean (only allowed files present)
Summary: all lines OK, bad 0.

## 5. Playwright gates left to the reviewer

None (docs-only task).

## 6. Deliberately not done

None.
