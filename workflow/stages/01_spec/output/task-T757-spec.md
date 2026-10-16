# T757 spec: promote the line-ending check rule into stage 01

Phase 130 (`phase-130-eol-check`, cut from `main` at `706e335`, no commits yet). Docs only. This task ships the phase.

## 1. Goal

Close the line-ending Backlog row (`docs/audit/task-ledger.md:75`): add its rule to `workflow/stages/01_spec/CONTEXT.md`, so every spec checks line endings with `git ls-files --eol` or a Node count, never `grep -c $'\r'`. The row's condition, "once a spec uses it", is met: T755's spec (G4) and this spec (G3) both use it.

## 2. Target files

```
workflow/stages/01_spec/CONTEXT.md
docs/audit/refactor-log.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (the Phase 130 section, T757's row and the Backlog row's Status) and `workflow/stages/02_build/output/task-T757-build.md`, with logs under `workflow/stages/02_build/output/logs/`.

No ADR and no ADR `0101` amendment: the bullet is a technique for writing gates, not a workflow decision (`AGENTS.md:116`: doc-only edits skip the process). No `baseline-metrics.md`: no bundle or test count changes (`AGENTS.md:116`). The phase is doc-only, so it ships with a short `refactor-log.md` entry (`AGENTS.md:116`).

## 3. Context to read

None. A docs-only change needs no context file (`AGENTS.md` routing table).

## 4. Current behaviour

Checked on `706e335` (branch `phase-130-eol-check`, clean tree).

1. `docs/audit/task-ledger.md:75` is the Backlog row: "Specs check line endings with `git ls-files --eol <file>` (the `w/crlf` column) or a Node count of `\r\n`, never `grep -c $'\r' <file>` ...", Status `todo: add to \`workflow/stages/01_spec/CONTEXT.md\` once a spec uses it`. `:77` is `## Template for the next phase`.
2. `docs/audit/task-ledger.md:42` to `:57` hold Phases 128 and 129; T756's row is `:57`, then a blank line `:58`, then `## Backlog` at `:59`.
3. `workflow/stages/01_spec/CONTEXT.md:44` to `:50` is `## Rules`, five bullets. `:49` is `- No em dash in the spec.` and `:50` is the "Stop after writing the spec" bullet. No bullet mentions line endings.
4. `docs/audit/refactor-log.md:20` is `---`, `:21` blank, `:22` the Phase 129 entry heading (newest first, per `:3`). The entry format is at `:9` to `:16`.
5. All three files are CRLF in the working tree: `git ls-files --eol` prints `i/lf    w/crlf` for each. A Node count gives CRLF 57 / bareLF 0 for `CONTEXT.md`, 87 / 0 for the ledger, 111 / 0 for the refactor log.
6. The grep quirk still reproduces in the Bash tool on this branch: `grep -c $'\r' workflow/stages/01_spec/CONTEXT.md` printed `0`, while `echo "$(grep -c $'\r' workflow/stages/01_spec/CONTEXT.md)"` printed `57`, matching Node.

## 5. Parity map

None.

## 6. Tests to add

None. A Markdown rule bullet, a log entry and ledger rows cannot change app behaviour. The gates check the text, the line endings and the diff. Stage 02 step 4 and stage 03 step 6 do not apply.

## 7. The edits

Keep CRLF line endings in every file. No em dash. In the blocks below, copy backslashes exactly as shown: `\r\n` and `$'\r'` are literal text, not escapes.

### Edit 1: `workflow/stages/01_spec/CONTEXT.md`, a new Rules bullet

Insert this line directly after `:49` (`- No em dash in the spec.`), before the "Stop after writing the spec" bullet:

```
- A gate that checks line endings uses `git ls-files --eol <file>` (the `w/crlf` column) or a Node count of `\r\n` and of bare `\n`, never `grep -c $'\r' <file>`: in the agents' Git Bash that grep printed 0 on CRLF files, while the same command inside `$(...)` counted correctly.
```

Change no other line of the file.

### Edit 2: `docs/audit/refactor-log.md`, the Phase 130 entry

Insert after `:21` (the blank line under the first `---`), above the Phase 129 heading, these lines followed by a blank line, `---` and a blank line (the same shape as the Phase 129 entry):

- Heading: `## Phase 130 - Line-ending check rule: T757 (<today's date>, docs \`<sha>\`, merged \`<sha>\`)`. Leave the `<sha>` placeholders for the deploy record.
- Brief: `No ADR (a gate-writing technique, not a workflow decision). Closes the Backlog row from T754's review: specs check line endings with \`git ls-files --eol\` or a Node count, never \`grep -c\`.`
- **Changed:** `` `workflow/stages/01_spec/CONTEXT.md` (one Rules bullet on checking line endings); one Backlog row closed. ``
- **Verified:** every gate from section 8, with the real results.
- **Surprises:** whatever the build finds, or `none`.
- **Deliberately not done:** `` No ADR `0101` amendment and no `AGENTS.md` change. `workflow/stages/03_review/CONTEXT.md` is unchanged: the reviewer runs the spec's gates, so the rule reaches it through the spec. No `baseline-metrics.md` section (no bundle or test count changed). ``

The backslashes in this section only escape backticks inside inline code; do not type them.

### Edit 3: `docs/audit/task-ledger.md` (bookkeeping)

- Add a Phase 130 section between T756's row (`:57`) and `## Backlog` (`:59`): after the existing blank line `:58`, insert these lines, each followed by the blank lines shown, so one blank line stays above `## Backlog`:

```
## Phase 130 - Line-ending check rule (docs only, no ADR)

Branch `phase-130-eol-check`, cut from `main` at `706e335`. No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T757 | Promote the line-ending Backlog row into stage 01's Rules: check with `git ls-files --eol` or Node, never `grep -c` | `workflow/stages/01_spec/CONTEXT.md`, `docs/audit/refactor-log.md` | in-progress | | |

```

  Set Status to `done` and fill Gate result when the gates pass. Leave `Commit` empty.
- The Backlog row at `:75` (it moves down by 8 lines, to `:83`): change only its Status cell, from `` todo: add to `workflow/stages/01_spec/CONTEXT.md` once a spec uses it `` to `done in Phase 130 (T757)`. Leave its Item and Source cells as they are.

## 8. Gates

`AGENTS.md`'s docs-only row: check every path and count the new text states against the repo. Run from the repo root in Git Bash, after all edits.

G1. Paths the new text names exist:

```bash
ls workflow/stages/01_spec/CONTEXT.md workflow/stages/03_review/CONTEXT.md docs/audit/task-ledger.md docs/audit/refactor-log.md AGENTS.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md
```

Expect all six listed.

G2. Diff size per file:

```bash
git diff --numstat -- workflow/stages/01_spec/CONTEXT.md docs/audit/refactor-log.md docs/audit/task-ledger.md
```

Expect `1	0` for `CONTEXT.md`, `11	0` for `refactor-log.md` (heading, blank, brief, blank, four bold lines, blank, `---`, blank) and `9	1` for `task-ledger.md` (8 new Phase 130 lines, plus the Backlog row rewritten).

G3. Line endings stay CRLF (checked with git and Node, per this task's own rule):

```bash
git ls-files --eol workflow/stages/01_spec/CONTEXT.md docs/audit/refactor-log.md docs/audit/task-ledger.md
node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');console.log(f,'CRLF',(s.match(/\r\n/g)||[]).length,'bareLF',(s.match(/(^|[^\r])\n/g)||[]).length)}" workflow/stages/01_spec/CONTEXT.md docs/audit/refactor-log.md docs/audit/task-ledger.md
```

Expect `w/crlf` for all three, and `CRLF 58 bareLF 0`, `CRLF 122 bareLF 0`, `CRLF 95 bareLF 0`.

G4. The rule landed whole and in place:

```bash
grep -n "^- " workflow/stages/01_spec/CONTEXT.md | sed -n '/^4[4-9]:\|^5[0-9]:/p'
grep -cF "never \`grep -c \$'\\r' <file>\`: in the agents' Git Bash" workflow/stages/01_spec/CONTEXT.md
```

Expect the new bullet at `:50`, between `- No em dash in the spec.` (`:49`) and the "Stop after writing the spec" bullet (`:51`); the count is `1`.

G5. The ledger rows:

```bash
grep -n "^## Phase 130\|^| T757\|^## Backlog\|done in Phase 130 (T757)" docs/audit/task-ledger.md
```

Expect `## Phase 130` at `:59`, the T757 row at `:65` with Status `done`, `## Backlog` at `:67`, and the Backlog row at `:83` ending `done in Phase 130 (T757) |`.

G6. Zero em dashes:

```bash
node -e "const fs=require('fs');let n=0;for(const f of process.argv.slice(1)){fs.readFileSync(f,'utf8').split('\n').forEach((l,i)=>{if(l.includes(String.fromCharCode(8212))){n++;console.log(f+':'+(i+1))}})}console.log('em dashes:',n);process.exit(n?1:0)" workflow/stages/01_spec/CONTEXT.md docs/audit/refactor-log.md docs/audit/task-ledger.md workflow/stages/02_build/output/task-T757-build.md
```

Expect `em dashes: 0`.

G7. Scope:

```bash
git diff --stat; git status --porcelain
```

Expect only `workflow/stages/01_spec/CONTEXT.md`, `docs/audit/refactor-log.md` and `docs/audit/task-ledger.md` modified, plus the untracked `task-T757-spec.md` and `task-T757-build.md` (and any gitignored logs).

No lint or test suite: docs-only tier, and the before-done line applies only to code tiers (`AGENTS.md:92`).

## 9. Production touch points

None.

## 10. Out of scope

- `workflow/stages/02_build/CONTEXT.md` and `workflow/stages/03_review/CONTEXT.md`: the reviewer runs the spec's gates, so the rule reaches stage 03 through the spec.
- Every other line of `workflow/stages/01_spec/CONTEXT.md`, including the section list and the STATUS lines.
- `AGENTS.md`, ADR `0101` and its Amendments, `docs/contexts/*.md`, `docs/audit/README.md`.
- `docs/audit/baseline-metrics.md`.
- Every other ledger row, including the Phase 128 and 129 rows, the other Backlog rows, and the Item and Source cells of the line-ending row.
- Past specs and reviews in `workflow/stages/*/output/`.
- `.gitattributes` or any line-ending normalisation: the files stay CRLF as they are.
