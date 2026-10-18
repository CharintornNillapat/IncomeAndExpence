# Task ledger

Every task edits this file; only the task that ships a phase also writes `refactor-log.md` and `baseline-metrics.md`. Flip `Status` to `in-progress` when a task starts and fill `Gate result` when it lands. Leave `Commit` empty: the owner-approved deploy record fills every task's `Commit` cell once per phase, after the merge.

Status values: `todo`, `in-progress`, `done`, `dropped` (with a one-line reason).

**Phases 1 to 124 (tasks T1 to T741)** are in `archive/task-ledger-phases-001-124.md`, and **Phases 125 to 135 (tasks T742 to T767)** in `archive/task-ledger-phases-125-135.md`. Those files are history: read them only when the user asks for historical research. The live rows start at **T768**; a new task takes the next number after the highest id here.

## Phase 136 - Form labels: htmlFor on every field and a name for the CSV row category (accessibility, no ADR)

Branch `phase-136-form-labels`, cut from `main` at `779db69`. One commit, T768's `df57e06`, merged into `main` as `753e4f4` (PR #88). No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T768 | Link every form label to its control via htmlFor, and name the CSV row category select (UI-02, UI-03, UI-04, UI-05) | `src/components/AuthModal.tsx`, `src/components/wallet/AddWalletForm.tsx`, `src/components/account/AccountModal.tsx`, `src/components/transaction/ImportCsvModal.tsx`, `unit/auth-password.test.tsx`, `unit/authenticated-ledger.test.tsx`, `unit/wallets-page.test.tsx`, `unit/csv-import-categories.test.tsx`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` | done | df57e06 | Red gate verified (4 unit failed); npm run lint clean; related unit 4/4 files 152 passed; unit 62/62 files 1436 passed (48.79s); e2e 8 specs on chr 51 passed, 153 passed on 3 browsers (3.4m); prod build clean (193,335 B entry); CRLF kept; 0 em dashes |

## Phase 137 - Small fixes: four low UI findings and the hero size (no ADR)

Branch `phase-137-small-fixes`, cut from `main` at `1d286e5`. Six commits, T769's `9ca857f` to T774's `364e41d`, merged into `main` as `0a0f87d` (PR #89). No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T769 | Close UI-01, UI-06, UI-07, UI-08 and size the Left over figure with a `--text-hero` token (44px) | `src/components/InlineMathInput.tsx`, `src/components/ui/motion.tsx`, `src/components/diary/RecentEntries.tsx`, `src/components/dashboard/LeftOverCard.tsx`, `src/index.css`, `unit/dashboard.test.tsx`, `unit/inline-math-seed.test.tsx`, `DESIGN.md`, `docs/audit/test-selector-contract.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` | done | 9ca857f | Red gate verified (2 unit failed); npm run lint clean; related unit 4/4 files 106 passed; unit 62/62 files 1438 passed (50.99s); e2e 5 specs on chr 32 passed, 96 passed on 3 browsers (2.2m); prod build clean (193,335 B entry); CRLF kept; 0 em dashes |
| T770 | Current test counts in AGENTS.md and README.md (1438), and T767 note 1 (dashboard test 9) | `AGENTS.md`, `README.md`, `unit/dashboard.test.tsx`, `docs/audit/refactor-log.md` | done | faa2e62 | Red gate verified (test 9 length 0 failed); npm run lint clean; unit/dashboard.test.tsx 49 passed; unit 62/62 files 1438 passed (52.65s); docs count check passed (1438 unit, 537 e2e, 0 stale 1432); CRLF kept; 0 em dashes |
| T771 | Archive the Phase 125 to 135 ledger rows; rewrite the four T769 Backlog rows with code names; drop a trailing blank line | `docs/audit/archive/task-ledger-phases-125-135.md`, `docs/audit/task-ledger.md`, `docs/audit/README.md`, `docs/audit/refactor-log.md`, `unit/inline-math-seed.test.tsx` | done | ef16324 | Docs checks passed (ledger lines 69, archive byte match, 0 Phase 125-135, Backlog rows clean); trailing newline dropped (1 deletion); npm run lint clean; unit/inline-math-seed.test.tsx 32 passed; unit 62/62 files 1438 passed (86.30s); CRLF kept; 0 em dashes |
| T772 | Stage-file rules from the T767, T770 and T771 reviews (refactor-log source, test-only red run, stash rules, em-dash check) | `workflow/stages/01_spec/CONTEXT.md`, `workflow/stages/02_build/CONTEXT.md`, `workflow/stages/03_review/CONTEXT.md`, `docs/audit/refactor-log.md` | done | 4c932d7 | Commands verified (node added-lines 0, whole-file 0/0/0, grep exit 2); paths exist; rerun verified all 7 edits landed once from spec code blocks (edit 2 quote deleted, edit 4 outputs path); diff size clean (2/1, 3/1, 4/4, 4/4, 1/0); CRLF kept (0 bare LF); 0 em dashes in diff and build report; scope clean |
| T773 | Archive the Phase 125 to 135 refactor-log entries; Backlog row for the text-landed gate rule | `docs/audit/archive/refactor-log-phases-125-135.md`, `docs/audit/refactor-log.md`, `docs/audit/README.md`, `docs/audit/task-ledger.md` | done | 15b24b8 | Docs checks passed (log lines 40, archive byte match, 0 Phase 125-135, 2 Phase 136-137, no trailing ---); Phase 137 entry updated (T769-T773, stale sentence gone); pointers resolve; Backlog row added (ledger lines 71); CRLF kept (archive 172/0); 0 em dashes in diff, archive and build report; scope clean |
| T774 | Whole-pixel line height for the Hero token (CI safe-area failure from T769); Backlog row for running the layout specs on token changes | `src/index.css`, `unit/dashboard.test.tsx`, `DESIGN.md`, `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md` | done | 364e41d | Cause confirmed (safe-area 745.390625 with token, 2 passed without); Red gate verified (unit failed on 1.1); npm run lint clean; unit/dashboard.test.tsx 49 passed; unit 62/62 files 1438 passed (47.89s); e2e chr 3 specs 19 passed (16.1s); e2e 3 browsers 51 passed, 6 skipped (59.5s); docs count check passed (1438); line height 48px verified; CRLF kept; 0 em dashes; scope clean |

## Backlog

Not scheduled. Each row says where it came from.

| Item | Source | Status |
|---|---|---|
| DESIGN.md's Hero number is 44px, but the code sets it with `text-4xl` (36px): `LeftOverCard.tsx` (the net worth figure is a card figure since T767). A `--text-hero` token would close it | Phase 135, T765's spec | done in Phase 137 (T769) |
| `InlineMathInput.tsx:136`'s frame uses `transition-all` | Audit 2026-10-16 (T759), finding UI-01, low; `src/components/InlineMathInput.tsx:136` | done in Phase 137 (T769) |
| `docs/audit/test-selector-contract.md` omits the two transfer balance test ids | Audit 2026-10-16 (T759), finding UI-06, low; `docs/audit/test-selector-contract.md:52` | done in Phase 137 (T769) |
| `motion.tsx:14`'s `prefersReducedMotion` is a dead export | Audit 2026-10-16 (T759), finding UI-07, low; `src/components/ui/motion.tsx:14` | done in Phase 137 (T769) |
| `RecentEntries.tsx:9`'s `RECENT_STEP` is a dead export | Audit 2026-10-16 (T759), finding UI-08, low; `src/components/diary/RecentEntries.tsx:9` | done in Phase 137 (T769) |
| Every interactive element added to a view carries an `id` following `<view>-<thing>-<kind>` | `archive/constraints-to-promote.md` row T12. `AuthModal.tsx` complies; never verified repo-wide | todo: verify across views before it can become a rule |
| `QuickAddModal.tsx:101` labels its template list `text-[11px] ... uppercase tracking-wide`, below `DESIGN.md`'s 12 to 13px label size and off the `tracking-wider` used elsewhere | Context audit, 2026-10-15. `TransactionForm.tsx:709`, `:848` and `:871` also use `tracking-wide` on uppercase labels | done in Phase 127 (T753) |
| `WalletTransferForm.tsx:101`'s uppercase label is `text-[10px]`, below `DESIGN.md`'s 12 to 13px (its tracking is already `tracking-wider`) | Phase 127, T753's spec | done in Phase 129 (T756) |
| Four code comments point into `docs/audit/archive/`: `src/components/transaction/txTypeMeta.ts:21` (`ui-ux-audit-report.md`), `src/components/ui/OverflowMenu.tsx:44` (a reason now in the archived selector log), `src/components/ui/Card.tsx:28` and `tests/categories.spec.ts:9` (refactor-log Phases 25 and 30) | Phase 125 (ADR `0101`); code was out of scope | done in Phase 126 (T752) |
| `src/components/ui/Card.tsx:23`'s doc comment says the shell is `rounded-xl`, while the code uses `rounded-card` | Phase 126, T752's review; outside T752's scope | done in Phase 127 (T753) |
| ESLint with `react-hooks/exhaustive-deps` | `archive/constraints-to-promote.md` follow-on proposals | todo |
| Vitest for `smartMatcher.ts`, `mathEvaluator.ts`, `csvExchange.ts` | same | done since Phase 49 (ADR `0021`) |
| `tsconfig.json` `strict` | same | done since Phase 101 (ADR `0077`) |
| React Compiler (auto-memoization; needs a Babel plugin and its own evaluation) | same | todo |
| `rollup-plugin-visualizer` for bundle-size visibility | same | todo |
| Specs check line endings with `git ls-files --eol <file>` (the `w/crlf` column) or a Node count of `\r\n`, never `grep -c $'\r' <file>`: in the agents' Git Bash it printed 0 on CRLF files (`AGENTS.md`, `docs/audit/task-ledger.md`), while the same command inside `$(...)` counted correctly | Phase 128, T754's review (rule candidate); reproduced in T755's spec | done in Phase 130 (T757) |
| addTransaction omits unknown-outcome cloud refresh on transfer_funds failures | Audit 2026-10-16 (T759), finding SL-02, high; `src/context/FinanceContext.tsx:1848-1853` | done in Phase 132 (T760) |
| transfer_funds breaks replay on soft-deleted transactions and throws unique_violation | Audit 2026-10-16 (T759), finding SL-01, medium; `supabase/migrations/20261006_phase93_transfer_funds_from_session.sql:80-86` | todo |
| Form inputs in AuthModal lack programmatic label association via htmlFor | Audit 2026-10-16 (T759), finding UI-02, medium; `src/components/AuthModal.tsx:182` | done in Phase 136 (T768) |
| Form inputs in AddWalletForm lack programmatic label association via htmlFor | Audit 2026-10-16 (T759), finding UI-03, medium; `src/components/wallet/AddWalletForm.tsx:95` | done in Phase 136 (T768) |
| Profile and password fields in AccountModal lack programmatic label association via htmlFor | Audit 2026-10-16 (T759), finding UI-04, medium; `src/components/account/AccountModal.tsx:611` | done in Phase 136 (T768) |
| Category selector in CSV import preview table lacks accessible name | Audit 2026-10-16 (T759), finding UI-05, medium; `src/components/transaction/ImportCsvModal.tsx:547-552` | done in Phase 136 (T768) |
| AddWalletForm's `Currency` and `Color` `<label>`s name no labelable control (a read-only `div` and a swatch button group); make them a `span` or a `role="group"` with `aria-labelledby` | Phase 136, T768's spec | todo |
| setTransactionDeleted has no cloudRevisionAtStart check, so a failed delete or restore restores its pre-call snapshot even when a cloud reload landed mid-flight, unlike addTransaction and updateTransaction | Phase 132, T760's spec (owner decision); `src/context/FinanceContext.tsx:2190-2197`, compare `:1959` and `:2302` | todo |
| A gate that checks text landed reads the expected text from the spec's code blocks with a script, never retyped; rule candidate for `workflow/stages/02_build/CONTEXT.md` | Phase 137, T772's review (section 8): gate 3 passed on the builder's side while edit 2 differed by one character, so the expected string was not the spec's | todo |
| Any change to a typography or spacing token (`src/index.css` `@theme` sizes, line heights, spacing) runs the layout specs (`tests/safe-area.spec.ts`, `tests/layout-stability.spec.ts`), not only the specs that name the component; rule candidate for `AGENTS.md`'s tier row for `src/index.css`, and for `docs/contexts/ui-and-e2e.md` | Phase 137, T774: T769's `--text-hero` line height of 1.1 (48.4px) passed its gates and failed `safe-area.spec.ts` in CI | todo |

## Template for the next phase

```
## Phase NNN - <title>

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T7xx | <one line> | <paths> | todo | | |
```

Keep this file under about 150 lines. When it grows past that, move finished phases to a new `archive/task-ledger-phases-136-NNN.md`.
