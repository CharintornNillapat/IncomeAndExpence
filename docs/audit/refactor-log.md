# Refactor log

Append-only, newest entry first. One entry per **shipped phase**, never per commit.

**Phases 0 to 124** are in `archive/refactor-log-phases-001-124.md`. That file is history: read it only when the user asks for historical research. The last archived entry is Phase 124 (ADR `0100`, merged `46a7737`).

Every entry keeps these headings, even when one is "none":

```
## Phase NNN - <title>: T7xx-T7yy (<date>, code `<sha>`, docs `<sha>`, merged `<sha>`)

ADR `NNNN`. <the brief, one or two sentences>

**Changed:** <files and what changed>
**Verified:** <gate commands and their results>
**Surprises:** <or none>
**Deliberately not done:** <or none>
```

---

## Phase 128 - Workflow automation: T754-T755 (2026-10-16, docs `a757938` and `694f0cc`, merged `9c62173` and `967b049`)

ADR `0101` (amended, no new ADR). The owner's brief: cut the owner's round trips per task, with a build report per task, short spec orders, a pause after the spec only for risky tasks, and an automatic commit of each approved task on the phase branch.

**Changed:** `AGENTS.md` (the per-task outputs, the pause rule, the automatic commit, the Stop and ask first line on commits); `workflow/stages/02_build/CONTEXT.md` (`task-<id>-build.md`, `build-report.md` kept as the last shared report, who commits); `workflow/stages/03_review/CONTEXT.md` (reads `task-<id>-build.md`); `workflow/stages/01_spec/CONTEXT.md` (short orders, the pause pointer); ADR `0101`'s Amendments; `.claude/settings.json` (the `ALLOW_GIT_WRITE=1 git commit` ask rule removed).
**Verified:** G1 named paths exist; G2 `build-report.md` untouched; G3 `.claude/settings.json` diff exactly one removed line (`Bash(ALLOW_GIT_WRITE=1 git commit:*)`), 113 lines, CRLF preserved; G4 schema validation valid against Claude Code schema (`workflow/stages/02_build/output/logs/T754-settings-schema.log`); G5 stale reference checks clean (`build-report` 3 hits, `commit <id>` 3 hits, `owner's order` 0 hits); G6 zero em dashes across all touched files; G7 scope clean. T755 (`docs/audit/task-ledger.md`, a Backlog row: check line endings with `git ls-files --eol` or Node, not `grep -c`): G1-G6 passed, 2 added lines, CRLF kept, zero em dashes, scope clean. Release: PR #79 merged T754 into `main` as `9c62173` and PR #80 merged T755 as `967b049`, both merge commits; `main` CI on `9c62173` (run `38877032765`, 5 m 47 s) passed all 8 jobs on its first attempt: unit 1375/1375 in 62 files, in order and shuffled (seed `1792141047314`); E2E 486 passed, 6 skipped, none failed or flaky. `967b049` changed only Markdown, so no CI run started. Vercel deployment `dpl_4XQysgq3cpSg3kqfBT4LAD5LFkrU` (GitHub deployment `7115531911`, built from `967b049`) is READY in `icn1`, built in 20 s, with the production aliases assigned, serving `index-0LGxXWZU.js` and `index-CqllkKUj.css`, unchanged from Phase 127. No migration, no request to `/api/*`.
**Surprises:** T755 was committed on the phase branch after PR #79 had already merged, so it landed through a second PR (#80) instead of riding the first merge.
**Deliberately not done:** no `baseline-metrics.md` section (no bundle or test count changed). `build-report.md` keeps T753's report; it is not moved or deleted. No allow rule was added to `.claude/settings.json`, and the bare `git commit` ask rules for Bash and PowerShell stay. The herdr orchestrator's own configuration lives outside the repo and is the owner's to change.

---

## Phase 127 - Section label tracking: T753 (2026-10-16, code `cc32233`, merged `9323826`)

No ADR (applies `DESIGN.md` lines 77 and 85 as written). The owner's brief: bring the four uppercase labels that used `text-[11px]` and `tracking-wide` onto the section-label rule, and fix `Card.tsx`'s stale `rounded-xl` comment.

**Changed:** the four labels in `src/components/QuickAddModal.tsx` and `src/components/TransactionForm.tsx` (`text-xs`, `tracking-wider`); the `src/components/ui/Card.tsx` comment; `DESIGN.md`'s deviation row; two Backlog rows closed.
**Verified:** `npm run lint` clean (node-globals and safe-ids 132 files in src, tsc clean); `npm run test:unit` clean (62 files, 1375 passed, `workflow/stages/02_build/output/logs/T753-unit.log`); Playwright `tests/presets.spec.ts` and `tests/debt-repayment.spec.ts` passed (Chromium: 17/17 passed in 59.4s; all 3 browsers: 51/51 passed in 1.5m, `workflow/stages/02_build/output/logs/T753-e2e.log`); clean production build succeeded (`index-0LGxXWZU.js`, 191,674 B / 55,796 B gzip); bash checks confirmed 5 lines removed and 5 added in `src/`, 0 occurrences of `tracking-wide` or `text-[11px]` uppercase in `src/`, 4 compliant lines in `QuickAddModal.tsx` and `TransactionForm.tsx`, `Card.tsx` comment updated, `DESIGN.md` deviation row updated, and 0 em dashes across all touched files. Release: PR #78 merged into `main` as `9323826`, a merge commit; `main` CI on the merge (run `38854947693`, 5 m 53 s) passed all 8 jobs on its first attempt: unit 1375/1375 in 62 files, in order and shuffled (seed `1792127894854`); E2E 486 passed, 6 skipped, none failed or flaky. Vercel deployment `dpl_6XZMUwxqZ6RZegWFuPoq5DSA6ADs` (GitHub deployment `7111551076`) is READY in `icn1`, built in 20 s, with the production aliases assigned, serving `index-0LGxXWZU.js` and `index-CqllkKUj.css` as measured above. No migration, no request to `/api/*`.
**Surprises:** none.
**Deliberately not done:** No other `text-[11px]` or `text-[10px]` class was moved to the scale: they are not uppercase section labels, apart from `WalletTransferForm.tsx:101` (`text-[10px]`, now a Backlog row). No `leading-*` class was added for `text-xs`'s 16px line height.

---

## Phase 126 - ICM tune-up: settle the readiness-2 gaps: T751-T752 (2026-10-16, docs `86d0849`, comments `5bc45f5`, merged `3f301ab`)

ADR `0101` (amended, no new ADR). The owner's brief: one docs commit that settles the gaps the second ICM readiness check found (`../finlife-icm-readiness-2.md`, outside the repo). T752, the phase's last task, rewords five code comments that pointed into `docs/audit/archive/` so each cites a live doc (ADR `0006`, `0039`, `docs/contexts/ui-and-e2e.md`) and drops the framer-motion mention ADR `0082` made stale.

**Changed:** `AGENTS.md` (before-done scope, who cuts the phase branch, doc-only phase paperwork, the order forms), the three `workflow/stages/*/CONTEXT.md` files (order forms, the id from the order, the builder's BLOCKED reason, the empty `Commit` cell, no reviewer sub-agents), `docs/audit/README.md` and the ledger header (who fills `Commit`), ADR `0101`'s Amendments section; T752: comments in `src/components/transaction/txTypeMeta.ts`, `src/components/ui/Card.tsx`, `src/components/ui/OverflowMenu.tsx` and `tests/categories.spec.ts`.
**Verified:** `npm run lint` clean; zero em dashes in the touched files; T752: `npm run lint` clean (node-globals and safe-ids 132 files in src, tsc clean); comments-only diff confirmed (0 code lines changed); grep confirmed 0 archived pointers in target files; all 4 named paths and symbols resolved; zero em dashes in touched files. `main` CI on merge `3f301ab` (run `38845131793`) passed all 8 jobs: unit 1375/1375 in 62 files, in order and shuffled; E2E 486 passed, 6 skipped. Production READY in `icn1`, entry unchanged (`index-BLSMm3p4.js`).
**Surprises:** the ledger header still named a `Metric delta` column the live ledger dropped in Phase 125; removed with the C3 fix.
**Deliberately not done:** no `baseline-metrics.md` section (no bundle or test count changed). The herdr agents' workspace, agy's `always-proceed` mode and the jev-router hook live outside the repo and are the owner's to change. T752 left ADR `0006`'s own pointers to archived refactor-log notes, and `Card.tsx`'s stale `rounded-xl` (the code uses `rounded-card`, now a Backlog row), as they are.

---

## Phase 125 - ICM bootstrap: hierarchical context, the archive, herdr stages: T742-T750 (2026-10-15 to 2026-10-16, renames `7bed3d7`, docs `ca1440f`, backfill `7dfe6c2`, readiness gaps `53794ca`, merged `3124756`)

ADR `0101`. The owner's brief: prepare the repo for ICM under herdr (reviewer Claude Code, builder agy), first removing the context bloat, doc drift and dirty tree a read-only discovery pass found.

**Changed:**
- **Rules:**
  - `CLAUDE.md` (757 lines) became a 6-line import of the new `AGENTS.md` (about 125 lines): stop-and-ask list, parity map, tiered gates, routing table, ICM workflow.
  - The domain rules moved into `docs/contexts/` (`client-state.md`, `supabase-ledger.md`, `api-proxies.md`, `ui-and-e2e.md`).
  - The monolith is kept verbatim as `archive/claude-monolith-v124.md`.
- **Archive** (`git mv`, unchanged): the ledger and log for Phases 1 to 124, `baseline-metrics.md`, `test-selector-contract.md` (as the selector log), `audit-report.md`, `perf-audit-report.md`, `ui-ux-audit-report.md`, `implementation-roadmap.md`, `spec-acceptance-2026-10-02.md`, `constraints-to-promote.md` and `claude-md-history.md`. `AGY_AUDIT300926.md` and `SUGGESTS.md` moved there from the root.
- **New live files:**
  - a short `baseline-metrics.md` (how to measure, the latest figures);
  - a current `test-selector-contract.md` (ids and test ids grepped per spec, the hazards still true);
  - a compact `task-ledger.md` with a Backlog;
  - this log;
  - a rewritten `docs/audit/README.md`.
- **Moved rules:**
  - the spec-edit policy now lives in `ui-and-e2e.md`;
  - `constraints-to-promote.md`'s open row and proposals are Backlog rows;
  - `DESIGN.md`'s section-label tracking is `tracking-wider`, as in the code, with the spec's 0.4px under Deviations.
- **Doc drift:** `README.md` (Node 24, removed libraries, counts, the atomic ledger, the tree and the Documentation links) and the count comments in `vitest.config.ts` and `playwright.config.ts`.
- **Routing:** `DESIGN.md` is read for visual work only; never open `docs/design/*.html`; the redesign spec only for a new redesign.
- **Workflow:** `workflow/stages/{01_spec,02_build,03_review}/CONTEXT.md` with `output/` folders, and the phase-branch rule.
- **Root:** `.antigravity/` is ignored, and the stale local `HANDOFF.md` was deleted.
- **Readiness gaps (T750):** a read-only readiness check (`../finlife-icm-readiness.md`, 2026-10-16) dry-ran one task through the three stages and found 11 guesses and 8 conflicts. This commit fixed them in `AGENTS.md`, the stage files, ADR `0101` and `docs/audit/README.md`: STATUS lines start with the task id; who writes what; only the orchestrator commits, on the owner's order, with the owner's deploy record the one exception on `main`; the phase comes from the branch; tier rows for `tests/`, `unit/`, `workflow/`, `docs/contexts/` and comments-only changes; tests may be `none` when behaviour cannot change; the reviewer's stash check; logs in gitignored `output/logs/`. A tracked `.claude/settings.json` denies Claude Code's production write tools and asks before git writes and PRs.

**Verified:**
- `npm run lint` is clean.
- `npx playwright test --list`: 492 tests in 34 files.
- `npx vitest list` collects all 62 files.
- `npm run test:unit`: 1375/1375 in 62 files (71.5 s, during the context audit).
- Every path and symbol named in `AGENTS.md` and `docs/contexts/` resolves (scripted).
- Zero em dashes in every file created or rewritten.
- All 11 archive moves are 100% renames, committed alone.

**Surprises:**
- `npx vitest list` reports 976 tests where the run passes 1375. The run is the figure.
- The old selector contract's L176 and L177 called `#diary-workout-checkbox` and `#close-wallet-modal-btn` "Unchanged id"; later rows (L338, L296) retired both, and neither is in `src/`.
- Uppercase labels used `tracking-wider` seven times and `tracking-wide` four times (`QuickAddModal.tsx:101`, `TransactionForm.tsx:709`, `:848`, `:871`), against `DESIGN.md`'s 0.4px.
- A `git mv` followed by a new file at the old path, in one commit, would have recorded an edit and an add, not a rename. So the renames went in their own commit first.

**Deliberately not done:**
- No code, test, config or schema change. The four code comments that point into the archive, and the `tracking-wide` labels, are Backlog rows.
- No `GEMINI.md`: agy is told by its stage file to read `AGENTS.md`, so there is one rule file.
- `anti-slop/` stays in place (the antislop skill writes there).
- No local E2E run this phase, since no code changed. The PR's CI did not run either: every branch commit carried `[skip ci]`, so `main` CI on the merge is the only suite run.
