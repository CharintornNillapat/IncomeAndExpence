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
| T756 | Move the transfer panel's uppercase From/To label from `text-[10px]` to `text-xs` (DESIGN.md's section-label size) | `src/components/wallet/WalletTransferForm.tsx`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` | done | | `npm run lint` clean; unit 1375/1375 (69.9s); e2e 39/39 in 1.2m (Chromium, Firefox, WebKit); build clean; bash checks 5/5, 0 text-[10px] in WalletTransferForm, 0 em dashes |

## Backlog

Not scheduled. Each row says where it came from.

| Item | Source | Status |
|---|---|---|
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
| Specs check line endings with `git ls-files --eol <file>` (the `w/crlf` column) or a Node count of `\r\n`, never `grep -c $'\r' <file>`: in the agents' Git Bash it printed 0 on CRLF files (`AGENTS.md`, `docs/audit/task-ledger.md`), while the same command inside `$(...)` counted correctly | Phase 128, T754's review (rule candidate); reproduced in T755's spec | todo: add to `workflow/stages/01_spec/CONTEXT.md` once a spec uses it |

## Template for the next phase

```
## Phase NNN - <title>

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T7xx | <one line> | <paths> | todo | | |
```

Keep this file under about 150 lines. When it grows past that, move finished phases to a new `archive/task-ledger-phases-125-NNN.md`.
