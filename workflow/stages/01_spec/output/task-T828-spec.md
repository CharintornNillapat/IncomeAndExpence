# T828 spec: Unattended pushes behind a pre-push guard

Phase 159, branch `phase-159-unattended-pushes` (cut from `main` at `f35ab99`). This is the phase's only and last task, so it ships the phase. Reviewer tier: strict (`fin-reviewer-strict`, Opus) for every review round. On the pause list (`.claude/settings.json`, `AGENTS.md`); the PR is merged by the owner, never auto-merged.

Source: Backlog row A in `docs/audit/task-ledger.md` (the row starting "Unattended pushes: the `ask` rules on `git push` in `.claude/settings.json` stall every unattended phase"), an uncommitted edit on this branch that goes into this task's commit, plus the owner's six mandatory additions of 2026-10-29.

**Amendment 1 (owner, 2026-10-29, after GO; no further pause).** The owner accepted removing the two Bash push ask rules and the edit to `~/.claude/commands/finlife.md`, and changed two things: (1) instead of a new Backlog row for the release stopping at `gh pr create`, this task allows the exact release form `gh pr create --base main --head phase-* ...` in Bash and PowerShell (Block B14), which forces removing the two `gh pr create` ask rules and adds six deny rules per shell (Blocks B15, B16); the Backlog-row block is gone and Block B13 is now MASTER's release step; (2) the spec confirms with evidence that the owner's auto-mode `soft_deny` on `git push` does not block the allowed forms (section 4, "Auto mode and the owner's soft_deny"). Every dependent count, gate and note below is updated.

## 1. Goal

The Release push of the phase branch, the release's `gh pr create`, and the deploy-record push to `main` run without a permission prompt, so an unattended phase no longer stalls (89 min in Phase 158). A versioned, tested pre-push hook, installed and tested before any allow rule exists, keeps `main` closed to everything but the deploy record, and MASTER tells the owner whenever a step will wait on a permission prompt.

## 2. Target files

```text
docs/audit/decisions/0114-unattended-pushes-pre-push-guard.md
unit/pre-push-guard.test.ts
scripts/git-hooks/pre-push
.gitattributes
.git/hooks/pre-push
.claude/settings.json
AGENTS.md
README.md
docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md
~/.claude/commands/finlife.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
docs/audit/task-ledger.md
```

Notes on the list:

- `.git/hooks/pre-push` is the live hook, untracked; the builder overwrites it only by copying `scripts/git-hooks/pre-push` (step 5). `.git/hooks/pre-commit` is not a target.
- `~/.claude/commands/finlife.md` (`C:\Users\MRmar\.claude\commands\finlife.md`) is MASTER's instruction file: the owner's user-level Claude Code slash command `/finlife`, outside the repository and never committed. If the builder's tools cannot write it, stop with `BLOCKED` naming that file; do not skip it.
- `docs/audit/task-ledger.md` is bookkeeping and is also a commit target: it already holds the uncommitted Backlog row A and row B edits of 2026-10-29, which stay as they are apart from the edits in step 8.
- Temporary files: the unit test and Gate 4 create git repositories under the OS temp folder and delete them. They push only to a local bare repository there. The owner's addition 2 of 2026-10-29 is the explicit go-ahead for those `git commit`, `git merge` and `git push` calls inside temp repositories; nothing pushes to `origin`, and nothing commits in this repository.

## 3. Context to read

None of `docs/contexts/`: the task is agent tooling, not app code. Read `AGENTS.md` (Stop and ask first, ICM workflow section, lines 33 to 42 and 122 to 136) and ADR 0101's amendments at `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md:124` to `:156` (Phase 128 amendment 4, Phase 130 amendment 1, Phase 157 amendment 1), which kept the push ask rules this task removes.

## 4. Current behaviour

1. `.claude/settings.json:4` to `:7` is `permissions.allow` with 2 rules (`gh pr merge * --auto --merge*` in Bash and PowerShell). `:8` to `:108` is `deny` with 99 rules, ending `:100` `"Bash(npx vercel:*)",` (followed at `:101` by `"PowerShell(gh pr merge* --squash*)",`) and `:107` `"PowerShell(npx vercel:*)"`. `:109` to `:121` is `ask` with 11 rules: `:110` `Bash(ALLOW_GIT_WRITE=1 git push:*)`, `:111` `Bash(git push:*)`, `:112` `Bash(git merge:*)`, `:113` `Bash(git rebase:*)`, `:114` `Bash(gh pr create:*)`, `:115` `PowerShell(git push:*)`, `:116` to `:118` PowerShell merge, rebase and `gh pr create`, `:119` `mcp__github__create_pull_request`, `:120` `mcp__github__create_branch`. The file is 123 lines, CRLF in the working tree (`i/lf w/crlf`). Lines `:110`, `:111`, `:114` (`Bash(gh pr create:*)`) and `:118` (`PowerShell(gh pr create:*)`) are the four ask rules this task removes. The deny list already uses the flag-guard style this task copies: `:94` to `:98` `Bash(gh pr merge* --squash*)` ... `Bash(gh pr merge* -r*)` (ADR 0101, Phase 157 amendment 1).
2. Claude Code's matching (https://code.claude.com/docs/en/permissions.md, fetched 2026-10-29): rules are checked deny, then ask, then allow; the first match wins, and "a matching ask rule prompts even when a more specific allow rule also matches". "A deny or ask rule matches past any leading assignment", while an allow rule matches past only known-safe variables, so an allow rule must spell `ALLOW_GIT_WRITE=1` itself. Hence an allow rule for `ALLOW_GIT_WRITE=1 git push origin main` can never fire while `Bash(git push:*)` stays an ask rule, and no ask rule can keep the other pushes asking without also catching the allowed ones. Bash rules match command text, "isn't a security boundary around the program". The same holds for `gh pr create`: an allow rule for the release form never fires while `Bash(gh pr create:*)` (or, in PowerShell, `PowerShell(gh pr create:*)`) is an ask rule, so both go. "A `*` in a Bash rule matches any text, including spaces", "Claude Code matches everything before the first `*` as written", and PowerShell rules "use the same shape" with "Matching is case-insensitive". In Manual mode an unmatched command prompts. Auto mode is covered in its own subsection below.
3. `.git/hooks/pre-push` (untracked, 7 lines, LF) is the herdr guard only: when `HERDR_ENV=1` and `ALLOW_GIT_WRITE` is not `1` it prints "Commits and pushes inside herdr go only through the orchestrator." and exits 1; otherwise exits 0. It never looks at refs. `.git/hooks/pre-commit` is the same guard for commits. `core.hooksPath` is unset; `core.autocrlf` is `true`; `.gitattributes` holds one line, `index.html text eol=lf` (CRLF in the working tree).
4. `~/.claude/commands/finlife.md` (94 lines, LF) is MASTER. `:11` is the preflight branch check. `:15` tells MASTER that Git Bash rewrites an argument starting with `/` and to prefix such commands with `MSYS_NO_PATHCONV=1`; such a prefix is an unknown assignment, past which an allow rule does not match. `:69` is release step 2: it writes the PR body to a scratchpad file and runs `gh pr create --base main --head <branch> --title "phase <n>: <slug>" --body-file <file>` (flags in that order, the title in double quotes, `<file>` unconstrained), which is the form Block B14 allows. `:51` says what to do when fin-builder is blocked (read the pane, show the owner, wait). `:68` is the release push `ALLOW_GIT_WRITE=1 git push -u origin <branch>`. `:81` is the `merged` step 4, which pushes main with a bare `ALLOW_GIT_WRITE=1 git push` (no remote or ref, so it would not match an exact allow rule). `:88` to `:94` are the Rules for MASTER; `:90` is the `ALLOW_GIT_WRITE=1` rule. Nothing in it notifies the owner. The owner's user-level `PermissionRequest` hook (`~/.claude/hooks/claude-notifier-on-permission.ps1`) already pops a desktop notice for MASTER's own prompts, but mutes sub-agent prompts (`suppressSubagentInteractions: true` in `~/.claude/hooks/claude-notifier-config.json`); it does not reach a fin-builder prompt, which is a herdr pane. `herdr notification show <title> [--body TEXT] [--sound none|done|request]` exists.
5. Every deploy record on `main` since Phase 124's is a single-parent `docs(deploy): ... [skip ci]` commit whose changes are all `M` of `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `docs/audit/baseline-metrics.md` or one `docs/audit/decisions/NNNN-*.md`: the 36 newest from `git log f35ab99 --first-parent --grep='^docs(deploy): ' -n 36` (checked at spec time). The four before them (Phases 121 to 124) also edited `docs/audit/claude-md-history.md`.
6. `AGENTS.md:11` states `1606 tests, 72 files`; `README.md:160` states `1606 tests in 72 files`. `AGENTS.md:136` is the last ICM bullet ("The one exception on `main`"), followed by a blank line and `## Environment`. ADR 0101 ends at `:156` (Phase 157 amendment 2) with CRLF. The ledger's Phase 158 section ends just before `## Backlog`; `docs/audit/refactor-log.md:20` is the Phase 158 entry; `docs/audit/baseline-metrics.md:26` is the Phase 158 section. The last ADR is 0113.
7. CI runs `npm run test:unit` on `ubuntu-24.04` directly (`.github/workflows/playwright.yml:76` to `:122`), where `git` and `/bin/sh` (dash) exist.

### Auto mode and the owner's soft_deny (owner amendment, part 2)

**Result: the owner's `soft_deny` on `git push` does not block the allowed push forms, nor the allowed `gh pr create` form. No environment change is needed.** Evidence, checked at spec time:

1. **The owner's entries.** `~/.claude/settings.json:154` to `:159`, the only `autoMode` block on this machine, holds `soft_deny` and `environment` and nothing else (no `allow`, `hard_deny` or `classifyAllShell`). Its `soft_deny` list, as JSON strings (the file holds a literal U+2014 where the second string shows `\u2014`):

   ```json
   "$defaults",
   "Bash(git push:*) targeting origin on CharintornNillapat/IncomeAndExpence \u2014 public repo, confirm before publishing new commits",
   "Bash(vercel deploy --prod*) or equivalent production deploy commands to income-and-expence.vercel.app"
   ```

   The related `environment` entries (`:164`, `:183`) name the repository as public. `~/.claude/settings.json` has no `permissions` block; neither `~/.claude/settings.local.json` nor `.claude/settings.local.json` exists; no `C:\Program Files\ClaudeCode\` (managed settings) folder exists. `claude auto-mode config` (Claude Code 2.1.312) prints keys `allow`, `soft_deny`, `hard_deny`, `environment`, includes the owner's entry above in `soft_deny`, and has no `classifyAllShell`.
2. **`soft_deny` is a classifier rule.** auto-mode-config.md, "Override the block and allow rules": "`autoMode.soft_deny`: destructive actions that user intent can clear" and "Each is an array of prose descriptions, read as natural-language rules. For tool-pattern-based hard blocks that run before the classifier, use `permissions.deny`." The `Bash(git push:*)` text inside the owner's entry is prose read by the classifier, not a permission rule.
3. **Permission rules resolve before the classifier.** permission-modes.md, "How the classifier evaluates actions": "Each action goes through a fixed decision order. The first matching step wins: 1. Actions matching your allow, ask, or deny rules resolve immediately, with these exceptions: ..." and "3. Everything else goes to the classifier". auto-mode-config.md: "Deny and explicit ask rules are evaluated before the classifier", and "The classifier is a second gate that runs after the permissions system".
4. **None of step 1's exceptions applies to these commands.** The exceptions are protected-path writes, `rm`/`rmdir` critical-path removals, MCP tools marked `requiresUserInteraction`, shell commands with per-command allowed domains (sandbox; this repo and the owner configure no sandbox), content ask rules (this task removes the matching ones), symlinked protected writes and network-path reads.
5. **Narrow shell allow rules stay in effect in auto mode.** auto-mode-config.md, "Route all shell commands through the classifier": "By default, narrow Bash and PowerShell allow rules such as `Bash(npm test)` stay in effect in auto mode. Claude Code resolves them before the classifier runs ... Claude Code suspends only the broad rules that grant arbitrary code execution". permission-modes.md lists what is dropped: "Blanket `Bash(*)` or `PowerShell(*)`", "Wildcarded interpreters like `Bash(python*)`", "Package-manager run commands", "`Agent` allow rules", "`Monitor` allow rules". None of B14's rules is one of these. Only `autoMode.classifyAllShell: true` would "suspend every Bash and PowerShell allow rule while auto mode is active", and the owner has not set it.

Precedence, in short: deny, then ask, then allow (permissions.md); a match resolves immediately; only an unmatched command reaches the classifier, where `hard_deny`, then `soft_deny`, then `allow` exceptions, then explicit user intent apply. So the owner's `soft_deny` still reaches every push that matches no allow rule (the bare `ALLOW_GIT_WRITE=1 git push`, a push to another branch, a push without the prefix), and in Manual mode it plays no part at all.

One thing the docs do not show directly: they say an allow rule does not match past an assignment of an unknown variable and that a Bash rule matches the whole command text, but they give no example of a rule that spells the assignment itself, as `Bash(ALLOW_GIT_WRITE=1 git push origin main)` does. This spec does not test Claude Code's matcher (ADR 0101, Phase 157 amendment 1: a test would test a copy of it). The first live uses are this phase's own release push, `gh pr create` and deploy-record push; MASTER reports whether any of them prompted or was refused by the classifier, and the deploy record notes it (section 8, item 4).

### What the new rules do (the design the gates lock)

| Command (Bash tool) | Claude Code | Hook |
|---|---|---|
| `ALLOW_GIT_WRITE=1 git push -u origin phase-159-unattended-pushes` | allowed, no prompt | herdr guard passes; non-`main` ref; refused only if it deletes or rewinds a branch |
| `ALLOW_GIT_WRITE=1 git push origin main` (or with ` 2>&1`) | allowed, no prompt | refused unless every new commit is a deploy record and the push is a fast-forward |
| `ALLOW_GIT_WRITE=1 git push` (bare, the old `merged` text) | no rule: Manual mode prompts, auto mode goes to the classifier (`soft_deny`) | as above |
| `ALLOW_GIT_WRITE=1 git push origin feature-x`, `git push origin main` with no prefix | no rule: prompt or classifier | without the prefix inside herdr, refused by the herdr guard |
| `ALLOW_GIT_WRITE=1 git push -u origin phase-1 --force` | allowed (the `*` matches) | inside herdr, refused (non-fast-forward) |
| `ALLOW_GIT_WRITE=1 git push -u origin phase-1 main` or `phase-1:main` | allowed | the `main` update is checked as a deploy record |
| anything with ` --no-verify` (or ` --no-v...`) | denied, both shells | not run |
| `ALLOW_GIT_WRITE=1 git push origin --delete main` | no rule: prompt or classifier | refused |
| PowerShell `git push ...` | ask (unchanged) | as above |
| `gh pr create --base main --head phase-159-unattended-pushes --title "phase 159: unattended-pushes" --body-file C:/Users/.../scratchpad/pr-body.md` (MASTER's release step 2, Bash or PowerShell) | allowed, no prompt | n/a (changes no branch) |
| `gh pr create` with a second `--base` or `--head`, or with ` -B`, ` -H`, `--repo` or ` -R` anywhere (PowerShell: case-insensitive, so ` -b`, ` -h`, ` -r` too) | denied, both shells | n/a |
| any other `gh pr create` (another flag order, `--base` other than `main` first, `--fill`, a `MSYS_NO_PATHCONV=1` or `GH_REPO=...` prefix) | no rule: Manual mode prompts; auto mode goes to the classifier, whose default lets a pull request that matches the request through (permission-modes.md) and which no `soft_deny` entry of the owner's names | n/a |
| `herdr notification show "..." --body "..." --sound request` | allowed, no prompt | n/a |

The branch push to a non-`main` ref "staying under the ask rule" (owner addition 2) is Claude Code behaviour, not hook behaviour: it is locked by Gate 6 (no allow rule covers it) and by the docs quoted above, not by the bare-repository test, which can only show that the hook leaves such a push to the prompt (test "leaves a push to another branch alone outside herdr").

## 5. Parity map

None. (`.gitattributes` gains a line, but the `index.html` row is about the inline-script hash, which this task does not touch.)

## 6. Tests to add

`unit/pre-push-guard.test.ts` (Block B2, exact). It copies `scripts/git-hooks/pre-push` into a scratch hooks folder, points a scratch clone's `core.hooksPath` at it, and pushes to a bare repository in the OS temp folder: never `origin`, never this repository. It strips every `GIT_*` variable, `HERDR_ENV` and `ALLOW_GIT_WRITE` from the child environment, then sets them per case, so it behaves the same inside a herdr pane and in CI. 18 tests:

| # | Test | Old hook (red) | New hook |
|---|---|---|---|
| 1 | refuses a deploy-record message on a commit that touches a code file (owner case a) | fails | passes |
| 2 | accepts a deploy record that modifies only the files the merged procedure edits (owner case b) | passes | passes |
| 3 | refuses a subject without the docs(deploy) prefix | fails | passes |
| 4 | refuses a subject without the [skip ci] suffix | fails | passes |
| 5 | refuses a range that holds a code commit after a valid deploy record (mixed) | fails | passes |
| 6 | refuses a deploy record that touches another docs file (`docs/audit/README.md`) | fails | passes |
| 7 | refuses a deploy record that adds a new ADR | fails | passes |
| 8 | refuses a merge commit even when both sides are deploy records | fails | passes |
| 9 | refuses a force push that rewrites main | fails | passes |
| 10 | refuses deleting main (the bare remote refuses it too, but without the guard's message) | fails | passes |
| 11 | refuses a code commit pushed to main from another branch (`feature:main`) | fails | passes |
| 12 | leaves a push to another branch alone outside herdr | passes | passes |
| 13 | inside herdr: refuses every push without ALLOW_GIT_WRITE=1 | passes | passes |
| 14 | inside herdr: accepts the phase-branch push of the release procedure | passes | passes |
| 15 | inside herdr: does not open main to a code commit when ALLOW_GIT_WRITE=1 is set | fails | passes |
| 16 | inside herdr: accepts the deploy-record push of the merged procedure | passes | passes |
| 17 | inside herdr: refuses a force push to a phase branch | fails | passes |
| 18 | inside herdr: refuses deleting a remote branch | fails | passes |

Why it fails today: the current hook (Old hook text below) never reads the refs, so every "refuses" case outside the herdr guard pushes successfully, and test 10's refusal comes from the bare remote without the `pre-push guard:` message. Red result: `Tests  13 failed | 5 passed (18)`. Both results were reproduced at spec time in a scratch copy (red 13 failed, 5 passed; green 18 passed in about 28 s on this Windows machine, about 1.5 s per test, so each `describe` sets a 30 s timeout).

Red run order (stage 02 step 4): the test is written first and run against a byte copy of the current hook placed at `scripts/git-hooks/pre-push` (step 3), not against a missing file.

Stage 03 step 6 (the reviewer's repeat), after Gate 3 passes:

```bash
cp workflow/stages/02_build/output/logs/T828-pre-push.old scripts/git-hooks/pre-push
npx vitest run unit/pre-push-guard.test.ts > workflow/stages/03_review/output/logs/T828-red.log 2>&1
cp .git/hooks/pre-push scripts/git-hooks/pre-push && cmp scripts/git-hooks/pre-push .git/hooks/pre-push && echo restored
```

Expect `Tests  13 failed | 5 passed (18)` in the log, then `restored`. Before it, confirm the backup is the old hook: its text equals the Old hook text block below (CRLF ignored).

Old hook text (the current `.git/hooks/pre-push`, for reference only):

```sh
#!/bin/sh
# Local herdr guard (untracked). Inside a herdr pane, block pre-push unless ALLOW_GIT_WRITE=1.
if [ "${HERDR_ENV:-}" = "1" ] && [ "${ALLOW_GIT_WRITE:-}" != "1" ]; then
  echo "Commits and pushes inside herdr go only through the orchestrator." >&2
  exit 1
fi
exit 0
```

No Playwright spec is affected: nothing under `src/`, `tests/`, `index.html` or `public/` changes.

## Build steps (binding order: owner addition 1)

Write every new file and every block with your file-writing tool, never a shell heredoc (heredocs have eaten backslashes here before; Blocks B1 and B2 hold `\.` and `\n`). Keep each existing file's line endings (CRLF in the working tree for every repo file listed in Gate 11; LF for `finlife.md`). Leave `.claude/settings.json` untouched until step 6.

1. **ADR first.** Create `docs/audit/decisions/0114-unattended-pushes-pre-push-guard.md` with exactly Block B4.
2. **Back-ups** (gitignored logs):
   ```bash
   cp .git/hooks/pre-push workflow/stages/02_build/output/logs/T828-pre-push.old
   cp ~/.claude/commands/finlife.md workflow/stages/02_build/output/logs/T828-finlife.md.orig
   ```
3. **Red.** Create `unit/pre-push-guard.test.ts` with exactly Block B2. Then `mkdir -p scripts/git-hooks && cp .git/hooks/pre-push scripts/git-hooks/pre-push` and run Gate 1.
4. **Green.** Overwrite `scripts/git-hooks/pre-push` with exactly Block B1 (LF only, ending in one `\n`). Add Block B3 as the second line of `.gitattributes` (CRLF, like the first). Run Gate 2.
5. **Install, then test the installed copy.** `cp scripts/git-hooks/pre-push .git/hooks/pre-push`, then run Gate 3 and Gate 4. Both must pass before step 6. If either fails, stop: fix the hook, rerun Gates 2 to 4, and never touch `.claude/settings.json` while any of them fails.
6. **Allow rules last.** Edit `.claude/settings.json`: replace the `allow` array with Block B14; insert the seven Bash deny lines of Block B15 (from `"Bash(git push* --no-v*)",` to `"Bash(gh pr create* -R*)",`) after `"Bash(npx vercel:*)",`; add `,` after `"PowerShell(npx vercel:*)"` and append the seven PowerShell deny lines of Block B16 (from `"PowerShell(git push* --no-v*)",` to `"PowerShell(gh pr create* -R*)"`, the last without a comma) as the deny list's last entries; delete the four ask lines `"Bash(ALLOW_GIT_WRITE=1 git push:*)",`, `"Bash(git push:*)",`, `"Bash(gh pr create:*)",` and `"PowerShell(gh pr create:*)",` (Block B16 shows the resulting start of `ask`). Six-space indentation, CRLF, nothing else changes. Run Gates 5 and 6.
7. **Docs and MASTER.**
   - `AGENTS.md`: replace line 11 (Old text for B5) with Block B5; insert Block B6 as a new line directly after line 136 (the "The one exception on `main`" bullet), before the blank line.
   - `README.md`: replace line 160 (Old text for B7) with Block B7.
   - ADR 0101: append a blank line and Block B8 after the last line (`:156`), keeping CRLF and a final CRLF.
   - `~/.claude/commands/finlife.md` (LF): insert Block B9 as a new line directly after line 11; replace line 51 with Block B10; in line 69 replace the Old text for B13 with Block B13, leaving the rest of the line as it is; in line 81 replace the Old text for B12 with Block B12, leaving the rest of the line as it is; insert Block B11 as a new line directly after line 90. (Line numbers are those of the step 2 backup.)
8. **Ledger, log, metrics** (this task ships the phase):
   - `docs/audit/task-ledger.md`: add `## Phase 159 - Unattended pushes behind a pre-push guard (ADR 0114)` from the template, directly before `## Backlog`, with the line "Branch `phase-159-unattended-pushes`, cut from `main` at `f35ab99`. One task, T828. No migration." and the T828 row (Task: "Pre-push guard for main (versioned, tested, installed), push and release `gh pr create` allow rules after it, MASTER prompt notices, ADR 0114, Phase 159 closing docs"; Files: the repo paths of section 2 plus `~/.claude/commands/finlife.md (outside the repo)`; Status and Gate result per stage 02; Commit empty). Set Backlog row A's Status to `done in Phase 159 (T828)` (Block B17), changing nothing else in that row. Add no new Backlog row.
   - `docs/audit/refactor-log.md`: a new entry directly above the Phase 158 entry, followed by a blank line, `---` and a blank line like the others. Heading: `## Phase 159 - Unattended pushes behind a pre-push guard: T828 (2026-10-29, code \`<sha>\`, merged \`<sha>\`)`. First line: "ADR `0114`. The Release push of the phase branch, the release's `gh pr create` and the deploy-record push to `main` run without a permission prompt; a versioned, tested pre-push hook installed in `.git/hooks/` refuses any push to `main` but a deploy record and, inside herdr, any branch deletion or rewind; MASTER announces each step that will wait on a prompt." **Changed** and **Verified** per stage 02 (Changed also names `~/.claude/commands/finlife.md` (outside the repo, not committed) and `.git/hooks/pre-push` (untracked, installed copy)). **Surprises**: Claude Code checks ask before allow and an ask rule matches past `ALLOW_GIT_WRITE=1`, so the two blanket Bash push ask rules and both `gh pr create` ask rules had to go rather than stay beside narrow allows; a `*` matches spaces, so the release's `gh pr create` rule needed six deny rules per shell to keep its wildcards from admitting another base, head or repository; the owner's auto-mode `soft_deny` on `git push` is a classifier rule and never sees a command an allow rule matches; the deploy records of Phases 121 to 124 also edited `docs/audit/claude-md-history.md` and would be refused today, while all 36 since pass; plus anything the build or review report names. **Deliberately not done**: the ADR's Not done list, in one sentence; Backlog row B (builder chromium-only runs) is a separate task; filling the `<sha>` placeholders and the Commit cell, left to the post-merge deploy record.
   - `docs/audit/baseline-metrics.md`: `### Phase 159 - delta against Phase 158` at the top of Figures: Vitest 73 files, 1624 tests (+1 file, +18 tests), the pass count and time from `T828-unit.log`, and the new file's own time from `T828-green.log`; Playwright unchanged at 213 tests, 37 files, 639 runs, not run (no affected spec); bundle not rebuilt, since no build input changed (`src/`, `index.html`, `public/`, `vite.config.ts`, `package.json` untouched), so the Phase 158 figures stand; dependencies unchanged.
9. Run Gates 7 to 13, then write the build report.

## The exact texts

**Block B1** in `scripts/git-hooks/pre-push`:

```sh
#!/bin/sh
# Pre-push guard (ADR 0114). The source of truth is scripts/git-hooks/pre-push;
# the live copy is .git/hooks/pre-push, which git never versions.
# Install or reinstall: cp scripts/git-hooks/pre-push .git/hooks/pre-push
# Test: npx vitest run unit/pre-push-guard.test.ts
#
# 1. Inside a herdr pane (HERDR_ENV=1), refuse every push unless ALLOW_GIT_WRITE=1.
# 2. Inside a herdr pane, refuse deleting or rewinding any remote branch.
# 3. Everywhere, refs/heads/main takes only fast-forward, single-parent commits
#    whose subject is "docs(deploy): ... [skip ci]" and which only modify
#    docs/audit/refactor-log.md, docs/audit/task-ledger.md,
#    docs/audit/baseline-metrics.md or an existing docs/audit/decisions/NNNN-*.md.
if [ "${HERDR_ENV:-}" = "1" ] && [ "${ALLOW_GIT_WRITE:-}" != "1" ]; then
  echo "Commits and pushes inside herdr go only through the orchestrator." >&2
  exit 1
fi

ALLOWED='^M[[:space:]]docs/audit/(refactor-log|task-ledger|baseline-metrics)\.md$|^M[[:space:]]docs/audit/decisions/[0-9]{4}-[^/]+\.md$'

fail() {
  echo "pre-push guard: $1" >&2
  exit 1
}

is_zero() {
  case $1 in
    *[!0]*) return 1 ;;
    *) return 0 ;;
  esac
}

while read -r local_ref local_sha remote_ref remote_sha; do
  if [ "$remote_ref" = refs/heads/main ]; then
    main=1
  else
    main=
    [ "${HERDR_ENV:-}" = "1" ] || continue
  fi
  if is_zero "$local_sha"; then
    fail "refusing to delete $remote_ref"
  fi
  if is_zero "$remote_sha"; then
    [ -n "$main" ] || continue
    fail "refusing to create refs/heads/main"
  fi
  git merge-base --is-ancestor "$remote_sha" "$local_sha" 2>/dev/null ||
    fail "refusing a non-fast-forward push to $remote_ref (fetch first; never force)"
  [ -n "$main" ] || continue
  if [ -n "$(git rev-list --min-parents=2 "$remote_sha..$local_sha")" ]; then
    fail "refusing a merge commit on refs/heads/main"
  fi
  for commit in $(git rev-list "$remote_sha..$local_sha"); do
    case $(git log -1 --format=%s "$commit") in
      'docs(deploy): '*' [skip ci]') ;;
      *) fail "$commit is not a 'docs(deploy): ... [skip ci]' deploy record; refs/heads/main takes nothing else" ;;
    esac
    bad=$(git diff-tree --no-commit-id -r --no-renames --name-status "$commit" | grep -Ev "$ALLOWED")
    if [ -n "$bad" ]; then
      fail "$commit changes a file a deploy record may not touch: $bad"
    fi
  done
done
exit 0
```

**Block B2** in `unit/pre-push-guard.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The pre-push guard (ADR 0114). `scripts/git-hooks/pre-push` is the source of
 * the untracked `.git/hooks/pre-push`. Each test installs the versioned copy as
 * the hook of a scratch clone and pushes to a local bare repository, never to
 * the real origin.
 */

const HOOK = fileURLToPath(new URL('../scripts/git-hooks/pre-push', import.meta.url));
const DEPLOY = 'docs(deploy): record phase 1 release and post-merge checks [skip ci]';
const RECORD_FILES = [
  'docs/audit/refactor-log.md',
  'docs/audit/task-ledger.md',
  'docs/audit/baseline-metrics.md',
  'docs/audit/decisions/0001-seed.md',
];
const HERDR = { HERDR_ENV: '1' };
const ORCHESTRATOR = { HERDR_ENV: '1', ALLOW_GIT_WRITE: '1' };
const GUARD = 'pre-push guard:';
const HERDR_REFUSAL = 'Commits and pushes inside herdr go only through the orchestrator.';

let root = '';
let remote = '';
let work = '';
let seed = '';
let edits = 0;

function git(args: string[], extra: Record<string, string> = {}, cwd = work) {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('GIT_') || key === 'HERDR_ENV' || key === 'ALLOW_GIT_WRITE') delete env[key];
  }
  return spawnSync('git', args, { cwd, env: { ...env, ...extra }, encoding: 'utf8' });
}

function run(args: string[], cwd = work) {
  const result = git(args, {}, cwd);
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function commit(files: string[], message: string) {
  for (const file of files) {
    mkdirSync(dirname(join(work, file)), { recursive: true });
    writeFileSync(join(work, file), `edit ${++edits}\n`);
  }
  run(['add', '--', ...files]);
  run(['commit', '-q', '-m', message]);
  return run(['rev-parse', 'HEAD']);
}

const push = (args: string[], extra: Record<string, string> = {}) => git(['push', '-q', ...args], extra);
const remoteRef = (ref: string) => git(['rev-parse', '-q', '--verify', `refs/heads/${ref}`], {}, remote).stdout.trim();

function expectRefused(result: ReturnType<typeof push>, message = GUARD) {
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(message);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'pre-push-guard-'));
  remote = join(root, 'remote.git');
  work = join(root, 'work');
  const hooks = join(root, 'hooks');
  mkdirSync(hooks);
  run(['init', '-q', '--bare', '-b', 'main', remote], root);
  run(['init', '-q', '-b', 'main', work], root);
  run(['config', 'user.name', 'Guard Test']);
  run(['config', 'user.email', 'guard@example.invalid']);
  run(['config', 'commit.gpgsign', 'false']);
  run(['config', 'core.hooksPath', hooks]);
  seed = commit([...RECORD_FILES, 'docs/audit/README.md', 'src/app.ts'], 'chore: seed');
  run(['remote', 'add', 'origin', remote]);
  run(['push', '-q', 'origin', 'main']);
  copyFileSync(HOOK, join(hooks, 'pre-push'));
  chmodSync(join(hooks, 'pre-push'), 0o755);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true, maxRetries: 3 });
});

describe('refs/heads/main takes only deploy records', { timeout: 30_000 }, () => {
  it('refuses a deploy-record message on a commit that touches a code file', () => {
    commit(['src/app.ts'], DEPLOY);
    expectRefused(push(['origin', 'main']));
    expect(remoteRef('main')).toBe(seed);
  });

  it('accepts a deploy record that modifies only the files the merged procedure edits', () => {
    const head = commit(RECORD_FILES, DEPLOY);
    expect(push(['origin', 'main']).status).toBe(0);
    expect(remoteRef('main')).toBe(head);
  });

  it.each([
    ['without the docs(deploy) prefix', 'docs: record phase 1 release and post-merge checks [skip ci]'],
    ['without the [skip ci] suffix', 'docs(deploy): record phase 1 release and post-merge checks'],
  ])('refuses a subject %s', (_name, message) => {
    commit(['docs/audit/task-ledger.md'], message);
    expectRefused(push(['origin', 'main']));
    expect(remoteRef('main')).toBe(seed);
  });

  it('refuses a range that holds a code commit after a valid deploy record', () => {
    commit(['docs/audit/task-ledger.md'], DEPLOY);
    commit(['src/app.ts'], 'fix: a code change');
    expectRefused(push(['origin', 'main']));
    expect(remoteRef('main')).toBe(seed);
  });

  it('refuses a deploy record that touches another docs file', () => {
    commit(['docs/audit/task-ledger.md', 'docs/audit/README.md'], DEPLOY);
    expectRefused(push(['origin', 'main']));
    expect(remoteRef('main')).toBe(seed);
  });

  it('refuses a deploy record that adds a new ADR', () => {
    commit(['docs/audit/decisions/0002-new.md'], DEPLOY);
    expectRefused(push(['origin', 'main']));
    expect(remoteRef('main')).toBe(seed);
  });

  it('refuses a merge commit even when both sides are deploy records', () => {
    run(['switch', '-q', '-c', 'side']);
    commit(['docs/audit/task-ledger.md'], DEPLOY);
    run(['switch', '-q', 'main']);
    commit(['docs/audit/refactor-log.md'], DEPLOY);
    run(['merge', '-q', '--no-ff', '-m', DEPLOY, 'side']);
    expectRefused(push(['origin', 'main']));
    expect(remoteRef('main')).toBe(seed);
  });

  it('refuses a force push that rewrites main', () => {
    const first = commit(['docs/audit/task-ledger.md'], DEPLOY);
    expect(push(['origin', 'main']).status).toBe(0);
    run(['reset', '-q', '--hard', seed]);
    commit(['docs/audit/baseline-metrics.md'], DEPLOY);
    expectRefused(push(['--force', 'origin', 'main']));
    expect(remoteRef('main')).toBe(first);
  });

  it('refuses deleting main', () => {
    expectRefused(push(['origin', '--delete', 'main']));
    expect(remoteRef('main')).toBe(seed);
  });

  it('refuses a code commit pushed to main from another branch', () => {
    run(['switch', '-q', '-c', 'feature']);
    commit(['src/app.ts'], 'feat: a code change');
    expectRefused(push(['origin', 'feature:main']));
    expect(remoteRef('main')).toBe(seed);
  });

  it('leaves a push to another branch alone outside herdr', () => {
    run(['switch', '-q', '-c', 'phase-1-test']);
    const head = commit(['src/app.ts'], 'feat: a code change');
    expect(push(['-u', 'origin', 'phase-1-test']).status).toBe(0);
    expect(remoteRef('phase-1-test')).toBe(head);
  });
});

describe('inside a herdr pane', { timeout: 30_000 }, () => {
  it('refuses every push without ALLOW_GIT_WRITE=1', () => {
    run(['switch', '-q', '-c', 'phase-1-test']);
    commit(['src/app.ts'], 'feat: a code change');
    expectRefused(push(['-u', 'origin', 'phase-1-test'], HERDR), HERDR_REFUSAL);
    expect(remoteRef('phase-1-test')).toBe('');
  });

  it('accepts the phase-branch push of the release procedure', () => {
    run(['switch', '-q', '-c', 'phase-1-test']);
    const head = commit(['src/app.ts'], 'feat: a code change');
    expect(push(['-u', 'origin', 'phase-1-test'], ORCHESTRATOR).status).toBe(0);
    expect(remoteRef('phase-1-test')).toBe(head);
  });

  it('does not open main to a code commit when ALLOW_GIT_WRITE=1 is set', () => {
    commit(['src/app.ts'], DEPLOY);
    expectRefused(push(['origin', 'main'], ORCHESTRATOR));
    expect(remoteRef('main')).toBe(seed);
  });

  it('accepts the deploy-record push of the merged procedure', () => {
    const head = commit(RECORD_FILES, DEPLOY);
    expect(push(['origin', 'main'], ORCHESTRATOR).status).toBe(0);
    expect(remoteRef('main')).toBe(head);
  });

  it('refuses a force push to a phase branch', () => {
    run(['switch', '-q', '-c', 'phase-1-test']);
    const first = commit(['src/app.ts'], 'feat: a code change');
    expect(push(['-u', 'origin', 'phase-1-test'], ORCHESTRATOR).status).toBe(0);
    run(['reset', '-q', '--hard', seed]);
    commit(['src/app.ts'], 'feat: another code change');
    expectRefused(push(['--force', 'origin', 'phase-1-test'], ORCHESTRATOR));
    expect(remoteRef('phase-1-test')).toBe(first);
  });

  it('refuses deleting a remote branch', () => {
    run(['switch', '-q', '-c', 'phase-1-test']);
    const head = commit(['src/app.ts'], 'feat: a code change');
    expect(push(['-u', 'origin', 'phase-1-test'], ORCHESTRATOR).status).toBe(0);
    expectRefused(push(['origin', '--delete', 'phase-1-test'], ORCHESTRATOR));
    expect(remoteRef('phase-1-test')).toBe(head);
  });
});
```

**Block B3** in `.gitattributes`:

```text
scripts/git-hooks/* text eol=lf
```

**Block B4** in `docs/audit/decisions/0114-unattended-pushes-pre-push-guard.md`:

```md
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
```

Old text for B5 (`AGENTS.md:11`, for finding the line):

```text
- **Tests:** Vitest in `unit/` (1606 tests, 72 files, PGlite replays every migration); Playwright in `tests/` (213 tests, 37 specs, 639 runs on three browsers).
```

**Block B5** in `AGENTS.md`:

```text
- **Tests:** Vitest in `unit/` (1624 tests, 73 files, PGlite replays every migration); Playwright in `tests/` (213 tests, 37 specs, 639 runs on three browsers).
```

**Block B6** in `AGENTS.md`:

```text
- **Unattended pushes [ADR 0114]:** three commands run without a permission prompt: `ALLOW_GIT_WRITE=1 git push -u origin phase-NNN-<slug>` and `gh pr create --base main --head phase-NNN-<slug> --title "phase NNN: <slug>" --body-file <file>` (Release, in exactly that form and order), and `ALLOW_GIT_WRITE=1 git push origin main` (the deploy record). `.claude/settings.json` denies a `gh pr create` that names a second base or head, or another repository. The guard is the pre-push hook, versioned as `scripts/git-hooks/pre-push`, installed with `cp scripts/git-hooks/pre-push .git/hooks/pre-push` and tested by `unit/pre-push-guard.test.ts`. It refuses any push to `main` but a fast-forward of single-parent `docs(deploy): ... [skip ci]` commits that only modify `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `docs/audit/baseline-metrics.md` or an existing ADR, and inside herdr it refuses deleting or rewinding any remote branch. Any other push or `gh pr create` matches no allow rule, so it waits on a prompt (in auto mode, on the classifier), and the orchestrator notifies the owner before a step that will wait on one. No agent pushes with `--no-verify`.
```

Old text for B7 (`README.md:160`):

```text
npm run test:unit    # Vitest: 1606 tests in 72 files, including every migration replayed in PGlite
```

**Block B7** in `README.md`:

```text
npm run test:unit    # Vitest: 1624 tests in 73 files, including every migration replayed in PGlite
```

**Block B8** in `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`:

```md
**Phase 159 (T828, 2026-10-29), branch `phase-159-unattended-pushes`.** ADR 0114 records the change; this note keeps the amendments above from reading as current.

1. **The Release and the deploy-record push run without a prompt.** `.claude/settings.json` no longer asks before `Bash(git push:*)`, `Bash(ALLOW_GIT_WRITE=1 git push:*)` or `gh pr create` in either shell, which Phase 128 amendment 4 and Phase 130 amendment 1 kept. It allows the Release push `ALLOW_GIT_WRITE=1 git push -u origin phase-*`, the release's `gh pr create --base main --head phase-* --title * --body-file *` and the deploy-record push `ALLOW_GIT_WRITE=1 git push origin main`, and denies the `gh pr create` forms that would change the pull request's base, head or repository. The pre-push hook, now versioned as `scripts/git-hooks/pre-push` and copied into `.git/hooks/`, keeps the herdr guard and refuses any push to `main` other than a deploy record. `PowerShell(git push:*)` and the `git merge`, `git rebase` and GitHub MCP ask rules stay.
```

**Block B9** in `~/.claude/commands/finlife.md`:

```text
- Run `cmp -s scripts/git-hooks/pre-push .git/hooks/pre-push`. If it fails, tell me the pre-push guard is missing or out of date, ask me to run `cp scripts/git-hooks/pre-push .git/hooks/pre-push`, and push nothing until it passes (ADR 0114).
```

**Block B10** in `~/.claude/commands/finlife.md`:

```text
- If fin-builder is blocked: read the pane, run `herdr notification show "FinLife: fin-builder waits on a prompt" --body "<task-id>: <the prompt's first line>" --sound request`, show me exactly what it's asking, and wait for me. Never approve permission prompts or answer questions yourself.
```

**Block B11** in `~/.claude/commands/finlife.md`:

```text
- Before any command that will wait on a permission prompt, run `herdr notification show "FinLife: MASTER waits on a permission prompt" --body "<task-id or phase>: <the command>" --sound request`. Those commands are the ones that match an `ask` rule in `.claude/settings.json` (today `git merge`, `git rebase`, any PowerShell `git push`, and the GitHub MCP pull request and branch tools), any `git push` other than `ALLOW_GIT_WRITE=1 git push -u origin <branch>` and `ALLOW_GIT_WRITE=1 git push origin main`, and any `gh pr create` other than the exact form in `release` step 2. If a command stops on a prompt you did not expect, say so in your next report.
```

Old text for B12 (inside `finlife.md:81`):

```text
and push main with `ALLOW_GIT_WRITE=1 git push`.
```

**Block B12** in `~/.claude/commands/finlife.md`:

```text
and push main with `ALLOW_GIT_WRITE=1 git push origin main`, exactly this form: it is the one push to main that runs without a prompt, and the pre-push hook refuses it unless every new commit is the deploy record.
```

Old text for B13 (inside `finlife.md:69`):

```text
(the task ids and their ledger rows) and run `gh pr create --base main --head <branch> --title "phase <n>: <slug>" --body-file <file>`.
```

**Block B13** in `~/.claude/commands/finlife.md`:

```text
(the task ids and their ledger rows), then run exactly `gh pr create --base main --head <branch> --title "phase <n>: <slug>" --body-file <file>` as a command of its own, with no prefix, where `<file>` is the body file's Windows path with forward slashes (`C:/...`, never `/c/...`, so no `MSYS_NO_PATHCONV=1` is needed). Only this form, in this flag order, runs without a prompt (ADR 0114); a `gh pr create` with any other order, flag or prefix waits on a prompt or the auto mode classifier, and one with a second `--base` or `--head`, `-B`, `-H`, `--repo` or `-R` is denied.
```

**Block B14** in `.claude/settings.json`:

```json
    "allow": [
      "Bash(gh pr merge * --auto --merge*)",
      "PowerShell(gh pr merge * --auto --merge*)",
      "Bash(ALLOW_GIT_WRITE=1 git push -u origin phase-*)",
      "Bash(ALLOW_GIT_WRITE=1 git push origin main)",
      "Bash(ALLOW_GIT_WRITE=1 git push origin main 2>&1)",
      "Bash(gh pr create --base main --head phase-* --title * --body-file *)",
      "PowerShell(gh pr create --base main --head phase-* --title * --body-file *)",
      "Bash(herdr notification show *)"
    ],
```

**Block B15** in `.claude/settings.json`:

```json
      "Bash(npx vercel:*)",
      "Bash(git push* --no-v*)",
      "Bash(gh pr create*--base*--base*)",
      "Bash(gh pr create* -B*)",
      "Bash(gh pr create*--head*--head*)",
      "Bash(gh pr create* -H*)",
      "Bash(gh pr create*--repo*)",
      "Bash(gh pr create* -R*)",
      "PowerShell(gh pr merge* --squash*)",
```

**Block B16** in `.claude/settings.json`:

```json
      "PowerShell(npx vercel:*)",
      "PowerShell(git push* --no-v*)",
      "PowerShell(gh pr create*--base*--base*)",
      "PowerShell(gh pr create* -B*)",
      "PowerShell(gh pr create*--head*--head*)",
      "PowerShell(gh pr create* -H*)",
      "PowerShell(gh pr create*--repo*)",
      "PowerShell(gh pr create* -R*)"
    ],
    "ask": [
      "Bash(git merge:*)",
      "Bash(git rebase:*)",
      "PowerShell(git push:*)",
      "PowerShell(git merge:*)",
      "PowerShell(git rebase:*)",
      "mcp__github__create_pull_request",
```

Why the six `gh pr create` deny rules, and why they do not catch the release form: deny is checked before allow, and the allow rule's `*` after `phase-`, `--title` and `--body-file` matches any text, spaces included, so without them `... --body-file f --base dev`, `... -R other/repo` or `... --head feature-x` would be allowed. MASTER's real command holds `--base` once and `--head` once, and no space followed by `-B`, `-H` or `-R` (in PowerShell, case-insensitive, also `-b`, `-h`, `-r`): its title is `phase <n>: <slug>` with a kebab-case slug, and its body-file path holds no space. A false match only denies the release, which stops it; it never widens it.

**Block B17** in `docs/audit/task-ledger.md`:

```text
(`.claude/settings.json`), merged by the owner | Phase 158 timing breakdown (owner decision, 2026-10-29) | done in Phase 159 (T828) |
```

Texts that must be gone after the build:

**Gone G1** in `AGENTS.md`:

```text
(1606 tests, 72 files,
```

**Gone G2** in `README.md`:

```text
1606 tests in 72 files
```

**Gone G3** in `.claude/settings.json`:

```text
"Bash(git push:*)",
```

**Gone G4** in `.claude/settings.json`:

```text
"Bash(ALLOW_GIT_WRITE=1 git push:*)",
```

**Gone G5** in `~/.claude/commands/finlife.md`:

```text
and push main with `ALLOW_GIT_WRITE=1 git push`.
```

**Gone G6** in `~/.claude/commands/finlife.md`:

```text
- If fin-builder is blocked: read the pane, show me exactly
```

**Gone G7** in `docs/audit/task-ledger.md`:

```text
(`.claude/settings.json`), merged by the owner | Phase 158 timing breakdown (owner decision, 2026-10-29) | todo |
```

**Gone G8** in `~/.claude/commands/finlife.md`:

```text
(the task ids and their ledger rows) and run `gh pr create
```

**Gone G9** in `.claude/settings.json`:

```text
"Bash(gh pr create:*)",
```

**Gone G10** in `.claude/settings.json`:

```text
"PowerShell(gh pr create:*)",
```

## 7. Gates

Run from the repository root in Git Bash. The builder saves to `workflow/stages/02_build/output/logs/`. The reviewer runs every gate with `02_build` replaced by `03_review` in output paths, except Gate 5, which reads the builder's logs as written, and Gates 1 and 2, which the reviewer replaces with the stage 03 step 6 repeat in section 6 and a plain Gate 9 run. The tiers: `unit/` (lint, the file, the full suite) for the test; docs-only (counts and paths checked against the code) for `AGENTS.md`, `README.md`, the ADRs and the audit files; no tier row exists for `.claude/settings.json`, `.gitattributes` or `scripts/`, so Gates 3 to 6 and 9 stand in for them, plus the owner's additions 1 and 2. No Playwright spec is affected.

**Gate 1 (red, build step 3).**

```bash
npx vitest run unit/pre-push-guard.test.ts > workflow/stages/02_build/output/logs/T828-red.log 2>&1; grep -E "Tests +[0-9]" workflow/stages/02_build/output/logs/T828-red.log
```

Expect `Tests  13 failed | 5 passed (18)`, the 13 failures being tests 1, 3 to 11, 15, 17 and 18 of section 6.

**Gate 2 (green, build step 4).**

```bash
npx vitest run unit/pre-push-guard.test.ts > workflow/stages/02_build/output/logs/T828-green.log 2>&1; grep -E "Tests +[0-9]" workflow/stages/02_build/output/logs/T828-green.log
```

Expect `Tests  18 passed (18)`. Fix rounds that rerun this write `T828-fixN-green.log` and never overwrite `T828-red.log`, `T828-green.log` or `T828-replay.log`.

**Gate 3 (installed copy, build step 5).**

```bash
node -e "const fs=require('fs');const a=fs.readFileSync('scripts/git-hooks/pre-push'),b=fs.readFileSync('.git/hooks/pre-push');const s=a.toString();console.log('identical',a.equals(b),'CR',s.split('\r').length-1,'shebang',s.startsWith('#!/bin/sh\n'),'final LF',s.endsWith('exit 0\n'))" | tee workflow/stages/02_build/output/logs/T828-install.log; git check-attr eol -- scripts/git-hooks/pre-push | tee -a workflow/stages/02_build/output/logs/T828-install.log
```

Expect `identical true CR 0 shebang true final LF true` and `scripts/git-hooks/pre-push: eol: lf`.

**Gate 4 (the installed hook on real history, local bare repository, build step 5).** It clones this repository into a temp folder, pushes from the temp clone with this repository's `.git/hooks` as its hooks folder, and never touches `origin` or this repository's refs.

```bash
T=$(mktemp -d) && git clone -q --bare . "$T/hist.git" && git clone -q --no-checkout . "$T/clone" && ok=0 && bad=0 && for c in $(git log f35ab99 --first-parent --format=%H --grep='^docs(deploy): ' -n 36); do git --git-dir="$T/hist.git" update-ref refs/heads/main "$c^"; if env -u HERDR_ENV -u ALLOW_GIT_WRITE git -C "$T/clone" -c core.hooksPath="$PWD/.git/hooks" push -q "$T/hist.git" "$c:refs/heads/main" 2>>"$T/err.txt"; then ok=$((ok+1)); else bad=$((bad+1)); fi; done; git --git-dir="$T/hist.git" update-ref refs/heads/main 5d993de; if env -u HERDR_ENV -u ALLOW_GIT_WRITE git -C "$T/clone" -c core.hooksPath="$PWD/.git/hooks" push -q "$T/hist.git" 160c4b7:refs/heads/main 2>"$T/neg.txt"; then neg=accepted; else neg=refused; fi; echo "accepted $ok refused $bad; merge 160c4b7 onto 5d993de $neg: $(head -1 "$T/neg.txt")" | tee workflow/stages/02_build/output/logs/T828-replay.log; rm -rf "$T"
```

Expect exactly `accepted 36 refused 0; merge 160c4b7 onto 5d993de refused: pre-push guard: refusing a merge commit on refs/heads/main`. (At spec time, the same loop through the old hook printed `accepted 36 refused 0` and `accepted` for the merge, and through Block B1 printed the expected line.)

**Gate 5 (order: no allow rule without a tested, installed guard; owner addition 1).** Fails when `.claude/settings.json` holds any allow rule naming `git push` while the installed hook differs from the source or is missing, or the red, green or replay result is missing, or any of those logs is newer than `.claude/settings.json`.

```bash
node -e "const fs=require('fs');const L='workflow/stages/02_build/output/logs/';const t=f=>fs.existsSync(f)?fs.statSync(f).mtimeMs:NaN;const r=f=>fs.existsSync(f)?fs.readFileSync(f,'utf8'):'';const pushAllow=JSON.parse(fs.readFileSync('.claude/settings.json','utf8')).permissions.allow.filter(x=>x.includes('git push')).length;const installed=fs.existsSync('.git/hooks/pre-push')&&fs.existsSync('scripts/git-hooks/pre-push')&&fs.readFileSync('.git/hooks/pre-push').equals(fs.readFileSync('scripts/git-hooks/pre-push'));const red=/Tests\s+13 failed \| 5 passed \(18\)/.test(r(L+'T828-red.log'));const green=/Tests\s+18 passed \(18\)/.test(r(L+'T828-green.log'));const replay=r(L+'T828-replay.log').includes('accepted 36 refused 0; merge 160c4b7 onto 5d993de refused: pre-push guard: refusing a merge commit on refs/heads/main');const c=[t(L+'T828-red.log'),t(L+'T828-green.log'),t(L+'T828-replay.log'),t('.claude/settings.json')];const ordered=c.every((v,i)=>i===0||c[i-1]<v);console.log('push allow rules',pushAllow,'installed',installed,'red',red,'green',green,'replay',replay,'ordered',ordered);process.exit(pushAllow&&!(installed&&red&&green&&replay&&ordered)?1:0)"
```

Expect `push allow rules 3 installed true red true green true replay true ordered true` and exit 0.

The two `gh pr create` allow rules are deliberately outside Gate 5 (it counts only rules naming `git push`): they need no hook, because `gh pr create` changes no branch. It only opens a pull request from a branch already on `origin`, which got there through the hook-guarded push this gate covers; merging stays with the owner, or with the existing auto-merge rule under the Release bullet and `main`'s required checks. What bounds them is their own deny rules, locked by Gate 6. They still land in step 6 with the rest of the file, so Gate 5's `ordered` check (every log older than `.claude/settings.json`) covers when they appear.

**Gate 6 (settings rule lists against HEAD).**

```bash
node -e "const fs=require('fs'),cp=require('child_process');const H=JSON.parse(cp.execSync('git show HEAD:.claude/settings.json',{encoding:'utf8'}));const N=JSON.parse(fs.readFileSync('.claude/settings.json','utf8'));const h=H.permissions,p=N.permissions;const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);const PR='gh pr create --base main --head phase-* --title * --body-file *';const allow=[...h.allow,'Bash(ALLOW_GIT_WRITE=1 git push -u origin phase-*)','Bash(ALLOW_GIT_WRITE=1 git push origin main)','Bash(ALLOW_GIT_WRITE=1 git push origin main 2>&1)','Bash('+PR+')','PowerShell('+PR+')','Bash(herdr notification show *)'];const G=['git push* --no-v*','gh pr create*--base*--base*','gh pr create* -B*','gh pr create*--head*--head*','gh pr create* -H*','gh pr create*--repo*','gh pr create* -R*'];const i=h.deny.indexOf('Bash(npx vercel:*)');const deny=[...h.deny.slice(0,i+1),...G.map(g=>'Bash('+g+')'),...h.deny.slice(i+1),...G.map(g=>'PowerShell('+g+')')];const gone=['Bash(git push:*)','Bash(ALLOW_GIT_WRITE=1 git push:*)','Bash(gh pr create:*)','PowerShell(gh pr create:*)'];const ask=h.ask.filter(x=>!gone.includes(x));const ok=eq(p.allow,allow)&&eq(p.deny,deny)&&eq(p.ask,ask)&&eq(Object.keys(N),Object.keys(H))&&eq(Object.keys(p),Object.keys(h))&&N['\$schema']===H['\$schema'];console.log('allow',p.allow.length,'deny',p.deny.length,'ask',p.ask.length,ok?'OK':'MISMATCH');process.exit(ok?0:1)"
```

Expect `allow 8 deny 113 ask 7 OK`. Then `git diff --numstat -- .claude/settings.json` shows `22	6	.claude/settings.json`: 6 new allow lines, 14 new deny lines (7 per shell), and the old last lines of `allow` and `deny` each rewritten with a comma (1 removed, 1 added each), plus the 4 removed ask lines. The file grows from 123 to 139 lines.

**Gate 7 (text landed).** Reads every Block and Gone from this spec; Blocks must occur in their file, Gones must not (CRLF folded to LF; `~` is the home folder).

```bash
node -e "const fs=require('fs'),os=require('os');const spec=fs.readFileSync('workflow/stages/01_spec/output/task-T828-spec.md','utf8').replace(/\r\n/g,'\n');const re=/\*\*(Block|Gone) ([BG]\d+)\*\* in \x60([^\x60]+)\x60:\n\n\x60\x60\x60[a-z]*\n([\s\S]*?)\n\x60\x60\x60\n/g;let m,n=0,bad=0;while((m=re.exec(spec))){n++;const f=m[3].replace(/^~/,os.homedir());const t=fs.existsSync(f)?fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n'):null;const ok=t!==null&&(t.includes(m[4])===(m[1]==='Block'));if(!ok){bad++;console.log('BAD',m[2],m[3]);}}console.log('blocks',n,'bad',bad);process.exit(bad||n!==27?1:0)"
```

Expect `blocks 27 bad 0` (Blocks B1 to B17, Gones G1 to G10). Also: `scripts/git-hooks/pre-push` equals Block B1 plus one final `\n` exactly, and `unit/pre-push-guard.test.ts` equals Block B2 plus one final newline (CRLF folded); `diff -u workflow/stages/02_build/output/logs/T828-finlife.md.orig ~/.claude/commands/finlife.md` shows exactly two inserted lines (B9 after line 11, B11 after line 90) and three changed lines (51, 69, 81), and nothing else.

**Gate 8.** `npm run lint` (clean).

**Gate 9.** `npx vitest run unit/pre-push-guard.test.ts unit/security-headers.test.ts` (2 files pass; `security-headers` checks `index.html` stays LF under `.gitattributes`).

**Gate 10 (full unit suite).** `npm run test:unit > workflow/stages/02_build/output/logs/T828-unit.log 2>&1` then `grep -E "Test Files|Tests " workflow/stages/02_build/output/logs/T828-unit.log`. Expect `Test Files  73 passed (73)` and `Tests  1624 passed (1624)`, which are the counts Blocks B5 and B7 state. If the totals differ, stop and report them; do not edit the counts to match without saying so in the build report.

**Gate 11 (line endings).**

```bash
node -e "const fs=require('fs');for(const f of process.argv.slice(1)){const t=fs.readFileSync(f,'utf8');const crlf=t.split('\r\n').length-1;console.log(f,'crlf',crlf,'bareLF',t.split('\n').length-1-crlf)}" AGENTS.md README.md .claude/settings.json .gitattributes docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/task-ledger.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md scripts/git-hooks/pre-push .git/hooks/pre-push docs/audit/decisions/0114-unattended-pushes-pre-push-guard.md unit/pre-push-guard.test.ts ~/.claude/commands/finlife.md
```

Expect `bareLF 0` for the first eight; `crlf 0` for both hooks and for `finlife.md`; for the ADR 0114 and the test file, one of the two counts is 0 (not mixed).

**Gate 12 (em dashes).** Added lines: the stage 01 command, `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"`, expect `0`. Whole files: `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" scripts/git-hooks/pre-push unit/pre-push-guard.test.ts docs/audit/decisions/0114-unattended-pushes-pre-push-guard.md ~/.claude/commands/finlife.md`, expect `0` each.

**Gate 13 (scope).** `git status --porcelain` lists exactly these (plus `?? workflow/stages/03_review/output/task-T828-review.md` once the review exists):

```text
 M .claude/settings.json
 M .gitattributes
 M AGENTS.md
 M README.md
 M docs/audit/baseline-metrics.md
 M docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md
 M docs/audit/refactor-log.md
 M docs/audit/task-ledger.md
?? docs/audit/decisions/0114-unattended-pushes-pre-push-guard.md
?? scripts/git-hooks/
?? unit/pre-push-guard.test.ts
?? workflow/stages/01_spec/output/task-T828-spec.md
?? workflow/stages/02_build/output/task-T828-build.md
```

`ls scripts/git-hooks` shows only `pre-push`. `.git/hooks/pre-commit` keeps its 2026-10-16 timestamp (`ls -l --time-style=+%F .git/hooks/pre-commit`). `git diff --numstat` shows `2	1` for `AGENTS.md`, `1	1` for `README.md`, `1	0` for `.gitattributes` and `4	0` for ADR 0101 (blank line, heading paragraph, blank line, item 1).

## 8. Production touch points

Not none. All are the owner's environment or permissions; none is SQL, `/api/*`, Vercel, a workflow or an MCP write.

1. **`.claude/settings.json` (pause list).** Claude Code reloads settings, so the new allow and deny rules, and the removal of the four ask rules, apply to every Claude Code session in this clone as soon as step 6 writes the file, before the merge, including this phase's own release push, its `gh pr create` and its deploy-record push. The owner gave GO on this spec and its amendment 1 and asked for no further pause.
2. **`.git/hooks/pre-push` replaced in the owner's clone** by the builder (step 5), untracked. From then on the owner's own terminal pushes to `main` meet the guard too; `git push --no-verify` from the owner's terminal is the deliberate override.
3. **`~/.claude/commands/finlife.md` edited by the builder** (step 7), outside the repo, never committed; the reviewer checks it against the step 2 backup. A running MASTER keeps the instructions it loaded, so the owner restarts MASTER (`/finlife`) after the build is APPROVED and before the release; otherwise the Phase 159 deploy-record push uses the old bare `ALLOW_GIT_WRITE=1 git push`, which no rule allows (a prompt in Manual mode, the classifier and the owner's `soft_deny` in auto mode), and the old release step 2 may pass the body file as `/c/...` behind a `MSYS_NO_PATHCONV=1` prefix, which the `gh pr create` allow rule does not match.
4. **Release.** The PR is merged by the owner (`.claude/settings.json` and `AGENTS.md` are on the pause list); no auto-merge. The release no longer stops at `gh pr create`: with the restarted MASTER, the push, `gh pr create` and the deploy-record push all run without a prompt, and the phase waits only for the owner's merge. These are the first live uses of the allow rules: MASTER says in its report whether any of the three prompted or was refused by the classifier, and the deploy record notes it.
5. **The owner's auto-mode settings (`~/.claude/settings.json`) need no change** (section 4, "Auto mode and the owner's soft_deny"). The `soft_deny` entry on `git push` stays and keeps covering every push no allow rule matches. Optional and not part of this task: if the owner wants a `gh pr create` in another form to keep stopping in auto mode, the owner adds a `soft_deny` entry for it there.
6. Pushes and commits to local bare and temp repositories in the unit test and Gate 4: the owner's explicit go-ahead (addition 2). Never `origin`.

## 9. Out of scope

- `.git/hooks/pre-commit`, `core.hooksPath`, `package.json` scripts or any `postinstall`: unchanged.
- Any allow rule for another `gh pr create` form, `git merge`, `git rebase`, PowerShell pushes or `mcp__github__*`; removing the `mcp__github__create_pull_request` ask rule; any other line of `.claude/settings.json` (the 99 existing deny rules, the 7 kept ask rules, `$schema`).
- A new Backlog row for the release stopping at `gh pr create` (amendment 1 replaced it with the allow rule).
- Backlog row B (builder runs chromium only; reviewer reuses logs): a separate task; its row stays `todo`.
- `.claude/agents/*`, `workflow/stages/*/CONTEXT.md`, `.github/workflows/`, `vercel.json`, `index.html`, `src/`, `tests/`.
- The owner's notifier scripts and config under `~/.claude/hooks/`, and `~/.claude/settings.json` (including `autoMode`).
- Any other line of `finlife.md` (the release push at `:68` already uses the allowed form and stays; `:15`'s general `MSYS_NO_PATHCONV=1` rule stays, since Block B13 makes the `gh pr create` path need no prefix).
- Archiving ledger or metrics sections, though the ledger passes 150 lines.
- No push to `origin`, no commit in this repository, no PR: the orchestrator commits and releases.
