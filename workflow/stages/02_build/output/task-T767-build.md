# Build report: T767

Phase 135: Dashboard redesign UI-3, row 3: recent activity, net worth and wallets merged, mood strip, insights card placement, T766 review notes cleanup, suite counts, and Phase 135 shipping (owner spec 4.4 to 4.5; ADR 0102).

## Files changed (18 target files + task-ledger.md)

1. `src/components/dashboard/WalletsSection.tsx`:
   - Rewrote component as the Net worth and wallets card according to owner spec 4.4.
   - Accepts `{ wallets, netWorth, walletTotal, debtRemaining, onTransfer, onAddWallet, onManageWallets, onSelectWallet }`.
   - Card wrapped in semantic `<section aria-labelledby="dashboard-wallets-heading" className="min-w-0">`.
   - Top block holds `data-testid="net-worth-card"` containing:
     - Left: h2 "Net worth", subtitle with wallet count, `<Money value={walletTotal} />`, and `· debt <Money value={-debtRemaining} className={debtRemaining > 0 ? 'text-expense' : 'text-fg-secondary'} />`.
     - Right: `<Money value={netWorth} className="text-2xl font-semibold tracking-tight ..." />` and currency label `{APP_CURRENCY}`.
   - Wallets row: divider with h3 "Wallets" (`id="dashboard-wallets-heading"`) and Transfer `DashboardLink` (`#hero-transfer-funds-btn`).
   - If no wallets, renders `EmptyState`. Otherwise renders `AllocationBar` and a vertical column of wallet rows (`flex flex-col gap-1`).
   - Each wallet row renders as a clean unboxed interactive button (`#dashboard-wallet-card-{id}`) with icon tile (`w-9 h-9`), wallet name, type and allocation share line, balance `Money`, and chevron.
   - Footer contains `#hero-add-wallet-btn` ("Add wallet") and `#hero-manage-all-wallets-btn` ("Manage wallets") links.

2. `src/components/dashboard/NetWorthCard.tsx`:
   - Deleted via `git rm` per spec section 7.2.

3. `src/components/dashboard/MoodSpendingCard.tsx`:
   - Rewrote card wrapped in semantic `<section aria-labelledby="dashboard-mood-title" className="min-w-0">`.
   - Header contains h2 "Mood and spending" (`id="dashboard-mood-title"`), subtitle "From your daily diary", and `<Button id="dashboard-log-mood-btn" variant="soft" onClick={onOpenDiary}>`.
   - Horizontal strip laid out as `<ul className="flex flex-wrap gap-2">` over `[...mood.days].reverse()` (oldest on left, matching owner decision A).
   - Each day tile renders as `<li key={day.date} className="flex-1 basis-24 min-w-0 flex flex-col items-center gap-1.5 rounded-inner bg-surface-2 px-2 py-2.5 text-center">` containing formatted weekday date, `<MoodMeter mood={day.mood} />`, and that day's spending `<Money value={-day.spending} ... />`.
   - Retained prompt hint when `mood.days.length === 0`.

4. `src/components/dashboard/RecentActivityCard.tsx`:
   - Wrapped card in semantic `<section aria-labelledby="dashboard-activity-title" className="min-w-0 h-full">`.
   - Added `id="dashboard-activity-title"` to the h2 heading.
   - Added doc comment indicating owner spec 4.4 preserves card rows and behaviour.

5. `src/components/dashboard/CategorySpendingCard.tsx`:
   - Addressed T766 review notes 1, 2, and 3:
     - Updated doc comment to reference `leftOver.spending`.
     - Made `Donut` accept pre-sliced `{ segments, total }` computed once in parent card, removing duplicate computation of `shown`, `rest`, and `restPercent`.
     - Removed redundant ternary in Donut `strokeDasharray` calculation (`allSegments.length === 1`).

6. `src/views/DashboardView.tsx`:
   - Removed `NetWorthCard` import and standalone `NetWorthCard` / `WalletsSection` JSX blocks.
   - Replaced row 3 with `<div className="grid grid-cols-1 lg:grid-cols-12 gap-4">`:
     - `lg:col-span-7`: `RecentActivityCard` with props unchanged.
     - `lg:col-span-5 flex flex-col gap-4`: `WalletsSection` (with `netWorth`, `walletTotal`, and `debtRemaining` passed) followed by `MoodSpendingCard`.
   - Maintained Spending insights section last and full width.

7. `src/components/ViewLoadingFallback.tsx`:
   - Updated `SHAPES.dashboard` skeleton heights to 5 rows (Header, 3 `lg:grid-cols-2` rows, and `h-40` insights).
   - Preserved `w/lf` line endings.

8. `src/components/ui/AllocationBar.tsx`:
   - Updated line 56 comment to refer to Dashboard captions instead of obsolete Cash flow card.

9. `unit/dashboard.test.tsx`:
   - Removed `NetWorthCard` import.
   - Updated acceptance check 3 and Wallets section tests to use new `WalletsSection` props and region name.
   - Added Test 9 to Recent activity describe asserting region structure and transaction rows.
   - Added `describe('Net worth and wallets card (owner spec 4.4)')` with tests 10 and 11.
   - Added `describe('Mood and spending card (owner spec 4.4, decision A)')` with tests 12 to 14.
   - Deleted duplicate Scenario 4 test block from Category spending describe (T766 note 5).

10. `tests/dashboard.spec.ts`:
    - Updated `seedTestTransactions` to seed 2 wallets and 2 diary days.
    - Added `describe('Dashboard row 3: recent activity, net worth and wallets, mood strip')` with 5 tests:
      1. Past 30 days default values for row 3 cards.
      2. Mood and spending strip follows the page's period filter.
      3. View all, Transfer, Add wallet, Manage wallets, and Log today links.
      4. New account state for row 3 cards.
      5. Phone width renders row 3 without horizontal overflow.

11. `DESIGN.md`:
    - Updated line 80: Hero number tracking to `-1px`.
    - Updated line 163: Dashboard status line marked shipped in Phase 135.
    - Updated line 199: Category spending table description (T766 note 4).
    - Updated line 203: Row 3 Mood and spending table description.
    - Updated line 206: "selectors Phase 134 added".
    - Updated line 326: Dropped `NetWorthCard.tsx:22` from examples.

12. `docs/design/dashboard-2026-10/spec.md`:
    - Updated line 61 to reflect owner decision A for Mood and spending strip.

13. `docs/audit/test-selector-contract.md`:
    - Updated `dashboard.spec.ts` ids list with row 3 buttons, links, and test ids in alphabetical order.
    - Updated text locators list with regions "Recent activity", "Net worth and wallets", and "Mood and spending", plus the "Spending insights" section.

14. `AGENTS.md`:
    - Updated line 11 test counts: Vitest 1432 tests in 62 files; Playwright 179 tests in 35 specs (537 runs on three browsers).

15. `docs/contexts/ui-and-e2e.md`:
    - Updated line 62 Playwright suite counts: 179 tests in 35 specs, 537 runs, 531 pass, 6 skip by design.

16. `README.md`:
    - Updated line 10 badge to `179%20E2E%20tests`.
    - Updated lines 157-158 test counts: Vitest 1432 tests in 62 files; Playwright 179 tests in 35 specs (537 runs).

17. `docs/audit/baseline-metrics.md`:
    - Added `### Phase 135 - delta against Phase 134` section with entry chunk, all app JS, CSS, Vitest, and Playwright full-suite measurements.

18. `docs/audit/refactor-log.md`:
    - Added `## Phase 135 - Dashboard UI: T765-T767 (2026-10-17, code 3f7b3e8, 662c528, and T767)` entry above Phase 134.

19. `docs/audit/task-ledger.md`:
    - Marked T767 status `done` with verification gate results and empty Commit cell.

## Tests added and fail-then-pass evidence

- 6 new/updated tests in `unit/dashboard.test.tsx` (tests 9-14) covering recent activity region, net worth block, wallet rows, oldest-on-left mood strip, and diary callbacks.
- 5 new Playwright specs in `tests/dashboard.spec.ts` (`Dashboard row 3: recent activity, net worth and wallets, mood strip`).
- **Red run evidence**:
  - `npx vitest run unit/dashboard.test.tsx`: 8 failed (acceptance check 3 + tests 9, 10, 11, 12, 13, 14), 38 passed. Failures confirmed missing region 'Net worth and wallets', missing region 'Recent activity', missing region 'Mood and spending', and missing props.
  - `npx playwright test tests/dashboard.spec.ts --project=chromium`: row 1 passed (5/5), row 2 passed (5/5), row 3 failed (4/5) on missing regions and locators.
- **Green run evidence**:
  - `npx vitest run unit/dashboard.test.tsx unit/transactions-page.test.tsx unit/selectors-dashboard.test.ts unit/rerender-matrix.test.tsx unit/diary-context.test.tsx`: 5 passed (116 tests total) in 4.77s.
  - `npm run test:unit`: 62 test files passed, 1432 tests passed in 44.88s (`workflow/stages/02_build/output/logs/T767-unit.log`).
  - Vitest shuffle (`npm run test:unit:shuffle`): 62 test files passed, 1432 tests passed in 53.58s (seed `1792225420210`).
  - Targeted Playwright (12 specs, Chromium): 71 passed in 40.3s.
  - Targeted Playwright (12 specs, all 3 browsers): 207 passed, 6 skipped in 3.7m.
  - Full Playwright E2E suite (`npm test`): 35 spec files, 179 tests, 537 runs across Chromium, Firefox, WebKit: 531 passed, 6 skipped by design, 0 failed in 9.9m (`workflow/stages/02_build/output/logs/T767-e2e-full.log`).

## Gate commands and results

1. Red gate:
   - `npx vitest run unit/dashboard.test.tsx`: 8 failed, 38 passed as expected.
   - `npx playwright test tests/dashboard.spec.ts --project=chromium`: row 1 & row 2 passed (10/10), row 3 failed (4/5) as expected.

2. Lint:
   - `npm run lint`: passed clean (check:node-globals 132 files, check:safe-ids 132 files, tsc --noEmit, tsc -p api/tsconfig.json).

3. Related unit tests:
   - `npx vitest run unit/dashboard.test.tsx unit/transactions-page.test.tsx unit/selectors-dashboard.test.ts unit/rerender-matrix.test.tsx unit/diary-context.test.tsx`: 5 passed, 116 tests passed in 4.77s.

4. Full unit suite:
   - `npm run test:unit`: 62 passed, 1432 passed in 44.88s.
   - Log path: `workflow/stages/02_build/output/logs/T767-unit.log`

5. Targeted E2E (12 specs on Chromium):
   - `npx playwright test tests/dashboard.spec.ts tests/theme.spec.ts tests/account-and-mobile-nav.spec.ts tests/transfer-preview.spec.ts tests/wallet-forms.spec.ts tests/wallets-page.spec.ts tests/layout-stability.spec.ts tests/reduced-motion.spec.ts tests/date-boundary.spec.ts tests/routing.spec.ts tests/safe-area.spec.ts tests/toast-layering.spec.ts --project=chromium`: 71 passed in 40.3s.

6. Targeted E2E (12 specs on all 3 browsers):
   - Same twelve specs without project filter: 207 passed, 6 skipped in 3.7m.

7. Full Playwright E2E suite (Gate 7):
   - `npm test`: 531 passed, 6 skipped (by design) in 9.9m.
   - Log path: `workflow/stages/02_build/output/logs/T767-e2e-full.log`

8. Clean production build and bundle measurement:
   - `npm run build`: built in 3.98s.
   - Entry chunk `index-wgYjfCND.js`: 193,252 B (+1,556 B), 56,336 B gzip (+526 B against Phase 134 `index-C7LsbYem.js`, 191,696 / 55,810).
   - All app JS: 884,332 B (+6,103 B), 268,499 B gzip (+1,587 B), 39 files (-1 file against Phase 134 878,229 / 266,912, 40 files).
   - CSS `index-z3bqoA9P.css`: 52,884 B (+125 B), 10,209 B gzip (+50 B against Phase 134 `index-CqllkKUj.css`, 52,759 / 10,159).

9. WCAG tokens check:
   - `node scripts/wcag-tokens.mjs`: passed clean, all token pairs pass.

10. Line endings check:
    - `git ls-files --eol`: `src/components/ViewLoadingFallback.tsx` confirmed `w/lf`, all other target files confirmed `w/crlf`.

11. No em dash check:
    - Verified 0 U+2014 characters added in git diff across all target files.

12. No raw size / hex check:
    - Verified `text-\[[0-9]+px\]|#[0-9A-Fa-f]{6}` in `WalletsSection.tsx`, `MoodSpendingCard.tsx`, `RecentActivityCard.tsx`, and `CategorySpendingCard.tsx` returns 0 matches.

13. NetWorthCard removal verification:
    - `git grep -n "NetWorthCard" -- src unit tests DESIGN.md AGENTS.md docs/contexts` returned 0 matches.

14. Docs check:
    - Verified test counts across `AGENTS.md`, `docs/contexts/ui-and-e2e.md`, and `README.md` match 1432 Vitest tests and 179 Playwright tests (537 runs).

15. Git status cleanliness:
    - `git status --porcelain` lists only target files, `docs/audit/task-ledger.md`, and stage outputs.

## Deliberately not done

- The mock's seven-day strip with empty placeholder days (owner decision A: strip displays only days returned by `moodSpendingDays` up to 5, oldest on left).
- The header and nav restyle and the darker brand theme (owner spec 6, "Later").
- The hero token (Backlog row).
- The visual check by eye in both themes at 1280 px and phone width, which is the owner's, after merge.


## Fix round 1

Addressed Blocking 1 from `task-T767-review.md`:
- Rewrote the Phase 135 entry in `docs/audit/refactor-log.md`:
  - Header formatted exactly as `## Phase 135 - Dashboard UI: T765-T767 (2026-10-17, code `<sha>`, merged `<sha>`)`.
  - Brief updated to describe the Dashboard body rebuilt to the 2026-10 owner spec across T765, T766, and T767.
  - Changed lists built strictly from `git show --stat 3f7b3e8` (T765), `git show --stat 662c528` (T766), and `git status --porcelain` (T767), naming only files tracked in git and omitting stage files.
  - Verified entries for T765 and T766 copied word for word from `docs/audit/task-ledger.md` gate result cells. T767 updated to state "0 NetWorthCard references in src, unit, tests, DESIGN.md, AGENTS.md and docs/contexts".
  - Surprises updated with true and sourced items: T765 em-dash gate whole-file check vs added lines, T766 spec placement of DESIGN.md rest-row clause, and full-suite WebKit 15 s click stall on Windows (csv-classify, ADR 0058) passing on rerun.
  - Deliberately not done preserved the four items.
- Gates rerun:
  - `git ls-files --error-unmatch` verified for all 21 cited paths, and `git log --oneline -1 -- src/components/dashboard/NetWorthCard.tsx` verified for the deleted file.
  - `git ls-files --eol docs/audit/refactor-log.md` verified `w/crlf`.
  - 0 U+2014 em dashes in added lines of `docs/audit/refactor-log.md`.
  - `git status --porcelain` verified unchanged apart from `refactor-log.md`, `task-ledger.md`, and stage outputs.
