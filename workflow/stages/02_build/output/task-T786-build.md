# Build report: T786

Phase 140, branch `phase-140-gemini-trial`. Docs-only; this task ships the phase.

## Files changed (6)

1. `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md` (target file: append Phase 140 amendment under Amendments)
2. `AGENTS.md` (target file: update unit test count on line 11 from 1444 to 1456 in 63 files)
3. `README.md` (target file: update unit test count on line 157 from 1444 to 1456 in 63 files)
4. `docs/audit/baseline-metrics.md` (target file: add Phase 140 section at top of Figures)
5. `docs/audit/refactor-log.md` (target file: insert Phase 140 entry above Phase 139)
6. `docs/audit/task-ledger.md` (bookkeeping: Phase 140 heading update, branch line, and T786 row marked done)

## Tests added

None (docs-only; change cannot alter application behaviour).

## Fail-then-pass evidence

None (docs-only).

## Gate commands and results

1. `npm run test:unit`:
   - 63 files, 1456 passed in 70.48 s.
   - Output saved to `workflow/stages/02_build/output/logs/T786-unit.log`.

2. `npx playwright test --list`:
   - Total: 537 tests in 35 files (179 tests in 35 files across 3 browser projects).

3. Clean production build and bundle measurements:
   - Built in 19.05 s with repo `.env` present.
   - Entry chunk `index-BxO3ndwn.js`: 193,199 B (-178 B), 56,302 B gzip (-28 B against Phase 139 `index-DdI940YI.js`, 193,377 / 56,330).
   - All app JS: 884,527 B (-162 B), 268,510 B gzip (-44 B against Phase 139 884,689 / 268,554, 39 files, 0 file delta).
   - CSS `index-BJZ9fITB.css`: 52,877 B (0 delta), 10,216 B gzip (0 delta against Phase 139 `index-BJZ9fITB.css`, 52,877 / 10,216).

4. `git rev-parse --short $(git merge-base main HEAD)`:
   - Output: `1f17107`.

5. `git ls-files --eol`:
   - All 6 modified tracked files reported `w/crlf`.

6. `git diff -U0 HEAD -- AGENTS.md README.md`:
   - Exact one-line edit in each file replacing `1444` with `1456`.

7. `git grep "1444" -- AGENTS.md README.md`:
   - Exit code 1 (no occurrences).

8. Em dash checks:
   - `0` em dashes in git diff additions; `0` em dashes in spec; `0` em dashes in build report.

9. `git status --porcelain`:
   - Only 6 expected tracked files and workflow stage outputs.

## Deliberately not done

- Commit cell in `docs/audit/task-ledger.md` left empty (deploy record fills it).
- SHA placeholders in `docs/audit/refactor-log.md` kept literal (`<sha>`).
- Did not archive `task-ledger.md` (114 lines), `refactor-log.md` (75 lines), or `baseline-metrics.md` (115 lines); all stay under ~150 lines.
- Did not touch code, test, or config files.
