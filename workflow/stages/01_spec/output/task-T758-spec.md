# T758 spec: drop the bare git commit ask rules

Phase 130 (`phase-130-eol-check`, at `f2045f0`, T757's commit). Agent settings and docs only. This task ships Phase 130.

## 1. Goal

In `.claude/settings.json`, remove the two ask rules for a bare `git commit`, `Bash(git commit:*)` and `PowerShell(git commit:*)`, because they make the orchestrator's automatic commit ask the owner every time. Keep every other rule. Note in ADR `0101`'s Amendments that commits are now guarded by the local git hooks and `AGENTS.md`, not by an ask prompt. The settings file must still validate against the Claude Code settings schema.

## 2. Target files

```
.claude/settings.json
docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md
docs/audit/refactor-log.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (Edit D) and `workflow/stages/02_build/output/task-T758-build.md`, with logs under `workflow/stages/02_build/output/logs/` (gitignored).

No new ADR: like Phases 126 and 128, this amends ADR `0101` (a workflow and permission change, not a new decision). No `baseline-metrics.md`: no bundle or test count changes (`AGENTS.md:116`). This task ships the phase, so it rewrites T757's Phase 130 refactor-log entry to cover both tasks (Edit C).

## 3. Context to read

None. No app code changes; no `docs/contexts/*.md` file covers `.claude/settings.json` or the ADR.

## 4. Current behaviour

Checked on `f2045f0`, clean tree.

1. `.claude/settings.json:97` to `:111` is `permissions.ask`, 13 entries: `:98` `Bash(ALLOW_GIT_WRITE=1 git push:*)`, `:99` `Bash(git commit:*)`, `:100` to `:103` Bash push, merge, rebase, `gh pr create`, `:104` `PowerShell(git commit:*)`, `:105` to `:108` PowerShell push, merge, rebase, `gh pr create`, `:109` `mcp__github__create_pull_request`, `:110` `mcp__github__create_branch` (the last entry, no comma). `permissions.deny` (`:4` to `:96`) has 91 entries. The file declares `"$schema": "https://json.schemastore.org/claude-code-settings.json"` (`:2`).
2. The file is `i/lf w/crlf`, 113 lines, Node count CRLF 113 / bareLF 0.
3. No other settings layer has a `git commit` rule: `~/.claude/settings.json` and `~/.claude/settings.local.json` have none, and there is no `.claude/settings.local.json`.
4. The local git hooks are `.git/hooks/pre-commit` and `.git/hooks/pre-push`, untracked (they live in this clone only; `core.hooksPath` is unset). Each one exits 1 with "Commits and pushes inside herdr go only through the orchestrator." when `HERDR_ENV=1` and `ALLOW_GIT_WRITE` is not `1`, and exits 0 otherwise (`pre-commit:3` to `:6`). Outside a herdr pane they do not block.
5. `AGENTS.md:39` (Stop and ask first) still names `git commit`; under herdr the only standing go-ahead is the orchestrator's commit of each APPROVED task on the phase branch. `workflow/stages/02_build/CONTEXT.md:42` says only the orchestrator commits. Neither mentions the ask rules, so neither changes.
6. ADR `0101`:
   - `:3` (Status) ends: ``Amended in Phase 126 (T751, `86d0849`), merged into `main` as `3f301ab` (PR #77), and in Phase 128 (T754, `a757938`), merged into `main` as `9c62173` (PR #79); see Amendments.``
   - `:109` is `## Amendments`. `:129` (Phase 128 amendment 4) says `.claude/settings.json` dropped the prefixed `ALLOW_GIT_WRITE=1 git commit` ask rule and kept every other rule. `:131`, the last line, is the "**Phase 128 release.**" paragraph.
   - CRLF 131 / bareLF 0.
7. `docs/audit/refactor-log.md:22` to `:29` is T757's Phase 130 entry (heading, blank, brief, blank, four bold lines); `:30` blank, `:31` `---`. Its brief says "No ADR" and its Deliberately not done says "No ADR `0101` amendment", which T758 makes untrue. CRLF 122.
8. `docs/audit/task-ledger.md:59` is `## Phase 130 - Line-ending check rule (docs only, no ADR)`; T757's row is `:65`; `:66` blank; `:67` `## Backlog`. CRLF 95.
9. Pre-check: a copy of the file with `:99` and `:104` removed validates against the downloaded schema with the repo's `ajv` 8.20.0 (`valid`, ask 11, deny 91). The current file also validates.

## 5. Parity map

None. No row of `AGENTS.md`'s parity map covers `.claude/settings.json` or the ADR.

## 6. Tests to add

None. The change removes two Claude Code permission prompts and edits Markdown. The build, the unit suite and Playwright do not read `.claude/settings.json`, so app behaviour cannot change. Gates G2 to G4 (exact diff, rule lists, schema) pin the result instead. Stage 02 step 4 and stage 03 step 6 do not apply.

## 7. The edits

Keep CRLF line endings in every file. No em dash. In this section, backslashes before backticks inside inline code only escape them; do not type them. Text in fenced blocks is copied exactly.

### Edit A: `.claude/settings.json`

Delete exactly two lines: `:99` `      "Bash(git commit:*)",` and `:104` `      "PowerShell(git commit:*)",`. Change nothing else: no reordering, no reformatting, no new rule, no allow list.

### Edit B: ADR `0101`

B1, `:3`. Replace the end of the Status line:

```
and in Phase 128 (T754, `a757938`), merged into `main` as `9c62173` (PR #79); see Amendments.
```

with:

```
and in Phase 128 (T754, `a757938`), merged into `main` as `9c62173` (PR #79), and in Phase 130 (T758); see Amendments.
```

B2. After `:131` (the "**Phase 128 release.**" paragraph), append a blank line and these three lines (paragraph, blank, item), so the file ends with the item and a CRLF:

```
**Phase 130 (T758, 2026-10-16), branch `phase-130-eol-check`.** This changes a permission prompt, not the decision, so no new ADR.

1. **No ask prompt on a bare commit.** `.claude/settings.json` drops its `Bash(git commit:*)` and `PowerShell(git commit:*)` ask rules: they made the orchestrator's automatic commit (Phase 128, amendment 4) ask the owner every time. Commits are now guarded by the local git hooks and `AGENTS.md`, not by an ask prompt. The hooks are the untracked `.git/hooks/pre-commit` and `.git/hooks/pre-push` in the owner's clone: inside a herdr pane (`HERDR_ENV=1`) they refuse a commit or push unless `ALLOW_GIT_WRITE=1` is set, and outside herdr they do not block. `AGENTS.md`'s Stop and ask first list still names `git commit`, and its ICM section limits the standing go-ahead to the orchestrator's commit of each approved task on the phase branch. Every other rule stays, including the ask rules for `git push`, `git merge`, `git rebase`, `gh pr create` and `ALLOW_GIT_WRITE=1 git push`.
```

Leave the release line for the deploy record; do not add one.

### Edit C: `docs/audit/refactor-log.md`, rewrite the Phase 130 entry

Replace `:22` to `:29` (the heading through the Deliberately not done line) with these eight lines. Keep `:30` (blank) and `:31` (`---`) as they are. The `<T757 Verified>` placeholder means: keep T757's current Verified text, from `G1 named paths exist` through `G7 scope clean`, unchanged. Fill `<T758 Verified>` and `<T758 Surprises>` from the real gate runs.

```
## Phase 130 - Line-ending rule and commit prompts: T757-T758 (2026-10-16, docs `<sha>`, merged `<sha>`)

ADR `0101` (amended by T758, no new ADR). T757 closes the Backlog row from T754's review: specs check line endings with `git ls-files --eol` or a Node count, never `grep -c`. T758, the owner's brief: drop the bare `git commit` ask rules, which made the orchestrator's automatic commit ask the owner every time.

**Changed:** T757: `workflow/stages/01_spec/CONTEXT.md` (one Rules bullet on checking line endings); one Backlog row closed. T758: `.claude/settings.json` (the `Bash(git commit:*)` and `PowerShell(git commit:*)` ask rules removed); ADR `0101` (Status line and a Phase 130 amendment).
**Verified:** T757: <T757 Verified>. T758: <T758 Verified>.
**Surprises:** T757: none. T758: <T758 Surprises, or none>.
**Deliberately not done:** No `AGENTS.md` change: its Stop and ask first list still names `git commit`. `workflow/stages/03_review/CONTEXT.md` is unchanged: the reviewer runs the spec's gates, so T757's rule reaches it through the spec. `.claude/settings.json` keeps every other rule, including the push, merge, rebase and `gh pr create` ask rules and `Bash(ALLOW_GIT_WRITE=1 git push:*)`; no allow rule was added. The untracked `.git/hooks/` guards are unchanged. No `baseline-metrics.md` section (no bundle or test count changed).
```

### Edit D: `docs/audit/task-ledger.md` (bookkeeping)

- `:59`: replace the heading with `` ## Phase 130 - Line-ending rule and commit prompts (docs and agent settings only, amends ADR `0101`) ``.
- After T757's row (`:65`), add:

```
| T758 | Drop the bare `git commit` ask rules (Bash and PowerShell) so the orchestrator's automatic commit stops asking; ADR `0101` amendment | `.claude/settings.json`, ADR `0101`, `docs/audit/refactor-log.md` | in-progress | | |
```

  Set Status to `done` and fill Gate result when the gates pass. Leave `Commit` empty. Change no other row, including T757's.

## 8. Gates

`AGENTS.md`'s docs-only row for the ADR, the refactor log and the ledger (check every path and count the new text states). `.claude/settings.json` has no tier row; the owner's order adds schema validation (G4). Run from the repo root in Git Bash, after all edits.

G1. Paths the new text names exist:

```bash
ls .claude/settings.json .git/hooks/pre-commit .git/hooks/pre-push AGENTS.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md workflow/stages/01_spec/CONTEXT.md workflow/stages/03_review/CONTEXT.md
```

Expect all seven listed.

G2. The settings diff is exactly the two removed lines:

```bash
git diff --numstat -- .claude/settings.json
git diff -U0 -- .claude/settings.json | grep -E '^[-+] '
```

Expect `0	2	.claude/settings.json`, and exactly two lines: `-      "Bash(git commit:*)",` and `-      "PowerShell(git commit:*)",`.

G3. The rule lists: deny unchanged, ask is HEAD's list minus the two rules:

```bash
node -e "const fs=require('fs');const {execSync}=require('child_process');const h=JSON.parse(execSync('git show HEAD:.claude/settings.json',{encoding:'utf8'})).permissions;const w=JSON.parse(fs.readFileSync('.claude/settings.json','utf8')).permissions;const gone=['Bash(git commit:*)','PowerShell(git commit:*)'];const ok=JSON.stringify(h.deny)===JSON.stringify(w.deny)&&JSON.stringify(h.ask.filter(r=>!gone.includes(r)))===JSON.stringify(w.ask)&&!w.allow;console.log('deny',w.deny.length,'ask',w.ask.length,ok?'OK':'MISMATCH');console.log(w.ask.join('\n'));process.exit(ok?0:1)"
```

Expect `deny 91 ask 11 OK`, then the 11 ask rules, including `Bash(git push:*)`, `Bash(git merge:*)`, `Bash(git rebase:*)`, `PowerShell(git push:*)`, `PowerShell(git merge:*)`, `PowerShell(git rebase:*)` and `Bash(ALLOW_GIT_WRITE=1 git push:*)`.

G4. Schema validation (a read-only download of the public schema, then the repo's installed `ajv`). Save the output to `workflow/stages/02_build/output/logs/T758-settings-schema.log` (the reviewer: `workflow/stages/03_review/output/logs/`):

```bash
L=workflow/stages/02_build/output/logs
curl -sSL -o "$L/claude-code-settings.schema.json" https://json.schemastore.org/claude-code-settings.json
node -e "const Ajv=require('ajv');const fs=require('fs');const a=new Ajv({strict:false,allErrors:true});const v=a.compile(JSON.parse(fs.readFileSync(process.argv[1],'utf8')));const ok=v(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));console.log(ok?'valid':'INVALID '+JSON.stringify(v.errors));process.exit(ok?0:1)" "$L/claude-code-settings.schema.json" .claude/settings.json 2>&1 | tee "$L/T758-settings-schema.log"
```

Expect the last line `valid`, exit 0. `unknown format "uri" ignored` warnings are expected (no ajv format plugin) and are not failures.

G5. Line endings stay CRLF (per stage 01's Rules, not with grep):

```bash
git ls-files --eol .claude/settings.json docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/refactor-log.md docs/audit/task-ledger.md
node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');console.log(f,'CRLF',(s.match(/\r\n/g)||[]).length,'bareLF',(s.match(/(^|[^\r])\n/g)||[]).length)}" .claude/settings.json docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/refactor-log.md docs/audit/task-ledger.md
```

Expect `w/crlf` for all four, and CRLF `111`, `135`, `122`, `96`, each with `bareLF 0`.

G6. Markdown diff sizes and placement:

```bash
git diff --numstat -- docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/refactor-log.md docs/audit/task-ledger.md
grep -n "and in Phase 130 (T758); see Amendments\.\|^\*\*Phase 130 (T758\|^1\. \*\*No ask prompt" docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md | cut -c1-80
grep -n "^## Phase 130\|^| T757\|^| T758\|^## Backlog" docs/audit/task-ledger.md | cut -c1-80
grep -n "^## Phase 130\|^## Phase 129" docs/audit/refactor-log.md | cut -c1-80
```

Expect numstat `5	1` (ADR), `6	6` (refactor log), `2	1` (ledger). ADR hits at `:3`, `:133` and `:135`. Ledger: `## Phase 130` at `:59`, T757 at `:65`, T758 at `:66` (Status `done`), `## Backlog` at `:68`. Refactor log: `## Phase 130` at `:22` (title `Line-ending rule and commit prompts: T757-T758`), `## Phase 129` at `:33`.

G7. Zero em dashes:

```bash
node -e "const fs=require('fs');let n=0;for(const f of process.argv.slice(1)){fs.readFileSync(f,'utf8').split('\n').forEach((l,i)=>{if(l.includes(String.fromCharCode(8212))){n++;console.log(f+':'+(i+1))}})}console.log('em dashes:',n);process.exit(n?1:0)" .claude/settings.json docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/refactor-log.md docs/audit/task-ledger.md workflow/stages/02_build/output/task-T758-build.md
```

Expect `em dashes: 0`.

G8. Scope:

```bash
git diff --stat; git status --porcelain
```

Expect only `.claude/settings.json`, ADR `0101`, `docs/audit/refactor-log.md` and `docs/audit/task-ledger.md` modified, plus the untracked `task-T758-spec.md` and `task-T758-build.md`. The downloaded schema and the log sit in the gitignored `logs/` folder.

No lint or test suite: no code tier applies (`AGENTS.md:92`).

## 9. Production touch points

None. The schema download in G4 is a read-only GET of a public file. The change sits on `AGENTS.md`'s Stop and ask first item for `git commit` without changing it: the rule still binds every agent; only the Claude Code prompt that enforced it goes. Known ceiling, recorded in the ADR text: outside a herdr pane the hooks do not block, so a Claude Code session there relies on `AGENTS.md` and its permission mode alone. The pause rule in `AGENTS.md`'s ICM section does not name `.claude/settings.json` or an ADR, so by that rule the orchestrator goes on to the build without asking.

## 10. Out of scope

- Every other line of `.claude/settings.json`: the deny list, the other 11 ask rules (keep `Bash(ALLOW_GIT_WRITE=1 git push:*)`), `$schema`. No allow list, no new rule.
- `.git/hooks/*`: untracked, the owner's; do not edit or add hooks.
- `AGENTS.md` (its Stop and ask first `git commit` item stays), `workflow/stages/*/CONTEXT.md`, `docs/audit/README.md`, `docs/contexts/*.md`.
- ADR `0101` outside the Status line's end and the new Phase 130 amendment, including Phase 128's amendment 4 and its release paragraph.
- T757's Verified text inside the refactor-log entry (kept as is), the Phase 129 entry and older ones, `docs/audit/baseline-metrics.md`.
- Every ledger row other than T758's new row, including T757's row and the Backlog.
- User-level settings (`~/.claude/settings*.json`).
