# Build report: T758

Phase 130: Drop the bare git commit ask rules (`Bash(git commit:*)` and `PowerShell(git commit:*)`) from `.claude/settings.json`, and amend ADR 0101.

## Files changed (4 files + build report)

1. `.claude/settings.json`:
   - Removed `Bash(git commit:*)` and `PowerShell(git commit:*)` ask rules from `permissions.ask`.
2. `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`:
   - Updated Status line to cite Phase 130 (T758) amendment.
   - Added Phase 130 amendment section 1 ("No ask prompt on a bare commit").
3. `docs/audit/refactor-log.md`:
   - Rewrote Phase 130 entry heading and body to cover T757 and T758.
4. `docs/audit/task-ledger.md`:
   - Updated Phase 130 heading to reflect commit prompts and ADR 0101 amendment.
   - Added T758 task row under Phase 130 marked done with gate results; left Commit cell empty.

## Tests added

- None (per spec section 6: agent settings and documentation change; removes two permission prompts and edits Markdown; no app code or test suite changed; pinned by exact diff, list equality and schema validation gates).

## Gate commands and results

1. Gate G1 (named paths exist):
   - Command: `ls .claude/settings.json .git/hooks/pre-commit .git/hooks/pre-push AGENTS.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md workflow/stages/01_spec/CONTEXT.md workflow/stages/03_review/CONTEXT.md`
   - Result: all 7 paths exist, exit 0.

2. Gate G2 (settings diff is exactly the two removed lines):
   - Command: `git diff --numstat -- .claude/settings.json; git diff -U0 -- .claude/settings.json | grep -E '^[-+] '`
   - Result: `0 2 .claude/settings.json`, exactly the two `-` lines (`-      "Bash(git commit:*)",` and `-      "PowerShell(git commit:*)",`), exit 0.

3. Gate G3 (rule lists: deny unchanged, ask is HEAD minus the two rules):
   - Command: `node -e "const fs=require('fs');const {execSync}=require('child_process');const h=JSON.parse(execSync('git show HEAD:.claude/settings.json',{encoding:'utf8'})).permissions;const w=JSON.parse(fs.readFileSync('.claude/settings.json','utf8')).permissions;const gone=['Bash(git commit:*)','PowerShell(git commit:*)'];const ok=JSON.stringify(h.deny)===JSON.stringify(w.deny)&&JSON.stringify(h.ask.filter(r=>!gone.includes(r)))===JSON.stringify(w.ask)&&!w.allow;console.log('deny',w.deny.length,'ask',w.ask.length,ok?'OK':'MISMATCH');console.log(w.ask.join('\n'));process.exit(ok?0:1)"`
   - Result: `deny 91 ask 11 OK` followed by the 11 ask rules, exit 0.

4. Gate G4 (schema validation against Claude Code schema):
   - Command: download schema to `workflow/stages/02_build/output/logs/claude-code-settings.schema.json` and validate with ajv
   - Result: `valid`, exit 0. Log saved to `workflow/stages/02_build/output/logs/T758-settings-schema.log`.

5. Gate G5 (line endings stay CRLF):
   - Command: `git ls-files --eol` and Node count across all 4 touched files
   - Result: all 4 show `w/crlf`; Node counts `CRLF 111 bareLF 0`, `CRLF 135 bareLF 0`, `CRLF 122 bareLF 0`, `CRLF 96 bareLF 0`, exit 0.

6. Gate G6 (Markdown diff sizes and placement):
   - Command: `git diff --numstat` for ADR, refactor log, ledger, and grep checks
   - Result: numstat `5 1` (ADR), `6 6` (refactor log), `2 1` (ledger); ADR hits at lines 3, 133, 135; ledger hits at lines 59, 65, 66 (done), 68; refactor log hits at lines 22, 33, exit 0.

7. Gate G7 (zero em dashes):
   - Command: `node -e "..."` across `.claude/settings.json`, ADR 0101, refactor log, task ledger, and build report
   - Result: `em dashes: 0`, exit 0.

8. Gate G8 (scope check):
   - Command: `git diff --stat; git status --porcelain`
   - Result: only 4 target files modified, plus untracked spec and build report (and gitignored logs), exit 0.

## Not done

- None. All edits from the spec were completed.
