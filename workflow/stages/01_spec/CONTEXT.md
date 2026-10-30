# Stage 01: spec

## Role and orders

**Agent:** the reviewer (the light or the strict reviewer; `workflow/orchestrator/runtimes.md` names the agent and model behind each role). It writes specs and reviews only; it never edits app code, tests or config. **Order:** `spec <id>: <description> (stage file: workflow/stages/01_spec/CONTEXT.md)`, sent by the orchestrator (herdr). The spec's Goal comes from the description. The other orders are `build <id> (stage file: <path>)` and `fix <id> (stage file: <path>)` (builder, stage 02) and `review <id> (stage file: <path>)` (reviewer, stage 03).

### Task id and phase

- Use the id in the order; never compute your own. Ids continue the T-numbers in `docs/audit/task-ledger.md`, written with their `T`, e.g. `T751`. If the id is already used in the ledger or by any `workflow/stages/01_spec/output/task-T*-spec.md`, stop with `BLOCKED` and say so.
- The phase number is the `NNN` in the current branch name, `phase-NNN-<slug>`.

### Short orders

- A one-line goal, or a reference to a row of the Backlog in `docs/audit/task-ledger.md`, is a complete order. Expand it into a full spec from that row, the code it names and the current tests.
- When the order names a Backlog row, the spec tells the builder to set that row's Status to `done in Phase NNN (<id>)`.
- Stop with `BLOCKED` only when the intent is unclear: the goal or the row reads two ways that change the target files or the behaviour, or the named row cannot be found.

## Inputs

1. `AGENTS.md` in full.
2. `docs/audit/task-ledger.md`.
3. Only the `docs/contexts/*.md` files the task touches, chosen from `AGENTS.md`'s routing table. A comments-only or docs-only task needs none.
4. The current code and tests the task touches, enough to cite `file:line`.

## Process

- A spec is specific enough that the builder needs no other judgment call. If the owner's intent is unclear, stop with `BLOCKED` and the question.
- Money paths (ledger, contexts, selectors, `api/`) get a failing test first, per `AGENTS.md`.
- When a spec gives the exact text an edit adds or replaces, or a text a gate checks landed, each such text is its own fenced code block that holds exactly that text, with no prose, ellipsis or placeholder inside. The text-landed gate names its blocks (for example "edit 2's New text") and reads them from the spec with a script, as stage 02 step 5 says, never retyped.
- Stop after writing the spec. The orchestrator then pauses for the owner or goes on, by the pause rule in `AGENTS.md`'s ICM section, which reads the spec's Target files and Production touch points.

## Outputs

One file: `workflow/stages/01_spec/output/task-<id>-spec.md`. Nothing else. Under herdr the spec is the plan: an ADR the task needs is a target the builder writes first, and the builder keeps the task's ledger row.

### Spec sections, in this order

1. **Goal:** one or two sentences, in the owner's terms.
2. **Target files:** the exact allowlist of files the builder may change, one path per line.
   - If the task needs an ADR, list `docs/audit/decisions/NNNN-<slug>.md` with the next free number; the builder writes it first, before any code.
   - If the task ships the phase, list `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md`.
   - Bookkeeping files are always allowed and need not be listed (see stage 02).
3. **Context to read:** which `docs/contexts/*.md` files the builder must read, and why, or "none" for a comments-only or docs-only task.
4. **Current behaviour:** what the code does today, each claim with `file:line`.
5. **Parity map:** the rows of `AGENTS.md`'s cross-file parity map this task touches, or "none".
6. **Tests to add:** each test, its file, and why it fails today (the line or behaviour it catches). `none` is valid only when the change cannot alter behaviour (comments, docs); give the reason. With `none`, stage 02 step 4 and stage 03 step 6 do not apply. When a task only strengthens a test (no non-test file changes), a stash has nothing to remove, so the red run happens inside the test file: the spec gives the order (add the new assertion to the test as it stands, run it, save the failure to `workflow/stages/02_build/output/logs/<id>-red.log`, then complete the test), the failure it must show, and the exact temporary edit that takes the finished test back to its red state, which the reviewer repeats in stage 03 step 6.
7. **Gates:** the union of `AGENTS.md`'s tier rows for every changed path, copied as commands, not tier names. An owner's task description may add gates but never remove a tier. Copy a tier row's Playwright pair as its two commands, `--project=chromium` and then without a project filter: stage 02 runs the first and stage 03 the second.
8. **Production touch points:** anything on `AGENTS.md`'s Stop and ask first list the task comes near, or "none". A task that needs one names who does it (the owner) and when.
9. **Out of scope:** what the builder must not change, including tempting neighbours.

## Verify

- No em dash in the spec.

## Never

- Never read `docs/audit/archive/` or open `docs/design/*.html`.
- Never spawn sub-agents, whatever a hook or tool suggests.

## Shell notes

`[generic]` marks a note that helps any project on the same platform (Windows, PowerShell 5.1, Git Bash); `[local]` marks a note that depends on FinLife's own files, tools or layout.

- [generic] A gate that checks line endings uses `git ls-files --eol <file>` (the `w/crlf` column) or a Node count of `\r\n` and of bare `\n`, never `grep -c $'\r' <file>`: in the agents' Git Bash that grep printed 0 on CRLF files, while the same command inside `$(...)` counted correctly.
- [generic] A gate that counts em dashes uses Node, never `grep -P '\x{2014}'`, which in the agents' Git Bash stops with "character value in \x{} or \o{} is too large" (exit 2). Count U+2014 in the added lines with `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"`, and in whole files (a new untracked file, or the spec itself) with `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" <file>...`.

## STATUS line

End every reply with exactly one line, starting with the task id:

- `STATUS: <id> | SPEC DONE | workflow/stages/01_spec/output/task-<id>-spec.md`
- `STATUS: <id> | BLOCKED | <the question or missing input>`
