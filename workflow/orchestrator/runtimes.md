# Orchestrator runtimes

Which agent, model, tools and shell play each role of the ICM workflow under the two ways the owner runs it (ADR 0101, Phase 140 amendment; ADR 0116). The rules live in AGENTS.md, the stage files and workflow/orchestrator/MASTER.md; this file says only who runs them and with what. It is the one file in the repo meant to name the agents and models behind each role. AGENTS.md, the stage files (workflow/stages/*/CONTEXT.md) and workflow/orchestrator/MASTER.md name roles only, the orchestrator, the light reviewer, the strict reviewer and the builder; the Roles table below gives each role its agent and model.

- **Option A** (the default): `/finlife` in Claude Code.
- **Option B** (the fallback when Claude Code quota runs out): `agy --agent fin-master`, everything on Antigravity CLI.

## Roles

| Role | Option A | Option B |
|---|---|---|
| Orchestrator (MASTER) | The Claude Code main session, started with `/finlife`; model: the owner's session model, not pinned | agy custom agent `fin-master` (`model: inherit`), started with `agy --agent fin-master` from a herdr pane in the repo; model Gemini 4 Argon, which the owner confirms in the status bar |
| Light reviewer | Claude Code project sub-agent `fin-reviewer`, `model: sonnet`, defined in the repo (`.claude/agents/fin-reviewer.md`) | agy custom subagent `fin-reviewer-g`, `model: inherit` (the orchestrator's model), defined globally (`~/.gemini/config/agents/fin-reviewer-g/agent.md`) |
| Strict reviewer | Claude Code project sub-agent `fin-reviewer-strict`, `model: opus` (`.claude/agents/fin-reviewer-strict.md`) | agy custom subagent `fin-reviewer-strict-g`, `model: inherit` (`~/.gemini/config/agents/fin-reviewer-strict-g/agent.md`) |
| Builder | herdr agent `fin-builder`, kind `agy`, Gemini 3.8 Flash, in a pane the orchestrator splits off | The same |

## Loaders, tools and shell

| | Option A | Option B |
|---|---|---|
| Loader in the repo | `workflow/orchestrator/loaders/finlife.md` | `workflow/orchestrator/loaders/fin-master.agent.md` |
| Installed at (the owner copies it by hand) | `~/.claude/commands/finlife.md` | `~/.gemini/config/agents/fin-master/agent.md` |
| Instructions | `workflow/orchestrator/MASTER.md`, read from the checked-out branch | The same |
| Reviewer call | The Agent tool, `subagent_type` `fin-reviewer` or `fin-reviewer-strict`; the final message comes back as the tool result | `invoke_subagent` with workspace `inherit`; the orchestrator waits for the subagent's reply message (`send_message`) and does nothing else meanwhile |
| Orchestrator tools | Claude Code's built-in tools (Bash, Read, Grep, Agent and the rest) | The frontmatter list: `view_file`, `write_to_file`, `replace_file_content`, `run_command`, `invoke_subagent`, `manage_subagents`, `send_message`, with `commandExecutionPolicy: auto` |
| Shell | Git Bash on Windows: `MSYS_NO_PATHCONV=1` before an argument that starts with `/`, `ALLOW_GIT_WRITE=1` inline on the one git command | Windows PowerShell 5.1, a fresh process per call: `$env:ALLOW_GIT_WRITE='1'` in the same call as the git command, single-quoted strings and here-strings, no embedded double quotes |
| Builder start and orders | `herdr pane split`, `herdr agent start fin-builder --kind agy`, then `herdr agent prompt` with the order in double quotes | The same herdr commands, with the order passed as a here-string |
| GitHub writes | `release` runs `gh pr create` in the ADR 0114 form and, when eligible, `gh pr merge <n> --auto --merge` | None: the owner opens and merges the PR by hand, and the orchestrator runs no `gh pr` command at all |
| Waiting for the merge | `merged` polls `gh pr view` | None: `merged` runs on the owner's order |
| Usage tracking | `usage on` snapshots `npx ccusage@latest session --json` | None: the owner checks quotas with `/usage` |

## Guards

What stops a wrong command beyond the agents' own instructions.

| Guard | Option A | Option B |
|---|---|---|
| Pre-push hook `.git/hooks/pre-push`, a byte copy of `scripts/git-hooks/pre-push` (ADR 0114) | Runs on every push. The preflight compares the copy with `cmp -s` and pushes nothing while it differs | Runs on every push, and is the one proven guard on option B pushes. The preflight compares the copy with `Get-FileHash`. Never `--no-verify` |
| Claude Code permission rules in `.claude/settings.json` | Allow the three ADR 0114 forms and the auto-merge call; ask on `git merge`, `git rebase` and PowerShell pushes; deny squash, rebase and admin merges, `--no-verify`, a second base or head, another repository, `vercel` and the MCP write tools. Rules can match flags, not only a command name | Do not apply: they are Claude Code's |
| agy global deny list, `~/.gemini/config/config.json` (`userSettings.globalPermissionGrants.deny`) | Applies to the builder only | Applies to the orchestrator, the reviewers and the builder. It names `git commit`, `git push`, `git merge`, `git rebase`, `git reset`, `gh pr`, `gh api`, `gh workflow`, `gh release`, `gh repo`, `vercel` and `npx vercel` by command name, with no per-flag form. Not yet proven enforced: no run has shown agy refusing a listed command, or a `$env:ALLOW_GIT_WRITE='1'; git ...` chain. If it is enforced, the option B commit and push steps fail and the owner runs them by hand |
