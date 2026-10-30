# Spec T838: MASTER.md release and migration-check fixes, NO_COLOR in the build log rule

Phase 164, branch `phase-164-icm-neutral-stages` (cut from `main` at `3ae3327`). Item 3 of three and the task that ships the phase: T836 (role-only wording, now including MASTER.md lines 36, 44 and 69) and T837 (one stage-file skeleton, shell notes tagged `[generic]` or `[local]`) build and are committed first. All three specs are written before any build, so this spec anchors its stage 02 edit on the text T837's spec gives that file, and its MASTER.md edits on MASTER.md as T836's spec leaves it (section 4, Pins, says how both are pinned and reproduced).

Amended on the orchestrator's order after the owner's two amendments to T836 and T837 (the owner approved all three specs with them; no further pause): the MASTER.md pin is now the post-T836 text, the passages that said MASTER.md lines 36 and 44 stay as they are now say T836 makes them role-only, `R2` greps MASTER.md too, and the `NO_COLOR` sentence is now said to end a `[generic]` note.

## 1. Goal

(a) For a PR the owner merges, MASTER's `release` reports the PR link and stops, and the first merge wait runs only on `merged`, `status` or the next order, so the pane is not held while the owner reviews. (b) Under option B, a phase with a migration gets a manual owner check in place of the read-only `list_migrations` call in `merged` step 3b. (c) The build stage's log rule tells the builder to set `NO_COLOR`, because color codes in the builder's logs break `grep`.

## 2. Target files

```
workflow/orchestrator/MASTER.md
workflow/stages/02_build/CONTEXT.md
docs/audit/refactor-log.md
```

Bookkeeping (always allowed): `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T838-build.md`, `workflow/stages/02_build/output/logs/`.

- No ADR: doc-only edits to the orchestrator prompt and a stage file, which `AGENTS.md`'s Workflow section exempts ("Skip the process for typos, copy tweaks and doc-only edits"), as Phase 163's stage-file rule change had none. ADR 0116 describes `release` and `merged` only by name (`docs/audit/decisions/0116-orchestrator-prompts-in-the-repo.md:15`), so nothing in it goes stale.
- This task ships Phase 164, so it writes the phase's `refactor-log.md` entry. `docs/audit/baseline-metrics.md` is not a target: `AGENTS.md`'s Workflow section says a phase of doc-only tasks "adds no `baseline-metrics.md` section unless the bundle or test counts changed", and none of T836 to T838 changes either (Phase 163 did the same, `docs/audit/refactor-log.md:27`).
- `workflow/orchestrator/runtimes.md` is not a target: no line of it contradicts the fix (section 4). T836 edits its line 3 only.

## 3. Context to read

None (docs-only task). Read `workflow/orchestrator/MASTER.md` and `workflow/stages/02_build/CONTEXT.md` in full, the top of `docs/audit/refactor-log.md` down to the Phase 162 entry, the Phase 164 section of `docs/audit/task-ledger.md`, and this spec. Read `workflow/stages/01_spec/output/task-T836-spec.md` edits 9 to 11 or `task-T837-spec.md`'s stage 02 block only if an `R0` line fails.

## 4. Current behaviour

Line numbers are those of `3ae3327`. T836 replaces three whole MASTER.md lines (`:36`, `:44`, `:69`) and adds or removes none, so every MASTER.md number below also holds for the text T836 leaves.

### (a) `release` holds the pane for an owner-merged PR

- `workflow/orchestrator/MASTER.md:57`, release step 4: "Report the PR link and the merge mode, then go straight to the wait in `merged` below." It says this for both merge modes.
- `MASTER.md:58`, `merged`: "(runs by itself after `release`; also when I say `merged`)". One wait is "one blocking shell loop" of up to 9 minutes. For a hand merge it says "run one wait now, then again at the start of each later order and on `status`, and do not hold the pane": "now" is the wait that step 4 sends it to, which holds the pane for up to 9 minutes right after the PR opens, while the owner is still reviewing it.
- `MASTER.md:25`: a `task` order ending in `last` runs `release` in the same report, so that 9-minute wait lands at the end of the phase's last task report.
- `MASTER.md:72`: every report ends with `Your next step: <one action>`, and "merge PR #N on GitHub" is already one of its examples.
- Sibling text that must not contradict the fix, and does not after it:
  - `AGENTS.md:137` (Release, Otherwise): "it reports the PR link and the owner merges". The fix makes MASTER do exactly that.
  - `AGENTS.md:138` (Deploy record): "the orchestrator watches the PR with `gh pr view ...` and needs no `merged` order". Still true: after a hand-merge `release`, the wait runs at the start of any later order and on `status`, not only on `merged`. Neither bullet changes (T836 edits `AGENTS.md:3` and `:128-130` only).
  - `workflow/orchestrator/runtimes.md:29` (Waiting for the merge): Option A "`merged` polls `gh pr view`", Option B "None: `merged` runs on the owner's order". Option A still polls (auto-merge right away, a hand merge on the next order); no edit.
  - `workflow/orchestrator/loaders/fin-master.agent.md:76`: option B already runs only release step 1 (the push), ends the report with "then reply merged", and runs `merged` only on the owner's order, skipping its wait. The fix brings option A's hand-merge case to the same shape; the loader needs no edit.
  - `workflow/orchestrator/loaders/finlife.md` says nothing about `release` or `merged` beyond its preflight (`:17`, run `merged` for a merged phase with no deploy record); no edit.
  - `grep -rn 'straight to the wait\|runs by itself after\|hold the pane'` outside `docs/audit/archive/` and the gitignored logs finds only `MASTER.md:53`, `:57`, `:58`, T833's spec (history) and this spec. `MASTER.md:53` ("`release` (runs by itself after the commit of a `task` order ending in `last` ...)") stays true.

### (b) `merged` step 3b assumes a Supabase tool option B does not have

- `MASTER.md:66` (step 3b): after `applied`, "confirm the migration's name is in the read-only `list_migrations` result (project id from `list_projects`; never guess between projects)".
- Option B's orchestrator has only the tools in its frontmatter (`loaders/fin-master.agent.md:6-13`; `runtimes.md:25`): `view_file`, `write_to_file`, `replace_file_content`, `run_command`, `invoke_subagent`, `manage_subagents`, `send_message`. No MCP tool, so neither `list_projects` nor `list_migrations`. The T833 review flagged this (`workflow/stages/03_review/output/task-T833-review.md:64`, item (c)).
- `AGENTS.md:138` says a migration phase "waits for the owner's `applied` (checked with the read-only `list_migrations`)". The manual check reads the same migration history (the owner can run `list_migrations` from a session that has it, or read the dashboard), so the bullet stays true and does not change.
- At `3ae3327`, MASTER.md names a runtime on three lines (`:36` "agy can return", `:44` "running on agy / Gemini 3.8 Flash", `:69` "Claude Code usage"); T836 makes all three role-only (its edits 9 to 11), and its done-when grep (`Claude Code|agy|Gemini|Sonnet|Opus` over the stage files and MASTER.md) then prints nothing. This task keeps it that way: the new sentence names option B, a column of `runtimes.md`, not a runtime or model, points to `runtimes.md` for each orchestrator's tools, and is written as a condition on the runtime's tools, so it stays right if a runtime gains or loses the tool. `R2` runs the same pattern over MASTER.md and stage 02 after the edits.

### (c) Color codes in the builder's logs

- After T837, the log rule sits in `workflow/stages/02_build/CONTEXT.md` in four places (T837 spec section 4, "The log rule (for T838)"): step 5's sub-bullet "**Logs are UTF-8**, so `grep` can read them. This covers every file you write under `output/logs/` ...", then three notes under `## Shell notes`: `[generic]` "In Windows PowerShell 5.1, `>`, `>>` and `Tee-Object` write UTF-16 ...", `[local]` "Run the command through `cmd /c` instead, ..." and, last, `[generic]` "Use `| Out-File -Encoding utf8 <log>` only for a PowerShell cmdlet's own output ...", which ends "and with `2>&1` it wraps each stderr line in an error record." (T837 spec, stage 02 new text, the last Shell notes line). That closing phrase occurs once in T837's stage 02 text.
- Evidence, from the gitignored logs on this machine (counted with Node, byte `0x1b`):
  - The builder's full-suite logs carry ANSI color codes: `workflow/stages/02_build/output/logs/T830-unit.log` 4,102 escape bytes, `T831-unit.log` 2,524, `T832-unit.log` 3,432, `T832-build.log` 545 (vite). They were written in both shells: `T830-unit.log` is LF with no BOM (Git Bash `tee`), `T832-unit.log` starts with a UTF-8 BOM and `T831-unit.log` is UTF-16LE (PowerShell).
  - The codes split vitest's count line: in `T832-unit.log` it reads `ESC[2m      Tests ESC[22m ESC[1mESC[32m1625 passed...`, so `grep -c "Tests  *[0-9]* passed"` prints 0 and the Node test `/Tests\s+\d+ passed/` is false. That defeats the rule's own purpose ("so `grep` can read them").
  - The T834 builder set `$env:NO_COLOR = '1'` on its own (`workflow/stages/02_build/output/task-T834-build.md:21`, `:26`), and both its logs hold 0 escape bytes.
  - The reviewer's logs hold 0 escape bytes without `NO_COLOR`: every `workflow/stages/03_review/output/logs/*.log` checked, and a run of `npx vitest run unit/date-format.test.ts` today, both through `powershell.exe` and `cmd /c` and through Git Bash, wrote 0 with and without it. So the codes come from the builder's environment, not from the command forms.
- Decision: the note belongs in stage 02, as one more sentence at the end of its last Shell note, the `[generic]` note that starts "Use `| Out-File -Encoding utf8 <log>` only for a PowerShell cmdlet's own output". Why: (1) the log rule exists so `grep` can read the logs, and color codes break exactly the line a gate reads (the passed count); (2) the sentence is `[generic]` by the owner's rule (T837 spec section 7, "The tags"): it names `NO_COLOR`, PowerShell, `cmd /c`, Git Bash, vitest, vite and `grep`, and no FinLife path, npm script or FinLife-specific tool, and the T830 to T832 logs are cited as evidence, which that rule says does not make a sentence `[local]`; it joins the note that already says how PowerShell handles the tools' piped output; (3) appending to an existing note leaves T837's tag counts (4 `[generic]`, 1 `[local]`) and step numbers as they are. The T834 review called the prefix harmless and said "a later task should not depend on it" (`task-T834-review.md:48`); that review's own runs were the reviewer's, which never had color codes, so it did not see the builder-side failure above. Stage 03 gets no note (its logs are clean); see Out of scope.

### Guards

- No test or script reads `MASTER.md`, `runtimes.md`, the loaders or the stage files' text: `grep -rn 'MASTER\.md\|runtimes\.md\|list_migrations\|workflow/orchestrator'` over `unit/`, `scripts/`, `.github/` and `.claude/` finds nothing. `merged` appears only in `unit/pre-push-guard.test.ts:96` and `:190` (test names for the deploy-record push the hook allows; the push form does not change) and in two `.github/workflows/playwright.yml` comments about the merged Playwright report.
- `unit/workflow-hardening.test.ts` reads `AGENTS.md` (`:195-199`, the Release rule's "outside `docs/`, `anti-slop/` and `*.md`") and classifies stage-file paths as docs-only (`:170-178`); this task changes neither. It and `unit/pre-push-guard.test.ts` must still pass (Gate 3).
- T836's done-when (no `Claude Code|agy|Gemini|Sonnet|Opus` in the stage files and MASTER.md) must stay empty for MASTER.md and stage 02 (check `R2`; T838 touches no other file the grep reads).
- The three targets and the ledger are `i/lf w/crlf` in `git ls-files --eol`.

### Pins (the "before" text)

The orchestrator commits T836 and T837 on this branch before it sends `build T838`, so at build and review time `HEAD` holds both. Check `R0` proves the "before" text of each edited file:

- Stage 02: `git show HEAD:workflow/stages/02_build/CONTEXT.md` equals the stage 02 block of `workflow/stages/01_spec/output/task-T837-spec.md` (the second of its four `text` blocks) plus one final line break, CRLF normalised.
- MASTER.md: the "before" is MASTER.md as T836 leaves it, `3ae3327:workflow/orchestrator/MASTER.md` with T836's edits 9 to 11 applied, each a whole-line replacement of its Old text block by its New text block (`task-T836-spec.md`'s `text` blocks 17 to 22, in Old/New pairs). Its sha256, over the LF text as git stores it, is `ddf76415f70f...`; the full value is `PIN_MASTER` in the script. `R0` checks both halves: the script rebuilds that text from `3ae3327` and T836's committed spec and gets `PIN_MASTER` (this is how the builder and the reviewer reproduce the "before" text; nothing else is needed), and `HEAD:workflow/orchestrator/MASTER.md` hashes to `PIN_MASTER`.
- If any `R0` line fails, stop with `BLOCKED` and name the file; do not adapt the edits. `apply` writes nothing while an `R0` line fails.

## 5. Parity map

None.

## 6. Tests to add

None: the edits change an orchestrator prompt, a stage file and the refactor log, and cannot alter app or test behaviour. Stage 02 step 4 and stage 03 step 6 do not apply. The gate script checks that each edit landed exactly once and that nothing else in the two files changed.

## 7. Edits

Five text replacements, each Old text a fragment that occurs exactly once in its file. Do not type them: run `node <logs>/T838-gates.cjs apply` (Gate 1), which checks the `R0` pins, refuses if a file already differs from `HEAD` or an Old text does not occur exactly once, and otherwise writes both files with CRLF line endings. Then write the refactor-log entry and the ledger row by hand (below). The fourteen `text` blocks in this spec are, in order: the five Old/New pairs, the refactor-log brief, the refactor-log Deliberately not done line, the ledger Task cell, the ledger Files cell. The script finds them by position; this spec has no other `text` block.

### Edit 1: `MASTER.md` release step 4 (line 57)

Old text:

```text
4. Report the PR link and the merge mode, then go straight to the wait in `merged` below.
```

New text:

```text
4. Report the PR link and the merge mode. If auto-merge is on, go straight to the wait in `merged` below. If I merge it, stop there and end the report with `Your next step: merge PR #<n> on GitHub, then reply merged`: the first wait runs only when I say `merged` or `status`, or at the start of my next order.
```

### Edit 2: `MASTER.md` `merged` trigger (line 58)

Old text:

```text
(runs by itself after `release`; also when I say `merged`)
```

New text:

```text
(runs by itself after `release` when auto-merge is on; also when I say `merged`)
```

### Edit 3: `MASTER.md` `merged` hand-merge wait (line 58)

Old text:

```text
If I merge by hand, run one wait now, then again at the start of each later order and on `status`, and do not hold the pane.
```

New text:

```text
If I merge by hand, `release` ends without a wait: run one wait at the start of each later order, `merged` and `status` included, and do not hold the pane.
```

### Edit 4: `MASTER.md` `merged` step 3b (line 66)

Old text:

```text
into this same commit. One deploy-record commit per phase, never a second one.
```

New text:

```text
into this same commit. If your runtime has no read-only Supabase tool (option B today; workflow/orchestrator/runtimes.md lists each orchestrator's tools), skip `list_projects` and `list_migrations`: ask me to check that the migration's name is in the project's migration history and to reply with its history version, wait for my reply, and use that version in the apply note. One deploy-record commit per phase, never a second one.
```

### Edit 5: `workflow/stages/02_build/CONTEXT.md` Shell notes, end of the last `[generic]` note

Old text:

```text
with `2>&1` it wraps each stderr line in an error record.
```

New text:

```text
with `2>&1` it wraps each stderr line in an error record. Set `NO_COLOR` for every logged run, `$env:NO_COLOR='1'` before `cmd /c` in the same PowerShell call or `NO_COLOR=1` before the command in Git Bash: in the builder's runtime vitest and vite wrote ANSI color codes into the T830 to T832 logs, which split vitest's `Tests  N passed` line so `grep` missed it.
```

### Refactor-log entry (by hand, `docs/audit/refactor-log.md`)

Insert 11 lines immediately above the line that starts `## Phase 163 - Loader check and UTF-8 build logs`, and change nothing else in the file:

1. The heading `## Phase 164 - Runtime-neutral ICM stage files: T836-T838 (<date>, code `<sha>` to `<sha>`, merged `<sha>`)`, where `<date>` is the build day as `YYYY-MM-DD` and the three `<sha>` stay as written (the deploy record fills them).
2. A blank line.
3. The brief, exactly the block below.
4. A blank line.
5. `**Changed:** ` then, by stage 02's Outputs rule, `T836 (<files>)`, `T837 (<files>)` and `T838 (<files>)` joined by `; `. T836's and T837's files are each commit's `git show --stat <sha>` (find the commit with `git log --oneline 3ae3327..HEAD`; its subject names the task id), T838's are this task's `git status --porcelain`, all leaving out `workflow/stages/*/output/` files. Name each file by its path in backticks with a few words on what changed, as Phase 163's entry does; name `docs/audit/refactor-log.md` as "this file".
6. `**Verified:** ` then `T836 (<cell>); T837 (<cell>); T838 (<cell>)`, each `<cell>` that task's Gate result cell in `docs/audit/task-ledger.md`, copied word for word. Write the T836 and T837 parts before Gate 2; add the T838 part after it, once the T838 row is `done` (see Ledger).
7. `**Surprises:** ` then the items the T836 and T837 build and review reports and this task's build report name, numbered as in Phase 163's entry, or `none`.
8. The Deliberately not done line, exactly the block below.
9. A blank line.
10. `---`
11. A blank line.

Brief:

```text
No ADR (three docs-only edits, which AGENTS.md's Workflow section exempts). T836 makes the stage files, AGENTS.md and `workflow/orchestrator/MASTER.md` (its lines 36, 44 and 69: the builder wait, the BUILDER role prompt and `usage on`) name roles only, leaving the Roles table in `workflow/orchestrator/runtimes.md` as the one place that names a runtime or model; T837 gives the three stage files one skeleton and tags each shell note by the owner's rule, `[generic]` when it helps any project on the same platform (Windows, PowerShell 5.1, Git Bash) and `[local]` when it depends on FinLife's own files, tools or layout (four `[generic]`, one `[local]`), and has the review stage tag each rule candidate the same way; T838 makes an owner-merged `release` stop at the PR link instead of holding the pane in the merge wait, gives a runtime without a Supabase tool a manual migration check in `merged`, and adds `NO_COLOR` to the build stage's log rule, as the end of its last `[generic]` shell note.
```

Deliberately not done:

```text
**Deliberately not done:** the runtime and model names in the two loaders and in the `.claude/agents/` descriptions, which are runtime-specific by design (T836 covers the stage files, AGENTS.md and MASTER.md); rewording any stage-file sentence while moving it (T837); a unit test or CI guard for the role-only grep or the stage skeleton; `merged` step 2's Vercel and CI read checks under option B, which also assume tools its orchestrator lacks (T833 review); a `NO_COLOR` note in the review stage file (the reviewer's logs carry no color codes); any change to AGENTS.md's Release and Deploy record bullets, which already match the new `release` and `merged` text; a Phase 164 section in `baseline-metrics.md` (no bundle or test count changes); filling the `<sha>` placeholders in this heading and the Commit cells in `task-ledger.md`, left to the owner-approved post-merge deploy record.
```

### Ledger (bookkeeping)

Add the T838 row to `## Phase 164 - Runtime-neutral ICM stage files`, directly after the T837 row. Status `in-progress` while the gates run, then `done`; Commit empty; Gate result: Gate 1's `wrote` line, Gate 2's `bad` count and Gate 3's test files and tests passed. After setting `done`, copy that cell into the Verified line (step 6 above). Task cell:

```text
MASTER.md: an owner-merged `release` reports the PR link and stops, and the first merge wait runs on `merged`, `status` or the next order; `merged` step 3b gives a runtime without a Supabase tool (option B) a manual owner check; the build stage's log rule sets NO_COLOR; Phase 164 refactor-log entry
```

Files cell:

```text
`workflow/orchestrator/MASTER.md`, `workflow/stages/02_build/CONTEXT.md`, `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`
```

## 8. Gates

The docs-only tier runs nothing by itself, but the new text states paths and log facts, so the script checks them (`R9`); the owner adds the script and the two guard tests. Run from the repo root, in this order. `<logs>` is `workflow/stages/02_build/output/logs` for the builder and `workflow/stages/03_review/output/logs` for the reviewer. Save each gate's output as UTF-8 by stage 02's forms (`cmd /c '... > <log> 2>&1'` in PowerShell, `2>&1 | tee <log>` in Git Bash).

**Gate 0, save the script.** Extract the one `js` block below from this spec with a script, never by retyping, and save it as `<logs>/T838-gates.cjs`: `node -e "const s=require('fs').readFileSync('workflow/stages/01_spec/output/task-T838-spec.md','utf8').split('\r\n').join('\n');const F='\x60'.repeat(3);const m=s.match(new RegExp(F+'js\n([^]*?)\n'+F));require('fs').writeFileSync(process.argv[1],m[1]+'\n')" <logs>/T838-gates.cjs`.

**Gate 1, apply (builder only).** `node <logs>/T838-gates.cjs apply`, saved to `<logs>/T838-apply.log`. Expect the three `R0` lines `OK` and the last line `wrote 2 files`. Then write the refactor-log entry and the ledger row (section 7). The reviewer does not run Gate 1.

**Gate 2, the checks.** `node <logs>/T838-gates.cjs check`, saved to `<logs>/T838-check.log`. Expect every line `OK` (the builder's run also prints one `INFO` line for the T838 Verified copy, checked in the reviewer's run once the row is `done`) and the last line `bad 0`. Dry run in a scratch clone (T836 applied and committed, then T837, then T838 applied on top): 38 `OK` lines and 1 `INFO` line before the T838 row is `done`, 40 `OK` lines after (the second run also counts the build report's em dashes). It checks:

- R0: the pins (section 4): stage 02 at `HEAD` is T837's block; T836's edits 9 to 11 applied to `3ae3327:MASTER.md` give `PIN_MASTER`; MASTER.md at `HEAD` hashes to `PIN_MASTER`.
- R1: each file equals its `HEAD` text with the five edits applied, each New text occurs exactly once, and `git diff --numstat HEAD` reads `3 3` on MASTER.md (lines 57, 58 and 66; T836's lines 36, 44 and 69 are already in `HEAD`) and `1 1` on stage 02.
- R2: T836's done-when pattern matches no line of MASTER.md or stage 02.
- R3: the refactor-log entry has one Phase 164 heading in the section 7 form, it is the newest entry, directly above Phase 163, with the 11-line shape of section 7 (brief and Deliberately not done exactly as their blocks), and the file's diff is 11 added lines, 0 deleted.
- R4: the Changed line names every file of the T836 and T837 commits (outside `workflow/stages/*/output/`) and has a `T838 (` part that names `workflow/orchestrator/MASTER.md` and `workflow/stages/02_build/CONTEXT.md`; the Verified line holds `T836 (<cell>)` and `T837 (<cell>)` word for word, and `T838 (<cell>)` once the T838 row is `done`.
- R5: one T838 row, directly after the T837 row, with the Task and Files cells exactly as their blocks, Status `done` or `in-progress`, Commit empty.
- R6: 0 em dashes in the added diff lines of the targets and the ledger, and in this spec and the build report (when present).
- R7: every target and the ledger is `w/crlf` in `git ls-files --eol` and holds 0 bare LF.
- R8: `git status --porcelain -uall` lists only the three targets, `docs/audit/task-ledger.md` and the T838 spec, build and review files.
- R9: the facts the new text states: `T830-unit.log`, `T831-unit.log` and `T832-unit.log` in `workflow/stages/02_build/output/logs/` each hold escape bytes; `workflow/orchestrator/runtimes.md` exists and its option B Orchestrator tools cell names no MCP, Supabase or `list_migrations` tool; `AGENTS.md`'s Release and Deploy record bullets are unchanged since `3ae3327`.

**Gate 3, the guard tests.** `npx vitest run unit/workflow-hardening.test.ts unit/pre-push-guard.test.ts`, saved to `<logs>/T838-guards.log`. Expect 0 failed.

Gate script:

```js
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto');
const NL=String.fromCharCode(10),CR=String.fromCharCode(13),TAB=String.fromCharCode(9),F='`'.repeat(3),EM=String.fromCharCode(0x2014),ESC=String.fromCharCode(27);
const SPEC='workflow/stages/01_spec/output/task-T838-spec.md',BUILD='workflow/stages/02_build/output/task-T838-build.md',REVIEW='workflow/stages/03_review/output/task-T838-review.md',T836SPEC='workflow/stages/01_spec/output/task-T836-spec.md',T837SPEC='workflow/stages/01_spec/output/task-T837-spec.md';
const MASTER='workflow/orchestrator/MASTER.md',S02='workflow/stages/02_build/CONTEXT.md',RL='docs/audit/refactor-log.md',LEDGER='docs/audit/task-ledger.md',RT='workflow/orchestrator/runtimes.md',BASE='3ae3327';
// sha256 of MASTER.md as T836 leaves it (LF): 3ae3327 with T836's edits 9 to 11 applied as whole lines (spec section 4, Pins).
const PIN_MASTER='ddf76415f70f627698c7413bedb30bed43b7c626eeb84e7e1ea05964e06800c9';
const mode=process.argv[2]||'check';
const norm=s=>s.split(CR+NL).join(NL);
const raw=f=>fs.readFileSync(f,'utf8');
const git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8',maxBuffer:1<<28});
const cnt=(h,x)=>h.split(x).length-1;
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const textBlocks=f=>[...norm(raw(f)).matchAll(new RegExp(F+'text'+NL+'([^]*?)'+NL+F,'g'))].map(m=>m[1]);
let bad=0;
const out=(k,ok,v)=>{if(!ok)bad++;console.log((ok?'OK  ':'BAD ')+k+' '+v);};
const B=textBlocks(SPEC);
if(B.length!==14){console.log('BAD spec holds '+B.length+' text blocks, expected 14');process.exit(1);}
const EDITS=[MASTER,MASTER,MASTER,MASTER,S02].map((f,i)=>({f,o:B[2*i],n:B[2*i+1],k:'edit '+(i+1)}));
const [RL_BRIEF,RL_NOT,L_TASK,L_FILES]=B.slice(10);
const head=f=>norm(git('show','HEAD:'+f));
// Apply every edit of file f to text t; each Old text must occur exactly once.
const applyAll=(f,t)=>{for(const e of EDITS.filter(e=>e.f===f)){const c=cnt(t,e.o);if(c!==1)return {err:e.k+' old text occurs '+c+' times in '+f};t=t.replace(e.o,()=>e.n);}return {t};};
const t837=textBlocks(T837SPEC);
out('R0 HEAD '+S02+' is the T837 spec text',t837.length===4&&head(S02)===t837[1]+NL,'blocks '+t837.length);
{const b=fs.existsSync(T836SPEC)?textBlocks(T836SPEC):[];let t=NL+norm(git('show',BASE+':'+MASTER)),ok=b.length===22;
  if(ok)for(const i of [8,9,10]){const o=NL+b[2*i]+NL;if(cnt(t,o)!==1){ok=false;break;}t=t.replace(o,()=>NL+b[2*i+1]+NL);}
  const d=ok?sha(t.slice(1)):'';out('R0 T836 edits 9 to 11 on '+BASE+':'+MASTER+' give PIN_MASTER',d===PIN_MASTER,d?d.slice(0,12):'not derived, T836 blocks '+b.length);}
{const h=sha(head(MASTER));out('R0 HEAD '+MASTER+' is MASTER.md as T836 leaves it',h===PIN_MASTER,h.slice(0,12));}
if(mode==='apply'){
  if(bad){console.log('bad '+bad+', nothing written');process.exit(1);}
  const res=[MASTER,S02].map(f=>{const w=norm(raw(f));if(w!==head(f))return {f,err:f+' already differs from HEAD'};return {f,...applyAll(f,w)};});
  const err=res.filter(r=>r.err);if(err.length){err.forEach(r=>console.log('BAD '+r.err));console.log('nothing written');process.exit(1);}
  res.forEach(r=>fs.writeFileSync(r.f,r.t.split(NL).join(CR+NL)));console.log('wrote '+res.length+' files');process.exit(0);}
for(const f of [MASTER,S02]){const r=applyAll(f,head(f));out('R1 text landed '+f,!r.err&&norm(raw(f))===r.t,r.err||'');}
for(const e of EDITS){const c=cnt(norm(raw(e.f)),e.n);out('R1 '+e.k+' new text once',c===1,c);}
for(const [f,w] of [[MASTER,'3 3'],[S02,'1 1']]){const ns=git('diff','--numstat','HEAD','--',f).trim().split(TAB).slice(0,2).join(' ');out('R1 numstat '+f,ns===w,ns||'unchanged');}
{const RX=/Claude Code|agy|Gemini|Sonnet|Opus/;for(const f of [MASTER,S02]){const h=norm(raw(f)).split(NL).map((l,i)=>RX.test(l)?i+1:0).filter(Boolean);out('R2 runtime names (T836 done-when) in '+f,h.length===0,h.join(',')||'none');}}
const rl=norm(raw(RL)).split(NL);
const HRX=/^## Phase 164 - Runtime-neutral ICM stage files: T836-T838 \(\d{4}-\d{2}-\d{2}, code `<sha>` to `<sha>`, merged `<sha>`\)$/;
const hi=rl.map((l,i)=>HRX.test(l)?i:-1).filter(i=>i>=0),h=hi[0],s=hi.length===1?rl.slice(h,h+11):[];
const p163=rl.findIndex(l=>l.startsWith('## Phase 163 - '));
out('R3 one Phase 164 heading',hi.length===1,hi.length);
out('R3 newest entry, directly above Phase 163',hi.length===1&&rl.findIndex(l=>/^## Phase \d/.test(l))===h&&p163===h+11,'heading '+h+' phase163 '+p163);
out('R3 entry shape',s.length===11&&s[1]===''&&s[2]===RL_BRIEF&&s[3]===''&&s[4].startsWith('**Changed:** T836 (')&&s[5].startsWith('**Verified:** T836 (')&&s[6].startsWith('**Surprises:** ')&&s[7]===RL_NOT&&s[8]===''&&s[9]==='---'&&s[10]==='','');
{const ns=git('diff','--numstat','HEAD','--',RL).trim().split(TAB);out('R3 refactor-log adds 11 lines, deletes 0',ns[0]==='11'&&ns[1]==='0',ns.slice(0,2).join(' '));}
const L=norm(raw(LEDGER)).split(NL);
const rows=id=>L.filter(l=>l.startsWith('| '+id+' |'));
const cells=l=>l.split('|').slice(1,-1).map(x=>x.trim());
const chg=s[4]||'',ver=s[5]||'';
const OUTRX=/^workflow\/stages\/[^/]+\/output\//;
const log=git('log','--format=%H%x09%s',BASE+'..HEAD').split(NL).filter(Boolean).map(l=>l.split(TAB));
for(const id of ['T836','T837']){const shas=log.filter(x=>x[1].includes(id)).map(x=>x[0]);const paths=[...new Set(shas.flatMap(c=>git('show','--name-only','--format=',c).split(NL).filter(Boolean)))].filter(p=>!OUTRX.test(p));const miss=paths.filter(p=>!chg.includes(p));out('R4 Changed names every '+id+' file',shas.length>0&&paths.length>0&&miss.length===0,shas.length+' commits, missing '+(miss.join(', ')||'none'));}
{const p=chg.indexOf('T838 ('),t=p<0?'':chg.slice(p);out('R4 Changed has a T838 part naming '+MASTER+' and '+S02,t.includes(MASTER)&&t.includes(S02),'');}
for(const id of ['T836','T837','T838']){const r=rows(id),c=r.length===1?cells(r[0]):[];if(id==='T838'&&c[3]!=='done'){console.log('INFO R4 T838 Verified copy is checked once its row is done');continue;}out('R4 Verified copies the '+id+' Gate result cell',r.length===1&&!!c[5]&&ver.includes(id+' ('+c[5]+')'),'');}
{const r=rows('T838'),c=r.length===1?cells(r[0]):[];out('R5 one T838 row',r.length===1,r.length);
  const i7=L.findIndex(l=>l.startsWith('| T837 |')),i8=L.findIndex(l=>l.startsWith('| T838 |'));out('R5 T838 row directly after T837',i7>=0&&i8===i7+1,i7+' '+i8);
  out('R5 T838 cells',c[1]===L_TASK&&c[2]===L_FILES&&(c[3]==='done'||c[3]==='in-progress')&&c[4]==='','status '+c[3]+' commit '+JSON.stringify(c[4]));}
const T=[MASTER,S02,RL,LEDGER];
const added=git('diff','-U0','HEAD','--',...T).split(NL).filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join(NL);
out('R6 em dash added lines',cnt(added,EM)===0,cnt(added,EM));
for(const f of [SPEC,BUILD])if(fs.existsSync(f))out('R6 em dash '+f,cnt(raw(f),EM)===0,cnt(raw(f),EM));
for(const f of T){const r=raw(f),eol=git('ls-files','--eol','--',f),b=cnt(r,NL)-cnt(r,CR+NL);out('R7 '+f,eol.includes('w/crlf')&&b===0,'w/crlf='+eol.includes('w/crlf')+' bareLF='+b);}
const allowed=[...T,SPEC,BUILD,REVIEW];
const extra=git('status','--porcelain','-uall').split(NL).filter(Boolean).map(l=>l.slice(3)).filter(p=>!allowed.includes(p));
out('R8 scope',extra.length===0,extra.join(', ')||'clean');
for(const id of ['T830','T831','T832']){const f='workflow/stages/02_build/output/logs/'+id+'-unit.log';const e=fs.existsSync(f)?cnt(fs.readFileSync(f,'latin1'),ESC):-1;out('R9 '+f+' holds color codes',e>0,e);}
{const row=norm(raw(RT)).split(NL).find(l=>l.startsWith('| Orchestrator tools |'))||'';const b=row.split('|')[3]||'';out('R9 option B orchestrator has no Supabase tool',!!b.trim()&&!/mcp|supabase|list_migrations/i.test(b),'');}
{const pick=t=>norm(t).split(NL).filter(l=>l.startsWith('- **Release:**')||l.startsWith('  - **Auto-merge:**')||l.startsWith('  - **Otherwise**')||l.startsWith('- **Deploy record:**')).join(NL);const a=pick(git('show',BASE+':AGENTS.md')),n=pick(raw('AGENTS.md'));out('R9 AGENTS.md Release and Deploy record unchanged',!!a&&a===n,'');}
console.log('bad '+bad);
process.exit(bad?1:0);
```

## 9. Production touch points

None on `AGENTS.md`'s Stop and ask first list: no SQL, no `/api/*` request, no MCP or CLI write, no `vercel.json` or `.github/workflows/` edit. The new step 3b text asks the owner to read the migration history; it runs nothing on live itself. The pause-list consequences of the targets (`workflow/orchestrator/MASTER.md` and a `workflow/stages/*/CONTEXT.md` file, both on `AGENTS.md`'s ICM pause list):

- The owner has already given the go-ahead for all three Phase 164 specs, this amendment included; the orchestrator sends `build T838` (after the T836 and T837 commits) without another pause.
- The strict reviewer reviews T838.
- At Release, the Phase 164 PR is not auto-merged: the orchestrator reports the PR link and the owner merges it.
- Point for the owner: the orchestrator read MASTER.md at its session start, so the Phase 164 release itself may still follow the old step 4 (straight into the merge wait) unless the orchestrator rereads `workflow/orchestrator/MASTER.md` after the T838 commit.

## 10. Out of scope

- `workflow/orchestrator/MASTER.md:36`, `:44` and `:69` (the builder wait, the BUILDER role prompt and `usage on`): T836 makes them role-only (its edits 9 to 11), and this task neither touches nor rewords them; `R0` pins them as T836 leaves them, and `R1`'s numstat proves T838 changes only lines 57, 58 and 66.
- `merged` step 2 (Vercel and CI read checks), which option B's tools also cannot run (T833 review item (c)): not in the owner's order; listed under Deliberately not done.
- `workflow/orchestrator/runtimes.md` (its Waiting for the merge and Orchestrator tools rows stay true, section 4), both loaders, `AGENTS.md` (Release and Deploy record bullets must not change; `R9` checks), `CLAUDE.md`, `.claude/agents/*`, `.claude/settings.json`.
- Any other line of MASTER.md, including `:53` (`release` trigger, still true), the `status` bullet at `:47` (the `merged` text already says a wait runs on `status`), the wait loop itself and the `FAILED` / `CLOSED` / `waiting` handling.
- Any other sentence of stage 02, step 5's `**Logs are UTF-8**` sub-bullet included (the sentence ends the last `[generic]` Shell note instead, so T837's tag counts and step numbers stay), any tag, and stage 01 and stage 03 (no `NO_COLOR` note: the reviewer's logs carry no color codes).
- `docs/audit/baseline-metrics.md` (section 2), any ADR, the ledger's Backlog and its size note, and converting or deleting any existing log.
