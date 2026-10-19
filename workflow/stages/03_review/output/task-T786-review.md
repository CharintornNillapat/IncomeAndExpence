# Review: T786

## Round 1

### 1. Metadata
- **Task:** T786 - Phase 140 closing docs: ADR 0101 amendment (Option B), refactor-log entry, baseline-metrics section, branch line in task-ledger.md, unit test count 1456 / 63 files in AGENTS.md and README.md
- **Date:** 2026-10-19
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:**
  - `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md` (`git check-ignore -v`: exit 1, not ignored)
  - `docs/audit/refactor-log.md` (`git check-ignore -v`: exit 1, not ignored)
  - `docs/audit/baseline-metrics.md` (`git check-ignore -v`: exit 1, not ignored)
  - `AGENTS.md` (`git check-ignore -v`: exit 1, not ignored)
  - `README.md` (`git check-ignore -v`: exit 1, not ignored)
  - `docs/audit/task-ledger.md` (bookkeeping; `git check-ignore -v`: exit 1, not ignored)

### 2. Summary
Closes Phase 140 on paper following the Phase 139 (`T778`) pattern: appends a Phase 140 amendment to ADR `0101` documenting Option B (`fin-master` on Gemini 4 Argon with global `fin-reviewer-g` and `fin-reviewer-strict-g` sub-agents) and the blind Opus comparison on `T780`/`T781`, adds the Phase 140 `refactor-log.md` entry (`T779`-`T786`) and `baseline-metrics.md` section, updates the stated unit test count in `AGENTS.md:11` and `README.md:157` from `1444` to `1456` tests in 63 files, and updates the Phase 140 heading, `Branch ... cut from main at 1f17107` line, and `T786` row in `docs/audit/task-ledger.md`.

### 3. Invariants and parity
- **Parity map:** `none` (docs-only task; no code, test, config, or SQL file modified).
- **Strict-mode verification of every stated figure, path, and claim:**
  - **`AGENTS.md:11` and `README.md:157`:** `git diff -U0 HEAD -- AGENTS.md README.md` confirms the single-line replacement of `1444` with `1456` in each file and nothing else; `git grep "1444" -- AGENTS.md README.md` exits with code 1 (0 occurrences).
  - **ADR `0101` amendment (`docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md:146-149`):** appended after line 144 with one blank line before it; lines 1-144 untouched (`git diff` shows `+5/-0`); matches the spec's exact markdown block word for word.
  - **Code path and line references in ADR `0101` and `refactor-log.md`:** verified directly against the repository files:
    - `src/context/FinanceContext.tsx:1675` (`TransactionSchema.safeParse(data)`) and `:1749` (`if (data.amount > targetDebt.remainingAmount)`): exact lines where guest `addTransaction` validates and runs the ADR 0016 overpayment guard before rounding `data.amount` at `:1943`.
    - `src/utils/csvExchange.ts:184-196` and `:209`: exact lines where `parseFloat(rawAmount)` is checked with `numAmount <= 0` before rounding and rounded via inline `Math.round(numAmount * 100) / 100`.
    - `src/views/WalletsView.tsx:107` (`const diff = newBalance - Number(target.balance);`) and `src/components/debt/DebtCard.tsx:54` (`const repaid = Math.max(0, debt.totalAmount - remaining);`): exact lines of the non-blocking review notes from `T781` and `T783`.
  - **Branch base and task commits (`git log --oneline 1f17107..HEAD`):** `git rev-parse --short (git merge-base main HEAD)` outputs `1f17107`. All seven prior commits on `phase-140-gemini-trial` (`2aee1c5` T779, `cb1fb1d` T780, `d4a373e` T781, `3badf31` T782, `9d8adfc` T783, `68a2886` T784, `5183f40` T785) and their round-1 `APPROVED` reviews in `workflow/stages/03_review/output/task-T779-review.md` through `task-T785-review.md` match the descriptions in `refactor-log.md` and `task-ledger.md`.
  - **Per-task unit durations and counts in `baseline-metrics.md:31`:** verified directly against `workflow/stages/02_build/output/logs/T780-unit.log` through `T786-unit.log` (`T780`: 63 files, 1444 passed in 68.65 s; `T781`: 1445 passed in 90.21 s; `T783`: 1446 passed in 77.12 s; `T784`: 1450 passed in 88.93 s; `T785`: 1456 passed in 69.41 s; `T786`: 1456 passed in 70.48 s).
  - **Production bundle figures in `baseline-metrics.md:28-30` and `refactor-log.md:27`:** independently rebuilt after removing `dist/` (`Remove-Item -Recurse -Force dist; npm run build`) with `.env` present (without reading or printing `.env`) and gzipped every asset in `dist/assets` at level 9:
    - Entry chunk `index-BxO3ndwn.js`: `193,199 B` (`-178 B` vs Phase 139 `193,377 B`), `56,302 B` gzip (`-28 B` vs Phase 139 `56,330 B`).
    - All app JS: `884,527 B` (`-162 B` vs Phase 139 `884,689 B`), `268,510 B` gzip (`-44 B` vs Phase 139 `268,554 B`), `39` files (`0` file delta).
    - CSS `index-BJZ9fITB.css`: `52,877 B` (`0` delta), `10,216 B` gzip (`0` delta).
  - **File lengths (`~150`-line archive threshold):** `docs/audit/task-ledger.md` is 115 lines, `docs/audit/refactor-log.md` is 74 lines, `docs/audit/baseline-metrics.md` is 114 lines (all well below 150 lines).
  - **Scope and formatting:** `git diff --stat` and `git status --porcelain` show only the 5 target files, `docs/audit/task-ledger.md`, and the `workflow/stages/*/output/` files. All 6 modified tracked files report `w/crlf` in `git ls-files --eol`. Em-dash count is `0` across the git diff and all touched files.

### 4. Gates run
- `git check-ignore -v docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md AGENTS.md README.md docs/audit/task-ledger.md`: exit 1 (none ignored).
- `npm run test:unit`: **63 passed (63 files), 1456 passed (1456 tests), 0 failed, 0 skipped** in 71.13 s (`workflow/stages/03_review/output/logs/T786-unit.log`).
- `npx playwright test --list`: **537 tests in 35 files** (179 tests in 35 files across 3 browser projects).
- Clean production build (`if (Test-Path dist) { Remove-Item -Recurse -Force dist }; npm run build` + level-9 gzip measurement): built in 5.61 s; `index-BxO3ndwn.js` 193,199 B / 56,302 B gzip; all app JS 884,527 B / 268,510 B gzip across 39 files; `index-BJZ9fITB.css` 52,877 B / 10,216 B gzip.
- `git rev-parse --short (git merge-base main HEAD)`: `1f17107`.
- `git ls-files --eol AGENTS.md README.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md`: all 6 files `w/crlf`.
- `git diff -U0 HEAD -- AGENTS.md README.md`: 1 insertion / 1 deletion in each file (`1444` -> `1456` only).
- `git grep "1444" -- AGENTS.md README.md`: exit 1 (no matches).
- Em-dash check (`node -e "..."` on `git diff -U0 HEAD` additions and full files): `0` em dashes.
- `git status --porcelain`: only the 6 expected tracked files and `workflow/stages/*/output/` files.

### 5. Not verified
- Fail-then-pass test verification (Stage 03 step 6): skipped per spec section 6 (`none`: docs-only task with no new or changed tests).
- Full Playwright E2E execution: not in the docs-only tier gates (affected specs ran per task in `T780`, `T781`, `T783`, `T784`, and `T785`).

### 6. Blocking
None.

### 7. Non-blocking
None.

### 8. Rule candidates
None.
