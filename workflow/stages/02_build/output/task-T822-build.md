# Build Report - T822

## 1. Summary of Changes

Implemented Phase 154 (ADR 0111): docs-only pull requests report all 7 required checks on `main` (`Type-check and unit tests` and the six `E2E (<browser> <shard>/2)` shard jobs) without running the real test suites, eliminating the need for owner admin bypass while keeping real test execution on code changes.

- **`docs/audit/decisions/0111-docs-only-prs-report-required-checks.md`:**
  - Authored ADR 0111 detailing context (7 required checks on `main`, PR #105 admin bypass, unexpanded job name trap on job-level `if:`), decisions D1-D5, consequences, not done, and release plan.
- **`unit/workflow-hardening.test.ts`:**
  - Added new test describe block asserting:
    1. No paths filter on `pull_request` trigger.
    2. Job naming and matrix expansion exactly match the 7 required branch protection contexts.
    3. Step-level skipping on all steps in `checks` and `e2e` when `needs.changes.outputs.code != 'true'`, with no job-level `if:`, and `merge-reports` gated.
    4. Classifier logic correctly identifies docs-only paths (`docs/`, `anti-slop/`, `*.md`) versus code paths.
    5. Parity between the push filter, the classifier pattern, and the Release rule in `AGENTS.md`.
- **`.github/workflows/playwright.yml`:**
  - Edit 1: Removed `paths-ignore` from `pull_request` trigger (kept on `push`).
  - Edit 2: Inserted `changes` classification job before `checks`, checking out `HEAD^1..HEAD` with `fetch-depth: 2` and `--no-renames`, evaluating against `^(docs/|anti-slop/)|\.md$`.
  - Edit 3: Added `needs: changes` to `checks`, and added `if: needs.changes.outputs.code == 'true'` to all 6 steps.
  - Edit 4: Updated `e2e` needs to `[ changes, checks ]`, added `if: needs.changes.outputs.code == 'true'` to steps 1-6, and updated step 7 `Upload the blob report` condition to `${{ !cancelled() && needs.changes.outputs.code == 'true' }}`.
  - Edit 5: Updated `merge-reports` needs to `[ changes, e2e ]` and condition to `${{ !cancelled() && needs.e2e.result != 'skipped' && needs.changes.outputs.code == 'true' }}`.
- **`AGENTS.md`:**
  - Updated unit test count to 1606 tests in 72 files.
  - Updated docs-only auto-merge reason to note required checks pass with every step skipped (ADR 0111).
- **`README.md`:**
  - Updated unit test count to 1606 tests in 72 files.
- **`docs/contexts/ui-and-e2e.md`:**
  - Updated CI section describing the `changes` job, step-level skipping, and rationale for avoiding matrix job-level skipping.
- **`docs/audit/refactor-log.md`:**
  - Added Phase 154 entry at the top with Changed, Verified, Surprises, and Deliberately not done.
- **`docs/audit/baseline-metrics.md`:**
  - Added Phase 154 delta section against Phase 152 with measured Vitest counts (1606 tests, 72 files, in-order 83.99s, shuffled 69.76s seed 1793187995002) and note that bundle was not rebuilt as no app source files changed.
- **`.gitignore`:**
  - Pre-applied by MASTER: added `workflow/**/.claude/` rule.
- **`docs/audit/task-ledger.md`:**
  - Added Phase 154 section, marked T822 done with full gate result.

## 2. Files Changed (10 files)

1. `docs/audit/decisions/0111-docs-only-prs-report-required-checks.md` (untracked, new file)
2. `unit/workflow-hardening.test.ts` (modified)
3. `.github/workflows/playwright.yml` (modified)
4. `AGENTS.md` (modified)
5. `README.md` (modified)
6. `docs/contexts/ui-and-e2e.md` (modified)
7. `docs/audit/refactor-log.md` (modified)
8. `docs/audit/baseline-metrics.md` (modified)
9. `.gitignore` (pre-applied by MASTER)
10. `docs/audit/task-ledger.md` (modified bookkeeping)

## 3. Tests Added and Fail-then-Pass Evidence

Added describe block `playwright.yml reports the required checks on every pull request (ADR 0111)` in `unit/workflow-hardening.test.ts`.

### Red Gate (tests added before `.github/workflows/playwright.yml` edits):
- Command: `npx vitest run unit/workflow-hardening.test.ts`
- Log: `workflow/stages/02_build/output/logs/T822-red.log`
- Result: 1 failed file, 4 failed tests, 13 passed tests (17 total).
- Failure evidence:
  ```
  FAIL unit/workflow-hardening.test.ts > playwright.yml reports the required checks on every pull request (ADR 0111) > has no paths filter on pull_request, so every pull request starts a run
  AssertionError: expected [ Array(1) ] to deeply equal []
  - []
  + [ "    paths-ignore: [ 'docs/**', 'anti-slop/**', '**/*.md' ]" ]

  FAIL unit/workflow-hardening.test.ts > playwright.yml reports the required checks on every pull request (ADR 0111) > skips the steps of checks and e2e, never the jobs, on a docs-only pull request
  TypeError: .toMatch() expects to receive a string, but got undefined

  FAIL unit/workflow-hardening.test.ts > playwright.yml reports the required checks on every pull request (ADR 0111) > counts a pull request as docs-only only when every changed file is under docs/ or anti-slop/ or ends in .md
  AssertionError: expected '' to match /^ {10}fetch-depth: 2$/m

  FAIL unit/workflow-hardening.test.ts > playwright.yml reports the required checks on every pull request (ADR 0111) > uses the docs-only set of the push filter and of the Release rule in AGENTS.md
  AssertionError: expected [ …(2) ] to deeply equal [ Array(1) ]
  ```

### Green Gate (after `.github/workflows/playwright.yml` edits):
- Command: `npx vitest run unit/workflow-hardening.test.ts`
- Result: 1 passed file, 17 passed tests (17 total) in 308ms.

## 4. Verification Gates Run

### Gate 1: Targeted Vitest
- Command: `npx vitest run unit/workflow-hardening.test.ts`
- Result: 1 passed file, 17 passed tests in 308ms.

### Gate 2: `npm run lint`
- Command: `npm run lint`
- Result: Clean (exit 0).
  - `check:node-globals`: 139 files in `src/`, 0 errors.
  - `check:safe-ids`: 139 files in `src/`, 0 errors.
  - `tsc --noEmit`: 0 errors.
  - `tsc -p api/tsconfig.json`: 0 errors.

### Gate 3: Full Unit Suite (in-order and shuffled)
- In-order run:
  - Command: `npm run test:unit 2>&1 | Tee-Object -FilePath "workflow/stages/02_build/output/logs/T822-unit.log"`
  - Log: `workflow/stages/02_build/output/logs/T822-unit.log`
  - Result: 72 passed files, 1606 passed tests in 83.99s (+5 tests against Phase 152/151).
- Shuffled run:
  - Command: `npm run test:unit:shuffle 2>&1 | Tee-Object -FilePath "workflow/stages/02_build/output/logs/T822-unit-shuffle.log"`
  - Log: `workflow/stages/02_build/output/logs/T822-unit-shuffle.log`
  - Result: 72 passed files, 1606 passed tests in 69.76s with seed `1793187995002`.

### Gate 4: Classifier Harness
- Script: `workflow/stages/02_build/output/logs/T822-harness.sh`
- Command: `bash workflow/stages/02_build/output/logs/T822-harness.sh .github/workflows/playwright.yml 2>&1 | grep -v '^warning' | tee workflow/stages/02_build/output/logs/T822-harness.log`
- Log: `workflow/stages/02_build/output/logs/T822-harness.log`
- Result: All 7 test cases matched expected outcomes exactly:
  - `docs pull_request -> code=false`
  - `code pull_request -> code=true`
  - `move pull_request -> code=true`
  - `mdx pull_request -> code=true`
  - `push push -> code=true`
  - `empty pull_request -> code=true`
  - `no-parent pull_request -> exit 128 output ''`

### Gate 5: Workflow Diff Shape
- `git diff --stat -- .github/workflows/`: names only `playwright.yml` (70 insertions, 8 deletions).
- `git diff -U0 -- .github/workflows/playwright.yml`: only expected lines removed (old comment lines 7-8, `pull_request` `paths-ignore`, old `needs: checks`, old `needs: e2e`, old `if:` lines in e2e upload and merge-reports, and old comment line in merge-reports).
- `git ls-files --eol .github/workflows/playwright.yml`: `w/crlf`.

### Gate 6: Documentation and Line Endings
- `git ls-files --eol`: confirms `w/crlf` on all modified files (`AGENTS.md`, `README.md`, `docs/contexts/ui-and-e2e.md`, `unit/workflow-hardening.test.ts`, `.github/workflows/playwright.yml`, `docs/audit/task-ledger.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`).
- Unit test counts verified: `1606 tests, 72 files` in `AGENTS.md:11` and `README.md:157`.
- Em dash count in added lines (`git diff -U0 HEAD`): 0.
- Em dash count in ADR 0111: 0.

### Gate 7: `.gitignore` Verification
- `git diff .gitignore`: exactly the 3 lines added by MASTER for `workflow/**/.claude/`.
- `git check-ignore -v workflow/stages/02_build/.claude/x.json`: prints `.gitignore:97:workflow/**/.claude/`.
- `git check-ignore -q .claude/settings.json`: exits 1 (root `.claude/` remains tracked).

### Gate 8: Working Tree Scope and Reviewer Stash Check
- `git status --porcelain`: shows only Target files, bookkeeping ledger, and untracked ADR 0111.
- Stash check verified: `git stash push -- .github/workflows/playwright.yml` followed by `npx vitest run unit/workflow-hardening.test.ts` reproduces the exact 4 failures; `git stash pop` restores green suite (17 passed).

## 5. Deliberately Not Done

- `merge_group` trigger support: no merge queue is configured in the repository; branch rulesets are empty.
- Making `container:` conditional on docs-only status: deferred optimization if container download time becomes a bottleneck.
- Classifying files via GitHub's pull request REST API: would require `pull-requests: read` permission, violating workflow hardening rules.
- Any modification to branch protection settings or rulesets.
- Editing or reverting `.gitignore`: pre-applied by MASTER.
- Filling `<sha>` placeholders in ADR 0111, `refactor-log.md`, and the `Commit` cell in `task-ledger.md`: reserved for the post-merge deploy record.
## Fix round 1

Fixed the two blocking items from Round 1 of `workflow/stages/03_review/output/task-T822-review.md`:

1. **`docs/audit/decisions/0111-docs-only-prs-report-required-checks.md:19` (D2):**
   - Corrected D2 to reflect that a failed diff fails the `changes` job so required checks never pass (fails closed), rather than defaulting to `code=true`:
     "An empty diff or a non-pull-request event counts as code (`code=true`); a failed diff fails the `changes` job, so the required checks never pass (fails closed)."
   - Also added the non-blocking note in Consequences explaining that when `changes` fails, branch protection stays blocked because matrix job `e2e` reports an unexpanded name.
2. **`docs/audit/baseline-metrics.md:31`:**
   - Corrected the Playwright bullet parenthesis to state:
     "(no spec or app file changed; the docs-only path is proven by the PR's own CI and the first docs-only PR after the merge, ADR 0111)".

### Gates Rerun:
- Em dash count in added lines (`git diff -U0 HEAD`): 0.
- Em dash count in ADR 0111: 0.
- Line endings check (`git ls-files --eol`): both files confirmed `w/crlf`.
- Working tree scope: `git status --porcelain` unchanged apart from these two files' content.
- Rechecked all blocking items: both items fixed and hold.