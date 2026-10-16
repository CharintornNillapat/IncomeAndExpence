# T754 spec: Phase 128 workflow tune-up (per-task build reports, short orders, automatic pause, automatic commit)

Phase 128 (`phase-128-workflow-automation`, at `88cc32b`, the same commit as `main`). T754 is the phase's only task, so it ships the phase. Docs and one agent-settings file only: no `src/`, test, migration or `api/` change.

## 1. Goal

Cut the owner's round trips per task, in four changes:

1. Each task gets its own build report, `workflow/stages/02_build/output/task-<id>-build.md`, and fix rounds append to it. The old `build-report.md` stays as the last shared report.
2. A one-line goal or a reference to a ledger Backlog row counts as a complete spec order.
3. After the spec, the orchestrator pauses for the owner only when the spec touches a risky area or lists a production touch point. Otherwise it goes on without asking.
4. The orchestrator commits each APPROVED task on the phase branch by itself, staging only that task's files. Pushing still needs the owner's push order, and merging stays with the owner. `.claude/settings.json` loses only the ask rule for the env-prefixed commit form.

## 2. Target files

```
AGENTS.md
workflow/stages/01_spec/CONTEXT.md
workflow/stages/02_build/CONTEXT.md
workflow/stages/03_review/CONTEXT.md
docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md
.claude/settings.json
docs/audit/refactor-log.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (see Edit L) and `workflow/stages/02_build/output/*`. Write this task's build report to `workflow/stages/02_build/output/task-T754-build.md`, the new form, because this task introduces it. **Do not touch `workflow/stages/02_build/output/build-report.md`**: it is tracked, holds T753's report, and stays as it is.

No new ADR. These are workflow-rule changes, like Phase 126's, so they go into ADR `0101`'s Amendments, as the order says. `docs/audit/refactor-log.md` is listed because T754 ships Phase 128. `docs/audit/baseline-metrics.md` is **not** listed: a phase made only of doc-only tasks adds no metrics section unless the bundle or test counts change (`AGENTS.md:116`), and neither changes here.

## 3. Context to read

None. This is a docs and agent-settings task, and `AGENTS.md`'s routing table says a docs-only change needs no context file. Read `AGENTS.md` in full and the target files in full.

## 4. Current behaviour

Each claim was checked on `88cc32b`. All seven target files use CRLF line endings and end with a newline; keep both.

**Build report**

1. `workflow/stages/02_build/CONTEXT.md:28`: step 7 writes `workflow/stages/02_build/output/build-report.md`. `:30`: "`build-report.md` is overwritten by each `build <id>`; a `fix <id>` appends a `## Fix round N` section to it."
2. `workflow/stages/02_build/CONTEXT.md:16` is a bookkeeping-file list: "`docs/audit/task-ledger.md` and `workflow/stages/02_build/output/*` (full-suite logs go in `output/logs/`, which git ignores)."
3. `workflow/stages/03_review/CONTEXT.md:8`: step 2 reads `workflow/stages/02_build/output/build-report.md`. `:9` is a bookkeeping-file list: "(`docs/audit/task-ledger.md`, `workflow/stages/02_build/output/*`)". `:24`: BLOCKED when there is "no build report".
4. `workflow/stages/01_spec/CONTEXT.md:29`: "Bookkeeping files are always allowed and need not be listed (see stage 02)." It points to stage 02's list, so it needs no change.
5. `AGENTS.md:126`: "Each stage writes to its own `output/`", with no file names. `AGENTS.md` names no build report today.
6. ADR `0101:70`: "`02_build/output/build-report.md`, overwritten per task, with a section appended per fix round". `:76` is a bookkeeping list in general terms ("the build output, including its gitignored `output/logs/`") and stays true. Section 3 is history; the change goes in the Amendments.
7. `git ls-files workflow/` shows `build-report.md` tracked, and commit `cc32233` (T753) committed the task's spec, `build-report.md` and review together with its code. Today `build-report.md` holds T753's report (62 lines).
8. No other live file names `build-report` (a repo-wide search outside `node_modules`, `.git` and `docs/audit/archive/` finds only the files above and the T752/T753 spec and review outputs, which are history and stay as they are).

**Orders**

9. `workflow/stages/01_spec/CONTEXT.md:3`: "The spec's Goal comes from the description." Nothing says how short a description may be. `:40`: "If the owner's intent is unclear, stop with `BLOCKED` and the question." `:44`: "Stop after writing the spec. The orchestrator decides whether to pause for the owner."
10. The ledger's Backlog is `docs/audit/task-ledger.md:42` onward. Its closed rows read `done in Phase 127 (T753)` (`:49`, `:52`).

**Pause**

11. No file says when the orchestrator pauses after a spec. `AGENTS.md:119` to `:128` (the ICM section) is silent on it.

**Commits**

12. `AGENTS.md:39` (Stop and ask first): "`git commit`, `git push`, merging, or rewriting history. Under herdr, only the orchestrator commits and pushes, on the owner's order (see ICM workflow)."
13. `AGENTS.md:127`: "**Commits:** only the orchestrator commits, only on a phase branch, and only on the owner's `commit <id>` order. It pushes only the phase branch, only on the owner's push order. No agent merges; the owner merges."
14. `workflow/stages/02_build/CONTEXT.md:42`: "Only the orchestrator commits, on the owner's order."
15. ADR `0101:82` (section 4) says the same as item 13. ADR `0101:3` (Status) ends "Amended in Phase 126 (T751, `86d0849`), merged into `main` as `3f301ab` (PR #77); see Amendments." The Amendments section is `:109` to `:122`; its last paragraph is "**Phase 126 release.** ...".
16. `.claude/settings.json:97` to `:112` is the `ask` list. `:98` is `"Bash(ALLOW_GIT_WRITE=1 git commit:*)",` and `:99` is `"Bash(ALLOW_GIT_WRITE=1 git push:*)",`. `:100` and `:105` are the bare `Bash(git commit:*)` and `PowerShell(git commit:*)` ask rules. Nothing in the repo or in `~/.claude/hooks/` reads `ALLOW_GIT_WRITE`; it is only a prefix the orchestrator types.
17. The file declares `"$schema": "https://json.schemastore.org/claude-code-settings.json"` (`:2`). I checked it on `88cc32b` and with `:98` removed: both validate against that schema with the repo's installed `ajv` 8.20.0 (the command in Gate G4).

## 5. Parity map

None. No row of `AGENTS.md`'s cross-file parity map covers the stage files, the ADR or `.claude/settings.json`.

## 6. Tests to add

None. The task changes Markdown rules and one Claude Code permission rule. No app code, test or config that the build, the unit suite or Playwright reads changes, so app behaviour cannot change. The gates in section 8 (schema validation, the exact settings diff, the grep checks) pin the result in place of a test. Stage 02 step 4 and stage 03 step 6 do not apply.

## 7. The edits

Make exactly these edits. "Replace" means swap the quoted old text for the new text. Keep CRLF line endings. No em dash anywhere (use a colon, comma or parentheses).

### Edit A: `workflow/stages/02_build/CONTEXT.md` (build report)

A1, line 16. Replace:

> - **Bookkeeping files**, always allowed and never a scope violation: `docs/audit/task-ledger.md` and `workflow/stages/02_build/output/*` (full-suite logs go in `output/logs/`, which git ignores).

with:

> - **Bookkeeping files**, always allowed and never a scope violation: `docs/audit/task-ledger.md` and `workflow/stages/02_build/output/*`, which holds the task's build report `task-<id>-build.md` (full-suite logs go in `output/logs/`, which git ignores).

A2, line 28. Replace `7. Write \`workflow/stages/02_build/output/build-report.md\`:` with `7. Write \`workflow/stages/02_build/output/task-<id>-build.md\`:`. Keep the rest of the line as it is.

A3, line 30. Replace the whole line:

> `build-report.md` is overwritten by each `build <id>`; a `fix <id>` appends a `## Fix round N` section to it.

with:

> Each task has its own build report, `task-<id>-build.md`: a `build <id>` creates it, and each `fix <id>` appends a `## Fix round N` section to the same file. Never edit another task's report. `build-report.md` is the last shared report (T753, Phase 127), kept as it is: never write to it again.

### Edit B: `workflow/stages/03_review/CONTEXT.md` (build report)

B1, line 8. Replace `` `workflow/stages/02_build/output/build-report.md`, `` with `` `workflow/stages/02_build/output/task-<id>-build.md` (on a fix round, including its latest `## Fix round N` section), ``.

B2, line 9. Replace `(\`docs/audit/task-ledger.md\`, \`workflow/stages/02_build/output/*\`)` with `(\`docs/audit/task-ledger.md\`, \`workflow/stages/02_build/output/*\`, which holds \`task-<id>-build.md\`)`.

B3, line 24. Replace `(no spec, no build report, a gate cannot run)` with `(no spec, no \`task-<id>-build.md\`, a gate cannot run)`.

### Edit C: `workflow/stages/02_build/CONTEXT.md` (commits)

Line 42. Replace `Only the orchestrator commits, on the owner's order.` with `Only the orchestrator commits (each APPROVED task, on the phase branch) and pushes (on the owner's push order).`

### Edit D: `workflow/stages/01_spec/CONTEXT.md` (short orders, pause pointer)

D1. Insert this new section after the "Task id and phase" section (after its last bullet, line 8) and before `## Read`, with one blank line on each side:

> ## Short orders
>
> - A one-line goal, or a reference to a row of the Backlog in `docs/audit/task-ledger.md`, is a complete order. Expand it into a full spec from that row, the code it names and the current tests.
> - When the order names a Backlog row, the spec tells the builder to set that row's Status to `done in Phase NNN (<id>)`.
> - Stop with `BLOCKED` only when the intent is unclear: the goal or the row reads two ways that change the target files or the behaviour, or the named row cannot be found.

D2, line 44. Replace `Stop after writing the spec. The orchestrator decides whether to pause for the owner.` with `Stop after writing the spec. The orchestrator then pauses for the owner or goes on, by the pause rule in \`AGENTS.md\`'s ICM section, which reads the spec's Target files and Production touch points.`

### Edit E: `AGENTS.md`

E1, line 39 (Stop and ask first). Replace the whole bullet with:

> - `git commit`, `git push`, merging, or rewriting history. Under herdr, the ICM workflow section is the owner's standing go-ahead for one thing only: the orchestrator commits each APPROVED task on its phase branch. Pushing still needs the owner's push order, and only the owner merges.

E2, line 126. Replace `Each stage writes to its own \`output/\`, and every reply ends` with `Each stage writes to its own \`output/\`: \`task-<id>-spec.md\`, \`task-<id>-build.md\` (fix rounds append to it) and \`task-<id>-review.md\`. Every reply ends`. Keep the rest of the line.

E3. Insert this new bullet between line 126 and line 127 (before `- **Commits:**`):

> - **Pause after the spec:** after `SPEC DONE`, the orchestrator pauses for the owner's go-ahead before sending `build <id>` when the spec's Target files include a money path (`src/context/FinanceContext.tsx`, `src/selectors/`, or the ledger), anything under `supabase/` or `api/`, `AGENTS.md`, or a `workflow/stages/*/CONTEXT.md` file, or when its Production touch points section lists anything but `none`. Otherwise it sends `build <id>` without asking. Bookkeeping files (`docs/audit/task-ledger.md`, `workflow/stages/*/output/*`) never cause a pause.

E4, line 127. Replace the whole `- **Commits:**` bullet with:

> - **Commits:** after an `APPROVED` review, the orchestrator commits that task on the phase branch by itself, with no `commit <id>` order. It stages only that task's files, by path, never with `git add -A` or `git add .`: the spec's Target files the build changed, `docs/audit/task-ledger.md`, and the task's `task-<id>-spec.md`, `task-<id>-build.md` and `task-<id>-review.md`. It leaves any other changed file unstaged and names it to the owner. It never commits on `main` and never skips hooks; if the commit fails, it stops for the owner. It pushes only the phase branch, only on the owner's push order. No agent merges; the owner merges.

Leave line 128 (the deploy-record exception on `main`) as it is.

### Edit F: ADR `0101`

F1, line 3. Replace `merged into \`main\` as \`3f301ab\` (PR #77); see Amendments.` with `merged into \`main\` as \`3f301ab\` (PR #77), and in Phase 128 (T754); see Amendments.`

F2. Append after the last paragraph of the file (the "**Phase 126 release.**" paragraph), with one blank line before it:

> **Phase 128 (T754, 2026-10-16), branch `phase-128-workflow-automation`.** These cut the owner's round trips per task. They change workflow rules, not the decision, so no new ADR.
>
> 1. **A build report per task.** Stage 02 writes `02_build/output/task-<id>-build.md`, and each fix round appends a `## Fix round N` section to it. This replaces section 3's single `build-report.md`, overwritten per task. `build-report.md` stays as the last shared report (T753) and is not written again. `AGENTS.md` names the three per-task outputs.
> 2. **Short orders.** In stage 01, a one-line goal or a reference to a ledger Backlog row is a complete order. The reviewer expands it from that row and the code, and stops with `BLOCKED` only when the intent is unclear.
> 3. **Automatic pause.** After the spec, the orchestrator pauses for the owner only when the spec touches a money path (`FinanceContext.tsx`, `src/selectors/`, the ledger), `supabase/`, `api/`, `AGENTS.md` or a stage file, or lists a production touch point. Otherwise it goes on without asking.
> 4. **Automatic commit (replaces section 4's `commit <id>` order).** The orchestrator commits each `APPROVED` task on the phase branch by itself, staging only that task's files. Pushing still needs the owner's push order, and merging stays with the owner. `.claude/settings.json` drops its ask rule for the prefixed `ALLOW_GIT_WRITE=1 git commit` form; every other rule stays, including the ask rule for `ALLOW_GIT_WRITE=1 git push`.

Do not edit sections 3 or 4 of the ADR body; the amendment records the change, as Phase 126 did.

### Edit G: `.claude/settings.json`

Delete line 98 only, `      "Bash(ALLOW_GIT_WRITE=1 git commit:*)",`, with its line ending. Change nothing else: not the order, the indentation, the CRLF endings, the final newline or any other rule. Line 99 (`Bash(ALLOW_GIT_WRITE=1 git push:*)`) becomes the first `ask` entry and keeps its trailing comma.

### Edit H: `docs/audit/refactor-log.md`

Insert this entry after the `---` line that follows the template (line 20) and before `## Phase 127`, followed by a blank line and its own `---` line, matching the entries below it:

```
## Phase 128 - Workflow automation: T754 (2026-10-16, docs `<sha>`, merged `<sha>`)

ADR `0101` (amended, no new ADR). The owner's brief: cut the owner's round trips per task, with a build report per task, short spec orders, a pause after the spec only for risky tasks, and an automatic commit of each approved task on the phase branch.

**Changed:** `AGENTS.md` (the per-task outputs, the pause rule, the automatic commit, the Stop and ask first line on commits); `workflow/stages/02_build/CONTEXT.md` (`task-<id>-build.md`, `build-report.md` kept as the last shared report, who commits); `workflow/stages/03_review/CONTEXT.md` (reads `task-<id>-build.md`); `workflow/stages/01_spec/CONTEXT.md` (short orders, the pause pointer); ADR `0101`'s Amendments; `.claude/settings.json` (the `ALLOW_GIT_WRITE=1 git commit` ask rule removed).
**Verified:** <each gate in section 8 with its result>
**Surprises:** <or none>
**Deliberately not done:** no `baseline-metrics.md` section (no bundle or test count changed). `build-report.md` keeps T753's report; it is not moved or deleted. No allow rule was added to `.claude/settings.json`, and the bare `git commit` ask rules for Bash and PowerShell stay. The herdr orchestrator's own configuration lives outside the repo and is the owner's to change.
```

Fill `Verified` and `Surprises` with what actually happened. Leave both `<sha>` placeholders as they are; the deploy record fills them, as in Phases 126 and 127.

### Edit L: `docs/audit/task-ledger.md` (bookkeeping)

Add a Phase 128 section after the Phase 127 section and before `## Backlog`, from the template:

```
## Phase 128 - Workflow automation: per-task build reports, short orders, automatic pause and commit (docs and agent settings only, amends ADR `0101`)

Branch `phase-128-workflow-automation`, cut from `main` at `88cc32b`. No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T754 | Per-task build reports, short spec orders, the automatic pause after the spec, the automatic commit of each approved task; drop the prefixed commit ask rule; ADR `0101` amendments | `AGENTS.md`, `workflow/stages/*/CONTEXT.md`, ADR `0101`, `.claude/settings.json`, `docs/audit/refactor-log.md` | in-progress | | |
```

Set Status to `done` and fill Gate result when the gates pass. Leave `Commit` empty.

## 8. Gates

`AGENTS.md`'s docs-only row applies to every Markdown target (check each path a changed line states). `.claude/settings.json` has no tier row; the owner added schema validation. Run from the repo root in Git Bash, after all edits. Save G4's output to `workflow/stages/02_build/output/logs/T754-settings-schema.log` (the reviewer: `workflow/stages/03_review/output/logs/`).

G1. Paths the new text names exist:

```bash
ls workflow/stages/02_build/output/build-report.md src/context/FinanceContext.tsx workflow/stages/01_spec/CONTEXT.md workflow/stages/02_build/CONTEXT.md workflow/stages/03_review/CONTEXT.md && ls -d src/selectors supabase api
```

Expect all listed, no error.

G2. `build-report.md` is untouched:

```bash
git diff --quiet -- workflow/stages/02_build/output/build-report.md && echo unchanged
```

Expect `unchanged`.

G3. The settings diff is exactly one removed line:

```bash
git diff --numstat -- .claude/settings.json
git diff -U0 -- .claude/settings.json | grep -E '^[-+] '
grep -c $'\r' .claude/settings.json; wc -l < .claude/settings.json
```

Expect `0	1	.claude/settings.json`; exactly one line, `-      "Bash(ALLOW_GIT_WRITE=1 git commit:*)",` (a trailing `^M` is fine); and both counts `113`.

G4. The settings file validates against the Claude Code settings schema (a read-only download of the public schema, then the repo's installed `ajv`):

```bash
L=workflow/stages/02_build/output/logs
curl -sSL -o "$L/claude-code-settings.schema.json" https://json.schemastore.org/claude-code-settings.json
node -e "const Ajv=require('ajv');const fs=require('fs');const a=new Ajv({strict:false,allErrors:true});const v=a.compile(JSON.parse(fs.readFileSync(process.argv[1],'utf8')));const ok=v(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));console.log(ok?'valid':'INVALID '+JSON.stringify(v.errors));process.exit(ok?0:1)" "$L/claude-code-settings.schema.json" .claude/settings.json 2>&1 | tee "$L/T754-settings-schema.log"
```

Expect the last line `valid` and exit 0. The `unknown format "uri" ignored` warnings are expected (ajv has no format plugin installed) and are not failures.

G5. Stale references are gone:

```bash
grep -n "build-report" AGENTS.md workflow/stages/*/CONTEXT.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md
grep -n "commit <id>" AGENTS.md workflow/stages/*/CONTEXT.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md
grep -n "owner's order" AGENTS.md workflow/stages/*/CONTEXT.md
```

Expect for `build-report`: one hit in `02_build/CONTEXT.md` (Edit A3's "last shared report" sentence) and in ADR `0101` only line 70 and amendment 1; none in `AGENTS.md` or `03_review/CONTEXT.md`. For `commit <id>`: `AGENTS.md` only in E4's "with no `commit <id>` order", ADR `0101` only section 4 (line 82) and amendment 4; none in the stage files. For `owner's order`: no hits.

G6. Zero em dashes in every touched file:

```bash
node -e "const fs=require('fs');let n=0;for(const f of process.argv.slice(1)){fs.readFileSync(f,'utf8').split('\n').forEach((l,i)=>{if(l.includes(String.fromCharCode(8212))){n++;console.log(f+':'+(i+1))}})}console.log('em dashes:',n);process.exit(n?1:0)" AGENTS.md workflow/stages/01_spec/CONTEXT.md workflow/stages/02_build/CONTEXT.md workflow/stages/03_review/CONTEXT.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/refactor-log.md docs/audit/task-ledger.md .claude/settings.json workflow/stages/02_build/output/task-T754-build.md
```

Expect `em dashes: 0`.

G7. Scope:

```bash
git diff --stat; git status --porcelain
```

Expect only the seven target files, `docs/audit/task-ledger.md` and the new `workflow/stages/02_build/output/task-T754-build.md` (plus this spec, which the reviewer wrote). The `output/logs/` files are gitignored and do not show.

No `npm run lint` or test suite: no tier row other than docs-only applies, and the before-done line applies only to code tiers (`AGENTS.md:92`).

## 9. Production touch points

None to run. The task edits the rules for `git commit`, one of the Stop and ask first items, but runs no commit, push, merge or production call. G4's `curl` is a read-only GET of a public schema, not a production request.

Note for the owner, not a build step: whether removing the prefixed ask rule stops the prompt for `ALLOW_GIT_WRITE=1 git commit ...` depends on how Claude Code matches that command against the remaining bare `Bash(git commit:*)` rule and on the orchestrator's permission mode. The spec does not add an allow rule, because the order says to remove only that one rule. The owner confirms on the first automatic commit.

## 10. Out of scope

- `workflow/stages/02_build/output/build-report.md`: do not edit, move, rename or delete it.
- The T752 and T753 spec and review outputs that mention `build-report.md`: history, leave as they are.
- `.claude/settings.json`: every rule other than line 98, including `Bash(ALLOW_GIT_WRITE=1 git push:*)`, `Bash(git commit:*)` and `PowerShell(git commit:*)`. No allow rule, no new key, no reformatting.
- ADR `0101` sections 3 and 4 (lines 64 to 84): change only line 3 and the Amendments.
- `docs/audit/README.md`: no rule there names the build report or the commit order, so no change.
- `docs/audit/baseline-metrics.md`: no section for this phase.
- `CLAUDE.md`, `.gitignore`, `docs/contexts/*.md`, anything under `src/`, `unit/`, `tests/`, `api/`, `supabase/`, `.github/`, `vercel.json`.
- Commit-message conventions, the herdr orchestrator's own configuration and agy's settings: outside the repo or not in the order.
- Any `git commit` or `git push`: the orchestrator commits after review, on the rules in force when it does.
