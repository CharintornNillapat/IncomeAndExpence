# T755 spec: Backlog row for checking line endings without grep

Phase 128 (`phase-128-workflow-automation`, at `a757938`, T754's commit). Docs only: one Backlog row in the ledger. T754 already shipped the phase's refactor-log entry.

## 1. Goal

Record the T754 review's rule candidate as a Backlog row: specs check line endings with `git ls-files --eol` or a Node count, because `grep -c` with a carriage-return pattern returns 0 in the agents' shell even on CRLF files. Add only the Backlog row. Do not change the stage files.

## 2. Target files

```
docs/audit/task-ledger.md
```

The ledger is also a bookkeeping file: the builder adds T755's own task row there too (Edit 2). Bookkeeping, always allowed: `workflow/stages/02_build/output/*`, with this task's report at `workflow/stages/02_build/output/task-T755-build.md`.

No ADR (a Backlog row decides nothing). No `refactor-log.md` or `baseline-metrics.md` change: the order says to add only the Backlog row, and no bundle or test count changes.

## 3. Context to read

None. A docs-only change needs no context file (`AGENTS.md` routing table).

## 4. Current behaviour

Checked on `a757938`.

1. `docs/audit/task-ledger.md:50` to `:65` is the Backlog: `| Item | Source | Status |`, with the last row at `:65` (`rollup-plugin-visualizer`, `| same | todo |`). `:67` is `## Template for the next phase`.
2. `:42` to `:48` is the Phase 128 section, with one row, T754, at `:48`.
3. The ledger is CRLF in the working tree: `git ls-files --eol docs/audit/task-ledger.md` prints `i/lf    w/crlf`, and a Node count finds 77 `\r\n` line endings out of 77 lines.
4. The grep behaviour, reproduced in the Bash tool on this branch:
   - `grep -c $'\r' AGENTS.md` printed `0`. The same with `| cat` and with `> file` also gave `0`.
   - `echo "$(grep -c $'\r' AGENTS.md)"` printed `133`, the correct count (a Node count agrees).
   - `grep -c $'\r' docs/audit/task-ledger.md` run on its own also printed `0`, while inside `$(...)` it printed `77`.
   - So the result depends on how the command is invoked, not on the file. That makes it unreliable as a gate. `git ls-files --eol` and Node give the right answer every time.
5. T754's review (`workflow/stages/03_review/output/task-T754-review.md`, section 8) names this as a rule candidate for `workflow/stages/01_spec/CONTEXT.md`, to be promoted only once a spec uses it.

## 5. Parity map

None.

## 6. Tests to add

None. One table row in a Markdown ledger cannot change app behaviour. The gates check the row's text and the diff.

## 7. The edits

Keep CRLF line endings. No em dash.

### Edit 1: the Backlog row

Insert this line directly after `:65` (the `rollup-plugin-visualizer` row), as the Backlog table's last row, before the blank line and `## Template for the next phase`:

```
| Specs check line endings with `git ls-files --eol <file>` (the `w/crlf` column) or a Node count of `\r\n`, never `grep -c $'\r' <file>`: in the agents' Git Bash it printed 0 on CRLF files (`AGENTS.md`, `docs/audit/task-ledger.md`), while the same command inside `$(...)` counted correctly | Phase 128, T754's review (rule candidate); reproduced in T755's spec | todo: add to `workflow/stages/01_spec/CONTEXT.md` once a spec uses it |
```

Copy it exactly, including the backslashes in `\r\n` and `$'\r'` (they are literal text, not escapes).

### Edit 2: T755's task row (bookkeeping)

Add this row to the Phase 128 table, directly after T754's row (`:48`):

```
| T755 | Backlog row: check line endings with `git ls-files --eol` or Node, not `grep -c` (T754's rule candidate) | `docs/audit/task-ledger.md` | in-progress | | |
```

Set Status to `done` and fill Gate result when the gates pass. Leave `Commit` empty. Change no other row, including T754's.

## 8. Gates

`AGENTS.md`'s docs-only row: check every path the new text names against the repo. Run from the repo root in Git Bash.

G1. Paths the row names exist:

```bash
ls AGENTS.md docs/audit/task-ledger.md workflow/stages/01_spec/CONTEXT.md workflow/stages/03_review/output/task-T754-review.md
```

Expect all four listed.

G2. The diff is two added lines, none removed:

```bash
git diff --numstat -- docs/audit/task-ledger.md
git diff -U0 -- docs/audit/task-ledger.md | grep -E '^[-+][^-+]'
```

Expect `2	0	docs/audit/task-ledger.md`, and exactly two `+` lines: the Backlog row and the T755 row.

G3. The row landed whole and in place:

```bash
grep -nF "never \`grep -c \$'\\r' <file>\`" docs/audit/task-ledger.md
grep -n "^## Template for the next phase" docs/audit/task-ledger.md
```

Expect one hit on the first, on the line two above the template heading's line number (the row, then a blank line, then the heading).

G4. Line endings stay CRLF (not checked with grep, per this row):

```bash
git ls-files --eol docs/audit/task-ledger.md
node -e "const s=require('fs').readFileSync('docs/audit/task-ledger.md','utf8');console.log('CRLF',(s.match(/\r\n/g)||[]).length,'bareLF',(s.match(/(^|[^\r])\n/g)||[]).length)"
```

Expect `w/crlf`, and `CRLF 79 bareLF 0`.

G5. Zero em dashes:

```bash
node -e "const fs=require('fs');let n=0;for(const f of process.argv.slice(1)){fs.readFileSync(f,'utf8').split('\n').forEach((l,i)=>{if(l.includes(String.fromCharCode(8212))){n++;console.log(f+':'+(i+1))}})}console.log('em dashes:',n);process.exit(n?1:0)" docs/audit/task-ledger.md workflow/stages/02_build/output/task-T755-build.md
```

Expect `em dashes: 0`.

G6. Scope:

```bash
git diff --stat; git status --porcelain
```

Expect only `docs/audit/task-ledger.md` modified, plus the untracked `task-T755-spec.md` and `task-T755-build.md`.

No lint or test suite: docs-only tier, and the before-done line applies only to code tiers (`AGENTS.md:92`).

## 9. Production touch points

None.

## 10. Out of scope

- `workflow/stages/*/CONTEXT.md`: the order says not to change the stage files. The rule waits in the Backlog until a spec uses it.
- `AGENTS.md`, ADR `0101`, `docs/contexts/*.md`.
- `docs/audit/refactor-log.md`: T754's Phase 128 entry stays as it is. Its heading names `T754` only; whether to widen it to `T754-T755` is the deploy record's call, not this task's.
- `docs/audit/baseline-metrics.md`.
- Every other ledger row, including T754's row and the Backlog's existing rows.
