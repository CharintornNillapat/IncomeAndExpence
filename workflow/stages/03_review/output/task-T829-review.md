# Task T829 review: faster gates (builder runs Playwright on chromium only, reviewer runs all three browsers once)

## Round 1

### Metadata

- Task: T829 (Phase 160, branch `phase-160-faster-gates`)
- Date: 2026-10-29
- Round: 1
- Verdict: APPROVED
- Target files: `AGENTS.md`, `workflow/stages/01_spec/CONTEXT.md`, `workflow/stages/02_build/CONTEXT.md`, `workflow/stages/03_review/CONTEXT.md`, `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md` (plus bookkeeping `docs/audit/task-ledger.md`). `git check-ignore -v` on all six: none ignored (exit 1).

### Summary

The builder made spec edits 1 to 7 word for word. The tier row for `src/context/`, `src/hooks/` and `src/lib/` now uses the same chromium-then-unfiltered wording as the other rows. A new paragraph in AGENTS.md splits the Playwright pair by stage under herdr. Each of the three stage files gets one sentence or bullet: the spec copies the pair as two commands, the builder runs chromium only and lists the unfiltered gates under `Left to the reviewer`, and the reviewer runs each unfiltered gate once. ADR 0101 gets a Phase 160 amendment. The ledger has a new Phase 160 section with the T829 row (done), and the Backlog row is set to `done in Phase 160 (T829)` with its Task text left as it was.

### Invariants and parity

- Parity map: none touched (the spec says none; the diff touches only docs and workflow rules).
- `AGENTS.md:76` ("may add gates but never remove a tier") is unchanged. The split keeps every tier command in the task: the builder runs chromium and the reviewer runs the unfiltered pass.
- `.claude/agents/fin-reviewer.md:8` and `fin-reviewer-strict.md:8` are unchanged. Each still contains "Run the spec's gate commands yourself." once. `git status --porcelain -- .claude/agents/` is empty.
- Step 4's own sentence in `03_review/CONTEXT.md` (including "Do not copy the builder's numbers.") is unchanged. The new bullet is inserted below it.
- ADR 0101 section 3 (`:76`, "runs the gates itself") is unchanged. The amendment is appended at the end of the file, after the Phase 159 amendment, as the spec says.
- Line endings: the five targets are still CRLF in the working tree and the ledger is still LF (gate 3).
- Consistency across the edited files: AGENTS.md row 85 now matches rows 82 and 86. The builder's bullet (fallback to `npm test -- --project=chromium` when a gate has no chromium partner) and the reviewer's bullet (skip a chromium gate only when an unfiltered gate covers the same specs) fit together without a gap.

### Gates run

All commands were run from the repo root in Git Bash, with `D=workflow/stages/03_review/output/logs/`. The helper was extracted by script from the spec to `workflow/stages/03_review/output/logs/T829-gates.cjs` (gitignored, `.gitignore:94`).

- **Gate 1, text landed:** `node $H` printed `blocks 7 checks 9 bad 0`, exit 0. Red control: the same helper run against `git show HEAD:` copies of the seven files in a scratch folder printed `blocks 7 checks 9 bad 13`, exit 1 (same 13 lines as the build report's control).
- **Gate 2, no em dash:** em dashes on added diff lines: 0. Per-file counts: 0 in each of the 8 files listed.
- **Gate 3, line endings:** `git ls-files --eol` shows `w/crlf` for AGENTS.md, ADR 0101 and the three CONTEXT.md files, and `w/lf` for the ledger. Counts: AGENTS.md crlf 143 bareLF 0; 01_spec crlf 60 bareLF 0; 02_build crlf 56 bareLF 0; 03_review crlf 47 bareLF 0; ADR 0101 crlf 164 bareLF 0; ledger crlf 0 bareLF 175.
- **Gate 4, scope:** `git status --porcelain` lists the five targets and the ledger as modified, and `task-T829-spec.md`, `task-T830-spec.md` (T830's own spec, which the spec allows) and `task-T829-build.md` as untracked. `git diff --stat`: 6 files, 18 insertions, 4 deletions. `.claude/agents/`: 0 changes. No unannounced file.
- **Gate 5, counts and paths (by reading):** edit 7's figures (9.4 min, 7.0 min, 11 specs, about 8 min) match the Backlog row (`docs/audit/task-ledger.md:163`, formerly `:157`). `git ls-files` lists every path the new text names (`.claude/agents/fin-reviewer.md`, `fin-reviewer-strict.md`, AGENTS.md, the three stage files).
- Docs-only tier: no lint, unit or Playwright run is required, and no full-suite log was produced.

### Not verified

- Nothing material. The spec has no Playwright gate, so the new split could not be exercised in this task. Its first real use is the next task with a UI or context tier.

### Blocking

None.

### Non-blocking

- `workflow/stages/02_build/output/task-T829-build.md:52` labels the helper script as the "Helper log". It is the script, not a log. This is cosmetic.

### Rule candidates

None. The rule is already in AGENTS.md and the stage files with this task.
