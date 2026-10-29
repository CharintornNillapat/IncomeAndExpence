# Task T829 build report: faster gates (builder runs Playwright on chromium only, reviewer runs all three browsers once)

Task ID: T829
Branch: phase-160-faster-gates
Phase: 160

## Files changed (6 files)

- AGENTS.md
- workflow/stages/01_spec/CONTEXT.md
- workflow/stages/02_build/CONTEXT.md
- workflow/stages/03_review/CONTEXT.md
- docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md
- docs/audit/task-ledger.md

## Tests added and fail-then-pass evidence

None (docs-only workflow rules and ADR amendment, per spec section 6).

Control run of the gate helper `workflow/stages/02_build/output/logs/T829-gates.cjs`:
Before the edits:
- Command: `node workflow/stages/02_build/output/logs/T829-gates.cjs`
- Output:
```
edit 1 AGENTS.md new text count 0
edit 1 AGENTS.md old text still present
edit 2 AGENTS.md new text count 0
edit 2 AGENTS.md not in its place
edit 3 workflow/stages/01_spec/CONTEXT.md new text count 0
edit 4 workflow/stages/02_build/CONTEXT.md new text count 0
edit 4 workflow/stages/02_build/CONTEXT.md not in its place
edit 5 workflow/stages/02_build/CONTEXT.md new text count 0
edit 5 workflow/stages/02_build/CONTEXT.md old text still present
edit 6 workflow/stages/03_review/CONTEXT.md new text count 0
edit 6 workflow/stages/03_review/CONTEXT.md not in its place
edit 7 docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md new text count 0
edit 7 docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md not in its place
blocks 7 checks 9 bad 13
```
Exit code: 1.

After the edits:
- Command: `node workflow/stages/02_build/output/logs/T829-gates.cjs`
- Output: `blocks 7 checks 9 bad 0`
- Exit code: 0.

## Gate commands and results

- Gate 1: text landed
  - Command: `node workflow/stages/02_build/output/logs/T829-gates.cjs`
  - Result: `blocks 7 checks 9 bad 0` (exit 0)
  - Helper log: `workflow/stages/02_build/output/logs/T829-gates.cjs`

- Gate 2: no em dash
  - Command: `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split(String.fromCharCode(8212)).length-1)"`
    - Result: `0`
  - Command: `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split(String.fromCharCode(8212)).length-1)" AGENTS.md workflow/stages/01_spec/CONTEXT.md workflow/stages/02_build/CONTEXT.md workflow/stages/03_review/CONTEXT.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/task-ledger.md workflow/stages/01_spec/output/task-T829-spec.md workflow/stages/02_build/output/task-T829-build.md`
    - Result: all 8 files reported 0

- Gate 3: line endings kept
  - Command: `git ls-files --eol AGENTS.md workflow/stages/01_spec/CONTEXT.md workflow/stages/02_build/CONTEXT.md workflow/stages/03_review/CONTEXT.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/task-ledger.md`
    - Result: AGENTS.md w/crlf, docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md w/crlf, workflow/stages/01_spec/CONTEXT.md w/crlf, workflow/stages/02_build/CONTEXT.md w/crlf, workflow/stages/03_review/CONTEXT.md w/crlf, docs/audit/task-ledger.md w/lf
  - Command: `node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');const crlf=s.split('\r\n').length-1;console.log(f,'crlf',crlf,'bareLF',s.split('\n').length-1-crlf)}" AGENTS.md workflow/stages/01_spec/CONTEXT.md workflow/stages/02_build/CONTEXT.md workflow/stages/03_review/CONTEXT.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/task-ledger.md`
    - Result:
      - AGENTS.md crlf 143 bareLF 0
      - workflow/stages/01_spec/CONTEXT.md crlf 60 bareLF 0
      - workflow/stages/02_build/CONTEXT.md crlf 56 bareLF 0
      - workflow/stages/03_review/CONTEXT.md crlf 47 bareLF 0
      - docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md crlf 164 bareLF 0
      - docs/audit/task-ledger.md crlf 0 bareLF 175

- Gate 4: scope
  - Command: `git status --porcelain`
  - Result: 6 modified files (`AGENTS.md`, `workflow/stages/01_spec/CONTEXT.md`, `workflow/stages/02_build/CONTEXT.md`, `workflow/stages/03_review/CONTEXT.md`, `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`, `docs/audit/task-ledger.md`), untracked spec and build report (and pre-existing `task-T830-spec.md`). `.claude/agents/` has 0 changes.

## Left to the reviewer

None (docs-only task, no Playwright gates).

## Anything not done

None.
