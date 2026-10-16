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

## Phase 126 - ICM tune-up: settle the readiness-2 gaps (docs only, amends ADR `0101`)

Branch `phase-126-icm-tuneup`, cut from `main` at `7e24554`. One docs commit. No migration.

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T751 | Settle the readiness-2 gaps (D1 to D4, M1 to M3, M6, the C3 leftover): before-done scope, who cuts the phase branch, doc-only phase paperwork, `Commit` filled by the deploy record, order forms, the id from the order, the builder's BLOCKED reason, no reviewer sub-agents; ADR `0101` amendments | `AGENTS.md`, `workflow/stages/*/CONTEXT.md`, `docs/audit/README.md`, `docs/audit/task-ledger.md`, ADR `0101`, `docs/audit/refactor-log.md` | done | | `npm run lint` clean |

## Backlog

Not scheduled. Each row says where it came from.

| Item | Source | Status |
|---|---|---|
| Every interactive element added to a view carries an `id` following `<view>-<thing>-<kind>` | `archive/constraints-to-promote.md` row T12. `AuthModal.tsx` complies; never verified repo-wide | todo: verify across views before it can become a rule |
| `QuickAddModal.tsx:101` labels its template list `text-[11px] ... uppercase tracking-wide`, below `DESIGN.md`'s 12 to 13px label size and off the `tracking-wider` used elsewhere | Context audit, 2026-10-15. `TransactionForm.tsx:709`, `:848` and `:871` also use `tracking-wide` on uppercase labels | todo: code change, needs a UI phase |
| Four code comments point into `docs/audit/archive/`: `src/components/transaction/txTypeMeta.ts:21` (`ui-ux-audit-report.md`), `src/components/ui/OverflowMenu.tsx:44` (a reason now in the archived selector log), `src/components/ui/Card.tsx:28` and `tests/categories.spec.ts:9` (refactor-log Phases 25 and 30) | Phase 125 (ADR `0101`); code was out of scope | todo: reword each to cite its ADR, in a phase that may touch `src/` and `tests/` |
| ESLint with `react-hooks/exhaustive-deps` | `archive/constraints-to-promote.md` follow-on proposals | todo |
| Vitest for `smartMatcher.ts`, `mathEvaluator.ts`, `csvExchange.ts` | same | done since Phase 49 (ADR `0021`) |
| `tsconfig.json` `strict` | same | done since Phase 101 (ADR `0077`) |
| React Compiler (auto-memoization; needs a Babel plugin and its own evaluation) | same | todo |
| `rollup-plugin-visualizer` for bundle-size visibility | same | todo |

## Template for the next phase

```
## Phase NNN - <title>

| # | Task | Files | Status | Commit | Gate result |
|---|---|---|---|---|---|
| T7xx | <one line> | <paths> | todo | | |
```

Keep this file under about 150 lines. When it grows past that, move finished phases to a new `archive/task-ledger-phases-125-NNN.md`.
