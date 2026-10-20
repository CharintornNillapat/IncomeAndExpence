# Build report: T789

Phase 141, branch `phase-141-fix-money-rounding`. Docs-only; this task ships the phase.

## Files changed (5)

1. `AGENTS.md` (target file: update unit test count on line 11 from 1456 to 1463 in 63 files)
2. `README.md` (target file: update unit test count on line 157 from 1456 to 1463 in 63 files)
3. `docs/audit/baseline-metrics.md` (target file: add Phase 141 section at top of Figures)
4. `docs/audit/refactor-log.md` (target file: insert Phase 141 entry above Phase 140)
5. `docs/audit/task-ledger.md` (bookkeeping: fill T787/T788 commit SHAs and add T789 row marked done)

## Tests added

None (docs-only; change cannot alter application behaviour).

## Fail-then-pass evidence

None (docs-only).

## Gate commands and results

1. `npm run test:unit`:
   - 63 files, 1463 passed in 72.01 s.
   - Output saved to `workflow/stages/02_build/output/logs/T789-unit.log`.

2. `npx playwright test --list`:
   - Total: 537 tests in 35 files (179 tests in 35 files across 3 browser projects).

3. Clean production build and bundle measurements:
   - Built in 13.59 s with repo `.env` present.
   - Entry chunk `index-O-Xe4lzP.js`: 193,175 B (-24 B), 56,380 B gzip (+78 B against Phase 140 `index-BxO3ndwn.js`, 193,199 / 56,302).
   - All app JS: 884,491 B (-36 B), 268,612 B gzip (+102 B against Phase 140 884,527 / 268,510, 39 files, 0 file delta).
   - CSS `index-BJZ9fITB.css`: 52,877 B (0 delta), 10,216 B gzip (0 delta against Phase 140 `index-BJZ9fITB.css`, 52,877 / 10,216).

4. `git rev-parse --short (git merge-base main HEAD)`:
   - Output: `086d271`.

5. `git ls-files --eol`:
   - All 5 modified tracked files reported `w/crlf`.

6. `git diff -U0 HEAD -- AGENTS.md README.md`:
   - Exact one-line edit in each file replacing `1456` with `1463`.

7. `git grep "1456" -- AGENTS.md README.md`:
   - Exit code 1 (no occurrences).

8. Em dash checks:
   - `0` em dashes in git diff additions; `0` em dashes in spec; `0` em dashes in build report.

9. `git status --porcelain`:
   - Only 5 expected tracked files and workflow stage outputs.

## Deliberately not done

- Commit cell for T789 in `docs/audit/task-ledger.md` left empty (deploy record fills it).
- SHA placeholders in `docs/audit/refactor-log.md` kept literal (`<sha>`).
- Did not archive `task-ledger.md` (124 lines), `refactor-log.md` (84 lines), or `baseline-metrics.md` (123 lines); all stay under ~150 lines.
- Did not touch code, test, or config files.
