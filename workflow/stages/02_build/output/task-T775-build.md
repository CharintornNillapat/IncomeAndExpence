# Build report: T775

Phase 138: Run the reviewer as Claude Code project sub-agents fin-reviewer (Sonnet) and fin-reviewer-strict (Opus); .claude/agents/ joins the automatic-pause list (ADR 0101 amendment). This task ships Phase 138.

## Files changed (5 target files + task-ledger.md)

1. `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`:
   - Appended Phase 138 amendment at the end of the file after Phase 130 release section, preceded by one blank line.
   - Item 1 records that from Phase 139 the reviewer runs as Claude Code project sub-agents `fin-reviewer` (model `sonnet`) and `fin-reviewer-strict` (model `opus`), replacing the reviewer pane and per-task steps.
   - Item 2 records that a spec whose Target files include anything under `.claude/agents/` joins the automatic-pause list.
   - Kept CRLF and ends with single CRLF (+5 lines net in git diff).

2. `.claude/agents/fin-reviewer.md` (new):
   - Created project sub-agent configuration for `fin-reviewer` with model `sonnet`, tools `Read, Grep, Glob, Bash, Write, Edit`.
   - Markdown body contains the exact role prompt adapted from the orchestrator's standing order, plus final-message, BLOCKED, git, secrets, /api/*, MCP-write and no-sub-agent rules.
   - Exactly 10 lines, 10 CRLF, 0 bare LF.

3. `.claude/agents/fin-reviewer-strict.md` (new):
   - Created project sub-agent configuration for `fin-reviewer-strict` with model `opus`, tools `Read, Grep, Glob, Bash, Write, Edit`.
   - Differs from `fin-reviewer.md` only in `name`, `description` and `model`.
   - Exactly 10 lines, 10 CRLF, 0 bare LF.

4. `AGENTS.md`:
   - Line 128: updated automatic-pause list to include `.claude/agents/` (`anything under \`supabase/\`, \`api/\` or \`.claude/agents/\`, \`AGENTS.md\`,`).
   - Exactly 1 line modified (1 1 in `git diff --numstat`).

5. `docs/audit/refactor-log.md`:
   - Inserted Phase 138 entry above Phase 137, followed by `---` and blank lines.
   - Recorded Changed, Verified (word-for-word copy of task-ledger Gate result), Surprises (`none`), and Deliberately not done.

6. `docs/audit/task-ledger.md` (bookkeeping):
   - Created `## Phase 138 - Reviewer sub-agents: two Claude Code project sub-agents replace the reviewer pane (ADR 0101 amendment)` section above `## Backlog`.
   - Branch line: `Branch \`phase-138-reviewer-subagents\`, cut from \`main\` at \`f5b05cd\`.`
   - Added T775 row with Status `done`, empty `Commit` cell, and full gate result summary.

## Tests to add

None. The task adds agent config and docs and changes no app code, test or build path (spec section 6). Gate G1 verifies the text against the spec's code blocks.

## Gate commands and results

1. Gate G1 (Text landed from spec blocks):
   - Command:
     ```sh
     node -e '
     const fs=require("fs");
     const read=f=>fs.readFileSync(f,"utf8").replace(/\r\n/g,"\n");
     const spec=read("workflow/stages/01_spec/output/task-T775-spec.md");
     const B={};
     for (const m of spec.matchAll(/<!-- block: (\S+) -->\n```text\n([\s\S]*?)\n```/g)) B[m[1]]=m[2];
     let bad=0;
     const agents={"fin-reviewer":".claude/agents/fin-reviewer.md","fin-reviewer-strict":".claude/agents/fin-reviewer-strict.md"};
     for (const [k,f] of Object.entries(agents)) { const ok=read(f)===B[k]+"\n"; console.log(f,"whole-file match",ok); if(!ok) bad++; }
     for (const f of Object.values(agents)) { const n=read(f).split(B["role-prompt"]).length-1; console.log(f,"role-prompt occurrences",n); if(n!==1) bad++; }
     const once={"agents-pause":"AGENTS.md","adr-amendment":"docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md"};
     for (const [k,f] of Object.entries(once)) { const n=read(f).split(B[k]).length-1; console.log(f,k,"occurrences",n); if(n!==1) bad++; }
     const old=read("AGENTS.md").split(B["agents-pause-old"]).length-1; console.log("AGENTS.md agents-pause-old occurrences",old); if(old!==0) bad++;
     for (const f of Object.values(agents)) { const w=read(f).split("wait for the next one").length-1; console.log(f,"wait-sentence occurrences",w); if(w!==0) bad++; }
     process.exit(bad?1:0);'
     ```
   - Result:
     ```
     .claude/agents/fin-reviewer.md whole-file match true
     .claude/agents/fin-reviewer-strict.md whole-file match true
     .claude/agents/fin-reviewer.md role-prompt occurrences 1
     .claude/agents/fin-reviewer-strict.md role-prompt occurrences 1
     AGENTS.md agents-pause occurrences 1
     docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md adr-amendment occurrences 1
     AGENTS.md agents-pause-old occurrences 0
     .claude/agents/fin-reviewer.md wait-sentence occurrences 0
     .claude/agents/fin-reviewer-strict.md wait-sentence occurrences 0
     ```
     Exit code: 0.

2. Gate G2 (Agent files differ only in name, description and model):
   - Command:
     ```sh
     node -e 'const fs=require("fs");const a=fs.readFileSync(".claude/agents/fin-reviewer.md","utf8").split(/\r?\n/),b=fs.readFileSync(".claude/agents/fin-reviewer-strict.md","utf8").split(/\r?\n/);console.log(a.length===b.length,a.map((l,i)=>l===b[i]?null:l.split(":")[0]).filter(Boolean).join(","))'
     ```
   - Result:
     ```
     true name,description,model
     ```

3. Gate G3 (Git sees the agent files):
   - Commands:
     ```sh
     git check-ignore -v -n .claude/agents/fin-reviewer.md .claude/agents/fin-reviewer-strict.md; echo "exit=$?"
     git status --porcelain --untracked-files=all -- .claude/agents/
     ```
   - Result:
     ```
     ::	.claude/agents/fin-reviewer.md
     ::	.claude/agents/fin-reviewer-strict.md
     exit=1
     ?? .claude/agents/fin-reviewer-strict.md
     ?? .claude/agents/fin-reviewer.md
     ```

4. Gate G4 (Scope):
   - Commands:
     ```sh
     git status --porcelain
     git status --porcelain -- src unit tests api supabase scripts public index.html vercel.json package.json package-lock.json .github .gitignore .claude/settings.json workflow/stages/01_spec/CONTEXT.md workflow/stages/02_build/CONTEXT.md workflow/stages/03_review/CONTEXT.md
     git diff --numstat -- AGENTS.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md
     ```
   - Result:
     ```
      M AGENTS.md
      M docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md
      M docs/audit/refactor-log.md
      M docs/audit/task-ledger.md
     ?? .claude/agents/
     ?? workflow/stages/01_spec/output/task-T775-spec.md
     ?? workflow/stages/02_build/output/task-T775-build.md
     ```
     Protected paths check: printed nothing (0 unannounced modifications).
     Numstat check:
     ```
     1	1	AGENTS.md
     5	0	docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md
     ```

5. Gate G5 (Line endings):
   - Commands:
     ```sh
     git ls-files --eol AGENTS.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/refactor-log.md docs/audit/task-ledger.md
     node -e 'for(const f of process.argv.slice(1)){const s=require("fs").readFileSync(f,"utf8");const c=s.split("\r\n").length-1;console.log(f,"crlf",c,"bare-lf",s.split("\n").length-1-c)}' .claude/agents/fin-reviewer.md .claude/agents/fin-reviewer-strict.md
     ```
   - Result:
     ```
     i/lf    w/crlf  attr/                 	AGENTS.md
     i/lf    w/crlf  attr/                 	docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md
     i/lf    w/crlf  attr/                 	docs/audit/refactor-log.md
     i/lf    w/crlf  attr/                 	docs/audit/task-ledger.md
     .claude/agents/fin-reviewer.md crlf 10 bare-lf 0
     .claude/agents/fin-reviewer-strict.md crlf 10 bare-lf 0
     ```

6. Gate G6 (Paths named in the new text exist):
   - Command:
     ```sh
     ls AGENTS.md CLAUDE.md docs/audit/archive workflow/stages/01_spec/CONTEXT.md workflow/stages/03_review/CONTEXT.md workflow/stages/01_spec/output workflow/stages/03_review/output .claude/agents/fin-reviewer.md .claude/agents/fin-reviewer-strict.md
     ```
   - Result: All paths resolved without error, no missing files.

7. Gate G7 (No em dashes):
   - Commands:
     ```sh
     node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
     node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" .claude/agents/fin-reviewer.md .claude/agents/fin-reviewer-strict.md workflow/stages/02_build/output/task-T775-build.md
     ```
   - Result:
     - Added lines in diff: `0`.
     - File checks: `0` em dashes across `.claude/agents/fin-reviewer.md`, `.claude/agents/fin-reviewer-strict.md`, and `workflow/stages/02_build/output/task-T775-build.md`.

## Deliberately not done

- The stage files and the rest of `AGENTS.md`: no line names the reviewer pane or its `/clear`, `/model` or role-prompt steps (spec 4.3, 10).
- `.gitignore`: does not hide `.claude/agents/` (spec 4.2, 10).
- The orchestrator's own configuration and notes, which live outside the repo.
- A check that Claude Code loads the two agents: no CLI lists them; the first Phase 139 order proves it.
- `docs/audit/baseline-metrics.md`: no bundle or test count changed (ADR 0101, Phase 126 amendment 3).
- Did not commit or push.
