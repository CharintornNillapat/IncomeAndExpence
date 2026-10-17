# Task T769 spec: audit UI-01, UI-06, UI-07, UI-08 and the hero figure size (Phase 137)

Branch `phase-137-small-fixes`. Phase number 137. T769 is the only task of the phase, so it ships it (refactor-log entry and baseline-metrics figures, below).

Order note for the owner: the order says UI-01 and UI-06 to UI-08 are "in the ledger Backlog". They are not: T759 put only the high and medium findings there. The four low findings live in `docs/audit/audit-2026-10-16.md` (lines 153, 196, 206, 213). The intent is clear, so this spec uses the audit file and tells the builder to add the four Backlog rows as already done.

## 1. Goal

Close four low UI findings from the 2026-10-16 audit (a `transition-all` on the amount field's frame, two test ids missing from the selector contract, two exports nothing imports) and make the Left over figure the 44px Hero size `DESIGN.md` specifies, through a `--text-hero` token, instead of `text-4xl` (36px).

## 2. Target files

```
src/components/InlineMathInput.tsx
src/components/ui/motion.tsx
src/components/diary/RecentEntries.tsx
src/components/dashboard/LeftOverCard.tsx
src/index.css
unit/dashboard.test.tsx
unit/inline-math-seed.test.tsx
DESIGN.md
docs/audit/test-selector-contract.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

No ADR. Why: no rule changes. ADR 0102 already fixes the Hero size at 44px (`DESIGN.md:80`); the token only makes the code match it. The other four items are cleanups of existing rules.

Bookkeeping (always allowed, not listed above): `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T769-build.md`.

## 3. Context to read

- `docs/contexts/ui-and-e2e.md` (components, a11y, the `transition-control` rule at line 28, the selector contract rule at line 56).
- `DESIGN.md` (the type scale at lines 72-83 and the dashboard type line at 174; it is the design authority for a visual change).
- Not needed: `client-state.md`, `supabase-ledger.md`, `api-proxies.md`. No money path is touched.

## 4. Current behaviour

- UI-01. `src/components/InlineMathInput.tsx:136` is the amount field's frame, a non-focusable `div` drawing the focus and error rings around the `<input>` (`:150`). Its class is `... px-3 transition-all ...`. Rule: `docs/contexts/ui-and-e2e.md:28` ("`transition-control`, never `transition-colors` or `transition-all`, on a focusable control"). `transition-control` is defined at `src/index.css:386` and lists colour, border, fill and stroke properties only; it leaves out `box-shadow`, so after the change the ring snaps instead of fading. That is acceptable and matches the other controls. The other `transition-all` in `src` is `ImportCsvModal.tsx:483`, a progress bar fill (not a control); leave it.
- UI-06. `docs/audit/test-selector-contract.md:52` lists for `transfer-preview.spec.ts` the test ids `transfer-overdraft-warning`, `transfer-panel-source`. The spec also uses `transfer-balance-after-source` and `transfer-balance-after-dest` (`tests/transfer-preview.spec.ts:19-20`, through constants, so a text search for string literals misses them). The components set them: `src/components/wallet/WalletTransferForm.tsx:327` and `:352`.
- UI-07. `src/components/ui/motion.tsx:14` is `export function prefersReducedMotion()`. It is called only inside the file (`:42`, `:71`). No file in `src/`, `unit/` or `tests/` imports it (checked with a search for the name; only `motion.tsx` matches).
- UI-08. `src/components/diary/RecentEntries.tsx:9` is `export const RECENT_STEP = 10;`. It is used only inside the file (`:25`, `:58`, `:59`). Nothing else imports it (same search).
- Hero. `src/components/dashboard/LeftOverCard.tsx:113` sets the Left over figure with `text-4xl font-semibold tracking-tight` (36px). `DESIGN.md:80` says Hero number: 44px / 600, -1px tracking; `DESIGN.md:174` says the Left over figure takes that size. `src/index.css:296` opens the `@theme` block that holds the project's tokens (`--radius-card` at `:310`, `--font-sans` at `:323`); there is no `--text-hero`. Tailwind v4 turns a `--text-<name>` theme variable into a `text-<name>` font-size utility, and `--text-<name>--line-height` sets its line height. The only `--text-*` overrides today are the iOS-only `--text-xs` and `--text-sm` (`:374-375`); do not touch them. `tracking-tight` is -0.025em, which is -1.1px at 44px: close enough to the spec's -1px, so keep `tracking-tight` and add no tracking token.
- Existing tests that read this class: `unit/dashboard.test.tsx:150-165` already render `LeftOverCard` and read `net.className` (for `text-fg`, `text-expense`). Nothing asserts `text-4xl`. `unit/inline-math-seed.test.tsx` already renders `InlineMathInput` (import at `:7`, harness at `:54`).

## 5. Parity map

None. `index.css` colour tokens and the `wcag-tokens` check are not touched (a font-size token has no colour).

## 6. Tests to add

No money path, so no red-first rule from AGENTS.md; still write both tests first and confirm they fail on the unfixed code (builder records it).

1. `unit/dashboard.test.tsx`, in `describe('Left over follows the net rule ...')`: "sets the figure at the Hero size". Render `LeftOverCard` as the neighbouring tests do, take `net` the same way, expect `net.className` to contain `text-hero` and not contain `text-4xl`. Fails today: the class is `text-4xl` (`LeftOverCard.tsx:113`).
2. `unit/inline-math-seed.test.tsx`, a small test in its own `describe('InlineMathInput: the frame')`: render `<InlineMathInput id="amt" ... />` (copy the minimal props from the harness at `:54`), take the `<input id="amt">`, read `input.parentElement.className`, expect it to contain `transition-control` and not `transition-all`. Fails today: the frame carries `transition-all` (`InlineMathInput.tsx:136`).

No test for UI-06 (docs text), UI-07 or UI-08 (an `export` keyword changes no behaviour; `tsc` would fail the build if an importer existed, and the gate below greps for importers). The `index.css` token is covered by test 1 only at the class level; the 44px result is checked in the browser (gates).

## 7. Gates

Changed paths: `src/components/`, `src/index.css`, `unit/`, docs. Union of the tier rows:

```
npm run lint
npx vitest run unit/dashboard.test.tsx unit/inline-math-seed.test.tsx unit/motion.test.tsx unit/diary-page.test.tsx
npm run test:unit
npx playwright test tests/dashboard.spec.ts tests/transfer-preview.spec.ts --project=chromium
npx playwright test tests/dashboard.spec.ts tests/transfer-preview.spec.ts
```

Because the amount field is in the entry form, the transfer form and the quick-add modal, and `RecentEntries` and `motion.tsx` are used by the diary and the toast/pill code, also run the specs that exercise them, on chromium and then on all three browsers: `npx playwright test tests/transaction.spec.ts tests/transaction-edit.spec.ts tests/diary.spec.ts --project=chromium`, then the same without `--project`. If a named spec file does not exist, run `npx playwright test --list` and pick the specs whose names cover transactions and the diary; record which ones. Check ports 3000 and 3100 for stale dev servers first. Never edit `src/` while Playwright runs. Save full-suite output to `workflow/stages/02_build/output/logs/`.

Extra checks (bash, record the output in the build report):

- No importers of the unexported names: `grep -rn "prefersReducedMotion\|RECENT_STEP" src unit tests` must match only `motion.tsx` and `RecentEntries.tsx`.
- `grep -n "export" src/components/ui/motion.tsx | grep prefersReducedMotion` and `grep -n "export const RECENT_STEP" src/components/diary/RecentEntries.tsx` must print nothing.
- `grep -n "transition-all" src/components/InlineMathInput.tsx` must print nothing.
- `grep -n "text-4xl" src/components/dashboard/LeftOverCard.tsx` must print nothing.
- Hero in the browser: start the dev server, open the Dashboard as a guest with a seeded entry, and confirm the Left over figure's computed `font-size` is `44px` (browser console: `getComputedStyle(document.querySelector('#dashboard-left-over-title').closest('section, div').querySelector('.text-hero')).fontSize`, or inspect the element). Then set the viewport to 390px wide and confirm the figure does not overflow its card or scroll the page horizontally, for a 6-figure amount such as 123456.78. If it does overflow, do not invent a responsive size: report `BLOCKED` to the orchestrator with the measured widths.
- Line endings preserved: `git ls-files --eol` on every changed file; each stays `w/crlf` (all of them are today). Edit with a tool that keeps CRLF.
- Zero em dashes in added lines: `git diff -U0 | grep -nP "^\+.*\x{2014}"` prints nothing.

## 8. Production touch points

None.

## 9. Changes, step by step

1. Write the two unit tests (section 6) and run them; record that both fail.
2. `src/index.css`: inside the `@theme` block, after `--font-sans` (`:323`, before the closing brace), add a comment line "DESIGN.md's Hero number, the Dashboard's Left over figure." and:
   ```
   --text-hero: 2.75rem;
   --text-hero--line-height: 1.1;
   ```
   (2.75rem = 44px at the 16px root; the figure scales with the user's font setting like `text-4xl` did.)
3. `src/components/dashboard/LeftOverCard.tsx:113`: replace `text-4xl` with `text-hero`. Keep `font-semibold tracking-tight` and the colour logic.
4. `src/components/InlineMathInput.tsx:136`: replace `transition-all` with `transition-control`. Nothing else in the class list.
5. `src/components/ui/motion.tsx:14`: `export function prefersReducedMotion` becomes `function prefersReducedMotion`.
6. `src/components/diary/RecentEntries.tsx:9`: `export const RECENT_STEP` becomes `const RECENT_STEP`.
7. `docs/audit/test-selector-contract.md:52`: the `transfer-preview.spec.ts` line's test ids become `transfer-balance-after-dest`, `transfer-balance-after-source`, `transfer-overdraft-warning`, `transfer-panel-source` (alphabetical, as the neighbouring lines are). Change nothing else on the line.
8. `DESIGN.md`: in the scale table, the Hero row (`:80`) gains the token: `| Hero number (the Dashboard's Left over) | 44px / 600, -1px tracking; the `text-hero` token |` (keep the file's own minus character style as it is on that line). In the Dashboard type line (`:174`), after "takes the Hero number size" add " (`text-hero`)". No other edit.
9. Ledger (`docs/audit/task-ledger.md`):
   - Add `## Phase 137 - Small fixes: four low UI findings and the hero size (no ADR)` above `## Backlog`, in the file's phase format (branch line `Branch `phase-137-small-fixes`, cut from `main` at `1d286e5`.`, plus the commit and merge text once known, `No migration.`), with the T769 row: Task "Close UI-01, UI-06, UI-07, UI-08 and size the Left over figure with a `--text-hero` token (44px)", Files = the Target files above, Status `done` once reviewed, Commit and Gate result filled at the end as the other rows do.
   - Backlog: set the first row (the 44px vs 36px Hero row) Status to `done in Phase 137 (T769)`. Add four rows in the existing format, each Status `done in Phase 137 (T769)`: UI-01 (`InlineMathInput.tsx:136` frame uses `transition-all`), UI-06 (selector contract omits the two transfer balance test ids), UI-07 (dead export `prefersReducedMotion`), UI-08 (dead export `RECENT_STEP`); source for each: `Audit 2026-10-16 (T759), finding UI-0N, low; <path:line>`.
   - The file stays near 150 lines; if it passes about 160, do not archive in this task, say so in the build report.
10. `docs/audit/refactor-log.md`: add the Phase 137 entry at the top (above Phase 136), following the template at the top of the file: heading `## Phase 137 - Small fixes: T769 (<date>, code `<sha>`, merged `<sha>`)` (the sha fields are backfilled by the deploy record as in Phase 136), `No ADR` plus the one-line brief, and `Changed`, `Verified`, `Surprises`, `Deliberately not done`. Surprises must mention that the four low findings were not in the Backlog, and that `transition-control` drops the ring's fade. Deliberately not done: `ImportCsvModal.tsx:483`'s `transition-all` (a progress bar, not a control); the KPI and Hero tokens for the other card figures (`text-2xl` values); a responsive Hero size.
11. `docs/audit/baseline-metrics.md`: add the Phase 137 section at the top of "Figures", with deltas against Phase 136: unit test count (1436 + 2 expected = 1438; record the real figure) and the production bundle entry size (193,335 B gzip entry in Phase 136; build with `.env` present, per "How to measure"). The CSS change should move the bundle by a few bytes at most.

## 10. Out of scope

- Any other `text-4xl`, `text-3xl`, `text-2xl` or `text-[28px]` figure (the KPI size, `DebtCard`, `DebtSummaryCard`, `WalletsSection`). A `--text-kpi` token is a separate task.
- A responsive Hero (`text-4xl sm:text-hero`) unless the owner asks.
- `ImportCsvModal.tsx:483`'s `transition-all`.
- The other Backlog todo rows (SL-01, the `AddWalletForm` Currency and Color labels, `setTransactionDeleted`, ESLint, React Compiler, the visualizer, the `id` convention).
- The iOS `--text-xs` and `--text-sm` overrides in `index.css`.
- `docs/contexts/ui-and-e2e.md`, `AGENTS.md`, `README.md`, `vercel.json`, workflows, and anything under `supabase/` or `api/`.
- Committing or pushing: the orchestrator commits after an APPROVED review.
