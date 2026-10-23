# Build report: T797

Phase 144, branch `phase-144-smooth-sync-and-tabs`. Preload tab views at idle via `lazyView` and React 19 `use()` so tab switches render without committing `ViewLoadingFallback` (ADR 0104). Retained code splitting (6 separate view chunks), 200 ms `motion-page` slide, `key={activeTab}` view remount (ADR 0005), and added zero dependencies.

## Files changed (9)

1. `docs/audit/decisions/0104-preload-tab-views.md` (target file: new ADR 0104 recording the idle preload decision, `lazyView` helper, React 19 `use()` semantics, and bundle constraints)
2. `src/utils/lazyView.tsx` (target file: new helper exporting `lazyView` and `runWhenIdle`, caching component promises with `{ status: 'fulfilled', value }` for synchronous unwrapping)
3. `src/App.tsx` (target file: swapped the 6 tab view definitions from `React.lazy` to `lazyView`, added `preloadViews` invocation via `runWhenIdle` in `useEffect`)
4. `unit/lazy-view.test.tsx` (target file: new Vitest suite with 5 unit tests covering render, preload, memoization, synchronous unwrapping, and fallback behavior)
5. `tests/tab-preload.spec.ts` (target file: new Playwright spec with 2 tests verifying all 6 views are fetched in idle time without tab clicks, and tab switching occurs with zero fallback commitments)
6. `tests/helpers.ts` (target file: updated `gotoTab` doc comment from `React.lazy` to `lazyView`)
7. `docs/audit/test-selector-contract.md` (target file: registered `tab-preload.spec.ts` with its selector references in alphabetical order)
8. `docs/contexts/ui-and-e2e.md` (target file: recorded `lazyView` preload rule under UI limits)
9. `docs/audit/task-ledger.md` (bookkeeping: added Phase 144 section, recorded T797 row with gate results and empty Commit cell)

## Tests added

- `unit/lazy-view.test.tsx`: 5 tests in `lazyView`
  1. `renders the component after dynamic import resolves`
  2. `preload() starts the import and returns the same promise`
  3. `preloaded view renders synchronously via use() without suspending`
  4. `multiple calls to preload() reuse the in-flight import promise`
  5. `runWhenIdle falls back to setTimeout when requestIdleCallback is unavailable`
- `tests/tab-preload.spec.ts`: 2 tests in `Tab view idle preloading`
  1. `the other views are requested without a tab click` (confirms all 6 tab view chunks are fetched in idle time without navigating)
  2. `switching through every tab never shows the loading skeleton` (clicks each tab and asserts `window.__fallbackSeen === 0`)

## Fail-then-pass evidence

### Red run (against unchanged codebase)
Saved to `workflow/stages/02_build/output/logs/T797-red.log`.

Command 1 (unit):
```powershell
npx vitest run unit/lazy-view.test.tsx
```
Failure summary:
```
RUN  v5.0.1 C:/Users/MRmar/Desktop/Mid years projects/IncomeAndExpence
No test files found, exiting with code 1
filter: unit/lazy-view.test.tsx
```

Command 2 (playwright e2e):
```powershell
npx playwright test tests/tab-preload.spec.ts --project=chromium
```
Failure summary:
```
Running 2 tests using 2 workers
[1/2] [chromium] › tests\tab-preload.spec.ts:8:3 › Tab view idle preloading › the other views are requested without a tab click
[2/2] [chromium] › tests\tab-preload.spec.ts:24:3 › Tab view idle preloading › switching through every tab never shows the loading skeleton
  1) [chromium] › tests\tab-preload.spec.ts:8:3 › Tab view idle preloading › the other views are requested without a tab click
    Error: expect(received).toEqual(expected) // deep equality
    - Expected  - 5
    + Received  + 0
      Array [
    -   "Categories",
        "Dashboard",
    -   "Debts",
    -   "Diary",
    -   "Transactions",
    -   "Wallets",
      ]
    Timeout 15000ms exceeded while waiting on the predicate
  2) [chromium] › tests\tab-preload.spec.ts:24:3 › Tab view idle preloading › switching through every tab never shows the loading skeleton
    Timeout 15000ms exceeded while waiting on the predicate
  2 failed
```

### Green run (after all edits landed)

Command 1 (unit):
```powershell
npx vitest run unit/lazy-view.test.tsx
```
Result:
```
 ✓ unit/lazy-view.test.tsx (5 tests) 1481ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  2.08s
```

Command 2 (playwright e2e):
```powershell
npx playwright test tests/tab-preload.spec.ts --project=chromium
```
Result:
```
Running 2 tests using 2 workers
[1/2] [chromium] › tests\tab-preload.spec.ts:8:3 › Tab view idle preloading › the other views are requested without a tab click
[2/2] [chromium] › tests\tab-preload.spec.ts:24:3 › Tab view idle preloading › switching through every tab never shows the loading skeleton
  2 passed (15.9s)
```

Command 3 (repeat-each=5 flake check):
```powershell
npx playwright test tests/tab-preload.spec.ts --project=chromium --repeat-each=5
```
Result:
```
Running 10 tests using 4 workers
  10 passed (21.1s)
```

## Gate commands and results

1. `npm run lint`: clean (0 errors)
   - node-globals check: 0 errors
   - safe-id check: 0 errors
   - `tsc --noEmit`: 0 errors
   - `tsc -p api/tsconfig.json`: 0 errors
2. `npx vitest run unit/lazy-view.test.tsx`: 5 passed in 1.48s
3. `npm run test:unit`: 67 test files, 1,480 passed in 54.02s
   - Log: `workflow/stages/02_build/output/logs/T797-unit.log`
4. `npx playwright test tests/tab-preload.spec.ts --project=chromium`: 2 passed in 15.9s
5. `npx playwright test tests/tab-preload.spec.ts --project=chromium --repeat-each=5`: 10 passed in 21.1s
6. Targeted specs on Chromium:
   `npx playwright test tests/tab-preload.spec.ts tests/account-and-mobile-nav.spec.ts tests/categories-page.spec.ts tests/dashboard.spec.ts tests/diary.spec.ts tests/transaction.spec.ts tests/wallets-page.spec.ts --project=chromium`
   - 7 specs, 53 passed in 36.1s
7. Targeted specs on 3 browsers (Chromium, Firefox, WebKit):
   `npx playwright test tests/tab-preload.spec.ts tests/account-and-mobile-nav.spec.ts tests/categories-page.spec.ts tests/dashboard.spec.ts tests/diary.spec.ts tests/transaction.spec.ts tests/wallets-page.spec.ts`
   - 7 specs, 153 passed, 6 skipped in 2.9m
8. Full Playwright suite:
   `npm test`
   - 36 specs, 543 passed, 6 skipped in 10.8m
   - Log: `workflow/stages/02_build/output/logs/T797-e2e.log`
9. Production build and bundle size verification:
   `npm run clean; npm run build`
   - `index-CKmfyoLI.js`: 194,042 B (baseline 193,293 B; delta +749 B <= 1,500 B limit)
   - All app JS: 885,736 B across 39 files (baseline 884,987 B; delta +749 B <= 2,500 B limit, 39 files)
   - View chunks: 6 separate files (`DashboardView-*.js`, `TransactionsView-*.js`, `WalletsView-*.js`, `DebtsView-*.js`, `DiaryView-*.js`, `CategoriesView-*.js`)
   - Leaks into `dist/index.html`: 0 view chunks referenced

## Hygiene checks

- Line endings: All touched and new target files use strict CRLF endings (0 lone LFs).
- Em dashes: Zero em dashes (`\u2014`) present in git diff and all touched files.
- Scope: Edits strictly confined to the 9 target files and bookkeeping paths in `workflow/stages/02_build/output/`.
- Git commits: None made. Working tree left ready for reviewer stage.

## Deliberately not done

- Shell modals (`QuickAddModal`, `TransferFundsModal`, `AddWalletModal`, `AccountModal`) remain dynamically loaded on demand via `React.lazy` per ADR 0010; they are not preloaded at idle to avoid loading large modal forms (such as `TransactionForm`, `csvExchange`, etc.) on first paint.
- Preloading on mobile uses `runWhenIdle` identically to desktop; no custom device heuristics or network condition detection was introduced, avoiding speculative complexity.
