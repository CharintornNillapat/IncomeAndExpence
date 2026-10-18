# Build report: T772

Phase 137: Stage-file rules from the T767, T770 and T771 reviews (no ADR).

## Files changed (4 target files + task-ledger.md)

1. `workflow/stages/01_spec/CONTEXT.md`:
   - Edit 1 (section 6, line 39): Added test-only task rule specifying that when a task only strengthens a test, the spec gives the order for the red run inside the test file and the temporary edit for the reviewer to reproduce.
   - Edit 2 (Rules, line 50): Added em dash gate rule specifying Node one-liners for counting em dashes in added lines and whole files, noting the failure mode of `grep -P '\x{2014}'` in Git Bash.

2. `workflow/stages/02_build/CONTEXT.md`:
   - Edit 3 (step 4, line 25): Added builder instructions for test-only tasks to save the red run failure to `output/logs/<id>-red.log` and quote it in the build report.
   - Edit 4 (after line 30): Added instructions for constructing `refactor-log.md` entries from `git show --stat <sha>`, `git status --porcelain`, and the ledger's Gate result cells instead of memory.

3. `workflow/stages/03_review/CONTEXT.md`:
   - Edit 5a (Agent line, line 3): Updated allowed exception to include temporary test edits for test-only tasks.
   - Edit 5b (step 6, line 12): Added requirement that the reviewer reproduce the test-only red run via the spec's temporary edit, check the failure, and revert by hand to ensure `git diff` matches.
   - Edit 6 (step 6.2, line 14): Added instructions for stashing staged deletions via their folder path and excluding `w/lf` files under `core.autocrlf`.
   - Edit 7 (step 6.4, line 16): Updated `git stash pop` to `git stash pop --index` to preserve staged deletions.

4. `docs/audit/refactor-log.md`:
   - Line 22: Updated Phase 137 header from `T769-T771` to `T769-T772`.
   - Line 24: Appended brief sentence for T772.
   - Line 26: Appended T772 files to **Changed**.
   - Line 27: Appended T772 gate results to **Verified**.

5. `docs/audit/task-ledger.md` (bookkeeping):
   - Added T772 row under Phase 137 with empty Commit cell and gate results.

## Tests

- Tests to add: `none` per spec section 6 (docs-only task).

## Gate commands and results

1. Gate 1 (Commands work):
   - Added-lines counter: `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"` printed `0` (exit 0).
   - Whole-file counter on three stage files: `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" workflow/stages/01_spec/CONTEXT.md workflow/stages/02_build/CONTEXT.md workflow/stages/03_review/CONTEXT.md` printed `0` for each file.
   - Git Bash grep check: `git diff -U0 HEAD | grep '^+' | grep -cP '\x{2014}'` produced `grep: character value in \x{} or \o{} is too large` (exit 1/2) as quoted in the spec.

2. Gate 2 (Paths exist):
   - `workflow/stages/02_build/output/logs/` exists (`True`).
   - `git ls-files --error-unmatch workflow/stages/01_spec/CONTEXT.md workflow/stages/02_build/CONTEXT.md workflow/stages/03_review/CONTEXT.md docs/audit/refactor-log.md` succeeded with exit 0 for all target files.

3. Gate 3 (Text landed once):
   - Scripted Node check verified all 17 conditions: New text for edits 1 to 7 occurred exactly 1 time; Old text occurred 0 times; required phrases (`never \`git checkout\` or \`git restore\``, `Steps 6.1 to 6.4 then do not apply`, `in the build report's fail-then-pass evidence`) each occurred exactly 1 time.

4. Gate 4 (Diff size):
   - `git diff --numstat` verified:
     - `workflow/stages/01_spec/CONTEXT.md`: 2 added, 1 deleted
     - `workflow/stages/02_build/CONTEXT.md`: 3 added, 1 deleted
     - `workflow/stages/03_review/CONTEXT.md`: 4 added, 4 deleted
     - `docs/audit/refactor-log.md`: 4 added, 4 deleted
     - `docs/audit/task-ledger.md`: 1 added, 0 deleted

5. Gate 5 (Line endings):
   - `git ls-files --eol` showed `w/crlf` for all five files.
   - Node check for bare `\n` printed `0` for all five files.

6. Gate 6 (Em dashes):
   - Added-lines counter printed `0`.
   - Whole-file counter printed `0` for `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `workflow/stages/01_spec/CONTEXT.md`, `workflow/stages/02_build/CONTEXT.md`, `workflow/stages/03_review/CONTEXT.md`, and `workflow/stages/02_build/output/task-T772-build.md`.

7. Gate 7 (Scope):
   - `git status --porcelain` showed only the 5 modified files and T772 stage outputs (`task-T772-spec.md`, `task-T772-build.md`).

## Deliberately not done

- Did not touch `AGENTS.md`, `CLAUDE.md`, or ADR 0101.
- Left wording of stage 03 step 7 as is.
- Did not rewrite earlier refactor-log entries.
- Did not change any other lines of the stage files or renumber steps.
- `refactor-log.md` line count (212 lines) and `baseline-metrics.md` were not changed.

## Fix round 1

Addressed the two blocking items from `workflow/stages/03_review/output/task-T772-review.md`:

### 1. Blocking fixes

1. **Blocking 1 (`workflow/stages/01_spec/CONTEXT.md:51`)**:
   - Removed the stray `"` between `<file>...` and the closing backtick in the whole-file one-liner. Line 51 now ends with `<file>...`. exactly matching edit 2 New text from the spec.
2. **Blocking 2 (`workflow/stages/02_build/CONTEXT.md:32`)**:
   - Replaced `leaving out \`workflow/stages/\` files` with `leaving out \`workflow/stages/*/output/\` files` so that stage-file changes themselves are not excluded when constructing the refactor-log Changed line.
3. **Ledger & Refactor-log updates**:
   - Updated the T772 Gate result cell in `docs/audit/task-ledger.md` to reflect the rerun verification.
   - Copied the updated Gate result cell word for word into T772's Verified part in `docs/audit/refactor-log.md`.

### 2. Gates rerun (all 7 gates)

1. **Gate 1 (Commands work)**:
   - Extracted both one-liners directly from line 51 of `workflow/stages/01_spec/CONTEXT.md` via script.
   - Added-lines counter printed `0` (exit 0).
   - Whole-file counter ran without shell errors in both default shell and Git Bash, printing `0` for each of the three stage files (`workflow/stages/01_spec/CONTEXT.md`, `workflow/stages/02_build/CONTEXT.md`, `workflow/stages/03_review/CONTEXT.md`).
   - Git Bash check `git diff -U0 HEAD | grep '^+' | grep -cP '\x{2014}'` produced `grep: character value in \x{} or \o{} is too large` (exit 1/2).
2. **Gate 2 (Paths exist)**:
   - `workflow/stages/02_build/output/logs/` exists (`True`).
   - `git ls-files --error-unmatch` succeeded (exit 0) on all target files.
3. **Gate 3 (Text landed once from spec code blocks)**:
   - Script read expected texts directly from the code blocks of `workflow/stages/01_spec/output/task-T772-spec.md`.
   - Verified that all 8 New texts occur exactly 1 time (including Edit 2 New text and Edit 4 with the Blocking 2 fix).
   - Verified that all 6 Old texts occur 0 times.
   - Verified that all 3 required phrases occur exactly 1 time.
4. **Gate 4 (Diff size)**:
   - `git diff --numstat` verified:
     - `workflow/stages/01_spec/CONTEXT.md`: 2 added, 1 deleted
     - `workflow/stages/02_build/CONTEXT.md`: 3 added, 1 deleted
     - `workflow/stages/03_review/CONTEXT.md`: 4 added, 4 deleted
     - `docs/audit/refactor-log.md`: 4 added, 4 deleted
     - `docs/audit/task-ledger.md`: 1 added, 0 deleted
5. **Gate 5 (Line endings)**:
   - `git ls-files --eol` showed `w/crlf` for all five files.
   - Node count of bare `\n` printed `0` for all five files.
6. **Gate 6 (Em dashes)**:
   - Added-lines counter printed `0`.
   - Whole-file counter printed `0` across all five files and `workflow/stages/02_build/output/task-T772-build.md`.
7. **Gate 7 (Scope)**:
   - `git status --porcelain` showed only the 5 modified files and T772 stage outputs (`task-T772-spec.md`, `task-T772-build.md`).
