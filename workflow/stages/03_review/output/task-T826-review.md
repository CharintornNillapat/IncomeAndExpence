# T826 review

## Round 1

### 1. Metadata

- Task: T826, Phase 157, branch `phase-157-auto-merge-permission` (cut from `main` at `7383179`), the only task of the phase.
- Date: 2026-10-29
- Round: 1
- Verdict: APPROVED
- Target files: `.claude/settings.json`, `AGENTS.md`, `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`, `docs/audit/refactor-log.md`; bookkeeping `docs/audit/task-ledger.md`. `git check-ignore -v` on all five: exit 1, none ignored.

### 2. Summary

`.claude/settings.json` gains an `allow` list with `gh pr merge * --auto --merge*` (Bash and PowerShell), and each blanket `gh pr merge:*` deny is replaced in place by five denies (`--squash`, `--rebase`, `--admin`, `-s`, `-r`). `AGENTS.md:130` and `:134` add `.github/workflows/` and `.claude/settings.json` to the pause list and the Release Otherwise list (Edit E). ADR 0101 gets the Phase 157 amendment, the refactor log the Phase 157 entry, and the ledger the Phase 157 section with the T826 row.

### 3. Invariants and parity

- Parity map: no row covers these files (spec section 5). Not applicable.
- `AGENTS.md:130`, the orchestrator's check: the line holds the spec's E1 new text exactly (G4: Landed count 1, Gone count 0) and nothing else on the line or file changed (`git diff --numstat` `2 2`; the diff shows only the two list fragments). How the sentence reads: "a money path (...), anything under `supabase/`, `api/`, `.claude/agents/` or `.github/workflows/`, `.claude/settings.json`, `AGENTS.md`, or a `workflow/stages/*/CONTEXT.md` file". The inner "anything under A, B, C or D" list followed by more outer items is the same nesting HEAD already had ("`api/` or `.claude/agents/`, `AGENTS.md`, or a ..."), so it is no new ambiguity. The only alternative reading puts `.claude/settings.json` inside "anything under", and "anything under" a single file is that file, so both readings give the same pause set. Not a defect. See Non-blocking 1 for an optional rewording.
- `AGENTS.md:134` holds the E2 new text exactly. The Auto-merge line (`:133`), Stop and ask first and the counts on `:11` are unchanged. `:133`'s "the pause list above" now takes in both new paths, as the spec intends.
- `AGENTS.md:38` (the `gh pr merge --auto` exception) is consistent with the new allow rule.
- Settings: `$schema`, the `ask` list (11, including `gh pr create`) and the other 89 deny rules are unchanged (G3). The `allow` key comes first in `permissions`.
- No `gh pr merge` command of any form was run in this review.

### 4. Gates run

All from the repo root in Git Bash. Output in `workflow/stages/03_review/output/logs/T826-gates.log` (G1 to G8), `T826-settings-schema.log` (G5) and `T826-workflow-hardening.log` (G10).

- G1 `ls -d ...`: all 4 paths listed, exit 0.
- G2 `git diff --numstat -- .claude/settings.json`: `14 2 .claude/settings.json`; the removed lines are exactly `"Bash(gh pr merge:*)",` and `"PowerShell(gh pr merge:*)",`.
- G3 rule lists against HEAD: `allow 2 deny 99 ask 11 OK`, exit 0.
- G4 text landed: 10 blocks (settings x3 = 1, ADR = 1, ledger x2 = 1, AGENTS.md Landed x2 = 1, AGENTS.md Gone x2 = 0), `blocks 10 bad 0`, exit 0.
- G5 schema (fresh download of `json.schemastore.org/claude-code-settings.json`, repo `ajv`): `valid`, exit 0; 6 `unknown format "uri" ignored` warnings, as expected.
- G6 command model: 14 lines, each matching section 4's table (allow, allow, prompt, prompt, deny, deny, deny per shell), `mismatches 0`, exit 0.
- G7 line endings: `i/lf w/crlf` on all 5; CRLF settings 123, `AGENTS.md` 140, ADR 156, refactor-log 132, ledger 150; bareLF 0 for every file; `git diff --numstat -- AGENTS.md` `2 2`.
- G8 em dashes: `em dashes: 0` across the 5 files plus the spec and build report; `0` in the added lines of `git diff -U0 HEAD`.
- G9 scope: `git diff --stat` shows 5 files, 40 insertions, 4 deletions; `git status --porcelain` shows those 5 as `M` plus untracked `task-T826-spec.md` and `task-T826-build.md`. No unannounced file.
- G10 `npx vitest run unit/workflow-hardening.test.ts`: Test Files 1 passed (1), Tests 17 passed (17), 0 failed, 0 skipped.

No code tier applies, so no lint or full suite (spec section 8).

### 5. Not verified

- How Claude Code itself matches the new rules. G6 tests a model of the documented matcher, not Claude Code. Checking that would mean running `gh pr merge`, which the spec and the order rule out.
- The pre-edit controls (G4 `bad 10`, G6 `mismatches 8`) were the builder's. I did not stash `.claude/settings.json` to rerun them because both scripts read only the spec blocks and HEAD, and the post-edit results are deterministic. The spec's section 4 item 7 records the same controls on a scratch copy.
- Stage 03 step 6 (red run): skipped because the spec's tests are none (owner's decision, section 6).

### 6. Blocking

None.

### 7. Non-blocking

1. `AGENTS.md:130`: if the owner wants the sentence to read more cleanly in a later task, a version such as "anything under `supabase/`, `api/`, `.claude/agents/` or `.github/workflows/`; `.claude/settings.json`; `AGENTS.md`; or a `workflow/stages/*/CONTEXT.md` file" splits the inner list from the outer one. It is not needed now: the meaning is unambiguous, and the text matches the spec as it stands.
2. `docs/audit/refactor-log.md` Phase 157 **Changed** line: `.claude/settings.json and .github/workflows/` appear without backticks in the `AGENTS.md` clause, and the **Verified** line has no closing period. These are cosmetic, and the deploy record can fix them when it fills the `<sha>` placeholders.

### 8. Rule candidates

None. Edit E itself is the rule change, and the code already complies.
