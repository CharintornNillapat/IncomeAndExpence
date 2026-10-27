# Review: T815

## Round 1

### 1. Metadata

- Task: T815, Phase 149 closing docs (ships the phase), branch `phase-149-transactions-views`
- Date: 2026-10-27
- Round: 1
- Verdict: APPROVED
- Target files: `AGENTS.md`, `README.md`, `docs/contexts/ui-and-e2e.md`, `docs/audit/decisions/0109-transactions-table-and-calendar-views.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`; bookkeeping `docs/audit/task-ledger.md`. None is git-ignored (`git check-ignore -v` exits 1 for all seven).

### 2. Summary

This is a docs-only close of Phase 149. It updates the unit and Playwright counts in `AGENTS.md:11`, `README.md:157-158` and `ui-and-e2e.md:67`. In ADR 0109 it changes the Status line and the `:74` Consequence and adds the Implementation, Verification and Release sections. It also adds the Phase 149 refactor-log entry and the baseline-metrics section, fills the T809 to T814 Commit cells and adds the T815 row. I re-measured every figure the docs state and each one matches.

### 3. Invariants and parity

- Parity map: none of its rows is touched. The `set_transactions_deleted` row is named in prose only.
- Scope: `git diff --stat` lists exactly the seven files (61+, 12-). `git status --porcelain` shows those seven plus the T815 spec, build and review outputs. Nothing under `src/`, `tests/`, `unit/`, `supabase/`, `api/`, `scripts/` or `.github/` changed, and no config file changed.
- `AGENTS.md`: the diff is one line (`:11`). Only the four numbers changed, to 1598 / 72 / 213 / 37 / 639, matching the owner-approved line.
- `README.md`: only `:157-158` changed, and both lines keep their length and alignment. `ui-and-e2e.md`: only `:67` changed.
- ADR 0109: the edits match spec 6a step 4 word for word. Implementation and Verification sit before `## Consequences` with single blank lines around them. Release is at the end, and the file ends in a single `\n`. Every code fact checks out against the code:
  - `pf_tx_view` (`txViewPreference.ts:7`)
  - `walletLabel` (`display.ts:64`)
  - `monthBounds`, `dailyTotals`, `HEAT_LEVELS`, `heatLevel`, `selectionSummary`
  - `set_transactions_deleted(uuid[], boolean)` and its probe
  - 22 migration files
  - the message at `FinanceContext.tsx:395`
- Ledger: in each T809 to T814 row only the Commit cell changed (checked cell by cell). The six shas match `git log --grep "(Tnnn)"`: `a2634f1` (2026-10-26), `ec9fa58`, `4e88626`, `48e6750`, `83d5c54`, `9caee5e` (2026-10-27). The T815 row is `done` with an empty Commit cell. The heading, branch line, header and Backlog are untouched.
- Refactor-log **Verified**: each T809 to T814 part is the ledger Gate cell copied verbatim (checked programmatically).
  - The review-round claim matches the review files: T809 to T812 approved in round 1; T813 and T814 approved in round 2.
  - Surprises (a) to (f) each match their source: T810 spec Amendment 1, T811 review `:22`, T813 review `:23`/`:68` and `:32`, T814 review `:82`, T809 review `:53`.
  - Deliberately not done matches the code: `confirmDelete` has no try/finally (`TransactionsTable.tsx:84-99`); the `p-0` cell vs `px-4` (`:46`, `:143`); `requestAnimationFrame` at `TransactionsView.tsx:380`, `:487` and `TransactionsTable.tsx:98`; the duplicated JSDoc at `DiaryView.tsx:18-19`; `new Map()` at `TransactionsView.tsx:420`.
- Unit file claims: `git diff --name-status 27a6e5f..HEAD -- unit` gives 3 added files (`tx-view-preference`, `tx-calendar`, `transactions-bulk`) and the 10 modified files the docs name.
- Baseline deltas re-computed against the Phase 148 section (`baseline-metrics.md:34-42`): +3,607 / +993, +24,603 / +6,576, +1,610 / +269. Tests: +88 and +3 files; Playwright: +26 tests, +1 spec, +78 runs.
- Line endings:
  - The six CRLF files have bareLF 0, and `git ls-files --eol` shows them as `w/crlf`.
  - ADR 0109 has crlf 0 (109 LF lines) and shows `i/lf w/lf`, the same as at HEAD (crlf 0, 80 lines), as the spec requires.
  - The git warning "LF will be replaced by CRLF the next time Git touches it" comes from `core.autocrlf=true` on an LF working file. The index stays LF, so the commit is unaffected; at HEAD the file was already in the same `w/lf` state.
- Em dashes: 0 in the added lines of `git diff -U0 HEAD`, and 0 in all seven files, the spec and the build report.

### 4. Gates run

| # | Command | Result |
|---|---|---|
| 4 | `netstat -ano \| grep -E ":(3000\|3100) .*LISTENING"` | no output, before and after the e2e run |
| 1 | `npm run test:unit` | Test Files 72 passed (72), Tests 1598 passed (1598), 0 failed, 0 skipped, 55.27 s. Log: `workflow/stages/03_review/output/logs/T815-unit.log` |
| 2 | `npx playwright test --list` / `--project=chromium` | `Total: 639 tests in 37 files` / `Total: 213 tests in 37 files`; `ls tests/*.spec.ts` 37; unit test files 72 |
| 3 | `rm -rf dist && npm run build` + gzip-9 script, then `rm -rf dist` | exit 0. Entry `index-achQGTXo.js` 198233 B / 57974 B gzip; `index-BNwLrid8.css` 54969 / 10720; `TransactionsView-FspLBvoz.js` 55405 / 16616; allJS 910934 / 275852 over 39 files. All identical to the docs. `dist/` did not exist before and was removed |
| 5 | `npx playwright test` | 633 passed, 6 skipped, 0 failed (no `✘` lines), 639 runs, 13.3 m, exit 0. Log: `workflow/stages/03_review/output/logs/T815-e2e.log`. The builder's log tail shows 633 passed, 6 skipped (12.0m), which matches the 12.0 min the docs record |
| 6 | stale-count `git grep` | no output (exit 1) |
| 7 | line counts | task-ledger 206, refactor-log 172, baseline-metrics 203, matching the counts written in Deliberately not done |
| 8, 9 | line endings | see section 3 |
| 10 | sha per task | all six match |
| 11 | placeholders | `<gate cell` count 0; no `<U>`/`<P>`/`<S>`/`<M>`/`<L>`/`<R>`/`<B>` left. The literal `docs \`<sha>\``/`merged \`<sha>\`` stay, as the spec requires |
| 12, 13 | em dashes | 0, 0 |
| 14 | `git diff --stat`; `git status --porcelain` | see section 3 |

### 5. Not verified

- The builder's unit time of 60.32 s is recorded as theirs; my run took 55.27 s. The builder's log does exist with matching e2e totals.
- The pending live apply of the T812 migration is the owner's step. Per the spec, this task only records it.
- I did not view `docs/audit/README.md`'s ~150-line threshold wording beyond what the spec cites.

### 6. Blocking

None.

### 7. Non-blocking

- `docs/audit/task-ledger.md:147-152`: the six new Commit cells are wrapped in backticks (`` `a2634f1` ``), but all 41 earlier filled Commit cells in the ledger are bare shas (for example T808 `ef434cd`). The spec's backticks were Markdown formatting. The orchestrator or the deploy record may strip them for consistency; the hashes themselves are correct.

### 8. Rule candidates

- None new. The spec's "`<sha>` in backticks" convention for spec text versus literal cell content could be stated in `workflow/stages/01_spec/CONTEXT.md` (write literal cell text in a fenced block) to avoid the backtick ambiguity above.
