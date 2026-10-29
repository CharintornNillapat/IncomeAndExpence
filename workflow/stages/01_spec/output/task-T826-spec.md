# T826 spec: narrow the gh pr merge deny so only the auto-merge call runs

Phase 157 (`phase-157-auto-merge-permission`, cut from `main` at `7383179`). The only task of the phase, so it ships the phase. Agent settings, two list edits in `AGENTS.md`, and docs only. The PR is merged by the owner by hand, never auto-merged.

**Amended 2026-10-29 at the owner's pause.** The owner gave the go-ahead to build, declined the unit test (section 6 keeps that as the decision), and added Edit E: `.claude/settings.json` and `.github/workflows/` join the pause list in `AGENTS.md` (the Pause after the spec bullet and the Release bullet's Otherwise list). The owner said no second pause after this amendment. The review runs on `fin-reviewer-strict`.

## 1. Goal

In `.claude/settings.json`, replace the blanket `gh pr merge` deny (Bash and PowerShell) with denies for the `--squash`, `--rebase`, `--admin`, `-s` and `-r` forms, and add an allow rule for `gh pr merge * --auto --merge*`, so the Release bullet's `gh pr merge <n> --auto --merge` runs without a prompt while a squash, rebase or admin merge is still refused. Phase 156 showed the need: its auto-merge call was denied and PR #108 was merged by hand. In `AGENTS.md`, add `.claude/settings.json` and `.github/workflows/` to the pause list and to the Release bullet's Otherwise list, so a task that changes either pauses after its spec and its PR is merged by the owner.

## 2. Target files

```
.claude/settings.json
AGENTS.md
docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md
docs/audit/refactor-log.md
```

`AGENTS.md` is on the pause list (itself a Target file), and the owner's amendment is the go-ahead for Edit E only: two list edits, nothing else in the file.

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (edit D) and `workflow/stages/02_build/output/task-T826-build.md`, with logs under `workflow/stages/02_build/output/logs/` (gitignored).

No new ADR: like Phase 130 (T758), a permission rule change amends ADR `0101` (edit B). No `docs/audit/baseline-metrics.md`: no bundle or test count changes (T758's precedent; see section 6 for the test decision). This task ships the phase, so it writes the Phase 157 refactor-log entry (edit C).

## 3. Context to read

None. No `docs/contexts/*.md` file covers `.claude/settings.json`, ADR `0101` or `AGENTS.md`'s ICM section; the `AGENTS.md` edit is docs-only, and the routing table sends a docs-only change to no context file. The builder reads `AGENTS.md` (Stop and ask first, ICM workflow Pause and Release bullets) and this spec.

## 4. Current behaviour

Checked on `7383179` (= `main`), clean tree.

1. `.claude/settings.json` is `i/lf w/crlf`, 111 lines (Node count CRLF 111, bareLF 0). Root keys `$schema` (`:2`) and `permissions` (`:3`). `permissions` has `deny` (`:4` to `:96`, 91 entries) and `ask` (`:97` to `:109`, 11 entries); there is no `allow` key.
2. `:90` is `      "Bash(gh pr merge:*)",` and `:93` is `      "PowerShell(gh pr merge:*)",`. A `:*` suffix is a trailing wildcard, so these deny every `gh pr merge` command, including `gh pr merge --help` (this spec's own attempt to run it was denied; `gh help pr merge` was used instead).
3. No other settings layer has a `gh pr merge` rule: `~/.claude/settings.json` has no `permissions` key, and there is no `.claude/settings.local.json`. No ask rule matches `gh pr merge`.
4. `AGENTS.md:38` names `gh pr merge --auto` as the one exception to the CLI write ban, and `AGENTS.md:133` (Release, Auto-merge) has the orchestrator run `gh pr merge <n> --auto --merge`. `docs/audit/task-ledger.md:85` records that in Phase 156 this call "was denied by the `Bash(gh pr merge:*)` deny rule" and the owner merged PR #108 by hand, so the auto-merge path is still untested.
5. Claude Code's matching, from its permissions docs (`https://code.claude.com/docs/en/permissions.md`, fetched 2026-10-29): rules are evaluated deny, then ask, then allow, and the first match wins; an allow rule cannot carve an exception out of a deny. A `*` matches any text, including spaces, anywhere in the rule. A command matching no rule falls to the session's permission mode (a prompt in the default mode). Compound commands are split on `&&`, `||`, `;`, `|`, `&` and newlines, and every part must be allowed. A `2>&1` redirect has no file target, so it is not checked as a write. PowerShell rules use the same shape and match case-insensitively. Patterns that constrain arguments are documented as fragile (they miss `sh -c '...'` and other spellings).
6. `gh` 2.100.0 (`gh help pr merge`): `-m/--merge`, `-r/--rebase`, `-s/--squash`, `--admin`, `--auto`, `-d/--delete-branch`, `-t/--subject`, `-b/--body`; inherited `-R/--repo`.
7. Pre-check, done for this spec on a scratch copy built exactly as edit A says (not in the repo): 123 lines, CRLF 123, bareLF 0; `allow 2 deny 99 ask 11`; valid against the downloaded schema with the repo's `ajv` 8.20.0; gate G3 and G6 below both print OK on it and fail on HEAD.
8. `AGENTS.md` is `i/lf w/crlf`, 140 lines (CRLF 140, bareLF 0, no em dash). The pause list is `AGENTS.md:130` (Pause after the spec): a money path, anything under `supabase/`, `api/` or `.claude/agents/`, `AGENTS.md`, or a `workflow/stages/*/CONTEXT.md` file. The Release bullet's Otherwise list is `AGENTS.md:134`: a money path, `supabase/`, `api/`, `.claude/agents/`, `AGENTS.md`, a stage `CONTEXT.md`, a docs-only PR, or auto-merge not enabled. `AGENTS.md:133` (Auto-merge) refers to "the pause list above". Neither list names `.claude/settings.json` or `.github/workflows/`. `.github/workflows/` is on Stop and ask first (`AGENTS.md:41`, editing), so such a task already reaches the pause through its Production touch points; `.claude/settings.json` is on no list.
9. Readers of `AGENTS.md`: no file under `scripts/` names it. `unit/workflow-hardening.test.ts:197` reads it and `:198` checks only the substring ``outside `docs/`, `anti-slop/` and `*.md` `` from `:133`, which Edit E does not touch; `:175` lists the path `AGENTS.md` as a docs-only file name, not its text. No test or script checks the text or counts of `:130` or `:134`. That file passes on HEAD (17 tests).

### Outcome of each command after the change (Bash and PowerShell alike)

| Command | Outcome | Rule that decides |
|---|---|---|
| `gh pr merge 108 --auto --merge` | allowed | allow `gh pr merge * --auto --merge*` |
| `gh pr merge 108 --auto --merge 2>&1` | allowed | allow, through the trailing `*` (and `2>&1` is not a file write) |
| `gh pr merge 108` | prompts | none matches |
| `gh pr merge 108 --merge` | prompts | none matches (no `--auto`) |
| `gh pr merge 108 -s` | denied | deny `gh pr merge* -s*` |
| `gh pr merge 108 --admin --auto --merge` | denied | deny `gh pr merge* --admin*` (it also matches the allow rule; deny is checked first) |
| `gh pr merge --squash 108` | denied | deny `gh pr merge* --squash*` |

"Prompts" means no rule matches, so the session's permission mode decides: a prompt in the default mode. Today all seven are denied.

Why the deny rules are written `gh pr merge* <flag>*`, with no space after `merge`: the `*` then matches empty text when the flag comes first (`gh pr merge --squash 108`) and `" 108"` when it comes later (`gh pr merge 108 --squash`), and the space before the flag keeps `-s*` and `-r*` from matching inside a word such as a branch name. Further outcomes, for the record: `gh pr merge 108 --merge --auto` (flags reversed) and `gh pr merge --auto --merge` (no number) prompt; `gh pr merge 108 --auto --merge -d` is allowed (the trailing `*`); a `--subject` or `--body` text containing ` -s`, ` -r`, `--admin`, `--squash` or `--rebase` is denied (an over-deny, the safe direction).

## 5. Parity map

None. No row of `AGENTS.md`'s parity map covers `.claude/settings.json`, ADR `0101` or the ICM section. Not parity-guarded but related, and left alone: the `description` lines of `.claude/agents/fin-reviewer.md:3` and `fin-reviewer-strict.md:3` point at "the automatic-pause list in the ICM section of AGENTS.md" by reference, so they stay correct without an edit.

## 6. Tests to add

None. The change edits a Claude Code permission file and Markdown. The build, the unit suite and Playwright do not read `.claude/settings.json` (no file under `unit/`, `tests/`, `src/` or `scripts/` names it), so app behaviour cannot change. The one test that reads `AGENTS.md` checks text Edit E leaves alone (section 4 item 9); G10 runs it. Gates G2 to G6 pin the settings result instead. Stage 02 step 4 and stage 03 step 6 do not apply.

**Owner's decision at the pause (2026-10-29): no unit test locks these rules.** The proposal and its reasons, kept as the record:

1. A string-presence test only repeats G3 and G4, which the builder and the reviewer already run on this exact file.
2. A test that also checks the seven outcomes would carry its own copy of Claude Code's matcher (as G6 does). It proves the rule strings fit our reading of the docs, not what Claude Code does, and the docs call argument patterns fragile. A green test would read as a stronger guarantee than it is.
3. It would change the counts `AGENTS.md:11` states (1606 tests, 72 files; also `README.md:159` and a `baseline-metrics.md` section). That adds `README.md`, `baseline-metrics.md` and a `unit/` file to the targets, an `AGENTS.md:11` edit, and the `unit/` tier (`npm run lint`, the file, `npm run test:unit`) to the gates: about four more files for a two-line rule change.
4. `.claude/settings.json` changes rarely, and each change goes through a spec and a review (from this task on, with a pause for the owner, Edit E).

So `AGENTS.md:11`, `README.md:159` and the counts stay as they are.

## 7. The edits

Keep CRLF line endings in every file. No em dash. Text in fenced blocks is copied exactly, including leading spaces. Do not reorder, reformat or re-indent any other line.

### Edit A: `.claude/settings.json`

A1. Insert these four lines directly after `:3` (`  "permissions": {`), so `allow` becomes the first key of `permissions`, before `"deny": [`.

**Landed in .claude/settings.json, the allow list:**

```
    "allow": [
      "Bash(gh pr merge * --auto --merge*)",
      "PowerShell(gh pr merge * --auto --merge*)"
    ],
```

A2. Replace `:90`, `      "Bash(gh pr merge:*)",`, with these five lines, in place (they sit between `"mcp__claude_ai_Gmail__forward",` and `"Bash(vercel:*)",`).

**Landed in .claude/settings.json, the Bash deny rules:**

```
      "Bash(gh pr merge* --squash*)",
      "Bash(gh pr merge* --rebase*)",
      "Bash(gh pr merge* --admin*)",
      "Bash(gh pr merge* -s*)",
      "Bash(gh pr merge* -r*)",
```

A3. Replace `:93`, `      "PowerShell(gh pr merge:*)",`, with these five lines, in place (they sit between `"Bash(npx vercel:*)",` and `"PowerShell(vercel:*)",`).

**Landed in .claude/settings.json, the PowerShell deny rules:**

```
      "PowerShell(gh pr merge* --squash*)",
      "PowerShell(gh pr merge* --rebase*)",
      "PowerShell(gh pr merge* --admin*)",
      "PowerShell(gh pr merge* -s*)",
      "PowerShell(gh pr merge* -r*)",
```

Change nothing else: the `ask` list, every other deny rule and `$schema` stay as they are. The result is 123 lines.

### Edit B: ADR `0101`, a Phase 157 amendment

After `:151` (the last line, the "**Phase 140 release.**" paragraph), append a blank line and these four lines (paragraph, blank, item 1, item 2, with no blank line between the items, as the Phase 138 and 140 amendments have them), so the file ends with item 2 and a CRLF; 156 lines. Do not edit the Status line (`:3`); the Phase 138 and 140 amendments left it as it is too. Leave the release paragraph to the deploy record.

**Landed in docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md, the Phase 157 amendment:**

```
**Phase 157 (T826, 2026-10-29), branch `phase-157-auto-merge-permission`.** This changes a permission rule and the pause list, not the decision, so no new ADR.

1. **Only the auto-merge call runs without a prompt.** `.claude/settings.json` replaces its blanket `Bash(gh pr merge:*)` and `PowerShell(gh pr merge:*)` deny rules, which refused the Release bullet's `gh pr merge <n> --auto --merge` in Phase 156 (the owner merged PR #108 by hand). It now denies the `--squash`, `--rebase`, `--admin`, `-s` and `-r` forms in both shells and allows `gh pr merge * --auto --merge*`. The trailing `*` covers a call that ends in `2>&1`, as the Phase 156 call did. Deny rules are checked before allow rules, so `--admin --auto --merge` is still refused. Any other `gh pr merge` form, such as a bare `gh pr merge <n>` or `--merge` without `--auto`, matches no rule and falls to the session's permission mode. `AGENTS.md`'s Release bullet still decides when the orchestrator may run the call; the rule only removes the refusal. No unit test locks the rules: one would test a copy of Claude Code's matcher, not Claude Code, and would change the test counts in `AGENTS.md`.
2. **`.claude/settings.json` and `.github/workflows/` join the automatic pause (adds to Phase 128 amendment 3 and Phase 138 amendment 2).** `AGENTS.md`'s Pause after the spec bullet and the Release bullet's Otherwise list now name both, so a task that changes either pauses for the owner after its spec, and its PR is merged by the owner, never auto-merged. A `.github/workflows/` edit already paused through Stop and ask first; `.claude/settings.json` was on no list, so a task that changed the agents' permission rules could have been auto-merged.
```

### Edit C: `docs/audit/refactor-log.md`, the Phase 157 entry

Insert at the top of the entries, after the template block's closing fence and its blank line (`:19` and `:20`), directly above `## Phase 156`, in the file's required shape, followed by a blank line, `---` and a blank line, as the other entries are separated. Build it per stage 02 (Changed from `git status --porcelain`, Verified copied word for word from T826's Gate result cell, header `<sha>` placeholders kept):

- Heading: `## Phase 157 - Auto-merge permission: T826 (2026-10-29, code <sha>, merged <sha>)` with the two `<sha>` in backticks, as Phase 156's heading has them.
- ADR line: ADR `0101` (amended, no new ADR), then a brief of two sentences: the blanket `gh pr merge` deny becomes denies for the squash, rebase and admin forms plus an allow rule for `gh pr merge * --auto --merge*`, because the Phase 156 auto-merge call was refused; and `AGENTS.md` adds `.claude/settings.json` and `.github/workflows/` to the pause list and to the Release bullet's Otherwise list.
- **Surprises:** only what the build or review report names, or none.
- **Deliberately not done:** no unit test, by the owner's decision (section 6's reasons, in one clause); no deny for `-R`/`--repo` in Bash or for combined short flags such as `-ds`; `-d`/`--delete-branch` after `--auto --merge` stays allowed; other spellings (`sh -c`, `gh api`) are not matched, as the Claude Code docs warn; no other `AGENTS.md` change (the Auto-merge line, Stop and ask first and the test counts stay as written); this PR is merged by the owner, not auto-merged; no `baseline-metrics.md` section (no bundle or test count changed).

### Edit D: `docs/audit/task-ledger.md` (bookkeeping)

Add a Phase 157 section after the Phase 156 table (`:89`) and its blank line, before `## Backlog` (`:91`): the heading, a blank line, the Branch line, a blank line, the table header (two lines, as Phase 156's) and one row, then a blank line. The row: `| T826 | Narrow the gh pr merge deny to the squash, rebase and admin forms and allow gh pr merge * --auto --merge*; .claude/settings.json and .github/workflows/ join the pause list in AGENTS.md; ADR 0101 amendment; Phase 157 closing docs | <the paths the build changed, in backticks> | in-progress then done | | <gate result> |`. Leave `Commit` empty. Change no other row. The file is 142 lines and becomes 150 (8 added lines); do not archive anything.

**Landed in docs/audit/task-ledger.md, the heading:**

```
## Phase 157 - Auto-merge permission (amends ADR 0101)
```

**Landed in docs/audit/task-ledger.md, the Branch line:**

```
Branch `phase-157-auto-merge-permission`, cut from `main` at `7383179`. One task, T826. No migration. The PR is merged by the owner by hand, never auto-merged.
```

### Edit E: `AGENTS.md`, two list edits

Two in-place replacements inside existing lines; each old text occurs exactly once in the file (checked on HEAD). The line count stays 140, CRLF kept. Change nothing else on either line or anywhere else in the file: not the Auto-merge line (`:133`), not Stop and ask first, not the counts on `:11`.

E1. On `:130` (Pause after the spec), replace this text:

**Gone from AGENTS.md, the pause list, old text:**

```
anything under `supabase/`, `api/` or `.claude/agents/`, `AGENTS.md`, or a `workflow/stages/*/CONTEXT.md` file
```

with this text:

**Landed in AGENTS.md, the pause list, new text:**

```
anything under `supabase/`, `api/`, `.claude/agents/` or `.github/workflows/`, `.claude/settings.json`, `AGENTS.md`, or a `workflow/stages/*/CONTEXT.md` file
```

E2. On `:134` (Release, Otherwise), replace this text:

**Gone from AGENTS.md, the Otherwise list, old text:**

```
(a money path, `supabase/`, `api/`, `.claude/agents/`, `AGENTS.md`, a stage `CONTEXT.md`, a docs-only PR, or auto-merge not enabled)
```

with this text:

**Landed in AGENTS.md, the Otherwise list, new text:**

```
(a money path, `supabase/`, `api/`, `.claude/agents/`, `.github/workflows/`, `.claude/settings.json`, `AGENTS.md`, a stage `CONTEXT.md`, a docs-only PR, or auto-merge not enabled)
```

## 8. Gates

`AGENTS.md`'s docs-only row for `AGENTS.md`, the ADR, the refactor log and the ledger (check every path and count the new text states; no test or script reads the two edited `AGENTS.md` lines or their counts, section 4 item 9, and G10 runs the one test that reads the file). `.claude/settings.json` has no tier row; as in T758, schema validation (G5) and the rule checks (G3, G6) cover it. No code tier applies, so no lint or test suite. Run from the repo root in Git Bash, after all edits. Save G5's output to `workflow/stages/02_build/output/logs/T826-settings-schema.log` (the reviewer: `workflow/stages/03_review/output/logs/`).

G1. Paths the new text names exist:

```bash
ls -d .claude/settings.json .github/workflows AGENTS.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md
```

Expect all four listed.

G2. The settings diff is 14 added lines and the 2 removed rules:

```bash
git diff --numstat -- .claude/settings.json
git diff -U0 -- .claude/settings.json | grep -E '^-[^-]'
```

Expect `14	2	.claude/settings.json`, and exactly two removed lines, `"Bash(gh pr merge:*)",` and `"PowerShell(gh pr merge:*)",` (a trailing `^M` is fine).

G3. Rule lists against HEAD: `deny` is HEAD's list with each blanket rule replaced in place by its five, `ask` unchanged, `allow` exactly the two rules, `permissions` keys in the order `allow,deny,ask`, root unchanged apart from `permissions`:

```bash
node -e "const fs=require('fs');const cp=require('child_process');const r0=JSON.parse(cp.execSync('git show HEAD:.claude/settings.json',{encoding:'utf8'}));const h=r0.permissions;const root=JSON.parse(fs.readFileSync('.claude/settings.json','utf8'));const w=root.permissions;const f=['--squash*','--rebase*','--admin*','-s*','-r*'];const exp=[];for(const r of h.deny){if(r==='Bash(gh pr merge:*)'||r==='PowerShell(gh pr merge:*)'){const t=r.split('(')[0];for(const x of f)exp.push(t+'(gh pr merge* '+x+')')}else exp.push(r)}const al=['Bash(gh pr merge * --auto --merge*)','PowerShell(gh pr merge * --auto --merge*)'];const ok=JSON.stringify(exp)===JSON.stringify(w.deny)&&JSON.stringify(h.ask)===JSON.stringify(w.ask)&&JSON.stringify(al)===JSON.stringify(w.allow)&&Object.keys(w).join()==='allow,deny,ask'&&JSON.stringify({...root,permissions:0})===JSON.stringify({...r0,permissions:0});console.log('allow',(w.allow||[]).length,'deny',w.deny.length,'ask',w.ask.length,ok?'OK':'MISMATCH');process.exit(ok?0:1)"
```

Expect `allow 2 deny 99 ask 11 OK`, exit 0.

G4. Text landed and old text gone, reading the expected text from this spec's fenced blocks (never retyped). The eight blocks under a `**Landed in <file>, ...:**` label (settings x3, ADR x1, ledger x2, `AGENTS.md` x2) must each be found exactly once in their file, and the two blocks under a `**Gone from <file>, ...:**` label (`AGENTS.md` x2) zero times, line endings normalised:

```bash
node -e "const fs=require('fs');const t=fs.readFileSync(process.argv[1],'utf8').split(String.fromCharCode(96).repeat(3));let bad=0,n=0;for(let i=1;i<t.length;i+=2){const l=t[i-1].trim().split('\n').pop();const L=l.startsWith('**Landed in '),G=l.startsWith('**Gone from ');if(!L&&!G)continue;const f=l.slice(12).split(',')[0];const b=t[i].split('\n').slice(1,-1).join('\n');const c=fs.readFileSync(f,'utf8').split('\r\n').join('\n');const k=c.split(b).length-1;const w=L?1:0;n++;console.log(f,k,'want',w);if(k!==w)bad++}console.log('blocks',n,'bad',bad);process.exit(bad||n!==10?1:0)" workflow/stages/01_spec/output/task-T826-spec.md
```

Expect `blocks 10 bad 0`, exit 0. Before the edits it exits 1 (`blocks 10 bad 10`); run it once then as a control.

G5. Schema validation (a read-only download of the public schema, then the repo's installed `ajv`):

```bash
L=workflow/stages/02_build/output/logs
curl -sSL -o "$L/claude-code-settings.schema.json" https://json.schemastore.org/claude-code-settings.json
node -e "const Ajv=require('ajv');const fs=require('fs');const a=new Ajv({strict:false,allErrors:true});const v=a.compile(JSON.parse(fs.readFileSync(process.argv[1],'utf8')));const ok=v(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));console.log(ok?'valid':'INVALID '+JSON.stringify(v.errors));process.exit(ok?0:1)" "$L/claude-code-settings.schema.json" .claude/settings.json 2>&1 | tee "$L/T826-settings-schema.log"
```

Expect the last line `valid`. `unknown format "uri" ignored` warnings are expected (no ajv format plugin) and are not failures.

G6. The seven commands, through a model of the documented matching (deny, then ask, then allow; `*` matches any text; `:*` read as ` *`). This checks the rule strings against section 4's table; it is a model of Claude Code, not Claude Code itself:

```bash
node -e "const p=JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')).permissions;const m=(pat,s)=>{const q=pat.endsWith(':*')?pat.slice(0,-2)+' *':pat;const a=q.split('*');if(a.length===1)return s===q;if(!s.startsWith(a[0]))return false;let i=a[0].length;for(let k=1;k<a.length-1;k++){const j=s.indexOf(a[k],i);if(j<0)return false;i=j+a[k].length}const z=a[a.length-1];return s.length-i>=z.length&&s.endsWith(z)};const d=(t,c)=>{for(const k of ['deny','ask','allow'])for(const r of p[k]||[])if(r.startsWith(t+'(')&&r.endsWith(')')&&m(r.slice(t.length+1,-1),c))return k;return 'prompt'};const C=['gh pr merge 108 --auto --merge','gh pr merge 108 --auto --merge 2>&1','gh pr merge 108','gh pr merge 108 --merge','gh pr merge 108 -s','gh pr merge 108 --admin --auto --merge','gh pr merge --squash 108'];const E=['allow','allow','prompt','prompt','deny','deny','deny'];let bad=0;for(const t of ['Bash','PowerShell'])C.forEach((c,i)=>{const o=d(t,c);if(o!==E[i])bad++;console.log(t,'|',c,'|',o)});console.log('mismatches',bad);process.exit(bad?1:0)"
```

Expect 14 lines matching section 4's table for each shell, then `mismatches 0`, exit 0. On HEAD it prints `mismatches 8` (every command denied).

G7. Line endings stay CRLF (per stage 01's Rules, not with grep):

```bash
git ls-files --eol .claude/settings.json AGENTS.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/refactor-log.md docs/audit/task-ledger.md
node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');console.log(f,'CRLF',(s.match(/\r\n/g)||[]).length,'bareLF',(s.match(/(^|[^\r])\n/g)||[]).length)}" .claude/settings.json AGENTS.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/refactor-log.md docs/audit/task-ledger.md
```

Expect `w/crlf` for all five; CRLF `123` (settings), `140` (`AGENTS.md`, unchanged), `156` (ADR) and `150` (ledger); every file `bareLF 0`. For `AGENTS.md`, also expect `git diff --numstat -- AGENTS.md` to print `2	2	AGENTS.md`.

G8. Zero em dashes in the touched files and the added lines:

```bash
node -e "const fs=require('fs');let n=0;for(const f of process.argv.slice(1)){fs.readFileSync(f,'utf8').split('\n').forEach((l,i)=>{if(l.includes(String.fromCharCode(8212))){n++;console.log(f+':'+(i+1))}})}console.log('em dashes:',n);process.exit(n?1:0)" .claude/settings.json AGENTS.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/refactor-log.md docs/audit/task-ledger.md workflow/stages/02_build/output/task-T826-build.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split(String.fromCharCode(8212)).length-1)"
```

Expect `em dashes: 0`, then `0`.

G9. Scope:

```bash
git diff --stat; git status --porcelain
```

Expect only `.claude/settings.json`, `AGENTS.md`, ADR `0101`, `docs/audit/refactor-log.md` and `docs/audit/task-ledger.md` modified, plus the untracked `task-T826-spec.md` and `task-T826-build.md`. The schema and the log sit in the gitignored `logs/` folder.

G10. The one test that reads `AGENTS.md` still passes (an added gate; it reads `:133`, which Edit E leaves alone):

```bash
npx vitest run unit/workflow-hardening.test.ts
```

Expect `Test Files  1 passed (1)` and `Tests  17 passed (17)`, as on HEAD.

## 9. Production touch points

1. **The rule itself.** Edit A lets Claude Code run `gh pr merge <n> --auto --merge` (a GitHub write on `AGENTS.md`'s Stop and ask first list, its one named exception) without a prompt. Claude Code reloads settings files, so the allow rule is live in any session in this checkout as soon as the builder saves the file, and on `main` after the merge. The owner's order is the go-ahead for the rule; `AGENTS.md`'s Release bullet still decides when the call may run.
2. **`AGENTS.md`, the rule file.** Edit E changes which tasks pause and which PRs the orchestrator may auto-merge. `AGENTS.md` is on the pause list; the owner's amendment of 2026-10-29 is the go-ahead for these two list edits only.
3. **This phase's PR is owner-merged.** It touches `AGENTS.md` (and, after Edit E, `.claude/settings.json`), both on the Otherwise list, and the owner's order says it is merged by hand. The orchestrator pushes the branch and runs `gh pr create` per the Release bullet (`gh pr create` keeps its ask rule), reports the link, and must not run any `gh pr merge` for Phase 157, even though the new allow rule would no longer stop it.
4. The schema download in G5 and the docs read for section 4 are read-only GETs of public files.

The owner held the pause for this spec and gave the go-ahead with this amendment (no unit test; Edit E added), and said no second pause after it. The orchestrator sends `build T826` next; the review runs on `fin-reviewer-strict`.

## 10. Out of scope

- Every other line of `.claude/settings.json`: the `ask` list (including `gh pr create`), every other deny rule, `$schema`. No new key besides `allow`, no rule for `-R`/`--repo`, `--delete-branch`, `--disable-auto` or combined short flags.
- `AGENTS.md` everywhere except Edit E's two replacements: the rest of `:130` and `:134`, the Auto-merge line (`:133`), the Stop and ask first list, the counts on `:11`. Add no other path to either list.
- `workflow/stages/*/CONTEXT.md`, `.claude/agents/*` (their descriptions point at the pause list by reference), `README.md`, `docs/contexts/*.md`.
- `~/.claude/commands/finlife.md` (outside the repo): the owner edits it by hand.
- ADR `0101` outside the new Phase 157 amendment, including its Status line and earlier amendments.
- `docs/audit/baseline-metrics.md`; any `unit/` or `tests/` file (section 6).
- Every ledger row other than T826's new row and section; the Backlog.
- User-level settings (`~/.claude/settings*.json`), `.git/hooks/*`, GitHub repository settings (`allow_auto_merge`).
- Running `gh pr merge` in any form, including `--help`, to test the rules.
