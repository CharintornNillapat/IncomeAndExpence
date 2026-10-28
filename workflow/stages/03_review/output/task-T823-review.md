# T823 review

## Round 1

### 1. Metadata

- Task: T823, Phase 155, branch `phase-155-rule-candidates`
- Date: 2026-10-28
- Round: 1
- Verdict: APPROVED
- Target files: `workflow/stages/02_build/CONTEXT.md`, `workflow/stages/01_spec/CONTEXT.md`, `docs/audit/task-ledger.md` (bookkeeping). `git check-ignore -v` on all three: no output, exit 1 (none ignored).

### 2. Summary

Stage 02 step 5 gains one sub-bullet: a text-landed gate reads its expected text from the spec's fenced code blocks with a script, normalising `\r\n`, never retyped. Stage 01 Rules gains the matching bullet so spec authors put each such text in its own fenced block. The ledger gets the Phase 155 section with the T823 row, and Backlog row 104's Status goes from `todo` to `done in Phase 155 (T823)`.

### 3. Invariants and parity

- Parity map: no row touched (docs only).
- Docs-only classification: every changed path (`git diff --name-only HEAD`) matches `docs/`, `anti-slop/` or `*.md`: `docs/audit/task-ledger.md` true, `workflow/stages/01_spec/CONTEXT.md` true, `workflow/stages/02_build/CONTEXT.md` true.
- Only the spec's lines changed: stage files `1 0` each. The ledger diff is the 6-line Phase 155 block above `## Backlog` plus the Status cell of row 104. Row 105 (T824's) is unchanged.
- No step renumbering: stage 01 line 39's "stage 02 step 4" and "stage 03 step 6" still point at the right steps. The new stage 01 bullet's "stage 02 step 5" is the step that runs the gates, and edit 1 sits under it.
- Stage 03 is unchanged, as the spec's Out of scope says.
- Compliance: no current stage file holds a text-landed gate that contradicts the rule.

### 4. Gates run

1. Text landed. I extracted the spec's fifth fenced block with the spec's own `node -e` one-liner into the scratchpad `gate1.sh` and ran it with `bash` from the repo root: blocks 0 to 3 each `n 1`, `anchor true`, `control 0`, exit 0. Log: `workflow/stages/03_review/output/logs/T823-gate1.log`.
   - On-disk negative control: I copied the spec and the three files to a scratch tree, dropped one character from the landed line in each stage file, and ran the same script there. Blocks 0 and 1 gave `n 0`, `anchor false`; blocks 2 and 3 gave `n 1`; exit 1. Log: `workflow/stages/03_review/output/logs/T823-gate1-negative.log`. The script's in-memory control (one character changed at `at+5`) gave 0 for all four blocks in the real run.
2. Diff shape: `git diff --numstat` gives `1 0` for `workflow/stages/01_spec/CONTEXT.md` and `1 0` for `workflow/stages/02_build/CONTEXT.md`. `git diff -U0 -- docs/audit/task-ledger.md` shows two hunks, `@@ -73,0 +74,6 @@` (the Phase 155 section) and `@@ -104 +110 @@` (row 104).
3. Stated references: `workflow/stages/03_review/output/task-T772-review.md` exists. Its Round 1 starts at line 55, and the candidate is at line 108 (section 8). Gate 1's anchor confirms edit 1 sits under step 5.
4. Line endings: `git ls-files --eol` gives `i/lf w/crlf` for all three. The Node bare-`\n` count is 0, 0, 0.
5. Em dashes (Node, U+2014): 0 in the added lines of `git diff -U0 HEAD`. 0 in each of the three target files, `task-T823-spec.md` and `task-T823-build.md`. This review file has none either.
6. Scope: `git status --porcelain` lists ` M` for the three target files, plus `??` for `task-T823-spec.md`, `task-T824-spec.md` and `task-T823-build.md`. `git diff --stat` shows 3 files, 9 insertions, 1 deletion. The only file outside T823 is `workflow/stages/01_spec/output/task-T824-spec.md`, which belongs to T824's parallel spec. I left it alone and it must not be staged with T823.

No unit or Playwright suite runs on the docs-only tier.

### 5. Not verified

- The builder's pre-build red run (exit 1, all `n 0`). The pre-build tree no longer exists. The on-disk negative control above shows the script fails when the text is missing or one character off.
- Step 6 (tests fail without the change) does not apply: the spec's tests are `none`.

### 6. Blocking

None.

### 7. Non-blocking

- The build report's Gate 1 numbers are summarised, not counted per command with a log path for gates 2 to 6. That is acceptable for the docs-only tier.

### 8. Rule candidates

None new. This task promotes the T772 candidate.

### 9. Files to stage for the T823 commit

- `workflow/stages/02_build/CONTEXT.md`
- `workflow/stages/01_spec/CONTEXT.md`
- `docs/audit/task-ledger.md`
- `workflow/stages/01_spec/output/task-T823-spec.md`
- `workflow/stages/02_build/output/task-T823-build.md`
- `workflow/stages/03_review/output/task-T823-review.md`

Do not stage `workflow/stages/01_spec/output/task-T824-spec.md`: it is T824's file.
