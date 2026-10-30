# Spec T836: role-only stage files, AGENTS.md and MASTER.md

Phase 164, branch `phase-164-icm-neutral-stages` (cut from `main` at `3ae3327`). Item 1 of three: T837 (one shared skeleton for the three stage files) and T838 (MASTER.md fixes) are separate tasks, spec'd in parallel. T837 restructures the text this task leaves, so T836 changes wording only, one whole line per edit, and moves or reorders nothing.

Amended on the owner's order (the owner approved the specs with this amendment): T836 also makes `workflow/orchestrator/MASTER.md` role-only, and the done-when grep covers it. Edits 9 to 11 and the MASTER.md parts of sections 4, 8, 9 and 10 are the amendment; edit 8's New text now names MASTER.md too.

## 1. Goal

The stage files (`workflow/stages/*/CONTEXT.md`), `AGENTS.md` and `workflow/orchestrator/MASTER.md` talk about roles only (orchestrator, reviewer, strict reviewer, builder). The Roles table in `workflow/orchestrator/runtimes.md` is the one place that names the runtime or model behind a role. Done when `grep -nE 'Claude Code|agy|Gemini|Sonnet|Opus' workflow/stages/*/CONTEXT.md workflow/orchestrator/MASTER.md` prints nothing. No line is kept for the word-for-word reason (section 4 says why), so the expected set of matching lines is empty and Gate 3's G1 checks exactly that.

## 2. Target files

```
workflow/stages/01_spec/CONTEXT.md
workflow/stages/02_build/CONTEXT.md
workflow/stages/03_review/CONTEXT.md
AGENTS.md
workflow/orchestrator/runtimes.md
workflow/orchestrator/MASTER.md
```

Bookkeeping (always allowed): `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T836-build.md`, `workflow/stages/02_build/output/logs/`.

No ADR: a doc-only workflow edit, which `AGENTS.md`'s Workflow section exempts ("Skip the process for typos, copy tweaks and doc-only edits"); it changes no rule, only who the text names. Not the phase's shipping task (T838 is last), so `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md` are not targets.

## 3. Context to read

None (docs-only task). Read `AGENTS.md`, the three stage files, `workflow/orchestrator/runtimes.md` and `workflow/orchestrator/MASTER.md` in full.

## 4. Current behaviour

- `workflow/stages/01_spec/CONTEXT.md:3`: "**Agent:** the reviewer, Claude Code."
- `workflow/stages/02_build/CONTEXT.md:5`: "**Agent:** the builder, agy (Gemini 3.8 Flash)." and "The reviewer (Claude Code) handles".
- `workflow/stages/03_review/CONTEXT.md:3`: "**Agent:** the reviewer, Claude Code." and "The builder (agy) handles".
- These are the only stage-file lines the owner's grep matches today (it prints `01_spec/CONTEXT.md:3`, `02_build/CONTEXT.md:5`, `03_review/CONTEXT.md:3`).
- `AGENTS.md:3`: "(Claude Code reads it through `CLAUDE.md`)". `AGENTS.md:128` and `:130`: "reviewer (Claude Code)". `AGENTS.md:129`: "builder (agy)". The same grep on `AGENTS.md` matches only these four lines. `GEMINI_API_KEY` at `AGENTS.md:144` is an env var name and does not match (the grep is case-sensitive); it stays.
- `AGENTS.md`'s Tiered verification gates section (lines 74 to 95) already names roles only (builder, reviewer); nothing there moves.
- `workflow/orchestrator/MASTER.md`: the grep matches exactly three lines, `:36`, `:44` and `:69`; no other line of the file matches.
  - `:36`, section 4's builder wait: "agy can return before it has finished." It is MASTER's own instruction, not a prompt it sends. The option B loader narrows this step by reference only ("Builder waits (MASTER.md section 4)", `loaders/fin-master.agent.md:67`) and quotes none of its words.
  - `:44`, section 5's BUILDER role prompt: "You are BUILDER (running on agy / Gemini 3.8 Flash)." Both loaders send this line verbatim: option A inside double quotes in Git Bash (`loaders/finlife.md:27-28`, `herdr agent prompt fin-builder "<role prompt>"`), option B without its enclosing double quotes in a single-quoted PowerShell here-string (`loaders/fin-master.agent.md:49-55`). Neither loader copies its text; both read it from MASTER.md section 5, so a changed line stays consistent with them by construction. Decision: role-only is safe. The parenthetical tells the builder nothing it needs to act (its role, reads, writes and STATUS line are all in the rest of the prompt), and the builder is the same agent under both options (`runtimes.md:15`), so no runtime needs its name in the prompt. The new text must hold no `"`, backtick or `$` between its enclosing quotes, since option A sends it inside a Bash double-quoted string (Gate 3's G5 checks this).
  - `:69`, the `usage on` procedure: "snapshot Claude Code usage with `npx ccusage@latest session --json`". It is MASTER's own instruction, not a prompt it sends. `runtimes.md:30` (Usage tracking row) already says which option `ccusage` serves, and `loaders/fin-master.agent.md:80` already narrows `usage on` for option B, so the line can point to that row instead of naming the runtime.
  - Nothing else quotes these three lines: a repo-wide grep for `running on agy`, `You are BUILDER`, `agy can return` and `Claude Code usage` (outside `docs/audit/archive/`) finds them only in history (`workflow/stages/01_spec/output/task-T833-spec.md`) and in gitignored logs (`workflow/stages/02_build/output/logs/T828-finlife.md.orig`, `workflow/stages/03_review/output/logs/T828-gates.log`). No file in `unit/`, `scripts/`, `.github/` or `.claude/` reads MASTER.md (T838's spec, section 4, records the same grep).
- `workflow/orchestrator/runtimes.md:10-15` already holds the Roles table: Orchestrator (MASTER), Light reviewer, Strict reviewer, Builder, each with its agent and model under Option A and Option B. Every fact the edits drop is already in it: the reviewers run on Claude Code under Option A (`:13`, `:14`), the builder is agy on Gemini 3.8 Flash (`:15`), and `ccusage` serves option A only (`:30`). `runtimes.md:3` says it is "the one file in the repo meant to name the agents and models behind each role", but no line says the stage files, `AGENTS.md` and MASTER.md defer to it. The loaders (`workflow/orchestrator/loaders/`) are runtime-specific by design and stay.
- The fact at `AGENTS.md:3` (a runtime that reads `CLAUDE.md` gets `AGENTS.md` through its `@AGENTS.md` import, `CLAUDE.md:6`) can be said without a runtime name, so it stays in `AGENTS.md`, reworded, and adds nothing to `runtimes.md`.
- Guards that read these files: `unit/workflow-hardening.test.ts:195-199` reads `AGENTS.md` and expects the Release rule's text "outside `docs/`, `anti-slop/` and `*.md`" (untouched here); `:170-178` only classifies the paths `AGENTS.md` and `workflow/stages/01_spec/CONTEXT.md` as docs-only, without reading them. `.github/workflows/playwright.yml:31` names `AGENTS.md` in a comment only. Nothing in `scripts/` reads any target (`grep -rnlE 'workflow/stages|AGENTS\.md|runtimes\.md' unit scripts` lists only `unit/workflow-hardening.test.ts`).
- All six targets and the ledger are `i/lf w/crlf` in `git ls-files --eol`.

## 5. Parity map

None.

## 6. Tests to add

None: the edits change doc wording only and cannot alter app or test behaviour. Stage 02 step 4 and stage 03 step 6 do not apply. Gate 1 is the owner's grep, and Gate 3's script checks the same pattern on every target that must be role-only.

## 7. Edits

Eleven whole-line replacements. Each Old text block is one existing line, exactly as it stands; replace it with its New text block. Change nothing else in any file: no other line, no reordering, no added or removed line. Keep CRLF line endings.

### Edit 1: `workflow/stages/01_spec/CONTEXT.md` line 3

Old text:

```text
**Agent:** the reviewer, Claude Code. It writes specs and reviews only; it never edits app code, tests or config. **Order:** `spec <id>: <description> (stage file: workflow/stages/01_spec/CONTEXT.md)`, sent by the orchestrator (herdr). The spec's Goal comes from the description. The other orders are `build <id> (stage file: <path>)` and `fix <id> (stage file: <path>)` (builder, stage 02) and `review <id> (stage file: <path>)` (reviewer, stage 03).
```

New text:

```text
**Agent:** the reviewer (the light or the strict reviewer; `workflow/orchestrator/runtimes.md` names the agent and model behind each role). It writes specs and reviews only; it never edits app code, tests or config. **Order:** `spec <id>: <description> (stage file: workflow/stages/01_spec/CONTEXT.md)`, sent by the orchestrator (herdr). The spec's Goal comes from the description. The other orders are `build <id> (stage file: <path>)` and `fix <id> (stage file: <path>)` (builder, stage 02) and `review <id> (stage file: <path>)` (reviewer, stage 03).
```

### Edit 2: `workflow/stages/02_build/CONTEXT.md` line 5

Old text:

```text
**Agent:** the builder, agy (Gemini 3.8 Flash). **Orders:** `build <id> (stage file: workflow/stages/02_build/CONTEXT.md)` and `fix <id> (stage file: workflow/stages/02_build/CONTEXT.md)`, sent by the orchestrator (herdr). The reviewer (Claude Code) handles `spec <id>: <description> (stage file: <path>)` (stage 01) and `review <id> (stage file: <path>)` (stage 03).
```

New text:

```text
**Agent:** the builder (`workflow/orchestrator/runtimes.md` names the agent and model behind each role). **Orders:** `build <id> (stage file: workflow/stages/02_build/CONTEXT.md)` and `fix <id> (stage file: workflow/stages/02_build/CONTEXT.md)`, sent by the orchestrator (herdr). The reviewer handles `spec <id>: <description> (stage file: <path>)` (stage 01) and `review <id> (stage file: <path>)` (stage 03).
```

### Edit 3: `workflow/stages/03_review/CONTEXT.md` line 3

Old text:

```text
**Agent:** the reviewer, Claude Code. It writes specs and reviews only; it never edits app code, tests or config (step 6's stash, or its temporary test edit for a test-only task, is the one allowed exception). **Order:** `review <id> (stage file: workflow/stages/03_review/CONTEXT.md)`, sent by the orchestrator (herdr). The builder (agy) handles `build <id> (stage file: <path>)` and `fix <id> (stage file: <path>)` (stage 02); the reviewer also handles `spec <id>: <description> (stage file: <path>)` (stage 01).
```

New text:

```text
**Agent:** the reviewer (the light or the strict reviewer; `workflow/orchestrator/runtimes.md` names the agent and model behind each role). It writes specs and reviews only; it never edits app code, tests or config (step 6's stash, or its temporary test edit for a test-only task, is the one allowed exception). **Order:** `review <id> (stage file: workflow/stages/03_review/CONTEXT.md)`, sent by the orchestrator (herdr). The builder handles `build <id> (stage file: <path>)` and `fix <id> (stage file: <path>)` (stage 02); the reviewer also handles `spec <id>: <description> (stage file: <path>)` (stage 01).
```

### Edit 4: `AGENTS.md` line 3

Old text:

```text
The one rule file for every agent in this repo (Claude Code reads it through `CLAUDE.md`). It wins over any skill's or tool's defaults. Domain detail lives in `docs/contexts/`; read only the file your task needs.
```

New text:

```text
The one rule file for every agent in this repo (`CLAUDE.md` imports it, so a runtime that reads `CLAUDE.md` reads this file too). It wins over any skill's or tool's defaults. Domain detail lives in `docs/contexts/`; read only the file your task needs.
```

### Edit 5: `AGENTS.md` line 128

Old text:

```text
  - `spec <id>: <description> (stage file: workflow/stages/01_spec/CONTEXT.md)`: reviewer (Claude Code). The spec's Goal comes from the description.
```

New text:

```text
  - `spec <id>: <description> (stage file: workflow/stages/01_spec/CONTEXT.md)`: reviewer. The spec's Goal comes from the description.
```

### Edit 6: `AGENTS.md` line 129

Old text:

```text
  - `build <id> (stage file: workflow/stages/02_build/CONTEXT.md)` and `fix <id> (stage file: workflow/stages/02_build/CONTEXT.md)`: builder (agy)
```

New text:

```text
  - `build <id> (stage file: workflow/stages/02_build/CONTEXT.md)` and `fix <id> (stage file: workflow/stages/02_build/CONTEXT.md)`: builder
```

### Edit 7: `AGENTS.md` line 130

Old text:

```text
  - `review <id> (stage file: workflow/stages/03_review/CONTEXT.md)`: reviewer (Claude Code)
```

New text:

```text
  - `review <id> (stage file: workflow/stages/03_review/CONTEXT.md)`: reviewer
```

### Edit 8: `workflow/orchestrator/runtimes.md` line 3

Old text:

```text
Which agent, model, tools and shell play each role of the ICM workflow under the two ways the owner runs it (ADR 0101, Phase 140 amendment; ADR 0116). The rules live in AGENTS.md, the stage files and workflow/orchestrator/MASTER.md; this file says only who runs them and with what. It is the one file in the repo meant to name the agents and models behind each role.
```

New text:

```text
Which agent, model, tools and shell play each role of the ICM workflow under the two ways the owner runs it (ADR 0101, Phase 140 amendment; ADR 0116). The rules live in AGENTS.md, the stage files and workflow/orchestrator/MASTER.md; this file says only who runs them and with what. It is the one file in the repo meant to name the agents and models behind each role. AGENTS.md, the stage files (workflow/stages/*/CONTEXT.md) and workflow/orchestrator/MASTER.md name roles only, the orchestrator, the light reviewer, the strict reviewer and the builder; the Roles table below gives each role its agent and model.
```

### Edit 9: `workflow/orchestrator/MASTER.md` line 36 (section 4, builder wait)

Old text:

```text
- agy can return before it has finished. Wait with one blocking shell loop per wait: it reads `herdr agent read fin-builder --source recent-unwrapped --lines 80` every 30 s inside the shell, prints nothing until a line containing `STATUS: <task-id>` appears or 9 minutes pass, then prints only that line, or `still running`. Rerun it if still running, up to the order's timeout. Never poll from your own turns, and never send the next order before the STATUS line appears. If the STATUS line looks cut off, read the build output file instead.
```

New text:

```text
- The builder can return before it has finished (`workflow/orchestrator/runtimes.md` names its agent). Wait with one blocking shell loop per wait: it reads `herdr agent read fin-builder --source recent-unwrapped --lines 80` every 30 s inside the shell, prints nothing until a line containing `STATUS: <task-id>` appears or 9 minutes pass, then prints only that line, or `still running`. Rerun it if still running, up to the order's timeout. Never poll from your own turns, and never send the next order before the STATUS line appears. If the STATUS line looks cut off, read the build output file instead.
```

### Edit 10: `workflow/orchestrator/MASTER.md` line 44 (section 5, BUILDER role prompt, sent verbatim)

Only the opening parenthetical changes. The new parenthetical holds no `"`, backtick or `$`.

Old text:

```text
"You are BUILDER (running on agy / Gemini 3.8 Flash). Act ONLY as the build agent. On startup, read only AGENTS.md and workflow/stages/02_build/CONTEXT.md, then wait for an order. Orders come from an orchestrator: 'build <task-id>' or 'fix <task-id>', each naming its stage file. Follow workflow/stages/02_build/CONTEXT.md: read the spec, the docs/contexts files it names, and every target file and its tests in full before editing; sub-agents may only read and explore, never edit files or run commands that write; you make all edits yourself and run the spec's gate commands once, after all edits are done. Allowed writes: the files listed in the spec, docs/audit/task-ledger.md and workflow/stages/02_build/output/. Write your report to workflow/stages/02_build/output/task-<task-id>-build.md, and append fix rounds to that same file. Leave the ledger's Commit cell empty. Never use MCP write tools, never read docs/audit/archive/, never sign in on the dev server, never run anything on the AGENTS.md Stop and ask first list, never commit, push or merge. On 'fix <task-id>', fix only the blocking items in the newest round of workflow/stages/03_review/output/task-<task-id>-review.md, then rerun the gates and recheck every blocking item from earlier rounds of the same task. In your build output, list every file you changed. If the spec is missing or unclear, report BLOCKED with your question. After each order, wait for the next one. End every reply with exactly one line: STATUS: <task-id> | BUILT / FIXED / BLOCKED | <files changed count, or the reason when BLOCKED>"
```

New text:

```text
"You are BUILDER (workflow/orchestrator/runtimes.md names your agent and model). Act ONLY as the build agent. On startup, read only AGENTS.md and workflow/stages/02_build/CONTEXT.md, then wait for an order. Orders come from an orchestrator: 'build <task-id>' or 'fix <task-id>', each naming its stage file. Follow workflow/stages/02_build/CONTEXT.md: read the spec, the docs/contexts files it names, and every target file and its tests in full before editing; sub-agents may only read and explore, never edit files or run commands that write; you make all edits yourself and run the spec's gate commands once, after all edits are done. Allowed writes: the files listed in the spec, docs/audit/task-ledger.md and workflow/stages/02_build/output/. Write your report to workflow/stages/02_build/output/task-<task-id>-build.md, and append fix rounds to that same file. Leave the ledger's Commit cell empty. Never use MCP write tools, never read docs/audit/archive/, never sign in on the dev server, never run anything on the AGENTS.md Stop and ask first list, never commit, push or merge. On 'fix <task-id>', fix only the blocking items in the newest round of workflow/stages/03_review/output/task-<task-id>-review.md, then rerun the gates and recheck every blocking item from earlier rounds of the same task. In your build output, list every file you changed. If the spec is missing or unclear, report BLOCKED with your question. After each order, wait for the next one. End every reply with exactly one line: STATUS: <task-id> | BUILT / FIXED / BLOCKED | <files changed count, or the reason when BLOCKED>"
```

### Edit 11: `workflow/orchestrator/MASTER.md` line 69 (section 6, `usage on`)

Old text:

```text
- `usage on` / `usage off` (off by default; only when I say `usage on`): for every task, snapshot Claude Code usage with `npx ccusage@latest session --json`, filtered in the shell so only your own session's numbers enter your context, never the full JSON. Sub-agent transcripts are stored under your session; report reviewer usage separately when the files allow it, otherwise say it is combined with yours. Record input, output, cache read, cache write, model and cost, plus task, reviewer used, review rounds and builder waits. Put a short table in each task report, keep the running log in ~/finlife-usage/phase-<n>.md outside the repo, and print it in full on `usage report` or `merged`. If measuring fails, say so once and carry on.
```

New text:

```text
- `usage on` / `usage off` (off by default; only when I say `usage on`): for every task, snapshot usage with `npx ccusage@latest session --json` (the Usage tracking row in `workflow/orchestrator/runtimes.md` names the runtime it reads), filtered in the shell so only your own session's numbers enter your context, never the full JSON. Sub-agent transcripts are stored under your session; report reviewer usage separately when the files allow it, otherwise say it is combined with yours. Record input, output, cache read, cache write, model and cost, plus task, reviewer used, review rounds and builder waits. Put a short table in each task report, keep the running log in ~/finlife-usage/phase-<n>.md outside the repo, and print it in full on `usage report` or `merged`. If measuring fails, say so once and carry on.
```

### Note the builder copies into its report

Copy this sentence into `task-T836-build.md`: "No MASTER.md line was kept for the word-for-word reason: the BUILDER role prompt (MASTER.md:44) is sent verbatim, but nothing in it needs the runtime's name, both loaders read it from MASTER.md section 5 without quoting it, and the new parenthetical holds no double quote, backtick or dollar sign. A builder already running keeps its old role prompt until the next `reset` or spawn."

### Ledger (bookkeeping)

Add the section below `## Phase 163` (after the T835 row) and above `## Backlog`, from the ledger's template:

- Heading: `## Phase 164 - Runtime-neutral ICM stage files`
- Line under it: ``Branch `phase-164-icm-neutral-stages`, cut from `main` at `3ae3327`. Tasks T836, T837 and T838. No migration.``
- T836 row, Task cell: `Stage files, AGENTS.md and MASTER.md name roles only (orchestrator, reviewer, strict reviewer, builder); runtimes.md's Roles table is the one place that names a runtime or model`; Files cell: `` `workflow/stages/01_spec/CONTEXT.md`, `workflow/stages/02_build/CONTEXT.md`, `workflow/stages/03_review/CONTEXT.md`, `AGENTS.md`, `workflow/orchestrator/runtimes.md`, `workflow/orchestrator/MASTER.md`, `docs/audit/task-ledger.md` ``; Commit empty.

If T837's or T838's builder already created the section, add only the T836 row to it.

## 8. Gates

The docs-only tier runs nothing by itself, but the new text names a path and role rows, and the owner adds the grep and the guard test. Run from the repo root, in this order. `<logs>` is `workflow/stages/02_build/output/logs` for the builder and `workflow/stages/03_review/output/logs` for the reviewer. Save each gate's output as UTF-8 by stage 02 step 5's forms (`cmd /c '... > <log> 2>&1'` in PowerShell, `| tee <log>` in Git Bash).

**Gate 0, save the gate script.** Extract the "Gate script" block below from this spec with a script (the one `js` fenced block), never by retyping, and save it as `<logs>/T836-gates.cjs`.

**Gate 1, the owner's grep (the done-when).** Expect no output lines and `exit=1` (grep found nothing). Reviewer, in Git Bash:

```
grep -nE 'Claude Code|agy|Gemini|Sonnet|Opus' workflow/stages/*/CONTEXT.md workflow/orchestrator/MASTER.md; echo exit=$?
```

Builder, from PowerShell (Git's `grep.exe`, the three files the glob expands to plus MASTER.md, since PowerShell does not expand a glob for a native command; prints `exit=1` when nothing matches):

```
& 'C:\Program Files\Git\usr\bin\grep.exe' -nE 'Claude Code|agy|Gemini|Sonnet|Opus' workflow/stages/01_spec/CONTEXT.md workflow/stages/02_build/CONTEXT.md workflow/stages/03_review/CONTEXT.md workflow/orchestrator/MASTER.md; 'exit=' + $LASTEXITCODE
```

**Gate 2, the guard test.** `npx vitest run unit/workflow-hardening.test.ts`, saved to `<logs>/T836-workflow-hardening.log`. Expect 0 failed.

**Gate 3, the checks.** `node <logs>/T836-gates.cjs`, saved to `<logs>/T836-gates.log`. Expect every line `OK` and the last line `bad 0`. It checks:

- G1: in each of the three stage files and MASTER.md, the list of line numbers the Gate 1 pattern matches equals its expected list exactly. Every expected list is empty (no line is kept, section 4); a kept line would have to be named in `KEEP`, never skipped.
- G2: the same pattern matches no line of `AGENTS.md`.
- G3 text landed: this spec holds 22 `text` blocks; for each edit, its Old text occurs 0 times and its New text exactly once as a whole line in its file (CRLF normalised).
- G4 diff shape: `git diff --numstat HEAD` reads `1 1` on each stage file and on `runtimes.md`, `4 4` on `AGENTS.md` and `3 3` on MASTER.md.
- G5 paths and roles: `workflow/orchestrator/runtimes.md` (named in edits 1 to 3 and 9 to 11) exists, its Roles table has exactly one row each for `Orchestrator (MASTER)`, `Light reviewer`, `Strict reviewer` and `Builder`, and it has one `| Usage tracking |` row (named in edit 11); edit 10's New text starts and ends with `"` and holds no `"`, backtick or `$` in between (option A's loader sends it inside a Bash double-quoted string).
- G6 em dashes: 0 in the added diff lines of the targets and the ledger, and 0 in this spec and the build report (when present).
- G7 line endings: every target and the ledger is `w/crlf` in `git ls-files --eol` and holds 0 bare LF.
- G8 scope: `git status --porcelain -uall` lists only the six targets, `docs/audit/task-ledger.md`, the T836 spec, build and review files, and the T837 and T838 spec files (spec'd in parallel). Any other file, including any other T837 or T838 file, fails the gate. Logs are gitignored and do not show.

Gate script:

```js
const fs=require('fs'),cp=require('child_process');
const F='`'.repeat(3),NL=String.fromCharCode(10),CR=String.fromCharCode(13),TAB=String.fromCharCode(9),EM=String.fromCharCode(0x2014);
const SPEC='workflow/stages/01_spec/output/task-T836-spec.md',BUILD='workflow/stages/02_build/output/task-T836-build.md',REVIEW='workflow/stages/03_review/output/task-T836-review.md';
const S1='workflow/stages/01_spec/CONTEXT.md',S2='workflow/stages/02_build/CONTEXT.md',S3='workflow/stages/03_review/CONTEXT.md',AG='AGENTS.md',RT='workflow/orchestrator/runtimes.md',MA='workflow/orchestrator/MASTER.md',LEDGER='docs/audit/task-ledger.md';
const EDITS=[S1,S2,S3,AG,AG,AG,AG,RT,MA,MA,MA];
const NUM={[S1]:'1 1',[S2]:'1 1',[S3]:'1 1',[AG]:'4 4',[RT]:'1 1',[MA]:'3 3'};
// Lines kept for the word-for-word reason, by file. None today (spec section 4).
const KEEP={[S1]:[],[S2]:[],[S3]:[],[MA]:[]};
const norm=s=>s.split(CR+NL).join(NL);
const raw=f=>fs.readFileSync(f,'utf8');
const cnt=(h,x)=>h.split(x).length-1;
const sh=c=>cp.execSync(c,{encoding:'utf8',maxBuffer:1<<28});
let bad=0;
const out=(k,ok,v)=>{if(!ok)bad++;console.log((ok?'OK  ':'BAD ')+k+' '+v);};
const RX=/Claude Code|agy|Gemini|Sonnet|Opus/;
const hits=f=>norm(raw(f)).split(NL).map((l,i)=>[i+1,l]).filter(p=>RX.test(p[1])).map(p=>p[0]);
for(const f of Object.keys(KEEP)){const h=hits(f).join(','),k=KEEP[f].join(',');out('G1 '+f,h===k,'lines '+(h||'none')+' expected '+(k||'none'));}
{const h=hits(AG);out('G2 '+AG,h.length===0,h.length?'lines '+h.join(','):'none');}
const blocks=[...norm(raw(SPEC)).matchAll(new RegExp(F+'text'+NL+'([^]*?)'+NL+F,'g'))].map(m=>m[1]);
const nb=blocks.length===EDITS.length*2;
out('G3 blocks',nb,blocks.length);
if(nb)EDITS.forEach((f,i)=>{const t=NL+norm(raw(f));const o=cnt(t,NL+blocks[2*i]+NL),n=cnt(t,NL+blocks[2*i+1]+NL);out('G3 edit '+(i+1)+' '+f,o===0&&n===1,'old '+o+' new '+n);});
for(const f of Object.keys(NUM)){const ns=sh('git diff --numstat HEAD -- '+f).trim().split(TAB).slice(0,2).join(' ');out('G4 numstat '+f,ns===NUM[f],ns||'unchanged');}
out('G5 exists '+RT,fs.existsSync(RT),fs.existsSync(RT));
const rt=NL+norm(raw(RT));
for(const r of ['Orchestrator (MASTER)','Light reviewer','Strict reviewer','Builder','Usage tracking'])out('G5 row '+r,cnt(rt,NL+'| '+r+' |')===1,cnt(rt,NL+'| '+r+' |'));
if(nb){const rp=blocks[2*9+1];out('G5 role prompt is shell-safe',rp.startsWith('"')&&rp.endsWith('"')&&!/["`$]/.test(rp.slice(1,-1)),'');}
const T=[S1,S2,S3,AG,RT,MA,LEDGER];
const added=sh('git diff -U0 HEAD -- '+T.join(' ')).split(NL).filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join(NL);
out('G6 em dash added lines',cnt(added,EM)===0,cnt(added,EM));
for(const f of [SPEC,BUILD])if(fs.existsSync(f))out('G6 em dash '+f,cnt(raw(f),EM)===0,cnt(raw(f),EM));
for(const f of T){const r=raw(f),eol=sh('git ls-files --eol -- '+f);const bare=cnt(r,NL)-cnt(r,CR+NL);out('G7 '+f,eol.includes('w/crlf')&&bare===0,'w/crlf='+eol.includes('w/crlf')+' bareLF='+bare);}
const allowed=[...T,SPEC,BUILD,REVIEW,SPEC.replace('T836','T837'),SPEC.replace('T836','T838')];
const extra=sh('git status --porcelain -uall').split(NL).filter(Boolean).map(l=>l.slice(3)).filter(p=>!allowed.includes(p));
out('G8 scope',extra.length===0,extra.length?extra.join(', '):'clean');
console.log('bad '+bad);
process.exit(bad?1:0);
```

## 9. Production touch points

None on `AGENTS.md`'s Stop and ask first list: no SQL, no `/api/*` request, no MCP or CLI write, no `vercel.json` or `.github/workflows/` edit. The pause-list consequences of the targets (`AGENTS.md`, `workflow/orchestrator/runtimes.md`, `workflow/orchestrator/MASTER.md` and three `workflow/stages/*/CONTEXT.md` files, all on `AGENTS.md`'s ICM pause list):

- The owner has already given the go-ahead for `build T836` with this amendment; the orchestrator sends it without another pause.
- The strict reviewer reviews T836.
- At Release, the Phase 164 PR is not auto-merged: the orchestrator reports the PR link and the owner merges it.
- Point for the owner: the orchestrator read MASTER.md at its session start, and the builder pane already running got the old role prompt. Both keep the old wording (same behaviour) until the orchestrator rereads MASTER.md and the builder is reset or respawned.

## 10. Out of scope

- Every line of the targets other than the eleven above, including the stage files' shell notes ("the agents' Git Bash" in `01_spec/CONTEXT.md:50-51`, Windows PowerShell 5.1 in `02_build/CONTEXT.md:27`; T837 tags them), "the orchestrator (herdr)" and "Under herdr" (herdr is the workflow's harness, not a runtime or model), and the order and headings of every section (T837 restructures them).
- In MASTER.md, every line but `:36`, `:44` and `:69`, in particular T838's anchors (`:57`, `:58`, `:66`) and the agent names `fin-builder`, light reviewer and strict reviewer, which name roles, not runtimes.
- File and path names that happen to carry a runtime's name: `CLAUDE.md`, `GEMINI.md` (`02_build/CONTEXT.md:48`), `.claude/agents/`, `.claude/settings.json` (also `MASTER.md:78`), and the `GEMINI_API_KEY` env var (`AGENTS.md:144`). They name files, not who plays a role. Also `AGENTS.md:140`'s "(in auto mode, on the classifier)", which names no runtime.
- Renaming the `Light reviewer` row of `runtimes.md` to `Reviewer`, or any other edit to its tables: MASTER.md and both loaders say "light reviewer".
- `workflow/orchestrator/loaders/*` (runtime-specific by design; they read the role prompt from MASTER.md section 5 and quote none of the changed lines), `CLAUDE.md`, `.claude/agents/*`, `docs/contexts/*.md` (no match today), and ADRs in `docs/audit/decisions/` (history).
- The other Phase 164 specs: this task edits neither. Its MASTER.md edits (`:36`, `:44`, `:69`, whole lines, no line added or removed) do not overlap T838's edit anchors (`:57`, `:58`, `:66`), but T838's spec needs amending before `build T838`: its `R0` pin "HEAD MASTER.md unchanged since `3ae3327`" fails once T836 is committed (and its `apply` mode then writes nothing); its section 4 sentence "MASTER.md names no runtime today", its section 10 first bullet and its Deliberately not done refactor-log block still describe `:36` and `:44` as left alone. The orchestrator routes that amendment.
- A lint guard or unit test that runs the grep in CI: not asked for.
- `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` (T838 ships the phase), the ledger's Backlog and its size note.
