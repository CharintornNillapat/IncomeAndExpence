# Spec: T791

Phase 142, branch `phase-142-clean-up-id-conventions`. Docs-only; this task ships the phase.

## 1. Goal

Close Phase 142 on paper, following the Phase 141 pattern (T789): write the Phase 142 `refactor-log.md` entry for T790-T791 and the `baseline-metrics.md` Phase 142 section, update the stated unit test count in `AGENTS.md` and `README.md` from `1463` tests in `63` files to `1465` tests in `64` files, and in `docs/audit/task-ledger.md` fill T790's Commit cell with `c8d16cf` and add the T791 row.

## 2. Target files

```
AGENTS.md
README.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (T790 Commit cell and the T791 row; section 6a step 4).

**`AGENTS.md` is on the pause list.** The edit in `AGENTS.md` is two numbers on line 11 and nothing else; the orchestrator pauses for the owner's go-ahead before `build T791`.

## 3. Context to read

none (docs-only). The builder reads the template block and the Phase 141 entry at the top of `docs/audit/refactor-log.md`, the Phase 141 section of `docs/audit/baseline-metrics.md`, and the Phase 141 and 142 sections of `docs/audit/task-ledger.md` as the shapes to copy.

## 4. Current behaviour

1. **ADR:** none. Phase 142 is a behaviour-preserving id rename plus a guard test; the ledger heading at `docs/audit/task-ledger.md:73` already says `(no ADR)`, and the T790 spec (`workflow/stages/01_spec/output/task-T790-spec.md`, section 2) records why.
2. **What Phase 142 holds** (`git log b21cb8d..HEAD`, `git diff --stat b21cb8d c8d16cf`):
   - Branch cut from `main` at `b21cb8d` (`git merge-base main HEAD`), ledger line `:75`.
   - One code commit, T790 `c8d16cf` (2026-10-22): 24 `src/` files (ids renamed to `<view>-<thing>-<kind>`, `-button` kinds to `-btn`, area prefixes added; `TransactionForm.tsx:179` `submitBtnId` now `` `${idPrefix}-confirm-btn` ``; payoff `data-testid`s pinned as literals at `TransactionForm.tsx:840`, `:888`), 24 `tests/*.spec.ts` and 11 `unit/` files (locator renames only), new guard `unit/dom-id-convention.test.ts` (2 tests, `AREAS` at `:5`, tests at `:133` and `:138`), docs `docs/audit/test-selector-contract.md`, `docs/contexts/ui-and-e2e.md`, `docs/contexts/client-state.md`, `DESIGN.md`, `docs/audit/task-ledger.md`.
   - T790 review: CHANGES REQUESTED in round 1 (4 stale id references in `DebtPayoffCard.tsx:27`, `AddWalletForm.tsx:23`, `client-state.md:85`, `DESIGN.md:182`, and 4 bare-LF lines in `test-selector-contract.md`), APPROVED in round 2 (`workflow/stages/03_review/output/task-T790-review.md`).
3. **Ledger** (`docs/audit/task-ledger.md:73-79`): T790 row at `:79` is `done` with an empty Commit cell and a filled Gate result. Backlog row `:92` already reads `done in Phase 142 (T790)`; no Backlog row needs editing.
4. **Test counts:**
   - Vitest before Phase 142: 63 files, 1463 tests (`docs/audit/baseline-metrics.md:33`). After T790: 64 files, 1465 tests (+2 tests, +1 file, the new guard). The T790 review's full run: 64 files, 1465 passed.
   - Stated counts to change: `AGENTS.md:11` `1463 tests, 63 files`; `README.md:157` `1463 tests in 63 files`. Every other `1463` / `63 files` hit (`refactor-log.md:26-27`, `baseline-metrics.md:33`, `task-ledger.md:70-71`) is a historical Phase 141 figure: leave it.
   - Playwright: no spec added or removed. `npx playwright test --list` at `c8d16cf` prints `Total: 537 tests in 35 files` (179 tests x 3 projects), so `AGENTS.md:11` and `README.md:158` stand.
5. **Bundle** (measured by the spec author at `c8d16cf`, clean `dist/`, `.env` present, gzip level 9 over `dist/assets`):
   - Entry `index-CQ64gmHG.js` 193,169 B / 56,374 B gzip (Phase 141 `index-O-Xe4lzP.js` 193,175 / 56,380: -6 / -6).
   - All app JS 884,709 B / 268,592 B gzip, 39 files (Phase 141 884,491 / 268,612: +218 / -20, 0 file delta).
   - CSS `index-BJZ9fITB.css` 52,877 / 10,216 (0 delta).
6. **File lengths:** `refactor-log.md` 84 lines, `baseline-metrics.md` 125 lines, `task-ledger.md` 132 lines. After this task about 93, 134 and 133: all under the ~150 archive threshold.

## 5. Parity map

none.

## 6. Tests to add

none. Docs-only; the change cannot alter behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 6a. Edits (exact)

Keep CRLF line endings in every file (all five are `w/crlf` today).

1. **`AGENTS.md:11`**: replace `1463 tests, 63 files` with `1465 tests, 64 files`. Nothing else in `AGENTS.md`.

2. **`README.md:157`**: replace `1463 tests in 63 files` with `1465 tests in 64 files`. Nothing else in `README.md`.

3. **`docs/audit/baseline-metrics.md`**: insert this block after `## Figures` and its blank line (line 24-25), above `### Phase 141 - delta against Phase 140` (line 26). Replace `<X>` with the seconds from the builder's own `npm run test:unit` run (gate 1). If the build in gate 3 prints a different entry name or byte count than below, stop and report it in the build report instead of writing the block.

   ```markdown
   ### Phase 142 - delta against Phase 141

   - **Entry chunk** `index-CQ64gmHG.js`: 193,169 B (-6 B), 56,374 B gzip (-6 B against Phase 141 `index-O-Xe4lzP.js`, 193,175 / 56,380).
   - **All app JS**: 884,709 B (+218 B), 268,592 B gzip (-20 B against Phase 141 884,491 / 268,612, 39 files, 0 file delta).
   - **CSS**: `index-BJZ9fITB.css`: 52,877 B (0 delta), 10,216 B gzip (0 delta against Phase 141 `index-BJZ9fITB.css`, 52,877 / 10,216).
   - **Vitest**: 64 files, 1465 tests (+2 tests, +1 file against Phase 141: the new guard `unit/dom-id-convention.test.ts`), 1465 passed in <X> s (`workflow/stages/02_build/output/logs/T791-unit.log`). Per-task run: T790 1465 passed in 42.56 s (`workflow/stages/02_build/output/logs/T790-unit.log`).
   - **Playwright**: run in full by T790, since its renames touched 24 specs: 531 passed, 6 skipped, 0 failed across 3 projects (8.7 min, `workflow/stages/02_build/output/logs/T790-playwright.log`; the review's rerun took 10.9 min). Suite size unchanged: `npx playwright test --list` reports 179 tests in 35 files, 537 runs across 3 projects.

   ```

   Leave out a `Measured at <sha>` line; the post-merge deploy record adds it, as it did for Phase 141.

4. **`docs/audit/task-ledger.md`** (Phase 142 table only):
   - T790 row (`:79`): set the Commit cell to `c8d16cf`. Change no other cell.
   - Add the T791 row directly under T790:
     - `#`: `T791`
     - Task: `Phase 142 closing docs: refactor-log entry, baseline-metrics section, task-ledger.md updates, unit test count 1465 / 64 files in AGENTS.md and README.md`
     - Files: `` `AGENTS.md`, `README.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md` ``
     - Status: `done`
     - Commit: empty
     - Gate result: in T789's shape, e.g. `unit 64 files 1465 passed (<X>s); playwright list 179/35/537; clean prod build (index-CQ64gmHG.js 193,169 B, all app JS 884,709 B 39 files, CSS 52,877 B); CRLF kept; 0 em dashes`
   - Do not edit the heading, the branch line `:75`, any earlier phase, or any Backlog row.

5. **`docs/audit/refactor-log.md`**: insert this block after the `---` at line 20 and its blank line, above `## Phase 141 - ...` (line 22), followed by a blank line, `---` and a blank line. Keep `docs <sha>` and `merged <sha>` literal; replace `<X>` with the gate 1 seconds.

   ```markdown
   ## Phase 142 - Clean up id conventions: T790-T791 (2026-10-22, code `c8d16cf`, docs `<sha>`, merged `<sha>`)

   No ADR (a behaviour-preserving rename under the existing spec-edit policy in `docs/contexts/ui-and-e2e.md`). Verifies the `<view>-<thing>-<kind>` DOM id convention across `src/components` and `src/views`, renames every id that broke it, and adds a unit guard, closing the Backlog row that recorded the convention as never verified repo-wide.

   **Changed:** T790 (24 `src/` files: ids take an area prefix, buttons end `-btn` instead of `-button`, per-entity ids become `<view>-<thing>-<entityId>`, `DebtsView`'s repay form uses `idPrefix="debt-repay"`; `src/components/TransactionForm.tsx`: `submitBtnId` is `${idPrefix}-confirm-btn`, and the four payoff `data-testid`s are pinned as literal `repay-*` so the prefix rename does not move them; `unit/dom-id-convention.test.ts`: new guard, 2 tests; 24 `tests/*.spec.ts` and 11 `unit/` files: locator renames only; `docs/audit/test-selector-contract.md`: convention section and renamed ids; `docs/contexts/ui-and-e2e.md`, `docs/contexts/client-state.md`, `DESIGN.md`: renamed ids; `docs/audit/task-ledger.md`: Phase 142 section, T790 row, Backlog row done). T791 (`AGENTS.md` and `README.md`: unit count 1465 tests in 64 files; `docs/audit/baseline-metrics.md`: Phase 142 section; `docs/audit/task-ledger.md`: T790 commit and T791 row; this file).
   **Verified:** T790: Red gate verified (74 failed in unit/dom-id-convention.test.ts); leftover grep 0 hits repo-wide; npm run lint clean; unit guard 2 passed; related unit 11 files 333 passed; full unit 64/64 files 1465 passed (42.56s); e2e 24 specs on chr 132 passed (1.2m); e2e 35 specs on 3 browsers 531 passed, 6 skipped (8.7m); CRLF kept; 0 em dashes. T791: docs checks passed (unit test count 1465 in 64 files in AGENTS.md and README.md; Playwright test list 179 tests in 35 files, 537 runs across 3 projects; full unit suite 64 files 1465 passed in <X>s; clean production build index-CQ64gmHG.js 193,169 B / 56,374 B gzip, all app JS 884,709 B / 268,592 B gzip, 39 files; CSS index-BJZ9fITB.css 52,877 B / 10,216 B gzip; CRLF kept across 5 touched files; 0 em dashes in git diff). The T790 review requested changes in round 1 and approved in round 2.
   **Surprises:** (a) The spec's area list missed `debts`: `DebtsView.tsx` carries the non-interactive ids `debts-paid-off-heading` and `debts-caption`, so the guard's `AREAS` gained `debts` instead of renaming ids the spec said to leave alone. (b) `TransactionForm` built its payoff `data-testid`s from the caller's prefix, so renaming the repay prefix to `debt-repay` would have moved testids that `tests/debt-repayment.spec.ts` asserts; four were pinned as literals, and the repay overdraft testids became `debt-repay-overdraft-*`, which no test references. (c) Round 1 of the T790 review found four stale old ids in comments and docs outside the spec's targets (`DebtPayoffCard.tsx`, `AddWalletForm.tsx`, `client-state.md`, `DESIGN.md`) and four bare-LF lines in `test-selector-contract.md`; the fix round closed both.
   **Deliberately not done:** an ADR (reasons above); renaming non-interactive ids that already carry an area prefix (`account-delete`, `tx-drawer`, `debts-caption`); renaming `time-filter-*` (frozen by `tests/date-boundary.spec.ts`); rewriting old ids quoted in `docs/audit/decisions/` (history); checking composed template ids beyond the caller's literal `idPrefix`; re-sorting the selector contract's "Selectors by spec" lists (a non-blocking review note); archiving `task-ledger.md`, `refactor-log.md` or `baseline-metrics.md` (all under the 150-line threshold).

   ---
   ```

## 7. Gates

Docs-only tier: nothing mandatory beyond checking every stated count, path and sha. Commands (PowerShell):

```powershell
npm run test:unit *> workflow/stages/02_build/output/logs/T791-unit.log   # expect 64 files, 1465 passed; record the seconds as <X>
npx playwright test --list | Select-Object -Last 1                       # expect "Total: 537 tests in 35 files"; starts no server
if (Test-Path dist) { Remove-Item -Recurse -Force dist }; npm run build   # .env present; never read or print it
node -e "const fs=require('fs'),z=require('zlib'),p='dist/assets/';let t=0,g=0,n=0;for(const f of fs.readdirSync(p)){const b=fs.readFileSync(p+f),c=z.gzipSync(b,{level:9}).length;if(f.endsWith('.js')){t+=b.length;g+=c;n++}if(/^index-.*\.(js|css)$/.test(f))console.log(f,b.length,c)}console.log('allJS',t,g,n)"
git rev-parse --short (git merge-base main HEAD)                          # expect b21cb8d
git log --format=%h -1 --grep=T790                                        # expect c8d16cf
git diff -U0 HEAD -- AGENTS.md README.md
git grep -n "1463\|63 files" -- AGENTS.md README.md                       # expect nothing (exit 1)
git ls-files --eol AGENTS.md README.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
git status --porcelain
```

Expect:
- Unit: 64 files, 1465 passed, 0 failed.
- Playwright list: `Total: 537 tests in 35 files`.
- Bundle: `index-CQ64gmHG.js 193169 56374`, `index-BJZ9fITB.css 52877 10216`, `allJS 884709 268592 39`. Any difference: report it, do not write the metrics block (section 6a step 3).
- Merge base `b21cb8d`; T790 commit `c8d16cf`.
- `git diff -U0` on `AGENTS.md` and `README.md`: one changed line each, only the two numbers.
- `git ls-files --eol`: all five files `w/crlf`.
- Em dash count: `0`.
- `git status --porcelain`: only the 4 Target files, `docs/audit/task-ledger.md` and `workflow/stages/*/output/` files (`dist/` is gitignored).

## 8. Production touch points

none. (`AGENTS.md` triggers the automatic pause; it is not a production touch point.) The owner's post-merge deploy record on `main` later fills the `<sha>` placeholders in `refactor-log.md`, the T791 Commit cell, the branch line, and the `Measured at` line in `baseline-metrics.md`.

## 9. Out of scope

- Any code, test, config or SQL file; `.claude/agents/`; the `workflow/stages/*/CONTEXT.md` files.
- Any other line of `AGENTS.md` or `README.md`, including the Playwright counts (unchanged).
- The T790 row's Task, Files, Status and Gate result cells; the Phase 142 heading and branch line; earlier phases; every Backlog row.
- Historical counts in earlier `refactor-log.md` and `baseline-metrics.md` entries and in ADRs.
- Promoting the id convention into `AGENTS.md` (T790 already wrote it into `docs/contexts/ui-and-e2e.md`).
- Archiving any `docs/audit/` file; running the full Playwright suite; any request to production `/api/*`.
