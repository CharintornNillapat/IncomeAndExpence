# Spec: T778

Phase 139, branch `phase-139-subagent-trial`. Docs-only; this task ships the phase.

## 1. Goal

Close Phase 139 on paper: write its `refactor-log.md` entry and `baseline-metrics.md` section, bring the stated unit test count in `AGENTS.md` and `README.md` to the current 1444 tests in 63 files, and add the T778 row to the ledger. No ADR, no code.

## 2. Target files

```
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
AGENTS.md
README.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (the T778 row, section 6 step 4).

**`AGENTS.md` is on the pause list** (`AGENTS.md` among the Target files). The edit is one number pair on line 11 and nothing else; the orchestrator must pause for the owner's go-ahead before `build T778`. For the same reason, every review of T778 runs on `fin-reviewer-strict`.

Amended once by the owner (2026-10-18): section 6a step 5, Surprises item (c), now carries verified sub-agent model results as exact text. No other scope or target change.

## 3. Context to read

none (docs-only). The builder reads `AGENTS.md` (already required), `docs/audit/task-ledger.md`, the template block at the top of `docs/audit/refactor-log.md`, and the Phase 137 sections of `refactor-log.md` and `baseline-metrics.md` as the shape to copy.

## 4. Current behaviour

ADR decision (scope item 1): **no ADR.** Confirmed, with reasons.
- `AGENTS.md` asks for an ADR before code for a new feature or phase. Phase 139 is two bug fixes, not a feature.
- T777 applies a rule that already has its ADR: `docs/audit/decisions/0033-editing-a-transaction.md:75` ("a realtime reload landing mid-flight re-reads instead of restoring a stale snapshot (T69)"), and `docs/audit/decisions/0023-atomic-server-ledger-writes.md` covers the atomic write and the unknown-outcome re-read. T777 moved no arithmetic and no SQL; it gave `setTransactionDeleted` the same catch layout `addTransaction` already has. The owner decided it in T760's spec.
- T776 deletes one line (`src/hooks/useTransactions.ts`, the `includeDeleted && !showSoftDeleted` guard) so the existing option does what its name says. No caller passes `includeDeleted`, so no app behaviour changed.
- Phases 136 and 137 shipped on the same footing ("no ADR"). Phase 138 amended ADR 0101 because it changed the workflow; Phase 139 changes none.

What the phase holds, from `git log 2e81e2c..HEAD` and `git diff --stat 2e81e2c HEAD`:
- T776, `7e732d6`: audit CS-01. `src/hooks/useTransactions.ts` (1 insertion, 2 deletions), new `unit/use-transactions.test.tsx` (2 tests).
- T777, `557c025`: `src/context/FinanceContext.tsx` (`setTransactionDeleted` snapshots `cloudRevisionRef` and re-fetches on failure when a reload landed; MissingLedgerFunction return moved below the re-read), `unit/authenticated-ledger.test.tsx` (4 tests).
- Ledger: Phase 139 section at `docs/audit/task-ledger.md:38-45` holds T776 and T777 rows; Backlog row `:76` (setTransactionDeleted cloudRevisionAtStart) already reads `done in Phase 139 (T777)` and `:79` (CS-01) reads `done in Phase 139 (T776)`. Both confirmed; the builder changes neither.

Counts, from the reviews' own runs (`workflow/stages/03_review/output/task-T776-review.md` section 4, `task-T777-review.md` section 4):
- Vitest before the phase: 62 files, 1438 tests (Phase 137 section of `baseline-metrics.md`). Now: 63 files, 1444 tests (+6: T776 +2 in a new file, T777 +4).
- Playwright: no spec file or test was added or removed in Phase 139 (`git diff --stat` lists none), so 35 specs, 179 tests, 537 runs stand.

Docs that state the unit test count (grep of `1438` and `62 files` across `*.md` outside `archive/`, `output/` and `node_modules`):
- `AGENTS.md:11`: "1438 tests, 62 files". **Must change** to "1444 tests, 63 files".
- `README.md:157`: "1438 tests in 62 files". **Must change** to "1444 tests in 63 files".
- `docs/audit/README.md`, `docs/contexts/*.md`, `DESIGN.md`: no count. No change.
- `refactor-log.md` and `baseline-metrics.md` entries for Phases 137 and earlier, ADRs 0067, 0100, 0101 and `audit-2026-10-16.md`: historical figures. Leave them.
- The Playwright figures in `AGENTS.md:11` (179 / 35 / 537) stay.

Bundle (scope item 3): the rules require figures for a shipped phase that changed code. Phase 138 skipped its section only because nothing changed; Phase 139 changed `src/`. `baseline-metrics.md` has no Phase 138 section, so the delta base is the Phase 137 section (entry `index-vzBQwKkr.js` 193,335 B / 56,358 B gzip; all app JS 884,669 B / 268,588 B gzip, 39 files; CSS `index-BJZ9fITB.css` 52,877 B / 10,216 B gzip). Production still serves those files per the Phase 138 log entry. The file is 95 lines, under the 150-line archive threshold.

## 5. Parity map

none.

## 6. Tests to add

none. Docs only; the change cannot alter behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 6a. Edits (exact)

1. **`AGENTS.md:11`**: replace `1438 tests, 62 files` with `1444 tests, 63 files`. Nothing else in the file.
2. **`README.md:157`**: replace `1438 tests in 62 files` with `1444 tests in 63 files`. Nothing else.
3. **`docs/audit/baseline-metrics.md`**: add `### Phase 139 - delta against Phase 137` at the top of "Figures" (above the Phase 137 section), same bullet shape as Phase 137: Entry chunk, All app JS, CSS, Vitest, Playwright. Figures, measured by the builder, never guessed:
   - Bundle: `npm run clean`, then `npm run build` with the repo's `.env` present (it is, in this checkout; never read or print it). Gzip each file in `dist/assets` at level 9; record the entry `index-*.js`, the sum of all app JS with the file count, and the CSS, each with the delta against the Phase 137 figures above. Expect `FinanceContext` to be in the entry, so a small positive entry delta; report whatever is measured.
   - Vitest: 62 files / 1438 tests before, 63 files / 1444 tests now (+6, +1 file). Run `npm run test:unit` at the branch tip once and record its time; save to `workflow/stages/02_build/output/logs/T778-unit.log`. Reference the T776 and T777 logs for the per-task runs.
   - Playwright: the full suite is not run for this phase. State: "not run in full: no UI path changed in Phase 139; affected specs ran per task" and list `tests/soft-delete.spec.ts` (T777: 6 on Chromium, 18 on three browsers) and `tests/soft-delete.spec.ts` plus `tests/transaction.spec.ts` (T776: 12 on Chromium, 36 on three browsers). Confirm the suite size is unchanged with `npx playwright test --list` (expect 179 tests in 35 files, 537 runs in the summary) and state that.
4. **`docs/audit/task-ledger.md`**: add the T778 row under T777 in the Phase 139 table: Task `Phase 139 closing docs: refactor-log entry, baseline-metrics section, unit test count 1444 / 63 files in AGENTS.md and README.md`; Files `AGENTS.md`, `README.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`; Status `done`; Commit empty; Gate result from section 7. Do not edit the Branch line, T776/T777 rows or any Backlog row (the deploy record adds the commits and PR). Keep CRLF.
5. **`docs/audit/refactor-log.md`**: insert the Phase 139 entry above the Phase 138 entry (newest first), after the `---` that follows the template, with a `---` after it, following the template exactly:

   - Heading: `## Phase 139 - Subagent trial: T776-T778 (2026-10-18, code `<sha>`, docs `<sha>`, merged `<sha>`)`. Leave all three `<sha>` placeholders literal; the owner's post-merge deploy record fills them (the T776 and T777 shas `7e732d6` and `557c025` stay out of the heading; they go in the ledger's Commit column via the same record).
   - Brief: `No ADR (...)` with the reasons from section 4 in two sentences: T777 applies the T69 rule ADR 0033 already records to a sibling write, T776 removes a guard. Say Phase 139 is the first phase run with the `fin-reviewer` and `fin-reviewer-strict` sub-agents from Phase 138 (ADR 0101 amendment).
   - **Changed:** T776 (`src/hooks/useTransactions.ts`: the `includeDeleted && !showSoftDeleted` guard removed, `showSoftDeleted` out of the Stage 1 memo's dependency array; `unit/use-transactions.test.tsx`: new, 2 tests). T777 (`src/context/FinanceContext.tsx`: `setTransactionDeleted` snapshots `cloudRevisionRef` before the write and, on failure, calls `refreshFromCloud()` when a reload landed mid-flight, else restores the snapshot as before; the `MissingLedgerFunction` return now follows the re-read, `addTransaction`'s layout; `unit/authenticated-ledger.test.tsx`: 4 tests, delete and restore each with and without a reload). T778 (`AGENTS.md`, `README.md`: unit count 1444 / 63 files; `docs/audit/baseline-metrics.md`: Phase 139 section; `docs/audit/task-ledger.md`: Phase 139 section and rows, two Backlog rows done; this file). Build the list from the commits and the ledger; leave out `workflow/stages/*/output/` files.
   - **Verified:** one clause per task, taken from the ledger's Gate result cells (T776, T777) and this task's gates; then the full-suite and bundle figures from the baseline section. Add a clause that the reviews were APPROVED in round 1 (both reviews say so). Do not write a Release clause with PR, CI, Vercel or deployment ids: the deploy record adds it after the merge, as for Phase 138 (that entry's Release sentence was appended post-merge).
   - **Surprises:** (a) T776 was a deletion, not an addition: line 68 was the only reader of `showSoftDeleted` inside the memo, and no caller passes `includeDeleted`, so the fix changed no screen. (b) T777's red run failed only 2 of its 4 tests by design (the two reload-landed cases); the two no-reload cases pass before and after and pin that the fix does not turn every failure into a re-fetch. (c) Write this sentence block verbatim (owner's amendment; the figures are verified facts, not the builder's to re-derive or soften):

     > The Phase 138 entry left open whether Claude Code loads the two agents and on which model each runs. Both loaded, and each ran on one model only. Counted from the `model` field of every assistant message in this session's Claude Code sub-agent transcripts: `fin-reviewer` ran on Sonnet 5.5 (`claude-sonnet-5-5`) for the T776 spec (28 responses), the T776 review (16) and the T778 spec (28); `fin-reviewer-strict` ran on Opus 5.5 (`claude-opus-5-5`) for the T777 spec (41), the T777 spec amendment (29) and the T777 review (22). The only Opus string in a `fin-reviewer` transcript was an advisor tool's definition, never a response model. The transcripts live outside the repo, in the session's `subagents/` folder, so this check cannot be repeated from the repo.

     Keep the counts, model ids and agent names exactly as above. Add no other claim about models.
   - **Deliberately not done:** an ADR (reasons above); a shared rollback helper for the three write catch blocks (T777 spec section 9); the `cloudRevisionRef` comment at `FinanceContext.tsx:771-782` (it names `addTransaction` only); a test for a reload that read nothing during delete or restore (pinned elsewhere at `unit/authenticated-ledger.test.tsx:833-859`); any caller passing `includeDeleted` (CS-01 fixes the hook only); the remaining 2026-10-16 audit findings (SL-01 and the rest of the Backlog); a full Playwright run (affected specs only, per the tier rows); `baseline-metrics.md` archiving (under the threshold).

## 7. Gates

Docs-only tier: nothing mandatory, except that every stated count is checked against the code. Commands:

```
npm run test:unit                       # save to workflow/stages/02_build/output/logs/T778-unit.log; expect 63 files, 1444 passed
npx playwright test --list              # expect 179 tests in 35 files, 537 runs on three projects as AGENTS.md states; read-only, starts no server
npm run clean
npm run build                           # bundle figures; .env present, never read it
git ls-files --eol AGENTS.md README.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md
git diff -U0 HEAD -- AGENTS.md README.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
grep -rnE "1438" AGENTS.md README.md
```

Expect: 63 files and 1444 passed; Playwright counts unchanged; all five files `w/crlf` (the `i/lf` index column is normal); the `AGENTS.md` and `README.md` diffs are one line each, number pair only; 0 em dashes in added lines; no `1438` left in `AGENTS.md` or `README.md`. `git status --porcelain` shows only the Target files, `task-ledger.md` and the `workflow/stages/*/output/` files. No lint, Playwright or `supabase` gate applies; the lint tier is not triggered because no code folder changed.

## 8. Production touch points

none. (`AGENTS.md` is the pause trigger, not a production touch.) The owner's post-merge deploy record, a docs-only `[skip ci]` commit on `main`, fills the `<sha>` placeholders, the ledger Commit cells and the Release clause; this task does not.

## 9. Out of scope

- Any code, test, config or SQL file; `.claude/agents/`; the stage files.
- The T776 and T777 rows, the Phase 139 Branch line, and every Backlog row of the ledger (already correct).
- Historical counts in earlier log and baseline entries, ADRs and `audit-2026-10-16.md`.
- Any other `AGENTS.md` or `README.md` line, including the Playwright figures.
- A new ADR, an ADR amendment, or archiving any file.
- Running the full Playwright suite or any request to production `/api/*`.
