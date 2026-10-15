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

## Phase 125 - ICM bootstrap: hierarchical context, the archive, herdr stages: T742-T749 (2026-10-15, renames `7bed3d7`, docs `ca1440f`, branch `phase-125-icm-bootstrap`, not merged)

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
- No E2E run this phase, since no code changed. Phase 124's 486 passed, 6 skipped stands.
- Not pushed and not merged.
