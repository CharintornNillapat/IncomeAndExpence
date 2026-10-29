# Build Report - T826

## 1. Summary of Changes

Phase 157 (`phase-157-auto-merge-permission`): narrowed the `gh pr merge` deny rule in `.claude/settings.json` and added `.claude/settings.json` and `.github/workflows/` to the automatic pause and Release lists in `AGENTS.md`.

- In `.claude/settings.json`:
  - Added `allow` array under `permissions` with `Bash(gh pr merge * --auto --merge*)` and `PowerShell(gh pr merge * --auto --merge*)`.
  - Replaced blanket `Bash(gh pr merge:*)` with specific denies for `--squash*`, `--rebase*`, `--admin*`, `-s*`, and `-r*`.
  - Replaced blanket `PowerShell(gh pr merge:*)` with specific denies for `--squash*`, `--rebase*`, `--admin*`, `-s*`, and `-r*`.
- In `AGENTS.md`:
  - Line 130 (Pause after the spec): added `.github/workflows/` and `.claude/settings.json` to the automatic pause list.
  - Line 134 (Release, Otherwise): added `.github/workflows/` and `.claude/settings.json` to the manual merge list.
- In `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`:
  - Added Phase 157 amendment documenting the permission rule change and the automatic pause additions.
- In `docs/audit/task-ledger.md`:
  - Added Phase 157 section with branch details and T826 task row marked as `done` with full gate verification results.
- In `docs/audit/refactor-log.md`:
  - Added Phase 157 refactor log entry with Changed, Verified, Surprises, and Deliberately not done sections.

## 2. Files Changed (5 files)

1. `.claude/settings.json` (modified)
2. `AGENTS.md` (modified)
3. `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md` (modified)
4. `docs/audit/refactor-log.md` (modified)
5. `docs/audit/task-ledger.md` (modified bookkeeping)

## 3. Tests Added and Fail-then-Pass Evidence

Per spec section 6, `tests to add: none` (Claude Code permission file and Markdown edits; runtime application code and test suites are not affected).

### Fail-then-Pass Evidence

1. **Gate 4 Text-Landed Control Check:**
   - Pre-edit control run: `blocks 10 bad 10` (exit 1).
   - Post-edit run: `blocks 10 bad 0` (exit 0). All 10 spec-asserted blocks matched expected counts (8 landed blocks count 1, 2 gone blocks count 0).

2. **Gate 6 Command Permission Matching Model:**
   - Pre-edit control run: `mismatches 8` (exit 1; all 7 commands denied in Bash and PowerShell on HEAD).
   - Post-edit run: `mismatches 0` (exit 0). All 14 commands evaluated exactly per section 4 outcome matrix (allow on auto-merge forms, deny on squash/rebase/admin/short flags, prompt on bare/merge forms).

## 4. Verification Gates Run

### Gate 1: Named Paths Exist
- Command: `ls -d .claude/settings.json .github/workflows AGENTS.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`
- Result: all 4 paths exist and listed.

### Gate 2: Settings Diff Shape
- Command: `git diff --numstat -- .claude/settings.json && git diff -U0 -- .claude/settings.json | grep -E '^-[^-]'`
- Output:
  - `14	2	.claude/settings.json`
  - `-      "Bash(gh pr merge:*)",`
  - `-      "PowerShell(gh pr merge:*)",`
- Result: clean, exactly 14 additions and 2 removals.

### Gate 3: Rule Lists Against HEAD
- Command: `node -e "const fs=require('fs');const cp=require('child_process');const r0=JSON.parse(cp.execSync('git show HEAD:.claude/settings.json',{encoding:'utf8'}));const h=r0.permissions;const root=JSON.parse(fs.readFileSync('.claude/settings.json','utf8'));const w=root.permissions;const f=['--squash*','--rebase*','--admin*','-s*','-r*'];const exp=[];for(const r of h.deny){if(r==='Bash(gh pr merge:*)'||r==='PowerShell(gh pr merge:*)'){const t=r.split('(')[0];for(const x of f)exp.push(t+'(gh pr merge* '+x+')')}else exp.push(r)}const al=['Bash(gh pr merge * --auto --merge*)','PowerShell(gh pr merge * --auto --merge*)'];const ok=JSON.stringify(exp)===JSON.stringify(w.deny)&&JSON.stringify(h.ask)===JSON.stringify(w.ask)&&JSON.stringify(al)===JSON.stringify(w.allow)&&Object.keys(w).join()==='allow,deny,ask'&&JSON.stringify({...root,permissions:0})===JSON.stringify({...r0,permissions:0});console.log('allow',(w.allow||[]).length,'deny',w.deny.length,'ask',w.ask.length,ok?'OK':'MISMATCH');process.exit(ok?0:1)"`
- Output: `allow 2 deny 99 ask 11 OK` (exit 0).

### Gate 4: Text Landed Script
- Command: `node -e "const fs=require('fs');const t=fs.readFileSync(process.argv[1],'utf8').split(String.fromCharCode(96).repeat(3));let bad=0,n=0;for(let i=1;i<t.length;i+=2){const l=t[i-1].trim().split('\n').pop();const L=l.startsWith('**Landed in '),G=l.startsWith('**Gone from ');if(!L&&!G)continue;const f=l.slice(12).split(',')[0];const b=t[i].split('\n').slice(1,-1).join('\n');const c=fs.readFileSync(f,'utf8').split('\r\n').join('\n');const k=c.split(b).length-1;const w=L?1:0;n++;console.log(f,k,'want',w);if(k!==w)bad++}console.log('blocks',n,'bad',bad);process.exit(bad||n!==10?1:0)" workflow/stages/01_spec/output/task-T826-spec.md`
- Output: `blocks 10 bad 0` (exit 0).

### Gate 5: Schema Validation
- Command:
  ```bash
  L=workflow/stages/02_build/output/logs
  curl -sSL -o "$L/claude-code-settings.schema.json" https://json.schemastore.org/claude-code-settings.json
  node -e "const Ajv=require('ajv');const fs=require('fs');const a=new Ajv({strict:false,allErrors:true});const v=a.compile(JSON.parse(fs.readFileSync(process.argv[1],'utf8')));const ok=v(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));console.log(ok?'valid':'INVALID '+JSON.stringify(v.errors));process.exit(ok?0:1)" "$L/claude-code-settings.schema.json" .claude/settings.json 2>&1 | tee "$L/T826-settings-schema.log"
  ```
- Output: `valid` (exit 0). Log written to `workflow/stages/02_build/output/logs/T826-settings-schema.log`.

### Gate 6: Command Model
- Command: `node -e "const p=JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')).permissions;const m=(pat,s)=>{const q=pat.endsWith(':*')?pat.slice(0,-2)+' *':pat;const a=q.split('*');if(a.length===1)return s===q;if(!s.startsWith(a[0]))return false;let i=a[0].length;for(let k=1;k<a.length-1;k++){const j=s.indexOf(a[k],i);if(j<0)return false;i=j+a[k].length}const z=a[a.length-1];return s.length-i>=z.length&&s.endsWith(z)};const d=(t,c)=>{for(const k of ['deny','ask','allow'])for(const r of p[k]||[])if(r.startsWith(t+'(')&&r.endsWith(')')&&m(r.slice(t.length+1,-1),c))return k;return 'prompt'};const C=['gh pr merge 108 --auto --merge','gh pr merge 108 --auto --merge 2>&1','gh pr merge 108','gh pr merge 108 --merge','gh pr merge 108 -s','gh pr merge 108 --admin --auto --merge','gh pr merge --squash 108'];const E=['allow','allow','prompt','prompt','deny','deny','deny'];let bad=0;for(const t of ['Bash','PowerShell'])C.forEach((c,i)=>{const o=d(t,c);if(o!==E[i])bad++;console.log(t,'|',c,'|',o)});console.log('mismatches',bad);process.exit(bad?1:0)"`
- Output: 14 lines matching section 4 table, `mismatches 0` (exit 0).

### Gate 7: Line Endings and Line Counts
- Command:
  ```bash
  git ls-files --eol .claude/settings.json AGENTS.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/refactor-log.md docs/audit/task-ledger.md
  node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');console.log(f,'CRLF',(s.match(/\r\n/g)||[]).length,'bareLF',(s.match(/(^|[^\r])\n/g)||[]).length)}" .claude/settings.json AGENTS.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/refactor-log.md docs/audit/task-ledger.md
  git diff --numstat -- AGENTS.md
  ```
- Output:
  - `w/crlf` on all 5 files.
  - `.claude/settings.json CRLF 123 bareLF 0`
  - `AGENTS.md CRLF 140 bareLF 0`
  - `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md CRLF 156 bareLF 0`
  - `docs/audit/refactor-log.md CRLF 132 bareLF 0`
  - `docs/audit/task-ledger.md CRLF 150 bareLF 0`
  - `2	2	AGENTS.md`

### Gate 8: Zero Em Dashes
- Command:
  ```bash
  node -e "const fs=require('fs');let n=0;for(const f of process.argv.slice(1)){fs.readFileSync(f,'utf8').split('\n').forEach((l,i)=>{if(l.includes(String.fromCharCode(8212))){n++;console.log(f+':'+(i+1))}})}console.log('em dashes:',n);process.exit(n?1:0)" .claude/settings.json AGENTS.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/refactor-log.md docs/audit/task-ledger.md workflow/stages/02_build/output/task-T826-build.md
  node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split(String.fromCharCode(8212)).length-1)"
  ```
- Output: `em dashes: 0`, `0` (exit 0).

### Gate 9: Working Tree Scope Check
- Command: `git diff --stat; git status --porcelain`
- Output:
  - 5 files changed in git diff (`.claude/settings.json`, `AGENTS.md`, ADR `0101`, `refactor-log.md`, `task-ledger.md`).
  - Untracked files: spec `task-T826-spec.md` and build report `task-T826-build.md`.
  - Logs in gitignored `workflow/stages/02_build/output/logs/`.

### Gate 10: Workflow Hardening Unit Test
- Command: `npx vitest run unit/workflow-hardening.test.ts`
- Output: `Test Files 1 passed (1)`, `Tests 17 passed (17)` in 337ms (exit 0).

## 5. Deliberately Not Done

- No unit test locks the settings rules, per the owner's decision at the pause.
- No deny rule added for `-R`/`--repo` in Bash or for combined short flags such as `-ds`.
- `-d`/`--delete-branch` flag following `--auto --merge` remains allowed via trailing wildcard `*`.
- Other shell wrappers or spellings (`sh -c`, `gh api`) are not matched, as warned in Claude Code permissions documentation.
- No other edits to `AGENTS.md` (Auto-merge text, Stop and ask first, test counts remain unchanged).
- No auto-merge for this pull request (merged by the owner by hand per spec instructions).
- No `baseline-metrics.md` section added (bundle and test counts are unchanged).
- Empty `Commit` cell in `docs/audit/task-ledger.md` and `<sha>` placeholders in `docs/audit/refactor-log.md` heading left for the owner-approved post-merge deploy record.
