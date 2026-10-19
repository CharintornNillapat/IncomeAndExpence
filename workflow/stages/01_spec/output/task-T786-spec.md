# Spec: T786

Phase 140, branch `phase-140-gemini-trial`. Docs-only; this task ships the phase.

## 1. Goal

Close Phase 140 on paper following the T778 pattern from Phase 139: write the Phase 140 `refactor-log.md` entry for T779-T786 and the `baseline-metrics.md` Phase 140 section, update the stated unit test count in `AGENTS.md` and `README.md` from 1444 to 1456 tests in 63 files, add the `Branch ... cut from main at 1f17107` line and T786 row under the Phase 140 heading in `docs/audit/task-ledger.md`, and add a Phase 140 amendment to ADR `0101` recording Option B (`fin-master` on Gemini 4 Argon with global `fin-reviewer-g` and `fin-reviewer-strict-g` sub-agents) and the blind Opus comparison on T780 and T781.

## 2. Target files

```
docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
AGENTS.md
README.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (Phase 140 heading update, the `Branch ... cut from main at 1f17107` line, and the T786 row; section 6a step 5).

**`AGENTS.md` is on the pause list** (`AGENTS.md` among the Target files). The edit in `AGENTS.md` is one number on line 11 (`1444` to `1456`) and nothing else; the orchestrator must pause for the owner's go-ahead before `build T786`, and the review of T786 runs on the strict reviewer (`fin-reviewer-strict` / `fin-reviewer-strict-g`).

## 3. Context to read

none (docs-only). The builder reads `AGENTS.md` (already required), `docs/audit/task-ledger.md`, the `## Amendments` section of `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`, the template block and Phase 139 entry at the top of `docs/audit/refactor-log.md`, and the Phase 139 section of `docs/audit/baseline-metrics.md` as the shape to copy.

## 4. Current behaviour

1. **ADR decision:** No new standalone ADR; **amend ADR `0101`**.
   - Code tasks `T780`, `T781`, `T783`, `T784`, and `T785` close low findings from the 2026-10-16 audit (`CS-02`, `SL-03`, `CS-03`, `AP-01`, `AP-02`) by applying existing rules (`PresetSchema`, `roundToCents` at `src/utils/money.ts:22`, ADR `0079`, and `/api/insights` choice/input validation in `docs/contexts/api-proxies.md:37, 56`).
   - Like Phases 126, 128, 130, and 138, running the ICM workflow under Option B (`fin-master` on Gemini 4 Argon and the agy sub-agents `fin-reviewer-g` and `fin-reviewer-strict-g` in `~/.gemini/config/agents/`) changes how the orchestrator and reviewer roles run, not the architectural decision in ADR `0101`. It therefore belongs in `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md` under `## Amendments` (after line 144). The builder writes the ADR `0101` amendment first.

2. **What Phase 140 holds** (from `git log 1f17107..HEAD` and `git diff --stat 1f17107 HEAD`):
   - Branch `phase-140-gemini-trial` was cut from `main` at `1f17107` (`git merge-base main HEAD`).
   - `T779` (`2aee1c5`): `docs/audit/refactor-log.md:24` (1 insertion, 1 deletion: clarifies T776 in the Phase 139 brief as the CS-01 bug fix removing a guard that overrode an explicit `includeDeleted: true`, not a redundant guard).
   - `T780` (`cb1fb1d`): audit `CS-02`. `src/context/TemplateContext.tsx:108-120` (`updatePreset` validates partial updates with `PresetSchema.partial().safeParse(updates)` instead of manual checks, enforcing `MAX_AMOUNT`, length caps `name <= 60` and `description <= 255`, and trimming both `name` and `description`), `unit/template-context.test.tsx:2, 74-78` (adds `MAX_AMOUNT + 1` and `description` trim assertions to the existing edit validation test).
   - `T781` (`d4a373e`): audit `SL-03`. `src/context/FinanceContext.tsx:1943` (guest `addTransaction` assigns `amount: roundToCents(data.amount)` on `newTx`), `unit/ledger-guards.test.tsx:14, 731-771` (+1 test covering positive `EXPENSE` and negative `ADJUSTMENT` cent rounding, wallet delta agreement, and soft-delete/restore reversal).
   - `T782` (`3badf31`): `docs/audit/task-ledger.md:55, 95-96` (adds two `todo` Backlog rows from the blind Opus review of T781: guest `addTransaction` entry rounding before `TransactionSchema.safeParse` and the ADR 0016 overpayment guard at `src/context/FinanceContext.tsx:1675` and `:1749`, and `roundToCents` rounding before `numAmount <= 0` in `src/utils/csvExchange.ts:184-196` and `:209`).
   - `T783` (`9d8adfc`): audit `CS-03`. `src/hooks/useDebts.ts:6, 41-43` (wraps `totalTarget`, `remainingTarget`, and `paidTarget` in `roundToCents`), `unit/debts-page.test.tsx:3, 10-11, 221-246` (+1 test verifying cent rounding across multi-debt addition and single-debt subtraction, and agreement with `debtRemaining(debts)`).
   - `T784` (`68a2886`): audit `AP-01`. `api/insights.ts:626, 631` (`chosenPattern` and `chosenFocus` use `Object.hasOwn(PATTERN_CRITERIA, pattern.choice)` and `Object.hasOwn(focusCriteria, focus.choice)` instead of `in`), `unit/proxy-contract.test.ts:907-958` (+4 tests: `toString`, `valueOf`, `constructor`, plus own choices and the `'none'` sentinel).
   - `T785` (`5183f40`): audit `AP-02`. `api/insights.ts:476-489` (`validate` destructures `changePercent` on each category and checks `changePercent === null || isFiniteNumber(changePercent)` before `toState`), `unit/proxy-contract.test.ts:960-1032` (+6 tests: `undefined`, `'5'`, `true`, `{}`, raw JSON `1e309` `Infinity`, and valid `null` / finite `-12.4`).

3. **Ledger (`docs/audit/task-ledger.md:48-100`):**
   - Line 48 currently reads `## Phase 140 - Gemini trial (no ADR)` and has no `Branch ... cut from main at <sha>` line between line 48 and the table header at line 50 (unlike Phases 136-139 at lines 11, 19, 32, and 40).
   - Rows `T779` through `T785` (`lines 52-58`) are all `done` with empty `Commit` cells and populated `Gate result` cells.
   - Backlog rows `:93` (`CS-02`, `T780`), `:94` (`SL-03`, `T781`), `:97` (`CS-03`, `T783`), `:98` (`AP-01`, `T784`), and `:99` (`AP-02`, `T785`) are already marked `done in Phase 140 (T7xx)`, and rows `:95-96` (from `T782`) are marked `todo`. None of the Backlog rows need editing in T786.

4. **Test counts** (from `workflow/stages/03_review/output/task-T780-review.md` through `task-T785-review.md`):
   - Vitest before Phase 140: 63 files, 1444 tests (`docs/audit/baseline-metrics.md:33`). Now: 63 files, 1456 tests (+12 tests, 0 file delta: `T780` +0 new `it` blocks, `T781` +1, `T783` +1, `T784` +4, `T785` +6).
   - Playwright: no spec file or test was added or removed in Phase 140 (`git diff --stat 1f17107 HEAD` lists no `tests/` file), so 35 specs, 179 tests, 537 runs across 3 browsers stand.
   - Docs stating the unit test count (`git grep "1444"` across `*.md` outside `archive/` and `workflow/`):
     - `AGENTS.md:11`: `1444 tests, 63 files`. **Must change** to `1456 tests, 63 files`.
     - `README.md:157`: `1444 tests in 63 files`. **Must change** to `1456 tests in 63 files`.
     - `docs/audit/refactor-log.md:26-27`, `docs/audit/baseline-metrics.md:33`, `docs/audit/task-ledger.md:45-46, 53`: historical Phase 139 and T780 figures. Leave them unchanged.

5. **Bundle and file lengths:**
   - Phase 140 changed `src/context/TemplateContext.tsx`, `src/context/FinanceContext.tsx`, and `src/hooks/useDebts.ts` (plus `api/insights.ts`, which is a Vercel serverless function outside the Vite bundle). `docs/audit/baseline-metrics.md` therefore needs a `### Phase 140 - delta against Phase 139` section at the top of `## Figures` (`docs/audit/baseline-metrics.md:24-26`), measured against Phase 139 (`index-DdI940YI.js` 193,377 B / 56,330 B gzip; all app JS 884,689 B / 268,554 B gzip, 39 files; CSS `index-BJZ9fITB.css` 52,877 B / 10,216 B gzip).
   - File lengths (`task-ledger.md` 112 lines, `refactor-log.md` 63 lines, `baseline-metrics.md` 106 lines) all stay below the ~150-line archive threshold after this task's additions.

## 5. Parity map

none.

## 6. Tests to add

none. Docs-only; the change cannot alter application behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 6a. Edits (exact)

Write the ADR `0101` amendment first, then the remaining doc files.

1. **`docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`** (append after line 144, with one blank line before it):

   ```markdown
   **Phase 140 (T786, 2026-10-19), branch `phase-140-gemini-trial`.** This adds a fallback way to run the orchestrator and reviewer when Claude Code quota is unavailable; it changes how the roles run, not the decision, so no new ADR.

   1. **Option B (Gemini fallback) alongside Option A (Claude Code default).** Option A (Phase 138 amendment 1: MASTER in Claude Code invoking the project sub-agents `.claude/agents/fin-reviewer.md` on Sonnet and `.claude/agents/fin-reviewer-strict.md` on Opus) stays the default when Claude quota allows. Under Option B, MASTER runs as the agy custom agent `fin-master` on Gemini 4 Argon, specs and reviews go to the agy sub-agents `fin-reviewer-g` and `fin-reviewer-strict-g` (`model: inherit`, defined globally in `~/.gemini/config/agents/`, outside the repo), and the builder is unchanged. The automatic-pause rules, stage files, and commit rules are unchanged.
   2. **Blind Opus comparison and accepted trade-off.** During Phase 140, a blind Opus review of `T780` and `T781` agreed with Argon on every verdict (`SPEC DONE` and `APPROVED` in round 1), but found two spec-level money gaps on `T781` that Argon missed: (a) guest `addTransaction` runs its Zod amount check and the ADR 0016 overpayment guard before rounding `data.amount` (`src/context/FinanceContext.tsx:1675` and `:1749`), whereas SQL rounds first and then checks; and (b) the sibling CSV import path (`src/utils/csvExchange.ts:184-196` and `:209`) also checks `numAmount <= 0` before rounding and uses an inline `Math.round` copy. Both gaps were added to the Backlog in `T782`. The owner accepted shallower money reviews under Option B.
   ```

   Do not edit any line above line 144 in ADR `0101` (the `**Phase 140 release.**` paragraph is added post-merge by the deploy record).

2. **`AGENTS.md:11`**: replace `1444 tests, 63 files` with `1456 tests, 63 files`. Change nothing else in `AGENTS.md`.

3. **`README.md:157`**: replace `1444 tests in 63 files` with `1456 tests in 63 files`. Change nothing else in `README.md`.

4. **`docs/audit/baseline-metrics.md`**: add `### Phase 140 - delta against Phase 139` at the top of `## Figures` (above `### Phase 139 - delta against Phase 137` at line 26), keeping the exact bullet structure of Phase 139:
   - **Bundle**: run `npm run clean`, then `npm run build` with the repo's `.env` present (never read or print `.env`). Gzip each file in `dist/assets` at level 9; record the entry `index-*.js`, the sum of all app JS with the file count, and the CSS `index-*.css`, each with its raw and gzip delta against Phase 139 (`index-DdI940YI.js`: 193,377 B / 56,330 B gzip; all app JS: 884,689 B / 268,554 B gzip, 39 files; CSS `index-BJZ9fITB.css`: 52,877 B / 10,216 B gzip). Report the exact measured numbers, never guessed.
   - **Vitest**: `63 files, 1456 tests (+12 tests, 0 file delta against Phase 139), 1456 passed in <X> s (workflow/stages/02_build/output/logs/T786-unit.log).` Run `npm run test:unit` once at the branch tip, save its output to `workflow/stages/02_build/output/logs/T786-unit.log`, and list the per-task unit runs from the `T780`, `T781`, `T783`, `T784`, and `T785` build logs (`T780`: 1444 passed in 68.65 s; `T781`: 1445 passed in 90.21 s; `T783`: 1446 passed in 77.12 s; `T784`: 1450 passed in 88.93 s; `T785`: 1456 passed in 69.41 s).
   - **Playwright**: state `not run in full: affected specs ran per task` and list each task's Playwright runs (`tests/presets.spec.ts` for T780: 6 on Chromium, 18 on three browsers; `tests/transaction.spec.ts` and `tests/soft-delete.spec.ts` for T781: 12 on Chromium, 36 on three browsers; `tests/debts.spec.ts` and `tests/debts-page.spec.ts` for T783: 4 on Chromium, 12 on three browsers; `tests/insights.spec.ts` for T784 and T785: 2 on Chromium, 6 on three browsers each). Confirm with `npx playwright test --list` that the suite size is unchanged (`179 tests in 35 files, 537 runs across 3 projects`) and state that.

5. **`docs/audit/task-ledger.md`**:
   - Update line 48 from `## Phase 140 - Gemini trial (no ADR)` to `## Phase 140 - Gemini trial (ADR 0101 amendment)` and insert the branch line under it (followed by a blank line before the table):
     ```markdown
     ## Phase 140 - Gemini trial (ADR 0101 amendment)

     Branch `phase-140-gemini-trial`, cut from `main` at `1f17107`.
     ```
   - Add the `T786` row under `T785` in the Phase 140 table:
     - Task: `Phase 140 closing docs: ADR 0101 amendment (Option B), refactor-log entry, baseline-metrics section, branch line in task-ledger.md, unit test count 1456 / 63 files in AGENTS.md and README.md`
     - Files: `` `AGENTS.md`, `README.md`, `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md` ``
     - Status: `done`
     - Commit: empty
     - Gate result: summary from section 7
   - Do not edit the `T779`-`T785` rows, any earlier phase section, or any Backlog row.

6. **`docs/audit/refactor-log.md`**: insert the Phase 140 entry above `## Phase 139 - Subagent trial: ...` (after the `---` at line 20), followed by a blank line, `---`, and a blank line, matching the template:
   - **Heading**: `## Phase 140 - Gemini trial: T779-T786 (2026-10-18 to 2026-10-19, code `<sha>`, docs `<sha>`, merged `<sha>`)`. Keep all three `<sha>` placeholders literal; the post-merge deploy record fills them.
   - **Brief**: `ADR \`0101\` (Phase 140 amendment). Closes five low findings from the 2026-10-16 audit across templates, the guest ledger, debt metrics, and the insights proxy (CS-02, SL-03, CS-03, AP-01, AP-02), fixes the Phase 139 refactor-log description of T776, adds two Backlog follow-ups from the blind Opus review of T781, and amends ADR 0101 to record Option B (\`fin-master\` on Gemini 4 Argon with global \`fin-reviewer-g\` and \`fin-reviewer-strict-g\` sub-agents).`
   - **Changed**: list `T779` through `T786` from the commits and the ledger (`T779`: `docs/audit/refactor-log.md` Phase 139 brief wording for T776; `T780`: `src/context/TemplateContext.tsx` `updatePreset` `PresetSchema.partial().safeParse(updates)` validation and trimming, `unit/template-context.test.tsx` `MAX_AMOUNT + 1` and `description` trim assertions; `T781`: `src/context/FinanceContext.tsx` `roundToCents(data.amount)` on guest `newTx`, `unit/ledger-guards.test.tsx` 1 new test for positive/negative cent rounding and soft-delete/restore reversal; `T782`: `docs/audit/task-ledger.md` two Backlog rows from the blind Opus review of T781; `T783`: `src/hooks/useDebts.ts` `roundToCents` on `totalTarget`, `remainingTarget`, and `paidTarget`, `unit/debts-page.test.tsx` 1 new test; `T784`: `api/insights.ts` `Object.hasOwn` on `PATTERN_CRITERIA` and `focusCriteria`, `unit/proxy-contract.test.ts` 4 new tests; `T785`: `api/insights.ts` `changePercent === null || isFiniteNumber(changePercent)` check in `validate`, `unit/proxy-contract.test.ts` 6 new tests; `T786`: `AGENTS.md` and `README.md` unit count 1456 / 63 files, `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md` Phase 140 amendment, `docs/audit/baseline-metrics.md` Phase 140 section, `docs/audit/task-ledger.md` Phase 140 section, branch line, T779-T786 rows, five Backlog rows marked done and two added, and this file). Leave out `workflow/stages/*/output/` files.
   - **Verified**: one clause per task (`T779` through `T785`) from the ledger's `Gate result` cells, then `T786`'s gates (including the full unit run and clean production bundle figures from the Phase 140 baseline-metrics section), plus a clause stating that the reviews for `T779` through `T785` were `APPROVED` in round 1. Do not write a `Release:` clause (the post-merge deploy record appends it).
   - **Surprises**: (a) `T780` added its `MAX_AMOUNT + 1` and `description`-trim assertions inside the existing `'an edit is checked before it is applied'` test in `unit/template-context.test.tsx`, so the unit count stayed at 1444 in `T780` and grew by 12 across `T781` (+1), `T783` (+1), `T784` (+4), and `T785` (+6) to 1456. (b) Phase 140 ran under Option B (`fin-master` on Gemini 4 Argon with the global agy sub-agents `fin-reviewer-g` and `fin-reviewer-strict-g`, `model: inherit` in `~/.gemini/config/agents/`, builder unchanged, Option A remaining the default when Claude quota allows). A blind Opus review of `T780` and `T781` agreed with Argon on every verdict (`SPEC DONE` and `APPROVED` in round 1), but found two spec-level money gaps on `T781` that Argon missed: guest `addTransaction` checks `TransactionSchema.safeParse` and the ADR 0016 overpayment guard before rounding `data.amount` (`src/context/FinanceContext.tsx:1675` and `:1749`), and the sibling CSV import path (`src/utils/csvExchange.ts:184-196` and `:209`) checks `numAmount <= 0` before rounding and uses an inline `Math.round` copy. Both gaps were recorded in the Backlog in `T782`, and the owner accepted shallower money reviews under Option B.
   - **Deliberately not done**: a new standalone ADR (reasons above); the two `T782` Backlog items (`addTransaction` entry rounding before `safeParse`/overpayment check and CSV import `roundToCents` check order); wrapping `WalletsView.tsx:107`'s `newBalance - Number(target.balance)` or `DebtCard.tsx:54`'s `debt.totalAmount - remaining` in `roundToCents` (non-blocking notes from the `T781` and `T783` reviews); moving `totalTarget`, `remainingTarget`, and `paidTarget` into `src/selectors/` (kept in `useDebts.ts` per ADR `0079`); the remaining 2026-10-16 audit finding (`SL-01`) and other open Backlog rows; checking `~/.gemini/config/agents/` into the repo; a full Playwright suite run (affected specs ran per task); archiving `task-ledger.md`, `refactor-log.md`, or `baseline-metrics.md` (all under the 150-line threshold).

## 7. Gates

Docs-only tier: nothing mandatory, except checking every stated count, path, and sha against the code and repository. Commands:

```powershell
npm run test:unit                       # save to workflow/stages/02_build/output/logs/T786-unit.log; expect 63 files, 1456 passed
npx playwright test --list              # expect 179 tests in 35 files, 537 runs across 3 projects; read-only, starts no server
npm run clean
npm run build                           # bundle figures; .env present, never read or print it
git rev-parse --short (git merge-base main HEAD)   # expect 1f17107
git ls-files --eol AGENTS.md README.md docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md
git diff -U0 HEAD -- AGENTS.md README.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
git grep "1444" -- AGENTS.md README.md
git status --porcelain
```

Expect:
- `npm run test:unit`: 63 files, 1456 passed.
- `npx playwright test --list`: 179 tests in 35 files (537 runs across 3 projects).
- `git rev-parse --short (git merge-base main HEAD)`: `1f17107`.
- `git ls-files --eol`: all six modified tracked files report `w/crlf`.
- `git diff -U0 HEAD -- AGENTS.md README.md`: one line changed in each file, replacing `1444` with `1456` only.
- Em-dash check prints `0`.
- `git grep "1444" -- AGENTS.md README.md` prints nothing (exit 1).
- `git status --porcelain` shows only the five Target files, `docs/audit/task-ledger.md`, and the `workflow/stages/*/output/` files.

## 8. Production touch points

none. (`AGENTS.md` is an automatic-pause trigger, not a production touch point.) The owner's post-merge deploy record, a docs-only `[skip ci]` commit on `main`, fills the `<sha>` placeholders in `refactor-log.md`, the `Commit` cells and merge summary in `task-ledger.md`, and the `**Phase 140 release.**` paragraph in ADR `0101`.

## 9. Out of scope

- Any code, test, config, or SQL file; `.claude/agents/`; `~/.gemini/config/agents/`; the `workflow/stages/*/CONTEXT.md` files.
- The `T779`-`T785` task rows, earlier phases, and all Backlog rows in `docs/audit/task-ledger.md`.
- Historical test counts in earlier `refactor-log.md` and `baseline-metrics.md` entries, ADRs, and `audit-2026-10-16.md`.
- Any other line of `AGENTS.md`, `README.md`, or ADR `0101` above line 144.
- Archiving any file under `docs/audit/`.
- Running the full Playwright suite or sending any request to production `/api/*`.
