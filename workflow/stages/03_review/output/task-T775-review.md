# Review: T775

## Round 1

### 1. Metadata

- **Task:** T775, Phase 138 (branch `phase-138-reviewer-subagents`)
- **Date:** 2026-10-18
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:** `.claude/agents/fin-reviewer.md`, `.claude/agents/fin-reviewer-strict.md`, `AGENTS.md`, `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`, `docs/audit/refactor-log.md` (plus bookkeeping `docs/audit/task-ledger.md`)

### 2. Summary

The build adds two project sub-agents, `fin-reviewer` (Sonnet) and `fin-reviewer-strict` (Opus), byte for byte from the spec's 7.2 and 7.3 blocks. The two files differ only in name, description and model. `.claude/agents/` joins the automatic-pause list at `AGENTS.md:128`. ADR `0101` gets a Phase 138 amendment, the refactor log a Phase 138 entry, and the ledger a Phase 138 section with the T775 row.

### 3. Invariants and parity

- **Parity map:** none touched (spec 5). Confirmed: no app code, test, config or schema file changed.
- **Role prompt:** the body equals the owner's role prompt except the one sentence the spec's 7.1 names ("After each order, wait for the next one." became "You run one order per invocation: ..."). It then adds the final-message, BLOCKED, git/secrets/`/api/*`/MCP and no-sub-agent rules (decision (b)). G1 confirms the adapted prompt occurs once per file and the wait sentence 0 times.
- **Frontmatter:** both files hold exactly `name`, `description`, `tools`, `model` between the `---` lines. `tools` is `Read, Grep, Glob, Bash, Write, Edit`, with no Agent tool. Neither description contains `: `, so both parse as plain YAML scalars.
- **AGENTS.md:** one line changed (`1 1`). The old phrase occurs 0 times and the new one once. Lines `:124` and `:126` and the Stop and ask first list are unchanged.
- **ADR:** the amendment is appended after the Phase 130 release (`5 0`). The file still ends with one CRLF, and no earlier section or amendment changed.
- **Refactor log:** the entry sits above Phase 137 with a blank line, `---` and a blank line, and keeps all four headings.
- **Ledger:** the Phase 138 section sits above `## Backlog`. The branch line names `f5b05cd`, which matches `git merge-base HEAD main`, and the `Commit` cell is empty.
- `docs/audit/archive/`: untouched (0 files in `git diff HEAD --name-only -- docs/audit/archive`).

### 4. Gates run

All output is in `workflow/stages/03_review/output/logs/T775-gates.log`.

- **Step 1:** `git check-ignore -v -n` on all five targets prints `::` for each, exit 1. No target is ignored.
- **G1** (text from the spec's blocks): whole-file match `true` for both agent files; role-prompt occurrences 1 and 1; `agents-pause` 1; `adr-amendment` 1; `agents-pause-old` 0; wait-sentence 0 and 0. Exit 0.
- **G2:** `true name,description,model`.
- **G3:** `::` for both agent files, exit 1; `?? .claude/agents/fin-reviewer-strict.md` and `?? .claude/agents/fin-reviewer.md`.
- **G4:** `git status --porcelain` lists `M AGENTS.md`, `M` ADR 0101, `M docs/audit/refactor-log.md`, `M docs/audit/task-ledger.md`, `?? .claude/agents/` and the T775 spec and build report. The protected-paths status printed nothing. Numstat: `AGENTS.md 1 1`, ADR `5 0`. `git diff --stat`: 4 files, 25 insertions, 1 deletion.
- **G5:** the four tracked files are `i/lf w/crlf`. Node counts give 0 bare LF everywhere: both agent files crlf 10, refactor-log 51, task-ledger 81, AGENTS.md 134, ADR 142.
- **G6:** `ls` of every named path, exit 0.
- **G7:** 0 em dashes in the added diff lines, and 0 in each agent file, the build report and the spec.
- No lint, unit or Playwright run, per the spec: no code tier row matches a changed path.

### 5. Not verified

- Whether Claude Code loads both agents and honours `tools` and `model`. No CLI lists project sub-agent files (`claude agents` manages background sessions). The first Phase 139 order proves it, as spec 9 says.
- Step 6 (red run): skipped, because the spec's tests are `none`.

### 6. Blocking

None.

### 7. Non-blocking

- `docs/audit/refactor-log.md`: the Phase 138 entry's `**Verified:**` and `**Surprises:**` lines have no final period, unlike the Phase 136 and 137 entries. The deploy record can add the periods when it fills in the shas.

### 8. Rule candidates

None. Spec-block extraction in G1 worked as the Backlog row for text-landed gates proposes (Phase 137, T772's review). That is one more data point for the row, not a new candidate.
