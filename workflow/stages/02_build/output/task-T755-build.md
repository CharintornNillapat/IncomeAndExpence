# Build report: T755

Phase 128: Backlog row for checking line endings without grep (T754 review rule candidate).

## Files changed (1 file + build report)

1. `docs/audit/task-ledger.md`:
   - Added Backlog row recording line endings check rule candidate (`git ls-files --eol` or Node count of `\r\n`, never `grep -c $'\r'`).
   - Added T755 task row under Phase 128 marked done.

## Tests added

- None (per spec section 6: docs-only change, one Backlog row and one bookkeeping row in Markdown ledger; no app code, test or config changed; pinned by grep and diff gate checks).

## Gate commands and results

1. Gate G1 (named paths exist):
   - Command: `ls AGENTS.md docs/audit/task-ledger.md workflow/stages/01_spec/CONTEXT.md workflow/stages/03_review/output/task-T754-review.md`
   - Result: all four paths exist, exit 0.

2. Gate G2 (diff check):
   - Command: `git diff --numstat -- docs/audit/task-ledger.md; git diff -U0 -- docs/audit/task-ledger.md | grep -E '^[-+][^-+]'`
   - Result: `2 0 docs/audit/task-ledger.md`, exactly two `+` lines (T755 task row and Backlog row), exit 0.

3. Gate G3 (row placement):
   - Command: `grep -nF "never \`grep -c \$'\\r' <file>\`" docs/audit/task-ledger.md; grep -n "^## Template for the next phase" docs/audit/task-ledger.md`
   - Result: line 67 for the row, line 69 for template heading (row landed two lines above heading), exit 0.

4. Gate G4 (line endings check):
   - Command: `git ls-files --eol docs/audit/task-ledger.md` and Node count
   - Result: `w/crlf`, `CRLF 79 bareLF 0`, exit 0.

5. Gate G5 (em dash check):
   - Command: `node -e "..."` across `docs/audit/task-ledger.md` and `workflow/stages/02_build/output/task-T755-build.md`
   - Result: `em dashes: 0`, exit 0.

6. Gate G6 (scope check):
   - Command: `git diff --stat; git status --porcelain`
   - Result: only `docs/audit/task-ledger.md` modified, plus `task-T755-spec.md` and `task-T755-build.md`.

## Not done

- None. All edits from the spec were completed.
