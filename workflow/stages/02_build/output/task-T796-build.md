# Build report: T796

Phase 143, branch `phase-143-paper-ledger-light-theme`. Docs-only; this task ships the phase.

## Files changed (8)

1. `AGENTS.md` (target file: update unit test count to 1475 in 66 files; Playwright to 181 tests in 35 specs, 543 runs)
2. `README.md` (target file: update badge to 181 E2E tests, unit count to 1475 in 66 files, Playwright to 181 tests in 35 spec files, 543 runs)
3. `DESIGN.md` (target file: update status line on line 68; append ADR 0103 decision numbers note on line 70)
4. `docs/contexts/ui-and-e2e.md` (target file: insert theme-variable rule bullet after line 8; update Playwright count to 181 tests in 35 specs, 543 runs, 537 pass, 6 skip)
5. `docs/audit/decisions/0103-paper-ledger-light-theme.md` (target file: Amendment (T795) update D-c idempotence, add D-d "Sign, not colour" with U+2212 minus, relabel guard to `Guard:`, append item 3 note)
6. `docs/audit/baseline-metrics.md` (target file: add Phase 143 section above Phase 142)
7. `docs/audit/refactor-log.md` (target file: insert Phase 143 entry above Phase 142)
8. `docs/audit/task-ledger.md` (bookkeeping: fill T792-T795 commit SHAs and update T796 row to done with gate results)

## Tests added

None (docs-only; change cannot alter application behaviour).

## Fail-then-pass evidence

None (docs-only).

## Gate commands and results

1. `npm run test:unit`:
   - 66 files, 1475 passed in 76.39 s.
   - Output saved to `workflow/stages/02_build/output/logs/T796-unit.log`.

2. `npx playwright test --list`:
   - Total: 543 tests in 35 files (181 tests in 35 files across 3 browser projects).

3. Clean production build and bundle measurements:
   - Built in 15.46 s with repo `.env` present.
   - Entry chunk `index-TU2ZOqF8.js`: 193,293 B (+124 B), 56,428 B gzip (+54 B against Phase 142 `index-CQ64gmHG.js`, 193,169 / 56,374).
   - All app JS: 884,987 B (+278 B), 268,756 B gzip (+164 B against Phase 142 884,709 / 268,592, 39 files, 0 file delta).
   - CSS `index-BNXJTUPd.css`: 53,895 B (+1,018 B), 10,526 B gzip (+310 B against Phase 142 `index-BJZ9fITB.css`, 52,877 / 10,216).

4. Port check before test run (`netstat -ano | Select-String ':3000 |:3100 ' | Select-String LISTENING`):
   - Ports 3000 and 3100 clean (no processes listening).

5. Full Playwright suite (`npx playwright test`):
   - 35 specs, 3 browsers: 537 passed, 6 skipped by design, 0 failed in 8.9 min.
   - Output saved to `workflow/stages/02_build/output/logs/T796-playwright.log`.

6. Commit SHA check (`git log --format=%h -1 --grep="(T79N)"`):
   - T792: `eddfd96`
   - T793: `c702aef`
   - T794: `c5c2358`
   - T795: `45b9e87`

7. `git diff -U0 HEAD -- AGENTS.md README.md docs/contexts/ui-and-e2e.md DESIGN.md docs/audit/decisions/0103-paper-ledger-light-theme.md`:
   - Exact lines matched: `AGENTS.md` 1 line; `README.md` 3 lines; `ui-and-e2e.md` 1 changed and 1 inserted; `DESIGN.md` 2 lines; ADR 0103 2 lines changed, 1 inserted, 1 blank line and item 3.

8. Stale test count grep (`git grep -n "1465\|64 files\|179 \|179%\|537 runs" -- AGENTS.md README.md docs/contexts/ui-and-e2e.md`):
   - Exit code 1 (0 matches).

9. Stale text grep (`git grep -n "D-d. Static guard\|follow in T795" -- DESIGN.md docs/audit/decisions/0103-paper-ledger-light-theme.md`):
   - Exit code 1 (0 matches).

10. Line endings check (`git ls-files --eol` and Node verification):
    - All 8 modified files reported `w/crlf` with `bareLF 0`.

11. Em dash check:
    - `0` em dashes in git diff additions; `0` em dashes in build report.

12. Line count check:
    - `docs/audit/task-ledger.md`: 145 lines
    - `docs/audit/refactor-log.md`: 106 lines
    - `docs/audit/baseline-metrics.md`: 143 lines
    - All files remain under the ~150 line threshold.

13. `git status --porcelain`:
    - Only the 8 target files and workflow stage outputs.

## Deliberately not done

- Commit cell for T796 in `docs/audit/task-ledger.md` left empty (the owner deploy record fills it after merge).
- SHA placeholders in `docs/audit/refactor-log.md` kept literal (`<sha>`).
- Progress and Spent/Kept gap tracks stay `line`, not `surface-2`.
- Inactive tab stays `fg-secondary`, not `text-muted`.
- "Make a repayment" stays `Button variant="soft"`, not an outline.
- Links keep underline-only hover, no colour change.
- Active tab stays `font-medium`.
- Rewriting stored colours, changing dark, `theme-color` and manifest colours (`index.html:10`, `vite.config.ts:25-26`), `[data-theme]` selector, and new `--cat-*` tokens.
- `identityDisplayColor` in CSV export, backup or any non-visual output.
- `--shadow-quick-add`'s violet glow in light (a shadow in plain `@theme`, not a colour token).
- Non-blocking review code nits (import order, duplicate `identityPalette` import in `ColorGrid.tsx`, comment line wrap in `identityPalette.ts`, blank line in `unit/wallets-page.test.tsx`, doc comment in `LeftOverCard.tsx`, class-order assertion in `unit/theme-tokens.test.ts`).
- Did not archive `task-ledger.md`, `refactor-log.md`, or `baseline-metrics.md` (all under 150 lines).
- Did not touch code, test, or config files.
