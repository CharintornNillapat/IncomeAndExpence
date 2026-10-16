# 0101: Hierarchical context, a quarantined archive, and herdr workflow stages

**Status:** Accepted. Released: renames `7bed3d7`, docs `ca1440f`, hash backfill `7dfe6c2`, readiness gaps `53794ca` (T750, which amended sections 3 and 4 and the Consequences), merged into `main` as `3124756` (PR #76); production deployment READY in `icn1`, serving `index-BLSMm3p4.js`. No code, test, config or schema change. Amended in Phase 126 (T751, `86d0849`), merged into `main` as `3f301ab` (PR #77), and in Phase 128 (T754, `a757938`), merged into `main` as `9c62173` (PR #79), and in Phase 130 (T758); see Amendments.
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
- **Every reply ends with one STATUS line, starting with the task id** (`STATUS: <id> | <state> | <detail>`), to match the orchestrator:
  - reviewer: `SPEC DONE`, `APPROVED`, `CHANGES REQUESTED` or `BLOCKED`, with the output path;
  - builder: `BUILT`, `FIXED` or `BLOCKED`, with the count of files changed.
- **Who writes what:** the reviewer's spec is the plan. An ADR the task needs is a spec target the builder writes first, before any code. The builder keeps the task's ledger row, under the phase named by the branch. `refactor-log.md` and `baseline-metrics.md` are written by the task that ships the phase. Outside herdr, one session does all of it in the same order.
- **Scope is the spec's target-file allowlist.** The bookkeeping files are always allowed: `task-ledger.md` and the build output, including its gitignored `output/logs/`. The review treats any other unannounced file as blocking, runs the gates itself (logs in `03_review/output/logs/`), and checks that each new test fails without the change by stashing only the non-test changes and restoring them, with `git status` identical before and after. A spec may answer `none` for tests only when the change cannot alter behaviour.

### 4. Phase branches

All ICM work happens on a branch `phase-NNN-<slug>` cut from `main`, and the phase number is the branch's `NNN`. Pushing or merging `main` deploys to production, so:

- **Only the orchestrator commits,** only on a phase branch, and only on the owner's `commit <id>` order. It pushes only the phase branch, only on the owner's push order. No other agent commits or pushes.
- **No agent merges.** The owner merges.
- **The one exception on `main`:** the owner's post-merge deploy record, a docs-only `[skip ci]` commit, stays allowed when the owner makes it or explicitly approves it.

## Verification

- **Lint** is clean. The changes are docs, plus two comment-only edits in `vitest.config.ts` and `playwright.config.ts` from earlier in the phase. Those two files are outside `tsconfig.json`, so they were also loaded by their own runners: Playwright lists 492 tests in 34 files, and Vitest collects all 62 files.
- **Unit:** 1375/1375 in 62 files (run during the context audit, 71.5 s). `npx vitest list` reports 976, which undercounts; the run is the figure.
- **Every path and code symbol named in `AGENTS.md` and `docs/contexts/*.md` resolves in the code,** checked by script during the context audit. The exceptions are deliberate: `useFinance`, which must not exist, and `api/_auth.ts`, which is rejected by design.
- **No em dash** in any file created or rewritten in this phase.
- **Every archive move is a pure rename (100% similarity),** committed on its own before any new file took an old path, so `git log --follow` reaches each file's history.

## Consequences

- **Session start loads about 20 KB of rule files instead of about 185 KB.** That is the global `CLAUDE.md`, this repo's `CLAUDE.md` with `AGENTS.md`, the memory index and a plugin's start hook. A typical task adds one context file (8 to 19 KB).
- **The live `docs/audit/` set is about 27 KB in 5 files, down from about 1.5 MB in 12.** Shipping a phase no longer opens a 168 KB metrics file.
- **Every rule has one home among these files:** `AGENTS.md`; the four `docs/contexts/*.md` files; `DESIGN.md`, for visual work; `docs/audit/test-selector-contract.md`, for spec-asserted ids; the three `workflow/stages/*/CONTEXT.md` files, for the herdr workflow; and `docs/audit/README.md`, for doc discipline. A change to a rule must find its one home. The parity map and routing table are the index.
- **Four code comments still point into the archive:** `txTypeMeta.ts:21`, `OverflowMenu.tsx:44`, `Card.tsx:28` and `tests/categories.spec.ts:9`. This phase does not touch code, so they are a Backlog row.
- **UI tasks still load the antislop skills** (about 78 KB for the core and UI skills). That is the owner's standing choice, outside this repo.

## Release

- **Merge:** PR #76 merged into `main` as `3124756`, a merge commit, so the four branch hashes above are on `main`. The pull request ran no CI: every branch commit carried `[skip ci]`.
- **Production:** Vercel deployment `dpl_3G9wZuANkH7Brfu951xTD4Fw66K6` (GitHub deployment `7107812424`) on `3124756` is READY in `icn1`, built in 21 s, with the production aliases assigned. It serves `index-BLSMm3p4.js`, Phase 124's entry, since no `src/` file changed. No request was sent to `/api/*`.
- **`main` CI on the merge** (run `38830122172`, 5 m 12 s) passed all 8 jobs on its first attempt: type-check and unit 1375/1375 in 62 files, in order and shuffled (seed `1792110845103`); E2E 486 passed, 6 skipped, none failed or flaky.
- **No migration,** so no drift run.

## Amendments

**Phase 126 (T751, 2026-10-16), branch `phase-126-icm-tuneup`, docs `86d0849`, released in merge `3f301ab` (PR #77).** These settle the gaps of the second readiness check. They change workflow rules, not the decision, so no new ADR.

1. **Before-done scope (D1).** `AGENTS.md`'s before-done line (lint, unit, the affected specs) applies only to tasks whose gates include a code tier. Docs-only and comments-only tasks run only their own tier rows.
2. **Who cuts the phase branch (D2).** On the owner's phase order, before the first spec of the phase, the orchestrator cuts `phase-NNN-<slug>` from an up-to-date `main`. `NNN` is one above the last phase in the ledger. Work stays on that branch until the owner merges.
3. **Doc-only phase paperwork (D3).** A comments-only task counts as a doc-only edit, so it needs no ADR. A phase made only of doc-only tasks still ships with a short refactor-log entry, and adds no baseline-metrics section unless the bundle or test counts changed.
4. **The `Commit` cell (D4, M6).** Per-task `Commit` cells are filled once per phase, in the owner-approved deploy record after the merge. The builder leaves `Commit` empty. Stated in `docs/audit/README.md`, the ledger header and stage 02.
5. **Order forms and the task id (M1, M2).** Orders arrive as `spec <id>: <description> (stage file: <path>)`, `build <id> (stage file: <path>)`, `review <id> (stage file: <path>)` and `fix <id> (stage file: <path>)`. The spec's Goal comes from the description. Stage 01 uses the id in the order and stops with `BLOCKED` if that id is already taken, instead of computing its own.
6. **The builder's BLOCKED line (M3)** carries the reason as its detail, like the reviewer's: `STATUS: <id> | BLOCKED | <reason>`.
7. **Ledger header (C3 leftover).** `task-ledger.md` no longer calls itself the only file edited mid-phase; the task that ships a phase also writes the refactor log and metrics. The stale `Metric delta` column name is gone.
8. **No reviewer sub-agents.** Stages 01 and 03 say the reviewer never spawns sub-agents, whatever a hook or tool suggests.

**Phase 126 release.** PR #77 merged into `main` as `3f301ab`, a merge commit, so `86d0849` and T752's comment commit `5bc45f5` are on `main`. Vercel deployment `dpl_FVBnrcrEzJrGXUJceQmtWiWRuNhT` (GitHub deployment `7110036939`) is READY in `icn1`, built in 19 s, with the production aliases assigned; it still serves `index-BLSMm3p4.js`, since T752 changed comments only. `main` CI on the merge (run `38845131793`, 5 m 14 s) passed all 8 jobs on its first attempt: unit 1375/1375 in 62 files, in order and shuffled (seed `1792120965210`); E2E 486 passed, 6 skipped, none failed or flaky. No migration, no drift run, no request to `/api/*`.

**Phase 128 (T754, 2026-10-16), branch `phase-128-workflow-automation`, docs `a757938`, released in merge `9c62173` (PR #79).** These cut the owner's round trips per task. They change workflow rules, not the decision, so no new ADR.

1. **A build report per task.** Stage 02 writes `02_build/output/task-<id>-build.md`, and each fix round appends a `## Fix round N` section to it. This replaces section 3's single `build-report.md`, overwritten per task. `build-report.md` stays as the last shared report (T753) and is not written again. `AGENTS.md` names the three per-task outputs.
2. **Short orders.** In stage 01, a one-line goal or a reference to a ledger Backlog row is a complete order. The reviewer expands it from that row and the code, and stops with `BLOCKED` only when the intent is unclear.
3. **Automatic pause.** After the spec, the orchestrator pauses for the owner only when the spec touches a money path (`FinanceContext.tsx`, `src/selectors/`, the ledger), `supabase/`, `api/`, `AGENTS.md` or a stage file, or lists a production touch point. Otherwise it goes on without asking.
4. **Automatic commit (replaces section 4's `commit <id>` order).** The orchestrator commits each `APPROVED` task on the phase branch by itself, staging only that task's files. Pushing still needs the owner's push order, and merging stays with the owner. `.claude/settings.json` drops its ask rule for the prefixed `ALLOW_GIT_WRITE=1 git commit` form; every other rule stays, including the ask rule for `ALLOW_GIT_WRITE=1 git push`.

**Phase 128 release.** Two merge commits, no squash. PR #79 merged T754 into `main` as `9c62173`. T755's Backlog row (`694f0cc`) was committed on the branch after that merge, so it needed its own PR: PR #80 merged it as `967b049`. Vercel deployment `dpl_5sfPNpEC8JT8UBkHofZ8VACe1dG2` (GitHub deployment `7115030510`) built `9c62173`; `dpl_4XQysgq3cpSg3kqfBT4LAD5LFkrU` (GitHub deployment `7115531911`) built `967b049` and is the live one: READY in `icn1`, built in 20 s, with the production aliases assigned, still serving `index-0LGxXWZU.js` and `index-CqllkKUj.css`, since the phase changed no code. `main` CI on `9c62173` (run `38877032765`, 5 m 47 s; it ran because `.claude/settings.json` changed) passed all 8 jobs on its first attempt: unit 1375/1375 in 62 files, in order and shuffled (seed `1792141047314`); E2E 486 passed, 6 skipped, none failed or flaky. `967b049` changed only Markdown, so `paths-ignore` started no run. No migration, no drift run, no request to `/api/*`.

**Phase 130 (T758, 2026-10-16), branch `phase-130-eol-check`.** This changes a permission prompt, not the decision, so no new ADR.

1. **No ask prompt on a bare commit.** `.claude/settings.json` drops its `Bash(git commit:*)` and `PowerShell(git commit:*)` ask rules: they made the orchestrator's automatic commit (Phase 128, amendment 4) ask the owner every time. Commits are now guarded by the local git hooks and `AGENTS.md`, not by an ask prompt. The hooks are the untracked `.git/hooks/pre-commit` and `.git/hooks/pre-push` in the owner's clone: inside a herdr pane (`HERDR_ENV=1`) they refuse a commit or push unless `ALLOW_GIT_WRITE=1` is set, and outside herdr they do not block. `AGENTS.md`'s Stop and ask first list still names `git commit`, and its ICM section limits the standing go-ahead to the orchestrator's commit of each approved task on the phase branch. Every other rule stays, including the ask rules for `git push`, `git merge`, `git rebase`, `gh pr create` and `ALLOW_GIT_WRITE=1 git push`.
