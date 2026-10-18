# Review: T769

## Round 1

**Metadata:** task T769 (Phase 137, branch `phase-137-small-fixes`), 2026-10-17, round 1, verdict **APPROVED**. Target files: `src/components/InlineMathInput.tsx`, `src/components/ui/motion.tsx`, `src/components/diary/RecentEntries.tsx`, `src/components/dashboard/LeftOverCard.tsx`, `src/index.css`, `unit/dashboard.test.tsx`, `unit/inline-math-seed.test.tsx`, `DESIGN.md`, `docs/audit/test-selector-contract.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` (plus bookkeeping `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T769-build.md`).

**Summary:** The Left over figure now uses a new `--text-hero` token (2.75rem, line height 1.1) instead of `text-4xl`. The amount field's frame uses `transition-control` instead of `transition-all`. `prefersReducedMotion` and `RECENT_STEP` are no longer exported. The selector contract lists the two transfer balance test ids. Two unit tests and the Phase 137 paperwork were added. Every diff matches the spec's step list; no unannounced file changed.

**Invariants and parity:**
- Ignored targets: `git check-ignore -v` on the target files printed nothing (exit 1), so none is ignored.
- Scope: `git diff --stat` shows 12 tracked files (61 insertions, 8 deletions); `git status --porcelain` adds only the spec and build report. All are in the spec's list or bookkeeping.
- Parity map: no row touched. No money path, `supabase/` or `api/` change.
- Hero: the token is in the `@theme` block; the built CSS contains `.text-hero{font-size:var(--text-hero);line-height:var(--tw-leading,var(--text-hero--line-height))}`. `tracking-tight` kept, as the spec says. The iOS `--text-xs`/`--text-sm` overrides are untouched. The builder's browser measurement (44px, no overflow at 390px with 123456.78) is in its report; I did not re-measure it (see Not verified).
- UI-07 and UI-08: `grep` for the two names in `src unit tests` matches only `motion.tsx` and `RecentEntries.tsx`; no `export` left on either.
- UI-01: no `transition-all` left in `InlineMathInput.tsx`; the one in `ImportCsvModal.tsx:483` (progress bar) is deliberately kept.
- UI-06: ids added in alphabetical order, nothing else on the line changed. Both ids exist in `WalletTransferForm.tsx:327` and `:352`.
- Ledger: Phase 137 section and T769 row added; the Hero row and four new rows (UI-01, UI-06, UI-07, UI-08) are `done in Phase 137 (T769)`. The Commit cell is empty, as the deploy record fills it.
- Text: 0 em dashes in added lines (Node count of U+2014 on the diff). Line endings: `git ls-files --eol` shows `w/crlf` on every touched file.

**Gates run (my own runs):**
- Red check (step 6): `git stash push` of the five non-test source files, then `npx vitest run unit/dashboard.test.tsx unit/inline-math-seed.test.tsx`: 2 failed, 79 passed (`expected 'tabular-nums text-4xl ...' to contain 'text-hero'`; `expected 'relative flex items-center rounded-lg...' to contain 'transition-control'`). After `git stash pop`, `git status --porcelain` was identical to before, and the stash list is empty.
- `npm run lint`: exit 0; 132 files in the Node-globals and safe-id guards, both `tsc` runs clean (`workflow/stages/03_review/output/logs/T769-lint.log`).
- `npx vitest run unit/dashboard.test.tsx unit/inline-math-seed.test.tsx unit/motion.test.tsx unit/diary-page.test.tsx`: 4 files, 106 passed.
- `npm run test:unit`: 62 files, 1438 passed, 0 failed, 0 skipped, 49.25 s (`.../T769-unit.log`).
- `npx playwright test tests/dashboard.spec.ts tests/transfer-preview.spec.ts tests/transaction.spec.ts tests/transaction-edit.spec.ts tests/diary.spec.ts --project=chromium`: 32 passed, 25.6 s (`.../T769-e2e-chromium.log`).
- Same five specs on all three browsers: 96 passed, 1.7 m (`.../T769-e2e-all.log`).
- `npm run build`: exit 0 (used only to read the generated `.text-hero` rule; `dist/` is ignored).
- Ports 3000 and 3100 were free before Playwright.

**Not verified:**
- The 44px computed size and the 390px no-overflow result: I trusted the builder's measurement and the built CSS rule, and did not start a dev server to re-measure.
- The bundle figures in `baseline-metrics.md` (entry 193,335 B, CSS 52,876 B): I did not re-measure with a clean `.env` build; the deltas are a few bytes and the build succeeds.
- The e2e specs named in the spec's fallback (`--list`) were not needed; all five named files exist.

**Blocking:** none.

**Non-blocking:**
- `unit/inline-math-seed.test.tsx` now ends with an extra blank line after the new `describe` (file ends `});\r\n\r\n`). Harmless; trim if touched again.
- `docs/audit/task-ledger.md` is 169 lines, past its own "about 150" note. The spec said not to archive in this task; the next phase should move Phases 125 to 13x to the archive.
- The four new Backlog rows' item text is terse and has no code formatting on file names (`InlineMathInput.tsx:136 frame uses transition-all`). Matches the intent; not worth a fix round.
- `RecentEntries.tsx` still exports the component only; `RECENT_STEP` has a doc comment that reads fine unexported.

**Rule candidates:** none. (One to watch: the "no token, no `text-[Npx]`" rule for type sizes is now met for the Hero but not yet for the 28px KPI figures in `DebtCard.tsx:88`, which still use `text-[28px]`; a `--text-kpi` token task would let `DESIGN.md` promote a general rule.)
