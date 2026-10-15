# 0101: Hierarchical context, a quarantined archive, and herdr workflow stages

**Status:** Accepted. Built on branch `phase-125-icm-bootstrap`: renames `7bed3d7`, docs `ca1440f`, hash backfill to follow. Not yet merged. No code, test, config or schema change.
- **Supersedes** the single 175 KB `CLAUDE.md` as the agent contract (in force from the project's start to Phase 124). Its full text is kept as `docs/audit/archive/claude-monolith-v124.md`.
- **Moves** the audit's history out of the live `docs/audit/` set into `docs/audit/archive/`. Every move is a `git mv` with its content unchanged.

**Date:** 2026-10-15

## Context

1. **The owner is moving the repo to the Interpretable Context Methodology (ICM), orchestrated by herdr.** A Master orchestrator routes work between a reviewer (Claude Code) and a builder (agy, Gemini 3.8 Flash). The builder has a smaller budget, so what it must read has to be small and named.
2. **A read-only discovery pass** found the agent contract was one file, `CLAUDE.md`: 757 lines, 174.8 KB, loaded into every session in full. A task touching one area still loaded the other areas' rules.
3. **The live audit folder had become a second load:**
   - `task-ledger.md` (2,887 lines) and `refactor-log.md` (5,287 lines) were the files a phase edits;
   - `baseline-metrics.md` (168 KB) gains a column every phase;
   - `test-selector-contract.md` (371 lines) was an append-only log whose early rows called two ids "Unchanged" that later rows retired.
4. **A context audit** (written outside the repo, `../finlife-context-audit.md`, 2026-10-15) measured every rule and context file. It found:
   - six files nothing pointed to;
   - 26 code comments citing rules "in CLAUDE.md";
   - eight places where docs disagreed with each other or with the code.
5. **Doc drift had piled up:** the README said Node 22, listed two removed libraries, gave old test counts, and described the non-atomic fallback writes ADR `0091` removed. Two config comments gave 22 specs and 321 runs.

## Decision

### 1. Hierarchical context

- **`AGENTS.md` is the one rule file every agent reads.** It holds:
  - the project summary;
  - the Stop and ask first list;
  - the non-negotiables;
  - the cross-file parity map;
  - the tiered verification gates;
  - a routing table naming the one context file a task needs;
  - the ICM workflow pointer.
- **`CLAUDE.md` only imports it** (`@AGENTS.md`), plus one line: a code comment citing a rule "in CLAUDE.md" now means `AGENTS.md` or `docs/contexts/`.
- **`docs/contexts/`** holds the domain rules, rewritten from the monolith in imperative form, each rule naming its ADR:
  - `client-state.md`: state, money, entry, classification, import, unit harnesses;
  - `supabase-ledger.md`: schema, RPCs, migrations, auth and sessions;
  - `api-proxies.md`: functions, token and quota checks, headers and CSP;
  - `ui-and-e2e.md`: UI limits, modals, page contracts, Playwright, CI.
- **`workflow/stages/*/CONTEXT.md`** holds each ICM stage's own instructions (section 3).
- **`DESIGN.md` is the design authority, read for visual work only.** A logic-only component change needs `ui-and-e2e.md` alone. `docs/design/finlife-redesign-spec.md` is history, read only for a new redesign, and `docs/design/*.html` (a 2 MB bundled mockup) is never opened.
- **Stale facts were fixed on the way:**
  - the Supabase client has no fallback credentials;
  - `roundToCents` lives in `src/utils/money.ts:22`;
  - DESIGN.md's section-label tracking is `tracking-wider`, as the code has it, with the spec's 0.4px recorded under Deviations.

### 2. The archive

`docs/audit/archive/` is **never read unless the user asks for historical research**, and its files are never edited. It holds:

| Archived | Why |
|---|---|
| `task-ledger-phases-001-124.md`, `refactor-log-phases-001-124.md` | Phases 1 to 124 are history; the live ledger and log start at Phase 125 |
| `baseline-metrics-phases-000-124.md` | 168 KB a phase had to open to add one column; the live file keeps how to measure and the latest figures |
| `test-selector-log-phases-019-124.md` | A log, not a list; the live contract lists the ids the specs use today, grepped from `tests/*.spec.ts`, with the hazards still true |
| `claude-monolith-v124.md`, `claude-md-history.md` | The pre-split rule file and its release history |
| `audit-report.md`, `perf-audit-report.md`, `ui-ux-audit-report.md`, `implementation-roadmap.md`, `spec-acceptance-2026-10-02.md` | Frozen findings and plans; nothing in the rules pointed to them |
| `constraints-to-promote.md` | Its open rows moved to the ledger's Backlog; the spec-edit policy moved into `ui-and-e2e.md` |
| `AGY_AUDIT300926.md`, `SUGGESTS.md` | The Antigravity review of 2026-09-30, moved from the repo root |

`anti-slop/` stays where it is, since the antislop skill writes its audits there. The gitignored local `HANDOFF.md` (stale since 2026-09-21) was deleted, and `.antigravity/` is now ignored.

### 3. herdr roles and the three stages

- **Reviewer: Claude Code.** It writes specs (`spec <id>`, stage 01) and reviews (`review <id>`, stage 03), and never edits app code, tests or config.
- **Builder: agy.** It handles `build <id>` and `fix <id>` (stage 02). Its stage file begins by telling it to read `AGENTS.md`, because agy is not assumed to load it on its own. No `GEMINI.md` is created, so there is one rule file, not two.
- **Task ids continue the ledger's T-numbers.** The outputs are:
  - `01_spec/output/task-<id>-spec.md`;
  - `02_build/output/build-report.md`, overwritten per task, with a section appended per fix round;
  - `03_review/output/task-<id>-review.md`, a section per round, so earlier rounds' blocking items stay checkable.
- **Every reply ends with one STATUS line:**
  - reviewer: `SPEC DONE`, `APPROVED`, `CHANGES REQUESTED` or `BLOCKED`, with the output path;
  - builder: `BUILT`, `FIXED` or `BLOCKED`, with the count of files changed.
- **Scope is the spec's target-file allowlist.** The bookkeeping files are always allowed: `task-ledger.md`, `refactor-log.md`, `baseline-metrics.md` and the build output. The review treats any other unannounced file as blocking, runs the gates itself, and checks that each new test fails without the change.

### 4. Phase branches

All ICM work happens on a branch `phase-NNN-<slug>` cut from `main`. Pushing or merging `main` deploys to production, so no agent commits on `main`, and only the owner merges.

## Verification

- **Lint** is clean. The changes are docs, plus two comment-only edits in `vitest.config.ts` and `playwright.config.ts` from earlier in the phase. Those two files are outside `tsconfig.json`, so they were also loaded by their own runners: Playwright lists 492 tests in 34 files, and Vitest collects all 62 files.
- **Unit:** 1375/1375 in 62 files (run during the context audit, 71.5 s). `npx vitest list` reports 976, which undercounts; the run is the figure.
- **Every path and code symbol named in `AGENTS.md` and `docs/contexts/*.md` resolves in the code,** checked by script during the context audit. The exceptions are deliberate: `useFinance`, which must not exist, and `api/_auth.ts`, which is rejected by design.
- **No em dash** in any file created or rewritten in this phase.
- **Every archive move is a pure rename (100% similarity),** committed on its own before any new file took an old path, so `git log --follow` reaches each file's history.

## Consequences

- **Session start loads about 20 KB of rule files instead of about 185 KB.** That is the global `CLAUDE.md`, this repo's `CLAUDE.md` with `AGENTS.md`, the memory index and a plugin's start hook. A typical task adds one context file (8 to 19 KB).
- **The live `docs/audit/` set is about 27 KB in 5 files, down from about 1.5 MB in 12.** Shipping a phase no longer opens a 168 KB metrics file.
- **A rule now lives in one of five places** (`AGENTS.md` or one of four context files), so a change to a rule must find its one home. The parity map and routing table are the index.
- **Four code comments still point into the archive:** `txTypeMeta.ts:21`, `OverflowMenu.tsx:44`, `Card.tsx:28` and `tests/categories.spec.ts:9`. This phase does not touch code, so they are a Backlog row.
- **UI tasks still load the antislop skills** (about 78 KB for the core and UI skills). That is the owner's standing choice, outside this repo.
