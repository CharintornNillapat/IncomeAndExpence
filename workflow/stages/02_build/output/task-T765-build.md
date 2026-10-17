# Build report: T765

Phase 135: Dashboard redesign UI-1, the page header and row 1 (owner spec 3, 4.1 to 4.2; ADR 0102).

## Files changed (7 target files + task-ledger.md)

1. `src/components/dashboard/LeftOverCard.tsx` (new):
   - Implemented Left over card component displaying period net figure, kept percent caption, after-debt figure (MONTH only), daily spending SVG sparkline (WEEK and MONTH), and spent/kept allocation bar.
   - Handled zero-income / zero-spending state: omits `<p>` caption when there are no transactions; displays exact `No income this period` caption when spending exists without income; guards against NaN, Infinity, and bare percent signs across all periods.
   - Rendered inline SVG sparkline with accessibility name stating period and highest spending date/amount or "nothing spent".

2. `src/components/dashboard/CashFlowCard.tsx`:
   - Replaced multi-metric card with single metric card taking `{ kind: 'income' | 'spending', amount: number }`.
   - Displays positive income with green `+฿` and spending with red `−฿` (U+2212) using `Money`.
   - Maintains `metric-card-income` and `metric-card-expense` test ids and semantic `region` with `aria-labelledby`.

3. `src/views/DashboardView.tsx`:
   - Moved `plan` computation ahead of period metrics.
   - Replaced `flow` with `leftOver` (`leftOverFor`) and added `series` (`dailySpendingSeries`).
   - Updated row 1 grid to responsive 8/4 layout on `lg` (stacked on phone, side-by-side on `sm`, columns on `lg`).
   - Repositioned `NetWorthCard` standalone between `DebtWarningBanner` and `WalletsSection` until UI-3.
   - Passed `leftOver.spending` to `CategorySpendingCard`.

4. `unit/dashboard.test.tsx`:
   - Imported `LeftOverCard`, `leftOverFor`, `dailySpendingSeries`, and `TimeRange`.
   - Updated acceptance check 1 to use new `CashFlowCard` signature.
   - Updated net rule tests to use `LeftOverCard` with `getByText` and verified `No income this period`.
   - Added `describe('Left over card (owner spec 4.2)')` with 8 test cases covering MONTH with debt due, non-MONTH omission of after-debt line, spending exceeding income, sparkline rendering and accessible label, null series handling, empty account state, CashFlowCard kind rendering, and parameterized matrix over all periods and datasets ensuring no NaN, Infinity, or bare percent.

5. `tests/dashboard.spec.ts` (new):
   - Added Playwright test suite for Dashboard row 1 with Bangkok timezone and fixed clock (`2026-10-16T15:00:00+07:00`).
   - Covered default Past 30 days view with debt calculation, sparkline image check, income/expense figures.
   - Covered Today and This week filter switching and assertions on captions and sparkline presence.
   - Covered 390px mobile viewport layout stacking and horizontal scroll check.
   - Covered new account state across all four period buttons with clean card validation.
   - Covered parameterized seeded state across all four period buttons with `expectCleanCard`.

6. `DESIGN.md`:
   - Updated Hero number description to include Dashboard's Left over alongside net worth.
   - Clarified that "THB" appears only beside the net worth figure.
   - Removed `CashFlowCard.tsx:35` from the uppercase section label deviations list.
   - Updated Spent-vs-left bar deviation to describe brand kept and expense spent tokens.

7. `docs/audit/test-selector-contract.md`:
   - Added `dashboard.spec.ts` selector ids and test ids before `date-boundary.spec.ts`.
   - Added `dashboard.spec.ts` region and sparkline label entries under Text and title locators.

8. `docs/audit/task-ledger.md`:
   - Added Phase 135 section and marked T765 done with gate verification results.
   - Added Backlog item for `--text-hero` token.

## Tests added and fail-then-pass evidence

- 8 new test cases (11 test runs with `it.each` over 4 ranges) added in `unit/dashboard.test.tsx`.
- 5 new Playwright specs in `tests/dashboard.spec.ts`.
- **Red run evidence**:
  - `npx vitest run unit/dashboard.test.tsx` failed with `Error: Failed to resolve import "../src/components/dashboard/LeftOverCard" from "unit/dashboard.test.tsx"`.
  - `npx playwright test tests/dashboard.spec.ts --project=chromium` failed with 5 failures: element not found for `getByRole('region', { name: 'Left over', exact: true })`.
- **Green run evidence**:
  - `npx vitest run unit/dashboard.test.tsx unit/selectors-dashboard.test.ts unit/rerender-matrix.test.tsx unit/diary-context.test.tsx`: 4 passed (75 tests total) in 4.77s.
  - `npm run test:unit`: 62 test files passed, 1415 tests passed in 59.33s.
  - `npx playwright test tests/dashboard.spec.ts tests/date-boundary.spec.ts tests/theme.spec.ts tests/auth.spec.ts tests/reduced-motion.spec.ts tests/layout-stability.spec.ts --project=chromium`: 20 passed in 21.9s.
  - Same six specs across Chromium, Firefox, WebKit: 58 passed, 2 skipped (by design) in 1.4m.

## Gate commands and results

1. Red gate:
   - `npx vitest run unit/dashboard.test.tsx`: failed on missing `LeftOverCard` module.
   - `npx playwright test tests/dashboard.spec.ts --project=chromium`: failed with 5 failures (no Left over region).

2. Lint:
   - `npm run lint`: passed clean (check:node-globals 133 files, check:safe-ids 133 files, tsc --noEmit, tsc -p api/tsconfig.json).

3. Related unit tests:
   - `npx vitest run unit/dashboard.test.tsx unit/selectors-dashboard.test.ts unit/rerender-matrix.test.tsx unit/diary-context.test.tsx`: 4 passed, 75 tests passed in 4.77s.

4. Full unit suite:
   - `npm run test:unit`: 62 passed, 1415 passed in 59.33s.
   - Log path: `workflow/stages/02_build/output/logs/T765-unit.log`

5. Targeted E2E (Chromium):
   - `npx playwright test tests/dashboard.spec.ts tests/date-boundary.spec.ts tests/theme.spec.ts tests/auth.spec.ts tests/reduced-motion.spec.ts tests/layout-stability.spec.ts --project=chromium`: 20 passed in 21.9s.

6. All-browser E2E (Chromium, Firefox, WebKit):
   - `npx playwright test tests/dashboard.spec.ts tests/date-boundary.spec.ts tests/theme.spec.ts tests/auth.spec.ts tests/reduced-motion.spec.ts tests/layout-stability.spec.ts`: 58 passed, 2 skipped in 1.4m.
   - Log path: `workflow/stages/02_build/output/logs/T765-e2e.log`

7. WCAG tokens check:
   - `node scripts/wcag-tokens.mjs`: passed clean, all token pairs pass.

8. CRLF line endings check:
   - `git ls-files --eol` on all 5 changed files (`DESIGN.md`, `docs/audit/test-selector-contract.md`, `src/components/dashboard/CashFlowCard.tsx`, `src/views/DashboardView.tsx`, `unit/dashboard.test.tsx`) shows `w/crlf` kept. The two new files (`src/components/dashboard/LeftOverCard.tsx`, `tests/dashboard.spec.ts`) confirmed CRLF in working tree.

9. No em dash check:
   - `node -e "for (const f of process.argv.slice(1)) console.log(f, (require('fs').readFileSync(f, 'utf8').split(String.fromCharCode(0x2014)).length - 1))"` on all seven target files printed 0 for each.

10. No raw size / hex check:
    - Checked `src/components/dashboard/LeftOverCard.tsx` and `src/components/dashboard/CashFlowCard.tsx` for `text-\[[0-9]+px\]|#[0-9A-Fa-f]{6}`: 0 matches.

11. Git status cleanliness:
    - `git status --porcelain`: lists only target files, `docs/audit/task-ledger.md`, and stage outputs.

## Deliberately not done

- Rows 2 and 3 of the dashboard redesign, wallet section restructuring, and moving NetWorthCard to wallets card (deferred to UI-2 and UI-3 as planned).
- Modifying selectors (`src/selectors/` is a money path and unchanged in UI tasks).
- Any package dependency changes or style additions outside existing semantic tokens.
