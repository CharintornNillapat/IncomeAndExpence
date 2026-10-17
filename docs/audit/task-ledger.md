# Task ledger

Every task edits this file; only the task that ships a phase also writes `refactor-log.md` and `baseline-metrics.md`. Flip `Status` to `in-progress` when a task starts and fill `Gate result` when it lands. Leave `Commit` empty: the owner-approved deploy record fills every task's `Commit` cell once per phase, after the merge.

Status values: `todo`, `in-progress`, `done`, `dropped` (with a one-line reason).

**Phases 1 to 124 (tasks T1 to T741)** are in `archive/task-ledger-phases-001-124.md`. That file is history: read it only when the user asks for historical research. Task ids continue from **T742**.

## Phase 125 - ICM bootstrap: hierarchical context, the archive, herdr stages (docs only, ADR `0101`)

Branch `phase-125-icm-bootstrap`, cut from `main` at `75d2171`. The archive renames are one commit (`7bed3d7`), the docs are `ca1440f`, the hash backfill `7dfe6c2`, and the readiness gaps `53794ca`; merged into `main` as `3124756` (PR #76). No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T742 | Clean the root: ignore `.antigravity/`, archive the Antigravity audits, delete the stale local `HANDOFF.md` | `.gitignore`, `docs/audit/archive/` | done | ca1440f | n/a (docs) |
| T743 | Archive the task ledger and refactor log for Phases 1 to 124; start compact ones | `docs/audit/` | done | 7bed3d7, ca1440f | n/a (docs) |
| T744 | Fix doc drift in `README.md` and the config comments | `README.md`, `vitest.config.ts`, `playwright.config.ts` | done | ca1440f | `npm run lint` clean; Playwright lists 492 in 34 files; Vitest collects 62 files |
| T745 | Split `CLAUDE.md` into `AGENTS.md` and `docs/contexts/*.md`; archive the monolith | `CLAUDE.md`, `AGENTS.md`, `docs/contexts/` | done | ca1440f | every named path and symbol resolves (scripted check) |
| T746 | Archive the frozen audit files, the metrics and the selector log; new short metrics and selector contract; routing and pointer fixes | `docs/audit/`, `AGENTS.md`, `CLAUDE.md`, `DESIGN.md`, `README.md`, `docs/contexts/ui-and-e2e.md` | done | 7bed3d7, ca1440f | `npm run lint` clean |
| T747 | The herdr stages: `workflow/stages/{01_spec,02_build,03_review}/CONTEXT.md` and their `output/` folders | `workflow/stages/` | done | ca1440f | n/a (docs) |
| T748 | ADR `0101`; the ICM workflow section in `AGENTS.md`; the phase-branch rule | `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`, `AGENTS.md` | done | ca1440f | `npm run lint` clean |
| T749 | Phase 125 bookkeeping: refactor-log entry, baseline-metrics section, the commits and hash backfill | `docs/audit/` | done | ca1440f | n/a (docs) |
| T750 | Close the ICM readiness gaps (G3, G4, G5, G7, G9, G10, G11; C1 to C8): STATUS lines with the task id, who writes what, commits and the deploy-record exception, phase from the branch, new gate tiers, routing, tests `none`, the reviewer's stash check, gitignored logs; Claude Code permission rules | `AGENTS.md`, `workflow/stages/*/CONTEXT.md`, ADR `0101`, `docs/audit/README.md`, `.gitignore`, `.claude/settings.json`, `docs/audit/` | done | 53794ca | `npm run lint` clean; settings valid against the Claude Code schema |

## Phase 126 - ICM tune-up: settle the readiness-2 gaps (docs and code comments only, amends ADR `0101`)

Branch `phase-126-icm-tuneup`, cut from `main` at `7e24554`. Two commits: T751's docs `86d0849` (`[skip ci]`) and T752's comments `5bc45f5`; merged into `main` as `3f301ab` (PR #77). No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T751 | Settle the readiness-2 gaps (D1 to D4, M1 to M3, M6, the C3 leftover): before-done scope, who cuts the phase branch, doc-only phase paperwork, `Commit` filled by the deploy record, order forms, the id from the order, the builder's BLOCKED reason, no reviewer sub-agents; ADR `0101` amendments | `AGENTS.md`, `workflow/stages/*/CONTEXT.md`, `docs/audit/README.md`, `docs/audit/task-ledger.md`, ADR `0101`, `docs/audit/refactor-log.md` | done | 86d0849 | `npm run lint` clean |
| T752 | Point five archived comment references at live docs (ADR `0006`, `0039`, `docs/contexts/ui-and-e2e.md`); drop the stale framer-motion mention | `src/components/transaction/txTypeMeta.ts`, `src/components/ui/Card.tsx`, `src/components/ui/OverflowMenu.tsx`, `tests/categories.spec.ts`, `docs/audit/refactor-log.md` | done | 5bc45f5 | `npm run lint` clean; diff confirmed comments only; 0 archived pointers; zero em dashes |

## Phase 127 - Section label tracking (UI classes and one comment, no ADR)

Branch `phase-127-label-tracking`, cut from `main` at `0e9c94c`. One commit, `cc32233`; merged into `main` as `9323826` (PR #78). No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T753 | Bring four uppercase labels onto DESIGN.md's section-label rule (`text-xs`, `tracking-wider`); fix Card.tsx's stale `rounded-xl` comment | `src/components/QuickAddModal.tsx`, `src/components/TransactionForm.tsx`, `src/components/ui/Card.tsx`, `DESIGN.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` | done | cc32233 | `npm run lint` clean; unit 1375/1375 (75.3s); e2e 51/51 in 1.5m (Chromium, Firefox, WebKit); build clean; bash checks 5/5, 0 tracking-wide in src, 0 em dashes |

## Phase 128 - Workflow automation: per-task build reports, short orders, automatic pause and commit, a line-ending Backlog row (docs and agent settings only, amends ADR `0101`)

Branch `phase-128-workflow-automation`, cut from `main` at `88cc32b`. Two commits: T754's `a757938`, merged into `main` as `9c62173` (PR #79); T755's `694f0cc`, committed after that merge and merged as `967b049` (PR #80). No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T754 | Per-task build reports, short spec orders, the automatic pause after the spec, the automatic commit of each approved task; drop the prefixed commit ask rule; ADR `0101` amendments | `AGENTS.md`, `workflow/stages/*/CONTEXT.md`, ADR `0101`, `.claude/settings.json`, `docs/audit/refactor-log.md` | done | a757938 | G1-G7 passed: schema valid, 0 stale refs, zero em dashes, scope clean |
| T755 | Backlog row: check line endings with `git ls-files --eol` or Node, not `grep -c` (T754's rule candidate) | `docs/audit/task-ledger.md` | done | 694f0cc | G1-G6 passed: paths exist, 2 added lines, row in place, CRLF 79, zero em dashes, scope clean |

## Phase 129 - Wallet transfer label size (one UI class, no ADR)

Branch `phase-129-wallet-label`, cut from `main` at `0bdfbe6`. No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T756 | Move the transfer panel's uppercase From/To label from `text-[10px]` to `text-xs` (DESIGN.md's section-label size) | `src/components/wallet/WalletTransferForm.tsx`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` | done | 613b26c | `npm run lint` clean; unit 1375/1375 (69.9s); e2e 39/39 in 1.2m (Chromium, Firefox, WebKit); build clean; bash checks 6/6, 0 text-[10px] in WalletTransferForm, 0 em dashes |

## Phase 130 - Line-ending rule and commit prompts (docs and agent settings only, amends ADR `0101`)

Branch `phase-130-eol-check`, cut from `main` at `706e335`. Two commits, T757's `f2045f0` and T758's `f4926c4`, merged into `main` as `5e34257` (PR #82). No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T757 | Promote the line-ending Backlog row into stage 01's Rules: check with `git ls-files --eol` or Node, never `grep -c` | `workflow/stages/01_spec/CONTEXT.md`, `docs/audit/refactor-log.md` | done | f2045f0 | G1-G7 passed: paths exist, diff 1/0, 11/0, 9/1, CRLF kept, rule at :50, ledger updated, 0 em dashes, scope clean |
| T758 | Drop the bare `git commit` ask rules (Bash and PowerShell) so the orchestrator's automatic commit stops asking; ADR `0101` amendment | `.claude/settings.json`, ADR `0101`, `docs/audit/refactor-log.md` | done | f4926c4 | G1-G8 passed: paths exist, settings diff 0/2, deny 91 ask 11 OK, schema valid, CRLF kept, markdown diffs 5/1, 6/6, 2/1, 0 em dashes, scope clean |

## Phase 131 - Whole-app audit (docs only, no ADR)

Branch `phase-131-project-audit`, cut from `main` at `cb9e109`. One commit, T759's `c568376`, merged into `main` as `0792b88` (PR #83). No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T759 | Read-only whole-app audit by four domain sub-agents; high and medium findings to the Backlog | `docs/audit/audit-2026-10-16.md`, `docs/audit/README.md`, `docs/audit/refactor-log.md` | done | c568376 | G1-G7 passed: scope clean, citations and Backlog rows valid, counts match, skip list clean, 0 em dashes, CRLF kept, no code changed |

## Phase 132 - Transfer unknown outcome re-reads the cloud (client error handling, no ADR)

Branch `phase-132-transfer-unknown-outcome`, cut from `main` at `67e6bef`. One commit, T760's `1530008`, merged into `main` as `4fb77dd` (PR #84). No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T760 | A transfer with an unknown outcome re-reads the cloud (SL-02) | `src/context/FinanceContext.tsx`, `unit/authenticated-ledger.test.tsx`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` | done | 1530008 | Red gate verified; npm run lint clean; unit 62/62 files 1378 passed; e2e 11/11 chr 33/33 all passed; build clean (55,810 B gzip); CRLF kept; 0 em dashes |

## Phase 133 - Dashboard redesign docs: the owner spec, ADR 0102, DESIGN.md and routing (docs only)

Branch `phase-133-dashboard-redesign-docs`, cut from `main` at `3aeca33`. One commit, T761's `41a1bfb`, merged into `main` as `5fe4ffe` (PR #85). No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T761 | Dashboard redesign DOC-1: owner spec, ADR 0102, DESIGN.md, routing | `docs/design/dashboard-2026-10/spec.md`, `docs/design/dashboard-2026-10/dashboard-2026-10.dc.html`, `docs/audit/decisions/0102-dashboard-redesign-2026-10.md`, `DESIGN.md`, `AGENTS.md`, `docs/audit/refactor-log.md` | done | 41a1bfb | Docs-only gates passed: mock unchanged, spec 4 lines, scope clean, DESIGN.md/AGENTS.md valid, names resolve, CRLF/LF verified, 0 em dashes |

## Phase 134 - Dashboard selectors: left over, daily spending series, month-to-date comparison (money path, ADR 0102)

Branch `phase-134-dashboard-selectors`, cut from `main` at `3927c83`. Three commits, T762's `e6fb160`, T763's `30da09d` and T764's `3187e10`, merged into `main` as `35c7967` (PR #86). No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T762 | Dashboard redesign SEL-1: the Left over selector (owner spec 5.1) | `src/selectors/ledger.ts`, `unit/selectors-dashboard.test.ts` | done | e6fb160 | Red gate verified; npm run lint clean; unit 62/62 files 1386 passed (50.6s); related unit 3/3 files 65 passed; CRLF kept; 0 em dashes |
| T763 | Dashboard redesign SEL-2: the daily spending series (owner spec 5.2); WEEK 8 points (owner decision) | `src/selectors/diary.ts`, `unit/selectors-dashboard.test.ts`, `docs/design/dashboard-2026-10/spec.md` | done | 30da09d | Red gate verified; npm run lint clean; unit 62/62 files 1395 passed (50.6s); related unit 4/4 files 91 passed; spec.md 1 line updated; CRLF kept; 0 em dashes |
| T764 | Dashboard redesign SEL-3: the month-to-date comparison (owner spec 5.3); T763 test tightened; Phase 134 paperwork | `src/selectors/ledger.ts`, `unit/selectors-dashboard.test.ts`, `docs/contexts/client-state.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` | done | 3187e10 | Red gate verified; npm run lint clean; unit 62/62 files 1404 passed (49.85s); related unit 4/4 files 100 passed; prod build clean (0 bundle delta); CRLF kept; 0 em dashes |

## Phase 135 - Dashboard UI: the redesigned page (ADR 0102)

Branch `phase-135-dashboard-ui`, cut from `main` at `ce9983f`. Three commits, T765's `3f7b3e8`, T766's `662c528` and T767's `7f7c82a`, merged into `main` as `bdfc500` (PR #87). No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T765 | Dashboard redesign UI-1: page header and row 1 (owner spec 3, 4.1 to 4.2) | `src/components/dashboard/LeftOverCard.tsx`, `src/components/dashboard/CashFlowCard.tsx`, `src/views/DashboardView.tsx`, `unit/dashboard.test.tsx`, `tests/dashboard.spec.ts`, `DESIGN.md`, `docs/audit/test-selector-contract.md` | done | 3f7b3e8 | Red gate verified; npm run lint clean; related unit 4/4 files 75 passed; unit 62/62 files 1415 passed; e2e 20/20 chr, 58 passed 2 skipped on 3 browsers; wcag-tokens clean; CRLF kept; 0 em dashes |
| T766 | Dashboard redesign UI-2: row 2, spending by category with the month line, and debt payoff (owner spec 4.3) | `src/components/dashboard/CategorySpendingCard.tsx`, `src/components/dashboard/DebtPayoffCard.tsx`, `src/views/DashboardView.tsx`, `unit/dashboard.test.tsx`, `tests/dashboard.spec.ts`, `DESIGN.md`, `docs/audit/test-selector-contract.md` | done | 662c528 | Red gate verified; npm run lint clean; related unit 4/4 files 86 passed; unit 62/62 files 1426 passed; e2e 21/21 chr, 61 passed 2 skipped on 3 browsers; wcag-tokens clean; CRLF kept; 0 em dashes |
| T767 | Dashboard redesign UI-3: row 3, net worth and wallets merged, mood strip, insights last; T766 notes; Phase 135 paperwork (owner spec 4.4 to 4.5) | `src/components/dashboard/WalletsSection.tsx`, `src/components/dashboard/NetWorthCard.tsx` (deleted), `src/components/dashboard/MoodSpendingCard.tsx`, `src/components/dashboard/RecentActivityCard.tsx`, `src/components/dashboard/CategorySpendingCard.tsx`, `src/views/DashboardView.tsx`, `src/components/ViewLoadingFallback.tsx`, `src/components/ui/AllocationBar.tsx`, `unit/dashboard.test.tsx`, `tests/dashboard.spec.ts`, `DESIGN.md`, `docs/design/dashboard-2026-10/spec.md`, `docs/audit/test-selector-contract.md`, `AGENTS.md`, `docs/contexts/ui-and-e2e.md`, `README.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` | done | 7f7c82a | Red gate verified (8 unit, 4 e2e failed); npm run lint clean; related unit 5/5 files 116 passed; unit 62/62 files 1432 passed (44.88s); Vitest shuffle 1432 passed (seed 1792225420210); e2e 71/71 chr, 207 passed 6 skipped on 3 browsers; full e2e 531 passed 6 skipped on 3 browsers (9.9m); prod build clean (193,252 B entry); wcag-tokens clean; ViewLoadingFallback w/lf kept, others w/crlf; 0 em dashes; 0 NetWorthCard refs |

## Phase 136 - Form labels: htmlFor on every field and a name for the CSV row category (accessibility, no ADR)

Branch `phase-136-form-labels`, cut from `main` at `779db69`. One commit, T768's `df57e06`, merged into `main` as `753e4f4` (PR #88). No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T768 | Link every form label to its control via htmlFor, and name the CSV row category select (UI-02, UI-03, UI-04, UI-05) | `src/components/AuthModal.tsx`, `src/components/wallet/AddWalletForm.tsx`, `src/components/account/AccountModal.tsx`, `src/components/transaction/ImportCsvModal.tsx`, `unit/auth-password.test.tsx`, `unit/authenticated-ledger.test.tsx`, `unit/wallets-page.test.tsx`, `unit/csv-import-categories.test.tsx`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` | done | df57e06 | Red gate verified (4 unit failed); npm run lint clean; related unit 4/4 files 152 passed; unit 62/62 files 1436 passed (48.79s); e2e 8 specs on chr 51 passed, 153 passed on 3 browsers (3.4m); prod build clean (193,335 B entry); CRLF kept; 0 em dashes |

## Phase 137 - Small fixes: four low UI findings and the hero size (no ADR)

Branch `phase-137-small-fixes`, cut from `main` at `1d286e5`. No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T769 | Close UI-01, UI-06, UI-07, UI-08 and size the Left over figure with a `--text-hero` token (44px) | `src/components/InlineMathInput.tsx`, `src/components/ui/motion.tsx`, `src/components/diary/RecentEntries.tsx`, `src/components/dashboard/LeftOverCard.tsx`, `src/index.css`, `unit/dashboard.test.tsx`, `unit/inline-math-seed.test.tsx`, `DESIGN.md`, `docs/audit/test-selector-contract.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` | done | | Red gate verified (2 unit failed); npm run lint clean; related unit 4/4 files 106 passed; unit 62/62 files 1438 passed (50.99s); e2e 5 specs on chr 32 passed, 96 passed on 3 browsers (2.2m); prod build clean (193,335 B entry); CRLF kept; 0 em dashes |

## Backlog

Not scheduled. Each row says where it came from.

| Item | Source | Status |
|---|---|---|
| DESIGN.md's Hero number is 44px, but the code sets it with `text-4xl` (36px): `LeftOverCard.tsx` (the net worth figure is a card figure since T767). A `--text-hero` token would close it | Phase 135, T765's spec | done in Phase 137 (T769) |
| InlineMathInput.tsx:136 frame uses transition-all | Audit 2026-10-16 (T759), finding UI-01, low; `src/components/InlineMathInput.tsx:136` | done in Phase 137 (T769) |
| Selector contract omits the two transfer balance test ids | Audit 2026-10-16 (T759), finding UI-06, low; `docs/audit/test-selector-contract.md:52` | done in Phase 137 (T769) |
| Dead export prefersReducedMotion | Audit 2026-10-16 (T759), finding UI-07, low; `src/components/ui/motion.tsx:14` | done in Phase 137 (T769) |
| Dead export RECENT_STEP | Audit 2026-10-16 (T759), finding UI-08, low; `src/components/diary/RecentEntries.tsx:9` | done in Phase 137 (T769) |
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

## Template for the next phase

```
## Phase NNN - <title>

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T7xx | <one line> | <paths> | todo | | |
```

Keep this file under about 150 lines. When it grows past that, move finished phases to a new `archive/task-ledger-phases-125-NNN.md`.
