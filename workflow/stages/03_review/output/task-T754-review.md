# T754 review

## Round 1

### 1. Metadata

- **Task:** T754, Phase 128 (`phase-128-workflow-automation`, at `88cc32b`)
- **Date:** 2026-10-16
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:** `AGENTS.md`, `workflow/stages/01_spec/CONTEXT.md`, `workflow/stages/02_build/CONTEXT.md`, `workflow/stages/03_review/CONTEXT.md`, `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`, `.claude/settings.json`, `docs/audit/refactor-log.md`. Bookkeeping: `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T754-build.md`. `git check-ignore -v` reports none of the seven targets as ignored.

### 2. Summary

The builder made spec edits A to H and L exactly as written. The changes: a per-task build report (`task-<id>-build.md`) with `build-report.md` kept as the last shared report; short spec orders in stage 01; the pause-after-spec rule and the automatic commit of each APPROVED task in `AGENTS.md`'s ICM section; four Phase 128 amendments in ADR `0101`. `.claude/settings.json` loses only the `Bash(ALLOW_GIT_WRITE=1 git commit:*)` ask rule. The refactor-log entry and the ledger section follow the existing format, with the `<sha>` placeholders and the `Commit` cell left empty.

### 3. Invariants and parity

- **Parity map:** no row touched (spec section 5). Confirmed: no `src/`, `api/`, `supabase/`, `unit/`, `tests/` or `vercel.json` change.
- **Edit fidelity:** every changed line in the diff matches the spec's quoted new text word for word (A1 to A3, B1 to B3, C, D1, D2, E1 to E4, F1, F2, G, H, L). `AGENTS.md:129` (the `main` deploy-record exception) and ADR `0101` sections 3 and 4 are unchanged, as the spec requires.
- **Settings:** exactly one line removed. `Bash(ALLOW_GIT_WRITE=1 git push:*)`, `Bash(git commit:*)`, `PowerShell(git commit:*)` and every deny rule stay, and no key or allow rule was added.
- **`build-report.md`:** untouched (still T753's report).
- **Line endings:** all seven targets and the ledger stay CRLF with a final CRLF: `git ls-files --eol` shows `w/crlf`, and a Node count gives `.claude/settings.json` 113 CRLF, 0 bare LF.
- **Doc-only phase paperwork:** a refactor-log entry and no `baseline-metrics.md` section, per `AGENTS.md:116`.
- **Em dashes:** zero in every touched file (G6).

### 4. Gates run

All run by the reviewer from the repo root in Git Bash, after the build.

- **G1** paths exist: all 8 listed (`build-report.md`, `FinanceContext.tsx`, the three stage files, `src/selectors/`, `supabase/`, `api/`), exit 0.
- **G2** `git diff --quiet -- workflow/stages/02_build/output/build-report.md`: `unchanged`.
- **G3** `git diff --numstat -- .claude/settings.json`: `0	1	.claude/settings.json`. `git diff -U0 ... | grep -E '^[-+] '`: exactly one line, `-      "Bash(ALLOW_GIT_WRITE=1 git commit:*)",`. `wc -l`: 113. `grep -c $'\r'`: **0**, but this shell's grep does not report CR here: a Node count shows 113 CRLF and 0 bare LF, `tail -c2` is `\r\n`, and `git ls-files --eol` shows `w/crlf`. The endings are intact; see Non-blocking.
- **G4** schema validation against `https://json.schemastore.org/claude-code-settings.json` with `ajv` 8.20.0: `valid`, exit 0 (the expected `unknown format "uri"` warnings only). Log: `workflow/stages/03_review/output/logs/T754-settings-schema.log`.
- **G5** `build-report`: 3 hits, `02_build/CONTEXT.md:30` (the last-shared-report sentence), ADR `0101:70` and `:126` (amendment 1); 0 in `AGENTS.md` and `03_review/CONTEXT.md`. `commit <id>`: 3 hits, `AGENTS.md:128` ("with no `commit <id>` order"), ADR `0101:82` (section 4) and `:129` (amendment 4); 0 in the stage files. `owner's order`: 0 hits.
- **G6** em dash scan of the 9 touched files: `em dashes: 0`.
- **G7** `git diff --stat`: 8 files, 45 insertions, 13 deletions (the 7 targets plus `docs/audit/task-ledger.md`). `git status --porcelain`: those 8 plus the untracked `task-T754-spec.md` and `task-T754-build.md`. No unannounced file.
- No lint or test suite: docs-only tier, and the before-done line applies only to code tiers (`AGENTS.md:92`).

### 5. Not verified

- Whether removing the prefixed ask rule actually stops Claude Code from prompting on `ALLOW_GIT_WRITE=1 git commit ...`, given the remaining bare `Bash(git commit:*)` ask rule. That depends on Claude Code's matcher and the orchestrator's permission mode, and only the first automatic commit shows it (spec section 9). The owner confirms then.
- The herdr orchestrator's own configuration (outside the repo): whether it follows the new pause and commit rules is the owner's to set up.

### 6. Blocking

None.

### 7. Non-blocking

- `workflow/stages/01_spec/output/task-T754-spec.md` G3: `grep -c $'\r'` returns 0 on a CRLF file in this Git Bash (the reviewer's own spec wording). A future spec should count line endings with `git ls-files --eol <file>` or a Node count instead. The builder's report says "CRLF preserved", which is true, but it does not show a count that proves it.
- `AGENTS.md:127`: "or the ledger" inside the money-path list is the owner's wording and reads as the money ledger. If the orchestrator ever confuses it with `docs/audit/task-ledger.md`, the next sentence (bookkeeping never causes a pause) settles it.

### 8. Rule candidates

- Specs and reviews check CRLF with `git ls-files --eol` (or Node), not `grep -c $'\r'`, which this shell does not count reliably. It belongs in `workflow/stages/01_spec/CONTEXT.md` once a spec uses it.

### 9. Fix block

Not applicable (APPROVED).
