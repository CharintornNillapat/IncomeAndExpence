# Build report: T769

Phase 137: Audit UI-01, UI-06, UI-07, UI-08 and the hero figure size (no ADR).

## Files changed (11 target files + task-ledger.md)

1. `src/index.css`:
   - Added `--text-hero: 2.75rem` and `--text-hero--line-height: 1.1` in `@theme` block after `--font-sans`.

2. `src/components/dashboard/LeftOverCard.tsx`:
   - Replaced `text-4xl` with `text-hero` on the Left over figure at line 113.

3. `src/components/InlineMathInput.tsx`:
   - Replaced `transition-all` with `transition-control` on the input container frame at line 136 (UI-01).

4. `src/components/ui/motion.tsx`:
   - Unexported `prefersReducedMotion` (`export function prefersReducedMotion` -> `function prefersReducedMotion`) at line 14 (UI-07).

5. `src/components/diary/RecentEntries.tsx`:
   - Unexported `RECENT_STEP` (`export const RECENT_STEP = 10` -> `const RECENT_STEP = 10`) at line 9 (UI-08).

6. `docs/audit/test-selector-contract.md`:
   - Added `transfer-balance-after-dest`, `transfer-balance-after-source` to `transfer-preview.spec.ts` test ids at line 53 (UI-06).

7. `DESIGN.md`:
   - Updated scale table Hero number row with `text-hero` token at line 80.
   - Updated Dashboard type line with `(`text-hero`)` at line 174.

8. `unit/dashboard.test.tsx`:
   - Added `it('sets the figure at the Hero size')` in `describe('Left over follows the net rule (spec section 3)')`.

9. `unit/inline-math-seed.test.tsx`:
   - Added `describe('InlineMathInput: the frame')` with `it('uses transition-control, not transition-all')`.

10. `docs/audit/refactor-log.md`:
    - Added `## Phase 137 - Small fixes: T769` entry at top of file.

11. `docs/audit/baseline-metrics.md`:
    - Added `### Phase 137 - delta against Phase 136` section at top of Figures.

12. `docs/audit/task-ledger.md`:
    - Added Phase 137 section and T769 row above Backlog.
    - Marked Backlog Hero row as `done in Phase 137 (T769)`.
    - Added UI-01, UI-06, UI-07, UI-08 Backlog rows as `done in Phase 137 (T769)`.
    - Updated T769 status to `done` with gate results and empty Commit cell.

## Tests added and fail-then-pass evidence

- 2 new unit tests added across 2 test files:
  1. `unit/dashboard.test.tsx`: `sets the figure at the Hero size`
  2. `unit/inline-math-seed.test.tsx`: `InlineMathInput: the frame > uses transition-control, not transition-all`
- **Red run evidence**:
  - `npx vitest run unit/dashboard.test.tsx unit/inline-math-seed.test.tsx`:
    - 2 failed, 79 passed across 2 test files.
    - `unit/dashboard.test.tsx`: `AssertionError: expected 'tabular-nums text-4xl font-semibold t…' to contain 'text-hero'`.
    - `unit/inline-math-seed.test.tsx`: `AssertionError: expected 'relative flex items-center rounded-lg…' to contain 'transition-control'`.
- **Green run evidence**:
  - `npx vitest run unit/dashboard.test.tsx unit/inline-math-seed.test.tsx`:
    - 2 test files passed, 81 passed in 2.54s.
  - Related unit tests (`unit/dashboard.test.tsx`, `unit/inline-math-seed.test.tsx`, `unit/motion.test.tsx`, `unit/diary-page.test.tsx`):
    - 4 test files passed, 106 passed in 3.65s.
  - Full unit test suite (`npm run test:unit`):
    - 62 test files passed, 1438 passed (+2 tests vs Phase 136) in 50.99s (`workflow/stages/02_build/output/logs/T769-unit.log`).
  - Playwright Chromium (5 specs: dashboard, transfer-preview, transaction, transaction-edit, diary):
    - 5 spec files passed, 32 passed in 40.2s (dashboard & transfer: 22 passed in 21.2s; tx & diary: 10 passed in 19.0s).
  - Playwright 3-browser suite (5 specs across Chromium, Firefox, WebKit):
    - 5 spec files passed, 96 passed, 0 failed in 2.2m (dashboard & transfer: 66 passed in 1.3m; tx & diary: 30 passed in 54.2s).

## Gate commands and results

1. Red gate:
   - `npx vitest run unit/dashboard.test.tsx unit/inline-math-seed.test.tsx`: exactly the 2 new tests failed, 79 passed.

2. Lint:
   - `npm run lint`: passed clean (check:node-globals 132 files, check:safe-ids 132 files, tsc --noEmit, tsc -p api/tsconfig.json).

3. Related unit tests:
   - `npx vitest run unit/dashboard.test.tsx unit/inline-math-seed.test.tsx unit/motion.test.tsx unit/diary-page.test.tsx`: 4 passed, 106 passed in 3.65s.

4. Full unit suite:
   - `npm run test:unit`: 62 passed, 1438 passed in 50.99s.
   - Log path: `workflow/stages/02_build/output/logs/T769-unit.log`

5. Targeted Playwright on Chromium (5 specs):
   - `npx playwright test tests/dashboard.spec.ts tests/transfer-preview.spec.ts --project=chromium`: 22 passed in 21.2s.
   - `npx playwright test tests/transaction.spec.ts tests/transaction-edit.spec.ts tests/diary.spec.ts --project=chromium`: 10 passed in 19.0s.

6. Targeted Playwright on all 3 browsers (5 specs):
   - `npx playwright test tests/dashboard.spec.ts tests/transfer-preview.spec.ts`: 66 passed in 1.3m.
   - `npx playwright test tests/transaction.spec.ts tests/transaction-edit.spec.ts tests/diary.spec.ts`: 30 passed in 54.2s.

7. Browser measurement of Hero size and overflow:
   - Evaluated in Chromium on seeded Dashboard at 390px viewport width:
     - Computed font-size: `44px`
     - Computed line-height: `48.4px`
     - Class name: `tabular-nums text-hero font-semibold tracking-tight text-fg`
     - Displayed amount: `+฿123,456.78`
     - Hero width: 279.69px, Card width: 358px, Card right: 374px, Hero right: 320.69px
     - `heroOverflowsCard: false`
     - `bodyScrollWidth: 390px`, `windowInnerWidth: 390px`, `horizontalScroll: false`

8. Clean production build and bundle measurement:
   - Cleaned `dist/` and ran `npm run build`: built in 4.46s.
   - Entry chunk `index-DLzcvRPb.js`: 193,335 B (0 delta), 56,359 B gzip (-1 B against Phase 136 `index-BcaenrL9.js`, 193,335 / 56,360).
   - All app JS: 884,669 B (+5 B), 268,583 B gzip (+21 B against Phase 136 884,664 / 268,562, 39 files, 0 file delta).
   - CSS `index-CLc9BRYW.css`: 52,876 B (-8 B), 10,214 B gzip (+5 B against Phase 136 `index-z3bqoA9P.css`, 52,884 / 10,209).

9. Extra checks:
   - `grep -rn "prefersReducedMotion\|RECENT_STEP" src unit tests`: confirmed matches only `motion.tsx` and `RecentEntries.tsx`.
   - `grep -n "export" src/components/ui/motion.tsx | grep prefersReducedMotion`: 0 hits.
   - `grep -n "export const RECENT_STEP" src/components/diary/RecentEntries.tsx`: 0 hits.
   - `grep -n "transition-all" src/components/InlineMathInput.tsx`: 0 hits.
   - `grep -n "text-4xl" src/components/dashboard/LeftOverCard.tsx`: 0 hits.
   - `git ls-files --eol`: confirmed `w/crlf` across all touched files.
   - Zero em dashes: node check confirmed 0 U+2014 em dashes added in git diff.
   - `docs/audit/task-ledger.md` line count: 170 lines (exceeds 160 lines; not archived in this task per spec).

## Deliberately not done

- `ImportCsvModal.tsx:483`'s `transition-all` (a progress bar fill, not a focusable control).
- KPI and Hero tokens for other card figures (`text-2xl` values in `DebtCard`, `DebtSummaryCard`, `WalletsSection`).
- Responsive Hero size (`text-4xl sm:text-hero`).
- Other Backlog todo rows (SL-01, AddWalletForm Currency and Color labels, `setTransactionDeleted`, ESLint, React Compiler, rollup visualizer, id convention).
- iOS `--text-xs` and `--text-sm` overrides in `src/index.css`.
