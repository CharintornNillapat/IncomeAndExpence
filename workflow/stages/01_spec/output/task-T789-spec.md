# Spec: T789

Phase 141, branch `phase-141-fix-money-rounding`. Docs-only; this task ships the phase.

## 1. Goal

Close Phase 141 on paper following the Phase 140 pattern: write the Phase 141 `refactor-log.md` entry for T787-T789 and the `baseline-metrics.md` Phase 141 section, update the stated unit test count in `AGENTS.md` and `README.md` from 1456 to 1463 tests in 63 files, and update `docs/audit/task-ledger.md` (fill the commit SHAs for T787 and T788, add the T789 row under Phase 141).

## 2. Target files

```
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
AGENTS.md
README.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (T787 and T788 commit SHAs, and the T789 row; section 6a step 4).

**`AGENTS.md` is on the pause list** (`AGENTS.md` among the Target files). The edit in `AGENTS.md` is one number on line 11 (`1456` to `1463`) and nothing else; the orchestrator must pause for the owner's go-ahead before `build T789`, and the review of T789 runs on the strict reviewer (`fin-reviewer-strict` / `fin-reviewer-strict-g`).

## 3. Context to read

none (docs-only). The builder reads `AGENTS.md` (already required), `docs/audit/task-ledger.md`, the template block and Phase 140 entry at the top of `docs/audit/refactor-log.md`, and the Phase 140 section of `docs/audit/baseline-metrics.md` as the shape to copy.

## 4. Current behaviour

1. **ADR decision:** No new ADR and no ADR amendment.
   - Tasks `T787` and `T788` close two money rounding gaps discovered during the blind Opus review of Phase 140 (`T781`) by enforcing existing rules: `roundToCents` at `src/utils/money.ts:22`, parity map row 1 arithmetic (`addTransaction` / `setTransactionDeleted` arithmetic vs `_ledger_apply_effect` and the ledger RPCs), and non-negotiable cent rounding.
   - Per `AGENTS.md:124`, bug fixes and cleanups of existing rules need no ADR. Heading in `docs/audit/task-ledger.md:63` already correctly specifies `(no ADR)`.

2. **What Phase 141 holds** (from `git log 086d271..HEAD` and `git diff --stat 086d271 HEAD`):
   - Branch `phase-141-fix-money-rounding` was cut from `main` at `086d271` (`git merge-base main HEAD`).
   - `T787` (`54da8c1`): `src/context/FinanceContext.tsx:1674, 1682, 1753, 1797-1804, 1845, 1944` (`addTransaction` computes `const roundedAmount = roundToCents(data.amount);` at entry, validates `{ ...data, amount: roundedAmount }` through `TransactionSchema.safeParse`, and uses `roundedAmount` in the ADR 0016 overpayment guard, optimistic balance calculations, authenticated RPC arguments `p_amount`, and guest record `newTx.amount`), `unit/ledger-guards.test.tsx:14, 773-825` (+4 tests: rejects `0.004` expense, rejects `0.004` adjustment, accepts `DEBT_REMAINING + 0.004` repayment rounding to balance, rejects `DEBT_REMAINING + 0.006` repayment exceeding balance).
   - `T788` (`8a7928d`): `src/utils/csvExchange.ts:182-209, 237` (replaces three inline `Math.round(x * 100) / 100` expressions with canonical `roundToCents`, normalizes `-0` to `0`, evaluates positive amount and non-zero adjustment checks against `roundedAmount` before preview and batch import, and accumulates totals with `roundToCents`), `unit/csv-exchange.test.ts:3, 11-12, 281-319` (+3 tests: rejects `0.004` expense as `<= 0`, rejects `+0.004` and `-0.004` adjustment as zero, accepts `DEBT_REMAINING + 0.004` repayment rounding to exact debt).

3. **Ledger (`docs/audit/task-ledger.md:63-71`):**
   - Heading at line 63 reads `## Phase 141 - Fix money rounding: addTransaction and CSV import entry roundToCents (no ADR)`.
   - Branch line at line 65 reads `Branch phase-141-fix-money-rounding, cut from main at 086d271.`
   - Rows `T787` and `T788` have populated `Gate result` cells but empty `Commit` cells. `T787` commit is `54da8c1` and `T788` commit is `8a7928d`.
   - Backlog rows `:107` and `:108` are already marked `done in Phase 141 (T787)` and `done in Phase 141 (T788)`. No Backlog row needs editing.

4. **Test counts:**
   - Vitest before Phase 141: 63 files, 1456 tests (`docs/audit/baseline-metrics.md:33`). Now: 63 files, 1463 tests (+7 tests, 0 file delta: `T787` +4, `T788` +3).
   - Playwright: no spec file or test was added or removed in Phase 141, so 35 specs, 179 tests, 537 runs across 3 projects stand.
   - Docs stating the unit test count (`git grep "1456"` across `*.md` outside `archive/` and `workflow/`):
     - `AGENTS.md:11`: `1456 tests, 63 files`. Must change to `1463 tests, 63 files`.
     - `README.md:157`: `1456 tests in 63 files`. Must change to `1463 tests in 63 files`.
     - `docs/audit/refactor-log.md:26-27`, `docs/audit/baseline-metrics.md:33`, `docs/audit/task-ledger.md:60-61`: historical Phase 140 figures. Leave them unchanged.

5. **Bundle and file lengths:**
   - Phase 141 changed `src/context/FinanceContext.tsx` and `src/utils/csvExchange.ts`. `docs/audit/baseline-metrics.md` needs a `### Phase 141 - delta against Phase 140` section at the top of `## Figures` (`docs/audit/baseline-metrics.md:26`), measured against Phase 140 (`index-BxO3ndwn.js` 193,199 B / 56,302 B gzip; all app JS 884,527 B / 268,510 B gzip, 39 files; CSS `index-BJZ9fITB.css` 52,877 B / 10,216 B gzip).
   - Measured on Phase 141 tip: entry `index-O-Xe4lzP.js` 193,175 B (-24 B) / 56,380 B gzip (+78 B); all app JS 884,491 B (-36 B) / 268,612 B gzip (+102 B), 39 files (0 delta); CSS `index-BJZ9fITB.css` 52,877 B (0 delta) / 10,216 B gzip (0 delta).
   - File lengths (`task-ledger.md` 123 lines, `refactor-log.md` 73 lines, `baseline-metrics.md` 115 lines) all stay under ~150 lines.

## 5. Parity map

none.

## 6. Tests to add

none. Docs-only; the change cannot alter application behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 6a. Edits (exact)

1. **`AGENTS.md:11`**: replace `1456 tests, 63 files` with `1463 tests, 63 files`. Change nothing else in `AGENTS.md`.

2. **`README.md:157`**: replace `1456 tests in 63 files` with `1463 tests in 63 files`. Change nothing else in `README.md`.

3. **`docs/audit/baseline-metrics.md`**: insert `### Phase 141 - delta against Phase 140` at the top of `## Figures` (line 26, above `### Phase 140 - delta against Phase 139`), keeping the exact bullet structure:
   - **Entry chunk** `index-O-Xe4lzP.js`: 193,175 B (-24 B), 56,380 B gzip (+78 B against Phase 140 `index-BxO3ndwn.js`, 193,199 / 56,302).
   - **All app JS**: 884,491 B (-36 B), 268,612 B gzip (+102 B against Phase 140 884,527 / 268,510, 39 files, 0 file delta).
   - **CSS**: `index-BJZ9fITB.css`: 52,877 B (0 delta), 10,216 B gzip (0 delta against Phase 140 `index-BJZ9fITB.css`, 52,877 / 10,216).
   - **Vitest**: `63 files, 1463 tests (+7 tests, 0 file delta against Phase 140), 1463 passed in <X> s (workflow/stages/02_build/output/logs/T789-unit.log). Per-task runs: T787 1460 passed in 71.99 s (workflow/stages/02_build/output/logs/T787-unit.log), T788 1463 passed in 68.49 s (workflow/stages/02_build/output/logs/T788-unit.log).` Run `npm run test:unit` once at the branch tip, save its output to `workflow/stages/02_build/output/logs/T789-unit.log`, and record the runtime.
   - **Playwright**: `not run in full: affected specs ran per task (tests/transaction.spec.ts, tests/debt-repayment.spec.ts, and tests/soft-delete.spec.ts for T787: 23 on Chromium, 69 on three browsers; tests/csv.spec.ts and tests/csv-classify.spec.ts for T788: 13 on Chromium, 39 on three browsers). Suite size unchanged: npx playwright test --list reports 179 tests in 35 files, 537 runs across 3 projects.`

   Exact block to insert:
   ```markdown
   ### Phase 141 - delta against Phase 140

   - **Entry chunk** `index-O-Xe4lzP.js`: 193,175 B (-24 B), 56,380 B gzip (+78 B against Phase 140 `index-BxO3ndwn.js`, 193,199 / 56,302).
   - **All app JS**: 884,491 B (-36 B), 268,612 B gzip (+102 B against Phase 140 884,527 / 268,510, 39 files, 0 file delta).
   - **CSS**: `index-BJZ9fITB.css`: 52,877 B (0 delta), 10,216 B gzip (0 delta against Phase 140 `index-BJZ9fITB.css`, 52,877 / 10,216).
   - **Vitest**: 63 files, 1463 tests (+7 tests, 0 file delta against Phase 140), 1463 passed in <X> s (`workflow/stages/02_build/output/logs/T789-unit.log`). Per-task runs: T787 1460 passed in 71.99 s (`workflow/stages/02_build/output/logs/T787-unit.log`), T788 1463 passed in 68.49 s (`workflow/stages/02_build/output/logs/T788-unit.log`).
   - **Playwright**: not run in full: affected specs ran per task (`tests/transaction.spec.ts`, `tests/debt-repayment.spec.ts`, and `tests/soft-delete.spec.ts` for T787: 23 on Chromium, 69 on three browsers; `tests/csv.spec.ts` and `tests/csv-classify.spec.ts` for T788: 13 on Chromium, 39 on three browsers). Suite size unchanged: `npx playwright test --list` reports 179 tests in 35 files, 537 runs across 3 projects.

   ```

4. **`docs/audit/task-ledger.md`**:
   - In the Phase 141 table:
     - Set `T787` Commit cell to `54da8c1`.
     - Set `T788` Commit cell to `8a7928d`.
   - Add the `T789` row under `T788`:
     - Task: `Phase 141 closing docs: refactor-log entry, baseline-metrics section, task-ledger.md updates, unit test count 1463 / 63 files in AGENTS.md and README.md`
     - Files: `` `AGENTS.md`, `README.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md` ``
     - Status: `done`
     - Commit: empty
     - Gate result: summary from section 7
   - Do not edit any earlier phase section or any Backlog row.

5. **`docs/audit/refactor-log.md`**: insert the Phase 141 entry above `## Phase 140 - Gemini trial: ...` (after the `---` at line 20), followed by a blank line, `---`, and a blank line, matching the template:
   - **Heading**: `## Phase 141 - Fix money rounding: T787-T789 (2026-10-19, code `54da8c1` to `8a7928d`, docs `<sha>`, merged `<sha>`)`. Keep all `<sha>` placeholders literal; the post-merge deploy record fills them.
   - **Brief**: `No ADR (applies existing roundToCents rules at src/utils/money.ts:22, parity map row 1 arithmetic, and non-negotiable cent rounding; bug fixes and cleanups of existing rules need no ADR per AGENTS.md:124). Closes the two money rounding gaps discovered during the blind Opus review of Phase 140 (T781): guest addTransaction now rounds amount before safeParse and debt overpayment checks, and CSV import now checks rounded values with roundToCents and removes inline Math.round.`
   - **Changed**: list `T787` through `T789` from the commits and the ledger (`T787`: `src/context/FinanceContext.tsx` `addTransaction` entry rounding before `safeParse` and overpayment checks, `unit/ledger-guards.test.tsx` 4 new tests; `T788`: `src/utils/csvExchange.ts` replaced three inline `Math.round` expressions with `roundToCents`, normalized `-0` to `0`, and evaluated positive amount and non-zero adjustment checks against `roundedAmount` before preview and batch import, `unit/csv-exchange.test.ts` 3 new tests; `T789`: `AGENTS.md` and `README.md` unit count 1463 / 63 files, `docs/audit/baseline-metrics.md` Phase 141 section, `docs/audit/task-ledger.md` Phase 141 T787/T788 commits and T789 row, and this file). Leave out `workflow/stages/*/output/` files.
   - **Verified**: one clause per task (`T787` and `T788`) from the ledger's `Gate result` cells, then `T789`'s gates (including the full unit run and clean production bundle figures from the Phase 141 baseline-metrics section), plus a clause stating that the reviews for `T787` and `T788` were `APPROVED` in round 1. Do not write a `Release:` clause (the post-merge deploy record appends it).
   - **Surprises**: (a) In T787, rounding before validation meant sub-cent amounts like `0.004` that previously passed `TransactionSchema.safeParse` (as `> 0`) now fail validation cleanly with `'Amount must be greater than 0'`, preventing storage of zero-value records in the database. (b) In T788, `-0.004` on an adjustment produced `-0` from `roundToCents`, which in JavaScript requires `Object.is(roundedAmount, -0) ? 0 : roundedAmount` or adding `+ 0` so non-zero checks and schema validation treat it as `0.00`.
   - **Deliberately not done**: a new standalone ADR or amendment (reasons above); editing `src/utils/zodSchemas.ts` or modifying `roundToCents` signature in `src/utils/money.ts`; touching `supabase/` migrations or RPCs (client was brought into parity with existing SQL logic); a full Playwright suite run (affected specs ran per task; full list verified unchanged at 179 tests / 35 files / 537 runs); archiving `task-ledger.md`, `refactor-log.md`, or `baseline-metrics.md` (all under the 150-line threshold).

   Exact block to insert:
   ```markdown
   ## Phase 141 - Fix money rounding: T787-T789 (2026-10-19, code `54da8c1` to `8a7928d`, docs `<sha>`, merged `<sha>`)

   No ADR (applies existing roundToCents rules at src/utils/money.ts:22, parity map row 1 arithmetic, and non-negotiable cent rounding; bug fixes and cleanups of existing rules need no ADR per AGENTS.md:124). Closes the two money rounding gaps discovered during the blind Opus review of Phase 140 (T781): guest addTransaction now rounds amount before safeParse and debt overpayment checks, and CSV import now checks rounded values with roundToCents and removes inline Math.round.

   **Changed:** T787 (`src/context/FinanceContext.tsx`: `addTransaction` computes `roundedAmount = roundToCents(data.amount)` at entry, validates `{ ...data, amount: roundedAmount }` with `TransactionSchema.safeParse`, and uses `roundedAmount` for ADR 0016 overpayment guard, optimistic balances, RPC arguments, and guest record; `unit/ledger-guards.test.tsx`: 4 new tests for sub-cent expense and adjustment zero rejection, sub-cent float overpayment tolerance, and strict overpayment rejection; `docs/audit/task-ledger.md`: Phase 141 section and Backlog row 98 marked done). T788 (`src/utils/csvExchange.ts`: replaced three inline `Math.round(x * 100) / 100` expressions with canonical `roundToCents`, normalized `-0` to `0`, and evaluated positive amount and non-zero adjustment checks against `roundedAmount` before preview and batch import; `unit/csv-exchange.test.ts`: 3 new tests for sub-cent expense rejection, sub-cent adjustment rejection, and sub-cent float debt overpayment tolerance; `docs/audit/task-ledger.md`: T788 row and Backlog row 99 marked done). T789 (`AGENTS.md` and `README.md`: unit test count updated to 1463 tests in 63 files; `docs/audit/baseline-metrics.md`: Phase 141 section added at top of Figures; `docs/audit/task-ledger.md`: T787/T788 commit SHAs filled and T789 row added; this file).
   **Verified:** T787: Red gate verified (3 failed, 1 passed); npm run lint clean; related unit 2/2 files 181 passed; unit 63/63 files 1460 passed (71.99s); e2e 3 specs on chr 23 passed (29.3s), 69 passed on 3 browsers (1.9m); CRLF kept; 0 em dashes. T788: Red gate verified (2 failed, 1 passed); npm run lint clean; related unit 3/3 files 38 passed; unit 63/63 files 1463 passed (68.49s); e2e 2 specs on chr 13 passed (1.1m), 39 passed on 3 browsers (1.1m); CRLF kept; 0 em dashes. T789: docs checks passed (unit test count 1463 in 63 files in AGENTS.md and README.md; Playwright test list 179 tests in 35 files, 537 runs across 3 projects; full unit suite 63 files 1463 passed in <X>s; clean production build index-O-Xe4lzP.js 193,175 B / 56,380 B gzip, all app JS 884,491 B / 268,612 B gzip, 39 files; CSS index-BJZ9fITB.css 52,877 B / 10,216 B gzip; CRLF kept across 5 touched files; 0 em dashes in git diff). Reviews for T787 and T788 were APPROVED in round 1.
   **Surprises:** (a) In T787, rounding before validation meant sub-cent amounts like `0.004` that previously passed `TransactionSchema.safeParse` (as `> 0`) now fail validation cleanly with `'Amount must be greater than 0'`, preventing storage of zero-value records in the database. (b) In T788, `-0.004` on an adjustment produced `-0` from `roundToCents`, which in JavaScript requires `Object.is(roundedAmount, -0) ? 0 : roundedAmount` or adding `+ 0` so non-zero checks and schema validation treat it as `0.00`.
   **Deliberately not done:** a new standalone ADR or amendment (reasons above); editing `src/utils/zodSchemas.ts` or modifying `roundToCents` signature in `src/utils/money.ts`; touching `supabase/` migrations or RPCs (client was brought into parity with existing SQL logic); a full Playwright suite run (affected specs ran per task; full list verified unchanged at 179 tests / 35 files / 537 runs); archiving `task-ledger.md`, `refactor-log.md`, or `baseline-metrics.md` (all under the 150-line threshold).

   ---
   ```

## 7. Gates

Docs-only tier: nothing mandatory, except checking every stated count, path, and sha against the code and repository. Commands:

```powershell
npm run test:unit                       # save to workflow/stages/02_build/output/logs/T789-unit.log; expect 63 files, 1463 passed
npx playwright test --list              # expect 179 tests in 35 files, 537 runs across 3 projects; read-only, starts no server
if (Test-Path dist) { Remove-Item -Recurse -Force dist }; npm run build   # bundle figures; .env present, never read or print it
git rev-parse --short (git merge-base main HEAD)   # expect 086d271
git ls-files --eol AGENTS.md README.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md
git diff -U0 HEAD -- AGENTS.md README.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
git grep "1456" -- AGENTS.md README.md
git status --porcelain
```

Expect:
- `npm run test:unit`: 63 files, 1463 passed.
- `npx playwright test --list`: 179 tests in 35 files (537 runs across 3 projects).
- Clean production build: entry `dist/assets/index-O-Xe4lzP.js` (193,175 B / 56,380 B gzip), all app JS (884,491 B / 268,612 B gzip, 39 files), CSS `dist/assets/index-BJZ9fITB.css` (52,877 B / 10,216 B gzip).
- `git rev-parse --short (git merge-base main HEAD)`: `086d271`.
- `git ls-files --eol`: all 5 modified tracked files report `w/crlf`.
- `git diff -U0 HEAD -- AGENTS.md README.md`: one line changed in each file, replacing `1456` with `1463` only.
- Em-dash check prints `0`.
- `git grep "1456" -- AGENTS.md README.md` prints nothing (exit 1).
- `git status --porcelain` shows only the 4 Target files, `docs/audit/task-ledger.md`, and the `workflow/stages/*/output/` files.

## 8. Production touch points

none. (`AGENTS.md` is an automatic-pause trigger, not a production touch point.) The owner's post-merge deploy record, a docs-only `[skip ci]` commit on `main`, fills the `<sha>` placeholders in `refactor-log.md`, the `Commit` cell for T789 in `task-ledger.md`, and the `Measured at <sha>` line in `baseline-metrics.md`.

## 9. Out of scope

- Any code, test, config, or SQL file; `.claude/agents/`; `~/.gemini/config/agents/`; the `workflow/stages/*/CONTEXT.md` files.
- The `T787`-`T788` task descriptions/files/gate results, earlier phases, and all Backlog rows in `docs/audit/task-ledger.md`.
- Historical test counts in earlier `refactor-log.md` and `baseline-metrics.md` entries, ADRs, and `audit-2026-10-16.md`.
- Any other line of `AGENTS.md` or `README.md`.
- Archiving any file under `docs/audit/`.
- Running the full Playwright suite or sending any request to production `/api/*`.
