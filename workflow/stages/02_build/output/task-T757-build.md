# Build report: T757

Phase 130: Line-ending check rule (promote the line-ending Backlog row into stage 01's Rules).

## Files changed (3 files + build report)

1. `workflow/stages/01_spec/CONTEXT.md`:
   - Added Rules bullet at line 50 specifying line-ending checks must use `git ls-files --eol <file>` (w/crlf column) or Node count of `\r\n` and bare `\n`, never `grep -c $'\r' <file>`.
2. `docs/audit/refactor-log.md`:
   - Added Phase 130 entry above Phase 129 documenting changes, gate verifications, surprises (none), and deliberately not done scope.
3. `docs/audit/task-ledger.md`:
   - Added Phase 130 section with T757 task row marked done with gate results; left Commit cell empty.
   - Updated Backlog row for line-ending checks status to `done in Phase 130 (T757)`.

## Tests added

- None (per spec section 6: docs-only change, Markdown rule bullet, log entry and ledger rows; no app code, test or config changed; pinned by grep, Node and git gate checks).

## Gate commands and results

1. Gate G1 (named paths exist):
   - Command: `ls workflow/stages/01_spec/CONTEXT.md workflow/stages/03_review/CONTEXT.md docs/audit/task-ledger.md docs/audit/refactor-log.md AGENTS.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`
   - Result: all 6 paths exist, exit 0.

2. Gate G2 (diff size per file):
   - Command: `git diff --numstat -- workflow/stages/01_spec/CONTEXT.md docs/audit/refactor-log.md docs/audit/task-ledger.md`
   - Result: `1 0 workflow/stages/01_spec/CONTEXT.md`, `11 0 docs/audit/refactor-log.md`, `9 1 docs/audit/task-ledger.md`, exit 0.

3. Gate G3 (line endings stay CRLF):
   - Command: `git ls-files --eol workflow/stages/01_spec/CONTEXT.md docs/audit/refactor-log.md docs/audit/task-ledger.md` and Node count
   - Result: `w/crlf` for all 3; Node counts `CRLF 58 bareLF 0`, `CRLF 122 bareLF 0`, `CRLF 95 bareLF 0`, exit 0.

4. Gate G4 (rule landed whole and in place):
   - Command: `grep -n "^- " workflow/stages/01_spec/CONTEXT.md | sed -n '/^4[4-9]:\|^5[0-9]:/p'` and grep count check
   - Result: rule bullet landed at line 50 between line 49 (`- No em dash in the spec.`) and line 51 (`- Stop after writing the spec...`); literal string count is 1, exit 0.

5. Gate G5 (ledger rows):
   - Command: `grep -n "^## Phase 130\|^| T757\|^## Backlog\|done in Phase 130 (T757)" docs/audit/task-ledger.md`
   - Result: `## Phase 130` at line 59, `| T757` at line 65 with Status `done`, `## Backlog` at line 67, and closed Backlog row at line 83 ending `done in Phase 130 (T757) |`, exit 0.

6. Gate G6 (zero em dashes):
   - Command: `node -e "const fs=require('fs');let n=0;for(const f of process.argv.slice(1)){fs.readFileSync(f,'utf8').split('\n').forEach((l,i)=>{if(l.includes(String.fromCharCode(8212))){n++;console.log(f+':'+(i+1))}})}console.log('em dashes:',n);process.exit(n?1:0)" workflow/stages/01_spec/CONTEXT.md docs/audit/refactor-log.md docs/audit/task-ledger.md workflow/stages/02_build/output/task-T757-build.md`
   - Result: `em dashes: 0`, exit 0.

7. Gate G7 (scope check):
   - Command: `git diff --stat; git status --porcelain`
   - Result: only 3 target files modified (`workflow/stages/01_spec/CONTEXT.md`, `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`), plus untracked spec and build report, exit 0.

## Not done

- None. All edits from the spec were completed.
