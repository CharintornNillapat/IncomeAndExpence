# 0114: unattended pushes behind a pre-push guard

**Status:** Accepted. To be implemented in Phase 159 (T828). Amends ADR 0101, whose Phase 128 amendment 4 and Phase 130 amendment 1 kept the push and `gh pr create` ask rules.

**Date:** 2026-10-29

## Context

Phase 158 waited 89 minutes at the deploy-record push to `main`, and the Release waits the same way whenever nobody is at the terminal: at the push of the phase branch, then at `gh pr create`. They stop on the ask rules `Bash(git push:*)`, `Bash(ALLOW_GIT_WRITE=1 git push:*)` and `Bash(gh pr create:*)` in `.claude/settings.json`.

Claude Code checks deny rules, then ask rules, then allow rules, and the first match wins, so a matching ask rule prompts even when a narrower allow rule also matches. A deny or ask rule matches past any leading variable assignment, while an allow rule matches past only a known-safe one (https://code.claude.com/docs/en/permissions.md, fetched 2026-10-29). An allow rule for `ALLOW_GIT_WRITE=1 git push origin main` or for the release's `gh pr create` therefore never fires while `Bash(git push:*)` or `Bash(gh pr create:*)` is an ask rule, and no ask rule can keep the other forms asking without catching the allowed ones too. The same page says a `*` matches any text, spaces included, and that Bash rules match command text and are not a security boundary around a program.

In auto mode, allow, ask and deny rules resolve before the classifier, and narrow Bash and PowerShell allow rules stay in effect unless `autoMode.classifyAllShell` is set (https://code.claude.com/docs/en/permission-modes.md and https://code.claude.com/docs/en/auto-mode-config.md, fetched 2026-10-29). The owner's `autoMode.soft_deny` entry for `git push` to origin, in `~/.claude/settings.json`, is a classifier rule, so it reaches only a command that matches no permission rule.

The local `.git/hooks/pre-push` runs on every push, however it is spelled. Until now it only refused a push inside a herdr pane (`HERDR_ENV=1`) that lacked `ALLOW_GIT_WRITE=1` (ADR 0101, Phase 130 amendment 1). It is untracked, so nothing versioned or tested it.

The 36 deploy records on `main` after Phase 124's (`git log f35ab99 --first-parent --grep='^docs(deploy): ' -n 36`) are each one single-parent `docs(deploy): ... [skip ci]` commit that only modifies `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `docs/audit/baseline-metrics.md` and the phase's ADR. The four before them (Phases 121 to 124) also edited `docs/audit/claude-md-history.md`, which the `merged` procedure no longer touches.

## Decision

- **D1: The hook is the guard.** `scripts/git-hooks/pre-push` is the versioned source, kept LF by `.gitattributes`, and `.git/hooks/pre-push` is a byte copy, installed or reinstalled by hand with `cp scripts/git-hooks/pre-push .git/hooks/pre-push`. It keeps the herdr guard and adds two rules:
  - Everywhere, a push to `refs/heads/main` is refused unless it is a fast-forward of single-parent commits whose subject matches `docs(deploy): ... [skip ci]` and whose every change modifies `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `docs/audit/baseline-metrics.md` or an existing `docs/audit/decisions/NNNN-*.md`. Deleting or creating `main` is refused.
  - Inside a herdr pane, deleting or rewinding any remote branch is refused.
- **D2: A copy, not `core.hooksPath`.** Pointing `core.hooksPath` at the versioned folder would make the live guard whatever the checked-out branch holds, so a task's edit would change it before any review. `.git/` is a protected path in Claude Code, so the copy changes only through a deliberate install.
- **D3: The permission rules.** `.claude/settings.json` drops the ask rules `Bash(git push:*)`, `Bash(ALLOW_GIT_WRITE=1 git push:*)`, `Bash(gh pr create:*)` and `PowerShell(gh pr create:*)`. It allows `Bash(ALLOW_GIT_WRITE=1 git push -u origin phase-*)`, `Bash(ALLOW_GIT_WRITE=1 git push origin main)`, `Bash(ALLOW_GIT_WRITE=1 git push origin main 2>&1)`, the release form `gh pr create --base main --head phase-* --title * --body-file *` in Bash and in PowerShell, and `Bash(herdr notification show *)`. In both shells it denies `git push* --no-v*`, so no agent skips the hook with `--no-verify` or an abbreviation of it, and six `gh pr create` forms through which the release rule's wildcards could change the pull request's target: a second `--base` or `--head`, or ` -B`, ` -H`, `--repo` or ` -R` anywhere. Any other push or `gh pr create` matches no rule: Manual mode prompts, and auto mode sends it to the classifier, whose `soft_deny` in the owner's `~/.claude/settings.json` names `git push` to origin. `PowerShell(git push:*)`, the `git merge` and `git rebase` ask rules and the two GitHub MCP ask rules stay.
- **D4: Test first, allow last.** `unit/pre-push-guard.test.ts` installs the versioned hook in a scratch clone and pushes to a local bare repository, never to the real origin: 18 cases, 13 of which fail against the old hook. T828 installed and tested the hook, and replayed the 36 deploy records through the installed copy, before it added the allow rules. MASTER's preflight runs `cmp -s scripts/git-hooks/pre-push .git/hooks/pre-push` and pushes nothing while it fails.
- **D5: MASTER tells the owner when a step waits on a prompt.** MASTER's instructions are `~/.claude/commands/finlife.md`, the owner's user-level slash command, outside the repository and not versioned. They now run `herdr notification show` before any command that will wait on a permission prompt and when fin-builder is blocked; `release` runs `gh pr create` in the allowed form as a command of its own, with the body file's path written `C:/...` so it needs no `MSYS_NO_PATHCONV=1` prefix; and the `merged` procedure pushes with `ALLOW_GIT_WRITE=1 git push origin main`. A prompt MASTER did not expect is still announced by the owner's user-level `PermissionRequest` notifier; sub-agent prompts stay muted there by its `suppressSubagentInteractions` setting, which this ADR does not change.

## Consequences

- The Release (the push and `gh pr create`) and the deploy-record push run without a prompt; an unattended phase waits only where the owner merges.
- `gh pr create` needs no hook. It changes no branch: it opens a pull request from a branch the guarded push already published. Merging stays with the owner, or with the existing `gh pr merge <n> --auto --merge` rule under the Release bullet's conditions and `main`'s required checks.
- In auto mode, a `gh pr create` in any other form now goes to the classifier instead of a prompt. The classifier's default lets through a pull request that matches the request, and no `soft_deny` entry names `gh pr create`; the deny rules still refuse another base, head or repository.
- The guard on `main` also applies to the owner's own terminal. A deliberate exception is `git push --no-verify`, typed by the owner.
- A fresh clone has no guard until the owner runs the `cp` above; MASTER's preflight reports it.
- Any existing ADR passes the file check, not only the phase's own. It is a docs file; accepted.
- Every Claude Code session in this clone, reviewer sub-agents included, can run the allowed forms without a prompt. The hook bounds what they can do to `main`; the phase-branch wildcard also admits extra refspecs, which can only create or fast-forward other branches.

## Not done

- No `core.hooksPath`, no npm install script and no `postinstall` hook.
- No limit on which branches other than `main` a push may create or advance.
- `.git/hooks/pre-commit` is unchanged and still untracked.
- No PowerShell push allow rule: PowerShell has no `VAR=1 command` form.
- No `PreToolUse` hook and no change to the owner's `~/.claude/settings.json` (its `autoMode` block and notifier settings).
- No test of the permission rules: it would test a copy of Claude Code's matcher (ADR 0101, Phase 157 amendment 1). Phase 159's own release is the first live check.

## Verification

T828's gates: `unit/pre-push-guard.test.ts` had 13 failed and 5 passed against the old hook, then 18 passed; the installed hook is byte-identical to `scripts/git-hooks/pre-push`; the installed hook accepted all 36 deploy records and refused merge `160c4b7` onto `5d993de`; the settings rule lists are allow 8, deny 113, ask 7.
