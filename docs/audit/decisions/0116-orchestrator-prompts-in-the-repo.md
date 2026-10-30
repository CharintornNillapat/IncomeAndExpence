# 0116: orchestrator prompts in the repo

**Status:** Accepted. To be implemented in Phase 162 (T833).

**Date:** 2026-10-30

## Context

MASTER, the orchestrator of the ICM workflow (ADR 0101), runs from prompts outside the repository: `~/.claude/commands/finlife.md` under Option A (Claude Code) and `~/.gemini/config/agents/fin-master/agent.md` under Option B (agy, ADR 0101 Phase 140 amendment). The stage files they drive (`workflow/stages/*/CONTEXT.md`) and the rules they apply (AGENTS.md's ICM section) are versioned. A stage-file change and the matching MASTER change cannot land in one commit or be reviewed together, and nothing records what MASTER was told when a phase ran.

The copies have drifted. Phase 157 added `.github/workflows/` and `.claude/settings.json` to AGENTS.md's pause list, in two places (the Pause after the spec bullet and the Release bullet's Otherwise item). Both global prompts still list the older paths where they choose the reviewer and decide the pause after the spec, so MASTER could skip the owner's pause and pick the light reviewer for a task that edits a workflow or the permission settings. The Option B prompt also predates Phase 153 (the orchestrator opens the PR) and Phase 159 (the pre-push guard and `git push origin main`): it pushes main with a plain `git push` and has no hook check. The rule never to pipe a push, learned at the Phase 159 deploy-record push, lived only in an agent memory note.

## Decision

- **D1: The orchestrator body is versioned.** `workflow/orchestrator/MASTER.md` holds the runtime-neutral body of `finlife.md`: choosing the reviewer, the task loop, how to send, wait and read, the BUILDER role prompt sent verbatim, the other orders, the commit procedure, `release`, `merged`, usage, the report ending and the rules for MASTER, with their section numbers 2 to 7 kept. MASTER reads it from the branch that is checked out.
- **D2: Thin loaders, versioned too.** `workflow/orchestrator/loaders/finlife.md` (Option A) and `workflow/orchestrator/loaders/fin-master.agent.md` (Option B) hold the preflight, the fin-builder spawn, the step "follow MASTER.md from section 2" and only runtime-specific notes: shell rules, tool names and how to invoke a reviewer. A loader may narrow a MASTER.md step for its runtime and never widens one. The owner copies each loader over its global file by hand after the merge; nothing installs them.
- **D3: One home for the pause list.** AGENTS.md's Pause after the spec bullet is the only list of risk paths. The Release bullet's Auto-merge and Otherwise items and MASTER.md's reviewer choice, pause after the spec and auto-merge check point at it. `workflow/orchestrator/`, its `loaders/` folder included, joins the list, so a task that changes MASTER's instructions pauses for the owner, gets the strict reviewer and is merged by the owner.
- **D4: One table of runtimes.** `workflow/orchestrator/runtimes.md` names the agent, model, tools, shell and guards behind each role under Option A and Option B. Option B makes no GitHub writes: the owner opens and merges its PR, because agy's deny list matches command names, not flags, so it cannot allow `gh pr merge --auto --merge` while refusing `--squash`. Option B pushes rely on the pre-push hook and never use `--no-verify`.
- **D5: Never pipe a push.** MASTER.md's Rules and both push steps say every `git push` runs as a command of its own, unpiped, and MASTER reports git's own output and exit code.

## Alternatives

- **Keep the prompts global (rejected).** It needs no copy step, and a phase branch cannot change MASTER's instructions. The drift above is its cost: three copies of the pause list, two of them stale, and no review of an orchestrator change next to the stage change it matches. The exposure a branch adds is the one already accepted for the stage files, and D3 bounds it.
- **Install the loaders by symlink or script (not now).** The hand copy is a deliberate step the owner sees, as with the pre-push hook (ADR 0114 D2).
- **A separate `BUILDER.md` (not done).** The builder role prompt stays in MASTER.md section 5, so one file holds everything MASTER sends.

## Consequences

- An orchestrator change and its stage-file change can land in one task, one commit and one review.
- MASTER's instructions follow the checked-out branch. A phase branch that edits `workflow/orchestrator/` changes them before review; the pause list makes that task wait for the owner.
- Nothing takes effect at the merge. Until the owner copies a loader, that runtime runs its old global prompt, inline lists included.
- Option B now follows the same body as Option A, narrowed by its loader: the reviewer choice and the pause use the full pause list, the deploy-record push is `git push origin main`, and the preflight checks the pre-push hook.
- agy's global deny list names `git commit`, `git push` and `gh pr` but is not proven enforced. If it is, an Option B commit or push fails and the owner runs it by hand.
- `runtimes.md` is keyed by role, so a later phase can point runtime-neutral stage files at it.

## Not done

- No `workflow/orchestrator/BUILDER.md` (Alternatives).
- No edit to any global file: `~/.claude/commands/finlife.md`, `~/.gemini/config/agents/*/agent.md` and the memory notes stay the owner's. After the merge the owner copies the loaders and may delete `finlife.md.bak`.
- No edit to the stage files, `.claude/agents/` or the runtime names in AGENTS.md's order bullets (a later phase).
- No AGENTS.md rule changes its behaviour beyond the pause list gaining `workflow/orchestrator/`; Option A's moved lines keep their meaning.
- The `usage on` ccusage procedure moves as it is.
- The memory note's push form `ALLOW_GIT_WRITE=1 git push ... > <log> 2>&1; echo` is not adopted: it is none of ADR 0114's allow-listed forms, so it would wait on a prompt.
- No test of a loader or of MASTER.md: they are prompts. The first real task run through each installed loader is the live check.

## Release

One pull request for Phase 162. No migration and no production touch point. It touches AGENTS.md and `workflow/orchestrator/`, both on the pause list, and is docs only, so the owner merges it. After the merge the owner copies `workflow/orchestrator/loaders/finlife.md` to `~/.claude/commands/finlife.md` and `workflow/orchestrator/loaders/fin-master.agent.md` to `~/.gemini/config/agents/fin-master/agent.md`.
