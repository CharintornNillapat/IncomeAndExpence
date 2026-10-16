# Build report: T754

Phase 128: Workflow automation (per-task build reports, short orders, automatic pause, automatic commit).

## Files changed (8 files + build report)

1. `AGENTS.md`:
   - Updated Stop and ask first git commit bullet to grant orchestrator standing go-ahead for committing approved tasks on phase branches.
   - Named the three per-task outputs (`task-<id>-spec.md`, `task-<id>-build.md`, `task-<id>-review.md`) in stage output list.
   - Added `Pause after the spec` bullet defining conditions for pausing vs proceeding.
   - Updated `Commits` bullet with automatic per-task commit workflow on phase branches.
2. `workflow/stages/01_spec/CONTEXT.md`:
   - Added `Short orders` section allowing one-line goals or Backlog row references.
   - Updated pause pointer to cite AGENTS.md ICM pause rule.
3. `workflow/stages/02_build/CONTEXT.md`:
   - Updated bookkeeping files bullet to specify `task-<id>-build.md`.
   - Updated step 7 to write `task-<id>-build.md`.
   - Replaced shared report overwrite rule with per-task report rule, noting `build-report.md` as last shared report.
   - Updated Stop and ask first list bullet to reflect automatic commits on phase branch.
4. `workflow/stages/03_review/CONTEXT.md`:
   - Updated step 2 to read `task-<id>-build.md` (and latest fix round).
   - Updated step 3 bookkeeping list to cite `task-<id>-build.md`.
   - Updated line 24 BLOCKED condition to reference `task-<id>-build.md`.
5. `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`:
   - Updated Status line 3 to cite Phase 128 (T754) amendment.
   - Appended Phase 128 amendment block covering per-task build reports, short orders, automatic pause, and automatic commit.
6. `.claude/settings.json`:
   - Removed `Bash(ALLOW_GIT_WRITE=1 git commit:*)` ask rule (line 98).
7. `docs/audit/refactor-log.md`:
   - Added Phase 128 entry above Phase 127.
8. `docs/audit/task-ledger.md`:
   - Added Phase 128 section with T754 row marked done.

## Tests added

- None (per spec section 6: docs and agent-settings changes only; no app code, test or config read by runners changed; pinned by schema validation, settings diff, and grep gate checks).

## Gate commands and results

1. Gate G1 (named paths exist):
   - Command: `ls workflow/stages/02_build/output/build-report.md src/context/FinanceContext.tsx workflow/stages/01_spec/CONTEXT.md workflow/stages/02_build/CONTEXT.md workflow/stages/03_review/CONTEXT.md && ls -d src/selectors supabase api`
   - Result: all 8 paths exist, exit 0.

2. Gate G2 (build-report.md untouched):
   - Command: `git diff --quiet -- workflow/stages/02_build/output/build-report.md && echo unchanged`
   - Result: `unchanged`, exit 0.

3. Gate G3 (settings diff and line counts):
   - `git diff --numstat -- .claude/settings.json`: `0 1 .claude/settings.json`
   - `git diff -U0 -- .claude/settings.json | grep -E '^[-+] '`: exactly one removed line (`-      "Bash(ALLOW_GIT_WRITE=1 git commit:*)",`)
   - Lines count: 113; CRLF line endings preserved.

4. Gate G4 (Claude Code settings schema validation):
   - Command:
     ```bash
     L=workflow/stages/02_build/output/logs
     curl -sSL -o "$L/claude-code-settings.schema.json" https://json.schemastore.org/claude-code-settings.json
     node -e 'const Ajv=require("ajv");const fs=require("fs");const a=new Ajv({strict:false,allErrors:true});const v=a.compile(JSON.parse(fs.readFileSync(process.argv[1],"utf8")));const ok=v(JSON.parse(fs.readFileSync(process.argv[2],"utf8")));console.log(ok?"valid":"INVALID "+JSON.stringify(v.errors));process.exit(ok?0:1)' "$L/claude-code-settings.schema.json" .claude/settings.json 2>&1 | tee "$L/T754-settings-schema.log"
     ```
   - Result: `valid`, exit 0.
   - Log path: `workflow/stages/02_build/output/logs/T754-settings-schema.log`

5. Gate G5 (stale references check):
   - `grep -n "build-report" AGENTS.md workflow/stages/*/CONTEXT.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`: 3 hits (`02_build/CONTEXT.md:30`, ADR `0101:70`, ADR `0101:126`); 0 in `AGENTS.md` or `03_review/CONTEXT.md`.
   - `grep -n "commit <id>" AGENTS.md workflow/stages/*/CONTEXT.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`: 3 hits (`AGENTS.md:128`, ADR `0101:82`, ADR `0101:129`); 0 in stage files.
   - `grep -n "owner's order" AGENTS.md workflow/stages/*/CONTEXT.md`: 0 hits.

6. Gate G6 (em dash check):
   - Command: `node -e "..."` across all 9 touched files
   - Result: `em dashes: 0`, exit 0.

7. Gate G7 (scope check):
   - Command: `git diff --stat; git status --porcelain`
   - Result: exactly the 7 target files, `docs/audit/task-ledger.md`, and the new `task-T754-build.md` (plus the spec).

## Not done

- None. All edits from the spec were completed.
