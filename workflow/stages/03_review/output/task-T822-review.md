# T822 review

## Round 2

### 1. Metadata

- Task: T822, Phase 154, branch `phase-154-docs-ci-checks` (HEAD `da96700`)
- Date: 2026-10-28
- Round: 2 (after the builder's `## Fix round 1`)
- Verdict: APPROVED
- Target files: unchanged from Round 1. None ignored.

### 2. Summary

The fix round changed only `docs/audit/decisions/0111-docs-only-prs-report-required-checks.md` and `docs/audit/baseline-metrics.md`. Both blocking items now read exactly as the Round 1 fix block asked. The builder also added Round 1's non-blocking note as a Consequences bullet, and it is accurate.

### 3. Invariants and parity

- Round 1 blocking item 1: ADR 0111 line 19 (D2) now says "An empty diff or a non-pull-request event counts as code (`code=true`); a failed diff fails the `changes` job, so the required checks never pass (fails closed)." That matches the workflow and the harness's `exit 128`. Fixed.
- Round 1 blocking item 2: `baseline-metrics.md` line 31 now ends "(no spec or app file changed; the docs-only path is proven by the PR's own CI and the first docs-only PR after the merge, ADR 0111)". It no longer claims a PR run. Fixed.
- New ADR line 29 (Consequences): "If the `changes` job fails, `checks` is skipped, but branch protection remains blocked because the matrix job `e2e` reports an unexpanded name..." This matches Round 1's analysis. OK.
- Nothing else changed since Round 1. `git status --porcelain` lists the same 9 modified files and 4 untracked files. `git diff --stat` still gives 213 insertions and 12 deletions, with `playwright.yml` at 78 lines and its diff hash still `9af2fd7`. Only the two fix-target files have mtimes after the Round 1 logs (18:58:10; every other file is 18:53:31 or earlier). The stash list is empty.
- CRLF: `baseline-metrics.md` is `w/crlf`; the ADR is CRLF ASCII.
- Em dashes: 0 in added lines (`git diff -U0 HEAD`), 0 in the ADR, 0 in the build report.
- Counts: `AGENTS.md:11` and `README.md:157` still say 1606 tests in 72 files. That matches `workflow/stages/03_review/output/logs/T822-unit.log` (72 passed, 1606 passed). No test file changed since then.
- `.gitignore` (MASTER's pre-applied change): unchanged since Round 1 (mtime 18:16), which already verified it.

### 4. Gates run

| Command | Result | Log |
|---|---|---|
| `npm run lint` | exit 0 | `workflow/stages/03_review/output/logs/T822-r2-lint.log` |
| `npx vitest run unit/workflow-hardening.test.ts` | 1 file, 17 passed, 0 failed, 0 skipped | `workflow/stages/03_review/output/logs/T822-r2-hardening.log` |
| Full unit suite | not rerun: only docs changed since Round 1's 72 files / 1606 passed run | `workflow/stages/03_review/output/logs/T822-unit.log` |

### 5. Not verified

- As in Round 1: how GitHub Actions really behaves on this workflow. Only the PR's own CI and the first docs-only PR after the merge can show it.

### 6. Blocking

None.

### 7. Non-blocking

- `baseline-metrics.md` cites the builder's unit timings (83.99 s, seed `1793187995002`). My runs gave the same counts with different timings, which is normal. No change needed.

### 8. Rule candidates

- None.

### Files to stage for the commit

Stage these by path, never with `git add -A`:

```
docs/audit/decisions/0111-docs-only-prs-report-required-checks.md
unit/workflow-hardening.test.ts
.github/workflows/playwright.yml
AGENTS.md
README.md
docs/contexts/ui-and-e2e.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
.gitignore
docs/audit/task-ledger.md
workflow/stages/01_spec/output/task-T822-spec.md
workflow/stages/02_build/output/task-T822-build.md
workflow/stages/03_review/output/task-T822-review.md
```

Do not stage the logs under `workflow/stages/*/output/logs/`; git ignores them.

## Round 1

### 1. Metadata

- Task: T822, Phase 154, branch `phase-154-docs-ci-checks` (HEAD `da96700`)
- Date: 2026-10-28
- Round: 1
- Verdict: CHANGES REQUESTED
- Target files: `docs/audit/decisions/0111-docs-only-prs-report-required-checks.md`, `unit/workflow-hardening.test.ts`, `.github/workflows/playwright.yml`, `AGENTS.md`, `README.md`, `docs/contexts/ui-and-e2e.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `.gitignore` (pre-applied by MASTER), plus bookkeeping `docs/audit/task-ledger.md`. `git check-ignore -v` on all of them: none ignored (exit 1).

### 2. Summary

`playwright.yml` drops the `pull_request` paths filter, adds a `changes` job that classifies the merge diff (`HEAD^1..HEAD`, `--no-renames`) as docs-only or code, and gates every step of `checks` and `e2e` (and `merge-reports` at job level) on `needs.changes.outputs.code == 'true'`, so a docs-only PR reports the 7 required checks with skipped steps. The new hardening tests are byte-identical to the spec's block, and the docs are updated: ADR 0111, the AGENTS.md reason and count, README count, the ui-and-e2e CI paragraph, refactor-log, baseline-metrics and the ledger row. The code is correct and every gate passes. Two factual sentences in the docs are wrong and need fixing (see Blocking).

### 3. Invariants and parity

- `@playwright/test` version / `matrix.playwright` row: the version-check step body and the matrix are unchanged; only the step's `if:` was added. OK.
- No other parity row touched (no `src/`, `api/`, `supabase/`, selector or type change).
- Workflow hardening: the new `changes` job has `permissions: contents: read`, a sha-pinned checkout with `persist-credentials: false`, no secrets, and no `pull_request_target`. `github.event_name` goes in through `env:`, not shell interpolation. The existing tests 1 to 12 still pass.
- Diff shape: `git diff --stat -- .github/workflows/` names only `playwright.yml` (70+, 8-). The removed lines are exactly the 2 old comment lines, the `pull_request` `paths-ignore`, `needs: checks`, `needs: e2e`, the upload `if:`, the `merge-reports` `if:` and its comment line. The spec counted "three `needs:` lines", but `checks` had no `needs:` to remove, so two is right. Every other line is unchanged, and the file is `i/lf w/crlf`.
- Shell rule under GitHub's `bash -eo pipefail`: `printf` exits 0, so pipefail changes nothing, and the `!` pipeline in an `if` condition does not trip `-e`. A failed `git diff` in `files=$(...)` exits the step, as the harness's `exit 128` shows.
- The docs-only set is identical in the push `paths-ignore`, the `grep -Ev` pattern and `AGENTS.md:133`, locked by the new test.
- CRLF kept in every modified file (`git ls-files --eol`: all `w/crlf`); the ADR is CRLF ASCII.
- `.gitignore`: `git diff` is exactly the 3 spec lines after `workflow/stages/*/output/logs/`. `git check-ignore -v workflow/stages/02_build/.claude/x.json` gives `.gitignore:97:workflow/**/.claude/`, and `git check-ignore -q .claude/settings.json` exits 1, so the root `.claude/` stays tracked.
- Em dashes: 0 in added lines (`git diff -U0 HEAD`), 0 in the ADR, the spec and the build report.
- Counts: `AGENTS.md:11` and `README.md:157` say 1606 tests in 72 files, which matches my unit log.

### 4. Gates run

| Command | Result | Log |
|---|---|---|
| Spec test block vs file tail (node string compare) | identical | n/a |
| `npx vitest run unit/workflow-hardening.test.ts` | 1 file, 17 passed, 0 failed, 0 skipped | console |
| Red check: `git stash push -- .github/workflows/playwright.yml`, run the file, `git stash pop --index` | 4 failed, 13 passed (17). The 4 failures are exactly the spec's: `expected [ Array(1) ] to deeply equal []`, `.toMatch() expects ... got undefined`, `expected '' to match /^ {10}fetch-depth: 2$/m`, `expected [ …(2) ] to deeply equal [ Array(1) ]`. `git status --porcelain` before and after: identical; the `playwright.yml` diff hash is unchanged (`9af2fd7`); the stash list is empty | `workflow/stages/03_review/output/logs/T822-red.log` |
| `npm run lint` | exit 0 (node-globals 139 files clean, safe-ids 139 clean, both `tsc` clean) | `workflow/stages/03_review/output/logs/T822-lint.log` |
| `npm run test:unit` | 72 files passed, 1606 tests passed, 0 failed, 0 skipped, 56.43 s | `workflow/stages/03_review/output/logs/T822-unit.log` |
| `npm run test:unit:shuffle` | 72 files passed, 1606 tests passed, seed `1793188504850`, 78.84 s | `workflow/stages/03_review/output/logs/T822-unit-shuffle.log` |
| Classifier harness (extracted from the spec, the same as the builder's copy) | all 7 lines exactly as expected: docs `code=false`; code, move, mdx, push and empty `code=true`; no-parent `exit 128 output ''` | `workflow/stages/03_review/output/logs/T822-harness.log` |
| Playwright | not run, as the spec says (no `src/`, `tests/` or app file changed) | n/a |

### 5. Not verified

- How GitHub Actions really behaves: the `needs` context in step `if:`, an all-skipped job concluding success, the six expanded check names reporting, and the run parsing at all. Only the PR's own CI and the first docs-only PR after the merge can show this (spec section 10, items 1 to 3).
- Scope: `git status --porcelain` lists the 9 modified files, the untracked ADR, and the task's spec and build report. Nothing unannounced.

### 6. Blocking

- `docs/audit/decisions/0111-docs-only-prs-report-required-checks.md:19` - D2 says "any failure during diff classification defaults to `code=true` (fails closed)". That is the opposite of the code. A failed `git diff` exits the step (the harness shows `exit 128`, output empty), so the `changes` job fails, and the workflow comment says so ("A failed diff fails this job"). The spec's D2 says "a failed diff fails closed". - Change the last sentence to: "An empty diff or a non-pull-request event counts as code (`code=true`); a failed diff fails the `changes` job, so the required checks never pass (fails closed)."
- `docs/audit/baseline-metrics.md:31` - "verified via classifier harness ... and PR workflow run" claims a PR run that has not happened yet, and it cites the builder's harness log as if it verified Playwright. - Change the parenthesis to: "(no spec or app file changed; the docs-only path is proven by the PR's own CI and the first docs-only PR after the merge, ADR 0111)".

### 7. Non-blocking

- If `changes` fails, `checks` is skipped because its `needs` failed, and GitHub counts a skipped required check as passing. Merging stays blocked only because the `e2e` matrix then reports one unexpanded name, so the six `E2E (...)` contexts never report. The fail-closed claim holds, but through `e2e`, not `checks`. Mention this in the ADR's Consequences if you like. No code change.
- Spec section 9 item 5 says "the three `needs:` lines", but only two existed to remove. This is a spec wording slip, not a build issue.

### 8. Rule candidates

- None new. The `ui-and-e2e.md` line "Skip steps, never a matrix job" is already the rule, and the code complies.

### 9. Fix block

```
fix T822 (stage file: workflow/stages/02_build/CONTEXT.md)
Docs only; no code, test or workflow change. Keep CRLF.
1. docs/audit/decisions/0111-docs-only-prs-report-required-checks.md:19 (D2): replace
   "An empty diff, a non-pull-request event, or any failure during diff classification defaults to `code=true` (fails closed)."
   with
   "An empty diff or a non-pull-request event counts as code (`code=true`); a failed diff fails the `changes` job, so the required checks never pass (fails closed)."
2. docs/audit/baseline-metrics.md:31: replace
   "(no spec or app file changes; verified via classifier harness in `workflow/stages/02_build/output/logs/T822-harness.log` and PR workflow run)"
   with
   "(no spec or app file changed; the docs-only path is proven by the PR's own CI and the first docs-only PR after the merge, ADR 0111)"
Gates to rerun: em-dash count on added lines (spec 9.6) and on the ADR = 0; `git ls-files --eol` on both files still w/crlf; `git status --porcelain` unchanged apart from these two files' content. No unit rerun needed (docs only).
Append a "## Fix round 1" section to workflow/stages/02_build/output/task-T822-build.md.
```

### Files to stage for the commit (once APPROVED)

Stage these by path, never with `git add -A`:

```
docs/audit/decisions/0111-docs-only-prs-report-required-checks.md
unit/workflow-hardening.test.ts
.github/workflows/playwright.yml
AGENTS.md
README.md
docs/contexts/ui-and-e2e.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
.gitignore
docs/audit/task-ledger.md
workflow/stages/01_spec/output/task-T822-spec.md
workflow/stages/02_build/output/task-T822-build.md
workflow/stages/03_review/output/task-T822-review.md
```

Do not stage the logs under `workflow/stages/*/output/logs/`; git ignores them.
