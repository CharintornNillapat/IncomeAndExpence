# Build report: T766

Phase 135: Dashboard redesign UI-2, row 2: spending by category with month-to-date comparison line, and debt payoff card (owner spec 4.3; ADR 0102).

## Files changed (7 target files + task-ledger.md)

1. `src/components/dashboard/CategorySpendingCard.tsx`:
   - Rewrote component according to owner spec 4.3 with props `{ rows, total, monthToDate, onOpenDetails }`.
   - Enclosed card in semantic `<section aria-labelledby="dashboard-category-title" className="min-w-0 h-full">`.
   - Added header with `DashboardLink` `#dashboard-category-details-btn` calling `onOpenDetails`.
   - Implemented SVG donut chart (`viewBox="0 0 42 42"`, `r="15.9155"`) with background track circle, top-5 category segments and an aggregated grey segment for remainder categories with `SYSTEM_CATEGORY_COLOR`. Center displays total spent using `Money`.
   - Rendered list with neutral tile swatch dots, category name, formatted percent, and `Money` amount. Added rest row when `rest.length > 0` with count label and percent (omits sum amount).
   - Implemented month-to-date comparison line at foot of card inside `<Inset>` comparing this month (day 1 to N) against last month (day 1 to N) with left-over figure, and spending change pill (`+N% vs Mmm` or `−N% vs Mmm`).

2. `src/components/dashboard/DebtPayoffCard.tsx`:
   - Enclosed card in semantic `<section aria-labelledby="dashboard-debts-title" className="min-w-0 h-full">`.
   - Replaced overall progress block with `{progressPercent.toFixed(1)}% paid off`, `<Money value={paid} /> of <Money value={total} />`, and `ProgressBar`.
   - Added `<Inset>` block displaying "Needed this month" with `<Money value={plan.totalRequired} className="text-base font-semibold text-expense" />`.
   - Embedded `<DebtWarningBanner plan={plan} onReviewPlan={onOpenDebts} />` inside the card.
   - Retained active debt item list and "Make a repayment" button `#dashboard-repay-btn`.

3. `src/views/DashboardView.tsx`:
   - Removed standalone `DebtWarningBanner` between row 1 and `NetWorthCard`.
   - Added `monthToDate` selector call computed as `mtd = useMemo(() => monthToDate(transactions, today, categoryMap), [transactions, today, categoryMap])`.
   - Changed row 2 layout grid from `xl:grid-cols-12` to `lg:grid-cols-12` (`lg:col-span-7` / `lg:col-span-5`), matching row 1 responsive breakpoints.
   - Passed `monthToDate={mtd}` and `onOpenDetails={goTo('transactions')}` to `CategorySpendingCard`.

4. `unit/dashboard.test.tsx`:
   - Imported `monthToDate` and `CategorySpend` from `../src/selectors/ledger`.
   - Updated acceptance check 1 and "leaves repayments..." tests to pass new props and locate category card via `getByRole('region', { name: 'Spending by category' })`.
   - Added `describe('Spending by category card (owner spec 4.3)')` with tests 4 to 12 covering top-five and rest segments/listitems, single-category 100% donut geometry, empty state, month line spending down/up, month line with no prior spending, day 1 formatting, Details button callback, and NaN/Infinity/bare percent checks.
   - Added `describe('Debt payoff card (owner spec 4.3)')` with tests 13 and 14 covering overall block, Needed this month calculation, and warning banner inside the card.

5. `tests/dashboard.spec.ts`:
   - Lifted `expectCleanCard` and `seedTestTransactions` to module scope; typed page parameter as `Page`.
   - Added fourth transaction `tx-e2e-dash-housing` (6,000 EXPENSE on `cat-housing`, dated `2026-09-05`, with `description: ''`) and optional `debts` parameter to `seedTestTransactions`.
   - Added `describe('Dashboard row 2: spending by category and debt payoff')` with 5 tests: Past 30 days default values, period-independence of month-to-date line, Details and Repay navigation links, new account state, and debt warning banner inside card.

6. `DESIGN.md`:
   - Updated Dashboard table "Row 2: Spending by category" description to document the grey segment and "N more categories" row with percent.

7. `docs/audit/test-selector-contract.md`:
   - Updated `dashboard.spec.ts` ids list with `#dashboard-category-details-btn`, `#dashboard-repay-btn`, `#nav-tab-debts`, and `#nav-tab-transactions` in alphabetical order.
   - Added text-locator contract entries for regions "Spending by category" and "Debt payoff" (`exact: true`), donut accessible label, month line lead/pill, and "Needed this month".

8. `docs/audit/task-ledger.md`:
   - Updated T766 row in Phase 135 table to `done` with verification gate results.

## Tests added and fail-then-pass evidence

- 11 new tests in `unit/dashboard.test.tsx` (tests 4-14) + updated acceptance check 1 and "leaves repayments...".
- 5 new Playwright specs in `tests/dashboard.spec.ts` (`Dashboard row 2: spending by category and debt payoff`).
- **Red run evidence**:
  - `npx vitest run unit/dashboard.test.tsx`: 12 failed (acceptance check 1 + tests 4-14), 30 passed. Failed due to missing region 'Spending by category', missing region 'Debt payoff', and missing card elements.
  - `npx playwright test tests/dashboard.spec.ts --project=chromium`: 5 row 1 tests passed; 5 row 2 tests failed with timeout / element not found on `getByRole('region', { name: 'Spending by category', exact: true })`, `#dashboard-category-details-btn`, and warning note inside debt region.
- **Green run evidence**:
  - `npx vitest run unit/dashboard.test.tsx unit/selectors-dashboard.test.ts unit/rerender-matrix.test.tsx unit/diary-context.test.tsx`: 4 passed (86 tests total) in 4.29s.
  - `npm run test:unit`: 62 test files passed, 1426 tests passed in 70.09s.
  - `npx playwright test tests/dashboard.spec.ts tests/date-boundary.spec.ts tests/theme.spec.ts tests/toast-layering.spec.ts tests/layout-stability.spec.ts tests/reduced-motion.spec.ts --project=chromium`: 21 passed in 31.3s.
  - Same six specs across Chromium, Firefox, WebKit: 61 passed, 2 skipped (by design) in 2.0m.

## Gate commands and results

1. Red gate:
   - `npx vitest run unit/dashboard.test.tsx`: failed with 12 failures as expected.
   - `npx playwright test tests/dashboard.spec.ts --project=chromium`: row 1 passed (5/5), row 2 failed (5/5) as expected.

2. Lint:
   - `npm run lint`: passed clean (check:node-globals 133 files, check:safe-ids 133 files, tsc --noEmit, tsc -p api/tsconfig.json).

3. Related unit tests:
   - `npx vitest run unit/dashboard.test.tsx unit/selectors-dashboard.test.ts unit/rerender-matrix.test.tsx unit/diary-context.test.tsx`: 4 passed, 86 tests passed in 4.29s.

4. Full unit suite:
   - `npm run test:unit`: 62 passed, 1426 passed in 70.09s.
   - Log path: `workflow/stages/02_build/output/logs/T766-unit.log`

5. Targeted E2E (Chromium):
   - `npx playwright test tests/dashboard.spec.ts tests/date-boundary.spec.ts tests/theme.spec.ts tests/toast-layering.spec.ts tests/layout-stability.spec.ts tests/reduced-motion.spec.ts --project=chromium`: 21 passed in 31.3s.

6. All-browser E2E (Chromium, Firefox, WebKit):
   - `npx playwright test tests/dashboard.spec.ts tests/date-boundary.spec.ts tests/theme.spec.ts tests/toast-layering.spec.ts tests/layout-stability.spec.ts tests/reduced-motion.spec.ts`: 61 passed, 2 skipped in 2.0m.
   - Log path: `workflow/stages/02_build/output/logs/T766-e2e.log`

7. WCAG tokens check:
   - `node scripts/wcag-tokens.mjs`: passed clean, all token pairs pass.

8. CRLF line endings check:
   - `git ls-files --eol` on all target files confirmed `w/crlf`.

9. No em dash check:
   - Verified 0 U+2014 characters added in git diff across all target files.

10. No raw size / hex check:
    - Checked `src/components/dashboard/CategorySpendingCard.tsx` and `src/components/dashboard/DebtPayoffCard.tsx` for `text-\[[0-9]+px\]|#[0-9A-Fa-f]{6}`: 0 matches.

11. Git status cleanliness:
    - `git status --porcelain`: lists only target files, `docs/audit/task-ledger.md`, and stage outputs.

## Deliberately not done

- Row 3 redesign (Recent activity, Net worth & wallets unification, Mood & spending) deferred to UI-3 (owner spec 4.4).
- Modifying selectors (`src/selectors/` is unchanged in UI tasks).
- Any package dependency changes or non-semantic custom styles.
