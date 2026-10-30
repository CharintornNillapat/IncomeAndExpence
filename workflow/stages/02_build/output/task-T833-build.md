# Task T833 Build Report

## Summary
- Task: T833 (Phase 162)
- Title: Move the orchestrator prompts into the repo (ADR 0116)
- Status: BUILT
- Changed files count: 8 repo files (7 target files changed + 1 bookkeeping file)

## Files Changed
1. `docs/audit/decisions/0116-orchestrator-prompts-in-the-repo.md`: ADR 0116
2. `workflow/orchestrator/MASTER.md`: Runtime-neutral orchestrator body
3. `workflow/orchestrator/runtimes.md`: ICM workflow roles and runtime definitions
4. `workflow/orchestrator/loaders/finlife.md`: Option A loader (Claude Code)
5. `workflow/orchestrator/loaders/fin-master.agent.md`: Option B loader (Antigravity CLI / agy)
6. `AGENTS.md`: Pause list unified with `workflow/orchestrator/` added; Release bullet points to pause list; orchestrator prompt bullet added
7. `docs/audit/refactor-log.md`: Phase 162 entry
8. `docs/audit/task-ledger.md`: Phase 162 section and T833 row

`docs/audit/baseline-metrics.md` was left unchanged as required for docs-only tasks without test or bundle changes.

## Pointer Fix (Owner Note)
The pointer to the BUILDER role prompt in `finlife.md:22` (which incorrectly cited section 4) has been corrected to cite `MASTER.md section 5` in the new files:
- In `workflow/orchestrator/loaders/finlife.md`: Section 1 step 3 cites `Send the BUILDER role prompt (MASTER.md section 5) verbatim:`
- In `workflow/orchestrator/loaders/fin-master.agent.md`: Section 1 step 3 cites `Send the BUILDER role prompt (MASTER.md section 5) verbatim, without its enclosing double quotes, in one shell call:`

## Tests Added and Fail-Then-Pass Evidence
None. This is a docs-only task modifying and adding markdown prompt files and documentation. Mechanical verification is performed by Gates 0 through 12.

## Gates Verification
- **Gate 0:** Gate script extracted to `workflow/stages/02_build/output/logs/T833-gates.cjs` using Block EXTRACT.
- **Gates 1-10:** `node workflow/stages/02_build/output/logs/T833-gates.cjs`
  - Output log: `workflow/stages/02_build/output/logs/T833-gates.log`
  - Result: 0 bad (all 45 individual assertions passed)
    - G1: All 5 extracted files match their respective blocks.
    - G2: `AGENTS.md` holds AGENTS_1_NEW, AGENTS_2_NEW, AGENTS_3_NEW; AGENTS_3_NEW positioned between AGENTS_3_AFTER and AGENTS_1_NEW; AGENTS_1_OLD and AGENTS_2_OLD removed.
    - G3: Pause list unified to one home in `AGENTS.md` pause bullet; 0 inline risk lists in orchestrator files; 0 stale phrases; `MASTER.md` points to pause list 3 times.
    - G4: Lines and backtick spans from `finlife.md` preserved verbatim in `MASTER.md` and loader A per specification.
    - G5: Backtick spans and frontmatter from `fin-master/agent.md` preserved in `MASTER.md` and loader B.
    - G6: Text clean: 0 em dashes, 0 mojibake (`â`), 0 secrets/tokens across all new files and `AGENTS.md` added lines.
    - G7: Every cited repo path exists; `workflow/orchestrator/BUILDER.md` confirmed absent; exactly one ADR 0116.
    - G8: Line endings clean: 0 bare LF on `AGENTS.md`, `task-ledger.md`, `refactor-log.md` (all CRLF); single style per new file.
    - G9: External read-only files unchanged (SHA256 hashes match).
    - G10: Scope clean: 0 out-of-scope files in `git status --porcelain`.
- **Gate 11:** `git ls-files --eol AGENTS.md docs/audit/task-ledger.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md`
  - Result: all 4 files show `w/crlf` as expected.
- **Gate 12:**
  - `git diff --numstat AGENTS.md`: `3 2 AGENTS.md` (exact match).
  - `git diff --stat docs/audit/baseline-metrics.md`: empty (exact match).

## Left to the Reviewer
None. This is a docs-only tier task without affected Playwright specs.

## Surprises
1. `finlife.md:22` sends "the BUILDER role prompt (section 4)", but the role prompt is section 5 (`finlife.md:58`). The loaders cite `MASTER.md section 5`.
2. `fin-master/agent.md` is double-encoded: its arrows are stored as the bytes `c3 a2 e2 80 a0 e2 80 99` (UTF-8 read as cp1252 and saved again), so it shows `â†’` and `â†` where `finlife.md` has `→` and `←` (for example `fin-master/agent.md:40` and `:60`). The loader is written fresh in clean UTF-8 and needs no arrow; gate 6 counts `â` in the new files.
3. Option B's prompt predates Phase 153 (orchestrator-opened PRs, auto-merge) and Phase 159 (pre-push guard, `git push origin main`): its `push` order and plain `git push` of main (`fin-master/agent.md:106`, `:111`) differ from `finlife.md:68-83`, and its preflight has no hook check.
4. agy's global deny list names `git commit` and `git push`, which Option B's own commit and push steps run. Whether agy enforces it for `fin-master`'s `run_command`, or for a `$env:ALLOW_GIT_WRITE='1'; git ...` chain, is not proven.
5. The memory note's push form `ALLOW_GIT_WRITE=1 git push ... > <log> 2>&1; echo "git exit=$?"` (`never-pipe-pushes.md:15`) matches none of the ADR 0114 allow rules (`.claude/settings.json` allows `ALLOW_GIT_WRITE=1 git push origin main` and its `2>&1` variant only), so MASTER.md adopts the rule (never pipe, report git's own exit code) without that form.
6. `AGENTS.md:136` (Release, Otherwise) repeated the pause list a second time; after Phase 157 added `.github/workflows/` and `.claude/settings.json` to both AGENTS.md copies, the two global prompts were left with the older list.
7. In the initial spec, Gate 7 checked that every cited repo path exists, failing on `workflow/orchestrator/BUILDER.md` which ADR 0116 lists under Not done as deliberately uncreated; resolved in spec Amendment 1 by adding `NOT_CREATED = ['workflow/orchestrator/BUILDER.md']` to Gate 7's skip and non-existence checks.

## Deliberately Not Done
No `workflow/orchestrator/BUILDER.md` (the role prompt stays in MASTER.md section 5); no edit to any global file (`~/.claude/commands/finlife.md`, `~/.gemini/config/agents/*/agent.md`, the memory notes): the owner copies the loaders after the merge; no edit to the stage files, `.claude/agents/` or the runtime names in AGENTS.md's order bullets (a later phase); no AGENTS.md rule changes behaviour beyond the pause list gaining `workflow/orchestrator/`; the `usage on` ccusage procedure moves as it is; the memory note's `> <log> 2>&1; echo` push form (it is none of ADR 0114's allow-listed forms, so it would wait on a prompt); no test of the prompts (the first real task through each loader is the live check).
